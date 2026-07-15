<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		command,
		result,
		status = 'ok',
		defaultOpen = false,
		children
	}: {
		command: string;
		result?: string;
		status?: 'ok' | 'error' | 'run';
		defaultOpen?: boolean;
		children?: Snippet;
	} = $props();

	const statusClass = $derived(
		status === 'error'
			? 'text-brainless-error'
			: status === 'run'
				? 'text-brainless-warning'
				: 'text-brainless-success'
	);
</script>

<details
	open={defaultOpen}
	class="group font-mono text-[13px] leading-[1.55] [&_summary::-webkit-details-marker]:hidden"
>
	<summary
		class={cn(
			'flex min-w-0 list-none items-baseline gap-2 outline-none focus-visible:ring-1 focus-visible:ring-brainless-codex/60',
			children ? 'cursor-pointer' : 'cursor-default'
		)}
	>
		<span aria-hidden="true" class={cn('shrink-0', statusClass)}>•</span>
		<span class="min-w-0 break-words text-brainless-codex">{command}</span>
		{#if result}<span class="shrink-0 text-brainless-muted">{result}</span>{/if}
		{#if children}<span class="shrink-0 text-brainless-dim group-open:hidden">▸</span>{/if}
	</summary>
	{#if children}
		<div class="mt-1 pl-4 text-brainless-muted">{@render children()}</div>
	{/if}
</details>
