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

const CLI_LOGIN_STORAGE_KEYS = {
	redirect: 'joe-store.cli.redirect',
	state: 'joe-store.cli.state'
} as const;

function isLoopbackCallback(raw: string): boolean {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}

	return (
		url.protocol === 'http:' &&
		(url.hostname === '127.0.0.1' || url.hostname === 'localhost') &&
		url.pathname === '/callback'
	);
}

// A CLI (e.g. the joe-store upload-session skill) can request a loopback login by
// opening /login with `cli_redirect=http://127.0.0.1:<port>/callback` and a random
// `state`. We stash the request in sessionStorage so it survives the OAuth provider
// round-trip. Only loopback (127.0.0.1 / localhost) callbacks are accepted — this is
// the guard that stops the access token from being redirected to a remote origin.
export function captureCliLoginRequest(search: string): void {
	if (!browser) return;

	const params = new URLSearchParams(search);
	const redirect = params.get('cli_redirect');
	if (!redirect || !isLoopbackCallback(redirect)) return;

	sessionStorage.setItem(CLI_LOGIN_STORAGE_KEYS.redirect, redirect);
	sessionStorage.setItem(CLI_LOGIN_STORAGE_KEYS.state, params.get('state') ?? '');
}

// Consumes a pending CLI login request and returns the loopback callback URL with
// the access token (and echoed state) attached, or null if none is pending.
export function takeCliLoginRedirect(session: Session): string | null {
	if (!browser) return null;

	const redirect = sessionStorage.getItem(CLI_LOGIN_STORAGE_KEYS.redirect);
	const state = sessionStorage.getItem(CLI_LOGIN_STORAGE_KEYS.state);
	if (!redirect || !state || !isLoopbackCallback(redirect)) return null;

	sessionStorage.removeItem(CLI_LOGIN_STORAGE_KEYS.redirect);
	sessionStorage.removeItem(CLI_LOGIN_STORAGE_KEYS.state);

	const callback = new URL(redirect);
	callback.searchParams.set('access_token', session.access_token);
	callback.searchParams.set('state', state);
	return callback.toString();
}
