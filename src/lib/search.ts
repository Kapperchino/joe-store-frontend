import type { CloudflareSearchChunk, CloudflareSearchResult } from '$lib/api';

export type SearchChunkEntry = { index: number; content: string };
export type SearchMessageRole = 'user' | 'assistant' | 'tool';
export type RenderedSearchChunk = CloudflareSearchChunk & {
	excerpt: string;
	html: string;
	role?: SearchMessageRole;
	timestamp?: string;
};
export type RenderedSearchResult = Omit<CloudflareSearchResult, 'chunks'> & {
	chunks?: RenderedSearchChunk[];
};

export function searchChunkEntries(chunk: CloudflareSearchChunk): SearchChunkEntry[] {
	const entries: SearchChunkEntry[] = [];
	const entryPattern = /"index"\s*:\s*(\d+)\s*,\s*"content"\s*:\s*("(?:\\.|[^"\\])*")/g;

	for (const match of chunk.text.matchAll(entryPattern)) {
		if (!match[1] || !match[2]) continue;
		const index = Number(match[1]);
		if (!Number.isSafeInteger(index) || index < 0) continue;

		try {
			const content = JSON.parse(match[2]) as unknown;
			if (typeof content === 'string') entries.push({ index, content });
		} catch {
			// A provider may return a chunk cut through a JSON string. The raw
			// chunk remains available as a visible and deep-link fallback.
		}
	}

	return entries;
}

function integerSessionId(value: unknown): number | null {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function searchChunkSessionId(chunk: CloudflareSearchChunk): number | null {
	const metadata = chunk.item?.metadata;
	if (metadata && typeof metadata === 'object') {
		const metadataId = integerSessionId(metadata.session_id);
		if (metadataId !== null) return metadataId;
	}

	const keyMatch = chunk.item?.key.match(/(?:^|\/)session-(\d+)\.json$/i);
	return integerSessionId(keyMatch?.[1]);
}

function queryMatchScore(content: string, query: string): number {
	const haystack = content.toLocaleLowerCase();
	const needle = query.toLocaleLowerCase().trim();
	if (!needle) return 0;
	if (haystack.includes(needle)) return 10_000 + needle.length;

	return [...new Set(needle.split(/\s+/).filter((term) => term.length > 1))].reduce(
		(score, term) => score + (haystack.includes(term) ? term.length : 0),
		0
	);
}

function decodeLooseJsonString(value: string): string {
	return value
		.replace(/\\n/g, '\n')
		.replace(/\\r/g, '')
		.replace(/\\t/g, '\t')
		.replace(/\\"/g, '"')
		.replace(/\\\\/g, '\\');
}

function stripInternalContext(value: string): string {
	return value
		.replace(/<environment_context>[\s\S]*?<\/environment_context>/gi, '')
		.replace(/<permissions instructions>[\s\S]*?<\/permissions instructions>/gi, '')
		.trim();
}

function structuredTextCandidates(source: string): string[] {
	const candidates: string[] = [];
	const stringFieldPattern =
		/"(?:message|text|content|summary|prompt|query)"\s*:\s*("(?:\\.|[^"\\])*")/gi;

	for (const match of source.matchAll(stringFieldPattern)) {
		if (!match[1]) continue;
		try {
			const parsed = JSON.parse(match[1]) as unknown;
			if (typeof parsed === 'string') {
				const cleaned = stripInternalContext(parsed);
				if (cleaned) candidates.push(cleaned);
			}
		} catch {
			// Ignore fields cut off at the chunk boundary.
		}
	}

	return candidates;
}

export function searchTextExcerpt(value: string, query: string): string {
	const source = value.trim();
	const maxLength = 700;
	if (source.length <= maxLength) return source;

	const normalized = source.toLocaleLowerCase();
	const phrase = query.trim().toLocaleLowerCase();
	let matchIndex = phrase ? normalized.indexOf(phrase) : -1;
	let matchLength = phrase.length;
	if (matchIndex < 0) {
		for (const term of phrase.split(/\s+/).filter((candidate) => candidate.length > 1)) {
			matchIndex = normalized.indexOf(term);
			if (matchIndex >= 0) {
				matchLength = term.length;
				break;
			}
		}
	}

	if (matchIndex < 0) return `${source.slice(0, maxLength).trimEnd()}…`;

	let start = Math.max(0, matchIndex - 220);
	let end = Math.min(source.length, matchIndex + matchLength + 420);
	const earlierBoundary = source.slice(Math.max(0, start - 40), start).search(/\s\S*$/);
	if (earlierBoundary >= 0) start = Math.max(0, start - 40) + earlierBoundary + 1;
	const laterBoundary = source.slice(end, Math.min(source.length, end + 40)).search(/\s/);
	if (laterBoundary >= 0) end += laterBoundary;

	return `${start > 0 ? '…' : ''}${source.slice(start, end).trim()}${end < source.length ? '…' : ''}`;
}

export function searchChunkEntryIndex(chunk: CloudflareSearchChunk, query: string): number | null {
	const entries = searchChunkEntries(chunk);
	if (entries.length === 0) {
		const indexMatch = chunk.text.match(/"index"\s*:\s*(\d+)/);
		return indexMatch ? Number(indexMatch[1]) : null;
	}

	return entries.sort(
		(a, b) => queryMatchScore(b.content, query) - queryMatchScore(a.content, query)
	)[0].index;
}

export function searchChunkText(chunk: CloudflareSearchChunk): string {
	const entries = searchChunkEntries(chunk);
	return entries.length > 0 ? entries.map((entry) => entry.content).join('\n\n') : chunk.text;
}

export function searchChunkMatchedText(chunk: CloudflareSearchChunk, query: string): string {
	const entries = searchChunkEntries(chunk);
	if (entries.length > 0) {
		const content = entries.sort(
			(a, b) => queryMatchScore(b.content, query) - queryMatchScore(a.content, query)
		)[0].content;
		return searchTextExcerpt(stripInternalContext(content), query);
	}

	const candidates = structuredTextCandidates(chunk.text);
	const content =
		candidates.sort((a, b) => queryMatchScore(b, query) - queryMatchScore(a, query))[0] ??
		stripInternalContext(decodeLooseJsonString(chunk.text));
	return searchTextExcerpt(content, query);
}
