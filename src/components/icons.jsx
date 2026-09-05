function base(props) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    ...props,
  }
}

export function IconBox({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M21 8.5 12 3 3 8.5l9 5.5 9-5.5Z" />
      <path d="M3 8.5V16l9 5.5 9-5.5V8.5" />
      <path d="M12 14v7.5" />
    </svg>
  )
}

export function IconSearch({ className }) {
  return (
    <svg className={className} {...base()}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
}

export function IconX({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

export function IconPin({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2.75" />
    </svg>
  )
}

export function IconCalendar({ className }) {
  return (
    <svg className={className} {...base()}>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
      <path d="M8 3v4M16 3v4M3.5 10h17" />
    </svg>
  )
}

export function IconCheck({ className }) {
  return (
    <svg className={className} {...base()} strokeWidth={2.25}>
      <path d="m5 13 5 5L20 7" />
    </svg>
  )
}

export function IconChevronDown({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

export function IconCopy({ className }) {
  return (
    <svg className={className} {...base()}>
      <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
      <path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" />
    </svg>
  )
}

export function IconLock({ className }) {
  return (
    <svg className={className} {...base()}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
      <path d="M12 14.5v2.5" />
    </svg>
  )
}

export function IconShield({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M12 3 5 6v5.5c0 4.3 2.9 7.7 7 9 4.1-1.3 7-4.7 7-9V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  )
}

export function IconStore({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M4 9.5 5.2 4.5A1 1 0 0 1 6.17 3.75h11.66a1 1 0 0 1 .97.75L20 9.5" />
      <path d="M4 9.5h16v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-4 0v-2Z" />
      <path d="M5 13.5V20h14v-6.5" />
    </svg>
  )
}

export function IconArrowLeft({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M15 6l-6 6 6 6" />
    </svg>
  )
}

export function IconTag({ className }) {
  return (
    <svg className={className} {...base()}>
      <path d="M12.5 3H6a3 3 0 0 0-3 3v6.5a1 1 0 0 0 .29.7l9.5 9.5a1 1 0 0 0 1.42 0l7.5-7.5a1 1 0 0 0 0-1.42l-9.5-9.5a1 1 0 0 0-.71-.28Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </svg>
  )
}

export function IconWhatsapp({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.48-1.76-1.66-2.06-.17-.3-.02-.46.13-.61.14-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.6-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.47 0 1.45 1.06 2.86 1.21 3.06.15.2 2.09 3.2 5.08 4.48.71.31 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35Z" />
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.87.52 3.63 1.42 5.13L2 22l5.13-1.5a9.9 9.9 0 0 0 4.9 1.3h.01c5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2Zm0 18.02h-.01a8.1 8.1 0 0 1-4.13-1.13l-.3-.18-3.05.89.9-2.97-.19-.31a8.06 8.06 0 0 1-1.24-4.31c0-4.47 3.64-8.11 8.13-8.11 2.17 0 4.2.85 5.74 2.39a8.06 8.06 0 0 1 2.38 5.73c0 4.47-3.65 8.11-8.13 8.11Z" />
    </svg>
  )
}
