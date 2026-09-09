import { useState } from "react";
import { FieldDescription } from "@/components/ui/field";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ThemeOption = "light" | "dark" | "system";

export default function SettingsPage() {
  const [theme, setTheme] = useState<ThemeOption>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("theme") as ThemeOption) || "system";
    }
    return "system";
  });

  const handleThemeChange = (newTheme: any) => {
    setTheme(newTheme);

    if (typeof window !== "undefined") {
      if (newTheme === "system") {
        localStorage.removeItem("theme");
      } else {
        localStorage.setItem("theme", newTheme);
      }

      window.dispatchEvent(new Event("storage"));
    }
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Design / Theme</label>
        
        {/* Dropdown-Menü */}
        <Select value={theme} onValueChange={handleThemeChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Design wählen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Hell</SelectItem>
            <SelectItem value="dark">Dunkel</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>

        <FieldDescription>
          Wähle aus, wie die Benutzeroberfläche dargestellt werden soll.
        </FieldDescription>
      </div>
    </section>
  );
}
