// The centre runs 09:00 to 21:30, so the grid is 25 half-hour columns.
export const SLOTS: string[] = Array.from({ length: 25 }, (_, i) => {
  const m = 9 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

/** Grid column for an "HH:MM" start: +1 for the room label column, +1 because grid lines are 1-based. */
export const column = (start: string): number => {
  const [h, m] = start.split(':').map(Number)
  return (h * 60 + m - 9 * 60) / 30 + 2
}

export const hhmm = (t: string): string => t.slice(0, 5)

export const weekday = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })
