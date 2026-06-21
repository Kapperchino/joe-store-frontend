<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import CodeXmlIcon from '@lucide/svelte/icons/code-xml';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import PackagePlusIcon from '@lucide/svelte/icons/package-plus';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import StoreIcon from '@lucide/svelte/icons/store';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import WrenchIcon from '@lucide/svelte/icons/wrench';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';

	const skillUrl = 'https://www.skills.sh/kapperchino/joe-store-skills';
	const installCmd = 'npx skills add kapperchino/joe-store-skills';

	let copied = $state(false);

	async function copyInstall() {
		try {
			await navigator.clipboard.writeText(installCmd);
			copied = true;
			setTimeout(() => (copied = false), 1600);
		} catch {
			copied = false;
		}
	}

	const transcriptItems = [
		{
			icon: FileTextIcon,
			label: 'Your prompt',
			body: 'Add CSV export to the account activity page.'
		},
		{
			icon: WrenchIcon,
			label: 'Agent work',
			body: 'Inspected the data flow, updated the route, and ran the checks.'
		},
		{
			icon: CodeXmlIcon,
			label: 'Code changes',
			body: '3 files changed with the complete diff attached.'
		}
	];

	const steps = [
		{
			icon: PackagePlusIcon,
			title: 'Install the skill',
			body: 'Add Joe Store to Claude Code, Cursor, Codex, or another agent that supports skills.',
			command: installCmd
		},
		{
			icon: CloudUploadIcon,
			title: 'Ask your agent to upload',
			body: 'Joe Store opens browser sign-in, then uploads the current session for you.',
			command: 'Upload this session to Joe Store'
		},
		{
			icon: Share2Icon,
			title: 'Share the link',
			body: 'You get a readable page containing the prompts, tool calls, and code changes in context.',
			command: 'Copy the link returned by Joe Store'
		}
	];
</script>

<svelte:head>
	<title>Joe Store — Share your AI coding sessions</title>
	<meta
		name="description"
		content="Turn AI coding sessions into readable, shareable transcripts with every prompt, tool call, and code change in context."
	/>
</svelte:head>

