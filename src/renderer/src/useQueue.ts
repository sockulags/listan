import { useEffect, useState } from 'react'
import type { Row, Tab } from '@shared/types'

export interface Snapshot {
  tabs: Tab[]
  rows: Row[]
}

const EMPTY: Snapshot = { tabs: [], rows: [] }

/**
 * Reads the queue and follows it. Both the window and the overlay use this —
 * the main process pushes a change whenever the CLI writes to the same file.
 */
export function useQueue(): [Snapshot, (next: Snapshot) => void] {
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY)

  useEffect(() => {
    let alive = true

    const load = async (): Promise<void> => {
      const next = await window.listan.read()
      if (alive) setSnapshot(next)
    }

    const off = window.listan.onChanged(load)
    load()

    return () => {
      alive = false
      off()
    }
  }, [])

  return [snapshot, setSnapshot]
}
