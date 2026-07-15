<script lang="ts">
	import type { ProviderType } from '$lib/api';
	import type { CommandView } from './session-view';

	let {
		command,
		provider,
		expanded = false
	}: { command: CommandView; provider: ProviderType; expanded?: boolean } = $props();

	const name = $derived(command.name.startsWith('/') ? command.name : `/${command.name}`);
</script>

<details
	class="group/command font-mono text-[13px] leading-[1.55] [&_summary::-webkit-details-marker]:hidden"
	open={expanded}
>
	<summary class="flex min-w-0 cursor-pointer list-none items-baseline gap-2 outline-none">
		<span class="shrink-0 text-brainless-warning" aria-hidden="true">
			{provider === 'claude' ? '❯' : '›'}
		</span>
		<span class="font-medium text-brainless-accent">{name}</span>
		{#if command.args}<span class="truncate text-brainless-muted">{command.args}</span>{/if}
		{#if command.stdout}
			<span class="shrink-0 text-brainless-dim group-open/command:hidden">▸</span>
		{/if}
	</summary>
	{#if command.stdout}
		<pre class="mt-1 overflow-x-auto whitespace-pre-wrap pl-4 text-brainless-muted"><code>{command.stdout}</code></pre>
	{/if}
</details>
