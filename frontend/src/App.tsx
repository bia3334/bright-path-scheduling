import { useCallback, useEffect, useState } from 'react'
import { getDay, getTutors } from './api/client'
import type { Day, Tutor } from './api/types'
import BookingPanel from './components/BookingPanel'
import DayGrid from './components/DayGrid'
import ImportBar from './components/ImportBar'
import Legend from './components/Legend'
import { weekday } from './lib/time'

interface Pick {
  roomId: string
  start: string
}

/** One screen: pick a day, see it as a grid, click an empty cell to book. */
export default function App() {
  const [date, setDate] = useState('2026-03-06')
  const [day, setDay] = useState<Day | null>(null)
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [pick, setPick] = useState<Pick | null>(null)
  const [offline, setOffline] = useState(false)

  const reload = useCallback(() => {
    getDay(date)
      .then((d) => { setDay(d); setOffline(false) })
      .catch(() => { setDay(null); setOffline(true) })
    getTutors().then(setTutors).catch(() => setTutors([]))
  }, [date])

  useEffect(() => { reload() }, [reload])

  const changeDate = (next: string) => {
    setDate(next)
    setPick(null)
  }

  return (
    <main>
      <header>
        <h1>Bright Path<small>Day grid</small></h1>
        <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
        <span className="weekday">{weekday(date)}</span>
        <span className="hint">Click an empty cell to book</span>
      </header>

      <ImportBar onImported={reload} />
      <Legend />

      {offline && (
        <p className="offline">The booking service is not reachable. Start it with <code>./dev-up.sh</code> and reload.</p>
      )}

      <DayGrid rooms={day?.rooms ?? []} selected={pick} onPickCell={(roomId, start) => setPick({ roomId, start })} />

      {pick && (
        <BookingPanel
          key={`${pick.roomId}-${pick.start}`}
          date={date}
          roomId={pick.roomId}
          start={pick.start}
          tutors={tutors}
          onBooked={() => { setPick(null); reload() }}
          onCancel={() => setPick(null)}
        />
      )}
    </main>
  )
}
