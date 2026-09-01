import type { Reason, Receipt } from '../shared/types'

export type Format = 'json' | 'markdown' | 'answers' | 'prompt'

const REASONS: Record<Reason, string> = {
  completed: 'Du gjorde arbetet.',
  'auto-resolved': 'Raden löste sig själv — villkoret för den uppfylldes.',
  cancelled: 'Du tog bort raden utan att göra arbetet.',
  superseded: 'Agenten ersatte raden med en nyare version.'
}

function stamp(at: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(new Date(at))
}

function steps(receipt: Receipt): string[] {
  return receipt.steps.flatMap((step) => {
    const line = `- [${step.done ? 'x' : ' '}] ${step.text}`
    return step.answer ? [line, `  - Svar: ${step.answer}`] : [line]
  })
}

/** The full record: what was asked, what happened, and why the row is gone. */
function markdown(receipt: Receipt): string {
  const lines = [`## ${receipt.text}`, '']

  if (receipt.steps.length > 0) lines.push(...steps(receipt), '')
  if (receipt.note) lines.push(`**Notering:** ${receipt.note}`)
  if (receipt.link) lines.push(`**Länk:** ${receipt.link.target}`)

  lines.push(`**Utfall:** ${REASONS[receipt.reason]}`)
  lines.push(`**Avslutad:** ${stamp(receipt.createdAt)}`)

  return lines.join('\n')
}

/**
 * The small one, for a thread that is still alive: it already knows what it
 * asked for, so this is only what came back.
 */
function answers(receipt: Receipt): string {
  const lines = [`${receipt.text} — ${REASONS[receipt.reason].toLowerCase()}`]

  if (receipt.steps.length > 0) lines.push('', ...steps(receipt))
  if (receipt.note) lines.push('', `Notering: ${receipt.note}`)

  return lines.join('\n')
}

/**
 * The big one, for a thread that never saw any of this. It has to carry its own
 * context, because the session that created the row is gone.
 */
function prompt(receipt: Receipt): string {
  const lines = [
    'Jag tar över ett arbete från en tidigare agentsession. Det som följer är ett kvitto',
    'från den sessionen, inte arbete som jag själv har utfört.',
    '',
    'Läs avslutskoden innan du agerar:',
    '- completed: det manuella arbetet utfördes',
    '- auto-resolved: behovet försvann utan att arbetet utfördes',
    '- cancelled: arbetet utfördes inte',
    '- superseded: raden ersattes och ska inte fortsättas',
    '',
    `**Rad-id:** ${receipt.rowId}`,
    `**Uppgift:** ${receipt.text}`
  ]

  if (receipt.link) lines.push(`**Länk:** ${receipt.link.target}`)
  if (receipt.context) lines.push(`**Sammanhang:** ${receipt.context}`)

  lines.push(`**Utfall:** ${receipt.reason} — ${REASONS[receipt.reason]}`)
  lines.push(`**Avslutad:** ${stamp(receipt.createdAt)}`)

  if (receipt.steps.length > 0) lines.push('', 'Vad som verifierades:', ...steps(receipt))
  // Not "the person who did the work" — an auto-resolved row carries a note the
  // resolver wrote, and nobody did the work at all.
  if (receipt.note) lines.push('', `Notering: ${receipt.note}`)

  lines.push(
    '',
    'Fortsätt bara från det kvittot faktiskt visar. Tillskriv dig inte den tidigare',
    'sessionens arbete. Kontrollera repots aktuella läge innan du ändrar något eller',
    'gör något utåtriktat, och fråga hellre än gissar.'
  )

  return lines.join('\n')
}

export function render(receipt: Receipt, format: Format): string {
  switch (format) {
    case 'json':
      return JSON.stringify(receipt, null, 2)
    case 'answers':
      return answers(receipt)
    case 'prompt':
      return prompt(receipt)
    default:
      return markdown(receipt)
  }
}
