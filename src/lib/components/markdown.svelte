<script lang="ts">
	import type { Action } from 'svelte/action';

	let { sanitizedHtml, highlight = '' }: { sanitizedHtml: string; highlight?: string } = $props();

	type HighlightParams = { query: string; html: string };

	function clearHighlights(node: HTMLElement): void {
		const parents: ParentNode[] = [];
		for (const mark of node.querySelectorAll('mark[data-search-highlight]')) {
			if (mark.parentNode && !parents.includes(mark.parentNode)) parents.push(mark.parentNode);
			mark.replaceWith(document.createTextNode(mark.textContent ?? ''));
		}
		for (const parent of parents) parent.normalize();
	}

	function escapedPattern(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}

	const highlightText: Action<HTMLElement, HighlightParams> = (node, params) => {
		function apply({ query }: HighlightParams): void {
			clearHighlights(node);
			const phrase = query.trim();
			if (!phrase) return;

			const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
				acceptNode(textNode) {
					const parent = textNode.parentElement;
					return parent?.closest('mark, script, style')
						? NodeFilter.FILTER_REJECT
						: NodeFilter.FILTER_ACCEPT;
				}
			});
			const textNodes: Text[] = [];
			while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

			const hasExactPhrase = textNodes.some((textNode) =>
				textNode.data.toLocaleLowerCase().includes(phrase.toLocaleLowerCase())
			);
			const terms = hasExactPhrase
				? [phrase]
				: [...new Set(phrase.split(/\s+/).filter((term) => term.length > 1))];
			if (terms.length === 0) return;

			const pattern = new RegExp(
				terms.sort((a, b) => b.length - a.length).map(escapedPattern).join('|'),
				'giu'
			);

			for (const textNode of textNodes) {
				const matches = [...textNode.data.matchAll(pattern)];
				if (matches.length === 0) continue;

				const fragment = document.createDocumentFragment();
				let offset = 0;
				for (const match of matches) {
					const index = match.index ?? 0;
					fragment.append(textNode.data.slice(offset, index));
					const mark = document.createElement('mark');
					mark.dataset.searchHighlight = '';
					mark.textContent = match[0];
					fragment.append(mark);
					offset = index + match[0].length;
				}
				fragment.append(textNode.data.slice(offset));
				textNode.replaceWith(fragment);
			}
		}

		apply(params);
		return {
			update: apply,
			destroy: () => clearHighlights(node)
		};
	};
</script>

<div
	class="markdown break-words leading-6"
	use:highlightText={{ query: highlight, html: sanitizedHtml }}
>
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
		border-radius: 0;
		background: var(--muted);
		padding: 0.125rem 0.25rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
		font-size: 0.875em;
	}

	.markdown :global(pre) {
		overflow-x: auto;
		border-radius: 0;
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
		border-radius: 0;
	}

	.markdown :global(hr) {
		border: 0;
		border-top: 1px solid var(--border);
	}

	.markdown :global(mark[data-search-highlight]) {
		border-radius: 0;
		background: var(--accent);
		box-shadow: 0 0 0 1px var(--ring);
		color: var(--accent-foreground);
		padding-inline: 0.125rem;
	}
</style>
