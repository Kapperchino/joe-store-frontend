import { getSafeRedirect } from '$lib/auth';
import { getSupabaseConfig } from '$lib/server/supabase-config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const next = getSafeRedirect(url.searchParams.get('next'));
	const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

	return {
		next,
		supabaseUrl,
		supabasePublishableKey,
		authMessage: url.searchParams.has('error')
			? 'We could not complete sign in. Please try again.'
			: null
	};
};