<div class="flex min-h-svh flex-col bg-background">
	<header class="sticky top-0 z-10 border-b bg-background/90 backdrop-blur">
		<div class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
			<a class="flex items-center gap-2.5 font-semibold tracking-tight" href={resolve('/')}>
				<span
					class="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"
				>
					<StoreIcon class="size-5" aria-hidden="true" />
				</span>
				<span>Joe Store</span>
			</a>

			<nav class="flex items-center gap-2" aria-label="Primary navigation">
				<a
					class="hidden px-3 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
					href="#how-it-works">How it works</a
				>
				<ThemeToggle />
				<Button href={resolve('/login')} size="sm">Sign in</Button>
			</nav>
		</div>
	</header>

	<main class="flex-1">
		<section class="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:py-28">
			<div class="flex flex-col items-start">
				<p class="text-sm font-medium text-muted-foreground">Share the work behind the code</p>
				<h1 class="mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
					Your AI coding sessions, ready to share.
				</h1>
				<p class="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
					Joe Store turns a session from your coding agent into a clean link with every prompt,
					tool call, and code change in context.
				</p>

				<div class="mt-8 flex flex-col gap-3 sm:flex-row">
					<Button href={skillUrl} target="_blank" rel="noreferrer" size="lg">
						Install the skill
						<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
					</Button>
					<Button href="#how-it-works" variant="outline" size="lg">See how it works</Button>
				</div>

				<div class="mt-8 w-full max-w-xl">
					<p class="mb-2 text-xs font-medium text-muted-foreground">Or install from your terminal</p>
					<div
						class="flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5 text-left font-mono text-sm"
					>
						<TerminalIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
						<code class="flex-1 truncate text-foreground">{installCmd}</code>
						<Button
							variant="ghost"
							size="icon-sm"
							onclick={copyInstall}
							aria-label={copied ? 'Install command copied' : 'Copy install command'}
						>
							{#if copied}
								<CheckIcon aria-hidden="true" />
							{:else}
								<CopyIcon aria-hidden="true" />
							{/if}
						</Button>
					</div>
					<p class="sr-only" aria-live="polite">{copied ? 'Install command copied' : ''}</p>
				</div>
			</div>

			<Card.Root class="overflow-hidden">
				<Card.Header>
					<Card.Title>A session anyone can follow</Card.Title>
					<Card.Description>Example transcript</Card.Description>
				</Card.Header>
				<Card.Content class="flex flex-col gap-5">
					{#each transcriptItems as item (item.label)}
						{@const Icon = item.icon}
						<div class="flex gap-3">
							<span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
								<Icon class="size-4 text-muted-foreground" aria-hidden="true" />
							</span>
							<div class="flex min-w-0 flex-col gap-1">
								<p class="text-sm font-medium">{item.label}</p>
								<p class="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
							</div>
						</div>
					{/each}
				</Card.Content>
				<Card.Footer class="flex items-center gap-2">
					<CheckIcon class="size-4" aria-hidden="true" />
					<p class="text-sm text-muted-foreground">Complete context, preserved in one link.</p>
				</Card.Footer>
			</Card.Root>
		</section>

		<section id="how-it-works" class="scroll-mt-20 bg-muted/40">
			<div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
				<div class="max-w-2xl">
					<p class="text-sm font-medium text-muted-foreground">How it works</p>
					<h2 class="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
						From active session to shareable link in three steps.
					</h2>
				</div>

				<div class="mt-10 grid gap-4 lg:grid-cols-3">
					{#each steps as step, i (step.title)}
						{@const Icon = step.icon}
						<Card.Root>
							<Card.Header>
								<div class="mb-2 flex items-center justify-between">
									<span class="flex size-10 items-center justify-center rounded-lg bg-muted">
										<Icon class="size-5" aria-hidden="true" />
									</span>
									<span class="font-mono text-xs text-muted-foreground">0{i + 1}</span>
								</div>
								<Card.Title>{step.title}</Card.Title>
								<Card.Description>{step.body}</Card.Description>
							</Card.Header>
							<Card.Content>
								<code class="block rounded-lg bg-muted px-3 py-2.5 font-mono text-xs wrap-break-word">
									{step.command}
								</code>
							</Card.Content>
						</Card.Root>
					{/each}
				</div>
			</div>
		</section>

		<section class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
			<Card.Root>
				<Card.Header>
					<Card.Title>Make your next session easy to review.</Card.Title>
					<Card.Description class="max-w-2xl">
						Install the skill once. After that, ask your agent to upload any session and share the
						link it returns.
					</Card.Description>
				</Card.Header>
				<Card.Footer class="flex flex-col items-start gap-3 sm:flex-row">
					<Button href={skillUrl} target="_blank" rel="noreferrer" size="lg">
						Install the skill
						<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
					</Button>
					<Button href={resolve('/login')} variant="outline" size="lg">Sign in</Button>
				</Card.Footer>
			</Card.Root>
		</section>
	</main>

	<Separator />
	<footer>
		<div
			class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6"
		>
			<div class="flex items-center gap-2">
				<StoreIcon class="size-4" aria-hidden="true" />
				<span>Joe Store</span>
			</div>
			<div class="flex items-center gap-5">
				<a class="transition-colors hover:text-foreground" href={skillUrl} target="_blank" rel="noreferrer">
					Skill
				</a>
				<a
					class="transition-colors hover:text-foreground"
					href="https://github.com/kapperchino/joe-store-skills"
					target="_blank"
					rel="noreferrer">GitHub</a
				>
				<a class="transition-colors hover:text-foreground" href={resolve('/login')}>Sign in</a>
			</div>
		</div>
	</footer>
</div>
