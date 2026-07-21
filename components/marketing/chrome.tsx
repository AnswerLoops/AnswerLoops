import Link from 'next/link'
import { LogoMark, Logo } from '@/components/logo'
import { MobileDrawer } from '@/components/ui/mobile-drawer'

export const GITHUB_URL = 'https://github.com/NathanTarbert/community-platform'

export const GithubIcon = ({ className = 'h-4 w-4' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.744 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
  </svg>
)

export function NavWordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark size={30} />
      <span className="text-lg font-semibold tracking-tight">
        <span className="text-white">answer</span>
        <span className="bg-gradient-to-r from-brand-400 to-indigo-400 bg-clip-text text-transparent">Loops</span>
      </span>
    </span>
  )
}

export function Nav({ loggedIn }: { loggedIn: boolean }) {
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/"><NavWordmark /></Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/#features" className="text-sm text-white/60 hover:text-white transition-colors">Features</Link>
            <Link href="/#how-it-works" className="text-sm text-white/60 hover:text-white transition-colors">How it works</Link>
            <Link href="/#pricing" className="text-sm text-white/60 hover:text-white transition-colors">Pricing</Link>
            <a href="https://docs.answerloops.com" target="_blank" rel="noopener noreferrer" className="text-sm text-white/60 hover:text-white transition-colors">Docs</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hidden sm:flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors">
            <GithubIcon />
            GitHub
          </Link>
          {loggedIn ? (
            <Link href="/dashboard" className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-brand-600 to-brand-500 px-2.5 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white shadow-sm shadow-brand-600/30 hover:from-brand-500 hover:to-brand-400 transition-colors">
              Go to dashboard →
            </Link>
          ) : (
            <span className="whitespace-nowrap rounded-full border border-accent/30 bg-accent/10 px-2.5 sm:px-3 py-1 text-[11px] sm:text-xs font-semibold text-accent">
              Coming soon
            </span>
          )}
          <MobileDrawer triggerLabel="Open navigation" triggerClassName="md:hidden">
            <nav className="flex flex-col p-4 gap-1">
              <Link href="/#features" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-gray-100">Features</Link>
              <Link href="/#how-it-works" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-gray-100">How it works</Link>
              <Link href="/#pricing" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-gray-100">Pricing</Link>
              <a href="https://docs.answerloops.com" target="_blank" rel="noopener noreferrer" className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-gray-100">Docs</a>
              <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-gray-100">
                <GithubIcon />
                GitHub
              </a>
            </nav>
          </MobileDrawer>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex flex-col md:flex-row items-start justify-between gap-8">
          <div>
            <div className="mb-3">
              <Logo width={90} />
            </div>
            <p className="text-xs text-gray-400 max-w-xs">AI-powered support automation for developer communities. Open source, self-hostable.</p>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400">
              <GithubIcon className="h-3 w-3" />
              <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">AGPL-3.0 — view source</Link>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-12 gap-y-6">
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Product</div>
              <div className="flex flex-col gap-2">
                <Link href="/#features" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Features</Link>
                <Link href="/#how-it-works" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">How it works</Link>
                <Link href="/#pricing" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Pricing</Link>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Compare</div>
              <div className="flex flex-col gap-2">
                <Link href="/vs/chatbase" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">vs Chatbase</Link>
                <Link href="/vs/intercom" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">vs Intercom</Link>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-700 uppercase tracking-widest mb-3">Open source</div>
              <div className="flex flex-col gap-2">
                <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">GitHub</Link>
                <Link href="https://docs.answerloops.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Docs</Link>
                <Link href={`${GITHUB_URL}/issues`} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-600 transition-colors">Issues</Link>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-400">© 2026 AnswerLoops. AGPL-3.0 licensed.</p>
          <p className="text-xs text-gray-400">Built in public · No VC money · Self-hostable</p>
        </div>
      </div>
    </footer>
  )
}
