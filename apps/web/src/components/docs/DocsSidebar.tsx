'use client';

import { BookOpen } from 'lucide-react';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocsSidebarProps {
  headings: Heading[];
  activeId: string;
  onSelect: (id: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function DocsSidebar({
  headings,
  activeId,
  onSelect,
  mobileOpen,
  onMobileClose,
}: DocsSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`
          w-64 flex-shrink-0 border-r border-surface-800
          fixed lg:sticky top-14 left-0 z-50 lg:z-auto
          h-[calc(100vh-3.5rem)] overflow-y-auto
          bg-surface-900 lg:bg-transparent
          transition-transform duration-200 lg:transition-none
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Section header */}
        <div className="px-4 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2 text-surface-300 text-xs font-semibold uppercase tracking-wider">
            <BookOpen size={14} />
            User Guide
          </div>
        </div>

        {/* Navigation links */}
        <nav className="px-3 py-3 space-y-0.5">
          {headings
            .filter((h) => h.text !== 'Table of Contents')
            .map((heading) => (
              <button
                key={heading.id}
                onClick={() => onSelect(heading.id)}
                className={`
                  w-full text-left px-3 py-2 rounded text-sm transition-colors
                  ${
                    activeId === heading.id
                      ? 'bg-primary-500/10 text-primary-400 border-l-2 border-primary-500'
                      : 'text-surface-400 hover:text-white hover:bg-surface-800'
                  }
                `}
              >
                {heading.text}
              </button>
            ))}
        </nav>
      </aside>
    </>
  );
}
