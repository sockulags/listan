const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

export function PullRequestIcon(): React.JSX.Element {
  return (
    <svg {...base}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="18" r="2.5" />
      <path d="M6 8.5v7M15.5 18H12a4 4 0 0 1-4-4V8" />
    </svg>
  )
}

export function RunIcon(): React.JSX.Element {
  return (
    <svg {...base} width={16} height={16}>
      <rect x="3" y="9" width="18" height="11" rx="2.5" />
      <path d="M12 4.5v4.5M8.5 14.5h.01M15.5 14.5h.01" />
    </svg>
  )
}

export function OpenIcon(): React.JSX.Element {
  return (
    <svg {...base} width={16} height={16}>
      <path d="M14 4h6v6M20 4l-9 9M17 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

export function CheckIcon(): React.JSX.Element {
  return (
    <svg {...base} width={17} height={17}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
    </svg>
  )
}

export function ArrowIcon(): React.JSX.Element {
  return (
    <svg {...base} width={14} height={14} strokeWidth={2}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

export function CloseIcon(): React.JSX.Element {
  return (
    <svg {...base} width={15} height={15} strokeWidth={2}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

export function GripIcon(): React.JSX.Element {
  return (
    <svg {...base} width={16} height={16} strokeWidth={2}>
      <path d="M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01" />
    </svg>
  )
}

export function ChevronIcon(): React.JSX.Element {
  return (
    <svg {...base} strokeWidth={2}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
