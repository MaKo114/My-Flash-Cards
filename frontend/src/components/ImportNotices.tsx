import { FileUp, X } from 'lucide-react'
import type { ImportProgress, ImportResult } from '@/lib/cards'

// Progress while a CSV file uploads and saves.
export function ImportProgressNotice({ fileName, progress }: { fileName: string; progress: ImportProgress }) {
  const label = progress.phase === 'uploading'
    ? `กำลังอัปโหลด CSV ${progress.percent}%`
    : progress.phase === 'processing' ? 'กำลังตรวจและบันทึกคำศัพท์' : 'กำลังโหลดรายการคำศัพท์ล่าสุด'
  const uploading = progress.phase === 'uploading'

  return (
    <div className="mb-6 rounded-2xl border border-teal-100 bg-surface p-4 shadow-sm" aria-busy="true">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-500">{fileName}</p>
          <p role="status" className="mt-1 text-sm font-semibold text-teal-800">{label}</p>
        </div>
        <FileUp size={20} className="shrink-0 text-teal-700" />
      </div>
      <div
        role="progressbar"
        aria-label="ความคืบหน้าการนำเข้า CSV"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={uploading ? progress.percent : undefined}
        className="mt-3 h-2 overflow-hidden rounded-full bg-teal-100"
      >
        <div
          className={`h-full rounded-full bg-accent transition-[width] ${uploading ? '' : 'animate-pulse'}`}
          style={{ width: uploading ? `${progress.percent}%` : '100%' }}
        />
      </div>
    </div>
  )
}

// The summary after an import, with the rows that were skipped or invalid.
export function ImportResultNotice({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return (
    <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700">
      <div className="flex items-start justify-between gap-2">
        <div role="status">
          <p className="font-bold text-slate-900">นำเข้า CSV เสร็จแล้ว</p>
          <p className="mt-1">
            เพิ่ม {result.added} คำ · รวมข้อมูล {result.merged} แถว · ข้ามคำซ้ำ {result.skipped} แถว · ข้อมูลไม่ครบ/ผิดรูปแบบ {result.invalid} แถว
          </p>
        </div>
        <button onClick={onClose} aria-label="ปิดผลนำเข้า" className="text-slate-500"><X size={18} /></button>
      </div>
      {result.issues.length > 0 && (
        <details className="mt-3 border-t border-teal-100 pt-3" open={result.invalid > 0}>
          <summary className="cursor-pointer font-semibold text-teal-800">ดูรายการที่ไม่ได้เพิ่ม ({result.issues.length})</summary>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">
            {result.issues.map((issue, index) => (
              <li key={index} className={`rounded-lg bg-surface px-3 py-2 ${issue.kind === 'skipped' ? 'text-slate-600' : 'text-red-700'}`}>
                แถว {issue.row} · {issue.word || 'ไม่ระบุคำศัพท์'} · {issue.kind === 'skipped' ? 'ข้าม' : 'นำเข้าไม่ได้'}: {issue.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
