import type { Lesson, Room } from '../api/types'
import { SLOTS, column, hhmm } from '../lib/time'

interface Props {
  rooms: Room[]
  selected: { roomId: string; start: string } | null
  onPickCell: (roomId: string, start: string) => void
  onPickLesson: (lessons: Lesson[]) => void
}

/** The two halves of an exam pair share a pair id and are drawn as one chip. */
function chips(lessons: Lesson[]): Lesson[][] {
  const byPair = new Map<string, Lesson[]>()
  for (const l of lessons) {
    const key = l.pairId ?? l.id
    byPair.set(key, [...(byPair.get(key) ?? []), l])
  }
  return [...byPair.values()]
}

/** Rooms by half-hour. Every empty cell is a button; lessons are chips laid over the cells. */
export default function DayGrid({ rooms, selected, onPickCell, onPickLesson }: Props) {
  return (
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
            const isSelected = selected?.roomId === room.id && selected?.start === s
            return (
              <button
                key={`${room.id}${s}`}
                className={`cell${s.endsWith(':00') ? ' hour-start' : ''}${isSelected ? ' selected' : ''}`}
                style={{ gridColumn: column(s), gridRow: r + 2 }}
                onClick={() => onPickCell(room.id, s)}
                aria-label={`${room.id} at ${s}`}
              />
            )
          }),
        )}

        {rooms.flatMap((room, r) =>
          chips(room.lessons).map((group) => {
            const l = group[0]
            const pair = group.length > 1 || l.pairId !== null
            return (
              <button
                key={l.id}
                type="button"
                className={`chip ${l.status}${pair ? ' paired' : ''}`}
                style={{ gridColumn: `${column(hhmm(l.start))} / span ${l.durationMin / 30}`, gridRow: r + 2 }}
                title={`${group.map((x) => x.id).join(' + ')} · ${hhmm(l.start)}–${hhmm(l.end)}${l.note ? ' · ' + l.note : ''}`}
                onClick={() => onPickLesson(group)}
              >
                <b>{group.map((x) => x.student).join(' + ')}</b>
                <i>
                  {l.tutorName}
                  {pair && (group.length > 1 ? ' · exam pair' : ' · exam pair, one student so far')}
                  {l.status === 'cancelled' && ' · cancelled'}
                  {l.status === 'no_show' && ' · no show'}
                </i>
              </button>
            )
          }),
        )}
      </div>
    </div>
  )
}
