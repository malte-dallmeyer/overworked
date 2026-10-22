import type { SessionOut } from './api'
import { arcPath, ringAngle, ringPoint } from './ring'

const SIZE = 240
const CENTER = SIZE / 2
const RADIUS = 104

type RingProps = {
  session: SessionOut
  start: Date
  end: Date
  now: Date
  /** Shortcut for pointer users; the pause sheet offers the same for everyone. */
  onPauseClick: (pauseId: number) => void
}

/** The work day as a ring: start at the top, clockwise to Feierabend; pauses as segments. */
export function Ring({ session, start, end, now, onPauseClick }: RingProps) {
  const angle = (time: number) => ringAngle(time, start.getTime(), end.getTime())
  const nowAngle = angle(now.getTime())
  const marker = ringPoint(CENTER, CENTER, RADIUS, nowAngle)

  return (
    <svg className="ring" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true" focusable="false">
      <circle className="ring-track" cx={CENTER} cy={CENTER} r={RADIUS} />
      {nowAngle > 0 && <path className="ring-done" d={arcPath(CENTER, CENTER, RADIUS, 0, nowAngle)} />}
      {session.pauses.map((pause) => {
        const from = angle(Date.parse(pause.started_at))
        const to = angle(pause.ended_at ? Date.parse(pause.ended_at) : now.getTime())
        if (to - from < 0.5) return null
        const planned = Date.parse(pause.started_at) > now.getTime()
        const d = arcPath(CENTER, CENTER, RADIUS, from, to)
        return (
          <g key={pause.id}>
            <path className={planned ? 'ring-pause planned' : 'ring-pause'} d={d} />
            {pause.ended_at && (
              <path
                className="ring-hit"
                d={d}
                data-testid={`ring-pause-${pause.id}`}
                onClick={() => onPauseClick(pause.id)}
              />
            )}
          </g>
        )
      })}
      <circle className="ring-now" cx={marker.x} cy={marker.y} r={7} />
    </svg>
  )
}
