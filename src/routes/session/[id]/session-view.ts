import type { ClaudeSessionEntry, OpenAISessionEntry, Session } from '$lib/api';
import { renderMarkdown } from './markdown.server';

export type SessionRole = 'user' | 'assistant' | 'tool';

export interface QuestionOptionView {
	label: string;
	description?: string;
	selected: boolean;
}

export interface QuestionView {
	header?: string;
	question: string;
	multiSelect: boolean;
	options: QuestionOptionView[];
	answer?: string;
}

export interface ToolActivity {
	label: string;
	input?: string;
	output?: string;
	isError?: boolean;
	// Structured AskUserQuestion view: the questions asked, their options, and
	// which option(s) the user ended up choosing.
	questions?: QuestionView[];
}

// A message is an ordered sequence of parts so that text and tool activity
// render in the order they actually occurred (text → tool → text → tool),
// rather than all prose first followed by a batch of tools.
export type MessagePart =
	| { kind: 'text'; text: string; html: string }
	| { kind: 'tool'; tool: ToolActivity };

export interface SessionMessageView {
	id: string;
	role: SessionRole;
	timestamp?: string;
	parts: MessagePart[];
	// Derived from `parts` once the view is assembled; kept for the collapsed
	// preview (title text + tool count) where ordering doesn't matter.
	text?: string;
	tools: ToolActivity[];
}

// Append a text block, merging into the trailing text part when one is already
// there so consecutive prose stays a single markdown unit.
function appendText(parts: MessagePart[], raw: string | undefined): void {
	const text = raw?.trim();
	if (!text) return;
	const last = parts.at(-1);
	if (last?.kind === 'text') {
		last.text = `${last.text}\n\n${text}`;
		last.html = renderMarkdown(last.text);
	} else {
		parts.push({ kind: 'text', text, html: renderMarkdown(text) });
	}
}

// Collapse the ordered parts back down to the flat `text`/`tools` fields used by
// the message preview.
function finalizeMessage(message: SessionMessageView): SessionMessageView {
	const textParts: string[] = [];
	const tools: ToolActivity[] = [];
	for (const part of message.parts) {
		if (part.kind === 'text') textParts.push(part.text);
		else tools.push(part.tool);
	}
	message.text = textParts.join('\n\n').trim() || undefined;
	message.tools = tools;
	return message;
}

export interface SessionView {
	provider: Session['type'];
	title: string;
	sessionIdentifier?: string;
	model?: string;
	cwd?: string;
	branch?: string;
	startedAt?: string;
	endedAt?: string;
	entryCount: number;
	messages: SessionMessageView[];
}

const MAX_TOOL_DETAIL_LENGTH = 20_000;

function formatDetail(value: unknown): string | undefined {
	if (value === undefined || value === null || value === '') return undefined;

	const formatted =
		typeof value === 'string' ? value : JSON.stringify(value, null, 2) || String(value);

	if (formatted.length <= MAX_TOOL_DETAIL_LENGTH) return formatted;

	return `${formatted.slice(0, MAX_TOOL_DETAIL_LENGTH)}\n\n… output truncated`;
}

function titleFromText(text: string | undefined): string | undefined {
	const normalized = text?.replace(/\s+/g, ' ').trim();
	if (!normalized) return undefined;
	return normalized.length > 80 ? `${normalized.slice(0, 77)}…` : normalized;
}

function stripOpenAIEnvironmentContext(text: string | undefined): string | undefined {
	let candidate = text?.trim();
	const environmentContext = /^\s*<environment_context>[\s\S]*?<\/environment_context>\s*/i;

	while (candidate && environmentContext.test(candidate)) {
		candidate = candidate.replace(environmentContext, '');
	}

	return candidate?.trim() || undefined;
}

function openAITitleFromText(text: string | undefined): string | undefined {
	return titleFromText(stripOpenAIEnvironmentContext(text));
}

// OpenAI tool output is either a plain string or content parts; flatten to text.
function openAIOutputText(output: unknown): string {
	if (typeof output === 'string') return output;
	if (Array.isArray(output)) {
		return output
			.map((part) =>
				part && typeof part === 'object' && 'text' in part
					? String((part as { text: unknown }).text)
					: ''
			)
			.join('\n');
	}
	return '';
}

