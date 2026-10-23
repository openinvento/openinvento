import { deleteData, downloadFile, fetchData, patchData, postData } from "./base"
import { refreshEnabledModules } from "./modules"


export type InstanceSettings = {
  allow_email_login: boolean
  allow_signup: boolean
  enabled_modules: string[]
  available_modules: { name: string; label: string }[]
}


export async function getInstanceSettings() {
  return fetchData<InstanceSettings>('/api/instance-settings/')
}

export async function updateInstanceSettings(settings: Partial<InstanceSettings>) {
  const updated = await patchData<InstanceSettings>('/api/instance-settings/', settings)
  if (settings.enabled_modules !== undefined) refreshEnabledModules()
  return updated
}

export async function downloadInstanceBackup() {
  return downloadFile('/api/instance-settings/backup/', 'openinvento-instance-backup.zip')
}

export type ReleaseEntry = {
  tag_name: string | null
  name: string | null
  body?: string | null
  published_at?: string | null
  html_url?: string | null
}

export type VersionCheck = {
  current_version: string
  newer_version_available: boolean
  latest_release: ReleaseEntry | null
  changelog: ReleaseEntry[]
}

export async function fetchVersionCheck() {
  return fetchData<VersionCheck>('/api/instance-settings/version-check/')
}

export type AdminUser = {
  uuid: string
  username: string
  email?: string
  name: string
  is_superuser: boolean
  require_reset: boolean
}

export type UserInput = {
  username: string
  email?: string
  name: string
  password?: string
  is_superuser?: boolean
}

export async function getUsers() {
  return fetchData<AdminUser[]>('/api/users/')
}

export async function addUser(user: UserInput) {
  return postData<AdminUser>('/api/users/', user)
}

export async function updateUser(uuid: string, user: Partial<UserInput>) {
  return patchData<AdminUser>(`/api/users/${uuid}/`, user)
}

export async function deleteUser(uuid: string) {
  return deleteData<void>(`/api/users/${uuid}/`)
}

export type APIKey = {
  id: string
  name: string
  prefix: string
  created: string
  expiry_date: string | null
  revoked: boolean
}

export async function getAPIKeys() {
  return fetchData<APIKey[]>('/api/api-keys/')
}

export async function createAPIKey(name: string) {
  return postData<APIKey & { key: string }>('/api/api-keys/', { name })
}

export async function renameAPIKey(id: string, name: string) {
  return patchData<APIKey>(`/api/api-keys/${id}/`, { name })
}

export async function revokeAPIKey(id: string) {
  return deleteData<void>(`/api/api-keys/${id}/`)
}
