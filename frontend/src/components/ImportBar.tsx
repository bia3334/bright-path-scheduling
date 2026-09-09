import { useState, type FormEvent } from 'react'
import { ApiRefused, importCsv } from '../api/client'
import type { ImportReport } from '../api/types'

interface Props {
  onImported: () => void
}

/** Upload the two front-desk CSVs. The report shows what loaded and what the rules refused. */
export default function ImportBar({ onImported }: Props) {
  const [report, setReport] = useState<ImportReport | null>(null)

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const lessons = form.get('lessons')
    if (!(lessons instanceof File) || !lessons.name) return
    try {
      setReport(await importCsv(form))
    } catch (err) {
      const reasons = err instanceof ApiRefused ? err.reasons : ['backend not reachable']
      setReport({ loaded: 0, refused: { import: reasons } })
    }
    formEl.reset()
    onImported()
  }

  return (
    <form className="import" onSubmit={submit}>
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
  )
}
