'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSlug from 'rehype-slug';
import { markdownComponents } from './MarkdownComponents';

interface DocsContentProps {
  content: string;
}

export function DocsContent({ content }: DocsContentProps) {
  // Strip the manual "## Table of Contents" section since our sidebar replaces it
  const processedContent = content.replace(
    /## Table of Contents[\s\S]*?(?=\n---\n)/,
    ''
  );

  return (
    <article>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </article>
  );
}
