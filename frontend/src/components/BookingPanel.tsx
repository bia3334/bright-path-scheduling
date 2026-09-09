import { useState, type FormEvent } from 'react'
import { ApiRefused, createLesson } from '../api/client'
import type { Tutor } from '../api/types'
import { weekday } from '../lib/time'

interface Props {
  date: string
  roomId: string
  start: string
  tutors: Tutor[]
  onBooked: () => void
  onCancel: () => void
}

/** The form for one empty cell. A refusal shows its reasons here, next to the fields. */
export default function BookingPanel({ date, roomId, start, tutors, onBooked, onCancel }: Props) {
  const [student, setStudent] = useState('')
  const [tutorId, setTutorId] = useState(tutors[0]?.id ?? '')
  const [durationMin, setDurationMin] = useState<60 | 90>(60)
  const [pair, setPair] = useState(false)
  const [reasons, setReasons] = useState<string[]>([])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      await createLesson({
        date, start, durationMin, student, tutorId, roomId,
        pairId: pair ? `${date}_${start}_${tutorId}` : null,
      })
      onBooked()
    } catch (err) {
      setReasons(err instanceof ApiRefused ? err.reasons : ['the booking was refused'])
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>
        New lesson <span>· {roomId} at {start}, {weekday(date)} {date}</span>
      </h2>
      <label>
        Student
        <input autoFocus value={student} onChange={(e) => setStudent(e.target.value)} />
      </label>
      <label>
        Tutor
        <select value={tutorId} onChange={(e) => setTutorId(e.target.value)}>
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.subject})</option>
          ))}
        </select>
      </label>
      <label>
        Length
        <select value={durationMin} onChange={(e) => setDurationMin(e.target.value === '90' ? 90 : 60)}>
          <option value={60}>60 minutes</option>
          <option value={90}>90 minutes</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={pair} onChange={(e) => setPair(e.target.checked)} />
        Exam pair (two students, half price)
      </label>
      <ul className="reasons">
        {reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <div className="actions">
        <button type="submit">Book</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
