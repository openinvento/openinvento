import { deleteData, fetchData, getApiUrl, postData, putData } from "@/utils/api/base"

export type LostFoundSettings = {
  show_name: boolean
  show_photo: boolean
  note: string
}

export type FoundEntry = {
  name: string | null
  has_photo: boolean
  note: string
}

const foundPath = (inventory: string, identifier: string) =>
  `/api/lostfound/found/${encodeURIComponent(inventory)}/${encodeURIComponent(identifier)}/`

export const lostFoundApi = {
  // 404 when the entry has no public page.
  get: (entryUuid: string) => fetchData<LostFoundSettings>(`/api/lostfound/entries/${entryUuid}/`),
  save: (entryUuid: string, settings: LostFoundSettings) =>
    putData<LostFoundSettings>(`/api/lostfound/entries/${entryUuid}/`, settings),
  remove: (entryUuid: string) => deleteData<void>(`/api/lostfound/entries/${entryUuid}/`),

  // Public, for people who are not signed in.
  found: (inventory: string, identifier: string) => fetchData<FoundEntry>(foundPath(inventory, identifier)),
  photoUrl: (inventory: string, identifier: string) => getApiUrl(`${foundPath(inventory, identifier)}photo/`),
  contact: (inventory: string, identifier: string, message: string, contact: string) =>
    postData<void>(`${foundPath(inventory, identifier)}contact/`, { message, contact }),
}
