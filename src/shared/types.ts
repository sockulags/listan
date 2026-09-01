/** What an agent wants back from a step, if anything. */
export type Expects = 'none' | 'text' | 'url'

/** A single manual step under a row. Steps never nest. */
export interface Step {
  id: string
  text: string
  done: boolean
  /** Only steps that ask for something get a field to answer in. */
  expects: Expects
  answer?: string
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
  /** Markdown brief from the agent. Rows that have one open in their own window. */
  body?: string
  /** What the next agent needs to know: repo, branch, what the thread was doing. */
  context?: string
  steps: Step[]
  /** True while an agent thread is blocked on this row through `listan wait`. */
  awaited?: boolean
}

export interface Tab {
  id: string
  name: string
  /** Exactly one tab is the ordered queue; the rest are unordered piles. */
  ordered: boolean
}

/**
 * Why a row left the queue. Without this a receiver reads "the row is gone" as
 * "the verification passed", which is wrong three times out of four.
 */
export type Reason = 'completed' | 'auto-resolved' | 'cancelled' | 'superseded'

/**
 * What the queue hands back once a row is done. Receipts live outside the queue
 * and expire on their own, so the queue itself stays without history.
 */
export interface Receipt {
  id: string
  rowId: string
  reason: Reason
  createdAt: number
  text: string
  link?: RowLink
  source?: string
  context?: string
  note?: string
  steps: Array<{ text: string; done: boolean; answer?: string }>
}

export interface Settings {
  /** Whether an agent thread may block on a row through `listan wait`. */
  allowWaiting: boolean
  theme: 'system' | 'light' | 'dark'
}

export const DEFAULT_SETTINGS: Settings = {
  allowWaiting: true,
  theme: 'system'
}
