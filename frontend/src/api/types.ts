// Shapes of what the booking API returns. Times are "HH:MM:SS", dates "YYYY-MM-DD".
export type Status = 'booked' | 'cancelled' | 'no_show'

export interface Lesson {
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

export interface Room {
  id: string
  lessons: Lesson[]
}

export interface Day {
  date: string
  rooms: Room[]
}

export interface Tutor {
  id: string
  name: string
  subject: string
}

export interface NewLesson {
  date: string
  start: string
  durationMin: 60 | 90
  student: string
  tutorId: string
  roomId: string
  pairId: string | null
}

export interface ImportReport {
  loaded: number
  refused: Record<string, string[]>
}
