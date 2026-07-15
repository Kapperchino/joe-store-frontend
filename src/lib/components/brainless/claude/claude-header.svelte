<script lang="ts">
	import { Separator } from '$lib/components/ui/separator';

	let {
		version,
		title = 'Session replay',
		model = 'Unknown model',
		org = 'Captured by Joe Store',
		cwd = 'Directory not recorded',
		details = []
	}: {
		version?: string;
		title?: string;
		model?: string;
		org?: string;
		cwd?: string;
		details?: string[];
	} = $props();

	const logoBits = [
		'000111111111111000',
		'000110111111011000',
		'011111111111111110',
		'000111111111111000',
		'000010100001010000'
	];
	const pixelHeight = 2.4;
	const logoRuns = logoBits.flatMap((row, y) => {
		const runs: Array<{ x: number; y: number; width: number }> = [];
		let x = 0;
		while (x < row.length) {
			if (row[x] !== '1') {
				x += 1;
				continue;
			}
			let end = x;
			while (end < row.length && row[end] === '1') end += 1;
			runs.push({ x, y: y * pixelHeight, width: end - x });
			x = end;
		}
		return runs;
	});
</script>

<fieldset
	class="min-w-0 rounded-[6px] border border-brainless-claude px-3 pt-1 pb-3.5 font-mono text-[13px] leading-[1.5] text-brainless-foreground sm:px-4"
>
	<legend class="max-w-full truncate px-2 text-brainless-claude">
		Claude Code
		{#if version}<span class="text-brainless-muted">{version}</span>{/if}
	</legend>

	<div class="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_1px_minmax(0,1.1fr)]">
		<div class="flex min-w-0 flex-col items-center gap-2 py-1 text-center">
			<div class="font-semibold">{title}</div>
			<svg
				aria-hidden="true"
				width="72"
				height="48"
				viewBox="0 0 18 12"
				shape-rendering="crispEdges"
				class="my-1.5 fill-brainless-claude"
			>
				{#each logoRuns as run (`${run.x}-${run.y}`)}
					<rect x={run.x} y={run.y} width={run.width} height={pixelHeight} />
				{/each}
			</svg>
			<div class="flex min-w-0 flex-col gap-0.5 break-words text-brainless-muted">
				<div>{model}</div>
				<div>{org}</div>
				<div>{cwd}</div>
			</div>
		</div>

		<Separator
			orientation="vertical"
			class="hidden sm:block"
			style="--border: color-mix(in srgb, var(--brainless-claude) 34%, transparent)"
		/>

		<div class="flex min-w-0 flex-col gap-1">
			<div class="font-semibold text-brainless-claude">Session details</div>
			{#each details.slice(0, 3) as detail (detail)}
				<div class="truncate">{detail}</div>
			{/each}
			<Separator class="my-1.5" style="--border: var(--brainless-claude)" />
			<div class="font-semibold text-brainless-claude">Replay controls</div>
			<div class="truncate">Hover a block to copy its permanent link</div>
			<div class="truncate">Use the view selector to shorten the transcript</div>
			<div class="truncate italic text-brainless-muted">Complete captured context below</div>
		</div>
	</div>
</fieldset>
