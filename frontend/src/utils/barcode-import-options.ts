// Options of the barcode import page, remembered per browser. All on by default.
export type BarcodeImportOptions = {
  // One category for every article of the scan session. Off: each scanned article gets its own category select.
  sharedCategory: boolean
  // Products the catalog doesn't know, or knows without a name, can still be added with a name typed in.
  // Off: such a scan only shows the error.
  addWithoutCatalog: boolean
  // Show which articles of the inventory already carry the scanned barcode.
  checkExisting: boolean
}

const STORAGE_KEY = "openinvento:barcode-import-options"

export const DEFAULT_BARCODE_IMPORT_OPTIONS: BarcodeImportOptions = {
  sharedCategory: true,
  addWithoutCatalog: true,
  checkExisting: true,
}

export function readBarcodeImportOptions(): BarcodeImportOptions {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    if (typeof stored !== "object" || stored === null) return DEFAULT_BARCODE_IMPORT_OPTIONS
    const values = stored as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(DEFAULT_BARCODE_IMPORT_OPTIONS).map(([key, fallback]) => [key, typeof values[key] === "boolean" ? values[key] : fallback]),
    ) as BarcodeImportOptions
  } catch {
    return DEFAULT_BARCODE_IMPORT_OPTIONS // storage blocked or invalid JSON
  }
}

export function writeBarcodeImportOptions(options: BarcodeImportOptions) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(options))
  } catch {
    // Storage can be blocked, e.g. in a private window; the options then only last for this visit.
  }
}
