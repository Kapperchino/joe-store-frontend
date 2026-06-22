import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '$env/static/private';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({
	supabaseUrl: SUPABASE_URL,
	supabasePublishableKey: SUPABASE_PUBLISHABLE_KEY
});
