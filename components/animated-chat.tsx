'use client'

import { useEffect, useRef, useState } from 'react'
import { LogoMark } from './logo'

const MESSAGES = [
  {
    id: 0,
    type: 'user' as const,
    name: 'alex',
    initial: 'A',
    color: 'bg-blue-500',
    time: 'today at 2:14 PM',
    text: "My webhooks stopped firing after the v2.3 update. Checked the logs but nothing shows up.",
  },
  {
    id: 1,
    type: 'ai' as const,
    time: 'today at 2:14 PM',
    text: "Known issue in v2.3 — webhook signature validation was tightened. Your endpoint must return 200 before processing the payload. Add res.status(200).send('ok') at the top of your handler, then process async.",
    confidence: 94,
  },
  {
    id: 2,
    type: 'user' as const,
    name: 'maya',
    initial: 'M',
    color: 'bg-brand-800',
    time: 'today at 2:19 PM',
    text: "Getting 'rate limit exceeded' on the API even though I'm under my plan's limit?",
  },
  {
    id: 3,
    type: 'ai' as const,
    time: 'today at 2:19 PM',
    text: "Rate limits apply per-minute and per-day separately. You may be hitting the 60 req/min cap. Catch 429 errors and retry after the Retry-After header value. Pro raises it to 300 req/min.",
    confidence: 91,
  },
]

const CHAR_DELAY = 33
const AI_THINKING_DELAY = 900
const BETWEEN_EXCHANGE_DELAY = 700
const END_PAUSE = 2800

type State =
  | { phase: 'idle' }
  | { phase: 'typing'; msgId: number; charCount: number }
  | { phase: 'thinking'; msgId: number }   // AI typing indicator
  | { phase: 'done'; msgId: number }        // message fully shown