// Heuristic: did a tool (notably apply_patch) report a failure? Used to avoid
// presenting a diff for an edit that was never actually applied.
function isFailureOutput(text: string): boolean {
	const normalized = text.toLowerCase();
	if (!normalized.trim()) return false;
	return (
		/(^|\n)\s*(error|fatal|traceback)\b/.test(normalized) ||
		normalized.includes('failed to apply') ||
		normalized.includes('patch does not apply') ||
		normalized.includes('apply_patch:') ||
		normalized.includes('no such file') ||
		normalized.includes('command failed') ||
		/exit code:?\s*[1-9]/.test(normalized)
	);
}

// AskUserQuestion input carries the questions and their selectable options.
function buildQuestions(input: unknown): QuestionView[] | undefined {
	if (!input || typeof input !== 'object') return undefined;
	const questions = (input as { questions?: unknown }).questions;
	if (!Array.isArray(questions) || questions.length === 0) return undefined;

	return questions.map((raw) => {
		const q = raw as Record<string, unknown>;
		const options = Array.isArray(q.options)
			? q.options.map((rawOption) => {
					const option = rawOption as Record<string, unknown>;
					return {
						label: String(option.label ?? ''),
						description: option.description ? String(option.description) : undefined,
						selected: false
					};
				})
			: [];
		return {
			header: typeof q.header === 'string' ? q.header : undefined,
			question: String(q.question ?? ''),
			multiSelect: Boolean(q.multiSelect),
			options
		};
	});
}

// The user's choice lives in the tool result's `answers` map, keyed by the
// question text; mark the matching option(s) selected and record the raw answer.
function applyAnswers(questions: QuestionView[], result: unknown): void {
	if (!result || typeof result !== 'object') return;
	const answers = (result as { answers?: unknown }).answers;
	if (!answers || typeof answers !== 'object') return;

	for (const question of questions) {
		const answer = (answers as Record<string, unknown>)[question.question];
		if (typeof answer !== 'string') continue;
		question.answer = answer;
		const chosen = question.multiSelect ? answer.split(/,\s*/) : [answer];
		for (const option of question.options) {
			option.selected = chosen.includes(option.label);
		}
	}
}

function range(timestamps: Array<string | undefined>) {
	const values = timestamps.filter((value): value is string => Boolean(value));
	return { startedAt: values.at(0), endedAt: values.at(-1) };
}

function claudeText(entry: Extract<ClaudeSessionEntry, { type: 'user' }>): string | undefined {
	const content = entry.message.content;
	if (typeof content === 'string') return content;

	const text = content
		.filter((block) => block.type === 'text')
		.map((block) => block.text)
		.join('\n\n')
		.trim();

	return text || undefined;
}

