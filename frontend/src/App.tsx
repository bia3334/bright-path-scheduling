import { useCallback, useEffect, useState } from 'react'
import { getDay, getTutors } from './api/client'
import type { Day, Lesson, Tutor } from './api/types'
import BookingPanel from './components/BookingPanel'
import DayGrid from './components/DayGrid'
import ImportBar from './components/ImportBar'
import Legend from './components/Legend'
import LessonDetails from './components/LessonDetails'
import { weekday } from './lib/time'

type Pick =
  | { kind: 'cell'; roomId: string; start: string }
  | { kind: 'lessons'; lessons: Lesson[] }

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

      <DayGrid
        rooms={day?.rooms ?? []}
        selected={pick?.kind === 'cell' ? pick : null}
        onPickCell={(roomId, start) => setPick({ kind: 'cell', roomId, start })}
        onPickLesson={(lessons) => setPick({ kind: 'lessons', lessons })}
      />

      {pick?.kind === 'cell' && (
        <BookingPanel
          key={`${pick.roomId}-${pick.start}`}
          date={date}
          roomId={pick.roomId}
          start={pick.start}
          tutors={tutors}
          onBooked={() => { setPick(null); reload() }}
          onChanged={reload}
          onCancel={() => setPick(null)}
        />
      )}

      {pick?.kind === 'lessons' && (
        <LessonDetails key={pick.lessons[0].id} lessons={pick.lessons} onClose={() => setPick(null)} />
      )}
    </main>
  )
}
