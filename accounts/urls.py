from django.urls import path
from accounts import views
from .views import (
    CustomLoginView, RegisterView, home, salvar_ponto, remover_ponto, 
    atualizar_disponibilidade, geocodificar_endereco, criar_agendamento,
    meus_agendamentos, cancelar_agendamento, admin_agendamentos,
    atualizar_status_agendamento, aceitar_agendamento, negar_agendamento,
    validar_senha_ajax
)
from django.contrib.auth.views import LogoutView

urlpatterns = [
    path('', CustomLoginView.as_view(), name='root'),  
    path('login/', CustomLoginView.as_view(), name='login'),
    path('register/', RegisterView.as_view(), name='register'),
    path('home/', home, name='home'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('salvar-ponto/', salvar_ponto, name='salvar_ponto'),
    path('geocodificar-endereco/', geocodificar_endereco, name='geocodificar_endereco'),
    
    # NOVA ROTA: O <int:id> captura o ID que o JavaScript envia na URL
    path('remover-ponto/<int:id>/', remover_ponto, name='remover_ponto'),
    path('avaliar-ponto/<int:id>/', views.avaliar_ponto,  name='avaliar_ponto'),
    path('avaliacoes/<int:id>/',    views.get_avaliacoes, name='get_avaliacoes'),
    path('status-pontos/',          views.status_pontos,  name='status_pontos'),
    path('atualizar-disponibilidade/<int:id>/', atualizar_disponibilidade, name='atualizar_disponibilidade'),
    
    # ═════════════════════════════════════════════════════════════════════
    # AGENDAMENTO DE RECARGA
    # ═════════════════════════════════════════════════════════════════════
    path('agendamentos/criar/', criar_agendamento, name='criar_agendamento'),
    path('agendamentos/meus/', meus_agendamentos, name='meus_agendamentos'),
    path('agendamentos/<int:id>/cancelar/', cancelar_agendamento, name='cancelar_agendamento'),
    path('agendamentos/admin/', admin_agendamentos, name='admin_agendamentos'),
    path('agendamentos/<int:id>/atualizar-status/', atualizar_status_agendamento, name='atualizar_status_agendamento'),
    path('agendamentos/<int:id>/aceitar/', aceitar_agendamento, name='aceitar_agendamento'),
    path('agendamentos/<int:id>/negar/', negar_agendamento, name='negar_agendamento'),
    path('agendamentos/processar-automaticos/', views.processar_agendamentos_view, name='processar_agendamentos'),
    path('validar-senha/', validar_senha_ajax, name='validar_senha'),
]