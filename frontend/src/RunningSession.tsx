import { Coffee, ListPlus, Moon, Play } from 'lucide-react'
import { useState } from 'react'
import type { PauseOut, SessionOut } from './api'
import { PausePanel } from './PausePanel'
import { PauseSheet } from './PauseSheet'
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
}

export function RunningSession({ session, onPause, onResume, onEnd }: RunningSessionProps) {
  const now = useNow()
  const [sheet, setSheet] = useState<{ open: boolean; edit?: PauseOut }>({ open: false })

  const start = new Date(session.started_at)
  const end = endTime(session, now)
  const remaining = remainingMs(session, now)
  const missingBreak = missingBreakMs(session, now)
  const pause = currentPause(session, now)
  useSky(dayProgress(start, end, now))

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
          onPauseClick={(id) => setSheet({ open: true, edit: session.pauses.find((p) => p.id === id) })}
        />
        <div className="dial-center">
          {remaining > 0 ? (
            <>
              <span className="dial-label">noch</span>
              <strong className="countdown">{formatCountdown(remaining)}</strong>
            </>
          ) : (
            <strong className="countdown done">Feierabend!</strong>
          )}
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
        <button className="secondary" onClick={() => setSheet({ open: true })}>
          <ListPlus aria-hidden size={20} /> Pausen{session.pauses.length > 0 && ` (${session.pauses.length})`}
        </button>
        <button className="primary wide" onClick={onEnd}>
          <Moon aria-hidden size={20} /> Feierabend machen
        </button>
      </div>

      <PauseSheet open={sheet.open} onClose={() => setSheet({ open: false })}>
        <PausePanel key={sheet.edit?.id ?? 'new'} session={session} now={now} initialEdit={sheet.edit} />
      </PauseSheet>
    </section>
  )
}
