/**
 * Renderiza texto com a marcação do WhatsApp (*negrito*, _itálico_) e links clicáveis,
 * sem usar dangerouslySetInnerHTML (evita XSS: todo texto vira nó React escapado).
 */
import { Fragment, type ReactNode } from "react";

const TOKEN = /(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/[^\s]+)/g;

function renderLine(line: string, key: number): ReactNode {
  const parts = line.split(TOKEN).filter((p) => p !== "");
  return (
    <Fragment key={key}>
      {parts.map((part, i) => {
        if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <strong key={i}>{part.slice(1, -1)}</strong>;
        if (part.startsWith("_") && part.endsWith("_") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
        if (/^https?:\/\//.test(part)) {
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              {part}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </Fragment>
  );
}

export function WhatsAppText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderLine(line, i)}
          {i < lines.length - 1 && "\n"}
        </Fragment>
      ))}
    </>
  );
}
