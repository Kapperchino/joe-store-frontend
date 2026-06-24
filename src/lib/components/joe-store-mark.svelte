<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { cn } from '$lib/utils';
	import type { HTMLImgAttributes } from 'svelte/elements';

	type Props = HTMLImgAttributes;

	let { class: className, alt = '', ...restProps }: Props = $props();
</script>

<img
	src={favicon}
	{alt}
	class={cn('size-6 object-contain', className)}
	decoding="async"
	draggable="false"
	{...restProps}
/>
