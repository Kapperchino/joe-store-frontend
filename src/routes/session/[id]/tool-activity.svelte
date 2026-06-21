<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { ToolActivity } from './session-view';

	let { tool }: { tool: ToolActivity } = $props();

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

<details class="group">
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
		{#if tool.input}
			<div class="flex flex-col gap-1.5">
				<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input</p>
				<pre
					class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.input}</code></pre>
			</div>
		{/if}
		{#if tool.output}
			<div class="flex flex-col gap-1.5">
				<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output</p>
				<pre
					class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.output}</code></pre>
			</div>
		{/if}
	</div>
</details>
