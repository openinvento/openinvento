import { useMemo } from "react"
import { useTranslation } from "react-i18next"

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
} from "@/components/ui/combobox"
import type { Article, Box } from "@/utils/api/inventory"

type ItemKind = "article" | "box"
type ItemChoice = { kind: ItemKind; item: Article | Box }

type LoanItemSelectorProps = {
  articles: Article[]
  boxes: Box[]
  value: string
  onValueChange: (value: string) => void
}

export default function LoanItemSelector({ articles, boxes, value, onValueChange }: LoanItemSelectorProps) {
  const { t } = useTranslation()
  const itemChoices = useMemo(() => ({
    articles: articles.map((item) => ({ kind: "article" as const, item })),
    boxes: boxes.map((item) => ({ kind: "box" as const, item })),
  }), [articles, boxes])
  const selectedChoice = [...itemChoices.articles, ...itemChoices.boxes].find(
    ({ kind, item }) => `${kind}:${item.uuid}` === value,
  )

  return (
    <>
      <label className="grid gap-1.5 text-sm">
        {t("loans.item")}
        <Combobox<ItemChoice> items={[
          ...(itemChoices.articles.length ? [{ label: t("loans.article"), items: itemChoices.articles }] : []),
          ...(itemChoices.boxes.length ? [{ label: t("loans.box"), items: itemChoices.boxes }] : []),
        ]}
          value={selectedChoice ?? null}
          onValueChange={(choice) => onValueChange(choice ? `${choice.kind}:${choice.item.uuid}` : "")}
          itemToStringValue={(choice) => `${choice.kind}:${choice.item.uuid}`}
          itemToStringLabel={(choice) => choice.item.name}
          disabled={articles.length + boxes.length === 0}
        >
          <ComboboxInput className="h-9 w-full" placeholder={t("loans.item")} showClear />
          <ComboboxContent>
            <ComboboxEmpty>{t("loans.noItems")}</ComboboxEmpty>
            <ComboboxList>
              {(group) => <ComboboxGroup key={group.label} items={group.items}>
                <ComboboxLabel>{group.label}</ComboboxLabel>
                <ComboboxCollection>
                  {(choice) => <ComboboxItem key={`${choice.kind}:${choice.item.uuid}`} value={choice}>{choice.item.name}</ComboboxItem>}
                </ComboboxCollection>
                {group.label === t("loans.article") && boxes.length > 0 && <ComboboxSeparator />}
              </ComboboxGroup>}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </label>
    </>
  )
}
