"use client"

import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
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
import { signup } from "@/utils/api/auth"
import { getInstanceSettings } from "@/utils/api/settings"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [allowEmailLogin, setAllowEmailLogin] = useState(false)
  const [allowSignup, setAllowSignup] = useState(false)

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
    setError(null)

    if (password !== confirmPassword) {
      setError(t("auth.errors.passwordMismatch"))
      return
    }

    setLoading(true)
    try {
      await signup(username.trim(), allowEmailLogin ? email.trim() : "", name.trim(), password)
      navigate("/app", { replace: true })
    } catch (submissionError) {
      setError(getAuthErrorMessage(submissionError, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      {!allowSignup ? (
        <FieldDescription className="text-center">{t("auth.signupDisabled")}</FieldDescription>
      ) : (
      <form onSubmit={handleSubmit} className="space-y-6">
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="/" className="flex flex-col items-center gap-2 font-medium">
              <div className="flex size-8 items-center justify-center rounded-md">
                <GalleryVerticalEndIcon className="size-6" />
              </div>
              <span className="sr-only">OpenInvento</span>
            </a>
            <h1 className="text-xl font-bold">Create your OpenInvento account</h1>
            <FieldDescription>
              Sign up to start managing your inventory.
            </FieldDescription>
          </div>

          <Field>
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="username">Username</FieldLabel>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </Field>

          {allowEmailLogin && (
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
          )}

          <Field>
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="confirm-password">Confirm password</FieldLabel>
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
          </Field>

          <Field>
            <FieldError>{error}</FieldError>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      )}
      <FieldDescription className="px-6 text-center">
        Already have an account? <a href="/auth/login">Log in</a>.
      </FieldDescription>
    </div>
  )
}
