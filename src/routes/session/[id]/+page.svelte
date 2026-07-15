<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CheckIcon from '@lucide/svelte/icons/check';
	import LinkIcon from '@lucide/svelte/icons/link';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import UsersIcon from '@lucide/svelte/icons/users';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LockIcon from '@lucide/svelte/icons/lock';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Field from '$lib/components/ui/field';
	import * as Popover from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import { Spinner } from '$lib/components/ui/spinner';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as ToggleGroup from '$lib/components/ui/toggle-group';
	import SessionHeader from '$lib/components/brainless/session-header.svelte';
	import Markdown from '$lib/components/markdown.svelte';
	import ToolActivity from './tool-activity.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type { PageProps } from './$types';
	import type { AuthType, ErrorResponse, GrantSessionAuthRes } from '$lib/api';
	import { withStoredAccessToken } from '$lib/auth';
	import { cn } from '$lib/utils';
	import CommandChip from './command-chip.svelte';
	import NotificationChip from './notification-chip.svelte';
	import SessionMessage from '$lib/components/brainless/session-message.svelte';
	import type {
		CommandView,
		MessagePart,
		NotificationView,
		ToolActivity as ToolActivityData
	} from './session-view';
	import { SvelteSet } from 'svelte/reactivity';
	import { tick, type Snippet } from 'svelte';

	let { data }: PageProps = $props();

	type AuthorizationAction = 'public' | 'private' | 'users';
	type BadgeVariant = 'default' | 'secondary' | 'outline';

	type SessionAuthOverride = { sessionId: string; authType: AuthType };
	type SessionShareDraft = { sessionId: string; value: string };
	type SessionAuthFeedback = { sessionId: string; error: string | null; notice: string | null };
	type SessionPendingAuth = { sessionId: string; action: AuthorizationAction };

	let authOverride = $state<SessionAuthOverride | null>(null);
	let shareUsersDraft = $state<SessionShareDraft | null>(null);
	let authFeedback = $state<SessionAuthFeedback | null>(null);
	let pendingAuthorization = $state<SessionPendingAuth | null>(null);

	function messageSearchText(message: (typeof data.session.messages)[number]): string {
		return message.parts
			.flatMap((part) => {
				if (part.kind === 'text') return [part.text];
				if (part.kind === 'command') {
					return [part.command.name, part.command.args, part.command.stdout];
				}
				if (part.kind === 'notice') return [part.text];
				if (part.kind === 'notification') {
					return [part.notification.summary, part.notification.status];
				}
				return [part.tool.label, part.tool.input, part.tool.output];
			})
			.filter((value): value is string => typeof value === 'string')
			.join('\n');
	}

	function fallbackMatchScore(messageText: string, passage: string): number {
		const haystack = messageText.toLocaleLowerCase();
		const terms = [
			...new Set(passage.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? [])
		].slice(0, 100);
		return terms.reduce((score, term) => score + (haystack.includes(term) ? term.length : 0), 0);
	}

	const searchQuery = $derived(page.url.searchParams.get('search')?.trim() ?? '');
	const searchEntryIndex = $derived.by(() => {
		const value = page.url.searchParams.get('entry');
		if (value === null || !/^\d+$/.test(value)) return null;
		const index = Number(value);
		return Number.isSafeInteger(index) ? index : null;
	});
	const searchMatchMessage = $derived.by(() => {
		if (searchEntryIndex !== null) {
			const exact = data.session.messages.find((message) =>
				message.sourceIndexes.includes(searchEntryIndex)
			);
			if (exact) return exact;
		}

		const passage = page.url.searchParams.get('match')?.trim();
		if (!passage) return null;
		const best = data.session.messages
			.map((message) => ({ message, score: fallbackMatchScore(messageSearchText(message), passage) }))
			.sort((a, b) => b.score - a.score)[0];
		return best && best.score > 0 ? best.message : null;
	});

	function isSearchMatch(message: (typeof data.session.messages)[number]): boolean {
		return searchMatchMessage?.id === message.id;
	}

	// Render parts in order, but keep runs of consecutive tools together so they
	// stay tightly spaced while interleaved text breaks them into separate groups.
	type RenderTool = {
		partIndex: number;
		sourceIndexes: number[];
		tool: ToolActivityData;
	};
	type RenderGroup =
		| { kind: 'text'; partIndex: number; sourceIndexes: number[]; html: string }
		| { kind: 'tools'; tools: RenderTool[] }
		| { kind: 'command'; partIndex: number; sourceIndexes: number[]; command: CommandView }
		| { kind: 'notice'; partIndex: number; sourceIndexes: number[]; text: string }
		| {
				kind: 'notification';
				partIndex: number;
				sourceIndexes: number[];
				notification: NotificationView;
		  };

	function groupParts(parts: MessagePart[]): RenderGroup[] {
		const groups: RenderGroup[] = [];
		for (const [partIndex, part] of parts.entries()) {
			if (part.kind === 'text') {
				groups.push({ kind: 'text', partIndex, sourceIndexes: part.sourceIndexes, html: part.html });
			} else if (part.kind === 'command') {
				groups.push({
					kind: 'command',
					partIndex,
					sourceIndexes: part.sourceIndexes,
					command: part.command
				});
			} else if (part.kind === 'notice') {
				groups.push({ kind: 'notice', partIndex, sourceIndexes: part.sourceIndexes, text: part.text });
			} else if (part.kind === 'notification') {
				groups.push({
					kind: 'notification',
					partIndex,
					sourceIndexes: part.sourceIndexes,
					notification: part.notification
				});
			} else {
				const last = groups.at(-1);
				const tool = { partIndex, sourceIndexes: part.sourceIndexes, tool: part.tool };
				if (last?.kind === 'tools') last.tools.push(tool);
				else groups.push({ kind: 'tools', tools: [tool] });
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
	let copiedBlockId = $state<string | null>(null);
	let copyFeedbackTimer: ReturnType<typeof setTimeout> | undefined;

	type LinkableBlock = {
		id: string;
		messageIndex: number;
		partIndex: number;
		sourceIndexes: number[];
	};

	const linkableBlocks = $derived.by(() =>
		data.session.messages.flatMap((message, messageIndex) =>
			message.parts.map((part, partIndex) => ({
				id: `session-content-${messageIndex}-${partIndex}`,
				messageIndex,
				partIndex,
				sourceIndexes: part.sourceIndexes
			}))
		)
	);
	const sharedEntryIndex = $derived.by(() => {
		const value = page.url.searchParams.get('index');
		if (value === null || !/^\d+$/.test(value)) return null;
		const index = Number(value);
		return Number.isSafeInteger(index) ? index : null;
	});
	const sharedEntryPart = $derived.by(() => {
		const value = page.url.searchParams.get('part');
		if (value === null) return 1;
		if (!/^[1-9]\d*$/.test(value)) return null;
		const part = Number(value);
		return Number.isSafeInteger(part) ? part : null;
	});
	const sharedBlock = $derived.by(() => {
		if (sharedEntryIndex === null || sharedEntryPart === null) return null;
		return (
			linkableBlocks.filter((block) => block.sourceIndexes.includes(sharedEntryIndex))[
				sharedEntryPart - 1
			] ?? null
		);
	});

	function blockAt(messageIndex: number, partIndex: number): LinkableBlock {
		return linkableBlocks.find(
			(block) => block.messageIndex === messageIndex && block.partIndex === partIndex
		)!;
	}

	function isSharedBlock(block: LinkableBlock): boolean {
		return sharedBlock?.id === block.id;
	}

	function messageAnchorId(messageIndex: number): string {
		return `session-message-${messageIndex + 1}`;
	}

	const focusedTargetId = $derived.by(() => {
		if (sharedBlock) return sharedBlock.id;
		if (!searchMatchMessage) return null;
		const index = data.session.messages.findIndex((message) => message.id === searchMatchMessage.id);
		return index >= 0 ? messageAnchorId(index) : null;
	});

	$effect(() => {
		if (focusedTargetId === null) return;
		view = 'all';
		void tick().then(() => {
			requestAnimationFrame(() => {
				document.getElementById(focusedTargetId)?.scrollIntoView({ block: 'center' });
			});
		});
	});

	async function copyBlockLink(block: LinkableBlock): Promise<void> {
		const sourceIndex = block.sourceIndexes[0];
		const matchingBlocks = linkableBlocks.filter((candidate) =>
			candidate.sourceIndexes.includes(sourceIndex)
		);
		const part = matchingBlocks.findIndex((candidate) => candidate.id === block.id) + 1;
		const partQuery = matchingBlocks.length > 1 ? `&part=${part}` : '';
		const url = `${page.url.origin}${page.url.pathname}?index=${sourceIndex}${partQuery}`;

		try {
			await navigator.clipboard.writeText(url);
			copiedBlockId = block.id;
			if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
			copyFeedbackTimer = setTimeout(() => {
				if (copiedBlockId === block.id) copiedBlockId = null;
			}, 2000);
		} catch {
			copiedBlockId = null;
		}
	}

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
			{ label: 'Entries', value: data.session.entryCount.toLocaleString() },
			{ label: 'Messages', value: data.session.messages.length.toLocaleString() },
			{ label: 'Started', value: formatDate(data.session.startedAt) },
			{ label: 'Updated', value: formatDate(data.session.endedAt) },
			...(data.session.sessionIdentifier
				? [{ label: 'Session', value: data.session.sessionIdentifier, mono: true }]
				: [])
		] as Array<{ label: string; value: string; mono?: boolean }>
	);

	const authType = $derived(
		authOverride?.sessionId === data.sessionId ? authOverride.authType : data.authType
	);
	const shareUsersInput = $derived(
		shareUsersDraft?.sessionId === data.sessionId
			? shareUsersDraft.value
			: usersFromAuthType(authType).join('\n')
	);
	const authError = $derived(authFeedback?.sessionId === data.sessionId ? authFeedback.error : null);
	const authNotice = $derived(
		authFeedback?.sessionId === data.sessionId ? authFeedback.notice : null
	);
	const pendingAuthAction = $derived(
		pendingAuthorization?.sessionId === data.sessionId ? pendingAuthorization.action : null
	);
	const sharedUsers = $derived(usersFromAuthType(authType));
	const authorizationPending = $derived(pendingAuthAction !== null);

	function usersFromAuthType(value: AuthType): string[] {
		return typeof value === 'object' && value !== null && 'users' in value ? value.users : [];
	}

	function authTypeLabel(value: AuthType): string {
		if (value === 'public') return 'Public';
		if (value === 'private') return 'Private';
		const userCount = usersFromAuthType(value).length;
		return userCount === 1 ? 'Shared with 1 user' : `Shared with ${userCount} users`;
	}

	function authTypeDescription(value: AuthType): string {
		if (value === 'public') return 'Anyone with the link';
		if (value === 'private') return 'Only the owner';
		const userCount = usersFromAuthType(value).length;
		return userCount === 1 ? 'One approved user' : `${userCount} approved users`;
	}

	function authTypeBadgeVariant(value: AuthType): BadgeVariant {
		if (value === 'public') return 'default';
		if (value === 'private') return 'outline';
		return 'secondary';
	}

	function parseShareUsers(value: string): string[] {
		return [...new Set(value.split(/[\s,;]+/).map((user) => user.trim()).filter(Boolean))];
	}

	function authorizationNotice(value: AuthType): string {
		if (value === 'public') return 'Session is public.';
		if (value === 'private') return 'Session is private.';
		return authTypeLabel(value) + '.';
	}

	function setAuthFeedback(sessionId: string, error: string | null, notice: string | null): void {
		authFeedback = { sessionId, error, notice };
	}

	function updateShareUsersInput(event: Event): void {
		const target = event.currentTarget;
		if (!(target instanceof HTMLTextAreaElement)) return;
		shareUsersDraft = { sessionId: data.sessionId, value: target.value };
	}

	async function updateAuthorization(nextAuthType: AuthType, action: AuthorizationAction): Promise<void> {
		const sessionId = data.sessionId;
		setAuthFeedback(sessionId, null, null);
		pendingAuthorization = { sessionId, action };

		try {
			const response = await fetch(
				resolve('/api/session/[id]/authorization', { id: sessionId }),
				withStoredAccessToken({
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ auth_type: nextAuthType })
				})
			);
			const payload = (await response.json()) as GrantSessionAuthRes | ErrorResponse;

			if (response.ok && 'auth_type' in payload) {
				authOverride = { sessionId, authType: payload.auth_type };
				shareUsersDraft = {
					sessionId,
					value: usersFromAuthType(payload.auth_type).join('\n')
				};
				setAuthFeedback(sessionId, null, authorizationNotice(payload.auth_type));
				return;
			}

			setAuthFeedback(
				sessionId,
				'error' in payload
					? payload.error
					: 'Joe Store could not update this session access.',
				null
			);
		} catch {
			setAuthFeedback(
				sessionId,
				'Joe Store could not reach the session service. Please try again shortly.',
				null
			);
		} finally {
			if (
				pendingAuthorization?.sessionId === sessionId &&
				pendingAuthorization.action === action
			) {
				pendingAuthorization = null;
			}
		}
	}

	async function shareWithUsers(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		const sessionId = data.sessionId;
		const users = parseShareUsers(shareUsersInput);
		if (users.length === 0) {
			setAuthFeedback(sessionId, 'Add at least one user before sharing this session.', null);
			return;
		}

		await updateAuthorization({ users }, 'users');
	}
