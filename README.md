# openinvento
OpenInvento - Selfhosted Inventory Manager

# Installation

## Env Variables

The Docker deployment reads these variables from the environment or a `.env` file:

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `APP_URL` | Recommended | None | Public URL where OpenInvento is accessible, used for CSRF protection. |
| `APP_URLS` | No | None | Comma-separated additional trusted application URLs. |
| `SECRET_KEY` | Recommended | Unsafe fallback | Secret key used by Django. Set a long random value in production. |
| `DATA_DIRECTORY` | No | `/data` in Docker | Directory for the database and uploaded files. |
| `INIT_ADMIN_USERNAME` | Required when enabled | None | Username for the initial administrator account. |
| `INIT_ADMIN_PASSWORD` | Required when enabled | None | Password for the initial administrator account. It must be changed on first login. |
| `CREATE_INIT_ADMIN` | No | `true` | Set to `false` to disable automatic initial administrator creation. |

The initial administrator is created after migrations only when the database contains no users. Its `require_reset` flag forces a credential change after the first successful login. Once any user exists, changing the initialization variables does not modify existing accounts.

Example `.env` values:

```dotenv
APP_URL=http://localhost:8080
SECRET_KEY=replace-with-a-long-random-value
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=replace-with-a-strong-password
CREATE_INIT_ADMIN=true
```

## Data architecture
"inventory" 
    -> "Users" (a user can be assigned to ONE inventory. So an inventory can be accessible by multiple users) Multi inventory per user may follow later
    -> "Areas"
        -> "Shelves"
            -> "Chests"
                -> "Articles"


## Fair-Code & License
OpenInvento is Source-Available and completely free for personal, educational, and non-commercial use.

**Why this license?** 
We want to keep this project independent. This license ensures that large corporations and cloud providers cannot simply take OpenInvento, package it as a paid commercial service, and profit from my work without giving anything back. 

* **Personal & Hobby Use:** 100% Free. Manage your home lab, tools, or private collections with full peace of mind.
* **Commercial Use:** If you want to use OpenInvento for corporate operations or commercial warehouses, please contact us for an usage permission.
