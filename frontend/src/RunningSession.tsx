import { AlarmClock, Coffee, ListPlus, Moon, Play } from 'lucide-react'
import { useState } from 'react'
import type { PauseOut, SessionOut } from './api'
import { AdjustPanel } from './AdjustPanel'
import { PausePanel } from './PausePanel'
import { Sheet } from './Sheet'
import { Ring } from './Ring'
import { currentPause, endTime, missingBreakMs, remainingMs } from './session'
import { dayProgress } from './sky'
import { formatClockTime, formatCountdown } from './time'
import { useNow } from './useNow'
import { useSky } from './useSky'

type RunningSessionProps = {
  session: SessionOut
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onSnooze: () => void
}

export function RunningSession({ session, onPause, onResume, onEnd, onSnooze }: RunningSessionProps) {
  const now = useNow()
  const [sheet, setSheet] = useState<{ open: 'pauses' | 'adjust' | null; edit?: PauseOut }>({ open: null })

  const start = new Date(session.started_at)
  const end = endTime(session, now)
  const remaining = remainingMs(session, now)
  const missingBreak = missingBreakMs(session, now)
  const pause = currentPause(session, now)
  const snoozeLeft = session.snoozed_until ? Math.max(0, Date.parse(session.snoozed_until) - now.getTime()) : 0
  const canSnooze = remaining === 0 && !session.snoozed_until && !pause
  useSky(dayProgress(start, end, now))
  const close = () => setSheet({ open: null })

  return (
    <section className="running">
      <p className="status" aria-live="polite">
        {pause ? (
          <>
            <Coffee aria-hidden size={18} />
            Pausiert seit {formatClockTime(new Date(pause.started_at))}
          </>
        ) : null}
      </p>

      <div className="dial">
        <Ring
          session={session}
          start={start}
          end={end}
          now={now}
          onPauseClick={(id) => setSheet({ open: 'pauses', edit: session.pauses.find((p) => p.id === id) })}
        />
        <div className="dial-center">
          <button
            type="button"
            className="dial-button"
            aria-label="Restzeit anpassen"
            onClick={() => setSheet({ open: 'adjust' })}
          >
            {remaining > 0 ? (
              <>
                <span className="dial-label">noch</span>
                <strong className="countdown">{formatCountdown(remaining)}</strong>
              </>
            ) : snoozeLeft > 0 ? (
              <>
                <span className="dial-label">Snooze</span>
                <strong className="countdown">{formatCountdown(snoozeLeft)}</strong>
              </>
            ) : (
              <strong className="countdown done">Feierabend!</strong>
            )}
          </button>
        </div>
      </div>

      <p className="end">Feierabend um {formatClockTime(end)}</p>
      {missingBreak > 0 && <p className="hint">inkl. {Math.ceil(missingBreak / 60_000)} min Pflichtpause</p>}

      <div className="actions">
        {pause ? (
          <button className="secondary" onClick={onResume}>
            <Play aria-hidden size={20} /> Weiter
          </button>
        ) : (
          <button className="secondary" onClick={onPause}>
            <Coffee aria-hidden size={20} /> Pause
          </button>
        )}
        <button className="secondary" onClick={() => setSheet({ open: 'pauses' })}>
          <ListPlus aria-hidden size={20} /> Pausen{session.pauses.length > 0 && ` (${session.pauses.length})`}
        </button>
        {canSnooze && (
          <button className="secondary wide" onClick={onSnooze}>
            <AlarmClock aria-hidden size={20} /> 10 min später
          </button>
        )}
        <button className="primary wide" onClick={onEnd}>
          <Moon aria-hidden size={20} /> Feierabend machen
        </button>
      </div>

      <Sheet open={sheet.open === 'pauses'} onClose={close} labelledBy="pauses-heading">
        <PausePanel key={sheet.edit?.id ?? 'new'} session={session} now={now} initialEdit={sheet.edit} />
      </Sheet>
      <Sheet open={sheet.open === 'adjust'} onClose={close} labelledBy="adjust-heading">
        <AdjustPanel session={session} now={now} onDone={close} onEnd={onEnd} />
      </Sheet>
    </section>
  )
}