</script>

{#snippet shareableBlock(block: LinkableBlock, content: Snippet)}
	<div
		id={block.id}
		class={cn(
			'group/block -mx-5 -my-1 scroll-mt-6 px-5 py-1',
			isSharedBlock(block) &&
				'rounded-sm bg-accent/30 ring-2 ring-ring ring-offset-4 ring-offset-background'
		)}
	>
		<div class="flex items-start gap-2">
			<div class="min-w-0 flex-1">{@render content()}</div>
			<div
				class={cn(
					'-mt-1 shrink-0 opacity-0 transition-opacity group-hover/block:opacity-100 group-focus-within/block:opacity-100',
					copiedBlockId === block.id && 'opacity-100'
				)}
			>
				<Button
					variant="ghost"
					size="icon-xs"
					onclick={() => copyBlockLink(block)}
					aria-label={copiedBlockId === block.id
						? 'Block link copied'
						: `Copy link to session entry ${block.sourceIndexes[0]}`}
					title={copiedBlockId === block.id ? 'Link copied' : 'Copy block link'}
				>
					{#if copiedBlockId === block.id}
						<CheckIcon aria-hidden="true" />
					{:else}
						<LinkIcon aria-hidden="true" />
					{/if}
				</Button>
			</div>
		</div>
	</div>
{/snippet}

<svelte:head>
	<title>{data.session.title} | Joe Store</title>
	<meta name="description" content={`View session ${data.sessionId} in Joe Store.`} />
</svelte:head>

<main class="terminal-shell min-h-svh bg-background px-4 py-6 sm:px-6 lg:py-10">
	<div class="mx-auto flex w-full max-w-3xl flex-col">
		<div class="mb-6 flex items-center justify-between">
			<Button href={resolve('/')} variant="ghost" size="sm" class="-ml-2 text-muted-foreground">
				<ArrowLeftIcon data-icon="inline-start" />
				Back
			</Button>
			<ThemeToggle />
		</div>

		<header class="mb-8">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0 flex flex-col gap-3">
					<span class="terminal-kicker">session/{data.sessionId}</span>
					<h1 class="terminal-cursor text-3xl font-bold sm:text-4xl">{data.session.title}</h1>
					<div class="flex flex-wrap items-center gap-2">
						<Badge variant={authTypeBadgeVariant(authType)}>
							{#if authType === 'public'}
								<GlobeIcon data-icon="inline-start" aria-hidden="true" />
							{:else if authType === 'private'}
								<LockIcon data-icon="inline-start" aria-hidden="true" />
							{:else}
								<UsersIcon data-icon="inline-start" aria-hidden="true" />
							{/if}
							{authTypeLabel(authType)}
						</Badge>
						<span class="text-sm text-muted-foreground">{authTypeDescription(authType)}</span>
					</div>
				</div>

				<Popover.Root>
					<Popover.Trigger class={buttonVariants({ variant: 'outline', size: 'sm' })}>
						<Share2Icon data-icon="inline-start" aria-hidden="true" />
						Share
					</Popover.Trigger>

					<Popover.Content>
						<div class="flex flex-col gap-4">
							<div class="flex items-start justify-between gap-3">
								<div class="flex flex-col gap-1">
									<h2 class="text-sm font-semibold tracking-tight">Session access</h2>
									<p class="text-sm text-muted-foreground">{authTypeDescription(authType)}</p>
								</div>

								<Badge variant={authTypeBadgeVariant(authType)}>
									{#if authType === 'public'}
										<GlobeIcon data-icon="inline-start" aria-hidden="true" />
									{:else if authType === 'private'}
										<LockIcon data-icon="inline-start" aria-hidden="true" />
									{:else}
										<UsersIcon data-icon="inline-start" aria-hidden="true" />
									{/if}
									{authTypeLabel(authType)}
								</Badge>
							</div>

							{#if authError}
								<Alert.Root variant="destructive">
									<CircleAlertIcon aria-hidden="true" />
									<Alert.Title>Unable to update access</Alert.Title>
									<Alert.Description>{authError}</Alert.Description>
								</Alert.Root>
							{/if}

							{#if authNotice}
								<Alert.Root>
									<CircleCheckIcon aria-hidden="true" />
									<Alert.Title>Access updated</Alert.Title>
									<Alert.Description>{authNotice}</Alert.Description>
								</Alert.Root>
							{/if}

							<form class="flex flex-col gap-3" onsubmit={shareWithUsers}>
								<Field.Group>
									<Field.Field data-invalid={authError ? '' : undefined}>
										<Field.Label for="share-users">Shared users</Field.Label>
										<Textarea
											id="share-users"
											value={shareUsersInput}
											oninput={updateShareUsersInput}
											rows={3}
											aria-invalid={authError ? 'true' : undefined}
											disabled={authorizationPending}
											class="min-h-24 resize-y"
											placeholder="user_id_1, user_id_2"
										/>
										<Field.Description>
											Separate user IDs with commas, spaces, or new lines.
										</Field.Description>
									</Field.Field>
								</Field.Group>

								<div class="flex flex-wrap items-center gap-2">
									<Button type="submit" variant="outline" size="sm" disabled={authorizationPending}>
										{#if pendingAuthAction === 'users'}
											<Spinner data-icon="inline-start" />
											Sharing...
										{:else}
											<UsersIcon data-icon="inline-start" aria-hidden="true" />
											Share with users
										{/if}
									</Button>

									{#if sharedUsers.length > 0}
										<div class="flex min-w-0 flex-1 flex-wrap gap-1.5">
											{#each sharedUsers as user (user)}
												<Badge variant="outline" class="max-w-full truncate font-mono">{user}</Badge>
											{/each}
										</div>
									{/if}
								</div>
							</form>

							<Separator />

							<div class="flex flex-wrap gap-2">
								<Button
									type="button"
									variant={authType === 'public' ? 'secondary' : 'outline'}
									size="sm"
									disabled={authorizationPending || authType === 'public'}
									onclick={() => updateAuthorization('public', 'public')}
								>
									{#if pendingAuthAction === 'public'}
										<Spinner data-icon="inline-start" />
										Saving...
									{:else}
										<GlobeIcon data-icon="inline-start" aria-hidden="true" />
										Make public
									{/if}
								</Button>
								<Button
									type="button"
									variant={authType === 'private' ? 'secondary' : 'outline'}
									size="sm"
									disabled={authorizationPending || authType === 'private'}
									onclick={() => updateAuthorization('private', 'private')}
								>
									{#if pendingAuthAction === 'private'}
										<Spinner data-icon="inline-start" />
										Saving...
									{:else}
										<LockIcon data-icon="inline-start" aria-hidden="true" />
										Make private
									{/if}
								</Button>
							</div>
						</div>
					</Popover.Content>
				</Popover.Root>
			</div>

		</header>

		<section aria-labelledby="conversation-heading">
			<h2 id="conversation-heading" class="sr-only">Conversation</h2>

			<div class="flex items-center justify-end pt-4">
				<ToggleGroup.Root type="single" variant="outline" size="sm" bind:value={view}>
					<ToggleGroup.Item value="all">All</ToggleGroup.Item>
					<ToggleGroup.Item value="summary">Short</ToggleGroup.Item>
					<ToggleGroup.Item value="user">User only</ToggleGroup.Item>
				</ToggleGroup.Root>
			</div>

			<div
				class="brainless-terminal terminal-frame mt-4 border-brainless-border p-3 sm:p-5"
			>
				<SessionHeader
					provider={data.session.provider}
					model={data.session.model}
					cwd={data.session.cwd}
					branch={data.session.branch}
					{properties}
				/>

				<div class="mt-4 flex flex-col gap-3">
				{#each data.session.messages as message, messageIndex (message.id)}
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
				{#snippet matchBadge()}
					<Badge variant="secondary">
						<SearchIcon data-icon="inline-start" aria-hidden="true" />
						{searchQuery ? `Match for “${searchQuery}”` : 'Search match'}
					</Badge>
				{/snippet}
				{#snippet rowAction()}
					{#if collapsible}
						<Button
							variant="ghost"
							size="icon-xs"
							onclick={() => toggleExpanded(message.id)}
							aria-label="Collapse message"
						>
							<ChevronUpIcon aria-hidden="true" />
						</Button>
					{:else if summaryAgent}
						<Button
							variant="ghost"
							size="icon-xs"
							onclick={() => toggleExpanded(message.id)}
							aria-label={summaryFinal ? 'Show full turn' : 'Show final message only'}
						>
							{#if summaryFinal}
								<ChevronDownIcon aria-hidden="true" />
							{:else}
								<ChevronUpIcon aria-hidden="true" />
							{/if}
						</Button>
					{/if}
				{/snippet}
				<div
					id={messageAnchorId(messageIndex)}
					class={cn(
						'scroll-mt-6',
						isSearchMatch(message) &&
							'rounded-sm bg-accent/30 ring-2 ring-ring ring-offset-4 ring-offset-background'
					)}
				>
				{#if collapsed}
					<div class="flex items-center font-mono text-[13px]">
						<button
							type="button"
							onclick={() => toggleExpanded(message.id)}
							class="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-brainless-muted transition-colors hover:text-brainless-strong"
						>
							<span class="shrink-0 text-brainless-success" aria-hidden="true">
								{data.session.provider === 'claude' ? '⏺' : '•'}
							</span>
							<span class="min-w-0 flex-1 truncate">
								{message.text?.replace(/\s+/g, ' ').trim() ||
									(message.tools.length > 0
										? `${message.tools.length} tool ${message.tools.length === 1 ? 'action' : 'actions'}`
										: roleLabel(message.role))}
							</span>
							<span class="shrink-0 text-brainless-dim" aria-hidden="true">▸</span>
						</button>
					</div>
				{:else if statusOnly}
					<div class="flex flex-col gap-1.5 border-b border-border py-2.5">
						{#each groupParts(message.parts) as group, groupIndex (`${message.id}-${groupIndex}`)}
							{#if group.kind !== 'tools'}
								{@const block = blockAt(messageIndex, group.partIndex)}
								{#snippet statusContent()}
									<div class="flex items-center gap-2">
										{#if group.kind === 'notice'}
											<span class="flex min-w-0 flex-1 items-center gap-2 text-xs font-medium text-muted-foreground">
												<OctagonXIcon class="size-3.5 shrink-0" aria-hidden="true" />
												<span class="truncate">{group.text}</span>
											</span>
										{:else if group.kind === 'notification'}
											<span class="min-w-0 flex-1">
											<NotificationChip
												notification={group.notification}
												provider={data.session.provider}
											/>
											</span>
										{/if}
										{#if groupIndex === 0 && message.timestamp}
											<time class="shrink-0 text-xs text-muted-foreground" datetime={message.timestamp}>
												{formatDate(message.timestamp)}
											</time>
										{/if}
									</div>
								{/snippet}
								{@render shareableBlock(block, statusContent)}
							{/if}
						{/each}
					</div>
				{:else}
					<SessionMessage
						role={message.role}
						provider={data.session.provider}
						timestamp={message.timestamp}
						formattedTimestamp={formatDate(message.timestamp)}
						badge={isSearchMatch(message) ? matchBadge : undefined}
						action={collapsible || summaryAgent ? rowAction : undefined}
					>
						{#each summaryFinal ? finalTextGroups(message.parts) : groupParts(message.parts) as group, groupIndex (`${message.id}-${groupIndex}`)}
							{#if group.kind === 'tools'}
								<div class="flex flex-col gap-1.5">
									{#each group.tools as item, index (`${message.id}-${groupIndex}-${index}`)}
										{@const block = blockAt(messageIndex, item.partIndex)}
										{#snippet toolContent()}
											<ToolActivity
												tool={item.tool}
												provider={data.session.provider}
												expanded={isSharedBlock(block)}
											/>
										{/snippet}
										{@render shareableBlock(block, toolContent)}
									{/each}
								</div>
							{:else}
								{@const block = blockAt(messageIndex, group.partIndex)}
								{#snippet groupContent()}
									{#if group.kind === 'text'}
										<Markdown
											sanitizedHtml={group.html}
											highlight={isSearchMatch(message) ? searchQuery : ''}
										/>
									{:else if group.kind === 'command'}
									<CommandChip
										command={group.command}
										provider={data.session.provider}
										expanded={isSharedBlock(block)}
										/>
									{:else if group.kind === 'notice'}
										<div
											class="flex items-center gap-2 text-xs font-medium text-muted-foreground"
										>
											<OctagonXIcon class="size-3.5 shrink-0" aria-hidden="true" />
											<span>{group.text}</span>
										</div>
									{:else}
									<NotificationChip
										notification={group.notification}
										provider={data.session.provider}
									/>
									{/if}
								{/snippet}
								{@render shareableBlock(block, groupContent)}
							{/if}
						{/each}
					</SessionMessage>
				{/if}
				</div>
				{:else}
					<p class="py-8 font-mono text-[13px] text-brainless-muted">
						This session contains metadata, but no displayable messages or tool activity.
					</p>
				{/each}
				</div>
			</div>
		</section>
	</div>
</main>
