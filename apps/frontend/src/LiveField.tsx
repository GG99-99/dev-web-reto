import { useEffect, useMemo, useState } from 'react'
import type { AskValue, FormTemplateTree } from '@reto/shared'
import { catalogsService, evidencesService, formExecutionService, institutionsService } from './services'
import type { Evaluation } from './App'
import './App.css'

type LiveFieldProps = {
  item?: Evaluation
  live: boolean
  inform: (message: string) => void
}

type Question = { key: string; txt: string }
type AnswerMap = Record<string, AskValue>

function flattenQuestions(template: FormTemplateTree | null): Question[] {
  if (!template) return []
  const questions: Question[] = []
  for (const h1 of template.h1s ?? []) {
    for (const ask of h1.h1Asks ?? []) questions.push({ key: `h1_ask:${ask.h1AskId}`, txt: ask.name })
    for (const h2 of h1.h2s ?? []) {
      for (const ask of h2.h2Asks ?? []) questions.push({ key: `h2_ask:${ask.h2AskId}`, txt: ask.name })
      for (const h3 of h2.h3s ?? []) {
        for (const ask of h3.h3Asks ?? []) questions.push({ key: `h3_ask:${ask.h3AskId}`, txt: ask.name })
        for (const h4 of h3.h4s ?? []) {
          for (const ask of h4.h4Asks ?? []) questions.push({ key: `h4_ask:${ask.h4AskId}`, txt: ask.name })
        }
      }
    }
  }
  return questions
}

