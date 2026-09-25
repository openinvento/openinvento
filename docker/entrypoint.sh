#!/bin/sh

set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

export DJANGO_WSGI_MODULE=openinvento.wsgi:application

echo "Starting Django..."
gunicorn \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --access-logfile "-" \
    --error-logfile "-" \
    "${DJANGO_WSGI_MODULE}" &
backend_pid=$!

echo "Starting nginx..."
nginx -g "daemon off;" &
nginx_pid=$!

trap 'kill "$backend_pid" "$nginx_pid" 2>/dev/null || true' INT TERM EXIT

wait -n "$backend_pid" "$nginx_pid"
status=$?

kill "$backend_pid" "$nginx_pid" 2>/dev/null || true
wait "$backend_pid" "$nginx_pid" 2>/dev/null || true
exit "$status"