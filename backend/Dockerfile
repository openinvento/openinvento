FROM python:3.13-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY backend/pyproject.toml .

RUN pip install --no-cache-dir .

COPY backend/ .

COPY backend/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ARG APP_VERSION
ENV APP_VERSION=${APP_VERSION}

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]