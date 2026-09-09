import { useEffect, useState } from 'react'

// The centre runs 09:00 to 21:30, so the grid is 25 half-hour columns.
const SLOTS = Array.from({ length: 25 }, (_, i) => {
  const m = 9 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
})

const column = (start) => {
  const [h, m] = start.split(':').map(Number)
  return (h * 60 + m - 9 * 60) / 30 + 2 // +1 for the room label column, +1 for 1-based grid
}

const weekday = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long' })

export default function App() {
  const [date, setDate] = useState('2026-03-06')
  const [day, setDay] = useState(null)
  const [tutors, setTutors] = useState([])
  const [draft, setDraft] = useState(null)
  const [reasons, setReasons] = useState([])

  const loadDay = () => fetch(`/api/days/${date}`).then((r) => r.json()).then(setDay)

  useEffect(() => { loadDay() }, [date])

  useEffect(() => {
    fetch('/api/tutors').then((r) => r.json()).then(setTutors)
  }, [])

  const changeDate = (next) => {
    setDate(next)
    setDraft(null)
    setReasons([])
  }

  const submit = async (e) => {
    e.preventDefault()
    const body = {
      date,
      start: draft.start,
      durationMin: Number(draft.durationMin),
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
      const problem = await res.json()
      setReasons(problem.reasons ?? ['the booking was refused'])
    }
  }

  const openDraft = (roomId, start) => {
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

  return (
    <main>
      <header>
        <h1>Bright Path</h1>
        <input type="date" value={date} onChange={(e) => changeDate(e.target.value)} />
        <span className="weekday">{weekday(date)}</span>
      </header>

      <div className="grid">
        {SLOTS.map((s) => (
          <div key={`h${s}`} className="hour" style={{ gridColumn: column(s), gridRow: 1 }}>
            {s.endsWith(':00') ? s : ''}
          </div>
        ))}

        {(day?.rooms ?? []).map((room, r) => (
          <div key={room.id} className="room" style={{ gridColumn: 1, gridRow: r + 2 }}>
            {room.id}
          </div>
        ))}

        {(day?.rooms ?? []).flatMap((room, r) =>
          SLOTS.map((s) => (
            <button
              key={`${room.id}${s}`}
              className="cell"
              style={{ gridColumn: column(s), gridRow: r + 2 }}
              onClick={() => openDraft(room.id, s)}
            />
          )),
        )}

        {(day?.rooms ?? []).flatMap((room, r) =>
          room.lessons.map((l) => (
            <div
              key={l.id}
              className={`chip ${l.status}`}
              style={{
                gridColumn: `${column(l.start)} / span ${l.durationMin / 30}`,
                gridRow: r + 2,
              }}
              title={`${l.id} ${l.start}-${l.end} ${l.note ?? ''}`}
            >
              <b>{l.student}</b> {l.tutorName}
              {l.pairId && <span className="pair">pair</span>}
            </div>
          )),
        )}
      </div>

      {draft && (
        <form className="panel" onSubmit={submit}>
          <h2>
            {draft.roomId} at {draft.start}
          </h2>
          <input
            placeholder="student"
            value={draft.student}
            onChange={(e) => setDraft({ ...draft, student: e.target.value })}
          />
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
          <select
            value={draft.durationMin}
            onChange={(e) => setDraft({ ...draft, durationMin: e.target.value })}
          >
            <option value={60}>60 min</option>
            <option value={90}>90 min</option>
          </select>
          <label>
            <input
              type="checkbox"
              checked={draft.pair}
              onChange={(e) => setDraft({ ...draft, pair: e.target.checked })}
            />
            exam pair
          </label>
          <button type="submit">Book</button>
          <button type="button" onClick={() => setDraft(null)}>
            Cancel
          </button>
          <ul className="reasons">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </form>
      )}
    </main>
  )
}
