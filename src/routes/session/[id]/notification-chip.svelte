<script lang="ts">
	import type { ProviderType } from '$lib/api';
	import { cn } from '$lib/utils';
	import type { NotificationView } from './session-view';

	let {
		notification,
		provider
	}: { notification: NotificationView; provider: ProviderType } = $props();

	const status = $derived(notification.status?.toLowerCase());
	const failed = $derived(status === 'failed' || status === 'error');
	const succeeded = $derived(status === 'completed' || status === 'success' || status === 'done');
</script>

<div class="flex min-w-0 items-baseline gap-2 font-mono text-[13px] leading-[1.55]">
	<span
		aria-hidden="true"
		class={cn(
			'shrink-0',
			failed
				? 'text-brainless-error'
				: succeeded
					? 'text-brainless-success'
					: 'text-brainless-warning'
		)}
	>
		{provider === 'claude' ? '⏺' : '•'}
	</span>
	<span class={cn('min-w-0 truncate', failed ? 'text-brainless-error' : 'text-brainless-muted')}>
		{notification.summary ?? 'Task notification'}
	</span>
</div>
