import React from 'react'

// All icons stroke-based, 16x16, currentColor — Heroicons / Lucide style
const Wrap = (props: { children: React.ReactNode; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={props.size ?? 16}
    height={props.size ?? 16}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {props.children}
  </svg>
)

export const IconNewChat = () => (
  <Wrap>
    <path d="M12 5v14M5 12h14" />
  </Wrap>
)

export const IconSearch = () => (
  <Wrap>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Wrap>
)

export const IconSkills = () => (
  <Wrap>
    <path d="M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z" />
    <path d="m9 12 2 2 4-4" />
  </Wrap>
)

export const IconPlugins = () => (
  <Wrap>
    <path d="M9 2v4M15 2v4M9 22v-4M15 22v-4" />
    <rect x="6" y="6" width="12" height="12" rx="3" />
  </Wrap>
)

export const IconAutomations = () => (
  <Wrap>
    <path d="M21 12a9 9 0 1 1-3.5-7.1" />
    <path d="M21 4v5h-5" />
  </Wrap>
)

export const IconProject = () => (
  <Wrap>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </Wrap>
)

export const IconSend = () => (
  <Wrap>
    <path d="m19 12-14 7 3-7-3-7 14 7z" />
  </Wrap>
)

export const IconCopy = () => (
  <Wrap>
    <rect x="8" y="8" width="11" height="11" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1" />
  </Wrap>
)

export const IconRegenerate = () => (
  <Wrap>
    <path d="M21 12a9 9 0 0 1-15.2 6.5" />
    <path d="M3 12A9 9 0 0 1 18.2 5.5" />
    <path d="M3 18v-5h5M21 6v5h-5" />
  </Wrap>
)

export const IconTrash = () => (
  <Wrap>
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6 18 20a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </Wrap>
)

export const IconShield = () => (
  <Wrap>
    <path d="M12 2 5 5v6c0 4.4 2.8 8.3 7 9.8 4.2-1.5 7-5.4 7-9.8V5l-7-3z" />
    <path d="m9 12 2 2 4-4" />
  </Wrap>
)

export const IconClose = () => (
  <Wrap size={14}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Wrap>
)

export const IconSettings = () => (
  <Wrap>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </Wrap>
)

export const IconChevron = () => (
  <Wrap size={14}>
    <path d="m6 9 6 6 6-6" />
  </Wrap>
)

export const IconBrain = () => (
  <Wrap>
    <path d="M12 5a3 3 0 1 0-3 3c0 2 3 3 3 6" />
    <path d="M12 5a3 3 0 1 1 3 3c0 2-3 3-3 6" />
    <path d="M12 14v4" />
  </Wrap>
)

export const IconTerminal = () => (
  <Wrap>
    <path d="m6 9 4 3-4 3M12 15h6" />
  </Wrap>
)

export const IconFile = () => (
  <Wrap>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M9 13h6M9 17h4" />
  </Wrap>
)

export const IconImage = () => (
  <Wrap>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <circle cx="8.5" cy="10.5" r="1.5" />
    <path d="m21 15-4.5-4.5L7 20" />
  </Wrap>
)

export const IconTool = () => (
  <Wrap>
    <path d="m21 3-9 9M10 14l-7 7M3 21h4" />
    <circle cx="16" cy="8" r="4" />
  </Wrap>
)

export const IconGlobe = () => (
  <Wrap>
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
  </Wrap>
)

export const IconStop = () => (
  <Wrap>
    <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
  </Wrap>
)

export const IconCheck = () => (
  <Wrap>
    <polyline points="20 6 9 17 4 12" />
  </Wrap>
)

export const IconMagic = () => (
  <Wrap>
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h-2M19.07 4.93l-1.41 1.41M16.24 16.24l-1.41-1.41M6.34 6.34l1.41 1.41M9.17 14.83l1.41-1.41" />
    <path d="m19 19-3-3" />
    <path d="M3 21h4L19 9l-4-4L3 17Z" />
  </Wrap>
)

export const IconMenu = () => (
  <Wrap>
    <line x1="4" y1="12" x2="20" y2="12" />
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="4" y1="18" x2="20" y2="18" />
  </Wrap>
)

export const IconGitBranch = () => (
  <Wrap>
    <line x1="6" y1="3" x2="6" y2="15" />
    <circle cx="18" cy="6" r="3" />
    <circle cx="6" cy="18" r="3" />
    <path d="M18 9a9 9 0 0 1-9 9" />
  </Wrap>
)

export const IconMic = () => (
  <Wrap>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
    <path d="M19 10v1a7 7 0 0 1-14 0v-1M12 19v3M8 22h8" />
  </Wrap>
)

export const IconCursor = () => (
  <Wrap>
    <path d="m4 4 7.07 17 2.51-7.39L21 11.07zM17 17l4 4M21 17l-4 4" />
  </Wrap>
)

export const IconSplit = () => (
  <Wrap>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
  </Wrap>
)




