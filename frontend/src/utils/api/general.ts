
import { fetchData } from "./base"
import type { Inventory } from "./inventory"

export type SidebarData = {
	user: { name: string }
	inventories: Inventory[]
}

export function getSidebarData() {
	return fetchData<SidebarData>("/api/sidebar/")
}