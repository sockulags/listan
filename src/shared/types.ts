/** A single manual step under a row. Steps never nest. */
export interface Step {
  id: string
  text: string
  done: boolean
}

/** What a row links to. The row itself is the link — clicking it opens this. */
export type LinkKind = 'url' | 'file' | 'command'

export interface RowLink {
  kind: LinkKind
  target: string
}

/**
 * One thing only your hands can do. Rows are temporary: they are created by an
 * agent or by you, drained, and deleted. There is no archive.
 */
export interface Row {
  id: string
  tab: string
  /** Position within the tab. Only the prio tab treats this as a queue. */
  position: number
  text: string
  link?: RowLink
  /** Short label for where the row came from, e.g. a repo or 'referat'. */
  source?: string
  /** Groups rows created by the same agent run. */
  batch?: string
  steps: Step[]
}

export interface Tab {
  id: string
  name: string
  /** Exactly one tab is the ordered queue; the rest are unordered piles. */
  ordered: boolean
}
