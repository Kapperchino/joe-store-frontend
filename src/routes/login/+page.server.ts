import { getSafeRedirect } from '$lib/auth';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

type OAuthProvider = 'google' | 'github';

function isOAuthProvider(provider: FormDataEntryValue | null): provider is OAuthProvider {
	return provider === 'google' || provider === 'github';
}

export const load: PageServerLoad = ({ locals, url }) => {
	const next = getSafeRedirect(url.searchParams.get('next'));

	if (locals.user) {
		redirect(303, next);
	}

	return {
		next,
		authMessage: url.searchParams.has('error')
			? 'We could not complete sign in. Please try again.'
			: null
	};
};

export const actions: Actions = {
	default: async ({ locals, request, url }) => {
		const formData = await request.formData();
		const provider = formData.get('provider');

		if (!isOAuthProvider(provider)) {
			return fail(400, { message: 'Choose Google or GitHub to continue.' });
		}

		const callbackUrl = new URL('/auth/callback', url.origin);
		callbackUrl.searchParams.set('next', getSafeRedirect(formData.get('next')));

		const { data, error } = await locals.supabase.auth.signInWithOAuth({
			provider,
			options: {
				redirectTo: callbackUrl.toString(),
				skipBrowserRedirect: true
			}
		});

		if (error || !data.url) {
			return fail(500, { message: 'Sign in is temporarily unavailable. Please try again.' });
		}

		redirect(303, data.url);
	}
};
