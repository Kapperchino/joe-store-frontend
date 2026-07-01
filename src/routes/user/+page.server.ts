import { getSupabaseConfig } from '$lib/server/supabase-config';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => getSupabaseConfig();
