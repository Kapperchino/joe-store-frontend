<script lang="ts">
	import type { Snippet } from 'svelte';

	let { role = 'assistant', children }: { role?: 'user' | 'assistant'; children: Snippet } =
		$props();
</script>

{#if role === 'user'}
	<div class="flex w-full min-w-0 items-baseline bg-brainless-user font-mono text-[13px] leading-[1.55]">
		<span aria-hidden="true" class="shrink-0 text-brainless-dim">❯</span>
		<span aria-hidden="true" class="inline-block w-[1ch] shrink-0"></span>
		<div class="min-w-0 flex-1 break-words text-brainless-strong">{@render children()}</div>
	</div>
{:else}
	<div class="font-mono text-[13px] leading-[1.6] text-brainless-foreground">
		{@render children()}
	</div>
{/if}
