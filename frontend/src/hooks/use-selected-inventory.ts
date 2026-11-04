import { useSyncExternalStore } from "react"
import {
  getInventoryState,
  subscribeToInventoryChanges,
  type Inventory,
} from "@/utils/api/inventory"

export function useSelectedInventory(): {
  inventories: Inventory[]
  selectedInventory: Inventory | null
  selectedInventoryUuid: string | null
} {
  const snapshot = useSyncExternalStore(
    subscribeToInventoryChanges,
    getInventoryState,
    getInventoryState,
  )
  return snapshot
}

