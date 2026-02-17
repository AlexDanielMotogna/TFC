'use client';

import React from 'react';

interface DocsContentProps {
  content: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

/** Parse inline markdown: **bold**, *italic*, `code`, [links](url) */
function parseInline(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Match **bold**, *italic*, `code`, [text](url)
  const inlineRegex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
  let lastIndex = 0;
  let match;

  while ((match = inlineRegex.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      // **bold**
      nodes.push(
        <strong key={match.index} className="font-semibold text-white">
          {match[2]}
        </strong>
      );
    } else if (match[3]) {
      // *italic*
      nodes.push(
        <em key={match.index} className="italic text-surface-200">
          {match[3]}
        </em>
      );
    } else if (match[4]) {
      // `code`
      nodes.push(
        <code
          key={match.index}
          className="bg-surface-800 text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono"
        >
          {match[4]}
        </code>
      );
    } else if (match[5] && match[6]) {
      // [text](url)
      const isExternal = match[6].startsWith('http');
      nodes.push(
        <a
          key={match.index}
          href={match[6]}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
        >
          {match[5]}
        </a>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length > 0 ? nodes : [text];
}

/** Parse a markdown table block into JSX */
function parseTable(lines: string[]): React.ReactNode {
  // First line = headers, second line = separator, rest = rows
  const headers = lines[0]!
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  const rows = lines.slice(2).map((line) =>
    line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
  );

  return (
    <div className="overflow-x-auto mb-6 rounded-lg border border-surface-800">
      <table className="w-full text-sm">
        <thead className="bg-surface-800">
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-4 py-3 text-left text-xs font-semibold text-surface-300 uppercase tracking-wider"
              >
                {parseInline(h)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-surface-800">
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="hover:bg-surface-800/30 transition-colors"
            >
              {row.map((cell, ci) => (
                <td key={ci} className="px-4 py-3 text-surface-300">
                  {parseInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Main markdown-to-JSX parser */
function renderMarkdown(markdown: string): React.ReactNode[] {
  const lines = markdown.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    // Skip empty lines
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={key++} className="border-surface-800 my-12" />);
      i++;
      continue;
    }

    // Fenced code block (```language ... ```)
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      i++; // skip closing ```
      elements.push(
        <div key={key++} className="mb-6 rounded-lg border border-surface-800 overflow-hidden">
          {lang && (
            <div className="bg-surface-800 px-4 py-2 text-xs font-mono text-surface-400 border-b border-surface-700">
              {lang}
            </div>
          )}
          <pre className="bg-surface-900 p-4 overflow-x-auto">
            <code className="text-sm font-mono text-surface-200 leading-relaxed">
              {codeLines.join('\n')}
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // Headings
    if (line.startsWith('# ') && !line.startsWith('## ')) {
      const text = line.slice(2).trim();
      elements.push(
        <h1 key={key++} className="text-3xl font-bold text-white mb-6 mt-2">
          {parseInline(text)}
        </h1>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      const id = slugify(text);
      elements.push(
        <h2
          key={key++}
          id={id}
          className="text-2xl font-bold text-white mt-16 mb-6 pb-3 border-b border-surface-800 scroll-mt-20 first:mt-0"
        >
          <span className="border-l-4 border-primary-500 pl-3">
            {parseInline(text)}
          </span>
        </h2>
      );
      i++;
      continue;
    }

    if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      const id = slugify(text);
      elements.push(
        <h3
          key={key++}
          id={id}
          className="text-lg font-semibold text-surface-100 mt-10 mb-4 scroll-mt-20"
        >
          {parseInline(text)}
        </h3>
      );
      i++;
      continue;
    }

    // Table (lines starting with |)
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) {
        tableLines.push(lines[i]!);
        i++;
      }
      elements.push(
        <React.Fragment key={key++}>{parseTable(tableLines)}</React.Fragment>
      );
      continue;
    }

    // Ordered list (lines starting with number.)
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i]!)) {
        items.push(lines[i]!.replace(/^\d+\.\s/, ''));
        i++;
      }
      elements.push(
        <ol key={key++} className="list-decimal pl-6 space-y-2 mb-6 text-surface-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Unordered list (lines starting with -)
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('- ')) {
        items.push(lines[i]!.slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} className="list-disc pl-6 space-y-2 mb-6 text-surface-300">
          {items.map((item, idx) => (
            <li key={idx} className="leading-relaxed">
              {parseInline(item)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Regular paragraph (collect consecutive non-empty, non-special lines)
    {
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i]!.trim() !== '' &&
        !lines[i]!.startsWith('#') &&
        !lines[i]!.startsWith('- ') &&
        !/^\d+\.\s/.test(lines[i]!) &&
        !lines[i]!.trim().startsWith('|') &&
        !/^---+$/.test(lines[i]!.trim())
      ) {
        paraLines.push(lines[i]!);
        i++;
      }
      if (paraLines.length > 0) {
        elements.push(
          <p key={key++} className="text-surface-300 leading-relaxed mb-4">
            {parseInline(paraLines.join(' '))}
          </p>
        );
      }
    }
  }

  return elements;
}

export function DocsContent({ content }: DocsContentProps) {
  // Strip the "## Table of Contents" section
  const processedContent = content.replace(
    /## Table of Contents[\s\S]*?(?=\n---\n)/,
    ''
  );

  return <article>{renderMarkdown(processedContent)}</article>;
}
