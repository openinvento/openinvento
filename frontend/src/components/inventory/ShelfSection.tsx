import { ChevronDown, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ArticleCard, ChestCard } from "@/components/inventory/entity-cards"
import { Button } from "@/components/ui/button"
import {
  InventoryDraggable,
  InventoryDropTarget,
} from "@/components/inventory/inventory-dnd"
import type { Article, Chest, Shelf } from "@/utils/api/inventory"

type ShelfSectionProps = {
  shelf: Shelf
  chests: Chest[]
  articles: Article[]
  isOpen: boolean
  onToggle: () => void
  onEditShelf: () => void
  onDeleteShelf: () => void
  onOpenChest: (chest: Chest) => void
  onEditChest: (chest: Chest) => void
  onDeleteChest: (chest: Chest) => void
  onOpenArticle: (article: Article) => void
  onDeleteArticle: (article: Article) => void
}

function getLowStockBadge(article: Article, label: string) {
  const minimumQuantity = article.custom_fields.minimum_quantity
  return article.stock_tracking &&
    typeof minimumQuantity === "number" &&
    article.quantity <= minimumQuantity
    ? label
    : undefined
}

export function ShelfSection({
  shelf,
  chests,
  articles,
  isOpen,
  onToggle,
  onEditShelf,
  onDeleteShelf,
  onOpenChest,
  onEditChest,
  onDeleteChest,
  onOpenArticle,
  onDeleteArticle,
}: ShelfSectionProps) {
  const { t } = useTranslation()
  const sectionChests = chests.filter((chest) => chest.shelf === shelf.uuid)
  const sectionArticles = articles.filter(
    (article) => article.shelf === shelf.uuid && article.chest === null,
  )

  return (
    <InventoryDraggable
      item={{ kind: "shelf", id: shelf.uuid }}
    >
      <InventoryDropTarget target={{ kind: "shelf", id: shelf.uuid }}>
        <div className="rounded-2xl border bg-muted/15">
          <button
            className="flex w-full items-center gap-3 p-4 text-left"
            onClick={onToggle}
          >
            <ChevronDown
              className={`size-4 transition ${isOpen ? "" : "-rotate-90"}`}
            />
            <span className="font-semibold">{shelf.name}</span>
            <span className="text-sm text-muted-foreground">
              {t("areas.detail.itemCount", {
                count: sectionChests.length + sectionArticles.length,
              })}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <Button
                title={t("areas.detail.renameShelf")}
                aria-label={t("areas.detail.renameShelf")}
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  onEditShelf()
                }}
              >
                <Pencil />
              </Button>
              <Button
                title={t("areas.detail.deleteShelf")}
                aria-label={t("areas.detail.deleteShelf")}
                variant="ghost"
                size="icon-xs"
                onClick={(event) => {
                  event.stopPropagation()
                  onDeleteShelf()
                }}
              >
                <Trash2 />
              </Button>
            </span>
          </button>

          {isOpen && (
            <div className="border-t p-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
                {sectionChests.map((chest) => (
                  <InventoryDraggable
                    key={chest.uuid}
                    item={{ kind: "chest", id: chest.uuid }}
                  >
                    <InventoryDropTarget
                      target={{ kind: "chest", id: chest.uuid }}
                    >
                      <ChestCard
                        name={chest.name}
                        subtitle={t("areas.detail.articleCount", {
                          count: articles.filter(
                            (article) => article.chest === chest.uuid,
                          ).length,
                        })}
                        onOpen={() => onOpenChest(chest)}
                        onRename={() => onEditChest(chest)}
                        onDelete={() => onDeleteChest(chest)}
                      />
                    </InventoryDropTarget>
                  </InventoryDraggable>
                ))}
                {sectionArticles.map((article) => (
                  <InventoryDraggable
                    key={article.uuid}
                    item={{ kind: "article", id: article.uuid }}
                  >
                    <ArticleCard
                      name={article.name}
                      articleIcon={article.icon}
                      articleImage={article.image}
                      subtitle={t("areas.detail.inStock", {
                        count: article.quantity,
                      })}
                      badge={getLowStockBadge(
                        article,
                        t("areas.detail.lowStock"),
                      )}
                      onOpen={() => onOpenArticle(article)}
                      onRename={() => onOpenArticle(article)}
                      onDelete={() => onDeleteArticle(article)}
                    />
                  </InventoryDraggable>
                ))}
              </div>

              {sectionChests.length + sectionArticles.length === 0 && (
                <p className="py-3 text-sm text-muted-foreground">
                  {t("areas.detail.nothingStored")}
                </p>
              )}
            </div>
          )}
        </div>
      </InventoryDropTarget>
    </InventoryDraggable>
  )
}
