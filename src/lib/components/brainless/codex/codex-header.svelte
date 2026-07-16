<script lang="ts">
	let {
		version,
		model = 'Unknown model',
		directory = 'Directory not recorded',
		product = 'OpenAI Codex',
		mark = '>_'
	}: {
		version?: string;
		model?: string;
		directory?: string;
		product?: string;
		mark?: string;
	} = $props();
</script>

<div
	class="min-w-0 rounded-none border border-brainless-border px-3 py-3 font-mono text-[13px] leading-[1.7] text-brainless-strong sm:px-4"
>
	<div class="flex min-w-0 flex-wrap items-baseline gap-x-2">
		<span aria-hidden="true" class="shrink-0 text-brainless-muted">{mark}</span>
		<span class="font-medium">{product}</span>
		{#if version}<span class="text-brainless-muted">({version})</span>{/if}
	</div>
	<div class="mt-2 grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] gap-x-3">
		<span class="text-brainless-muted">model:</span>
		<span class="min-w-0 break-words">
			{model}
			<span class="ml-3 text-brainless-codex">/model</span>
			<span class="ml-1 text-brainless-muted">to change</span>
		</span>
		<span class="text-brainless-muted">directory:</span>
		<span class="truncate">{directory}</span>
	</div>
</div>
