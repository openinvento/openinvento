
#!/bin/sh

set -e

echo "Running database migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

export DJANGO_WSGI_MODULE=openinvento.wsgi:application

echo "Starting Django..."
exec gunicorn \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --access-logfile "-" \
    --error-logfile "-" \
    "${DJANGO_WSGI_MODULE}"