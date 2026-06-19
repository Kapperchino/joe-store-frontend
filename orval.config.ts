import { defineConfig } from 'orval';

const apiBaseUrl = 'https://joe-store.onrender.com';

export default defineConfig({
	joeStore: {
		input: {
			target: `${apiBaseUrl}/openapi.json`
		},
		output: {
			target: './src/lib/api/generated/client',
			schemas: './src/lib/api/generated/models',
			client: 'fetch',
			mode: 'split',
			baseUrl: apiBaseUrl,
			clean: true
		}
	}
});
