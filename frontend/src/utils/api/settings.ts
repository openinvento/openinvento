import { deleteData, fetchData, patchData, postData } from "./base"


export type InstanceSettings = {
  allow_email_login: boolean
  allow_signup: boolean
}


export async function getInstanceSettings() {
  return fetchData<InstanceSettings>('/api/instance-settings/')
}

export async function updateInstanceSettings(settings: Partial<InstanceSettings>) {
  return patchData<InstanceSettings>('/api/instance-settings/', settings)
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