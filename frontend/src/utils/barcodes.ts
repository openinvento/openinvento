import type { Barcode, BarcodeKind } from "@/utils/api/inventory"

// An empty kind lets the backend detect the type from the number.
export type BarcodeDraft = { kind: BarcodeKind | ""; value: string }

export const BARCODE_KINDS: (BarcodeKind | "")[] = ["", "ean", "isbn", "pzn", "other"]

export function toBarcodeDrafts(barcodes: Barcode[] | undefined): BarcodeDraft[] {
  return (barcodes ?? []).map(({ kind, value }) => ({ kind, value }))
}

/** The value for barcodes_input: the whole list, without empty rows. */
export function barcodesPayload(drafts: BarcodeDraft[]) {
  return JSON.stringify(drafts.filter((draft) => draft.value.trim()).map((draft) => ({ kind: draft.kind, value: draft.value.trim() })))
}
