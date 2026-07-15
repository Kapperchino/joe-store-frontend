<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import * as Alert from '$lib/components/ui/alert';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
</script>

<svelte:head>
	<title>Session unavailable | Joe Store</title>
</svelte:head>

<main class="terminal-shell flex min-h-svh items-center justify-center px-4 py-10">
	<Card.Root class="w-full max-w-lg">
		<Card.Header>
			<span class="terminal-kicker">runtime/error</span>
			<Card.Title class="terminal-cursor">Session unavailable</Card.Title>
			<Card.Description>Joe Store could not display this session.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Alert.Root variant="destructive">
				<CircleAlertIcon />
				<Alert.Title>Error {page.status}</Alert.Title>
				<Alert.Description>{page.error?.message ?? 'An unexpected error occurred.'}</Alert.Description>
			</Alert.Root>
		</Card.Content>
		<Card.Footer>
			<Button href={resolve('/')} variant="outline">Back to home</Button>
		</Card.Footer>
	</Card.Root>
</main>
