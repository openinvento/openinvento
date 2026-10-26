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
} from "@/components/ui/combobox"
import type { ThirdPartyProvider } from "@/utils/api/inventory"

type ThirdPartyProviderSelectorProps = {
  id: string
  label: string
  emptyLabel: string
  providers: ThirdPartyProvider[]
  providerId: string
  onProviderChange: (providerId: string) => void
}

export default function ThirdPartyProviderSelector({ id, label, emptyLabel, providers, providerId, onProviderChange }: ThirdPartyProviderSelectorProps) {
  const selectedProvider = providers.find((provider) => provider.uuid === providerId) ?? null

  return (
    <Combobox<ThirdPartyProvider>
      items={[{ label, items: providers }]}
      value={selectedProvider}
      onValueChange={(provider) => onProviderChange(provider?.uuid ?? "")}
      itemToStringValue={(provider) => provider.uuid}
      itemToStringLabel={(provider) => provider.name}
      disabled={providers.length === 0}
    >
      <ComboboxInput id={id} className="h-9 w-full" aria-label={label} placeholder={providers.length ? label : emptyLabel} />
      <ComboboxContent>
        <ComboboxEmpty>{emptyLabel}</ComboboxEmpty>
        <ComboboxList>
          {(group) => <ComboboxGroup key={group.label} items={group.items}>
            <ComboboxLabel>{group.label}</ComboboxLabel>
            <ComboboxCollection>
              {(provider) => <ComboboxItem key={provider.uuid} value={provider}>{provider.name}</ComboboxItem>}
            </ComboboxCollection>
          </ComboboxGroup>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
