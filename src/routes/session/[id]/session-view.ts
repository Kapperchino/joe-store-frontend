import type { ClaudeSessionEntry, OpenAISessionEntry, Session } from '$lib/api';
import { renderMarkdown } from './markdown.server';

export type SessionRole = 'user' | 'assistant' | 'tool';

export interface ToolActivity {
	label: string;
	input?: string;
	output?: string;
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

function claudeUserTools(
	entry: Extract<ClaudeSessionEntry, { type: 'user' }>
): ToolActivity[] {
	const content = entry.message.content;
	if (typeof content === 'string') return [];

	return content
		.filter((block) => block.type === 'tool_result')
		.map((block) => ({
			label: block.is_error ? 'Tool error' : 'Tool result',
			output: formatDetail(block.content)
		}));
}

function claudeView(data: ClaudeSessionEntry[]): SessionView {
	const messages: SessionMessageView[] = [];

	data.forEach((entry, index) => {
		if (entry.type === 'user') {
			const text = claudeText(entry);
			const tools = claudeUserTools(entry);
			if (text || tools.length > 0) {
				messages.push({
					id: entry.uuid || `claude-${index}`,
					role: text ? 'user' : 'tool',
					text,
					html: text ? renderMarkdown(text) : undefined,
					timestamp: entry.timestamp,
					tools
				});
			}
		}

		if (entry.type === 'assistant') {
			const text = entry.message.content
				.filter((block) => block.type === 'text')
				.map((block) => block.text)
				.join('\n\n')
				.trim();
			const tools = entry.message.content
				.filter((block) => block.type === 'tool_use')
				.map((block) => ({ label: String(block.name), input: formatDetail(block.input) }));

			if (text || tools.length > 0) {
				messages.push({
					id: entry.uuid || `claude-${index}`,
					role: 'assistant',
					text: text || undefined,
					html: text ? renderMarkdown(text) : undefined,
					timestamp: entry.timestamp,
					tools
				});
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
					messages.push({
						id: `openai-${index}`,
						role: item.role,
						text,
						html: renderMarkdown(text),
						timestamp: entry.timestamp,
						tools: []
					});
				}
			}

			if (item.type === 'function_call' || item.type === 'custom_tool_call') {
				messages.push({
					id: item.call_id || `openai-${index}`,
					role: 'tool',
					timestamp: entry.timestamp,
					tools: [
						{
							label: item.name,
							input: formatDetail(item.type === 'function_call' ? item.arguments : item.input)
						}
					]
				});
			}

			if (item.type === 'function_call_output' || item.type === 'custom_tool_call_output') {
				messages.push({
					id: `${item.call_id}-output-${index}`,
					role: 'tool',
					timestamp: entry.timestamp,
					tools: [{ label: 'Tool result', output: formatDetail(item.output) }]
				});
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
					messages.push({
						id: `openai-event-${index}`,
						role: event.type === 'user_message' ? 'user' : 'assistant',
						text,
						html: renderMarkdown(text),
						timestamp: entry.timestamp,
						tools: []
					});
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

export function createSessionView(session: Session): SessionView {
	return session.type === 'claude' ? claudeView(session.data) : openAIView(session.data);
}
