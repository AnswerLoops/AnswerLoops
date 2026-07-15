'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './logo'

const USER_MSG = "Can't seem to get the webhooks to fire for my social media scheduling tool 😕 anyone know what's up?"
const AI_MSG = "Found it — webhook signature validation was tightened in the last release. Make sure your endpoint returns 200 before processing the payload async."

const CHAR_DELAY = 28
const AI_THINKING_DELAY = 1000
const AFTER_REPLY_DELAY = 900
const DASHBOARD_HOLD_MS = 3600
const RESTART_DELAY = 500

type Scene = 'chat' | 'dashboard'
type Phase = 'idle' | 'user-typing' | 'ai-thinking' | 'ai-typing' | 'ai-done'

export function AnimatedChat() {
  const [scene, setScene] = useState<Scene>('chat')
  const [phase, setPhase] = useState<Phase>('idle')
  const [userChars, setUserChars] = useState(0)
  const [aiChars, setAiChars] = useState(0)
  const [badgeIn, setBadgeIn] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Separate ref for the dashboard-scene badge/reset chain — these two timers
  // run concurrently with each other, so they can't share timerRef (delay()
  // cancels whatever timerRef currently holds, which would kill the badge
  // reveal the instant the reset timer below it was scheduled).
  const sceneTimerRefs = useRef<ReturnType<typeof setTimeout>[]>([])

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }
  const delay = (ms: number, fn: () => void) => {
    clear()
    timerRef.current = setTimeout(fn, ms)
  }
  const clearSceneTimers = () => {
    sceneTimerRefs.current.forEach(clearTimeout)
    sceneTimerRefs.current = []
  }
  const sceneDelay = (ms: number, fn: () => void) => {
    sceneTimerRefs.current.push(setTimeout(fn, ms))
  }

  const typeUser = (i: number) => {
    if (i > USER_MSG.length) {
      setPhase('ai-thinking')
      delay(AI_THINKING_DELAY, () => typeAi(0))
      return
    }
    setUserChars(i)
    timerRef.current = setTimeout(() => typeUser(i + 1), CHAR_DELAY)
  }

  const typeAi = (i: number) => {
    if (i === 0) setPhase('ai-typing')
    if (i > AI_MSG.length) {
      setPhase('ai-done')
      delay(AFTER_REPLY_DELAY, () => {
        setScene('dashboard')
        clearSceneTimers()
        sceneDelay(500, () => setBadgeIn(true))
        sceneDelay(500 + DASHBOARD_HOLD_MS, () => {
          setBadgeIn(false)
          setScene('chat')
          setPhase('idle')
          setUserChars(0)
          setAiChars(0)
          delay(RESTART_DELAY, () => {
            setPhase('user-typing')
            typeUser(0)
          })
        })
      })
      return
    }
    setAiChars(i)
    timerRef.current = setTimeout(() => typeAi(i + 1), CHAR_DELAY)
  }

  useEffect(() => {
    delay(700, () => {
      setPhase('user-typing')
      typeUser(0)
    })
    return () => {
      clear()
      clearSceneTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const userText = USER_MSG.slice(0, userChars)
  const aiText = AI_MSG.slice(0, aiChars)

  return (
    <div className="relative rounded-2xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden min-h-[380px] sm:min-h-[420px]">
      {/* ── Scene 1: community channel (Discord-style) ── */}
      <div
        className={`flex bg-[#313338] transition-opacity duration-500 ${scene === 'chat' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
      >
        {/* Guild rail */}
        <div className="hidden sm:flex w-16 shrink-0 flex-col items-center gap-3 bg-[#1e1f22] py-3">
          <div className="h-10 w-10 rounded-2xl bg-[#313338] flex items-center justify-center text-white/70 text-xs font-bold">DV</div>
          <div className="h-8 w-1 rounded-full bg-white/10" />
          <div className="h-10 w-10 rounded-2xl bg-brand-600 flex items-center justify-center ring-2 ring-white/10">
            <LogoMark size={20} />
          </div>
          <div className="h-10 w-10 rounded-2xl bg-[#313338] flex items-center justify-center text-white/40 text-xs">+</div>
        </div>

        {/* Channel list */}
        <div className="hidden md:flex w-48 shrink-0 flex-col bg-[#2b2d31] p-3">
          <div className="text-xs font-semibold text-white/80 px-1 mb-3">devtools community</div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-1 mb-1">Text Channels</div>
          <div className="flex flex-col gap-0.5">
            <div className="rounded px-2 py-1 text-sm text-white/40"># general</div>
            <div className="rounded bg-white/10 px-2 py-1 text-sm text-white font-medium"># support</div>
            <div className="rounded px-2 py-1 text-sm text-white/40"># bugs</div>
          </div>
        </div>

        {/* Chat pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-center gap-2 border-b border-black/20 px-4 py-3 shadow-sm">
            <span className="text-white/30 text-lg font-light">#</span>
            <span className="text-sm font-semibold text-white">support</span>
          </div>

          <div className="p-4 space-y-4 h-[300px] sm:h-[340px] overflow-hidden">
            {(phase !== 'idle') && (
              <div className="flex gap-3 items-start animate-[fadeIn_0.25s_ease]">
                <div className="h-9 w-9 shrink-0 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">J</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm mb-0.5">
                    <span className="font-medium text-white">jordan_dev</span>{' '}
                    <span className="text-[11px] text-white/30">Today at 2:14 PM</span>
                  </div>
                  <div className="text-sm text-white/80 leading-relaxed">
                    {userText}
                    {phase === 'user-typing' && (
                      <span className="inline-block w-[2px] h-[14px] bg-white/60 ml-0.5 align-middle animate-[blink_0.7s_step-end_infinite]" />
                    )}
                  </div>
                </div>
              </div>
            )}

            {phase === 'ai-thinking' && (
              <div className="flex gap-3 items-start animate-[fadeIn_0.2s_ease]">
                <LogoMark size={36} className="shrink-0" />
                <div className="flex-1">
                  <div className="text-sm mb-0.5">
                    <span className="font-medium text-white">AnswerLoops</span>{' '}
                    <span className="rounded bg-brand-600 px-1 py-0.5 text-white text-[9px] font-bold align-middle">APP</span>
                  </div>
                  <div className="flex items-center gap-1 h-5">
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:150ms]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-white/40 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            {(phase === 'ai-typing' || phase === 'ai-done') && (
              <div className="flex gap-3 items-start animate-[fadeIn_0.25s_ease]">
                <LogoMark size={36} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm mb-0.5">
                    <span className="font-medium text-white">AnswerLoops</span>{' '}
                    <span className="rounded bg-brand-600 px-1 py-0.5 text-white text-[9px] font-bold align-middle">APP</span>{' '}
                    <span className="text-[11px] text-white/30">Today at 2:14 PM</span>
                  </div>
                  <div className="text-sm text-white/80 leading-relaxed">
                    {aiText}
                    {phase === 'ai-typing' && (
                      <span className="inline-block w-[2px] h-[14px] bg-white/60 ml-0.5 align-middle animate-[blink_0.7s_step-end_infinite]" />
                    )}
                  </div>
                  {phase === 'ai-done' && (
                    <div className="mt-2 w-fit rounded border-l-4 border-brand-500 bg-black/20 px-3 py-2 animate-[fadeIn_0.3s_ease]">
                      <div className="text-[10px] text-white/40 mb-0.5">docs.answerloops.com</div>
                      <div className="text-xs font-medium text-brand-300">Webhook Setup Guide →</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Scene 2: AnswerLoops dashboard ── */}
      <div
        className={`bg-[#0b0d14] p-4 sm:p-6 transition-opacity duration-500 min-h-[300px] sm:min-h-[340px] flex flex-col ${scene === 'dashboard' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute inset-0'}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <LogoMark size={22} />
          <span className="text-sm font-semibold text-white">AnswerLoops</span>
          <span className="text-xs text-white/30">/ Tickets</span>
        </div>

        <div className="rounded-xl border border-white/10 bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400">#42</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-800">how_to</span>
              <span
                className={`rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 transition-all duration-300 ${badgeIn ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}
              >
                Auto-answered · 95%
              </span>
            </div>
            <span className="text-[11px] text-gray-400 shrink-0">Just now</span>
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            Can&apos;t get webhooks to fire for social media scheduling tool
          </h3>
          <p className="text-xs text-gray-500 leading-relaxed mb-3">
            jordan_dev · #support · Discord
          </p>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7" /></svg>
            Resolved automatically — no human review needed
          </div>
        </div>

        <div className="flex-1" />
      </div>
    </div>
  )
}
