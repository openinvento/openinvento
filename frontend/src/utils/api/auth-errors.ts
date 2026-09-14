import i18n from "@/i18n"
import { ApiError } from "./base"

type Translate = (key: string, options?: Record<string, unknown>) => string

function firstMessage(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0]
  }

  return typeof value === "string" ? value : null
}

function getFieldError(payload: unknown, field: string) {
  if (!payload || typeof payload !== "object") {
    return null
  }

  return firstMessage((payload as Record<string, unknown>)[field])
}

function translateFieldError(field: string, message: string, t: Translate) {
  const normalizedMessage = message.toLowerCase()

  if (field === "password") {
    if (normalizedMessage.includes("too short")) return t("auth.errors.passwordTooShort")
    if (normalizedMessage.includes("common password")) return t("auth.errors.passwordCommon")
    if (normalizedMessage.includes("entirely numeric")) return t("auth.errors.passwordNumeric")
    if (normalizedMessage.includes("similar")) return t("auth.errors.passwordSimilar")
  }

  if (normalizedMessage.includes("already exists") || normalizedMessage.includes("already taken")) {
    return t(`auth.errors.${field}Taken`)
  }

  if (normalizedMessage.includes("required")) {
    return t(`auth.errors.${field}Required`)
  }

  if (field === "email" && normalizedMessage.includes("valid email")) {
    return t("auth.errors.emailInvalid")
  }

  return t("auth.errors.invalidField", { field: t(`auth.fields.${field}`) })
}

export function getAuthErrorMessage(error: unknown, t: Translate) {
  if (error instanceof ApiError) {
    const fields = ["username", "email", "name", "password"]

    for (const field of fields) {
      const message = getFieldError(error.payload, field)
      if (message) return translateFieldError(field, message, t)
    }

    if (error.status === 401) return t("auth.errors.invalidCredentials")
    if (error.status === 400) return t("auth.errors.invalidRequest")
  }

  return t("auth.errors.generic")
}

export function getAuthTranslation() {
  return i18n.t.bind(i18n) as Translate
}