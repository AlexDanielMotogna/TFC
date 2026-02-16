'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronLeft, Menu, X } from 'lucide-react';
import { DocsSidebar } from './DocsSidebar';
import { DocsTableOfContents } from './DocsTableOfContents';
import { DocsContent } from './DocsContent';

interface Heading {
  id: string;
  text: string;
  level: number;
}

interface DocsLayoutProps {
  content: string;
  headings: Heading[];
}

export function DocsLayout({ content, headings }: DocsLayoutProps) {
  const [activeId, setActiveId] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // IntersectionObserver to track which section is visible
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible.length > 0) {
          setActiveId(visible[0]!.target.id);
        }
      },
      {
        rootMargin: '-80px 0px -70% 0px',
        threshold: 0,
      }
    );

    headings.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [headings]);

  const scrollToHeading = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setSidebarOpen(false);
    }
  }, []);

  // h2s for the left sidebar
  const sidebarHeadings = headings.filter((h) => h.level === 2);

  // Find the active h2 (could be the activeId itself or its parent)
  const activeH2 = headings.find((h, i) => {
    if (h.level !== 2) return false;
    const nextH2Index = headings.findIndex(
      (next, j) => j > i && next.level === 2
    );
    const children = headings.slice(
      i + 1,
      nextH2Index === -1 ? undefined : nextH2Index
    );
    return h.id === activeId || children.some((c) => c.id === activeId);
  });

  // h3s under the active h2 for the right TOC
  const tocHeadings = activeH2
    ? headings.filter((h, i) => {
        if (h.level !== 3) return false;
        const parentIndex = headings.indexOf(activeH2);
        const nextH2Index = headings.findIndex(
          (next, j) => j > parentIndex && next.level === 2
        );
        return i > parentIndex && (nextH2Index === -1 || i < nextH2Index);
      })
    : [];

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      {/* Top header bar */}
      <header className="sticky top-0 z-30 bg-surface-900/95 backdrop-blur-sm border-b border-surface-800">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-400 hover:text-white transition-colors text-sm"
            >
              <ChevronLeft size={16} />
              Back to Home
            </Link>
          </div>
          <h1 className="text-sm font-semibold text-surface-200">
            Documentation
          </h1>
        </div>
      </header>

      {/* Three-column layout */}
      <div className="flex">
        <DocsSidebar
          headings={sidebarHeadings}
          activeId={activeH2?.id || activeId}
          onSelect={scrollToHeading}
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-w-0 px-6 lg:px-12 py-8 max-w-4xl mx-auto">
          <DocsContent content={content} />
        </main>

        <DocsTableOfContents
          headings={tocHeadings}
          activeId={activeId}
          onSelect={scrollToHeading}
        />
      </div>
    </div>
  );
}
