<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';

	let {
		tool,
		arg,
		result,
		status = 'success',
		defaultOpen = false,
		children
	}: {
		tool: string;
		arg?: string;
		result: string;
		status?: 'success' | 'error' | 'pending';
		defaultOpen?: boolean;
		children?: Snippet;
	} = $props();

	const statusClass = $derived(
		status === 'error'
			? 'text-brainless-error'
			: status === 'pending'
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
			'list-none rounded-none outline-none focus-visible:ring-1 focus-visible:ring-brainless-accent/60',
			children ? 'cursor-pointer' : 'cursor-default'
		)}
	>
		<span class="flex min-w-0 items-baseline gap-2">
			<span aria-hidden="true" class={cn('shrink-0', statusClass)}>⏺</span>
			<span class="min-w-0 break-words">
				<span class="text-brainless-foreground">{tool}</span>
				{#if arg !== undefined}
					<span class="text-brainless-dim">(</span><span class="text-brainless-accent">{arg}</span><span class="text-brainless-dim">)</span>
				{/if}
			</span>
		</span>
		<span class="flex min-w-0 items-baseline gap-2 text-brainless-foreground/70">
			<span aria-hidden="true" class="invisible shrink-0">⏺</span>
			<span class="flex min-w-0 items-baseline gap-2">
				<span aria-hidden="true" class="shrink-0 text-brainless-dim">⎿</span>
				<span class="min-w-0 break-words">
					{result}
					{#if children}
						<span class="ml-2 text-brainless-dim group-open:hidden">(ctrl+o to expand)</span>
					{/if}
				</span>
			</span>
		</span>
	</summary>

	{#if children}
		<div class="mt-1 pl-8 text-brainless-foreground/70">{@render children()}</div>
	{/if}
</details>
