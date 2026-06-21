<script lang="ts">
	import CircleCheckIcon from '@lucide/svelte/icons/circle-check';
	import CircleXIcon from '@lucide/svelte/icons/circle-x';
	import BellIcon from '@lucide/svelte/icons/bell';
	import type { NotificationView } from './session-view';

	let { notification }: { notification: NotificationView } = $props();

	const status = $derived(notification.status?.toLowerCase());
	const failed = $derived(status === 'failed' || status === 'error');
	const succeeded = $derived(status === 'completed' || status === 'success' || status === 'done');
</script>

<div
	class="flex items-center gap-2 text-xs font-medium {failed
		? 'text-destructive'
		: 'text-muted-foreground'}"
>
	{#if failed}
		<CircleXIcon class="size-3.5 shrink-0" aria-hidden="true" />
	{:else if succeeded}
		<CircleCheckIcon class="size-3.5 shrink-0 text-green-700 dark:text-green-400" aria-hidden="true" />
	{:else}
		<BellIcon class="size-3.5 shrink-0" aria-hidden="true" />
	{/if}
	<span class="min-w-0 truncate">{notification.summary ?? 'Task notification'}</span>
</div>
