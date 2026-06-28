<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import InboxIcon from '@lucide/svelte/icons/inbox';
	import LockIcon from '@lucide/svelte/icons/lock';
	import UsersIcon from '@lucide/svelte/icons/users';
	import * as Alert from '$lib/components/ui/alert';
	import { Badge, type BadgeVariant } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import * as Empty from '$lib/components/ui/empty';
	import { Spinner } from '$lib/components/ui/spinner';
	import JoeStoreMark from '$lib/components/joe-store-mark.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import type { AuthType, ErrorResponse, GetUserSessionsRes, SessionWithMeta } from '$lib/api';
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
				<div class="mb-4 flex items-center justify-between gap-4">
					<h2 id="session-count" class="text-sm font-medium">
						{sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
					</h2>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					{#each sessions as session (session.id)}
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
			</section>
		{/if}
	</main>
</div>