export default function LiveField({ item, live, inform }: LiveFieldProps) {
  const [template, setTemplate] = useState<FormTemplateTree | null>(null)
  const [answers, setAnswers] = useState<AnswerMap>({})
  const [note, setNote] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [representatives, setRepresentatives] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [foods, setFoods] = useState<any[]>([])
  const [representId, setRepresentId] = useState('')
  const [foodId, setFoodId] = useState('')
  const [busy, setBusy] = useState(false)
  const [started, setStarted] = useState(item?.status === 'EN_PROCESO' || item?.status === 'FINALIZADA')
  const [finished, setFinished] = useState(item?.status === 'FINALIZADA')

  useEffect(() => {
    if (!live || !item) return
    let cancelled = false
    void formExecutionService.getTemplateTree(1).then((result) => {
      if (!cancelled && result.valid) setTemplate(result.data)
    }).catch(() => {
      if (!cancelled) inform('The assessment template could not be loaded.')
    })
    const institutionId = (item as any).institutionId ?? (item as any).institution?.institutionId
    if (institutionId) void institutionsService.getById(institutionId).then((result) => {
      if (!cancelled && result.valid) setRepresentatives(result.data.representantes ?? [])
    }).catch(() => !cancelled && inform('The institution representatives could not be loaded.'))
    void catalogsService.listCategories().then((result) => {
      if (!cancelled && result.valid) setCategories(result.data)
    }).catch(() => !cancelled && inform('The food catalog could not be loaded.'))
    return () => { cancelled = true }
  }, [inform, item, live])

  const questions = useMemo(() => flattenQuestions(template), [template])
  const answered = Object.keys(answers).length
  const setAnswer = (question: Question, value: AskValue) => {
    setAnswers((current) => ({ ...current, [question.key]: value }))
  }

  async function chooseCategory(categoryId: string) {
    setFoodId('')
    if (!categoryId) { setFoods([]); return }
    try { const result = await catalogsService.listFoods(Number(categoryId)); if (result.valid) setFoods(result.data) } catch { inform('The foods for this category could not be loaded.') }
  }

  async function startAssessment() {
    if (!item) return
    if (!representId || !foodId) { inform('Select the institution representative and food before starting.'); return }
    setBusy(true)
    try {
      const result = await formExecutionService.start(item.evaluationId, { representId: Number(representId), foodId: Number(foodId) })
      if (!result.valid) { inform(result.error.message); return }
      setStarted(true)
      inform('Assessment started. Your progress can now be saved.')
    } catch { inform('The assessment could not be started. Check that its representative and food records are configured.') } finally { setBusy(false) }
  }

  async function saveProgress() {
    if (!item) return
    setBusy(true)
    try {
      const result = await formExecutionService.saveAnswers(item.evaluationId, {
        answers: questions.filter((question) => answers[question.key]).map((question) => ({
          key: question.key,
          txt: question.txt,
          value: answers[question.key],
        })),
      })
      if (!result.valid) { inform(result.error.message); return }
      inform('Progress saved.')
    } catch { inform('Progress could not be saved. Check your connection and try again.') } finally { setBusy(false) }
  }

  async function uploadEvidence() {
    if (!item || !file) { inform('Choose a photo, video, or document first.'); return }
    setBusy(true)
    try {
      const result = await evidencesService.upload(item.evaluationId, { file, type: file.type.startsWith('video/') ? 'VIDEO' : file.type.startsWith('image/') ? 'FOTO' : 'DOCUMENTO', comment: note || undefined })
      if (!result.valid) { inform(result.error.message); return }
      setFile(null)
      inform('Evidence uploaded.')
    } catch { inform('Evidence could not be uploaded.') } finally { setBusy(false) }
  }

  async function finishAssessment() {
    if (!item) return
    setBusy(true)
    try {
      const result = await formExecutionService.finish(item.evaluationId)
      if (!result.valid) { inform(result.error.message); return }
      setFinished(true)
      inform(`Assessment finished. Risk level: ${result.data.score.nivelRiesgo}.`)
    } catch { inform('The assessment could not be finished. Complete applicable questions first.') } finally { setBusy(false) }
  }

  if (!live) return <section className="field"><div className="empty">Preview mode does not write assessment data. Sign in as a technician to use the live form.</div></section>
  if (!item) return <section className="field"><div className="empty">No assigned assessment is available.</div></section>

  return <section className="field">
    <div className="field-heading"><div><small className="eyebrow">Field assessment · #{item.evaluationId}</small><h1>{item.institution?.name ?? 'Assessment workspace'}</h1><p>{item.scheduledDate} · {item.status}</p></div><span className="connected">● Connected</span></div>
    <div className="progress"><span><b>Assessment progress</b><small>{answered}/{questions.length || 0} questions assessed</small></span><progress value={answered} max={questions.length || 1} /></div>
    {!started && <section className="card field-start"><small className="eyebrow">Assessment setup</small><h2>Confirm what is being assessed</h2><p>Select the organisation contact present at the visit and the food being evaluated. Both are stored with the assessment.</p><div><label>Institution representative<select value={representId} onChange={(event) => setRepresentId(event.target.value)}><option value="">Select representative</option>{representatives.map((representative) => <option key={representative.representId} value={representative.representId}>{representative.person?.name ?? `Representative #${representative.representId}`} · {representative.type}</option>)}</select></label><label>Food category<select defaultValue="" onChange={(event) => void chooseCategory(event.target.value)}><option value="">Select category</option>{categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label><label>Food<select value={foodId} onChange={(event) => setFoodId(event.target.value)}><option value="">Select food</option>{foods.map((food) => <option key={food.foodId} value={food.foodId}>{food.name}</option>)}</select></label></div><button className="primary" disabled={busy || !representId || !foodId} onClick={() => void startAssessment()}>Start assessment →</button></section>}
    <div className="field-grid"><div>{questions.map((question) => <article className={`checkpoint ${answers[question.key] === 'NC' ? 'nonconformity' : ''}`} key={question.key}><small>{question.key}</small><h2>{question.txt}</h2><div>{(['C', 'CP', 'NC', 'N/A'] as AskValue[]).map((value) => <button type="button" key={value} className={answers[question.key] === value ? 'chosen' : ''} disabled={!started || finished || busy} onClick={() => setAnswer(question, value)}><b>{value}</b><small>{value === 'C' ? 'Compliant' : value === 'CP' ? 'Partially compliant' : value === 'NC' ? 'Non-compliant' : 'Not applicable'}</small></button>)}</div></article>)}</div>
      <aside className="card evidence"><small className="eyebrow">Finding details</small><h2>Capture evidence</h2><label>Observation<textarea value={note} onChange={(event) => setNote(event.target.value)} disabled={!started || finished || busy} /></label><label className="drop"><input type="file" accept="image/*,video/*,.pdf,.doc,.docx" disabled={!started || finished || busy} onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><b>{file?.name ?? 'Add photo, video, or document'}</b></label><button type="button" className="secondary" disabled={!started || finished || busy || !file} onClick={() => void uploadEvidence()}>Upload evidence</button><button type="button" className="secondary" disabled={!started || finished || busy || answered === 0} onClick={() => void saveProgress()}>Save progress</button><button type="button" className="primary" disabled={!started || finished || busy || answered === 0} onClick={() => void finishAssessment()}>Finish assessment →</button></aside>
    </div>
  </section>
}
