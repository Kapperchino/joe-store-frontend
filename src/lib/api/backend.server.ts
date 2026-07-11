import { env } from '$env/dynamic/private';

const defaultBackendBaseUrl = 'https://joe-store.fly.dev';

export const backendBaseUrl = (env.JOESTORE_API_BASE_URL || defaultBackendBaseUrl).replace(
	/\/+$/,
	''
);
