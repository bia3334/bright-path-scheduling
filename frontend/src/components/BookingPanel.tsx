import { useState, type FormEvent } from 'react'
import { ApiRefused, createLesson } from '../api/client'
import type { Tutor } from '../api/types'
import { weekday } from '../lib/time'

interface Props {
  date: string
  roomId: string
  start: string
  tutors: Tutor[]
  onBooked: () => void   // everything went in: close the panel
  onChanged: () => void  // something went in: redraw the grid, keep the panel
  onCancel: () => void
}

/**
 * The form for one empty cell. An exam pair is two lessons that share a pair id,
 * so the form asks for two students and books them one after the other.
 * A refusal shows its reasons here, next to the fields.
 */
export default function BookingPanel({ date, roomId, start, tutors, onBooked, onChanged, onCancel }: Props) {
  const [student, setStudent] = useState('')
  const [second, setSecond] = useState('')
  const [tutorId, setTutorId] = useState(tutors[0]?.id ?? '')
  const [durationMin, setDurationMin] = useState<60 | 90>(60)
  const [pair, setPair] = useState(false)
  const [reasons, setReasons] = useState<string[]>([])

  const reasonsOf = (err: unknown) => (err instanceof ApiRefused ? err.reasons : ['the booking was refused'])

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const pairId = pair ? `${date}_${start}_${tutorId}` : null
    const lesson = (name: string) => createLesson({ date, start, durationMin, student: name, tutorId, roomId, pairId })

    try {
      await lesson(student)
    } catch (err) {
      setReasons(reasonsOf(err))
      return
    }
    if (!pair) {
      onBooked()
      return
    }
    try {
      await lesson(second)
      onBooked()
    } catch (err) {
      onChanged()
      setReasons([`${student} is booked. ${second} was refused:`, ...reasonsOf(err)])
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>
        New lesson <span>· {roomId} at {start}, {weekday(date)} {date}</span>
      </h2>
      <label>
        Student
        <input autoFocus required value={student} onChange={(e) => setStudent(e.target.value)} />
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
        Exam pair: two students, one tutor, one room, half price
      </label>
      {pair && (
        <label>
          Second student
          <input required value={second} onChange={(e) => setSecond(e.target.value)} />
        </label>
      )}
      <ul className="reasons">
        {reasons.map((r) => <li key={r}>{r}</li>)}
      </ul>
      <div className="actions">
        <button type="submit">{pair ? 'Book both' : 'Book'}</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
