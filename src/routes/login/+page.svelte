<script lang="ts">
	import { resolve } from '$app/paths';
	import StoreIcon from '@lucide/svelte/icons/store';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const authMessage = $derived(form?.message ?? data.authMessage);
</script>

<svelte:head>
	<title>Sign in | Joe Store</title>
	<meta
		name="description"
		content="Sign in to Joe Store securely with your Google or GitHub account."
	/>
</svelte:head>

<main class="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
	<section class="flex w-full max-w-md flex-col items-center gap-6" aria-labelledby="login-title">
		<a class="flex items-center gap-3 font-semibold tracking-tight" href={resolve('/')}>
			<span
				class="flex size-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm"
			>
				<StoreIcon class="size-5" aria-hidden="true" />
			</span>
			<span>Joe Store</span>
		</a>

		<Card.Root class="w-full">
			<Card.Header class="text-center">
				<Card.Title id="login-title">Welcome back</Card.Title>
				<Card.Description>
					Sign in with one of your connected accounts to continue.
				</Card.Description>
			</Card.Header>

			<Card.Content>
				<form method="POST" class="flex flex-col gap-3">
					<input type="hidden" name="next" value={data.next} />

					{#if authMessage}
						<p class="text-center text-sm text-destructive" role="alert">{authMessage}</p>
					{/if}

					<Button
						type="submit"
						name="provider"
						value="google"
						variant="outline"
						size="lg"
						class="w-full"
					>
						Continue with Google
					</Button>

					<Button
						type="submit"
						name="provider"
						value="github"
						variant="outline"
						size="lg"
						class="w-full"
					>
						Continue with GitHub
					</Button>
				</form>
			</Card.Content>

			<Card.Footer class="justify-center">
				<p class="text-center text-xs text-muted-foreground">
					Secure authentication is provided by Supabase.
				</p>
			</Card.Footer>
		</Card.Root>
	</section>
</main>