function claudeView(data: ClaudeSessionEntry[]): SessionView {
	const messages: SessionMessageView[] = [];
	// Tool calls and their results live in separate entries; track each call by
	// id so the result can be merged back into the assistant reply that issued it.
	const toolsById = new Map<string, ToolActivity>();
	let lastAssistant: SessionMessageView | undefined;

	data.forEach((entry, index) => {
		if (entry.type === 'user') {
			const text = claudeText(entry);
			const content = entry.message.content;
			const resultBlocks =
				typeof content === 'string'
					? []
					: content.filter((block) => block.type === 'tool_result');

			const orphanResults: ToolActivity[] = [];
			for (const block of resultBlocks) {
				const existing = toolsById.get(block.tool_use_id);
				const output = formatDetail(block.content);
				if (existing) {
					existing.output = output;
					existing.isError = block.is_error ?? false;
					if (existing.questions) applyAnswers(existing.questions, entry.toolUseResult);
				} else {
					orphanResults.push({
						label: block.is_error ? 'Tool error' : 'Tool result',
						output,
						isError: block.is_error ?? false
					});
				}
			}

			if (text) {
				const parts: MessagePart[] = [];
				appendText(parts, text);
				messages.push({
					id: entry.uuid || `claude-${index}`,
					role: 'user',
					timestamp: entry.timestamp,
					parts,
					tools: []
				});
				lastAssistant = undefined;
			}

			if (orphanResults.length > 0) {
				if (lastAssistant) {
					for (const tool of orphanResults) lastAssistant.parts.push({ kind: 'tool', tool });
				} else {
					messages.push({
						id: entry.uuid || `claude-${index}`,
						role: 'tool',
						timestamp: entry.timestamp,
						parts: orphanResults.map((tool) => ({ kind: 'tool', tool })),
						tools: []
					});
				}
			}
		}

		if (entry.type === 'assistant') {
			// Walk the content blocks in order so text and tool calls keep their
			// original sequence (text → tool → text → tool).
			const parts: MessagePart[] = [];
			for (const block of entry.message.content) {
				if (block.type === 'text') {
					appendText(parts, block.text);
				} else if (block.type === 'tool_use') {
					const activity: ToolActivity = {
						label: String(block.name),
						input: formatDetail(block.input)
					};
					if (block.name === 'AskUserQuestion') {
						activity.questions = buildQuestions(block.input);
					}
					parts.push({ kind: 'tool', tool: activity });
					if (block.id) toolsById.set(block.id, activity);
				}
			}

			if (parts.length > 0) {
				const message: SessionMessageView = {
					id: entry.uuid || `claude-${index}`,
					role: 'assistant',
					timestamp: entry.timestamp,
					parts,
					tools: []
				};
				messages.push(message);
				lastAssistant = message;
			}
		}
	});

	messages.forEach(finalizeMessage);

	const titleEntry = data.find((entry) => entry.type === 'ai-title');
	const lastPromptEntry = data.find((entry) => entry.type === 'last-prompt');
	const commonEntry = data.find(
		(entry) => entry.type === 'user' || entry.type === 'assistant' || entry.type === 'attachment'
	);
	const assistantEntry = data.find((entry) => entry.type === 'assistant');
	const timestamps = data.map((entry) => ('timestamp' in entry ? entry.timestamp : undefined));
	const { startedAt, endedAt } = range(timestamps);

	return {
		provider: 'claude',
		title:
			(titleEntry?.type === 'ai-title' ? titleEntry.aiTitle : undefined) ??
			titleFromText(lastPromptEntry?.type === 'last-prompt' ? (lastPromptEntry.lastPrompt ?? undefined) : undefined) ??
			titleFromText(messages.find((message) => message.role === 'user')?.text) ??
			'Claude session',
		sessionIdentifier: commonEntry && 'sessionId' in commonEntry ? commonEntry.sessionId : undefined,
		model: assistantEntry?.type === 'assistant' ? assistantEntry.message.model : undefined,
		cwd: commonEntry && 'cwd' in commonEntry ? commonEntry.cwd : undefined,
		branch: commonEntry && 'gitBranch' in commonEntry ? commonEntry.gitBranch : undefined,
		startedAt,
		endedAt,
		entryCount: data.length,
		messages
	};
}

