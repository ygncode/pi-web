export const strictStrikethroughRegex = /^(~~)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/;

export function configureSessionMarkdown({ marked, hljs, escapeHtml }) {
  marked.use({
    breaks: true,
    gfm: true,
    tokenizer: {
      html() {
        return undefined;
      },
      tag() {
        return undefined;
      },
      del(src) {
        const match = strictStrikethroughRegex.exec(src);
        if (!match) return undefined;
        return {
          type: 'del',
          raw: match[0],
          text: match[2],
          tokens: this.lexer.inlineTokens(match[2])
        };
      }
    },
    renderer: {
      link(token) {
        const href = (token.href || '').trim();
        if (/^\s*(javascript|vbscript|data):/i.test(href)) {
          return this.parser.parseInline(token.tokens);
        }
        let out = '<a href="' + escapeHtml(href) + '"';
        if (token.title) {
          out += ' title="' + escapeHtml(token.title) + '"';
        }
        out += '>' + this.parser.parseInline(token.tokens) + '</a>';
        return out;
      },
      image(token) {
        const href = (token.href || '').trim();
        if (/^\s*(javascript|vbscript|data):/i.test(href)) {
          return escapeHtml(token.text || '');
        }
        let out = '<img src="' + escapeHtml(href) + '" alt="' + escapeHtml(token.text || '') + '"';
        if (token.title) {
          out += ' title="' + escapeHtml(token.title) + '"';
        }
        out += '>';
        return out;
      },
      code(token) {
        const code = token.text;
        const lang = token.lang;
        let highlighted;
        if (lang && hljs.getLanguage(lang)) {
          try {
            highlighted = hljs.highlight(code, { language: lang }).value;
          } catch {
            highlighted = escapeHtml(code);
          }
        } else {
          try {
            highlighted = hljs.highlightAuto(code).value;
          } catch {
            highlighted = escapeHtml(code);
          }
        }
        return `<pre><code class="hljs">${highlighted}</code></pre>`;
      },
      codespan(token) {
        return `<code>${escapeHtml(token.text)}</code>`;
      }
    }
  });
}

export function safeMarkedParse(text, { marked }) {
  return marked.parse(text);
}
