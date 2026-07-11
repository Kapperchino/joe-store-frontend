<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import SearchIcon from '@lucide/svelte/icons/search';
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import LockIcon from '@lucide/svelte/icons/lock';
	import OctagonXIcon from '@lucide/svelte/icons/octagon-x';
	import MousePointer2Icon from '@lucide/svelte/icons/mouse-pointer-2';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge } from '$lib/components/ui/badge';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import * as Popover from '$lib/components/ui/popover';
	import { Separator } from '$lib/components/ui/separator';
	import { Spinner } from '$lib/components/ui/spinner';
	import Markdown from '$lib/components/markdown.svelte';
	import ToolActivity from './tool-activity.svelte';
	import OpenAIIcon from './openai-icon.svelte';
	import ClaudeIcon from './claude-icon.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type { PageProps } from './$types';
	import type { AuthType, ErrorResponse, GrantSessionAuthRes } from '$lib/api';
	import { providerLabel } from '$lib/provider';
	import { withStoredAccessToken } from '$lib/auth';
	import { cn } from '$lib/utils';
	import CommandChip from './command-chip.svelte';
	import NotificationChip from './notification-chip.svelte';
	import SessionMessageRow from './session-message-row.svelte';
	import type {
		CommandView,
		MessagePart,
		NotificationView,
		ToolActivity as ToolActivityData
	} from './session-view';
	import { SvelteSet } from 'svelte/reactivity';
	import { onMount, tick } from 'svelte';

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

	function messageAnchorId(message: (typeof data.session.messages)[number]): string {
		if (isSearchMatch(message)) return 'search-match';
		return `session-entry-${message.sourceIndexes[0] ?? message.id}`;
	}

	onMount(() => {
		if (!searchMatchMessage) return;
		view = 'all';
		void tick().then(() => {
			requestAnimationFrame(() => {
				document.getElementById('search-match')?.scrollIntoView({ block: 'center' });
			});
		});
	});

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
			{ label: 'Provider', value: providerLabel(data.session.provider) },
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
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div class="min-w-0 flex flex-col gap-3">
					<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{data.session.title}</h1>
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
								<div class="flex flex-col gap-1.5">
									<label for="share-users" class="text-sm font-medium">Shared users</label>
									<textarea
										id="share-users"
										value={shareUsersInput}
										oninput={updateShareUsersInput}
										rows="3"
										aria-invalid={authError ? 'true' : undefined}
										disabled={authorizationPending}
										class="min-h-24 w-full resize-y rounded-2xl border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20"
										placeholder="user_id_1, user_id_2"
									></textarea>
								</div>

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

		<Separator class="mb-2" />

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
				<div
					id={messageAnchorId(message)}
					class={cn(
						'scroll-mt-6',
						isSearchMatch(message) &&
							'rounded-xl bg-accent/30 ring-2 ring-ring ring-offset-4 ring-offset-background'
					)}
				>
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
								{:else if data.session.provider === 'cursor'}
									<MousePointer2Icon class="size-3.5" aria-hidden="true" />
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
					{#snippet matchBadge()}
						<Badge variant="secondary">
							<SearchIcon data-icon="inline-start" aria-hidden="true" />
							{searchQuery ? `Match for “${searchQuery}”` : 'Search match'}
						</Badge>
					{/snippet}
					{#snippet rowAction()}
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
					{/snippet}
					<SessionMessageRow
						role={message.role}
						provider={data.session.provider}
						timestamp={message.timestamp}
						formattedTimestamp={formatDate(message.timestamp)}
						badge={isSearchMatch(message) ? matchBadge : undefined}
						action={collapsible || summaryAgent ? rowAction : undefined}
					>
						{#each summaryFinal ? finalTextGroups(message.parts) : groupParts(message.parts) as group, groupIndex (`${message.id}-${groupIndex}`)}
							{#if group.kind === 'text'}
								<Markdown
									sanitizedHtml={group.html}
									highlight={isSearchMatch(message) ? searchQuery : ''}
								/>
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
					</SessionMessageRow>
				{/if}
				</div>
			{:else}
				<p class="py-8 text-sm text-muted-foreground">
					This session contains metadata, but no displayable messages or tool activity.
				</p>
			{/each}
		</section>
	</div>
</main>
