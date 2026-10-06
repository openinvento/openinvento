import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react"

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  addUser,
  deleteUser,
  getInstanceSettings,
  getUsers,
  type AdminUser,
  updateInstanceSettings,
  updateUser,
} from "@/utils/api/settings"
import { Button } from "../ui/button"
import { getAuthErrorMessage } from "@/utils/api/auth-errors"
import { Switch } from "../ui/switch"

type UserForm = {
  username: string
  email: string
  name: string
  password: string
  is_superuser: boolean
}

const emptyForm: UserForm = {
  username: "",
  email: "",
  name: "",
  password: "",
  is_superuser: false,
}

export default function AdminSettings() {
  const { t } = useTranslation()
  const [allowEmailLogin, setAllowEmailLogin] = useState(false)
  const [settingsError, setSettingsError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [userError, setUserError] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(emptyForm)
  const [editingUuid, setEditingUuid] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    Promise.all([getInstanceSettings(), getUsers()])
      .then(([settings, loadedUsers]) => {
        setAllowEmailLogin(settings.allow_email_login)
        setUsers(loadedUsers)
      })
      .catch(() => {
        setSettingsError(t("settings.instanceSettingsLoadError"))
        setUserError(t("settings.admin.loadUsersError"))
      })
      .finally(() => setUsersLoading(false))
  }, [t])

  async function handleEmailLoginChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.checked
    setAllowEmailLogin(value)
    setSaving(true)
    setSettingsError(null)
    try {
      await updateInstanceSettings({ allow_email_login: value })
    } catch {
      setAllowEmailLogin(!value)
      setSettingsError(t("settings.instanceSettingsSaveError"))
    } finally {
      setSaving(false)
    }
  }

  function openAddForm() {
    setForm(emptyForm)
    setEditingUuid(null)
    setUserError(null)
    setFormOpen(true)
  }

  function openEditForm(user: AdminUser) {
    setForm({
      username: user.username,
        email: user.email ?? "",
      name: user.name,
      password: "",
      is_superuser: user.is_superuser,
    })
    setEditingUuid(user.uuid)
    setUserError(null)
    setFormOpen(true)
  }

  async function handleUserSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setUserError(null)
    if (!editingUuid && !form.password) {
      setUserError(t("settings.admin.passwordRequired"))
      return
    }
    setSaving(true)
    try {
      const userInput = allowEmailLogin
        ? { ...form, password: form.password || undefined }
        : {
            username: form.username,
            name: form.name,
            password: form.password || undefined,
            is_superuser: form.is_superuser,
          }
      const savedUser = editingUuid
        ? await updateUser(editingUuid, userInput)
        : await addUser(userInput)
      setUsers((currentUsers) =>
        editingUuid
          ? currentUsers.map((user) => user.uuid === savedUser.uuid ? savedUser : user)
          : [...currentUsers, savedUser].sort((left, right) => left.name.localeCompare(right.name)),
      )
      setFormOpen(false)
    } catch (error) {
      setUserError(getAuthErrorMessage(error, t))
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteUser(user: AdminUser) {
    if (!window.confirm(t("settings.admin.confirmDelete", { name: user.name || user.username }))) return
    setUserError(null)
    try {
      await deleteUser(user.uuid)
      setUsers((currentUsers) => currentUsers.filter((currentUser) => currentUser.uuid !== user.uuid))
    } catch {
      setUserError(t("settings.admin.deleteUserError"))
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="border-b pb-7">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 rounded-md bg-primary/10 p-2 text-primary">
            <ShieldCheck className="size-4" />
          </div>
          <div>
            <h2 className="font-semibold">
              {t("settings.allowEmailLogin")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("settings.allowEmailLoginDescription")}
            </p>
          </div>
        </div>
        <Field>
          <FieldLabel
            htmlFor="allow-email-login"
            className="flex-row items-center text-sm font-normal"
          >
            <Switch 
                id="allow-email-login" 
                required 
                checked={allowEmailLogin} 
                disabled={saving}
                onCheckedChange={(checked: boolean) => handleEmailLoginChange({ target: { checked } } as React.ChangeEvent<HTMLInputElement>)}
              />
            {t("settings.admin.enableEmailLogin")}
          </FieldLabel>
          <FieldError>{settingsError}</FieldError>
        </Field>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="mt-1 text-xl font-semibold">
              {t("settings.admin.userManagement")}
            </h2>
          </div>
          <Button className="px-10" onClick={openAddForm}>
            <Plus />
            {t("settings.admin.addUser")}
          </Button>
        </div>

        {formOpen && (
          <form
            onSubmit={handleUserSubmit}
            className="mb-5 grid gap-4 rounded-xl border bg-muted/20 p-5 sm:grid-cols-2"
          >
            <div className="flex items-center justify-between sm:col-span-2">
              <h3 className="font-semibold">
                {editingUuid
                  ? t("settings.admin.editUser")
                  : t("settings.admin.newUser")}
              </h3>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                onClick={() => setFormOpen(false)}
                aria-label={t("settings.admin.cancel")}
              >
                <X />
              </Button>
            </div>

            <Field>
              <FieldLabel htmlFor="user-name">
                {t("settings.admin.name")}
              </FieldLabel>
              <Input
                id="user-name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="user-username">
                {t("settings.admin.username")}
              </FieldLabel>
              <Input
                id="user-username"
                required
                value={form.username}
                onChange={(event) =>
                  setForm({ ...form, username: event.target.value })
                }
              />
            </Field>

            {allowEmailLogin && (
              <Field>
                <FieldLabel htmlFor="user-email">
                  {t("settings.admin.email")}
                </FieldLabel>
                <Input
                  id="user-email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    setForm({ ...form, email: event.target.value })
                  }
                />
              </Field>
            )}

            <Field>
              <FieldLabel htmlFor="user-password">
                {t("settings.admin.password")}
              </FieldLabel>
              <Input
                id="user-password"
                type="password"
                required={!editingUuid}
                minLength={8}
                value={form.password}
                onChange={(event) =>
                  setForm({ ...form, password: event.target.value })
                }
              />
              <FieldDescription>
                {editingUuid && t("settings.admin.passwordHint")}
              </FieldDescription>
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel
                htmlFor="user-admin"
                className="flex-row items-center text-sm font-normal"
              >
                <input
                  id="user-admin"
                  type="checkbox"
                  checked={form.is_superuser}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      is_superuser: event.target.checked,
                    })
                  }
                  className="size-4 accent-primary"
                />
                {t("settings.admin.administrator")}
              </FieldLabel>
            </Field>

            <FieldError className="sm:col-span-2">{userError}</FieldError>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
              >
                {t("settings.admin.cancel")}
              </Button>
              <Button type="submit" disabled={saving}>
                {t("settings.admin.saveUser")}
              </Button>
            </div>
          </form>
        )}

        <FieldError className="mb-3">{userError}</FieldError>

        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">
                  {t("settings.admin.name")}
                </th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">
                  {t("settings.admin.username")}
                </th>
                <th className="px-4 py-3 font-medium">
                  {t("settings.admin.role")}
                </th>
                <th className="px-4 py-3 text-right font-medium">
                  {t("settings.admin.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {usersLoading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t("settings.admin.loadingUsers")}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-4 py-8 text-center text-muted-foreground"
                  >
                    {t("settings.admin.noUsers")}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user.uuid}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">
                        {user.name || user.username}
                      </div>
                      {allowEmailLogin && (
                        <div className="text-xs text-muted-foreground">
                          {user.email || t("settings.admin.noEmail")}
                        </div>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {user.username}
                    </td>
                    <td className="px-4 py-3">
                      {user.is_superuser ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <ShieldCheck className="size-3.5" />
                          {t("settings.admin.administrator")}
                        </span>
                      ) : (
                        t("settings.admin.member")
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => openEditForm(user)}
                          aria-label={t("settings.admin.editUser")}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleDeleteUser(user)}
                          aria-label={t("settings.admin.deleteUser")}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}