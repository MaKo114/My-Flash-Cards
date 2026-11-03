import { useState, type FormEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Card, CardFields } from '@/lib/cards'

const partsOfSpeech = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'determiner', 'phrase']
const partOptions = [...partsOfSpeech.map(item => ({ value: item, label: item })), { value: 'other', label: 'อื่น ๆ' }]
const errorBorder = 'border-red-400 focus:border-red-500 focus:ring-red-100'
const textareaClass = 'mt-2 block w-full rounded-xl border bg-surface px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none focus:ring-2'

type FieldErrors = { word?: string; parts?: string; meanings?: string }

function FieldError({ id, message }: { id?: string; message?: string }) {
  return message ? <p id={id} className="mt-1.5 text-sm font-medium text-red-700">{message}</p> : null
}

// The add/edit form shown inside a dialog. `card` is null when adding a new word.
export function CardEditor({ card, onCancel, onSave }: {
  card: Card | null
  onCancel: () => void
  onSave: (fields: CardFields) => Promise<void>
}) {
  const [fields, setFields] = useState<CardFields>({
    word: card?.word ?? '',
    partsOfSpeech: card?.partsOfSpeech ?? [''],
    meanings: card?.meanings ?? [''],
    hint: card?.hint ?? '',
    example: card?.example ?? '',
  })
  // What each part-of-speech dropdown shows; "other" reveals a free-text box.
  const [partSelections, setPartSelections] = useState(() =>
    (card?.partsOfSpeech ?? ['']).map(part => part && !partsOfSpeech.includes(part.toLowerCase()) ? 'other' : part.toLowerCase()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function update(patch: Partial<CardFields>, clear?: keyof FieldErrors) {
    setFields(previous => ({ ...previous, ...patch }))
    if (clear) setFieldErrors(previous => ({ ...previous, [clear]: undefined }))
  }

  function setPart(index: number, value: string, selection = value) {
    update({ partsOfSpeech: fields.partsOfSpeech.map((part, at) => at === index ? value : part) }, 'parts')
    setPartSelections(previous => previous.map((part, at) => at === index ? selection : part))
  }

  function addPart() {
    update({ partsOfSpeech: [...fields.partsOfSpeech, ''] })
    setPartSelections(previous => [...previous, ''])
  }

  function removePart(index: number) {
    update({ partsOfSpeech: fields.partsOfSpeech.filter((_, at) => at !== index) })
    setPartSelections(previous => previous.filter((_, at) => at !== index))
  }

  function partFieldId(index: number) {
    if (partSelections[index] === 'other') return `card-part-of-speech-other-${index}`
    return index === 0 ? 'card-part-of-speech' : `card-part-of-speech-${index}`
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    // Validate in Thai instead of relying on the browser's built-in (English) messages.
    const missingPart = fields.partsOfSpeech.findIndex(part => !part.trim())
    const errors: FieldErrors = {
      word: fields.word.trim() ? undefined : 'กรุณากรอกคำศัพท์ภาษาอังกฤษ',
      parts: missingPart === -1 ? undefined : 'กรุณาเลือกชนิดของคำให้ครบ',
      meanings: fields.meanings.some(meaning => meaning.trim()) ? undefined : 'กรุณากรอกความหมายอย่างน้อยหนึ่งความหมาย',
    }
    setFieldErrors(errors)
    if (errors.word || errors.parts || errors.meanings) {
      setError('')
      const firstInvalid = errors.word ? 'card-word' : errors.parts ? partFieldId(missingPart) : 'card-meanings'
      document.getElementById(firstInvalid)?.focus()
      return
    }
    setSaving(true)
    setError('')
    try { await onSave(fields) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <div>
        <DialogTitle className="text-xl font-bold text-slate-900">{card ? 'แก้ไขคำศัพท์' : 'เพิ่มคำศัพท์ใหม่'}</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">เติมรายละเอียดเพื่อสร้างบัตรคำศัพท์ของคุณ</DialogDescription>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="card-word" className="block text-sm font-semibold text-slate-700">คำศัพท์ภาษาอังกฤษ</label>
          <Input
            id="card-word"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={fields.word}
            onChange={event => update({ word: event.target.value }, 'word')}
            placeholder="เช่น Serendipity"
            aria-invalid={!!fieldErrors.word}
            aria-describedby={fieldErrors.word ? 'card-word-error' : undefined}
            className={`mt-2 ${fieldErrors.word ? errorBorder : ''}`}
          />
          <FieldError id="card-word-error" message={fieldErrors.word} />
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700">ชนิดของคำ</p>
          <div className="mt-2 space-y-2">
            {fields.partsOfSpeech.map((part, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <Select
                    id={index === 0 ? 'card-part-of-speech' : `card-part-of-speech-${index}`}
                    label={index === 0 ? 'ชนิดของคำ' : `ชนิดของคำ ${index + 1}`}
                    value={partSelections[index]}
                    onValueChange={value => setPart(index, value === 'other' ? '' : value, value)}
                    required
                    placeholder="เลือกชนิดของคำ"
                    options={partOptions}
                    className="h-11 w-full"
                  />
                  {partSelections[index] === 'other' && (
                    <Input
                      id={`card-part-of-speech-other-${index}`}
                      aria-label={`ระบุชนิดของคำ ${index + 1}`}
                      value={part}
                      onChange={event => setPart(index, event.target.value, 'other')}
                      placeholder="ระบุชนิดของคำ"
                      className="mt-2"
                    />
                  )}
                </div>
                {fields.partsOfSpeech.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" aria-label={`ลบชนิดของคำ ${index + 1}`} onClick={() => removePart(index)}>
                    <X size={16} />
                  </Button>
                )}
              </div>
            ))}
          </div>
          <FieldError message={fieldErrors.parts} />
          <Button type="button" variant="ghost" size="sm" onClick={addPart} className="mt-2"><Plus size={15} /> เพิ่มชนิดของคำ</Button>
        </div>

        <div>
          <label htmlFor="card-meanings" className="block text-sm font-semibold text-slate-700">ความหมายภาษาไทย</label>
          <textarea
            id="card-meanings"
            value={fields.meanings.join('\n')}
            onChange={event => update({ meanings: event.target.value.split('\n') }, 'meanings')}
            placeholder="หนึ่งความหมายต่อบรรทัด"
            rows={3}
            aria-invalid={!!fieldErrors.meanings}
            aria-describedby={fieldErrors.meanings ? 'card-meanings-error' : undefined}
            className={`${textareaClass} ${fieldErrors.meanings ? errorBorder : 'border-slate-200 focus:border-teal-500 focus:ring-teal-100'}`}
          />
          <FieldError id="card-meanings-error" message={fieldErrors.meanings} />
          <p className="mt-1 text-xs text-slate-500">ขึ้นบรรทัดใหม่เพื่อเพิ่มความหมาย ไม่จำเป็นต้องเรียงให้ตรงกับชนิดของคำ</p>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          คำใบ้ <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
          <Input value={fields.hint} onChange={event => update({ hint: event.target.value })} placeholder="เช่น ผลไม้สีแดง" className="mt-2" />
        </label>

        <div>
          <label htmlFor="card-example" className="block text-sm font-semibold text-slate-700">
            ตัวอย่างประโยค <span className="font-normal text-slate-400">(ไม่บังคับ)</span>
          </label>
          <textarea
            id="card-example"
            lang="en"
            value={fields.example}
            onChange={event => update({ example: event.target.value })}
            placeholder="เช่น Meeting her there was pure serendipity."
            rows={2}
            className={`${textareaClass} border-slate-200 focus:border-teal-500 focus:ring-teal-100`}
          />
          <p className="mt-1 text-xs text-slate-500">แสดงด้านหลังบัตรและหลังเฉลยใน Challenge</p>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : card ? 'บันทึกการแก้ไข' : 'เพิ่มคำศัพท์'}</Button>
      </div>
    </form>
  )
}
