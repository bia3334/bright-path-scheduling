import { useEffect, useState, type FormEvent } from 'react'

// Shapes of what the booking API returns. Times are "HH:MM:SS", dates "YYYY-MM-DD".
type Status = 'booked' | 'cancelled' | 'no_show'

interface Lesson {
  id: string
  date: string
  start: string
  durationMin: number
  end: string
  student: string
  tutorId: string
  tutorName: string
  roomId: string
  status: Status
  pairId: string | null
  note: string | null
}

interface Room {
  id: string
  lessons: Lesson[]
}

interface Day {
  date: string
  rooms: Room[]
}

interface Tutor {
  id: string
  name: string
  subject: string
}

interface ImportReport {
  loaded: number
  refused: Record<string, string[]>
}

interface Draft {
  roomId: string
  start: string
  student: string
  tutorId: string
  durationMin: 60 | 90
  pair: boolean
}

// The centre runs 09:00 to 21:30, so the grid is 25 half-hour columns.
const SLOTS: string[] = Array.from({ length: 25 }, (_, i) => {
  const m = 9 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

const column = (start: string): number => {
  const [h, m] = start.split(':').map(Number)
  return (h * 60 + m - 9 * 60) / 30 + 2 // +1 for the room label column, +1 for 1-based grid
}

const hhmm = (t: string): string => t.slice(0, 5)

const weekday = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })

export default function App() {
  const [date, setDate] = useState('2026-03-06')
  const [day, setDay] = useState<Day | null>(null)
  const [tutors, setTutors] = useState<Tutor[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [reasons, setReasons] = useState<string[]>([])
  const [report, setReport] = useState<ImportReport | null>(null)
  const [offline, setOffline] = useState(false)

  const loadDay = () =>
    fetch(`/api/days/${date}`)
      .then((r) => (r.ok ? (r.json() as Promise<Day>) : Promise.reject(r.status)))
      .then((d) => { setDay(d); setOffline(false) })
      .catch(() => { setDay(null); setOffline(true) })

  const loadTutors = () =>
    fetch('/api/tutors').then((r) => r.json() as Promise<Tutor[]>).then(setTutors).catch(() => setTutors([]))

  useEffect(() => { loadDay() }, [date])

  useEffect(() => { loadTutors() }, [])

  const changeDate = (next: string) => {
    setDate(next)
    setDraft(null)
    setReasons([])
  }

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!draft) return
    const body = {
      date,
      start: draft.start,
      durationMin: draft.durationMin,
      student: draft.student,
      tutorId: draft.tutorId,
      roomId: draft.roomId,
      pairId: draft.pair ? `${date}_${draft.start}_${draft.tutorId}` : null,
    }
    const res = await fetch('/api/lessons', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      setDraft(null)
      setReasons([])
      loadDay()
    } else {
      const problem = (await res.json().catch(() => ({}))) as { reasons?: string[] }
      setReasons(problem.reasons ?? [`the booking was refused (HTTP ${res.status})`])
    }
  }

  const importCsv = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const lessons = form.get('lessons')
    if (!(lessons instanceof File) || !lessons.name) return
    const res = await fetch('/api/import', { method: 'POST', body: form })
    if (res.ok) {
      setReport((await res.json()) as ImportReport)
    } else {
      const isJson = res.headers.get('content-type')?.includes('json')
      const why = isJson ? ((await res.json()) as { reasons?: string[] }).reasons : undefined
      setReport({ loaded: 0, refused: { import: why ?? [`backend not reachable (HTTP ${res.status})`] } })
    }
    formEl.reset()
    loadDay()
    loadTutors()
  }

  const openDraft = (roomId: string, start: string) => {
    setReasons([])
    setDraft({
      roomId,
      start,
      student: '',
      tutorId: tutors[0]?.id ?? '',
      durationMin: 60,
      pair: false,
    })
  }

  const rooms = day?.rooms ?? []

  return (
    <main>
      <header>
        <h1>Bright Path<small>Day grid</small></h1>
        <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
        <span className="weekday">{weekday(date)}</span>
        <span className="hint">Click an empty cell to book</span>
      </header>

      <form className="import" onSubmit={importCsv}>
        <label>lessons_export.csv <input type="file" name="lessons" accept=".csv" required /></label>
        <label>tutors.csv <input type="file" name="tutors" accept=".csv" /></label>
        <button type="submit">Import</button>
        {report && (
          <span className="report">
            {report.loaded} loaded, {Object.keys(report.refused).length} refused
            {Object.entries(report.refused).map(([id, why]) => (
              <em key={id}>{id}: {why.join('; ')}</em>
            ))}
          </span>
        )}
      </form>

      <div className="legend">
        <span><i className="sw" /> booked</span>
        <span><i className="sw pair" /> exam pair</span>
        <span><i className="sw cancelled" /> cancelled</span>
        <span><i className="sw no_show" /> no show</span>
      </div>

      {offline && (
        <p className="offline">The booking service is not reachable. Start it with <code>./dev-up.sh</code> and reload.</p>
      )}

      <div className="board">
        <div className="grid">
          {SLOTS.map((s) => (
            <div key={`h${s}`} className="hour" style={{ gridColumn: column(s), gridRow: 1 }}>
              {s.endsWith(':00') ? s : ''}
            </div>
          ))}

          {rooms.map((room, r) => (
            <div key={room.id} className="room" style={{ gridColumn: 1, gridRow: r + 2 }}>
              {room.id}
            </div>
          ))}

          {rooms.flatMap((room, r) =>
            SLOTS.map((s) => {
              const selected = draft !== null && draft.roomId === room.id && draft.start === s
              return (
                <button
                  key={`${room.id}${s}`}
                  className={`cell${s.endsWith(':00') ? ' hour-start' : ''}${selected ? ' selected' : ''}`}
                  style={{ gridColumn: column(s), gridRow: r + 2 }}
                  onClick={() => openDraft(room.id, s)}
                  aria-label={`${room.id} at ${s}`}
                />
              )
            }),
          )}

          {rooms.flatMap((room, r) =>
            room.lessons.map((l) => (
              <div
                key={l.id}
                className={`chip ${l.status}${l.pairId ? ' paired' : ''}`}
                style={{
                  gridColumn: `${column(hhmm(l.start))} / span ${l.durationMin / 30}`,
                  gridRow: r + 2,
                }}
                title={`${l.id} · ${hhmm(l.start)}–${hhmm(l.end)}${l.note ? ' · ' + l.note : ''}`}
              >
                <b>{l.student}</b>
                <i>
                  {l.tutorName}
                  {l.pairId && ' · exam pair'}
                  {l.status === 'cancelled' && ' · cancelled'}
                  {l.status === 'no_show' && ' · no show'}
                </i>
              </div>
            )),
          )}
        </div>
      </div>

      {draft && (
        <form className="panel" onSubmit={submit}>
          <h2>
            New lesson <span>· {draft.roomId} at {draft.start}, {weekday(date)} {date}</span>
          </h2>
          <label>
            Student
            <input
              autoFocus
              value={draft.student}
              onChange={(e) => setDraft({ ...draft, student: e.target.value })}
            />
          </label>
          <label>
            Tutor
            <select
              value={draft.tutorId}
              onChange={(e) => setDraft({ ...draft, tutorId: e.target.value })}
            >
              {tutors.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.subject})
                </option>
              ))}
            </select>
          </label>
          <label>
            Length
            <select
              value={draft.durationMin}
              onChange={(e) => setDraft({ ...draft, durationMin: Number(e.target.value) === 90 ? 90 : 60 })}
            >
              <option value={60}>60 minutes</option>
              <option value={90}>90 minutes</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={draft.pair}
              onChange={(e) => setDraft({ ...draft, pair: e.target.checked })}
            />
            Exam pair (two students, half price)
          </label>
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          <div className="actions">
            <button type="submit">Book</button>
            <button type="button" onClick={() => setDraft(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </main>
  )
}
