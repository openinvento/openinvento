<picture>
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/openinvento/openinvento/refs/heads/main/assets/banner_light.png">
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/openinvento/openinvento/refs/heads/main/assets/banner_dark.png">
  <!-- Default fallback -->
  <img alt="Header" width="100%" src="https://raw.githubusercontent.com/openinvento/openinvento/refs/heads/main/assets/banner_light.png">
</picture>

# OpenInvento

[![Release](https://img.shields.io/github/v/release/openinvento/openinvento)](https://github.com/openinvento/openinvento/releases/latest) 
[![Build](https://github.com/openinvento/openinvento/actions/workflows/docker.yml/badge.svg)](https://github.com/openinvento/openinvento/actions/workflows/docker.yml) 
[![Python](https://img.shields.io/badge/python-%3E%3D3.11-blue)](https://www.python.org/) 
[![Stars](https://img.shields.io/github/stars/openinvento/openinvento?style=social)](https://github.com/openinvento/openinvento/stargazers)
![GHCR Total downloads](https://ghcr-badge.elias.eu.org/shield/openinvento/openinvento/openinvento)



OpenInvento - Selfhosted Inventory Manager


## Features

## App Screenshots
-- Coming soon -- 
<p align="center">
  <img alt="Screenshot 1" src="docs/Screenshot_home_light.png" width="100%" />
  <br / >
  <img alt="Screenshot 2" src="docs/Screenshot_gallery_light.png" width="49.6%" />
  <img alt="Screenshot 3y" src="docs/Screenshot_tv_gallery_light.png" width="49.6%" />
</p>
The UI is also available in dark mode and is fully responsive for mobile devices.
Gallery example images from https://pixabay.com/



# Installation

## Docker
docker volume create frametv_uploads
docker volume create frametv_db

docker run -d \
  --name frametv \
  -v frametv_uploads:/app/uploads \
  -v frametv_db:/app/instance \
  -p 8000:8000 \
  ghcr.io/openinvento/openinvento:latest

Or use the **docker-compose.yml** file: https://github.com/openinvento/openinvento/blob/main/docker-compose.yml

# Update
## Docker (docker run)
Pull the latest image and restart the container while keeping your data (persists in volumes)

Docker Compose (recommended):
1. `docker compose pull`
2. `docker compose up -d`


# Configuration

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
| `ENABLE_SIGNUP` | No | `false` | Set to `true` to enable public account signup. |

The initial administrator is created after migrations only when the database contains no users. Its `require_reset` flag forces a credential change after the first successful login. Once any user exists, changing the initialization variables does not modify existing accounts.

Example `.env` values:

```dotenv
APP_URL=http://localhost:8080
SECRET_KEY=replace-with-a-long-random-value
INIT_ADMIN_USERNAME=admin
INIT_ADMIN_PASSWORD=replace-with-a-strong-password
CREATE_INIT_ADMIN=true
```




## Fair-Code & License
OpenInvento is Source-Available and completely free for personal, educational, and non-commercial use.

**Why this license?** 
We want to keep this project independent. This license ensures that large corporations and cloud providers cannot simply take OpenInvento, package it as a paid commercial service, and profit from my work without giving anything back. 
