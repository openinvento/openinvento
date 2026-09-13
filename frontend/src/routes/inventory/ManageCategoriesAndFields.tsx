import { useEffect, useState, type FormEvent } from "react"
import { useTranslation } from "react-i18next"
import { Plus } from "lucide-react"
import { CategoryCard, EmptyState, FieldRow, FormField } from "@/components/inventory/category-field-manager"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { InventoryModal } from "@/components/inventory/inventory-modal"
import { Button } from "@/components/ui/button"
import BaseScreen from "@/layouts/BaseScreen"
import {
  inventoryApi,
  type ArticleCategory,
  type CategoryField,
  type Inventory,
} from "@/utils/api/inventory"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type CategoryModal = { category?: ArticleCategory } | null
type FieldModal = { field?: CategoryField; category: string | null } | null

const fieldTypeOptions = ["text", "number", "boolean", "date", "barcode"] as const

export default function ManageCategoriesAndFieldsPage() {
  const { t } = useTranslation()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [categories, setCategories] = useState<ArticleCategory[]>([])
  const [fields, setFields] = useState<CategoryField[]>([])
  const [categoryModal, setCategoryModal] = useState<CategoryModal>(null)
  const [fieldModal, setFieldModal] = useState<FieldModal>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  async function load() {
    setError("")
    try {
      const [inventories, nextCategories, nextFields] = await Promise.all([
        inventoryApi.listInventories(),
        inventoryApi.listCategories(),
        inventoryApi.listCategoryFields(),
      ])
      setInventory(inventories[0] ?? null)
      setCategories(nextCategories)
      setFields(nextFields)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("categoriesAndFields.errors.load"))
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = new FormData(event.currentTarget).get("name")?.toString().trim()
    if (!name || (!inventory && !categoryModal?.category)) return

    setSaving(true)
    try {
      if (categoryModal?.category) {
        await inventoryApi.update("article-categories", categoryModal.category.uuid, { name })
      } else {
        await inventoryApi.create("article-categories", {
          name,
          inventory: inventory?.uuid,
        })
      }
      setCategoryModal(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("categoriesAndFields.errors.saveCategory"))
    } finally {
      setSaving(false)
    }
  }

  async function saveField(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const label = form.get("label")?.toString().trim()
    const category = form.get("category")?.toString() || null
    const fieldType = form.get("field_type")?.toString() || "text"

    if (!label || !fieldType || (!inventory && !fieldModal?.field)) {
      console.error("Missing required field data:", { label, fieldType, category, inventory, fieldModal })
      return
    }

    setSaving(true)
    try {
      const payload = { label, field_type: fieldType, category }
      if (fieldModal?.field) {
        await inventoryApi.update("category-fields", fieldModal.field.uuid, payload)
      } else {
        await inventoryApi.create("category-fields", {
          ...payload,
          inventory: inventory?.uuid,
        })
      }
      setFieldModal(null)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("categoriesAndFields.errors.saveField"))
    } finally {
      setSaving(false)
    }
  }

  async function removeCategory(category: ArticleCategory) {
    const confirmed = window.confirm(
      t("categoriesAndFields.confirmDeleteCategory", { name: category.name }),
    )
    if (!confirmed) return

    await removeItem("article-categories", category.uuid)
  }

  async function removeField(field: CategoryField) {
    const confirmed = window.confirm(
      t("categoriesAndFields.confirmDeleteField", { name: field.label }),
    )
    if (!confirmed) return

    await removeItem("category-fields", field.uuid)
  }

  async function removeItem(kind: "article-categories" | "category-fields", uuid: string) {
    try {
      await inventoryApi.remove(kind, uuid)
      await load()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("categoriesAndFields.errors.delete"))
    }
  }

  const generalFields = fields.filter((field) => field.category === null)

  function fieldsForCategory(category: ArticleCategory) {
    return fields.filter((field) => field.category === category.uuid)
  }

  return (
    <BaseScreen
      eyebrow={inventory?.name ?? t("categoriesAndFields.inventory")}
      title={t("categoriesAndFields.title")}
      description={t("categoriesAndFields.description")}
      actions={
        <Button onClick={() => setCategoryModal({})} disabled={!inventory}>
          <Plus /> {t("categoriesAndFields.newCategory")}
        </Button>
      }
    >
      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!inventory && !error ? (
        <EmptyState
          title={t("categoriesAndFields.noInventoryTitle")}
          text={t("categoriesAndFields.noInventoryText")}
        />
      ) : (
        <div className="grid gap-6">
          
          <SectionHeader
            title={t("categoriesAndFields.categories")}
            action={
              <Button variant="outline" size="sm" onClick={() => setCategoryModal({})}>
                <Plus /> {t("categoriesAndFields.addCategory")}
              </Button>
            }
          />
          {categories.length === 0 ? (
            <EmptyState
              title={t("categoriesAndFields.noCategoriesTitle")}
              text={t("categoriesAndFields.noCategoriesText")}
              action={() => setCategoryModal({})}
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {categories.map((category) => (
                <CategoryCard
                  key={category.uuid}
                  category={category}
                  fields={fieldsForCategory(category)}
                  onEdit={() => setCategoryModal({ category })}
                  onDelete={() => void removeCategory(category)}
                  onAddField={() => setFieldModal({ category: category.uuid })}
                  onEditField={(field) => setFieldModal({ field, category: category.uuid })}
                  onDeleteField={(field) => void removeField(field)}
                />
              ))}
            </div>
          )}

          <section className="border-t pt-6">
            <SectionHeader
              title={t("categoriesAndFields.generalFields")}
              action={
                <Button variant="outline" size="sm" onClick={() => setFieldModal({ category: null })}>
                  <Plus /> {t("categoriesAndFields.addGeneralField")}
                </Button>
              }
            />
            <div className="mt-4 rounded-xl border bg-card">
              {generalFields.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">
                  {t("categoriesAndFields.noGeneralFields")}
                </p>
              ) : (
                generalFields.map((field) => (
                  <FieldRow
                    key={field.uuid}
                    field={field}
                    onEdit={() => setFieldModal({ field, category: null })}
                    onDelete={() => void removeField(field)}
                  />
                ))
              )}
            </div>
          </section>
        </div>
      )}

      <CategoryModalForm
        modal={categoryModal}
        saving={saving}
        onClose={() => setCategoryModal(null)}
        onSubmit={saveCategory}
      />
      <FieldModalForm
        modal={fieldModal}
        categories={categories}
        saving={saving}
        onClose={() => setFieldModal(null)}
        onSubmit={saveField}
      />
    </BaseScreen>
  )
}

