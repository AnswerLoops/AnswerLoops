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
      {/*
        Two 180° arcs forming a complete circle loop.
        Circle: center (20,20) radius 13.
        Arc endpoints: (12,30) bottom-left and (28,10) top-right — diametrically opposite.
      */}

      {/* Arc 1: bottom-left → clockwise through left + top → top-right */}
      <path
        d="M 12 30 A 13 13 0 0 1 28 10"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Arrowhead at (28,10): arc arriving from upper-left → points right-down */}
      <path
        d="M 23 8 L 28 10 L 25 15"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Arc 2: top-right → clockwise through right + bottom → bottom-left */}
      <path
        d="M 28 10 A 13 13 0 0 1 12 30"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      {/* Arrowhead at (12,30): arc arriving from lower-right → points left-up */}
      <path
        d="M 17 32 L 12 30 L 15 25"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Center source node */}
      <circle cx="20" cy="20" r="4.5" fill="currentColor" />
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
      <span className={`font-bold tracking-tight ${textSize} ${textColor}`}>AnswerLoops</span>
    </div>
  )
}
