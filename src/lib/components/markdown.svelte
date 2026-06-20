<script lang="ts">
	let { sanitizedHtml }: { sanitizedHtml: string } = $props();
</script>

<div class="markdown break-words leading-6">
	<!-- Content is sanitized by the server-side Markdown renderer before serialization. -->
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html sanitizedHtml}
</div>

<style>
	.markdown :global(> :first-child) {
		margin-top: 0;
	}

	.markdown :global(> :last-child) {
		margin-bottom: 0;
	}

	.markdown :global(p),
	.markdown :global(ul),
	.markdown :global(ol),
	.markdown :global(blockquote),
	.markdown :global(pre),
	.markdown :global(table),
	.markdown :global(hr) {
		margin-block: 0.75rem;
	}

	.markdown :global(h1),
	.markdown :global(h2),
	.markdown :global(h3),
	.markdown :global(h4),
	.markdown :global(h5),
	.markdown :global(h6) {
		margin-block: 1.25rem 0.5rem;
		font-weight: 600;
		line-height: 1.25;
	}

	.markdown :global(h1) {
		font-size: 1.5rem;
	}

	.markdown :global(h2) {
		font-size: 1.25rem;
	}

	.markdown :global(h3) {
		font-size: 1.125rem;
	}

	.markdown :global(ul),
	.markdown :global(ol) {
		padding-left: 1.5rem;
	}

	.markdown :global(ul) {
		list-style: disc;
	}

	.markdown :global(ol) {
		list-style: decimal;
	}

	.markdown :global(li + li) {
		margin-top: 0.25rem;
	}

	.markdown :global(a) {
		color: var(--primary);
		text-decoration: underline;
		text-underline-offset: 0.2em;
	}

	.markdown :global(blockquote) {
		border-left: 0.25rem solid var(--border);
		padding-left: 1rem;
		color: var(--muted-foreground);
	}

	.markdown :global(code) {
		border-radius: 0.25rem;
		background: var(--muted);
		padding: 0.125rem 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
		font-size: 0.875em;
	}

	.markdown :global(pre) {
		overflow-x: auto;
		border-radius: var(--radius);
		background: var(--muted);
		padding: 1rem;
	}

	.markdown :global(pre code) {
		background: transparent;
		padding: 0;
		font-size: 0.75rem;
		line-height: 1.25rem;
	}

	.markdown :global(table) {
		display: block;
		max-width: 100%;
		overflow-x: auto;
		border-collapse: collapse;
	}

	.markdown :global(th),
	.markdown :global(td) {
		border: 1px solid var(--border);
		padding: 0.5rem 0.75rem;
		text-align: left;
	}

	.markdown :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: var(--radius);
	}

	.markdown :global(hr) {
		border: 0;
		border-top: 1px solid var(--border);
	}
</style>
