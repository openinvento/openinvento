import { fetchData, patchData, postData } from "./base"

export type SessionUser = {
  username: string
  email: string
  name: string
  uuid: string
  is_superuser: boolean
  require_reset: boolean
}

export type InstanceSettings = {
  allow_email_login: boolean
  allow_signup: boolean
}

export async function login(identifier: string, password: string) {
  return postData<{ detail: string; user: SessionUser }>("/api/login/", {
    identifier,
    password,
  })
}

export async function signup(
  username: string,
  email: string,
  name: string,
  password: string,
) {
  return postData<{ detail: string; user: SessionUser }>('/api/signup/', {
    username,
    email,
    name,
    password,
  })
}

export async function logout() {
  return postData<{ detail: string }>("/api/logout/", {})
}

export async function getCurrentSession() {
  return fetchData<{ authenticated: boolean; user: SessionUser | null }>("/api/me/")
}

export async function resetCredentials(username: string, password: string) {
  return postData<{ detail: string; user: SessionUser }>('/api/credentials/reset/', {
    username,
    password,
  })
}

export async function getInstanceSettings() {
  return fetchData<InstanceSettings>('/api/instance-settings/')
}

export async function updateInstanceSettings(settings: Partial<InstanceSettings>) {
  return patchData<InstanceSettings>('/api/instance-settings/', settings)
}
