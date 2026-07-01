import { getSupabaseConfig } from '$lib/server/supabase-config';
import { createServerClient } from '@supabase/ssr';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	if (event.url.pathname === '/healthz') {
		return resolve(event);
	}

	const { supabaseUrl, supabasePublishableKey } = getSupabaseConfig();

	const authHeaders = new Headers();

	event.locals.supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookiesToSet, headers) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					event.cookies.set(name, value, { ...options, path: '/' });
				});

				Object.entries(headers).forEach(([name, value]) => authHeaders.set(name, value));
			}
		}
	});

	const {
		data: { user }
	} = await event.locals.supabase.auth.getUser();

	event.locals.user = user;

	let response = await resolve(event);

	if ([...authHeaders].length > 0) {
		response = new Response(response.body, response);
		authHeaders.forEach((value, name) => response.headers.set(name, value));
	}

	return response;
};
