<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type { ToolActivity } from './session-view';

	let { tool }: { tool: ToolActivity } = $props();
</script>

{#snippet block(heading: string, content: string)}
	{@const lines = content.split('\n')}
	{@const collapsible = lines.length > 6}
	<div class="flex flex-col gap-2">
		<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">{heading}</p>
		{#if collapsible}
			<details class="group">
				<pre
					class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 group-open:hidden"><code
						>{lines.slice(0, 6).join('\n')}</code
					></pre>
				<pre
					class="hidden overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5 group-open:block"><code
						>{content}</code
					></pre>
				<summary
					class="mt-1 inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
				>
					<ChevronDownIcon
						class="size-3.5 transition-transform group-open:rotate-180"
						aria-hidden="true"
					/>
					<span class="group-open:hidden">Show {lines.length - 6} more lines</span>
					<span class="hidden group-open:inline">Show less</span>
				</summary>
			</details>
		{:else}
			<pre
				class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{content}</code></pre>
		{/if}
	</div>
{/snippet}

<div class="flex flex-col gap-4 rounded-lg border border-border bg-muted/40 px-4 py-3">
	<p class="font-mono text-xs font-medium">{tool.label}</p>
	{#if tool.input}
		{@render block('Input', tool.input)}
	{/if}
	{#if tool.output}
		{@render block('Output', tool.output)}
	{/if}
</div>
