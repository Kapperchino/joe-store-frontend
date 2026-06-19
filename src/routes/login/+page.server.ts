import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$env/static/private';
import { getSafeRedirect } from '$lib/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const next = getSafeRedirect(url.searchParams.get('next'));

	return {
		next,
		supabaseUrl: SUPABASE_URL,
		supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY,
		authMessage: url.searchParams.has('error')
			? 'We could not complete sign in. Please try again.'
			: null
	};
};
