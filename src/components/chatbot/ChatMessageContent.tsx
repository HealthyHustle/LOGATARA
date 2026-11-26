import React from 'react';

function renderInline(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('**') && token.endsWith('**')) {
      tokens.push(
        <strong key={key++} className="font-bold text-on-surface">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      tokens.push(
        <em key={key++} className="italic">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('`') && token.endsWith('`')) {
      tokens.push(
        <code
          key={key++}
          className="px-1.5 py-0.5 rounded-md bg-surface-container text-primary font-mono text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push(text.slice(lastIndex));
  }
  return tokens;
}

/**
 * Lightweight, XSS-safe Markdown renderer (pure React nodes, no dangerouslySetInnerHTML)
 * for structured LOGATARA AI Agent responses from n8n and local fallback.
 */
export function ChatMessageContent({ content }: { content: string }) {
  const lines = String(content || '').split(/\r?\n/);

  return (
    <div className="space-y-1.5 break-words">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) {
          return <div key={idx} className="h-1" />;
        }
        if (/^-{3,}$/.test(line)) {
          return <hr key={idx} className="my-2 border-on-surface-bark/15" />;
        }
        if (line.startsWith('### ')) {
          return (
            <h4 key={idx} className="font-display font-bold text-primary text-sm sm:text-base pt-1">
              {renderInline(line.slice(4))}
            </h4>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h3 key={idx} className="font-display font-bold text-primary text-base pt-1">
              {renderInline(line.slice(3))}
            </h3>
          );
        }
        if (/^([•\-*])\s+/.test(line)) {
          const itemText = line.replace(/^([•\-*])\s+/, '');
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="text-secondary-terracotta font-bold shrink-0">•</span>
              <span className="flex-1">{renderInline(itemText)}</span>
            </div>
          );
        }
        return <p key={idx}>{renderInline(rawLine)}</p>;
      })}
    </div>
  );
}
