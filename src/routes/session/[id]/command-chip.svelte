<script lang="ts">
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import type { CommandView } from './session-view';

	let { command, expanded = false }: { command: CommandView; expanded?: boolean } = $props();

	// Show the leading slash even when the recorded name omits it, so it reads as
	// the command the user actually typed.
	const name = $derived(command.name.startsWith('/') ? command.name : `/${command.name}`);
</script>

<div
	class="flex w-fit max-w-full flex-col gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
>
	<div class="flex items-center gap-2 font-mono text-xs">
		<TerminalIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
		<span class="font-medium text-foreground">{name}</span>
		{#if command.args}
			<span class="truncate text-muted-foreground">{command.args}</span>
		{/if}
	</div>

	{#if command.stdout}
		<details class="group/stdout flex flex-col gap-1.5" open={expanded}>
			<summary
				class="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
			>
				<ChevronRightIcon
					class="size-3 transition-transform group-open/stdout:rotate-90"
					aria-hidden="true"
				/>
				Output
			</summary>
			<pre
				class="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code
					>{command.stdout}</code
				></pre>
		</details>
	{/if}
</div>
