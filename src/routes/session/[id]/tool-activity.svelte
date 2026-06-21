<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ToolActivity } from './session-view';
	import { diffFromEdit, diffFromPatchSource, type DiffView } from './diff';

	let { tool }: { tool: ToolActivity } = $props();

	// Render edits and patches as a colored diff rather than raw JSON/text.
	function computeDiff(input: string | undefined): DiffView | null {
		if (!input) return null;
		try {
			const parsed = JSON.parse(input);
			if (parsed && typeof parsed === 'object') {
				// Claude Edit: explicit before/after strings.
				if (typeof parsed.old_string === 'string' && typeof parsed.new_string === 'string') {
					return diffFromEdit(
						parsed.old_string,
						parsed.new_string,
						typeof parsed.file_path === 'string' ? parsed.file_path : undefined
					);
				}
				// OpenAI apply_patch: the patch text is nested in a string field of the
				// tool arguments (e.g. { input: "*** Begin Patch …" }), so its newlines
				// are escaped in the outer JSON. Pull it out and parse the real text.
				for (const value of Object.values(parsed as Record<string, unknown>)) {
					if (typeof value === 'string') {
						const patch = diffFromPatchSource(value);
						if (patch) return patch;
					}
				}
			}
		} catch {
			// Not JSON — fall through and try to read it as patch text or code.
		}
		return diffFromPatchSource(input);
	}

	// Don't present a diff for an edit/patch that failed — it was never applied.
	const diff = $derived(tool.isError ? null : computeDiff(tool.input));

	// Show a one-line gist of the input so the tool is identifiable without
	// expanding it (e.g. the actual command for a shell call). Inputs are usually
	// JSON, so surface the salient field values rather than the literal `{`.
	function firstLine(value: string): string {
		return value
			.split('\n')
			.map((line) => line.trim())
			.find((line) => line.length > 0) ?? '';
	}

	function summarize(input: string): string {
		let parsed: unknown;
		try {
			parsed = JSON.parse(input);
		} catch {
			return firstLine(input);
		}

		if (typeof parsed !== 'object' || parsed === null) return firstLine(input);

		const entries = Object.entries(parsed as Record<string, unknown>).filter(
			([key, value]) => key !== 'description' && value !== undefined && value !== null && value !== ''
		);
		if (entries.length === 0) return firstLine(input);

		const stringify = (value: unknown) =>
			typeof value === 'string' ? value : JSON.stringify(value);

		// Prefer the field that most identifies the call when one is present.
		const primary = entries.find(([key]) =>
			['command', 'file_path', 'path', 'pattern', 'query', 'url', 'prompt'].includes(key)
		);
		if (primary) return firstLine(stringify(primary[1]));

		return entries.map(([key, value]) => `${key}: ${firstLine(stringify(value))}`).join(', ');
	}

	const preview = $derived(tool.input ? summarize(tool.input) : undefined);
</script>

<details class="group" open={diff !== null}>
	<summary
		class="flex cursor-pointer list-none items-center gap-1.5 font-mono text-xs text-foreground"
	>
		<ChevronRightIcon
			class="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
			aria-hidden="true"
		/>
		<span class="shrink-0 font-medium">{tool.label}</span>
		{#if tool.isError}
			<span class="shrink-0 rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive"
				>Error</span
			>
		{/if}
		{#if preview}
			<span class="truncate text-muted-foreground group-open:hidden">{preview}</span>
		{/if}
	</summary>

	<div class="mt-2 ml-1.5 flex flex-col gap-3 border-l border-border pl-3">
		{#if diff}
			{#each diff.files as file, fileIndex (fileIndex)}
				<div class="flex flex-col gap-1.5">
					<p class="flex flex-wrap items-center gap-1.5 font-mono text-xs">
						{#if file.op === 'add'}
							<span class="font-medium text-green-700 dark:text-green-400">added</span>
						{:else if file.op === 'delete'}
							<span class="font-medium text-red-700 dark:text-red-400">deleted</span>
						{:else if file.op === 'move'}
							<span class="font-medium text-muted-foreground">moved</span>
						{/if}
						<span class="break-all text-foreground">{file.path ?? 'Diff'}</span>
						{#if file.newPath}
							<span class="text-muted-foreground">→</span>
							<span class="break-all text-foreground">{file.newPath}</span>
						{/if}
					</p>
					{#if file.lines.length > 0}
						<pre
							class="overflow-x-auto rounded-md border border-border text-xs leading-5"><code
								>{#each file.lines as line, index (index)}<span
										class="block px-2 {line.type === 'add'
											? 'bg-green-500/10 text-green-700 dark:text-green-400'
											: line.type === 'del'
												? 'bg-red-500/10 text-red-700 dark:text-red-400'
												: line.type === 'meta'
													? 'text-muted-foreground'
													: 'text-foreground'}"
										>{line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}{line.text}</span
									>{/each}</code
							></pre>
					{/if}
				</div>
			{/each}
		{:else if tool.input}
			<div class="flex flex-col gap-1.5">
				<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input</p>
				<pre
					class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.input}</code></pre>
			</div>
		{/if}
		{#if tool.output}
			<details class="group/output flex flex-col gap-1.5">
				<summary
					class="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
				>
					<ChevronRightIcon
						class="size-3 transition-transform group-open/output:rotate-90"
						aria-hidden="true"
					/>
					Output
				</summary>
				<pre
					class="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.output}</code></pre>
			</details>
		{/if}
	</div>
</details>
