import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { ArchiveIcon, HandCoinsIcon, RotateCcwIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import BaseScreen from "@/layouts/BaseScreen"
import { inventoryApi, type Article, type Chest } from "@/utils/api/inventory"
import { loansApi, type Loan } from "./api"
import LoanItemSelector from "./LoanItemSelector"

export default function LoansPage() {
  const { t, i18n } = useTranslation()
  const [articles, setArticles] = useState<Article[]>([])
  const [chests, setChests] = useState<Chest[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [itemId, setItemId] = useState("")
  const [quantity, setQuantity] = useState(1)
  const [dueAt, setDueAt] = useState("")
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [returningId, setReturningId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedArticle = articles.find((article) => `article:${article.uuid}` === itemId)
  const selectedChest = chests.find((chest) => `chest:${chest.uuid}` === itemId)
  const selectedKind = selectedArticle ? "article" : selectedChest ? "chest" : null

  const itemNames = useMemo(() => new Map([
    ...articles.map((article) => [`article:${article.uuid}`, article.name] as const),
    ...chests.map((chest) => [`chest:${chest.uuid}`, chest.name] as const),
  ]), [articles, chests])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [loanResult, inventoryResult] = await Promise.allSettled([
      loansApi.list(),
      Promise.all([inventoryApi.listArticles(), inventoryApi.listChests()]),
    ])

    if (loanResult.status === "fulfilled") {
      setLoans(loanResult.value)
    } else {
      setError(t("loans.errors.load"))
    }
    if (inventoryResult.status === "fulfilled") {
      setArticles(inventoryResult.value[0])
      setChests(inventoryResult.value[1])
    } else if (loanResult.status === "fulfilled") {
      setError(t("loans.errors.inventoryLoad"))
    }
    setLoading(false)
  }, [t])

  useEffect(() => { void load() }, [load])
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedKind) return
    setSaving(true)
    setError(null)
    try {
      const loan = await loansApi.create({
        article: selectedArticle?.uuid ?? null,
        chest: selectedChest?.uuid ?? null,
        quantity: selectedKind === "article" ? quantity : 1,
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        notes,
      })
      setLoans((current) => [loan, ...current])
      setDueAt("")
      setNotes("")
      setQuantity(1)
    } catch {
      setError(t("loans.errors.create"))
    } finally {
      setSaving(false)
    }
  }

  async function handleReturn(id: number) {
    setReturningId(id)
    setError(null)
    try {
      const updated = await loansApi.return(id)
      setLoans((current) => current.map((loan) => loan.id === id ? updated : loan))
    } catch {
      setError(t("loans.errors.return"))
    } finally {
      setReturningId(null)
    }
  }

  function formatDate(value: string | null) {
    return value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" }).format(new Date(value))
      : t("loans.noDueDate")
  }

  return (
    <BaseScreen title={t("loans.title")}>
      <div className="mx-auto flex w-full flex-col gap-8">
        {error && <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p>}
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-5 flex items-center gap-3">
            <HandCoinsIcon className="size-5 text-primary" />
            <div>
              <h2 className="font-semibold">{t("loans.newLoan")}</h2>
              <p className="text-sm text-muted-foreground">{t("loans.description")}</p>
            </div>
          </div>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={handleCreate}>
            <LoanItemSelector articles={articles} chests={chests} value={itemId} onValueChange={setItemId} />
            {selectedKind === "article" && (
              <label className="grid gap-1.5 text-sm">
                {t("loans.quantity")}
                <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} required />
              </label>
            )}
            <label className="grid gap-1.5 text-sm">
              {t("loans.dueDate")}
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">
              {t("loans.notes")}
              <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" className="px-4 py-3" disabled={saving || !selectedKind}>
                {saving ? t("loans.saving") : t("loans.create")}
              </Button>
            </div>
          </form>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{t("loans.history")}</h2>
          {loading ? <p className="text-sm text-muted-foreground">{t("loans.loading")}</p> : loans.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{t("loans.empty")}</div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              {loans.map((loan) => {
                const itemLabel = itemNames.get(`${loan.article ? "article" : "chest"}:${loan.article ?? loan.chest}`) ?? t("loans.unknownItem")
                return (
                  <div key={loan.id} className="flex flex-wrap items-center justify-between gap-4 border-b p-4 last:border-b-0">
                    <div className="flex min-w-0 items-center gap-3">
                      <ArchiveIcon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{itemLabel}{loan.article && loan.quantity > 1 ? ` × ${loan.quantity}` : ""}</p>
                        <p className="text-sm text-muted-foreground">{t("loans.due")}: {formatDate(loan.due_at)}</p>
                        {loan.notes && <p className="text-sm text-muted-foreground">{t("loans.notesLabel")}: {loan.notes}</p>}
                      </div>
                    </div>
                    {loan.returned_at ? (
                      <span className="text-sm text-muted-foreground">{t("loans.returned", { date: formatDate(loan.returned_at) })}</span>
                    ) : (
                      <Button type="button" variant="outline" size="sm" disabled={returningId === loan.id} onClick={() => void handleReturn(loan.id)}>
                        <RotateCcwIcon />{returningId === loan.id ? t("loans.returning") : t("loans.markReturned")}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </BaseScreen>
  )
}
