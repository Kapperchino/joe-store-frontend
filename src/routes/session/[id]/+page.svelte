<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import UserIcon from '@lucide/svelte/icons/user';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import { Button } from '$lib/components/ui/button';
	import Markdown from '$lib/components/markdown.svelte';
	import ToolActivity from './tool-activity.svelte';
	import OpenAIIcon from './openai-icon.svelte';
	import ClaudeIcon from './claude-icon.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type { PageProps } from './$types';
	import CommandChip from './command-chip.svelte';
	import NotificationChip from './notification-chip.svelte';
	import type {
		CommandView,
		MessagePart,
		NotificationView,
		ToolActivity as ToolActivityData
	} from './session-view';
	import { SvelteSet } from 'svelte/reactivity';

	let { data }: PageProps = $props();

	// Render parts in order, but keep runs of consecutive tools together so they
	// stay tightly spaced while interleaved text breaks them into separate groups.
	type RenderGroup =
		| { kind: 'text'; html: string }
		| { kind: 'tools'; tools: ToolActivityData[] }
		| { kind: 'command'; command: CommandView }
		| { kind: 'notice'; text: string }
		| { kind: 'notification'; notification: NotificationView };

	function groupParts(parts: MessagePart[]): RenderGroup[] {
		const groups: RenderGroup[] = [];
		for (const part of parts) {
			if (part.kind === 'text') {
				groups.push({ kind: 'text', html: part.html });
			} else if (part.kind === 'command') {
				groups.push({ kind: 'command', command: part.command });
			} else if (part.kind === 'notice') {
				groups.push({ kind: 'notice', text: part.text });
			} else if (part.kind === 'notification') {
				groups.push({ kind: 'notification', notification: part.notification });
			} else {
				const last = groups.at(-1);
				if (last?.kind === 'tools') last.tools.push(part.tool);
				else groups.push({ kind: 'tools', tools: [part.tool] });
			}
		}
		return groups;
	}

	// Summary view keeps only the agent's final prose from a merged turn — the
	// closing message (e.g. "What I built/changed …") — dropping the tool calls and
	// intermediate chatter that precede it in the block.
	function finalTextGroups(parts: MessagePart[]): RenderGroup[] {
		const groups = groupParts(parts);
		const lastText = groups.findLast((group) => group.kind === 'text');
		return lastText ? [lastText] : groups;
	}

	type View = 'all' | 'user' | 'summary';
	let view = $state<View>('all');
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
					variant={view === 'all' ? 'secondary' : 'ghost'}
					size="sm"
					aria-pressed={view === 'all'}
					onclick={() => (view = 'all')}
				>
					All
				</Button>
				<Button
					variant={view === 'summary' ? 'secondary' : 'ghost'}
					size="sm"
					aria-pressed={view === 'summary'}
					onclick={() => (view = 'summary')}
				>
					Short
				</Button>
				<Button
					variant={view === 'user' ? 'secondary' : 'ghost'}
					size="sm"
					aria-pressed={view === 'user'}
					onclick={() => (view = 'user')}
				>
					User only
				</Button>
			</div>

			{#each data.session.messages as message (message.id)}
				{@const isAgent = message.role !== 'user'}
				{@const hasText = message.parts.some((part) => part.kind === 'text')}
				{@const collapsible =
					(view === 'user' && isAgent) || (view === 'summary' && isAgent && !hasText)}
				{@const collapsed = collapsible && !expanded.has(message.id)}
				{@const summaryAgent = view === 'summary' && isAgent && hasText}
				{@const summaryFinal = summaryAgent && !expanded.has(message.id)}
				{@const statusOnly =
					message.parts.length > 0 &&
					message.parts.every((part) => part.kind === 'notice' || part.kind === 'notification')}
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
							{:else if message.role === 'user'}
								<UserIcon class="size-3.5" aria-hidden="true" />
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
				{:else if statusOnly}
					<div class="flex flex-col gap-1.5 border-b border-border py-2.5">
						{#each groupParts(message.parts) as group, groupIndex (`${message.id}-${groupIndex}`)}
							<div class="flex items-center gap-2">
								{#if group.kind === 'notice'}
									<span class="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-muted-foreground">
										<OctagonXIcon class="size-3.5 shrink-0" aria-hidden="true" />
										<span class="truncate">{group.text}</span>
									</span>
								{:else if group.kind === 'notification'}
									<span class="min-w-0 flex-1">
										<NotificationChip notification={group.notification} />
									</span>
								{/if}
								{#if groupIndex === 0 && message.timestamp}
									<time class="shrink-0 text-xs text-muted-foreground" datetime={message.timestamp}>
										{formatDate(message.timestamp)}
									</time>
								{/if}
							</div>
						{/each}
					</div>
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
							{#if collapsible}
								<button
									type="button"
									onclick={() => toggleExpanded(message.id)}
									class="text-muted-foreground transition-colors hover:text-foreground"
									aria-label="Collapse message"
								>
									<ChevronUpIcon class="size-4" aria-hidden="true" />
								</button>
							{:else if summaryAgent}
								<button
									type="button"
									onclick={() => toggleExpanded(message.id)}
									class="text-muted-foreground transition-colors hover:text-foreground"
									aria-label={summaryFinal ? 'Show full turn' : 'Show final message only'}
								>
									{#if summaryFinal}
										<ChevronDownIcon class="size-4" aria-hidden="true" />
									{:else}
										<ChevronUpIcon class="size-4" aria-hidden="true" />
									{/if}
								</button>
							{/if}
						</div>
					</header>

					<div class="flex flex-col gap-4 sm:pl-9.5">
						{#each summaryFinal ? finalTextGroups(message.parts) : groupParts(message.parts) as group, groupIndex (`${message.id}-${groupIndex}`)}
							{#if group.kind === 'text'}
								<Markdown sanitizedHtml={group.html} />
							{:else if group.kind === 'command'}
								<CommandChip command={group.command} />
							{:else if group.kind === 'notice'}
								<div
									class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
								>
									<OctagonXIcon class="size-3.5 shrink-0" aria-hidden="true" />
									<span>{group.text}</span>
								</div>
							{:else if group.kind === 'notification'}
								<NotificationChip notification={group.notification} />
							{:else}
								<div class="flex flex-col gap-1.5">
									{#each group.tools as tool, index (`${message.id}-${groupIndex}-${index}`)}
										<ToolActivity {tool} />
									{/each}
								</div>
							{/if}
						{/each}
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
