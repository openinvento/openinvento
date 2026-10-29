"use client"

import { useEffect, useState } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { GalleryVerticalEndIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { cn } from "cn"
import { useTranslation } from "react-i18next"

import { getOIDCConfig, login, startOIDCLogin, type OIDCConfig } from "@/utils/api/auth"
import { getInstanceSettings } from "@/utils/api/settings"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  // ?error=sso is set by the backend after a failed single sign-on; ?local=1 shows the
  // password form for break-glass accounts even when local login or auto-redirect is on.
  // ?logged_out=1 stops auto-redirect, which would log the user straight back in at the provider.
  const ssoFailed = searchParams.get("error") === "sso"
  const forceLocalLogin = searchParams.get("local") === "1"
  const loggedOut = searchParams.get("logged_out") === "1"
  const [identifier, setIdentifier] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowEmailLogin, setAllowEmailLogin] = useState(false)
  const [allowSignup, setAllowSignup] = useState(false)
  const [oidcConfig, setOidcConfig] = useState<OIDCConfig | null>(null)
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    getOIDCConfig()
      .then((config) => {
        setOidcConfig(config)
        if (config.enabled && config.auto_redirect && !ssoFailed && !forceLocalLogin && !loggedOut) {
          setRedirecting(true)
          startOIDCLogin()
        }
      })
      .catch(() => undefined)
  }, [ssoFailed, forceLocalLogin, loggedOut])

  useEffect(() => {
    getInstanceSettings()
      .then((settings) => {
        setAllowEmailLogin(settings.allow_email_login)
        setAllowSignup(settings.allow_signup)
      })
      .catch(() => undefined)
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await login(identifier.trim(), password)
      navigate("/app", { replace: true })
    } catch (submissionError) {
      setError(getAuthErrorMessage(submissionError, t))
    } finally {
      setLoading(false)
    }
  }

  const ssoEnabled = Boolean(oidcConfig?.enabled)
  const showPasswordForm = !oidcConfig || oidcConfig.local_login_enabled || forceLocalLogin
  const ssoButtonLabel = oidcConfig?.button_label
    ? t("auth.sso.buttonWithProvider", { provider: oidcConfig.button_label })
    : t("auth.sso.button")

  if (redirecting) {
    return (
      <div className={cn("flex flex-col gap-6", className)} {...props}>
        <FieldDescription className="text-center">{t("auth.sso.redirecting")}</FieldDescription>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a
              href="#"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">OpenInvento</span>
            </a>
            <h1 className="text-xl font-bold">Welcome to OpenInvento</h1>
            {showPasswordForm && (
              <FieldDescription>
                {allowEmailLogin
                  ? "Sign in with your email address or username."
                  : "Sign in with your username."}
              </FieldDescription>
            )}
          </div>

          {ssoFailed && <FieldError>{t("auth.sso.error")}</FieldError>}

          {ssoEnabled && (
            <Field>
              <Button type="button" variant={showPasswordForm ? "outline" : "default"} onClick={startOIDCLogin}>
                {ssoButtonLabel}
              </Button>
            </Field>
          )}

          {ssoEnabled && showPasswordForm && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {t("auth.sso.divider")}
              <span className="h-px flex-1 bg-border" />
            </div>
          )}

          {showPasswordForm && (
            <>
              <Field>
                <FieldLabel htmlFor="identifier">
                  {allowEmailLogin ? "Email or username" : "Username"}
                </FieldLabel>
                <Input
                  id="identifier"
                  name="identifier"
                  type="text"
                  placeholder={allowEmailLogin ? "name@example.com" : "Username"}
                  autoComplete="username"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </Field>

              <Field>
                <FieldError>{error}</FieldError>
                <Button type="submit" disabled={loading}>
                  {loading ? "Signing in..." : "Login"}
                </Button>
              </Field>
            </>
          )}
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {allowSignup && <>Need an account? <a href="/auth/signup">Sign up</a>.{" "}</>}
      </FieldDescription>
    </div>
  )
}
