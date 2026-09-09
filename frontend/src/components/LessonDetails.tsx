import type { Lesson } from '../api/types'
import { hhmm, weekday } from '../lib/time'

interface Props {
  lessons: Lesson[]   // one lesson, or the two halves of an exam pair
  onClose: () => void
}

/** Read-only view of a booked chip. Nothing here can be edited: cancel and move are not built yet. */
export default function LessonDetails({ lessons, onClose }: Props) {
  const first = lessons[0]
  return (
    <section className="panel details">
      <h2>
        {lessons.length > 1 ? 'Exam pair' : 'Lesson'}{' '}
        <span>· {first.roomId} at {hhmm(first.start)}–{hhmm(first.end)}, {weekday(first.date)} {first.date}</span>
      </h2>
      <dl>
        {lessons.map((l) => (
          <div key={l.id}>
            <dt>{l.id}</dt>
            <dd>
              <b>{l.student}</b> with {l.tutorName}
              {l.status !== 'booked' && <> · {l.status === 'no_show' ? 'no show' : 'cancelled'}</>}
              {l.note && <> · {l.note}</>}
            </dd>
          </div>
        ))}
      </dl>
      <p className="muted">Cancelling or moving a lesson is not built yet; see DECISIONS.md.</p>
      <div className="actions">
        <button type="button" onClick={onClose}>Close</button>
      </div>
    </section>
  )
}
