<script lang="ts">
	import type { Component } from 'svelte';
	import { resolve } from '$app/paths';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import BlocksIcon from '@lucide/svelte/icons/blocks';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CloudUploadIcon from '@lucide/svelte/icons/cloud-upload';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import GitCompareIcon from '@lucide/svelte/icons/git-compare';
	import LinkIcon from '@lucide/svelte/icons/link';
	import LockIcon from '@lucide/svelte/icons/lock';
	import MessageSquareIcon from '@lucide/svelte/icons/message-square';
	import PackagePlusIcon from '@lucide/svelte/icons/package-plus';
	import Share2Icon from '@lucide/svelte/icons/share-2';
	import ShieldCheckIcon from '@lucide/svelte/icons/shield-check';
	import TerminalIcon from '@lucide/svelte/icons/terminal';
	import UserIcon from '@lucide/svelte/icons/user';
	import { Button } from '$lib/components/ui/button';
	import { Separator } from '$lib/components/ui/separator';
	import JoeStoreMark from '$lib/components/joe-store-mark.svelte';
	import ThemeToggle from '$lib/components/theme-toggle.svelte';
	import ClaudeIcon from './session/[id]/claude-icon.svelte';
	import CursorIcon from './session/[id]/cursor-icon.svelte';
	import OpenAIIcon from './session/[id]/openai-icon.svelte';
	import ToolActivity from './session/[id]/tool-activity.svelte';
	import type { ToolActivity as ToolActivityData } from './session/[id]/session-view';

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

	const exampleTools = [
		{
			label: 'Search',
			input: JSON.stringify({ pattern: 'account activity', path: 'src/routes' }),
			output: 'src/routes/account/activity/+page.svelte\nsrc/lib/api/activity.ts'
		},
		{
			label: 'Read',
			input: JSON.stringify({ file_path: 'src/routes/account/activity/+page.svelte' })
		},
		{
			label: 'Edit',
			input: JSON.stringify({
				file_path: 'src/routes/account/activity/+page.svelte',
				old_string: '<Button variant="outline">Filter</Button>',
				new_string:
					'<Button variant="outline">Filter</Button>\n<Button onclick={exportCsv}>Export CSV</Button>'
			}),
			output: 'Updated src/routes/account/activity/+page.svelte'
		},
		{
			label: 'Bash',
			input: JSON.stringify({ command: 'npm run check' }),
			output: 'svelte-check found 0 errors and 0 warnings'
		}
	] satisfies ToolActivityData[];

	const agents: { name: string; icon: Component<{ class?: string }> | null }[] = [
		{ name: 'Claude Code', icon: ClaudeIcon },
		{ name: 'Codex', icon: OpenAIIcon },
		{ name: 'Cursor', icon: CursorIcon }
	];

	const features = [
		{
			icon: MessageSquareIcon,
			title: 'Every prompt and reply',
			body: 'The full conversation, in order — not just the final answer.'
		},
		{
			icon: TerminalIcon,
			title: 'Every tool call',
			body: 'Searches, reads, edits, and commands, each with its input and result.'
		},
		{
			icon: GitCompareIcon,
			title: 'Readable diffs',
			body: 'Code changes rendered as clean, colored diffs instead of raw JSON.'
		},
		{
			icon: ShieldCheckIcon,
			title: 'Private by default',
			body: 'Nothing is shared until you ask, and you decide who can open each link.'
		},
		{
			icon: BlocksIcon,
			title: 'Works with your agent',
			body: 'Claude Code, Codex, Cursor, or anything else that supports skills.'
		},
		{
			icon: LinkIcon,
			title: 'One link to share',
			body: 'Drop it in a pull request, a thread, or a review — no setup to read it.'
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
			body: 'You get a readable page with the prompts, tool calls, and code changes in context.',
			command: 'Copy the link returned by Joe Store'
		}
	];

	const securityPoints = [
		{
			title: 'Private by default',
			body: 'A session uploads only when you explicitly ask your agent to.'
		},
		{
			title: 'You control access',
			body: 'Choose who can open each link you share.'
		},
		{
			title: 'Read-only by design',
			body: 'A shared link is a view of the session — nothing more.'
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

{#snippet eyebrow(text: string)}
	<span
		class="inline-flex items-center gap-2 rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground"
	>
		{text}
	</span>
{/snippet}

<div class="flex min-h-svh flex-col bg-background">
	<header class="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
		<div class="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
			<a class="flex items-center gap-2.5 font-semibold tracking-tight" href={resolve('/')}>
				<span
					class="flex size-9 items-center justify-center rounded-xl border bg-background shadow-sm"
				>
					<JoeStoreMark aria-hidden="true" />
				</span>
				<span>Joe Store</span>
			</a>

			<nav class="flex items-center gap-1" aria-label="Primary navigation">
				<a
					class="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
					href="#features">Features</a
				>
				<a
					class="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
					href="#how-it-works">How it works</a
				>
				<a
					class="hidden rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground md:block"
					href="#security">Security</a
				>
				<ThemeToggle />
				<Button href={resolve('/user')} size="sm">My sessions</Button>
			</nav>
		</div>
	</header>

	<main class="flex-1">
		<!-- Hero -->
		<section class="relative isolate overflow-hidden">
			<div
				class="pointer-events-none absolute inset-0 -z-10 bg-dot-grid [mask-image:radial-gradient(ellipse_80%_55%_at_50%_0%,#000_50%,transparent_100%)]"
			></div>
			<div
				class="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-16 lg:py-28"
			>
				<div class="flex min-w-0 flex-col items-start">
					<a
						href={skillUrl}
						target="_blank"
						rel="noreferrer"
						class="group inline-flex items-center gap-2 rounded-full border bg-background/70 py-1 pr-3 pl-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
					>
						<span class="flex items-center gap-1.5">
							<span class="size-1.5 rounded-full bg-green-500"></span>
							Live on the skills registry
						</span>
						<ArrowRightIcon
							class="size-3 transition-transform group-hover:translate-x-0.5"
							aria-hidden="true"
						/>
					</a>

					<h1 class="mt-5 max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
						Your AI coding sessions, ready to share.
					</h1>
					<p
						class="mt-6 max-w-xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg"
					>
						Joe Store turns a session from your coding agent into a clean link — every prompt, tool
						call, and code change, preserved in context.
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
							<code class="min-w-0 flex-1 truncate text-foreground">{installCmd}</code>
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

				<!-- Product preview: the shared link itself -->
				<div
					class="relative min-w-0 overflow-hidden rounded-2xl border bg-card text-card-foreground shadow-xl ring-1 ring-foreground/5"
				>
					<div class="flex items-center gap-3 border-b bg-muted/40 px-4 py-2.5">
						<div class="flex items-center gap-1.5" aria-hidden="true">
							<span class="size-2.5 rounded-full bg-muted-foreground/25"></span>
							<span class="size-2.5 rounded-full bg-muted-foreground/25"></span>
							<span class="size-2.5 rounded-full bg-muted-foreground/25"></span>
						</div>
						<div
							class="flex min-w-0 flex-1 items-center gap-1.5 rounded-md border bg-background px-2.5 py-1 font-mono text-xs text-muted-foreground"
						>
							<LockIcon class="size-3 shrink-0" aria-hidden="true" />
							<span class="truncate">joestore.sh/s/9f3a21c4</span>
						</div>
						<span
							class="hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex"
						>
							<span class="size-1.5 rounded-full bg-green-500"></span>
							Shared
						</span>
					</div>

					<div class="flex flex-col gap-1 px-5 pt-4">
						<h2 class="text-sm font-semibold tracking-tight">Account activity CSV export</h2>
						<p class="flex items-center gap-1.5 text-xs text-muted-foreground">
							<OpenAIIcon class="size-3.5" />
							Example transcript · OpenAI
						</p>
					</div>

					<div class="flex flex-col gap-5 px-5 py-5">
						<article>
							<header class="mb-3 flex items-center justify-between gap-3">
								<div class="flex items-center gap-2.5">
									<span
										class="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
									>
										<UserIcon class="size-4" aria-hidden="true" />
									</span>
									<h3 class="text-sm font-semibold tracking-tight">User</h3>
								</div>
								<time class="text-xs text-muted-foreground" datetime="2026-06-21T10:42:00">
									10:42 AM
								</time>
							</header>
							<p class="text-sm leading-relaxed sm:pl-9.5">
								Add CSV export to the account activity page. Include the active filters and keep the
								existing layout intact.
							</p>
						</article>

						<Separator />

						<article>
							<header class="mb-3 flex items-center justify-between gap-3">
								<div class="flex items-center gap-2.5">
									<span
										class="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground"
									>
										<OpenAIIcon class="size-4" />
									</span>
									<h3 class="text-sm font-semibold tracking-tight">Assistant</h3>
								</div>
								<time class="text-xs text-muted-foreground" datetime="2026-06-21T10:44:00">
									10:44 AM
								</time>
							</header>

							<div class="flex flex-col gap-4 sm:pl-9.5">
								<p class="text-sm leading-relaxed">
									I’ll trace the activity data flow, add the export, and run the project checks.
								</p>

								<div class="flex flex-col gap-1.5">
									{#each exampleTools as tool (tool.label)}
										<ToolActivity {tool} />
									{/each}
								</div>

								<div class="flex flex-col gap-2 text-sm leading-relaxed">
									<p class="font-medium">Implemented and verified.</p>
									<ul class="list-disc pl-5 text-muted-foreground">
										<li>Exports the filtered activity rows as CSV</li>
										<li>Preserves the current page layout</li>
										<li>Project checks pass with no warnings</li>
									</ul>
								</div>
							</div>
						</article>
					</div>

					<div class="flex items-center gap-2 border-t px-5 py-3 text-sm text-muted-foreground">
						<CheckIcon class="size-4" aria-hidden="true" />
						<p>Complete context, preserved in one link.</p>
					</div>
				</div>
			</div>
		</section>

		<!-- Works with -->
		<section class="border-y bg-muted/30">
			<div
				class="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-4 py-10 sm:px-6"
			>
				<p class="text-xs font-medium tracking-wider text-muted-foreground uppercase">
					Works with the agents you already use
				</p>
				<div class="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
					{#each agents as agent (agent.name)}
						{@const Icon = agent.icon}
						<div class="flex items-center gap-2 text-sm font-medium text-foreground/80">
							{#if Icon}
								<Icon class="size-5" />
							{/if}
							{agent.name}
						</div>
					{/each}
					<span class="text-sm text-muted-foreground">+ others coming soon</span>
				</div>
			</div>
		</section>

		<!-- Features -->
		<section id="features" class="scroll-mt-20">
			<div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
				<div class="mx-auto flex max-w-2xl flex-col items-center text-center">
					{@render eyebrow('What you share')}
					<h2 class="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
						Everything that happened, in one place.
					</h2>
					<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
						A Joe Store link is the whole session — readable, in order, and in context.
					</p>
				</div>

				<div
					class="mt-12 grid gap-px overflow-hidden rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3"
				>
					{#each features as feature (feature.title)}
						{@const Icon = feature.icon}
						<div class="flex flex-col gap-3 bg-card p-6">
							<span
								class="flex size-10 items-center justify-center rounded-lg border bg-background"
							>
								<Icon class="size-5" aria-hidden="true" />
							</span>
							<h3 class="text-base font-semibold tracking-tight">{feature.title}</h3>
							<p class="text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- How it works -->
		<section id="how-it-works" class="scroll-mt-20 border-t bg-muted/30">
			<div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
				<div class="mx-auto flex max-w-2xl flex-col items-center text-center">
					{@render eyebrow('How it works')}
					<h2 class="mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
						From active session to shareable link in three steps.
					</h2>
					<p class="mt-4 text-base leading-relaxed text-pretty text-muted-foreground">
						Install once. After that, ask your agent to upload whenever you want to share.
					</p>
				</div>

				<div class="mt-12 grid gap-4 lg:grid-cols-3">
					{#each steps as step, i (step.title)}
						{@const Icon = step.icon}
						<div class="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm">
							<div class="flex items-center justify-between">
								<span
									class="flex size-10 items-center justify-center rounded-lg border bg-background"
								>
									<Icon class="size-5" aria-hidden="true" />
								</span>
								<span class="font-mono text-xs text-muted-foreground">0{i + 1}</span>
							</div>
							<div class="flex flex-col gap-1.5">
								<h3 class="text-base font-semibold tracking-tight">{step.title}</h3>
								<p class="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
							</div>
							<code
								class="mt-auto block rounded-lg border bg-muted/50 px-3 py-2.5 font-mono text-xs text-foreground wrap-break-word"
							>
								{step.command}
							</code>
						</div>
					{/each}
				</div>
			</div>
		</section>

		<!-- Security -->
		<section id="security" class="scroll-mt-20">
			<div class="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
				<div
					class="grid gap-8 rounded-2xl border bg-card p-8 shadow-sm sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-12"
				>
					<div class="flex flex-col items-start gap-4">
						<span class="flex size-11 items-center justify-center rounded-xl border bg-background">
							<ShieldCheckIcon class="size-5" aria-hidden="true" />
						</span>
						{@render eyebrow('Security')}
						<h2 class="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
							Your sessions stay yours.
						</h2>
						<p class="text-sm leading-relaxed text-muted-foreground">
							Joe Store is private by default. You decide what gets uploaded and who can open each
							link you share.
						</p>
					</div>

					<ul class="grid gap-3">
						{#each securityPoints as point (point.title)}
							<li class="flex items-start gap-3 rounded-xl border bg-muted/30 p-4">
								<CircleCheckIcon class="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
								<div class="flex flex-col gap-0.5">
									<p class="text-sm font-medium">{point.title}</p>
									<p class="text-sm text-muted-foreground">{point.body}</p>
								</div>
							</li>
						{/each}
					</ul>
				</div>
			</div>
		</section>

		<!-- Final CTA -->
		<section class="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28">
			<div
				class="relative isolate overflow-hidden rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12 sm:py-20"
			>
				<div
					class="pointer-events-none absolute inset-0 -z-10 bg-dot-grid [mask-image:radial-gradient(ellipse_70%_80%_at_50%_50%,#000_35%,transparent_75%)]"
				></div>
				<h2 class="mx-auto max-w-xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
					Make your next session easy to review.
				</h2>
				<p
					class="mx-auto mt-4 max-w-lg text-base leading-relaxed text-pretty text-muted-foreground"
				>
					Install the skill once. After that, just ask your agent to upload — then share the link it
					gives you back.
				</p>
				<div class="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
					<Button href={skillUrl} target="_blank" rel="noreferrer" size="lg">
						Install the skill
						<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
					</Button>
					<Button href={resolve('/user')} variant="outline" size="lg">My sessions</Button>
				</div>
				<p class="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
					<ShieldCheckIcon class="size-3.5" aria-hidden="true" />
					Private by default · works with your existing agent
				</p>
			</div>
		</section>
	</main>

	<Separator />
	<footer>
		<div
			class="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:px-6"
		>
			<div class="flex items-center gap-2">
				<JoeStoreMark class="size-4" aria-hidden="true" />
				<span>Joe Store</span>
			</div>
			<div class="flex items-center gap-5">
				<a
					class="transition-colors hover:text-foreground"
					href={skillUrl}
					target="_blank"
					rel="noreferrer"
				>
					Skill
				</a>
				<a
					class="transition-colors hover:text-foreground"
					href="https://github.com/kapperchino/joe-store-skills"
					target="_blank"
					rel="noreferrer">GitHub</a
				>
				<a class="transition-colors hover:text-foreground" href="#security">Security</a>
				<a class="transition-colors hover:text-foreground" href={resolve('/user')}>My sessions</a>
			</div>
		</div>
	</footer>
</div>
