import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'

export type ConfirmRequest = {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
}

// The app's own confirm box (instead of window.confirm), so it matches the design and the language.
export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return (
    <Dialog open={request !== null} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        {request && (
          <>
            <DialogTitle className="pr-8 text-lg font-bold text-slate-900">{request.title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-600">{request.description}</DialogDescription>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose}>ยกเลิก</Button>
              <Button
                className={request.danger ? 'bg-red-600 hover:bg-red-700 dark:hover:bg-red-500' : ''}
                onClick={() => { onClose(); request.onConfirm() }}
              >
                {request.confirmLabel}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
