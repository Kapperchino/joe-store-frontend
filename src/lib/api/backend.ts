import { dev } from '$app/environment';

export const backendBaseUrl = dev ? 'https://joe-store.fly.dev' : 'http://joe-store.internal:3000';
