import { browser } from '$app/environment';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

const AUTH_SESSION_STORAGE_KEY = 'joe-store.auth.session';

export const AUTH_TOKEN_STORAGE_KEYS = {
	accessToken: 'joe-store.auth.access-token',
	refreshToken: 'joe-store.auth.refresh-token'
} as const;

let browserClient: SupabaseClient | undefined;

export function getSafeRedirect(path: FormDataEntryValue | string | null | undefined): string {
	if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) {
		return '/';
	}

	return path;
}

export function getBrowserSupabaseClient(url: string, publishableKey: string): SupabaseClient {
	if (!browser) {
		throw new Error('The browser Supabase client is only available in the browser.');
	}

	browserClient ??= createClient(url, publishableKey, {
		auth: {
			autoRefreshToken: true,
			detectSessionInUrl: true,
			persistSession: true,
			storageKey: AUTH_SESSION_STORAGE_KEY
		}
	});

	return browserClient;
}

export function storeAuthTokens(session: Session | null): void {
	if (!browser) return;

	if (!session) {
		localStorage.removeItem(AUTH_TOKEN_STORAGE_KEYS.accessToken);
		localStorage.removeItem(AUTH_TOKEN_STORAGE_KEYS.refreshToken);
		return;
	}

	localStorage.setItem(AUTH_TOKEN_STORAGE_KEYS.accessToken, session.access_token);
	localStorage.setItem(AUTH_TOKEN_STORAGE_KEYS.refreshToken, session.refresh_token);
}

export function getStoredAccessToken(): string | null {
	return browser ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEYS.accessToken) : null;
}

export function getStoredRefreshToken(): string | null {
	return browser ? localStorage.getItem(AUTH_TOKEN_STORAGE_KEYS.refreshToken) : null;
}

export function withStoredAccessToken(options: RequestInit = {}): RequestInit {
	const accessToken = getStoredAccessToken();
	if (!accessToken) return options;

	const headers = new Headers(options.headers);
	headers.set('Authorization', `Bearer ${accessToken}`);

	return { ...options, headers };
}
