import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './MarkdownRenderer.css';

/**
 * Shared markdown renderer — single source of truth for both /study (Flashcard)
 * and /edit (CreateDeck live preview).
 *
 * All markdown element styles (headings, code, blockquote, table, katex, …)
 * live in MarkdownRenderer.css under the `.md-render` class.
 * Context-specific layout (text-align, scroll container, font family) is
 * handled by each parent component's own CSS.
 *
 * @param {string}  children    Markdown source string to render.
 * @param {string}  [fontSize]  CSS font-size value (e.g. "1.8rem").
 *                              Only set in /study via the font-size slider — this
 *                              is the one thing that differs between pages.
 * @param {string}  [className] Extra class name(s) for context-specific overrides
 *                              (e.g. "card-front-title" or "card-back-answer").
 * @param {object}  [style]     Extra inline styles merged onto the root div.
 */
export default function MarkdownRenderer({ children = '', fontSize, className = '', style = {} }) {
  const rootStyle = fontSize ? { fontSize, ...style } : (Object.keys(style).length ? style : undefined);

  return (
    <div className={`md-render${className ? ` ${className}` : ''}`} style={rootStyle}>
      <ReactMarkdown remarkPlugins={[remarkMath, remarkGfm]} rehypePlugins={[rehypeKatex]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
