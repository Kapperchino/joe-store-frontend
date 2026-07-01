import { env } from '$env/dynamic/private';

export function getSupabaseConfig() {
	const supabaseUrl = env.SUPABASE_URL;
	const supabasePublishableKey = env.SUPABASE_PUBLISHABLE_KEY;

	if (!supabaseUrl || !supabasePublishableKey) {
		throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be configured.');
	}

	return { supabaseUrl, supabasePublishableKey };
}
