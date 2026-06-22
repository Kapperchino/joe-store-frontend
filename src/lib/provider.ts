import type { ProviderType } from '$lib/api';

const providerLabels: Record<ProviderType, string> = {
	openai: 'OpenAI',
	claude: 'Claude',
	cursor: 'Cursor'
};

export function providerLabel(provider: ProviderType): string {
	return providerLabels[provider];
}
