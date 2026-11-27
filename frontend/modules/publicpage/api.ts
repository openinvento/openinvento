import { deleteData, fetchData, getApiUrl, postData, putData } from "@/utils/api/base"

export type PublicPageSettings = {
  show_name: boolean
  show_photo: boolean
  allow_contact: boolean
  note: string
}

export type PublicEntry = {
  name: string | null
  has_photo: boolean
  allow_contact: boolean
  note: string
}

const publicPath = (inventory: string, identifier: string) =>
  `/api/publicpage/scan/${encodeURIComponent(inventory)}/${encodeURIComponent(identifier)}/`

export const publicPageApi = {
  // 404 when the entry has no public page.
  get: (entryUuid: string) => fetchData<PublicPageSettings>(`/api/publicpage/entries/${entryUuid}/`),
  save: (entryUuid: string, settings: PublicPageSettings) =>
    putData<PublicPageSettings>(`/api/publicpage/entries/${entryUuid}/`, settings),
  remove: (entryUuid: string) => deleteData<void>(`/api/publicpage/entries/${entryUuid}/`),

  // Public, for people who are not signed in.
  view: (inventory: string, identifier: string) => fetchData<PublicEntry>(publicPath(inventory, identifier)),
  photoUrl: (inventory: string, identifier: string) => getApiUrl(`${publicPath(inventory, identifier)}photo/`),
  contact: (inventory: string, identifier: string, message: string, contact: string) =>
    postData<void>(`${publicPath(inventory, identifier)}contact/`, { message, contact }),
}
