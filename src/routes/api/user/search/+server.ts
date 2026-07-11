import { getSession, search } from '$lib/api';
import { renderMarkdown } from '$lib/server/markdown';
import {
	searchChunkEntryIndex,
	searchChunkMatchedText,
	searchChunkSessionId,
	searchTextExcerpt
} from '$lib/search';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createSessionView, type SessionMessageView, type SessionView } from '../../../session/[id]/session-view';

function bearerToken(authorization: string | null): string | null {
	if (!authorization?.startsWith('Bearer ')) return null;
	return authorization.slice('Bearer '.length).trim() || null;
}

function fallbackMessage(messages: SessionMessageView[], passage: string): SessionMessageView | null {
	const terms = [...new Set(passage.toLocaleLowerCase().match(/[\p{L}\p{N}_-]{3,}/gu) ?? [])].slice(
		0,
		100
	);
	const best = messages
		.map((message) => ({
			message,
			score: terms.reduce(
				(score, term) => score + (message.text?.toLocaleLowerCase().includes(term) ? term.length : 0),
				0
			)
		}))
		.sort((a, b) => b.score - a.score)[0];
	return best && best.score > 0 ? best.message : null;
}

export const GET: RequestHandler = async ({ request, url, locals }) => {
	const accessToken = bearerToken(request.headers.get('authorization'));
	if (!accessToken) {
		return json({ error: 'Authentication is required.' }, { status: 401 });
	}

	const query = url.searchParams.get('query')?.trim();
	if (!query) {
		return json({ error: 'Enter a search query.' }, { status: 400 });
	}

	const {
		data: { user },
		error: authError
	} = await locals.supabase.auth.getUser(accessToken);

	if (authError || !user) {
		return json({ error: 'Your session has expired. Please sign in again.' }, { status: 401 });
	}

	try {
		const response = await search(
			{ query },
			{ headers: { Authorization: `Bearer ${accessToken}` } }
		);
		if (response.status === 200) {
			const sessionViews = new Map<number, Promise<SessionView | null>>();
			const loadSessionView = (sessionId: number): Promise<SessionView | null> => {
				const existing = sessionViews.get(sessionId);
				if (existing) return existing;

				const pending = getSession(sessionId, {
					headers: { Authorization: `Bearer ${accessToken}` }
				})
					.then((sessionResponse) =>
						sessionResponse.status === 200
							? createSessionView(sessionResponse.data.session)
							: null
					)
					.catch(() => null);
				sessionViews.set(sessionId, pending);
				return pending;
			};

			const chunks = await Promise.all(
				(response.data.chunks ?? []).map(async (chunk) => {
					const passage = searchChunkMatchedText(chunk, query);
					const sessionId = searchChunkSessionId(chunk);
					const sessionView = sessionId === null ? null : await loadSessionView(sessionId);
					const entryIndex = searchChunkEntryIndex(chunk, query);
					const message =
						(entryIndex === null
							? null
							: sessionView?.messages.find((candidate) =>
									candidate.sourceIndexes.includes(entryIndex)
								)) ??
						(sessionView ? fallbackMessage(sessionView.messages, passage) : null);
					if (!message?.text) return null;
					const excerpt = searchTextExcerpt(message.text, query);

					return {
						...chunk,
						excerpt,
						html: renderMarkdown(excerpt),
						...(message ? { role: message.role, timestamp: message.timestamp } : {})
					};
				})
			).then((results) => results.filter((chunk) => chunk !== null));

			return json(
				{
					...response.data,
					chunks
				},
				{ status: response.status }
			);
		}
		return json(response.data, { status: response.status });
	} catch {
		return json(
			{ error: 'Joe Store could not reach the search service. Please try again shortly.' },
			{ status: 502 }
		);
	}
};
