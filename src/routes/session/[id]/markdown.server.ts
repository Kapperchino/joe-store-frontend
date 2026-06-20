import MarkdownIt from 'markdown-it';
import sanitizeHtml from 'sanitize-html';

const markdown = new MarkdownIt({
	breaks: true,
	html: false,
	linkify: true
});

export function renderMarkdown(source: string): string {
	return sanitizeHtml(markdown.render(source), {
		allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img'],
		allowedAttributes: sanitizeHtml.defaults.allowedAttributes
	});
}
