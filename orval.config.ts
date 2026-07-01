import { defineConfig } from 'orval';

const apiBaseUrl = 'https://joe-store.fly.dev';

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
			baseUrl: {
				runtime: 'backendBaseUrl',
				imports: [{ name: 'backendBaseUrl', importPath: '$lib/api/backend' }]
			},
			clean: true
		}
	}
});
