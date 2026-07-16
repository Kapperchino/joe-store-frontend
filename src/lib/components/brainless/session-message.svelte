<script lang="ts">
	import type { ProviderType } from '$lib/api';
	import type { Snippet } from 'svelte';
	import ClaudeMessage from './claude/claude-message.svelte';
	import CodexMessage from './codex/codex-message.svelte';

	type SessionRole = 'user' | 'assistant' | 'tool';

	let {
		role,
		provider,
		timestamp,
		formattedTimestamp,
		badge,
		action,
		children
	}: {
		role: SessionRole;
		provider: ProviderType;
		timestamp?: string;
		formattedTimestamp?: string;
		badge?: Snippet;
		action?: Snippet;
		children: Snippet;
	} = $props();

	const terminalRole = $derived(role === 'user' ? 'user' : 'assistant');
</script>

<article data-message-role={role} class="group/message min-w-0 rounded-none">
	{#if badge || action}
		<div class="mb-1 flex min-w-0 items-center justify-between gap-2">
			<div>{#if badge}{@render badge()}{/if}</div>
			{#if action}{@render action()}{/if}
		</div>
	{/if}
	{#if timestamp}
		<time class="sr-only" datetime={timestamp}>{formattedTimestamp ?? timestamp}</time>
	{/if}

	{#if provider === 'claude'}
		<ClaudeMessage role={terminalRole}>{@render children()}</ClaudeMessage>
	{:else}
		<CodexMessage role={terminalRole}>{@render children()}</CodexMessage>
	{/if}
</article>
