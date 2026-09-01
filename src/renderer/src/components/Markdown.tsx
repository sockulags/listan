import { Fragment, type ReactNode } from 'react'

/**
 * A small markdown subset for the brief an agent writes. It builds React
 * elements rather than parsing HTML, so agent-authored text can never become
 * markup in a window that has preload access. Raw HTML is shown as text.
 */
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g

function inline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part, index) => {
      const key = `${keyPrefix}-${index}`

      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={key} className="font-medium">
            {part.slice(2, -2)}
          </strong>
        )
      }

      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={key} className="rounded bg-surface-2 px-1 py-0.5 text-[0.9em]">
            {part.slice(1, -1)}
          </code>
        )
      }

      if (part.startsWith('*') && part.endsWith('*')) {
        return <em key={key}>{part.slice(1, -1)}</em>
      }

      const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
      if (link) {
        const href = link[2]
        // Only http(s) survives; anything else would be a way to smuggle a
        // javascript: or file: target into a click.
        if (/^https?:\/\//i.test(href)) {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-accent underline underline-offset-2"
            >
              {link[1]}
            </a>
          )
        }
        return <Fragment key={key}>{link[1]}</Fragment>
      }

      return <Fragment key={key}>{part}</Fragment>
    })
}

export default function Markdown({ source }: { source: string }): React.JSX.Element {
  const blocks: ReactNode[] = []
  const lines = source.replace(/\r\n/g, '\n').split('\n')

  let paragraph: string[] = []
  let list: string[] = []
  let code: string[] | null = null

  const flushParagraph = (): void => {
    if (paragraph.length === 0) return
    const text = paragraph.join(' ')
    blocks.push(
      <p key={`p${blocks.length}`} className="text-[14.5px] leading-relaxed text-fg-muted">
        {inline(text, `p${blocks.length}`)}
      </p>
    )
    paragraph = []
  }

  const flushList = (): void => {
    if (list.length === 0) return
    blocks.push(
      <ul
        key={`l${blocks.length}`}
        className="flex list-disc flex-col gap-1 pl-5 text-[14.5px] text-fg-muted"
      >
        {list.map((item, index) => (
          <li key={index}>{inline(item, `l${blocks.length}-${index}`)}</li>
        ))}
      </ul>
    )
    list = []
  }

  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (code) {
        blocks.push(
          <pre
            key={`c${blocks.length}`}
            className="overflow-x-auto rounded-md bg-surface-2 p-3 text-[13px] text-fg-muted"
          >
            <code>{code.join('\n')}</code>
          </pre>
        )
        code = null
      } else {
        flushParagraph()
        flushList()
        code = []
      }
      continue
    }

    if (code) {
      code.push(line)
      continue
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/)
    if (heading) {
      flushParagraph()
      flushList()
      const size = heading[1].length === 1 ? 'text-base' : 'text-[15px]'
      blocks.push(
        <p key={`h${blocks.length}`} className={`${size} font-medium text-fg`}>
          {inline(heading[2], `h${blocks.length}`)}
        </p>
      )
      continue
    }

    const item = line.match(/^\s*[-*]\s+(.*)$/)
    if (item) {
      flushParagraph()
      list.push(item[1])
      continue
    }

    if (line.trim() === '') {
      flushParagraph()
      flushList()
      continue
    }

    flushList()
    paragraph.push(line.trim())
  }

  flushParagraph()
  flushList()

  return <div className="flex flex-col gap-3">{blocks}</div>
}
