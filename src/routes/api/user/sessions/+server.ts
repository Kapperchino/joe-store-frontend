import { getUserSessions } from '$lib/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function bearerToken(authorization: string | null): string | null {
	if (!authorization?.startsWith('Bearer ')) return null;
	return authorization.slice('Bearer '.length).trim() || null;
}

export const GET: RequestHandler = async ({ request, locals }) => {
	const accessToken = bearerToken(request.headers.get('authorization'));
	if (!accessToken) {
		return json({ error: 'Authentication is required.' }, { status: 401 });
	}

	const {
		data: { user },
		error: authError
	} = await locals.supabase.auth.getUser(accessToken);

	if (authError || !user) {
		return json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
	}

	try {
		const response = await getUserSessions(user.id);
		return json(response.data, { status: response.status });
	} catch {
		return json(
			{ error: 'Joe Store could not reach the session service. Please try again shortly.' },
			{ status: 502 }
		);
	}
};
