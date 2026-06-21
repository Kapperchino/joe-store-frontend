import type { ClaudeSessionEntry, OpenAISessionEntry, Session } from '$lib/api';
import { renderMarkdown } from './markdown.server';

export type SessionRole = 'user' | 'assistant' | 'tool';

export interface ToolActivity {
	label: string;
	input?: string;
	output?: string;
	isError?: boolean;
}

export interface SessionMessageView {
	id: string;
	role: SessionRole;
	text?: string;
	html?: string;
	timestamp?: string;
	tools: ToolActivity[];
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
				} else {
					orphanResults.push({
						label: block.is_error ? 'Tool error' : 'Tool result',
						output,
						isError: block.is_error ?? false
					});
				}
			}

			if (text) {
				messages.push({
					id: entry.uuid || `claude-${index}`,
					role: 'user',
					text,
					html: renderMarkdown(text),
					timestamp: entry.timestamp,
					tools: []
				});
				lastAssistant = undefined;
			}

			if (orphanResults.length > 0) {
				if (lastAssistant) {
					lastAssistant.tools.push(...orphanResults);
				} else {
					messages.push({
						id: entry.uuid || `claude-${index}`,
						role: 'tool',
						timestamp: entry.timestamp,
						tools: orphanResults
					});
				}
			}
		}

		if (entry.type === 'assistant') {
			const text = entry.message.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('\n\n')
				.trim();
			const tools: ToolActivity[] = [];
			for (const block of entry.message.content) {
				if (block.type === 'tool_use') {
					const activity: ToolActivity = {
						label: String(block.name),
						input: formatDetail(block.input)
					};
					tools.push(activity);
					if (block.id) toolsById.set(block.id, activity);
				}
			}

			if (text || tools.length > 0) {
				const message: SessionMessageView = {
					id: entry.uuid || `claude-${index}`,
					role: 'assistant',
					text: text || undefined,
					html: text ? renderMarkdown(text) : undefined,
					timestamp: entry.timestamp,
					tools
				};
				messages.push(message);
				lastAssistant = message;
			}
		}
	});

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
					const message: SessionMessageView = {
						id: `openai-${index}`,
						role: item.role,
						text,
						html: renderMarkdown(text),
						timestamp: entry.timestamp,
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
						tools: []
					};
					messages.push(lastAssistant);
				}
				lastAssistant.tools.push(activity);
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
					lastAssistant.tools.push({ label: 'Tool result', output, isError });
				} else {
					messages.push({
						id: `${item.call_id}-output-${index}`,
						role: 'tool',
						timestamp: entry.timestamp,
						tools: [{ label: 'Tool result', output, isError }]
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
					const message: SessionMessageView = {
						id: `openai-event-${index}`,
						role: event.type === 'user_message' ? 'user' : 'assistant',
						text,
						html: renderMarkdown(text),
						timestamp: entry.timestamp,
						tools: []
					};
					messages.push(message);
					lastAssistant = event.type === 'agent_message' ? message : undefined;
				}
			}
		}
	});

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
// arrive as separate entries — is merged so its tools list together in one reply.
function mergeAgentTurns(messages: SessionMessageView[]): SessionMessageView[] {
	const merged: SessionMessageView[] = [];

	for (const message of messages) {
		const previous = merged.at(-1);

		if (message.role !== 'user' && previous && previous.role !== 'user') {
			previous.tools.push(...message.tools);
			if (message.text) {
				previous.text = previous.text ? `${previous.text}\n\n${message.text}` : message.text;
			}
			if (message.html) {
				previous.html = previous.html ? `${previous.html}\n${message.html}` : message.html;
			}
			if (message.role === 'assistant') previous.role = 'assistant';
			continue;
		}

		merged.push({ ...message, tools: [...message.tools] });
	}

	return merged;
}

export function createSessionView(session: Session): SessionView {
	const view = session.type === 'claude' ? claudeView(session.data) : openAIView(session.data);
	return { ...view, messages: mergeAgentTurns(view.messages) };
}
