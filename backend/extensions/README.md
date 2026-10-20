# Backend extensions

Extensions are optional Django apps stored as packages in this directory. Set
`OPENINVENTO_EXTENSIONS` to a comma-separated list of directory names to enable
them, for example `OPENINVENTO_EXTENSIONS=loans`. Extensions are disabled by
default.

Each enabled extension must provide one `AppConfig` subclass in `apps.py`.
Django then loads its models, migrations, admin registrations, and `ready()`
hooks as it would for any other installed app. An extension may provide a
`urls.py`; when present, its routes are included below `/api/<extension-name>/`.
Set `url_prefix` or `urlconf` on the app config to customize those defaults.

After enabling an extension, apply its migrations with `python manage.py
migrate`. Deactivating it removes its models and routes from the running app;
it does not delete its database tables or data.
