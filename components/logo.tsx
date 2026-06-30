import Image from 'next/image'

interface LogoMarkProps {
  size?: number
  className?: string
}

// Small icon-only mark — SVG for tight spaces (avatars, tiny badges)
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
      <path d="M 12 30 A 13 13 0 0 1 28 10" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 23 8 L 28 10 L 25 15" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M 28 10 A 13 13 0 0 1 12 30" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M 17 32 L 12 30 L 15 25" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="4.5" fill="currentColor" />
    </svg>
  )
}

interface LogoProps {
  width?: number
  size?: number        // legacy — ignored when width is set
  textSize?: string    // legacy — ignored (wordmark is in the image)
  className?: string
  color?: string       // legacy — ignored
}

// Full logo image with wordmark
export function Logo({ width = 130, className = '' }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="AnswerLoops"
      width={width}
      height={width}
      className={`object-contain ${className}`}
      priority
    />
  )
}
