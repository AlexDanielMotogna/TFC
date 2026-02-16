'use client';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocsTableOfContentsProps {
  headings: Heading[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function DocsTableOfContents({
  headings,
  activeId,
  onSelect,
}: DocsTableOfContentsProps) {
  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-52 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto">
      <div className="px-4 py-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-surface-500 mb-3">
          On this page
        </p>
        <nav className="space-y-1">
          {headings.map((heading) => (
            <button
              key={heading.id}
              onClick={() => onSelect(heading.id)}
              className={`
                block w-full text-left text-xs py-1.5 pl-3 border-l transition-colors
                ${
                  activeId === heading.id
                    ? 'border-primary-500 text-primary-400'
                    : 'border-surface-700 text-surface-400 hover:text-surface-200 hover:border-surface-500'
                }
              `}
            >
              {heading.text}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
