import { useEffect, useState } from "react"
import { cn } from "cn"

import { getEnabledModules, MODULES_CHANGED_EVENT } from "@/utils/api/modules"

import { getSlotRegistrations, type SlotName, type SlotProps } from "./slot-manager"

type Props<N extends SlotName> = SlotProps[N] & { name: N; className?: string }

/** Renders the components registered for a slot by enabled modules, or nothing if there are none. */
export default function Slot<N extends SlotName>({ name, className, ...props }: Props<N>) {
  const [enabledModules, setEnabledModules] = useState<string[]>([])

  useEffect(() => {
    let active = true
    const loadModules = () => {
      void getEnabledModules()
        .then((modules) => { if (active) setEnabledModules(modules) })
        .catch(() => { if (active) setEnabledModules([]) })
    }
    loadModules()
    window.addEventListener(MODULES_CHANGED_EVENT, loadModules)
    return () => { active = false; window.removeEventListener(MODULES_CHANGED_EVENT, loadModules) }
  }, [])

  const registrations = getSlotRegistrations(name).filter(({ module }) => enabledModules.includes(module))
  if (registrations.length === 0) return null

  return (
    <div className={cn("grid gap-4", className)}>
      {registrations.map(({ module, component: Component }) => (
        <Component key={module} {...(props as unknown as SlotProps[N])} />
      ))}
    </div>
  )
}
