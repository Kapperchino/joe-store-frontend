import { defineConfig } from 'orval';

const apiBaseUrl = 'http://joe-store:3000';

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
