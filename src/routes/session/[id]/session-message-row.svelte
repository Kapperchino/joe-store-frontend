<script lang="ts">
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import UserIcon from '@lucide/svelte/icons/user';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import type { ProviderType } from '$lib/api';
	import type { Snippet } from 'svelte';
	import ClaudeIcon from './claude-icon.svelte';
	import OpenAIIcon from './openai-icon.svelte';
	import type { SessionRole } from './session-view';

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

	function roleLabel(value: SessionRole): string {
		if (value === 'assistant') return 'Assistant';
		if (value === 'tool') return 'Tool activity';
		return 'User';
	}
</script>

<article class="border-b border-border py-8">
	<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
		<div class="flex items-center gap-2.5">
			<span class="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
				{#if role === 'user'}
					<UserIcon class="size-4" aria-hidden="true" />
				{:else if role === 'assistant'}
					{#if provider === 'openai'}
						<OpenAIIcon class="size-4" />
					{:else if provider === 'cursor'}
						<MousePointer2Icon class="size-4" aria-hidden="true" />
					{:else}
						<ClaudeIcon class="size-4" />
					{/if}
				{:else}
					<WrenchIcon class="size-4" aria-hidden="true" />
				{/if}
			</span>
			<h3 class="text-sm font-semibold tracking-tight">{roleLabel(role)}</h3>
			{#if badge}{@render badge()}{/if}
		</div>
		{#if timestamp || action}
			<div class="flex items-center gap-3">
				{#if timestamp}
					<time class="text-xs text-muted-foreground" datetime={timestamp}>
						{formattedTimestamp ?? timestamp}
					</time>
				{/if}
				{#if action}{@render action()}{/if}
			</div>
		{/if}
	</header>

	<div class="flex flex-col gap-4 sm:pl-9.5">
		{@render children()}
	</div>
</article>
