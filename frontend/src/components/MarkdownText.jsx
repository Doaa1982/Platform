import { Fragment } from "react";

/* =========================================================================
   MARKDOWN TEXT — renders the constrained Markdown subset our AI content
   skills actually produce (headings, bold/italic, bullet/numbered lists,
   blank-line-separated paragraphs) as real elements instead of dumping raw
   "#"/"**" syntax as plain text. Hand-rolled rather than a library — the
   supported subset is small and fixed, consistent with this app's existing
   "no new npm dependency for a narrow, well-understood need" precedent
   (VideoPlayer's hand-rolled YouTube wrapper). Never uses
   dangerouslySetInnerHTML — everything is built as real React text nodes,
   so there's no injection surface even though this renders AI-generated text.
   ========================================================================= */

const INLINE_PATTERN = /(\*\*.+?\*\*|\*.+?\*|_.+?_)/g;

/** Splits one line into text/bold/italic React nodes. No nested emphasis — not needed for this content. */
function renderInline(line) {
  return line.split(INLINE_PATTERN).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function parseBlocks(text) {
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = null;
  let list = null;

  const closeParagraph = () => { if (paragraph) { blocks.push(paragraph); paragraph = null; } };
  const closeList = () => { if (list) { blocks.push(list); list = null; } };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^\d+\.\s+(.*)$/.exec(line);

    if (!line) {
      closeParagraph();
      closeList();
    } else if (heading) {
      closeParagraph();
      closeList();
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
    } else if (bullet) {
      closeParagraph();
      if (list?.ordered) closeList();
      list ??= { type: "list", ordered: false, items: [] };
      list.items.push(bullet[1]);
    } else if (numbered) {
      closeParagraph();
      if (list && !list.ordered) closeList();
      list ??= { type: "list", ordered: true, items: [] };
      list.items.push(numbered[1]);
    } else {
      closeList();
      paragraph ??= { type: "paragraph", lines: [] };
      paragraph.lines.push(line);
    }
  }
  closeParagraph();
  closeList();
  return blocks;
}

const HEADING_STYLE = (level) => ({
  margin: level <= 2 ? "0.9em 0 0.4em" : "0.7em 0 0.3em",
  fontWeight: 700,
  fontSize: level === 1 ? "1.2em" : level === 2 ? "1.1em" : "1em",
});
const LIST_STYLE = { margin: "0 0 0.8em", paddingInlineStart: "1.4em" };
const PARAGRAPH_STYLE = { margin: "0 0 0.8em" };

/** Renders AI-authored Markdown-ish text as real elements. `text` may also be plain prose with no Markdown syntax — it just renders as ordinary paragraphs then. */
export default function MarkdownText({ text, className, style }) {
  if (!text) return null;
  const blocks = parseBlocks(text);

  return (
    <div className={className} style={style}>
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const Tag = `h${Math.min(block.level, 6)}`;
          return <Tag key={i} style={HEADING_STYLE(block.level)}>{renderInline(block.text)}</Tag>;
        }
        if (block.type === "list") {
          const ListTag = block.ordered ? "ol" : "ul";
          return (
            <ListTag key={i} style={LIST_STYLE}>
              {block.items.map((item, j) => <li key={j}>{renderInline(item)}</li>)}
            </ListTag>
          );
        }
        const lastIndex = block.lines.length - 1;
        return (
          <p key={i} style={PARAGRAPH_STYLE}>
            {block.lines.map((line, j) => (
              <Fragment key={j}>
                {renderInline(line)}
                {j < lastIndex && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
