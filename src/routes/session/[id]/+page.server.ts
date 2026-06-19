import { getSession } from '$lib/api';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createSessionView } from './session-view';

export const load: PageServerLoad = async ({ params }) => {
	if (!/^\d+$/.test(params.id)) {
		error(400, 'The session ID must be a positive integer.');
	}

	const sessionId = Number(params.id);
	if (!Number.isSafeInteger(sessionId)) {
		error(400, 'The session ID is outside the supported range.');
	}

	let response: Awaited<ReturnType<typeof getSession>>;
	try {
		response = await getSession(sessionId);
	} catch {
		error(502, 'Joe Store could not reach the session service. Please try again shortly.');
	}

	if (response.status === 200) {
		return { sessionId: params.id, session: createSessionView(response.data.session) };
	}

	const backendMessage = 'error' in response.data ? response.data.error : undefined;
	const responseStatus: number = response.status;
	if (responseStatus === 401) {
		error(401, backendMessage || 'You are not authorized to view this session.');
	}
	if (responseStatus === 404) {
		error(404, backendMessage || 'Session not found.');
	}

	error(502, backendMessage || 'The session service returned an unexpected response.');
};
