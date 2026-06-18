export function getSafeRedirect(path: FormDataEntryValue | string | null | undefined): string {
	if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
		return '/';
	}

	return path;
}
