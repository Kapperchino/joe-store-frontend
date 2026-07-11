<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import LockIcon from '@lucide/svelte/icons/lock';
	import SearchIcon from '@lucide/svelte/icons/search';
	import UsersIcon from '@lucide/svelte/icons/users';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import * as Field from '$lib/components/ui/field';
	import { Input } from '$lib/components/ui/input';
	import { Spinner } from '$lib/components/ui/spinner';
	import JoeStoreMark from '$lib/components/joe-store-mark.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type {
		AuthType,
		CloudflareSearchChunk,
		CloudflareSearchResult,
		ErrorResponse,
		GetUserSessionsRes,
		SessionWithMeta
	} from '$lib/api';
	import { providerLabel } from '$lib/provider';
	import {
		getBrowserSupabaseClient,
		storeAuthTokens,
		withStoredAccessToken
	} from '$lib/auth';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let sessions = $state<SessionWithMeta[]>([]);
	let userEmail = $state<string | null>(null);
	let loadError = $state<string | null>(null);
	let loading = $state(true);
	let searchQuery = $state('');
	let searchedQuery = $state('');
	let searchChunks = $state<CloudflareSearchChunk[]>([]);
	let searchError = $state<string | null>(null);
	let searchNotice = $state<string | null>(null);
	let searching = $state(false);
	let searchRequestId = 0;

	const skillUrl = 'https://www.skills.sh/kapperchino/joe-store-skills';
	const dateFormatter = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC'
	});

	function sessionTitle(topic: string | null | undefined, id: number): string {
		return topic?.trim() || `Untitled session #${id}`;
	}

	function formatCreatedTime(value: string): string {
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? 'Date unavailable' : `${dateFormatter.format(date)} UTC`;
	}

	function createdAtTimestamp(value: string): number {
		const timestamp = Date.parse(value);
		return Number.isNaN(timestamp) ? 0 : timestamp;
	}

	function usersFromAuthType(value: AuthType): string[] {
		return typeof value === 'object' && value !== null && 'users' in value ? value.users : [];
	}

	function authTypeLabel(value: AuthType): string {
		if (value === 'public') return 'Public';
		if (value === 'private') return 'Private';
		const userCount = usersFromAuthType(value).length;
		return userCount === 1 ? 'Shared with 1 user' : `Shared with ${userCount} users`;
	}

	function authTypeBadgeVariant(value: AuthType): BadgeVariant {
		if (value === 'public') return 'default';
		if (value === 'private') return 'outline';
		return 'secondary';
	}

	function integerSessionId(value: unknown): number | null {
		if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value;
		if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;

		const id = Number(value);
		return Number.isSafeInteger(id) && id > 0 ? id : null;
	}

	function searchChunkSessionId(chunk: CloudflareSearchChunk): number | null {
		const metadata = chunk.item?.metadata;
		if (metadata && typeof metadata === 'object') {
			const metadataId = integerSessionId(metadata.session_id);
			if (metadataId !== null) return metadataId;
		}

		const keyMatch = chunk.item?.key.match(/(?:^|\/)session-(\d+)\.json$/i);
		return integerSessionId(keyMatch?.[1]);
	}

	const searchMatches = $derived.by(() => {
		return sessions
			.map((session) => ({
				session,
				chunks: searchChunks
					.filter((chunk) => searchChunkSessionId(chunk) === session.id)
					.sort((a, b) => b.score - a.score)
			}))
			.filter((match) => match.chunks.length > 0)
			.sort((a, b) => b.chunks[0].score - a.chunks[0].score);
	});
	const displayedSessions = $derived(
		searchedQuery
			? searchMatches
			: sessions.map((session) => ({ session, chunks: [] as CloudflareSearchChunk[] }))
	);

	function clearSearch(): void {
		searchRequestId += 1;
		searchQuery = '';
		searchedQuery = '';
		searchChunks = [];
		searchError = null;
		searchNotice = null;
		searching = false;
	}

	async function submitSearch(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		const query = searchQuery.trim();
		if (!query) {
			clearSearch();
			return;
		}

		const requestId = ++searchRequestId;
		searching = true;
		searchError = null;
		searchNotice = null;

		try {
			const params = new URLSearchParams({ query });
			const response = await fetch(
				`${resolve('/api/user/search')}?${params}`,
				withStoredAccessToken()
			);
			const payload = (await response.json()) as CloudflareSearchResult | ErrorResponse;

			if (requestId !== searchRequestId) return;

			if (response.ok && 'query_kind' in payload) {
				searchedQuery = query;
				searchChunks = payload.chunks ?? [];
				if (payload.errors?.length) {
					searchNotice = 'Some session providers could not be searched, so these results may be incomplete.';
				}
			} else if (response.status === 401) {
				const supabase = getBrowserSupabaseClient(data.supabaseUrl, data.supabasePublishableKey);
				await supabase.auth.signOut({ scope: 'local' });
				storeAuthTokens(null);
				await goto(resolve('/login?next=/user'), { replaceState: true });
			} else {
				searchError = 'error' in payload ? payload.error : 'Joe Store could not search your sessions.';
			}
		} catch {
			if (requestId === searchRequestId) {
				searchError = 'Joe Store could not reach the search service. Please try again shortly.';
			}
		} finally {
			if (requestId === searchRequestId) searching = false;
		}
	}

	async function loadSessions() {
		loading = true;
		loadError = null;

		const supabase = getBrowserSupabaseClient(data.supabaseUrl, data.supabasePublishableKey);
		const {
			data: { session },
			error
		} = await supabase.auth.getSession();

		if (error) {
			loading = false;
			loadError = 'We could not restore your sign-in session. Please sign in again.';
			return;
		}

		storeAuthTokens(session);

		if (!session) {
			await goto(resolve('/login?next=/user'), { replaceState: true });
			return;
		}

		userEmail = session.user.email ?? null;

		try {
			const response = await fetch(resolve('/api/user/sessions'), withStoredAccessToken());
			const payload = (await response.json()) as GetUserSessionsRes | ErrorResponse;

			if (response.ok && 'sessions' in payload) {
				sessions = [...payload.sessions].sort(
					(a, b) => createdAtTimestamp(b.created_time) - createdAtTimestamp(a.created_time)
				);
			} else if (response.status === 401) {
				await supabase.auth.signOut({ scope: 'local' });
				storeAuthTokens(null);
				await goto(resolve('/login?next=/user'), { replaceState: true });
				return;
			} else {
				loadError = 'error' in payload ? payload.error : 'Joe Store could not load your sessions.';
			}
		} catch {
			loadError = 'Joe Store could not reach the session service. Please try again shortly.';
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const supabase = getBrowserSupabaseClient(data.supabaseUrl, data.supabasePublishableKey);
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => storeAuthTokens(session));

		void loadSessions();

		return () => subscription.unsubscribe();
	});
