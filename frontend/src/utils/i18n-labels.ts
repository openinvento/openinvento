import i18n from "@/i18n"
import type { CategoryField } from "@/utils/api/inventory"

function translateOrFallback(key: string, fallback: string) {
  return i18n.exists(key) ? i18n.t(key) : fallback
}

export function getCategoryLabel(name: string) {
  return translateOrFallback(`inventory.categories.${name}`, name)
}

export function getFieldLabel(field: Pick<CategoryField, "key" | "label">) {
    console.log("getFieldLabel called with field:", field); // Debugging line
  return translateOrFallback(`inventory.fields.${field.key}`, field.label)
}