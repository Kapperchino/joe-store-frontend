import { getSafeRedirect } from '$lib/auth';
import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
	const code = url.searchParams.get('code');
	const next = getSafeRedirect(url.searchParams.get('next'));

	if (!code) {
		redirect(303, '/login?error=oauth_callback');
	}

	const { error } = await locals.supabase.auth.exchangeCodeForSession(code);

	if (error) {
		redirect(303, '/login?error=oauth_callback');
	}

	redirect(303, next);
};
