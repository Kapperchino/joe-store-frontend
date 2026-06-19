<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Pathname } from '$app/types';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import StoreIcon from '@lucide/svelte/icons/store';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Spinner } from '$lib/components/ui/spinner';
	import { getBrowserSupabaseClient, storeAuthTokens } from '$lib/auth';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';

	type OAuthProvider = 'google' | 'github';

	let { data }: PageProps = $props();
	let clientMessage = $state<string | null>(null);
	let pendingProvider = $state<OAuthProvider | null>(null);
	let checkingSession = $state(true);

	const authMessage = $derived(clientMessage ?? data.authMessage);

	async function signIn(provider: OAuthProvider) {
		clientMessage = null;
		pendingProvider = provider;

		const callbackUrl = new URL(resolve('/login'), window.location.origin);
		callbackUrl.searchParams.set('next', data.next);

		const supabase = getBrowserSupabaseClient(data.supabaseUrl, data.supabasePublishableKey);
		const { error } = await supabase.auth.signInWithOAuth({
			provider,
			options: { redirectTo: callbackUrl.toString() }
		});

		if (error) {
			clientMessage = 'Sign in is temporarily unavailable. Please try again.';
			pendingProvider = null;
		}
	}

	onMount(() => {
		let active = true;
		const supabase = getBrowserSupabaseClient(data.supabaseUrl, data.supabasePublishableKey);
		const {
			data: { subscription }
		} = supabase.auth.onAuthStateChange((_event, session) => storeAuthTokens(session));

		void supabase.auth.getSession().then(({ data: { session }, error }) => {
			if (!active) return;

			checkingSession = false;
			storeAuthTokens(session);

			if (error) {
				clientMessage = 'We could not restore your session. Please sign in again.';
				return;
			}

			if (session) {
				void goto(resolve(data.next as Pathname), { replaceState: true });
			}
		});

		return () => {
			active = false;
			subscription.unsubscribe();
		};
	});
</script>

<svelte:head>
	<title>Sign in | Joe Store</title>
	<meta
		name="description"
		content="Sign in to Joe Store with Google or GitHub and keep your session on this device."
	/>
</svelte:head>

<main class="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
	<section class="flex w-full max-w-md flex-col items-center gap-6" aria-labelledby="login-title">
		<a class="flex items-center gap-3 font-semibold tracking-tight" href={resolve('/')}>
			<span
				class="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
			>
				<StoreIcon aria-hidden="true" />
			</span>
			<span>Joe Store</span>
		</a>

		<Card.Root class="w-full">
			<Card.Header class="text-center">
				<Card.Title id="login-title">Welcome back</Card.Title>
				<Card.Description>
					Sign in to save your session on this device.
				</Card.Description>
			</Card.Header>

			<Card.Content class="flex flex-col gap-3">
				{#if authMessage}
					<Alert.Root variant="destructive">
						<CircleAlertIcon />
						<Alert.Title>Unable to sign in</Alert.Title>
						<Alert.Description>{authMessage}</Alert.Description>
					</Alert.Root>
				{/if}

				<Button
					type="button"
					variant="outline"
					size="lg"
					class="w-full"
					disabled={checkingSession || pendingProvider !== null}
					onclick={() => signIn('google')}
				>
					{#if pendingProvider === 'google'}
						<Spinner data-icon="inline-start" />
						Connecting to Google...
					{:else}
						Continue with Google
					{/if}
				</Button>

				<Button
					type="button"
					variant="outline"
					size="lg"
					class="w-full"
					disabled={checkingSession || pendingProvider !== null}
					onclick={() => signIn('github')}
				>
					{#if pendingProvider === 'github'}
						<Spinner data-icon="inline-start" />
						Connecting to GitHub...
					{:else}
						Continue with GitHub
					{/if}
				</Button>
			</Card.Content>

			<Card.Footer class="justify-center">
				<p class="text-center text-xs text-muted-foreground">
					Your access and refresh tokens stay in this browser's local storage.
				</p>
			</Card.Footer>
		</Card.Root>
	</section>
</main>
