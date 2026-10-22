import { useQueryClient } from '@tanstack/react-query'
import type { SessionOut } from './api'
import { getCurrentSessionQueryKey } from './api/@tanstack/react-query.gen'

/** Keeps the cached current session in line with what mutations return. */
export function useSessionCache() {
  const queryClient = useQueryClient()
  const queryKey = getCurrentSessionQueryKey()
  return {
    show: (session: SessionOut | null) => queryClient.setQueryData(queryKey, session),
    // E.g. another device changed the session in the meantime: show what is true now.
    refetch: () => queryClient.invalidateQueries({ queryKey }),
  }
}
