import type { ComponentType } from "react"

// Frontend slots: places in core pages where optional modules can show their own components.
// A module registers its components in frontend/modules/<name>/index.ts; <Slot> renders the ones
// whose module is enabled on this instance.

export type EntryType = "article" | "box" | "shelf" | "area"

/** The props each slot passes to its components. */
export interface SlotProps {
  /** Below the details of an entry: the article, box and area pages and the shelf edit dialog. */
  "entry-details": { entryUuid: string; entryType: EntryType }
}

export type SlotName = keyof SlotProps

export type SlotRegistration<N extends SlotName> = { module: string; component: ComponentType<SlotProps[N]> }

const registry = new Map<SlotName, SlotRegistration<SlotName>[]>()

/** Registers a component of a module for a slot. It is only shown while the module is enabled. */
export function registerSlot<N extends SlotName>(name: N, module: string, component: ComponentType<SlotProps[N]>) {
  const registrations = registry.get(name) ?? []
  if (!registrations.some((registration) => registration.module === module && registration.component === component)) {
    registrations.push({ module, component })
  }
  registry.set(name, registrations)
}

export function getSlotRegistrations<N extends SlotName>(name: N) {
  return (registry.get(name) ?? []) as SlotRegistration<N>[]
}
