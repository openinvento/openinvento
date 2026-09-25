FROM node:24-alpine AS frontend-build

WORKDIR /app/frontend

RUN corepack enable

COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./

ARG APP_VERSION
ENV VITE_APP_VERSION=${APP_VERSION}

RUN pnpm build


FROM python:3.14-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update \
    && apt-get install --no-install-recommends -y nginx \
    && rm -f /etc/nginx/sites-enabled/default \
    && rm -f /etc/nginx/conf.d/*.conf \
    && rm -rf /var/lib/apt/lists/*

COPY backend/pyproject.toml .

RUN pip install --no-cache-dir .

COPY backend/ .
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]