import { fetchData, patchData } from "./base"

export type Notification = {
  uuid: string
  kind: string
  title: string
  message: string
  link: string
  metadata: Record<string, string | number | boolean | null>
  read: boolean
  created_at: string
}

let notificationsRequest: Promise<Notification[]> | null = null

// Cache the startup request so StrictMode and rerenders don't issue duplicate fetches.
export function getNotificationsOnce() {
  notificationsRequest ??= fetchData<Notification[]>("/api/notifications/")
  return notificationsRequest
}

export function resetNotificationsCache() {
  notificationsRequest = null
}

export function dismissNotification(uuid: string) {
  return patchData<Notification>(`/api/notifications/${uuid}/`, { read: true })
}
