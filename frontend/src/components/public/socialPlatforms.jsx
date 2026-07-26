export const socialPlatforms = [
  {
    key: 'instagram',
    label: 'Instagram',
    bg: 'bg-gradient-to-br from-[#FEDA75] via-[#D62976] to-[#4F5BD5]',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <rect x="3" y="3" width="18" height="18" rx="5" stroke="#fff" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="4" stroke="#fff" strokeWidth="1.8" />
        <circle cx="17.5" cy="6.5" r="1.1" fill="#fff" />
      </svg>
    ),
  },
  {
    key: 'facebook',
    label: 'Facebook',
    bg: 'bg-[#1877F2]',
    icon: (
      <svg viewBox="0 0 24 24" className="h-4 w-4">
        <path
          fill="#fff"
          d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.25-1.5 1.6-1.5H16V4.3C15.7 4.26 14.8 4 13.7 4c-2.3 0-3.9 1.4-3.9 4v2.5H7.3v3h2.5V21h3.7z"
        />
      </svg>
    ),
  },
  {
    key: 'youtube',
    label: 'YouTube',
    bg: 'bg-[#FF0000]',
    icon: (
      <svg viewBox="0 0 24 24" fill="#fff" className="h-4 w-4">
        <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28.3 28.3 0 0 0 2 12a28.3 28.3 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28.3 28.3 0 0 0 22 12a28.3 28.3 0 0 0-.4-4.8Z" />
        <path fill="#FF0000" d="M10 15V9l5.2 3-5.2 3Z" />
      </svg>
    ),
  },
];
