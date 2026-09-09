import { useState } from "react"

import { Button } from "@/components/ui/button"
import { FieldDescription } from "@/components/ui/field"
import { getCurrentSession, type SessionUser } from "@/utils/api/auth"

export default function Dashboard() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [status, setStatus] = useState("No API request made yet.")
  const [loading, setLoading] = useState(false)

  async function testApi() {
    setLoading(true)
    setStatus("Calling Django...")

    try {
      const session = await getCurrentSession()
      setUser(session.user)
      setStatus(session.authenticated ? "Django session is active." : "No active Django session.")
    } catch (error) {
      setUser(null)
      setStatus(error instanceof Error ? error.message : "Django request failed.")
    } finally {
      setLoading(false)
    }
  }

  // Function to toggle theme
  function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
    }
  }


  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <FieldDescription>
          Use this control to verify that the React app can reach Django with your session cookie.
        </FieldDescription>
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">Django API test</h2>
            <p className="text-sm text-muted-foreground">GET /api/me/</p>
          </div>
          <Button type="button" onClick={testApi} disabled={loading}>
            {loading ? "Testing..." : "Test Django API"}
          </Button>
        </div>
        <p className="mt-4 text-sm" role="status">{status}</p>
        {user && (
          <pre className="mt-3 overflow-auto rounded-lg bg-muted p-3 text-xs">
            {JSON.stringify(user, null, 2)}
          </pre>
        )}

        <Button onClick={toggleTheme}>Toggle Dark/ light</Button>
      </div>
    </section>
  )
}
