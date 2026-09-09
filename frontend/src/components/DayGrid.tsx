import type { Room } from '../api/types'
import { SLOTS, column, hhmm } from '../lib/time'

interface Props {
  rooms: Room[]
  selected: { roomId: string; start: string } | null
  onPickCell: (roomId: string, start: string) => void
}

/** Rooms by half-hour. Every empty cell is a button; lessons are chips laid over the cells. */
export default function DayGrid({ rooms, selected, onPickCell }: Props) {
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
          room.lessons.map((l) => (
            <div
              key={l.id}
              className={`chip ${l.status}${l.pairId ? ' paired' : ''}`}
              style={{ gridColumn: `${column(hhmm(l.start))} / span ${l.durationMin / 30}`, gridRow: r + 2 }}
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
  )
}
