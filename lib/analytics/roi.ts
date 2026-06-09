/**
 * ROI assumptions for translating deflected questions into time and money
 * saved. Deliberately conservative defaults; overridable via env so a customer
 * can tune them to their own support economics.
 */
export const AVG_MINUTES_PER_TICKET = Number(process.env.ROI_MINUTES_PER_TICKET ?? 10)
export const STAFF_HOURLY_RATE = Number(process.env.ROI_STAFF_HOURLY_RATE ?? 50)

export interface ROISavings {
  deflected: number
  hoursSaved: number
  dollarsSaved: number
  minutesPerTicket: number
  hourlyRate: number
}

/** Time + money saved from auto-deflecting `deflected` questions. */
export function computeSavings(deflected: number): ROISavings {
  const hoursSaved = (deflected * AVG_MINUTES_PER_TICKET) / 60
  return {
    deflected,
    hoursSaved,
    dollarsSaved: hoursSaved * STAFF_HOURLY_RATE,
    minutesPerTicket: AVG_MINUTES_PER_TICKET,
    hourlyRate: STAFF_HOURLY_RATE,
  }
}

/** Deflected ÷ total answered, as a 0–1 rate (0 when nothing answered yet). */
export function deflectionRate(deflected: number, answered: number): number {
  return answered > 0 ? deflected / answered : 0
}
