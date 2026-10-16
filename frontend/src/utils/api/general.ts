
import { fetchData } from "./base"
import type { Inventory } from "./inventory"

export type SidebarData = {
	user: { name: string }
	inventories: Inventory[]
	version: string
}

export function getSidebarData() {
	return fetchData<SidebarData>("/api/sidebar/")
}
