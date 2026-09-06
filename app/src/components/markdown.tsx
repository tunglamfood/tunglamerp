"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * The assistant answers in Markdown — bold, tables, lists. Shown as plain text
 * those arrive as literal asterisks and pipe characters, which reads as broken.
 * This renders them, styled to match the rest of the system rather than to a
 * browser's defaults.
 */
export function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          strong: ({ children }) => <strong className="font-bold text-ink">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          h1: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-extrabold tracking-tight first:mt-0">
              {children}
            </h3>
          ),
          h2: ({ children }) => (
            <h3 className="mb-2 mt-4 text-[15px] font-bold tracking-tight first:mt-0">
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4 className="mb-1.5 mt-3.5 text-sm font-bold tracking-tight first:mt-0">
              {children}
            </h4>
          ),
          ul: ({ children }) => (
            <ul className="mb-3 ml-1 space-y-1 last:mb-0">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mb-3 ml-5 list-decimal space-y-1 last:mb-0">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-faint" />
              <span className="min-w-0 flex-1">{children}</span>
            </li>
          ),
          // Wide tables scroll inside their own box rather than pushing the
          // conversation sideways.
          table: ({ children }) => (
            <div className="mb-3 overflow-x-auto rounded-xl border border-line last:mb-0">
              <table className="w-full text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50/70">{children}</thead>,
          th: ({ children }) => (
            <th className="border-b border-line px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-faint">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="nums border-b border-line px-3 py-2 last:border-0">{children}</td>
          ),
          code: ({ children }) => (
            <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[12px]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="mb-3 overflow-x-auto rounded-xl border border-line bg-gray-50/70 p-3 text-[12px] last:mb-0">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target={href?.startsWith("/") ? undefined : "_blank"}
              rel="noreferrer"
              className="font-semibold text-accent underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-4 border-line" />,
          blockquote: ({ children }) => (
            <blockquote className="mb-3 border-l-2 border-accent-line pl-3 text-mute last:mb-0">
              {children}
            </blockquote>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