function CategoryModalForm({
  modal,
  saving,
  onClose,
  onSubmit,
}: {
  modal: CategoryModal
  saving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useTranslation()

  return (
    <InventoryModal
      title={t(modal?.category ? "categoriesAndFields.editCategory" : "categoriesAndFields.newCategory")}
      open={modal !== null}
      submitting={saving}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <FormField label={t("categoriesAndFields.categoryName")}>
        <Input
          autoFocus
          name="name"
          defaultValue={modal?.category?.name}
          className="control"
          required
        />
      </FormField>
    </InventoryModal>
  )
}

function FieldModalForm({
  modal,
  categories,
  saving,
  onClose,
  onSubmit,
}: {
  modal: FieldModal
  categories: ArticleCategory[]
  saving: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const { t } = useTranslation()
  const [fieldType, setFieldType] = useState(modal?.field?.field_type ?? "text")
  const [category, setCategory] = useState(modal?.field?.category ?? modal?.category ?? "")

  return (
    <InventoryModal
      title={t(modal?.field ? "categoriesAndFields.editField" : "categoriesAndFields.newField")}
      open={modal !== null}
      submitting={saving}
      onClose={onClose}
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-1">
        <FormField label={t("categoriesAndFields.label")}>
          <Input
            autoFocus
            name="label"
            defaultValue={modal?.field?.label}
            className="control"
            required
          />
        </FormField>
      </div>

      {/* Field type selection */}
      <FormField label={t("categoriesAndFields.fieldType")}>
        <input type="hidden" name="field_type" value={fieldType} />

        <Select value={fieldType} onValueChange={(value) => setFieldType(value as typeof fieldTypeOptions[number])}>
          <SelectTrigger className={"w-full"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldTypeOptions.map((type) => (
              <SelectItem key={type} value={type}>
                {t(`categoriesAndFields.fieldTypes.${type}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      {/* Category Select */}
      <FormField label={t("categoriesAndFields.category")}>
        <input type="hidden" name="category" value={category} />

        <Select value={category} onValueChange={(value) => setCategory(value as string)}>
          <SelectTrigger className={"w-full"}>
            <SelectValue placeholder={t("categoriesAndFields.generalField")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("categoriesAndFields.generalField")}</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.uuid} value={cat.uuid}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

    </InventoryModal>
  )
}