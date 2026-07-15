<script lang="ts">
	import type { ProviderType } from '$lib/api';
	import ClaudeHeader from './claude/claude-header.svelte';
	import CodexHeader from './codex/codex-header.svelte';

	type Property = { label: string; value: string; mono?: boolean };

	let {
		provider,
		model,
		cwd,
		branch,
		properties = []
	}: {
		provider: ProviderType;
		model?: string;
		cwd?: string;
		branch?: string;
		properties?: Property[];
	} = $props();

	const detailLines = $derived(properties.map((property) => `${property.label}: ${property.value}`));
</script>

{#if provider === 'claude'}
	<ClaudeHeader
		model={model ?? 'Unknown model'}
		org={branch ? `Branch: ${branch}` : 'Captured by Joe Store'}
		cwd={cwd ?? 'Directory not recorded'}
		details={detailLines}
	/>
{:else}
	<CodexHeader
		model={model ?? 'Unknown model'}
		directory={cwd ?? 'Directory not recorded'}
		product={provider === 'cursor' ? 'Cursor Agent' : 'OpenAI Codex'}
		mark={provider === 'cursor' ? '↗' : '>_'}
	/>
{/if}
