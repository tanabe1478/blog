import Markdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

function safeUrl(value: string): string {
  const transformed = defaultUrlTransform(value);
  if (!transformed) return "";
  try {
    const url = new URL(transformed, window.location.origin);
    return url.protocol === "http:" || url.protocol === "https:"
      ? transformed
      : "";
  } catch {
    return "";
  }
}

function markdownBody(content: string): string {
  return content.replace(/^(?:\uFEFF)?\s*---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

interface MarkdownArticleProps {
  content: string;
}

export function MarkdownArticle({ content }: MarkdownArticleProps) {
  return (
    <article className="markdown-article">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={safeUrl}
        components={{
          a: ({ children, ...props }) => (
            <a {...props} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          img: ({ alt, src }) => {
            if (!src) return null;
            const imageUrl = src.startsWith("/")
              ? `https://tanabe1478.github.io${src}`
              : src;
            if (!imageUrl.startsWith("https://")) return null;
            return <img src={imageUrl} alt={alt ?? ""} loading="lazy" />;
          },
        }}
      >
        {markdownBody(content)}
      </Markdown>
    </article>
  );
}
