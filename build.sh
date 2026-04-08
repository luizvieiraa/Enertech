#!/usr/bin/env bash
pip install -r requirements.txt
python manage.py collectstatic --noinput --clear
python manage.py migrate
python manage.py ensure_admin_user
