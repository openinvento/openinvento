import { ChevronDown, Pencil, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { ArticleCard, BoxCard } from "@/components/inventory/entity-cards"
import { Button } from "@/components/ui/button"
import {
  InventoryDraggable,
  InventoryDropTarget,
} from "@/components/inventory/inventory-dnd"
import type { Article, Box, Shelf } from "@/utils/api/inventory"
import type { InventoryViewMode } from "./view-mode"

type ShelfSectionProps = {
  shelf: Shelf
  viewMode: InventoryViewMode
  boxes: Box[]
  articles: Article[]
  isOpen: boolean
  onToggle: () => void
  onEditShelf: () => void
  onDeleteShelf: () => void
  onOpenBox: (box: Box) => void
  onEditBox: (box: Box) => void
  onDeleteBox: (box: Box) => void
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
  viewMode,
  boxes,
  articles,
  isOpen,
  onToggle,
  onEditShelf,
  onDeleteShelf,
  onOpenBox,
  onEditBox,
  onDeleteBox,
  onOpenArticle,
  onDeleteArticle,
}: ShelfSectionProps) {
  const { t } = useTranslation()
  const sectionBoxes = boxes.filter((box) => box.shelf === shelf.uuid)
  const sectionArticles = articles.filter(
    (article) => article.shelf === shelf.uuid && article.box === null,
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
                count: sectionBoxes.length + sectionArticles.length,
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
              <div className={viewMode === "list" ? "flex flex-col gap-2" : "grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6"}>
                {sectionBoxes.map((box) => (
                  <InventoryDraggable
                    key={box.uuid}
                    item={{ kind: "box", id: box.uuid }}
                  >
                    <InventoryDropTarget
                      target={{ kind: "box", id: box.uuid }}
                    >
                      <BoxCard
                        viewMode={viewMode}
                        name={box.name}
                        subtitle={t("areas.detail.articleCount", {
                          count: articles.filter(
                            (article) => article.box === box.uuid,
                          ).length,
                        })}
                        onOpen={() => onOpenBox(box)}
                        onRename={() => onEditBox(box)}
                        onDelete={() => onDeleteBox(box)}
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
                      viewMode={viewMode}
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

              {sectionBoxes.length + sectionArticles.length === 0 && (
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
