import fs from 'fs';
import path from 'path';
import { DocsLayout } from '@/components/docs/DocsLayout';

export const metadata = {
  title: 'Documentation - Trading Fight Club',
  description:
    'Complete user guide for Trading Fight Club — competitive 1v1 trading platform on Pacifica DEX.',
};

interface Heading {
  id: string;
  text: string;
  level: number;
}

function extractHeadings(markdown: string): Heading[] {
  const headingRegex = /^(#{2,3})\s+(.+)$/gm;
  const headings: Heading[] = [];
  let match;

  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    headings.push({ id, text, level });
  }

  return headings;
}

export default function DocsPage() {
  const filePath = path.join(
    process.cwd(),
    '../../docs/AppDocumentationPage/Documentation.md'
  );
  const content = fs.readFileSync(filePath, 'utf-8');
  const headings = extractHeadings(content);

  return <DocsLayout content={content} headings={headings} />;
}
