import type { ReactNode } from "react"
import { CalendarIcon, FolderKanban, HashIcon, ListIcon, Pencil, Plus, SlidersHorizontal, ToggleLeft, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { ArticleCategory, CategoryField } from "@/utils/api/inventory"
import { getCategoryLabel, getFieldLabel } from "@/utils/i18n-labels"

type CategoryCardProps = {
  category: ArticleCategory
  fields: CategoryField[]
  onEdit: () => void
  onDelete: () => void
  onAddField: () => void
  onEditField: (field: CategoryField) => void
  onDeleteField: (field: CategoryField) => void
}

export function CategoryCard({
  category,
  fields,
  onEdit,
  onDelete,
  onAddField,
  onEditField,
  onDeleteField,
}: CategoryCardProps) {
  const { t } = useTranslation()
  const fieldCountLabel = fields.length === 1
    ? t("categoriesAndFields.field")
    : t("categoriesAndFields.fields")

  return (
    <article className="rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <FolderKanban className="size-5" />
          </span>
          <div>
            <h3 className="font-semibold">{getCategoryLabel(category.name)}</h3>
            <p className="text-sm text-muted-foreground">
              {fields.length} {fieldCountLabel}
            </p>
          </div>
        </div>
        <Actions onEdit={onEdit} onDelete={onDelete} />
      </div>

      <div className="mt-4 border-t pt-3">
        {fields.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            {t("categoriesAndFields.noCategoryFields")}
          </p>
        ) : (
          fields.map((field) => (
            <FieldRow
              key={field.uuid}
              field={field}
              onEdit={() => onEditField(field)}
              onDelete={() => onDeleteField(field)}
            />
          ))
        )}
        <Button variant="ghost" size="sm" className="mt-2" onClick={onAddField}>
          <Plus /> {t("categoriesAndFields.addField")}
        </Button>
      </div>
    </article>
  )
}

export function FieldRow({
  field,
  onEdit,
  onDelete,
}: {
  field: CategoryField
  onEdit: () => void
  onDelete: () => void
}) {

  const Icon = 
    field.field_type === "text" ? <SlidersHorizontal className="size-4 shrink-0 text-muted-foreground" />
    : field.field_type === "number" ? <HashIcon className="size-4 shrink-0 text-muted-foreground" /> 
    : field.field_type === "boolean" ? <ToggleLeft className="size-4 shrink-0 text-muted-foreground" />
    : field.field_type === "date" ? <CalendarIcon className="size-4 shrink-0 text-muted-foreground" /> 
    : field.field_type === "select" ? <ListIcon className="size-4 shrink-0 text-muted-foreground" /> 
    : null

    const label = getFieldLabel(field)
    
  return (
    <div className="flex items-center justify-between gap-3 border-b py-2 last:border-b-0">
      <div className="flex min-w-0 items-center gap-2">
        {Icon}
        <span className="truncate text-sm font-medium">{label}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          {field.field_type}
        </span>
      </div>
      <Actions onEdit={onEdit} onDelete={onDelete} />
    </div>
  )
}

function Actions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation()

  return (
    <div className="flex shrink-0 gap-1">
      <Button
        variant="ghost"
        size="icon-sm"
        title={t("categoriesAndFields.edit")}
        aria-label={t("categoriesAndFields.edit")}
        onClick={onEdit}
      >
        <Pencil />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title={t("categoriesAndFields.delete")}
        aria-label={t("categoriesAndFields.delete")}
        onClick={onDelete}
      >
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  )
}

export function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {children}
    </label>
  )
}

export function EmptyState({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-muted/20 p-8 text-center">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>
        {action && (
          <Button className="mt-4" onClick={action}>
            <Plus /> {t("categoriesAndFields.createCategory")}
          </Button>
        )}
      </div>
    </div>
  )
}
