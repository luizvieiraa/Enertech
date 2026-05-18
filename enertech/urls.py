from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect
from django.conf import settings
from django.conf.urls.static import static

def home_redirect(request):
    return redirect('home')  # Redirecionar para home, não login

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_redirect),
    path('', include('accounts.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)