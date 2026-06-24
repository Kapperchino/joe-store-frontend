import { grantSessionAuthorization, type AuthType } from '$lib/api';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

function bearerToken(authorization: string | null): string | null {
	if (!authorization?.startsWith('Bearer ')) return null;
	return authorization.slice('Bearer '.length).trim() || null;
}

function isGrantObject(value: unknown): value is { users: string[] } {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const users = (value as { users?: unknown }).users;
	return Array.isArray(users) && users.every((user) => typeof user === 'string');
}

function normalizeAuthType(value: unknown): AuthType | null {
	if (value === 'public' || value === 'private') return value;
	if (!isGrantObject(value)) return null;

	const users = [...new Set(value.users.map((user) => user.trim()).filter(Boolean))];
	return users.length > 0 ? { users } : null;
}

export const PUT: RequestHandler = async ({ locals, params, request }) => {
	if (!/^\d+$/.test(params.id)) {
		return json({ error: 'The session ID must be a positive integer.' }, { status: 400 });
	}

	const sessionId = Number(params.id);
	if (!Number.isSafeInteger(sessionId)) {
		return json({ error: 'The session ID is outside the supported range.' }, { status: 400 });
	}

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

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'A JSON request body is required.' }, { status: 400 });
	}

	const authType =
		typeof body === 'object' && body !== null && !Array.isArray(body)
			? normalizeAuthType((body as { auth_type?: unknown }).auth_type)
			: null;
	if (!authType) {
		return json({ error: 'Choose public, private, or at least one user to share with.' }, { status: 400 });
	}

	try {
		const response = await grantSessionAuthorization(
			sessionId,
			{ auth_type: authType },
			{ headers: { Authorization: `Bearer ${accessToken}` } }
		);
		return json(response.data, { status: response.status });
	} catch {
		return json(
			{ error: 'Joe Store could not reach the session service. Please try again shortly.' },
			{ status: 502 }
		);
	}
};
