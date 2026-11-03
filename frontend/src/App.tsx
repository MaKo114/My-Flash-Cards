import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { LogOut, X } from 'lucide-react'
import { CardEditor } from '@/components/CardEditor'
import { ConfirmDialog, type ConfirmRequest } from '@/components/ConfirmDialog'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { appName, navItem, type View } from '@/components/layout/navigation'
import { Sidebar } from '@/components/layout/Sidebar'
import { LoginScreen } from '@/components/LoginScreen'
import { filterLabel, PracticeToolbar } from '@/components/PracticeToolbar'
import { SettingsDialog } from '@/components/SettingsDialog'
import { TodayPanel } from '@/components/TodayPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { UndoToast } from '@/components/UndoToast'
import { useCardLibrary } from '@/hooks/useCardLibrary'
import { useChallengeRound, type Filters } from '@/hooks/useChallengeRound'
import { useSession } from '@/hooks/useSession'
import { useSettings } from '@/hooks/useSettings'
import { dailyPlan, filterCards, isDue, localDay, shuffleCards, type Card } from '@/lib/cards'
import { seeded } from '@/lib/random'
import type { ChallengeMode } from '@/lib/settings'
import { ChallengeView } from '@/views/ChallengeView'
import { LibraryView } from '@/views/LibraryView'
import { StatsView } from '@/views/StatsView'
import { StudyView } from '@/views/StudyView'

