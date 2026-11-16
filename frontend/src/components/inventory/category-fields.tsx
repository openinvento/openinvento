import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ArticleFieldValue, CategoryField } from "@/utils/api/inventory"
import { getFieldLabel } from "@/utils/i18n-labels"

type CategoryFieldsProps = {
  fields: CategoryField[]
  values?: ArticleFieldValue[]
  className?: string
}

export function CategoryFields({ fields, values = [], className }: CategoryFieldsProps) {
  const { t } = useTranslation()

  if (fields.length === 0) return null

  return (
    <div className={`grid gap-4 sm:grid-cols-2${className ? ` ${className}` : ""}`}>
      {fields.map((field) => {
        const value = values.find((item) => item.field === field.uuid)
        return (
          <CategoryFieldInput
            key={field.uuid}
            field={field}
            label={getFieldLabel(field)}
            selectLabel={t("articles.page.fields.selectValue")}
            value={value}
          />
        )
      })}
    </div>
  )
}

function CategoryFieldInput({
  field,
  label,
  selectLabel,
  value,
}: {
  field: CategoryField
  label: string
  selectLabel: string
  value?: ArticleFieldValue
}) {
  const { t } = useTranslation()
  const inputName = `custom_${field.key}`
  const currentValue = value?.value?.toString() ?? ""

  return (
    <label className="grid gap-1.5 text-sm font-medium">
      {label}
      {field.field_type === "select" ? (
        <Select name={inputName} defaultValue={currentValue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={selectLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{selectLabel}</SelectItem>
            {field.options.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      ) : field.field_type === "boolean" ? (
        <div className="flex h-8 items-center">
          <Switch name={inputName} value="true" defaultChecked={value?.value === true} />
        </div>
      ) : field.field_type === "date" ? (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Input name={inputName} type="date" defaultValue={currentValue} className="min-w-40 flex-1" />
          <span className="flex h-8 items-center gap-2 rounded-lg border px-2.5 text-xs font-normal whitespace-nowrap">
            <span>{t("categoriesAndFields.dateNotifications")}</span>
            <Switch
              name={`notify_date_${field.key}`}
              value="true"
              defaultChecked={value?.notify_on_date ?? false}
              aria-label={t("categoriesAndFields.dateNotifications")}
            />
          </span>
        </div>
      ) : (
        <Input
          name={inputName}
          type={field.field_type === "number" ? "number" : "text"}
          defaultValue={currentValue}
        />
      )}
    </label>
  )
}
