import { useQuery } from '@tanstack/react-query'
import { Bell, BellOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { subscribePush, unsubscribePush } from './api'
import { getPushKeyOptions } from './api/@tanstack/react-query.gen'
import { base64UrlToBytes } from './push'

type State = 'loading' | 'on' | 'off' | 'blocked'

const supported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window

/**
 * The bell: notifications on this device (desktop browsers; the phone has ntfy).
 * Hidden if the server has no web push or the browser cannot do it.
 */
export function PushToggle() {
  const key = useQuery(getPushKeyOptions())
  const publicKey = key.data?.public_key
  const [state, setState] = useState<State>('loading')

  useEffect(() => {
    if (!supported || !publicKey) return
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (Notification.permission === 'denied') setState('blocked')
        else setState(subscription ? 'on' : 'off')
      })
  }, [publicKey])

  if (!supported || !publicKey) return null

  async function toggle() {
    const registration = await navigator.serviceWorker.ready
    const current = await registration.pushManager.getSubscription()
    if (current) {
      await unsubscribePush({ body: { endpoint: current.endpoint } })
      await current.unsubscribe()
      setState('off')
      return
    }
    if ((await Notification.requestPermission()) !== 'granted') {
      setState('blocked')
      return
    }
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToBytes(publicKey!),
    })
    const { endpoint, keys } = subscription.toJSON()
    await subscribePush({ body: { endpoint: endpoint!, keys: { p256dh: keys!.p256dh, auth: keys!.auth } } })
    setState('on')
  }

  const label = {
    loading: 'Benachrichtigungen',
    on: 'Benachrichtigungen auf diesem Gerät ausschalten',
    off: 'Benachrichtigungen auf diesem Gerät einschalten',
    blocked: 'Benachrichtigungen sind im Browser blockiert. In den Website-Einstellungen erlauben.',
  }[state]

  return (
    <button
      type="button"
      className="icon-button bell"
      aria-label={label}
      title={label}
      aria-pressed={state === 'on'}
      disabled={state === 'loading' || state === 'blocked'}
      onClick={() => void toggle()}
    >
      {state === 'on' ? <Bell aria-hidden size={22} /> : <BellOff aria-hidden size={22} />}
    </button>
  )
}
