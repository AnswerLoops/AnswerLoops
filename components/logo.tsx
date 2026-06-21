interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 32, className = '' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer loop arc — ~300° arc with arrowhead */}
      <path
        d="M 20 4 A 16 16 0 1 1 6.34 28"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Arrowhead at arc end */}
      <path
        d="M 2 24 L 6.5 29.5 L 12 26"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Center node — source point */}
      <circle cx="20" cy="20" r="4.5" fill="currentColor" />
      {/* Inner spokes — suggest "source" radiating outward */}
      <line x1="20" y1="13.5" x2="20" y2="15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="26.5" y1="20" x2="24.5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="20" y1="26.5" x2="20" y2="24.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="13.5" y1="20" x2="15.5" y2="20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

interface LogoProps {
  size?: number
  textSize?: string
  className?: string
  color?: 'indigo' | 'white'
}

export function Logo({ size = 28, textSize = 'text-sm', className = '', color = 'indigo' }: LogoProps) {
  const iconColor = color === 'white' ? 'text-white' : 'text-indigo-600'
  const textColor = color === 'white' ? 'text-white' : 'text-gray-900'

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={size} className={iconColor} />
      <span className={`font-bold tracking-tight ${textSize} ${textColor}`}>Source Loop</span>
    </div>
  )
}
