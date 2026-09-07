import { fetchData, postData } from "./base"

export type SessionUser = {
  username: string
  email: string
  name: string
  uuid: string
  is_superuser: boolean
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