export function AnimatedChat() {
  const [states, setStates] = useState<State[]>([{ phase: 'idle' }])
  // completedUpTo: msgId where all prior messages are fully rendered
  const [completedMsgs, setCompletedMsgs] = useState<Set<number>>(new Set())
  const [typingMsgId, setTypingMsgId] = useState<number | null>(null)
  const [typingCharCount, setTypingCharCount] = useState(0)
  const [thinkingFor, setThinkingFor] = useState<number | null>(null)
  const [visibleMsgs, setVisibleMsgs] = useState<number[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  const delay = (ms: number, fn: () => void) => {
    clear()
    timerRef.current = setTimeout(fn, ms)
  }

  // Sequencer: runs through messages 0→3 then resets
  const runMessage = (msgId: number) => {
    const msg = MESSAGES[msgId]
    if (!msg) {
      // All done — pause then restart
      delay(END_PAUSE, () => {
        setVisibleMsgs([])
        setCompletedMsgs(new Set())
        setTypingMsgId(null)
        setTypingCharCount(0)
        setThinkingFor(null)
        delay(400, () => runMessage(0))
      })
      return
    }

    if (msg.type === 'ai') {
      // Show thinking indicator first
      setThinkingFor(msgId)
      delay(AI_THINKING_DELAY, () => {
        setThinkingFor(null)
        startTyping(msgId)
      })
    } else {
      startTyping(msgId)
    }
  }

  const startTyping = (msgId: number) => {
    setVisibleMsgs(prev => [...prev, msgId])
    setTypingMsgId(msgId)
    setTypingCharCount(0)
    typeChar(msgId, 0)
  }

  const typeChar = (msgId: number, charIdx: number) => {
    const msg = MESSAGES[msgId]
    if (!msg) return
    const full = msg.text
    if (charIdx >= full.length) {
      // Done typing this message
      setTypingMsgId(null)
      setTypingCharCount(full.length)
      setCompletedMsgs(prev => new Set([...prev, msgId]))
      delay(BETWEEN_EXCHANGE_DELAY, () => runMessage(msgId + 1))
      return
    }
    setTypingCharCount(charIdx + 1)
    timerRef.current = setTimeout(() => typeChar(msgId, charIdx + 1), CHAR_DELAY)
  }

  useEffect(() => {
    delay(600, () => runMessage(0))
    return clear
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const getDisplayText = (msgId: number) => {
    const msg = MESSAGES[msgId]
    if (!msg) return ''
    if (completedMsgs.has(msgId)) return msg.text
    if (typingMsgId === msgId) return msg.text.slice(0, typingCharCount)
    return ''
  }

  // Determine what slot to show the thinking indicator in — it appears before the AI msg
  const thinkingSlotAfter = thinkingFor !== null ? thinkingFor - 1 : null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-red-400" />
          <span className="h-3 w-3 rounded-full bg-yellow-400" />
          <span className="h-3 w-3 rounded-full bg-green-400" />
        </div>
        <div className="flex items-center gap-1.5 mx-auto">
          <LogoMark size={16} className="text-brand-600" />
          <span className="text-xs font-medium text-gray-500">AnswerLoops — #support</span>
        </div>
      </div>

      {/* Messages */}
      <div className="p-4 space-y-4 h-[520px] overflow-hidden bg-white">
        {MESSAGES.map((msg, i) => {
          const isVisible = visibleMsgs.includes(msg.id)
          const displayText = getDisplayText(msg.id)
          const isDone = completedMsgs.has(msg.id)
          const isUser = msg.type === 'user'

          return (
            <div key={msg.id}>
              {/* Thinking indicator — shown before this AI message while thinking */}
              {msg.type === 'ai' && thinkingFor === msg.id && (
                <div className="flex gap-2.5 animate-[fadeIn_0.2s_ease]">
                  <div className="h-7 w-7 shrink-0 rounded-full bg-brand-600 flex items-center justify-center">
                    <LogoMark size={16} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] text-gray-400 mb-1">
                      AnswerLoops <span className="rounded bg-brand-100 px-1 py-0.5 text-brand-600 text-[9px] font-bold">AI</span>{' '}
                      <span className="text-gray-300">{msg.time}</span>
                    </div>
                    <div className="rounded-xl rounded-tl-none bg-brand-50 border border-brand-100 px-3 py-2.5 w-72 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              {/* Message itself */}
              {isVisible && (
                <div className={`flex gap-2.5 animate-[fadeIn_0.25s_ease] ${isUser ? 'flex-row-reverse' : ''}`}>
                  {isUser ? (
                    <div
                      className={`h-7 w-7 shrink-0 rounded-full ${msg.color} flex items-center justify-center text-white text-[10px] font-bold`}
                    >
                      {msg.initial}
                    </div>
                  ) : (
                    <div className="h-7 w-7 shrink-0 rounded-full bg-brand-600 flex items-center justify-center">
                      <LogoMark size={16} className="text-white" />
                    </div>
                  )}
                  <div className={`flex-1 ${isUser ? 'flex flex-col items-end' : ''}`}>
                    <div className={`text-[11px] text-gray-400 mb-1 ${isUser ? 'text-right' : ''}`}>
                      {isUser ? (
                        <>
                          {msg.name} <span className="text-gray-300">{msg.time}</span>
                        </>
                      ) : (
                        <>
                          AnswerLoops{' '}
                          <span className="rounded bg-brand-100 px-1 py-0.5 text-brand-600 text-[9px] font-bold">AI</span>{' '}
                          <span className="text-gray-300">{msg.time}</span>
                        </>
                      )}
                    </div>
                    <div
                      className={
                        isUser
                          ? 'rounded-xl rounded-tr-none bg-gray-100 px-3 py-2 text-xs text-gray-700 w-56'
                          : 'rounded-xl rounded-tl-none bg-brand-50 border border-brand-100 px-3 py-2 text-xs text-gray-700 w-72 leading-relaxed'
                      }
                    >
                      {displayText}
                      {typingMsgId === msg.id && (
                        <span className="inline-block w-[2px] h-[10px] bg-brand-500 ml-0.5 align-middle animate-[blink_0.7s_step-end_infinite]" />
                      )}
                    </div>
                    {msg.type === 'ai' && isDone && (
                      <div className="mt-1.5 animate-[fadeIn_0.3s_ease]">
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                          Auto-posted · {msg.confidence}% confidence
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
