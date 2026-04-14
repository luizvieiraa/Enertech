"""
Django settings for enertech project.
"""

from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent

try:
    import dj_database_url
except ModuleNotFoundError:
    dj_database_url = None

try:
    import whitenoise  # noqa: F401
    HAS_WHITENOISE = True
except ModuleNotFoundError:
    HAS_WHITENOISE = False

# ================================
# SEGURANÇA (Render + Local)
# ================================
SECRET_KEY = os.getenv('SECRET_KEY', 'fallback-dev-key')

DEBUG = os.getenv('DEBUG', 'True') == 'True'

# Configurar ALLOWED_HOSTS para diferentes ambientes
if os.getenv('RENDER_EXTERNAL_URL'):
    # Em produção no Render
    ALLOWED_HOSTS = [
        os.getenv('RENDER_EXTERNAL_URL').replace('https://', ''),
        os.getenv('RENDER_EXTERNAL_URL').replace('http://', ''),
        '.onrender.com',
    ]
else:
    # Em desenvolvimento local
    ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')


# ================================
# APPS
# ================================
INSTALLED_APPS = [
    'accounts',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]


# ================================
# MIDDLEWARE
# ================================
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

if HAS_WHITENOISE:
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')


# ================================
# URLS / TEMPLATES
# ================================
ROOT_URLCONF = 'enertech.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'enertech.wsgi.application'


# ================================
# BANCO DE DADOS
# ================================
# Usa PostgreSQL do Render se existir, senão usa SQLite local
if dj_database_url:
    DATABASES = {
        'default': dj_database_url.config(
            default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}"
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# ================================
# VALIDAÇÃO DE SENHA
# ================================
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# ================================
# INTERNACIONALIZAÇÃO
# ================================
LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True
USE_TZ = True


# ================================
# ARQUIVOS ESTÁTICOS
# ================================
STATIC_URL = '/static/'

STATICFILES_DIRS = [
    BASE_DIR / "static",
]

STATIC_ROOT = BASE_DIR / 'staticfiles'


# ================================
# LOGIN / LOGOUT
# ================================
LOGIN_REDIRECT_URL = 'home'
LOGOUT_REDIRECT_URL = 'login'


# ================================
# SESSÕES
# ================================
SESSION_COOKIE_AGE = 2592000  # 30 dias
SESSION_EXPIRE_AT_BROWSER_CLOSE = False
SESSION_SAVE_EVERY_REQUEST = True
SESSION_ENGINE = 'django.contrib.sessions.backends.db'

SESSION_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'


# ================================
# CSRF / SEGURANÇA
# ================================
CSRF_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_HTTPONLY = False
CSRF_TRUSTED_ORIGINS = os.getenv('CSRF_TRUSTED_ORIGINS', '').split(',') if os.getenv('CSRF_TRUSTED_ORIGINS') else []

# Permitir requisições para APIs externas (Nominatim)
if os.getenv('RENDER_EXTERNAL_URL'):
    CSRF_TRUSTED_ORIGINS.append(os.getenv('RENDER_EXTERNAL_URL'))

# Configurações para HTTPS em produção
if not DEBUG:
    SECURE_SSL_REDIRECT = True
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_SECURITY_POLICY = {
        'default-src': ("'self'",),
        'script-src': ("'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'),
        'style-src': ("'self'", "'unsafe-inline'", 'fonts.googleapis.com'),
        'font-src': ("'self'", 'fonts.gstatic.com'),
    }
CSRF_COOKIE_AGE = 31449600

CSRF_TRUSTED_ORIGINS = [
    'https://*.onrender.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000',
]


# ================================
# DEFAULT AUTO FIELD
# ================================
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
