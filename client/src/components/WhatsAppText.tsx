import React from 'react';

interface WhatsAppTextProps {
  text?: string;
  className?: string;
}

/**
 * Safely parses and renders inline WhatsApp formatting:
 * - URLs -> clickable links
 * - `code` -> inline code
 * - *bold* -> <strong>
 * - _italic_ -> <em>
 * - ~strike~ -> <del>
 */
function renderInlineFormatting(line: string, keyPrefix: string): React.ReactNode[] {
  // Regex to match URLs, inline code, bold, italic, and strikethrough
  // 1: URL
  // 2: Inline code (`...`)
  // 3: Bold (*...*)
  // 4: Italic (_..._)
  // 5: Strike (~...~)
  const inlineRegex = /(https?:\/\/[^\s]+)|`([^`]+)`|\*([^*\n]+)\*|_([^_\n]+)_|~([^~\n]+)~/g;

  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = inlineRegex.exec(line)) !== null) {
    // Add preceding plain text
    if (match.index > lastIndex) {
      elements.push(line.substring(lastIndex, match.index));
    }

    const [fullMatch, url, inlineCode, bold, italic, strike] = match;

    if (url) {
      elements.push(
        <a
          key={`${keyPrefix}-url-${idx++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#53bdeb] hover:underline underline-offset-2 break-all"
        >
          {url}
        </a>
      );
    } else if (inlineCode !== undefined) {
      elements.push(
        <code
          key={`${keyPrefix}-code-${idx++}`}
          className="bg-black/25 text-[#00a884] font-mono text-[12.5px] px-1.5 py-0.5 rounded border border-white/5 mx-0.5 select-text"
        >
          {inlineCode}
        </code>
      );
    } else if (bold !== undefined) {
      elements.push(
        <strong key={`${keyPrefix}-b-${idx++}`} className="font-bold text-white">
          {bold}
        </strong>
      );
    } else if (italic !== undefined) {
      elements.push(
        <em key={`${keyPrefix}-i-${idx++}`} className="italic">
          {italic}
        </em>
      );
    } else if (strike !== undefined) {
      elements.push(
        <del key={`${keyPrefix}-s-${idx++}`} className="line-through opacity-80">
          {strike}
        </del>
      );
    }

    lastIndex = inlineRegex.lastIndex;
  }

  // Add any remaining text
  if (lastIndex < line.length) {
    elements.push(line.substring(lastIndex));
  }

  return elements;
}

export const WhatsAppText: React.FC<WhatsAppTextProps> = ({ text, className = '' }) => {
  if (!text) return null;

  // 1. Separate code blocks (``` ... ```)
  const codeBlockRegex = /```([\s\S]*?)```/g;
  const sections: { type: 'code' | 'text'; content: string }[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      sections.push({ type: 'text', content: text.substring(lastIdx, match.index) });
    }
    sections.push({ type: 'code', content: match[1] });
    lastIdx = codeBlockRegex.lastIndex;
  }
  if (lastIdx < text.length) {
    sections.push({ type: 'text', content: text.substring(lastIdx) });
  }

  // 2. Render each section
  return (
    <div className={`leading-relaxed select-text ${className}`}>
      {sections.map((section, sIdx) => {
        if (section.type === 'code') {
          return (
            <pre
              key={`block-${sIdx}`}
              className="bg-black/30 text-[#e9edef] font-mono text-[12px] p-2.5 rounded-md my-1.5 border border-white/10 overflow-x-auto whitespace-pre font-normal"
            >
              <code>{section.content}</code>
            </pre>
          );
        }

        // Parse lines within text section
        const lines = section.content.split('\n');
        const renderedNodes: React.ReactNode[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];

          // Check for Blockquote (> text)
          if (line.startsWith('> ') || line === '>') {
            const quoteLines: string[] = [];
            while (i < lines.length && (lines[i].startsWith('> ') || lines[i] === '>')) {
              quoteLines.push(lines[i].startsWith('> ') ? lines[i].slice(2) : '');
              i++;
            }
            renderedNodes.push(
              <blockquote
                key={`quote-${sIdx}-${i}`}
                className="border-l-4 border-[#00a884] bg-black/15 pl-3 py-1 my-1.5 rounded-r text-[#8696a0] italic text-[13.5px]"
              >
                {quoteLines.map((qLine, qIdx) => (
                  <div key={`ql-${qIdx}`}>
                    {renderInlineFormatting(qLine, `quote-${sIdx}-${i}-${qIdx}`)}
                  </div>
                ))}
              </blockquote>
            );
            continue;
          }

          // Check for Bullet list (* item or - item)
          if (/^(\*|-)\s+/.test(line)) {
            const listItems: string[] = [];
            while (i < lines.length && /^(\*|-)\s+/.test(lines[i])) {
              listItems.push(lines[i].replace(/^(\*|-)\s+/, ''));
              i++;
            }
            renderedNodes.push(
              <ul key={`ul-${sIdx}-${i}`} className="list-disc list-inside my-1 space-y-0.5">
                {listItems.map((item, lIdx) => (
                  <li key={`li-${lIdx}`} className="text-[#e9edef]">
                    {renderInlineFormatting(item, `ul-${sIdx}-${i}-${lIdx}`)}
                  </li>
                ))}
              </ul>
            );
            continue;
          }

          // Check for Numbered list (1. item)
          if (/^\d+\.\s+/.test(line)) {
            const listItems: { num: string; text: string }[] = [];
            while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
              const numMatch = lines[i].match(/^(\d+)\.\s+(.*)$/);
              if (numMatch) {
                listItems.push({ num: numMatch[1], text: numMatch[2] });
              }
              i++;
            }
            renderedNodes.push(
              <ol key={`ol-${sIdx}-${i}`} className="list-decimal list-inside my-1 space-y-0.5">
                {listItems.map((item, lIdx) => (
                  <li key={`oli-${lIdx}`} className="text-[#e9edef]">
                    {renderInlineFormatting(item.text, `ol-${sIdx}-${i}-${lIdx}`)}
                  </li>
                ))}
              </ol>
            );
            continue;
          }

          // Regular line
          renderedNodes.push(
            <React.Fragment key={`line-${sIdx}-${i}`}>
              {renderInlineFormatting(line, `line-${sIdx}-${i}`)}
              {i < lines.length - 1 && <br />}
            </React.Fragment>
          );
          i++;
        }

        return <div key={`sec-${sIdx}`}>{renderedNodes}</div>;
      })}
    </div>
  );
};
