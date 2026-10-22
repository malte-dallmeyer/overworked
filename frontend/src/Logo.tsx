/** Overworked logo: a sun setting on the horizon, its clock hand pointing to Feierabend. */
export function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6a3f9c" />
          <stop offset="0.6" stopColor="#f0738f" />
          <stop offset="1" stopColor="#ff9f6b" />
        </linearGradient>
        <clipPath id="logo-above-horizon">
          <rect x="0" y="0" width="64" height="42" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#logo-sky)" />
      <g stroke="#ffd98a" strokeWidth="3" strokeLinecap="round">
        <line x1="32" y1="12" x2="32" y2="17" />
        <line x1="14" y1="24" x2="18" y2="27" />
        <line x1="50" y1="24" x2="46" y2="27" />
      </g>
      <circle cx="32" cy="42" r="15" fill="#ffd98a" clipPath="url(#logo-above-horizon)" />
      <g stroke="#6a3f9c" strokeWidth="3" strokeLinecap="round">
        <line x1="32" y1="41" x2="32" y2="31" />
        <line x1="32" y1="41" x2="40" y2="35" />
      </g>
      <line x1="10" y1="42" x2="54" y2="42" stroke="#fff4e6" strokeWidth="3" strokeLinecap="round" />
      <line x1="20" y1="49" x2="44" y2="49" stroke="#fff4e6" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <line x1="26" y1="55" x2="38" y2="55" stroke="#fff4e6" strokeWidth="2.5" strokeLinecap="round" opacity="0.45" />
    </svg>
  )
}
