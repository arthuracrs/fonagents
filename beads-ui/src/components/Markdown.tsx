import { marked } from "marked";

interface Props {
  content: string;
  className?: string;
}

export function Markdown({ content, className = "" }: Props) {
  const html = marked.parse(content, { async: false }) as string;
  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
