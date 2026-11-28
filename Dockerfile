FROM node:24-alpine AS frontend-build

WORKDIR /app/frontend

RUN corepack enable

# pnpm-workspace.yaml holds the overrides the frozen lockfile is checked against.
COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
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
    && apt-get install --no-install-recommends -y libcap2-bin nginx \
    && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx \
    && rm -rf /etc/nginx/sites-enabled/* /etc/nginx/sites-available/* \
    && rm -f /etc/nginx/conf.d/*.conf \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --home-dir /app --no-create-home app \
    && mkdir -p /data \
        /tmp/nginx/client_temp \
        /tmp/nginx/proxy_temp \
        /tmp/nginx/fastcgi_temp \
        /tmp/nginx/uwsgi_temp \
        /tmp/nginx/scgi_temp \
    && chown -R app:app /data /tmp/nginx

COPY backend/pyproject.toml .

RUN pip install --no-cache-dir .

COPY backend/ .
COPY --from=frontend-build /app/frontend/dist /usr/share/nginx/html

COPY docker/nginx.conf /etc/nginx/nginx.conf

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}
ENV DATA_DIRECTORY=/data

EXPOSE 80

USER app
ENTRYPOINT ["/entrypoint.sh"]