// The top of the app. It owns the state shared between pages (filters, shuffle, the current
// challenge round) and wires the hooks to the views. Each view lives in src/views.
export default function App() {
  const session = useSession()
  const [settings, updateSettings] = useSettings()
  const library = useCardLibrary({ generation: session.generation, locked: session.status === 'locked' })
  const { cards } = library

  const [view, setView] = useState<View>('library')
  const [filters, setFilters] = useState<Filters>({ letter: 'ALL', reviewOnly: false, dueOnly: false })
  // The seed fixes the shuffled order until the user asks for a new one.
  const [seed, setSeed] = useState(() => Date.now())
  const [editor, setEditor] = useState<{ open: boolean; card: Card | null }>({ open: false, card: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)

  const today = localDay()
  const filtered = useMemo(
    () => filterCards(cards, filters.letter, filters.reviewOnly).filter(card => !filters.dueOnly || isDue(card, today)),
    [cards, filters, today],
  )
  const deck = useMemo(() => settings.shuffled ? shuffleCards(filtered, seeded(seed)) : filtered, [filtered, settings.shuffled, seed])
  const plan = useMemo(() => dailyPlan(cards, today, settings.newPerDay), [cards, today, settings.newPerDay])
  const dueCount = useMemo(() => cards.filter(card => isDue(card, today)).length, [cards, today])
  const reviewCount = useMemo(() => cards.filter(card => card.needsReview).length, [cards])
  const answersToday = library.studyDays.find(day => day.date === today)?.answers ?? 0

  const round = useChallengeRound({
    cards,
    filters,
    shuffled: settings.shuffled,
    seed,
    roundSize: settings.roundSize,
    onAnswer: library.recordAnswer,
  })

  useEffect(() => {
    document.title = `${navItem(view).label} · ${appName}`
  }, [view])

  // Changing settings mid-round restarts the challenge, so ask before throwing away answered words.
  function guard(action: () => void) {
    if (view !== 'challenge' || !round.inProgress) {
      action()
      return
    }
    setConfirmRequest({
      title: 'เริ่มรอบใหม่ใช่ไหม?',
      description: `รอบนี้ทำไปแล้ว ${round.position} จาก ${round.ids.length} คำ ถ้าเปลี่ยนตอนนี้ ความคืบหน้าของรอบนี้จะหายไป (สถานะคำที่ตอบไปแล้วยังถูกบันทึกไว้)`,
      confirmLabel: 'เริ่มรอบใหม่',
      onConfirm: action,
    })
  }

  function navigate(next: View) {
    if (next === view) return
    guard(() => {
      if (next === 'challenge') round.start()
      if (next === 'stats') library.loadStudyDays()
      setView(next)
    })
  }

  function changeFilters(patch: Partial<Filters>) {
    guard(() => {
      const next = { ...filters, ...patch }
      setFilters(next)
      if (view === 'challenge') round.start(next)
    })
  }

  function toggleShuffle() {
    guard(() => {
      const shuffled = !settings.shuffled
      const nextSeed = Date.now()
      updateSettings({ shuffled })
      setSeed(nextSeed)
      if (view === 'challenge') round.start({ shuffled, seed: nextSeed })
    })
  }

  function reshuffle() {
    guard(() => {
      const nextSeed = Date.now()
      setSeed(nextSeed)
      if (view === 'challenge') round.start({ seed: nextSeed })
    })
  }

  function changeMode(mode: ChallengeMode) {
    if (mode === settings.challengeMode) return
    guard(() => {
      updateSettings({ challengeMode: mode })
      round.replay()
    })
  }

  function changeRoundSize(size: number) {
    if (size === settings.roundSize) return
    guard(() => {
      updateSettings({ roundSize: size })
      round.start({ size })
    })
  }

  // Starting over reshuffles, so a limited round does not repeat the same words.
  function restartChallenge() {
    if (!settings.shuffled) {
      round.start()
      return
    }
    const nextSeed = Date.now()
    setSeed(nextSeed)
    round.start({ seed: nextSeed })
  }

  // "ฝึกวันนี้": due words in random order, then today's new words.
  function startDaily() {
    guard(() => {
      round.startDaily([...shuffleCards(plan.due), ...plan.fresh].map(card => card.id))
      setView('challenge')
    })
  }

  // "ทบทวนเลย" on the stats page: a challenge with only the words due today.
  function reviewDue() {
    guard(() => {
      const next = { letter: 'ALL', reviewOnly: false, dueOnly: true }
      setFilters(next)
      round.start(next)
      setView('challenge')
    })
  }

  function logout() {
    // Send any delete still waiting for undo before the token is gone.
    void library.flushDeletes()
    session.logout()
  }

  if (session.status === 'locked') {
    return <LoginScreen appName={appName} onLogin={async password => { await session.login(password); library.setError('') }} />
  }

  const todayPanel = (
    <TodayPanel answersToday={answersToday} dailyGoal={settings.dailyGoal} dueCount={plan.due.length} newCount={plan.fresh.length} onStart={startDaily} />
  )
  const toolbar = ({ extra, className }: { extra: ReactNode; className?: string }) => (
    <PracticeToolbar
      filters={filters}
      onFiltersChange={changeFilters}
      dueCount={dueCount}
      shuffled={settings.shuffled}
      onToggleShuffle={toggleShuffle}
      onReshuffle={reshuffle}
      extra={extra}
      className={className}
    />
  )
  const openEditor = (card: Card | null) => setEditor({ open: true, card })

  function page() {
    if (library.loading) return <p role="status" className="py-20 text-center text-slate-500">กำลังโหลดคำศัพท์...</p>
    switch (view) {
      case 'library':
        return (
          <LibraryView
            library={library}
            cards={cards}
            filtered={filtered}
            filters={filters}
            onFiltersChange={changeFilters}
            dueCount={dueCount}
            reviewCount={reviewCount}
            today={todayPanel}
            onAdd={() => openEditor(null)}
            onEdit={openEditor}
            confirm={setConfirmRequest}
          />
        )
      case 'study':
        return (
          <StudyView
            key={`${filters.letter}-${filters.reviewOnly}-${filters.dueOnly}-${settings.shuffled}-${seed}`}
            deck={deck}
            detail={filterLabel(filters)}
            firstLanguage={settings.firstLanguage}
            onLanguageChange={firstLanguage => updateSettings({ firstLanguage })}
            paused={editor.open || settingsOpen || confirmRequest !== null}
            reviewSaving={library.reviewSaving}
            onToggleReview={card => void library.toggleReview(card)}
            onEdit={openEditor}
            onRestart={() => { if (settings.shuffled) reshuffle() }}
            onGoToLibrary={() => navigate('library')}
            toolbar={toolbar}
          />
        )
      case 'challenge':
        return (
          <ChallengeView
            round={round}
            cards={cards}
            filters={filters}
            mode={settings.challengeMode}
            onModeChange={changeMode}
            firstLanguage={settings.firstLanguage}
            onLanguageChange={firstLanguage => updateSettings({ firstLanguage })}
            roundSize={settings.roundSize}
            onRoundSizeChange={changeRoundSize}
            shuffled={settings.shuffled}
            soundEffects={settings.soundEffects}
            onToggleSoundEffects={() => updateSettings({ soundEffects: !settings.soundEffects })}
            onRestart={restartChallenge}
            onEdit={openEditor}
            onGoToLibrary={() => navigate('library')}
            toolbar={toolbar}
          />
        )
      case 'stats':
        return (
          <StatsView
            cards={cards}
            days={library.studyDays}
            loading={library.statsLoading}
            error={library.statsError}
            dailyGoal={settings.dailyGoal}
            onReviewDue={reviewDue}
            footer={session.authRequired && (
              <div className="flex justify-center lg:hidden"><Button variant="ghost" onClick={logout}><LogOut size={16} /> ออกจากระบบ</Button></div>
            )}
          />
        )
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-slate-700">
      <div className="flex min-h-screen w-full">
        <Sidebar
          view={view}
          onNavigate={navigate}
          reviewCount={reviewCount}
          totalCount={cards.length}
          today={todayPanel}
          onOpenSettings={() => setSettingsOpen(true)}
          onLogout={session.authRequired ? logout : undefined}
        />
        <main className="min-h-screen min-w-0 flex-1">
          <MobileHeader view={view} onNavigate={navigate} onAdd={() => openEditor(null)} onOpenSettings={() => setSettingsOpen(true)} />
          <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
            {library.error && (
              <div role="alert" className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <span>{library.error}</span>
                <button aria-label="ปิดข้อความผิดพลาด" onClick={() => library.setError('')}><X size={18} /></button>
              </div>
            )}
            {page()}
          </div>
        </main>
      </div>

      <Dialog open={editor.open} onOpenChange={open => setEditor(previous => ({ ...previous, open }))}>
        <DialogContent>
          <CardEditor
            key={editor.card?.id ?? 'new'}
            card={editor.card}
            onCancel={() => setEditor(previous => ({ ...previous, open: false }))}
            onSave={async fields => {
              await library.saveCard(editor.card, fields)
              setEditor(previous => ({ ...previous, open: false }))
            }}
          />
        </DialogContent>
      </Dialog>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} settings={settings} onChange={updateSettings} />
      <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
      {library.pendingDelete && <UndoToast label={library.pendingDelete.label} onUndo={library.undoDelete} />}
    </div>
  )
}
