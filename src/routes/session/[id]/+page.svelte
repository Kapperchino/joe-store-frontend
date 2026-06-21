<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import UserIcon from '@lucide/svelte/icons/user';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import { Button } from '$lib/components/ui/button';
	import Markdown from '$lib/components/markdown.svelte';
	import ToolActivity from './tool-activity.svelte';
	import OpenAIIcon from './openai-icon.svelte';
	import ClaudeIcon from './claude-icon.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type { PageProps } from './$types';
	import { SvelteSet } from 'svelte/reactivity';

	let { data }: PageProps = $props();

	let userOnly = $state(false);
	const expanded = new SvelteSet<string>();

	function toggleExpanded(id: string): void {
		if (expanded.has(id)) {
			expanded.delete(id);
		} else {
			expanded.add(id);
		}
	}

	const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	function formatDate(value: string | undefined): string {
		if (!value) return 'Unknown';
		const date = new Date(value);
		return Number.isNaN(date.valueOf()) ? value : dateTimeFormatter.format(date);
	}

	function roleLabel(role: (typeof data.session.messages)[number]['role']): string {
		if (role === 'assistant') return 'Assistant';
		if (role === 'tool') return 'Tool activity';
		return 'User';
	}

	const properties = $derived(
		[
			{ label: 'Provider', value: data.session.provider === 'openai' ? 'OpenAI' : 'Claude' },
			{ label: 'Model', value: data.session.model ?? 'Unknown' },
			{ label: 'Entries', value: data.session.entryCount.toLocaleString() },
			{ label: 'Messages', value: data.session.messages.length.toLocaleString() },
			{ label: 'Started', value: formatDate(data.session.startedAt) },
			{ label: 'Updated', value: formatDate(data.session.endedAt) },
			...(data.session.branch
				? [{ label: 'Branch', value: data.session.branch, mono: true }]
				: []),
			...(data.session.cwd
				? [{ label: 'Working directory', value: data.session.cwd, mono: true }]
				: []),
			...(data.session.sessionIdentifier
				? [{ label: 'Session', value: data.session.sessionIdentifier, mono: true }]
				: [])
		] as Array<{ label: string; value: string; mono?: boolean }>
	);
</script>

<svelte:head>
	<title>{data.session.title} | Joe Store</title>
	<meta name="description" content={`View session ${data.sessionId} in Joe Store.`} />
</svelte:head>

<main class="min-h-svh bg-background px-4 py-6 sm:px-6 lg:py-10">
	<div class="mx-auto flex w-full max-w-3xl flex-col">
		<div class="mb-6 flex items-center justify-between">
			<Button href={resolve('/')} variant="ghost" size="sm" class="-ml-2 text-muted-foreground">
				<ArrowLeftIcon data-icon="inline-start" />
				Back
			</Button>
			<ThemeToggle />
		</div>

		<header class="mb-8">
			<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{data.session.title}</h1>

			<dl class="mt-6 flex flex-col gap-px">
				{#each properties as property (property.label)}
					<div class="flex items-baseline gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
						<dt class="w-36 shrink-0 text-sm text-muted-foreground">{property.label}</dt>
						<dd
							class="min-w-0 flex-1 break-words text-sm {property.mono ? 'font-mono text-xs' : ''}"
						>
							{property.value}
						</dd>
					</div>
				{/each}
			</dl>
		</header>

		<hr class="mb-2 border-border" />

		<section aria-labelledby="conversation-heading">
			<h2 id="conversation-heading" class="sr-only">Conversation</h2>

			<div class="flex items-center justify-end gap-1 pt-4">
				<Button
					variant={userOnly ? 'ghost' : 'secondary'}
					size="sm"
					aria-pressed={!userOnly}
					onclick={() => (userOnly = false)}
				>
					All messages
				</Button>
				<Button
					variant={userOnly ? 'secondary' : 'ghost'}
					size="sm"
					aria-pressed={userOnly}
					onclick={() => (userOnly = true)}
				>
					User only
				</Button>
			</div>

			{#each data.session.messages as message (message.id)}
				{@const collapsed = userOnly && message.role !== 'user' && !expanded.has(message.id)}
				{#if collapsed}
					<button
						type="button"
						onclick={() => toggleExpanded(message.id)}
						class="flex w-full items-center gap-2.5 border-b border-border py-2.5 text-left text-muted-foreground transition-colors hover:text-foreground"
					>
						<span class="flex size-5 shrink-0 items-center justify-center">
							{#if message.role === 'assistant'}
								{#if data.session.provider === 'openai'}
									<OpenAIIcon class="size-3.5" />
								{:else}
									<ClaudeIcon class="size-3.5" />
								{/if}
							{:else}
								<WrenchIcon class="size-3.5" aria-hidden="true" />
							{/if}
						</span>
						<span class="min-w-0 flex-1 truncate text-sm">
							{message.text?.replace(/\s+/g, ' ').trim() ||
								(message.tools.length > 0
									? `${message.tools.length} tool ${message.tools.length === 1 ? 'action' : 'actions'}`
									: roleLabel(message.role))}
						</span>
						<ChevronDownIcon class="size-4 shrink-0" aria-hidden="true" />
					</button>
				{:else}
					<article class="border-b border-border py-8">
					<header class="mb-4 flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2.5">
							<span
								class="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
							>
								{#if message.role === 'user'}
									<UserIcon class="size-4" aria-hidden="true" />
								{:else if message.role === 'assistant'}
									{#if data.session.provider === 'openai'}
										<OpenAIIcon class="size-4" />
									{:else}
										<ClaudeIcon class="size-4" />
									{/if}
								{:else}
									<WrenchIcon class="size-4" aria-hidden="true" />
								{/if}
							</span>
							<h3 class="text-sm font-semibold tracking-tight">{roleLabel(message.role)}</h3>
						</div>
						<div class="flex items-center gap-3">
							{#if message.timestamp}
								<time class="text-xs text-muted-foreground" datetime={message.timestamp}>
									{formatDate(message.timestamp)}
								</time>
							{/if}
							{#if userOnly && message.role !== 'user'}
								<button
									type="button"
									onclick={() => toggleExpanded(message.id)}
									class="text-muted-foreground transition-colors hover:text-foreground"
									aria-label="Collapse message"
								>
									<ChevronUpIcon class="size-4" aria-hidden="true" />
								</button>
							{/if}
						</div>
					</header>

					<div class="flex flex-col gap-4 sm:pl-9.5">
						{#if message.html}
							<Markdown sanitizedHtml={message.html} />
						{/if}

						{#if message.tools.length > 0}
							<div class="flex flex-col gap-1.5">
								{#each message.tools as tool, index (`${message.id}-${index}`)}
									<ToolActivity {tool} />
								{/each}
							</div>
						{/if}
					</div>
				</article>
				{/if}
			{:else}
				<p class="py-8 text-sm text-muted-foreground">
					This session contains metadata, but no displayable messages or tool activity.
				</p>
			{/each}
		</section>
	</div>
</main>