</script>

<svelte:head>
	<title>Your sessions | Joe Store</title>
	<meta name="description" content="View all of your uploaded Joe Store sessions." />
</svelte:head>

<div class="flex min-h-svh flex-col bg-background">
	<header class="border-b">
		<div class="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
			<a class="flex items-center gap-2.5 font-semibold tracking-tight" href={resolve('/')}>
				<span
					class="flex size-9 items-center justify-center rounded-xl border bg-background shadow-sm"
				>
					<JoeStoreMark aria-hidden="true" />
				</span>
				<span>Joe Store</span>
			</a>
			<div class="flex items-center gap-2">
				<ThemeToggle />
				<Button href={resolve('/')} variant="outline" size="sm">Home</Button>
			</div>
		</div>
	</header>

	<main class="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-10 sm:px-6 sm:py-14">
		<div class="flex flex-col gap-2">
			<p class="text-sm text-muted-foreground">{userEmail ?? 'Your Joe Store account'}</p>
			<h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">Your sessions</h1>
			<p class="max-w-2xl text-muted-foreground">
				Every AI coding session you upload appears here, with the newest session first.
			</p>
		</div>

		{#if loading}
			<Empty.Root class="mt-8 border" aria-live="polite">
				<Empty.Header>
					<Empty.Media variant="icon">
						<Spinner />
					</Empty.Media>
					<Empty.Title>Loading sessions</Empty.Title>
					<Empty.Description>Restoring your account and fetching your session history.</Empty.Description>
				</Empty.Header>
			</Empty.Root>
		{:else if loadError}
			<div class="mt-8">
				<Alert.Root variant="destructive">
					<CircleAlertIcon aria-hidden="true" />
					<Alert.Title>Unable to load sessions</Alert.Title>
					<Alert.Description>{loadError}</Alert.Description>
					<Alert.Action>
						<Button type="button" variant="outline" size="sm" onclick={loadSessions}>Try again</Button>
					</Alert.Action>
				</Alert.Root>
			</div>
		{:else if sessions.length === 0}
			<Empty.Root class="mt-8 border">
				<Empty.Header>
					<Empty.Media variant="icon">
						<InboxIcon aria-hidden="true" />
					</Empty.Media>
					<Empty.Title>No sessions yet</Empty.Title>
					<Empty.Description>
						Install the Joe Store skill, then ask your coding agent to upload the current session.
					</Empty.Description>
				</Empty.Header>
				<Empty.Content>
					<Button href={skillUrl} target="_blank" rel="noreferrer">
						Install the skill
						<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
					</Button>
				</Empty.Content>
			</Empty.Root>
		{:else}
			<section class="mt-8" aria-labelledby="session-count">
				<form class="mb-6" onsubmit={submitSearch} role="search">
					<Field.Group>
						<Field.Field>
							<Field.Label class="sr-only" for="session-search">Search your sessions</Field.Label>
							<div class="flex flex-col gap-2 sm:flex-row">
								<Input
									id="session-search"
									type="search"
									placeholder="Search session content..."
									autocomplete="off"
									bind:value={searchQuery}
								/>
								<div class="flex gap-2">
									<Button type="submit" disabled={searching || !searchQuery.trim()}>
										{#if searching}
											<Spinner data-icon="inline-start" />
										{:else}
											<SearchIcon data-icon="inline-start" aria-hidden="true" />
										{/if}
										{searching ? 'Searching...' : 'Search'}
									</Button>
									{#if searchedQuery || searchError}
										<Button type="button" variant="outline" onclick={clearSearch}>Clear</Button>
									{/if}
								</div>
							</div>
							<Field.Description>
								Search across messages and tool output in every session you uploaded.
							</Field.Description>
						</Field.Field>
					</Field.Group>
				</form>

				{#if searchError}
					<Alert.Root class="mb-6" variant="destructive">
						<CircleAlertIcon aria-hidden="true" />
						<Alert.Title>Unable to search sessions</Alert.Title>
						<Alert.Description>{searchError}</Alert.Description>
					</Alert.Root>
				{:else if searchNotice}
					<Alert.Root class="mb-6">
						<CircleAlertIcon aria-hidden="true" />
						<Alert.Title>Partial search results</Alert.Title>
						<Alert.Description>{searchNotice}</Alert.Description>
					</Alert.Root>
				{/if}

				<div class="mb-4 flex items-center justify-between gap-4">
					<h2 id="session-count" class="text-sm font-medium">
						{#if searchedQuery}
							{searchMatches.length} {searchMatches.length === 1 ? 'session' : 'sessions'} found for
							“{searchedQuery}”
						{:else}
							{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
						{/if}
					</h2>
				</div>

				{#if searchedQuery && searchMatches.length === 0}
					<Empty.Root class="border">
						<Empty.Header>
							<Empty.Media variant="icon">
								<SearchIcon aria-hidden="true" />
							</Empty.Media>
							<Empty.Title>No matching sessions</Empty.Title>
							<Empty.Description>Try a different word or a more general phrase.</Empty.Description>
						</Empty.Header>
						<Empty.Content>
							<Button type="button" variant="outline" onclick={clearSearch}>View all sessions</Button>
						</Empty.Content>
					</Empty.Root>
				{:else}
					<div class="grid gap-4 sm:grid-cols-2">
						{#each displayedSessions as match (match.session.id)}
							{@const session = match.session}
							<Card.Root size="sm" class="h-full">
								<Card.Header>
									<Card.Title>{sessionTitle(session.topic, session.id)}</Card.Title>
									<Card.Description>Session #{session.id}</Card.Description>
								</Card.Header>
								<Card.Content class="flex items-center justify-between gap-3">
									<div class="flex flex-wrap items-center gap-2">
										<Badge variant="secondary">{providerLabel(session.provider_type)}</Badge>
										<Badge variant={authTypeBadgeVariant(session.auth_type)}>
											{#if session.auth_type === 'public'}
												<GlobeIcon data-icon="inline-start" aria-hidden="true" />
											{:else if session.auth_type === 'private'}
												<LockIcon data-icon="inline-start" aria-hidden="true" />
											{:else}
												<UsersIcon data-icon="inline-start" aria-hidden="true" />
											{/if}
											{authTypeLabel(session.auth_type)}
										</Badge>
									</div>
									<time class="text-xs text-muted-foreground" datetime={session.created_time}>
										{formatCreatedTime(session.created_time)}
									</time>
								</Card.Content>
								{#if match.chunks[0]}
									<Card.Content>
										<p class="line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">
											{match.chunks[0].text}
										</p>
									</Card.Content>
								{/if}
								<Card.Footer>
									<Button
										href={resolve('/session/[id]', { id: String(session.id) })}
										variant="outline"
										size="sm"
									>
										View session
										<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
									</Button>
								</Card.Footer>
							</Card.Root>
						{/each}
					</div>
				{/if}
			</section>
		{/if}
	</main>
</div>
