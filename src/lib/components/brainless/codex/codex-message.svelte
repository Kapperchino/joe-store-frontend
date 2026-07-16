<script lang="ts">
	import type { Snippet } from 'svelte';

	let { role = 'assistant', children }: { role?: 'user' | 'assistant'; children: Snippet } =
		$props();
</script>

{#if role === 'user'}
	<div class="flex min-w-0 gap-2 rounded-none font-mono text-[13px] leading-[1.6] text-brainless-strong">
		<span aria-hidden="true" class="shrink-0 font-bold">›</span>
		<div class="min-w-0 flex-1 break-words">{@render children()}</div>
	</div>
{:else}
	<div class="font-mono text-[13px] leading-[1.6] text-brainless-strong/85">
		{@render children()}
	</div>
{/if}
