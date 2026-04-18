from django.contrib import admin
from django.urls import path, include
from django.shortcuts import redirect

def home_redirect(request):
    return redirect('home')  # Redirecionar para home, não login

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', home_redirect),
    path('', include('accounts.urls')),
]