function openAIView(data: OpenAISessionEntry[]): SessionView {
	const messages: SessionMessageView[] = [];
	const hasConversationItems = data.some(
		(entry) =>
			entry.type === 'response_item' &&
			entry.payload.type === 'message' &&
			(entry.payload.role === 'user' || entry.payload.role === 'assistant')
	);

	// Tool calls and outputs arrive as separate items; track each call by id so
	// the output can be merged back into the assistant reply that issued it.
	const toolsById = new Map<string, ToolActivity>();
	let lastAssistant: SessionMessageView | undefined;

	data.forEach((entry, index) => {
		if (entry.type === 'response_item') {
			const item = entry.payload;

			if (item.type === 'message' && item.role !== 'developer') {
				const rawText = item.content
					.map((part) => part.text)
					.join('\n\n')
					.trim();
				const text =
					item.role === 'user' ? stripOpenAIEnvironmentContext(rawText) : rawText || undefined;
				if (text) {
					const parts: MessagePart[] = [];
					appendText(parts, text);
					const message: SessionMessageView = {
						id: `openai-${index}`,
						role: item.role,
						timestamp: entry.timestamp,
						parts,
						tools: []
					};
					messages.push(message);
					lastAssistant = item.role === 'assistant' ? message : undefined;
				}
			}

			if (item.type === 'function_call' || item.type === 'custom_tool_call') {
				const activity: ToolActivity = {
					label: item.name,
					input: formatDetail(item.type === 'function_call' ? item.arguments : item.input)
				};
				if (item.call_id) toolsById.set(item.call_id, activity);

				// Attach the call to the assistant turn that issued it; if the model
				// went straight to a tool with no text, synthesize an assistant reply.
				if (!lastAssistant) {
					lastAssistant = {
						id: item.call_id || `openai-${index}`,
						role: 'assistant',
						timestamp: entry.timestamp,
						parts: [],
						tools: []
					};
					messages.push(lastAssistant);
				}
				lastAssistant.parts.push({ kind: 'tool', tool: activity });
			}

			if (item.type === 'function_call_output' || item.type === 'custom_tool_call_output') {
				const existing = toolsById.get(item.call_id);
				const text = openAIOutputText(item.output);
				const output = formatDetail(text);
				const isError = isFailureOutput(text);
				if (existing) {
					existing.output = output;
					existing.isError = isError;
				} else if (lastAssistant) {
					lastAssistant.parts.push({ kind: 'tool', tool: { label: 'Tool result', output, isError } });
				} else {
					messages.push({
						id: `${item.call_id}-output-${index}`,
						role: 'tool',
						timestamp: entry.timestamp,
						parts: [{ kind: 'tool', tool: { label: 'Tool result', output, isError } }],
						tools: []
					});
				}
			}
		}

		if (!hasConversationItems && entry.type === 'event_msg') {
			const event = entry.payload;
			if (event.type === 'user_message' || event.type === 'agent_message') {
				const text =
					event.type === 'user_message'
						? stripOpenAIEnvironmentContext(event.message)
						: event.message.trim() || undefined;
				if (text) {
					const parts: MessagePart[] = [];
					appendText(parts, text);
					const message: SessionMessageView = {
						id: `openai-event-${index}`,
						role: event.type === 'user_message' ? 'user' : 'assistant',
						timestamp: entry.timestamp,
						parts,
						tools: []
					};
					messages.push(message);
					lastAssistant = event.type === 'agent_message' ? message : undefined;
				}
			}
		}
	});

	messages.forEach(finalizeMessage);

	const metaEntry = data.find((entry) => entry.type === 'session_meta');
	const turnEntry = data.find((entry) => entry.type === 'turn_context');
	const meta = metaEntry?.type === 'session_meta' ? metaEntry.payload : undefined;
	const turn = turnEntry?.type === 'turn_context' ? turnEntry.payload : undefined;
	const { startedAt, endedAt } = range(data.map((entry) => entry.timestamp));

	return {
		provider: 'openai',
		title:
			messages
				.filter((message) => message.role === 'user')
				.map((message) => openAITitleFromText(message.text))
				.find((title) => title !== undefined) ?? 'OpenAI session',
		sessionIdentifier: meta?.id,
		model: turn?.model,
		cwd: meta?.cwd ?? turn?.cwd,
		branch: meta?.git.branch,
		startedAt,
		endedAt,
		entryCount: data.length,
		messages
	};
}

// Collapse a whole agent turn into a single block: everything an assistant says
// and does between two user messages — including multi-step tool round-trips that
// arrive as separate entries — is merged. Parts are concatenated in arrival order
// so the interleaving of text and tools is preserved across the merged entries.
function mergeAgentTurns(messages: SessionMessageView[]): SessionMessageView[] {
	const merged: SessionMessageView[] = [];

	for (const message of messages) {
		const previous = merged.at(-1);

		if (message.role !== 'user' && previous && previous.role !== 'user') {
			for (const part of message.parts) {
				if (part.kind === 'text') appendText(previous.parts, part.text);
				else previous.parts.push(part);
			}
			if (message.role === 'assistant') previous.role = 'assistant';
			continue;
		}

		merged.push({ ...message, parts: [...message.parts] });
	}

	return merged.map(finalizeMessage);
}

export function createSessionView(session: Session): SessionView {
	const view = session.type === 'claude' ? claudeView(session.data) : openAIView(session.data);
	return { ...view, messages: mergeAgentTurns(view.messages) };
}
