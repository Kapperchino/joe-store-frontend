<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import BotIcon from '@lucide/svelte/icons/bot';
	import CodeXmlIcon from '@lucide/svelte/icons/code-xml';
	import UserIcon from '@lucide/svelte/icons/user';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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
		if (role === 'developer') return 'Developer';
		if (role === 'tool') return 'Tool activity';
		return 'User';
	}
</script>

<svelte:head>
	<title>{data.session.title} | Joe Store</title>
	<meta name="description" content={`View session ${data.sessionId} in Joe Store.`} />
</svelte:head>

<main class="min-h-svh bg-muted/40 px-4 py-8 sm:px-6 lg:py-12">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
		<div>
			<Button href={resolve('/')} variant="ghost" size="sm">
				<ArrowLeftIcon data-icon="inline-start" />
				Back
			</Button>
		</div>

		<Card.Root>
			<Card.Header>
				<Card.Title class="text-2xl sm:text-3xl">{data.session.title}</Card.Title>
				<Card.Description>
					{data.session.provider === 'openai' ? 'OpenAI' : 'Claude'} session #{data.sessionId}
				</Card.Description>
			</Card.Header>
			<Card.Content>
				<dl class="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
					<div class="flex min-w-0 flex-col gap-1">
						<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Model</dt>
						<dd>{data.session.model ?? 'Unknown'}</dd>
					</div>
					<div class="flex min-w-0 flex-col gap-1">
						<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entries</dt>
						<dd>{data.session.entryCount.toLocaleString()}</dd>
					</div>
					<div class="flex min-w-0 flex-col gap-1">
						<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Messages</dt>
						<dd>{data.session.messages.length.toLocaleString()}</dd>
					</div>
					<div class="flex min-w-0 flex-col gap-1">
						<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Started</dt>
						<dd>{formatDate(data.session.startedAt)}</dd>
					</div>
					<div class="flex min-w-0 flex-col gap-1">
						<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</dt>
						<dd>{formatDate(data.session.endedAt)}</dd>
					</div>
					{#if data.session.branch}
						<div class="flex min-w-0 flex-col gap-1">
							<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</dt>
							<dd class="truncate font-mono text-xs" title={data.session.branch}>{data.session.branch}</dd>
						</div>
					{/if}
					{#if data.session.cwd}
						<div class="flex min-w-0 flex-col gap-1 sm:col-span-2 lg:col-span-3">
							<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Working directory</dt>
							<dd class="truncate font-mono text-xs" title={data.session.cwd}>{data.session.cwd}</dd>
						</div>
					{/if}
				</dl>
			</Card.Content>
			{#if data.session.sessionIdentifier}
				<Card.Footer>
					<p class="break-all font-mono text-xs text-muted-foreground">
						Session {data.session.sessionIdentifier}
					</p>
				</Card.Footer>
			{/if}
		</Card.Root>

		<section class="flex flex-col gap-4" aria-labelledby="conversation-heading">
			<div class="flex items-end justify-between gap-4 px-1">
				<div class="flex flex-col gap-1">
					<h2 id="conversation-heading" class="text-xl font-semibold tracking-tight">Conversation</h2>
					<p class="text-sm text-muted-foreground">Messages and tool activity in chronological order.</p>
				</div>
			</div>

			{#each data.session.messages as message (message.id)}
				<Card.Root size="sm">
					<Card.Header>
						<div class="flex items-center gap-2">
							{#if message.role === 'user'}
								<UserIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							{:else if message.role === 'assistant'}
								<BotIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							{:else if message.role === 'developer'}
								<CodeXmlIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							{:else}
								<WrenchIcon class="size-4 text-muted-foreground" aria-hidden="true" />
							{/if}
							<Card.Title>{roleLabel(message.role)}</Card.Title>
						</div>
						{#if message.timestamp}
							<Card.Description>
								<time datetime={message.timestamp}>{formatDate(message.timestamp)}</time>
							</Card.Description>
						{/if}
					</Card.Header>
					<Card.Content class="flex flex-col gap-4">
						{#if message.text}
							<p class="whitespace-pre-wrap break-words leading-6">{message.text}</p>
						{/if}

						{#each message.tools as tool, index (`${message.id}-${index}`)}
							<details class="rounded-xl bg-muted px-4 py-3">
								<summary class="cursor-pointer font-mono text-xs font-medium">{tool.label}</summary>
								{#if tool.input}
									<div class="mt-4 flex flex-col gap-2">
										<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Input</p>
										<pre class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.input}</code></pre>
									</div>
								{/if}
								{#if tool.output}
									<div class="mt-4 flex flex-col gap-2">
										<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Output</p>
										<pre class="overflow-x-auto whitespace-pre-wrap break-words text-xs leading-5"><code>{tool.output}</code></pre>
									</div>
								{/if}
							</details>
						{/each}
					</Card.Content>
				</Card.Root>
			{:else}
				<Card.Root>
					<Card.Header>
						<Card.Title>No conversation messages</Card.Title>
						<Card.Description>
							This session contains metadata, but no displayable messages or tool activity.
						</Card.Description>
					</Card.Header>
				</Card.Root>
			{/each}
		</section>
	</div>
</main>
