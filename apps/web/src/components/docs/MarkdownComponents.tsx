import type { Components } from 'react-markdown';

export const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-3xl font-bold text-white mb-6 mt-2">{children}</h1>
  ),

  h2: ({ children, id, ...props }) => (
    <h2
      id={id}
      className="text-2xl font-bold text-white mt-16 mb-6 pb-3 border-b border-surface-800 scroll-mt-20 first:mt-0"
      {...props}
    >
      <span className="border-l-4 border-primary-500 pl-3">{children}</span>
    </h2>
  ),

  h3: ({ children, id, ...props }) => (
    <h3
      id={id}
      className="text-lg font-semibold text-surface-100 mt-10 mb-4 scroll-mt-20"
      {...props}
    >
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p className="text-surface-300 leading-relaxed mb-4">{children}</p>
  ),

  hr: () => <hr className="border-surface-800 my-12" />,

  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary-500/50 pl-4 my-6 text-surface-400 italic">
      {children}
    </blockquote>
  ),

  ul: ({ children }) => (
    <ul className="list-disc pl-6 space-y-2 mb-6 text-surface-300">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="list-decimal pl-6 space-y-2 mb-6 text-surface-300">
      {children}
    </ol>
  ),

  li: ({ children }) => <li className="leading-relaxed">{children}</li>,

  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),

  em: ({ children }) => (
    <em className="italic text-surface-200">{children}</em>
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
      className="text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
    >
      {children}
    </a>
  ),

  code: ({ children, className }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return <code className={`${className} block`}>{children}</code>;
    }
    return (
      <code className="bg-surface-800 text-primary-300 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="bg-surface-800/50 border border-surface-800 rounded-lg p-4 mb-6 overflow-x-auto text-sm font-mono text-surface-200">
      {children}
    </pre>
  ),

  table: ({ children }) => (
    <div className="overflow-x-auto mb-6 rounded-lg border border-surface-800">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-surface-800">{children}</thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-surface-800">{children}</tbody>
  ),

  tr: ({ children }) => (
    <tr className="hover:bg-surface-800/30 transition-colors">{children}</tr>
  ),

  th: ({ children }) => (
    <th className="px-4 py-3 text-left text-xs font-semibold text-surface-300 uppercase tracking-wider">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="px-4 py-3 text-surface-300">{children}</td>
  ),
};
