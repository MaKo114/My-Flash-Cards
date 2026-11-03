// "คำที่ 3 จาก 10" with a thin bar underneath, used above the study card and the challenge.
export function ProgressBar({ label, detail, percent }: { label: string; detail: string; percent: number }) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{label}</span>
        <span>{detail}</span>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
      </div>
    </>
  )
}
