export type Favorite = {
  id: string
  name: string
  url: string
  emoji: string
}

const STORAGE_KEY = "openinvento:favorites"
export const FAVORITES_CHANGED_EVENT = "openinvento:favorites-changed"

function readFavorites(): Favorite[] {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(value)) return []
    return value.filter(
      (item): item is Favorite =>
        typeof item === "object" && item !== null &&
        typeof item.id === "string" && typeof item.name === "string" &&
        typeof item.url === "string" && typeof item.emoji === "string",
    )
  } catch {
    return []
  }
}

function writeFavorites(favorites: Favorite[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites))
  window.dispatchEvent(new Event(FAVORITES_CHANGED_EVENT))
}

export function getFavorites() {
  return readFavorites()
}

export function isFavorite(id: string) {
  return readFavorites().some((favorite) => favorite.id === id)
}

export function toggleFavorite(favorite: Favorite) {
  const favorites = readFavorites()
  const exists = favorites.some((item) => item.id === favorite.id)
  writeFavorites(exists ? favorites.filter((item) => item.id !== favorite.id) : [...favorites, favorite])
  return !exists
}

export function removeFavorite(id: string) {
  writeFavorites(readFavorites().filter((favorite) => favorite.id !== id))
}
