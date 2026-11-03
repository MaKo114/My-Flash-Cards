// A small bar at the bottom of the screen that offers to undo the last delete.
export function UndoToast({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-50 shadow-lg"
    >
      <span className="min-w-0 truncate">{label}</span>
      <button
        type="button"
        onClick={onUndo}
        className="shrink-0 rounded-lg px-2 py-1 font-bold text-teal-300 hover:bg-white/10 dark:text-teal-700"
      >
        เลิกทำ
      </button>
    </div>
  )
}
