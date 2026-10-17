import type { JSX, ReactNode } from "react"

function renderInline(text: string): ReactNode[] {
  const tokenPattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g
  return text.split(tokenPattern).filter(Boolean).map((token, index) => {
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link) {
      const [, label, href] = link
      if (/^(https?:\/\/|\/|#)/i.test(href)) {
        return <a key={index} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noreferrer" : undefined} className="text-primary underline underline-offset-2">{label}</a>
      }
      return token
    }
    if (token.startsWith("`")) return <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{token.slice(1, -1)}</code>
    if (token.startsWith("**") || token.startsWith("__")) return <strong key={index}>{token.slice(2, -2)}</strong>
    if (token.startsWith("*") || token.startsWith("_")) return <em key={index}>{token.slice(1, -1)}</em>
    return token
  })
}

function isBlockStart(line: string) {
  return /^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+\.\s|>\s?)/.test(line) || /^\s*([-*_]\s*){3,}$/.test(line)
}

export function MarkdownContent({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) { index += 1; continue }

    if (line.startsWith("```")) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].startsWith("```")) code.push(lines[index++])
      if (index < lines.length) index += 1
      blocks.push(<pre key={blocks.length} className="overflow-x-auto rounded-md bg-muted p-3"><code>{code.join("\n")}</code></pre>)
      continue
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const Heading = `h${level}` as keyof JSX.IntrinsicElements
      const headingClass = level <= 2 ? "text-lg font-semibold" : "font-semibold"
      blocks.push(<Heading key={blocks.length} className={headingClass}>{renderInline(heading[2])}</Heading>)
      index += 1
      continue
    }

    if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={blocks.length} className="border-border" />)
      index += 1
      continue
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index])) quote.push(lines[index++].replace(/^\s*>\s?/, ""))
      blocks.push(<blockquote key={blocks.length} className="border-l-2 pl-3 text-muted-foreground">{quote.map((entry, row) => <p key={row}>{renderInline(entry)}</p>)}</blockquote>)
      continue
    }

    const listMatch = line.match(/^\s*([-*+]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      const ordered = /^\d+\./.test(listMatch[1])
      const items: string[] = []
      while (index < lines.length) {
        const item = lines[index].match(/^\s*([-*+]|\d+\.)\s+(.+)$/)
        if (!item || /^\d+\./.test(item[1]) !== ordered) break
        items.push(item[2])
        index += 1
      }
      const List = ordered ? "ol" : "ul"
      blocks.push(<List key={blocks.length} className={ordered ? "list-decimal pl-5" : "list-disc pl-5"}>{items.map((item, row) => <li key={row}>{renderInline(item)}</li>)}</List>)
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) paragraph.push(lines[index++])
    blocks.push(<p key={blocks.length}>{paragraph.map((entry, row) => <span key={row}>{row > 0 && <br />}{renderInline(entry)}</span>)}</p>)
  }

  return <div className="grid gap-3 text-sm leading-6">{blocks}</div>
}
