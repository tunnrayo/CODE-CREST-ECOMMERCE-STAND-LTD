/** Minimal, safe renderer for policy text: "## " headings, "- " bullets, paragraphs. No HTML is interpreted. */
export function SimpleMarkdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="prose-cc">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines[0].startsWith("## ")) {
          const rest = lines.slice(1);
          return (
            <div key={i}>
              <h2>{lines[0].slice(3)}</h2>
              {rest.length > 0 && renderLines(rest, i)}
            </div>
          );
        }
        return <div key={i}>{renderLines(lines, i)}</div>;
      })}
    </div>
  );
}

function renderLines(lines: string[], key: number) {
  if (lines.every((l) => l.startsWith("- "))) {
    return (
      <ul key={key}>
        {lines.map((l, j) => <li key={j}>{l.slice(2)}</li>)}
      </ul>
    );
  }
  return <p key={key}>{lines.join(" ")}</p>;
}
