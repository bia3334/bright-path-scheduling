import type { Day, ImportReport, Lesson, NewLesson, Tutor } from './types'

/** Every refusal from the API, in code or from a database constraint, has this shape. */
export class ApiRefused extends Error {
  constructor(public status: number, public reasons: string[]) {
    super(reasons.join('; '))
  }
}

async function refusedFrom(res: Response, fallback: string): Promise<ApiRefused> {
  const isJson = res.headers.get('content-type')?.includes('json')
  const body = isJson ? ((await res.json().catch(() => ({}))) as { reasons?: string[] }) : {}
  return new ApiRefused(res.status, body.reasons ?? [`${fallback} (HTTP ${res.status})`])
}

export async function getDay(date: string): Promise<Day> {
  const res = await fetch(`/api/days/${date}`)
  if (!res.ok) throw await refusedFrom(res, 'booking service not reachable')
  return res.json() as Promise<Day>
}

export async function getTutors(): Promise<Tutor[]> {
  const res = await fetch('/api/tutors')
  if (!res.ok) throw await refusedFrom(res, 'booking service not reachable')
  return res.json() as Promise<Tutor[]>
}

export async function createLesson(body: NewLesson): Promise<Lesson> {
  const res = await fetch('/api/lessons', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await refusedFrom(res, 'the booking was refused')
  return res.json() as Promise<Lesson>
}

/** Multipart: "lessons" (required) and "tutors" (optional), in the front-desk export format. */
export async function importCsv(form: FormData): Promise<ImportReport> {
  const res = await fetch('/api/import', { method: 'POST', body: form })
  if (!res.ok) throw await refusedFrom(res, 'backend not reachable')
  return res.json() as Promise<ImportReport>
}
