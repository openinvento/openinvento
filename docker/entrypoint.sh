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

status=$?
while kill -0 "$backend_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
    sleep 1
done

if ! kill -0 "$backend_pid" 2>/dev/null; then
    wait "$backend_pid" || status=$?
else
    wait "$nginx_pid" || status=$?
fi

kill "$backend_pid" "$nginx_pid" 2>/dev/null || true
wait "$backend_pid" "$nginx_pid" 2>/dev/null || true
exit "$status"