import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getCurrentSessionQueryKey } from './api/@tanstack/react-query.gen'

/**
 * Keeps the current session up to date with changes from other devices and the alarm
 * (server-sent events). EventSource reconnects by itself after a dropped connection.
 */
export function useLiveUpdates(enabled: boolean) {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const source = new EventSource('/api/session/events')
    source.onmessage = (event) => queryClient.setQueryData(getCurrentSessionQueryKey(), JSON.parse(event.data))
    return () => source.close()
  }, [enabled, queryClient])
}
