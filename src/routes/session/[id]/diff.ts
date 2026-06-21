export type DiffLineType = 'add' | 'del' | 'context' | 'meta';

export interface DiffLine {
	type: DiffLineType;
	text: string;
}

export type DiffFileOp = 'update' | 'add' | 'delete' | 'move';

export interface DiffFile {
	op: DiffFileOp;
	path?: string;
	/** Destination path for moves/renames. */
	newPath?: string;
	lines: DiffLine[];
}

export interface DiffView {
	files: DiffFile[];
}

// Guard against the O(n*m) LCS table blowing up on very large edits; past this
// the diff is rendered as a plain delete-then-add block instead.
const MAX_LCS_CELLS = 2_000_000;

function blockDiff(a: string[], b: string[]): DiffLine[] {
	return [
		...a.map((text): DiffLine => ({ type: 'del', text })),
		...b.map((text): DiffLine => ({ type: 'add', text }))
	];
}

/** Line-level LCS diff between two blocks of text (used for Edit tool calls). */
export function diffFromEdit(oldText: string, newText: string, file?: string): DiffView {
	const a = oldText.split('\n');
	const b = newText.split('\n');
	const n = a.length;
	const m = b.length;

	if (n * m > MAX_LCS_CELLS) {
		return { files: [{ op: 'update', path: file, lines: blockDiff(a, b) }] };
	}

	// lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:].
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] =
				a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const lines: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < n && j < m) {
		if (a[i] === b[j]) {
			lines.push({ type: 'context', text: a[i] });
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			lines.push({ type: 'del', text: a[i] });
			i++;
		} else {
			lines.push({ type: 'add', text: b[j] });
			j++;
		}
	}
	while (i < n) lines.push({ type: 'del', text: a[i++] });
	while (j < m) lines.push({ type: 'add', text: b[j++] });

	return { files: [{ op: 'update', path: file, lines }] };
}

/**
 * Parse already-formatted patch text (the apply_patch "V4A" format or a unified
 * diff) into per-file diffs. File operations (`*** Update/Add/Delete File:`,
 * `*** Move to:`) become structured headers rather than raw lines, and patch
 * scaffolding (`*** Begin/End Patch`, bare `@@`) is dropped. Returns null when
 * the text has no diff markers so the caller can show it verbatim.
 */
export function diffFromPatch(text: string): DiffView | null {
	const files: DiffFile[] = [];
	let current: DiffFile | undefined;
	let looksLikeDiff = false;

	const startFile = (op: DiffFileOp, path?: string): DiffFile => {
		current = { op, path, lines: [] };
		files.push(current);
		return current;
	};
	const ensureFile = (): DiffFile => current ?? startFile('update');

	for (const raw of text.split('\n')) {
		// apply_patch scaffolding — drop it.
		if (/^\*\*\* (?:Begin|End) Patch\s*$/.test(raw)) {
			looksLikeDiff = true;
			continue;
		}

		// File operation headers.
		let match = raw.match(/^\*\*\* Update File: (.+)$/);
		if (match) {
			looksLikeDiff = true;
			startFile('update', match[1].trim());
			continue;
		}
		match = raw.match(/^\*\*\* Add File: (.+)$/);
		if (match) {
			looksLikeDiff = true;
			startFile('add', match[1].trim());
			continue;
		}
		match = raw.match(/^\*\*\* Delete File: (.+)$/);
		if (match) {
			looksLikeDiff = true;
			startFile('delete', match[1].trim());
			continue;
		}
		match = raw.match(/^\*\*\* Move to: (.+)$/);
		if (match) {
			looksLikeDiff = true;
			const file = ensureFile();
			file.op = 'move';
			file.newPath = match[1].trim();
			continue;
		}

		// Unified diff headers.
		match = raw.match(/^diff --git a\/.+ b\/(.+)$/);
		if (match) {
			looksLikeDiff = true;
			startFile('update', match[1].trim());
			continue;
		}
		match = raw.match(/^\+\+\+ (?:b\/)?(.+)$/);
		if (match) {
			looksLikeDiff = true;
			const file = ensureFile();
			file.path ??= match[1].trim();
			continue;
		}
		if (/^(--- |index |new file|deleted file|rename )/.test(raw)) {
			looksLikeDiff = true;
			continue;
		}

		// Hunk header: keep any trailing context, drop the "@@ … @@" / "@@" marker.
		if (raw.startsWith('@@')) {
			looksLikeDiff = true;
			const context = raw
				.replace(/^@@.*?@@/, '') // unified: "@@ -1,2 +3,4 @@ ctx"
				.replace(/^@@/, '') // V4A: "@@ ctx" or bare "@@"
				.trim();
			if (context) ensureFile().lines.push({ type: 'meta', text: context });
			continue;
		}

		// Content lines.
		if (raw.startsWith('+')) {
			looksLikeDiff = true;
			ensureFile().lines.push({ type: 'add', text: raw.slice(1) });
			continue;
		}
		if (raw.startsWith('-')) {
			looksLikeDiff = true;
			ensureFile().lines.push({ type: 'del', text: raw.slice(1) });
			continue;
		}
		ensureFile().lines.push({ type: 'context', text: raw.startsWith(' ') ? raw.slice(1) : raw });
	}

	return looksLikeDiff ? { files } : null;
}

/**
 * Pull quoted string literals out of a snippet of source and unescape them.
 * OpenAI's apply_patch tool call arrives as runnable code where the patch is a
 * string literal (e.g. `const patch = "*** Begin Patch\n…"`), so its newlines
 * are backslash-escaped and need decoding before the patch can be parsed.
 */
function extractStringLiterals(code: string): string[] {
	const literals: string[] = [];

	const doubleQuoted = /"(?:\\.|[^"\\])*"/g;
	for (const match of code.matchAll(doubleQuoted)) {
		try {
			literals.push(JSON.parse(match[0]) as string);
		} catch {
			// Not a valid JSON string literal — skip it.
		}
	}

	const backtick = /`(?:\\.|[^`\\])*`/g;
	for (const match of code.matchAll(backtick)) {
		literals.push(
			match[0]
				.slice(1, -1)
				.replace(/\\`/g, '`')
				.replace(/\\n/g, '\n')
				.replace(/\\t/g, '\t')
				.replace(/\\\\/g, '\\')
		);
	}

	return literals;
}

/**
 * Resolve a diff from arbitrary patch "source": raw patch text, or a code
 * snippet that embeds the patch in a string literal (OpenAI's apply_patch).
 */
export function diffFromPatchSource(input: string): DiffView | null {
	const direct = diffFromPatch(input);
	if (direct) return direct;

	for (const literal of extractStringLiterals(input)) {
		const patch = diffFromPatch(literal);
		if (patch) return patch;
	}

	return null;
}
