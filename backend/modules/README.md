# Backend modules

Modules are optional Django apps stored as packages in this directory. Instance
administrators can enable or disable available modules under Instance Settings.
`OPENINVENTO_MODULES` provides the initial enabled-module list when the instance
settings row is first created, for example `OPENINVENTO_MODULES=loans`.

Each enabled module must provide one `AppConfig` subclass in `apps.py`.
Django then loads its models, migrations, admin registrations, and `ready()`
hooks as it would for any other installed app. A module may provide a
`urls.py`; when present, its routes are included below `/api/<module-name>/`.
Set `url_prefix` or `urlconf` on the app config to customize those defaults.

Apply module migrations with `python manage.py migrate` after installing a new
module. Disabling a module hides its frontend and API routes; its database
tables and data are retained.

## Frontend

A module's frontend lives in `frontend/modules/<module-name>/`. To show a
component in a core page, register it for a slot in the module's `index.ts`,
which the frontend loads at startup:

```ts
import { registerSlot } from "@/slots/slot-manager"
import MyCard from "./MyCard"

registerSlot("entry-details", "<module-name>", MyCard)
```

`<Slot>` renders the registered components only while the module is enabled.
The available slots and the props they pass are listed in
`frontend/src/slots/slot-manager.ts`; `entry-details` is shown on the article,
box and area pages and in the shelf edit dialog.
