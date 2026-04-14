from django.contrib import messages
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.contrib.auth.views import LoginView
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse_lazy
from django.views import View

import json
import requests
import re
import logging
from datetime import datetime

from .models import Avaliacao, Conector, Ponto, Agendamento

# Configurar logger
logger = logging.getLogger(__name__)


def validar_forca_senha(password):
    """
    Valida a força da senha e retorna um dicionário com:
    - forca: 'fraca', 'moderada' ou 'forte'
    - score: número de requisitos atendidos
    - requisitos: dict com status de cada requisito
    """
    requisitos = {
        'comprimento': len(password) >= 8,
        'maiuscula': bool(re.search(r'[A-Z]', password)),
        'minuscula': bool(re.search(r'[a-z]', password)),
        'numero': bool(re.search(r'[0-9]', password)),
        'especial': bool(re.search(r'[!@#$%^&*(),.?":{}|<>]', password)),
    }
    
    score = sum(requisitos.values())
    
    if score < 3:
        forca = 'fraca'
    elif score < 5:
        forca = 'moderada'
    else:
        forca = 'forte'
    
    return {
        'forca': forca,
        'score': score,
        'requisitos': requisitos
    }


class CustomLoginView(LoginView):
    template_name = 'accounts/login.html'
    redirect_authenticated_user = True

    def get_success_url(self):
        return reverse_lazy('home')

    def form_invalid(self, form):
        messages.error(self.request, 'Usuário ou senha inválidos')
        return super().form_invalid(form)


@login_required
def home(request):
    pontos = Ponto.objects.prefetch_related('avaliacoes', 'conectores').all()
    return render(request, 'accounts/home.html', {'pontos': pontos})


class RegisterView(View):
    template_name = 'accounts/register.html'

    def get(self, request):
        return render(request, self.template_name)

    def post(self, request):
        username = request.POST.get('username')
        email = request.POST.get('email')
        password = request.POST.get('password')
        confirm_password = request.POST.get('confirm_password')

        if password != confirm_password:
            messages.error(request, 'As senhas não coincidem')
            return render(request, self.template_name)
        
        # Validar força da senha
        validacao = validar_forca_senha(password)
        if validacao['forca'] != 'forte':
            messages.error(request, 'A senha é muito fraca. Use maiúsculas, minúsculas, números e caracteres especiais.')
            return render(request, self.template_name)
        
        if User.objects.filter(username=username).exists():
            messages.error(request, 'Usuário já existe')
            return render(request, self.template_name)
        if User.objects.filter(email=email).exists():
            messages.error(request, 'Email já cadastrado')
            return render(request, self.template_name)

        User.objects.create_user(username=username, email=email, password=password)
        messages.success(request, 'Conta criada com sucesso!')
        return redirect('login')


def validar_senha_ajax(request):
    """Endpoint AJAX para validar força da senha em tempo real"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            password = data.get('password', '')
            
            validacao = validar_forca_senha(password)
            
            return JsonResponse({
                'forca': validacao['forca'],
                'score': validacao['score'],
                'requisitos': validacao['requisitos'],
                'valida': validacao['forca'] == 'forte'
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@staff_member_required
def salvar_ponto(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)

            novo_ponto = Ponto.objects.create(
                nome=data.get('nome', 'Posto Sem Nome'),
                latitude=data.get('lat'),
                longitude=data.get('lng'),
                consumo=data.get('consumo') or 0,
                preco_start=data.get('preco_start') or 0,
                preco_kwh=data.get('preco_kwh') or 0,
                preco_ociosidade=data.get('preco_ociosidade') or 0,
                horario_abertura=data.get('horario_abertura', '08:00'),
                horario_fechamento=data.get('horario_fechamento', '20:00'),
                tipos_carregador=','.join(data.get('tipos_carregador', [])),
            )

            for c in data.get('conectores', []):
                Conector.objects.create(
                    ponto=novo_ponto,
                    tipo=c.get('tipo'),
                    potencia=c.get('potencia') or 0,
                    status='livre',
                )

            return JsonResponse({
                'id': novo_ponto.id,
                'status': 'sucesso',
                'nome': novo_ponto.nome,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Método não permitido'}, status=405)


@login_required
def geocodificar_endereco(request):
    """Converte endereço em coordenadas usando Nominatim (OpenStreetMap)"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            endereco = data.get('endereco', '').strip()
            user = request.user.username
            
            if not endereco:
                return JsonResponse({'error': 'Endereço não fornecido'}, status=400)
            
            logger.info(f"[{user}] Iniciando geocodificação de: {endereco}")
            
            # Usar Nominatim (OpenStreetMap) para geocodificação
            url = 'https://nominatim.openstreetmap.org/search'
            params = {
                'q': endereco,
                'format': 'json',
                'limit': 1
            }
            headers = {
                'User-Agent': 'Enertech/1.0 (Django) Contact: admin@enertech.com'
            }
            
            # Aumentar timeout para produção e adicionar retry
            max_retries = 3
            timeout = 10
            response = None
            
            for attempt in range(max_retries):
                try:
                    logger.debug(f"[{user}] Tentativa {attempt + 1}/{max_retries} para geocodificar: {endereco}")
                    
                    response = requests.get(
                        url, 
                        params=params, 
                        headers=headers, 
                        timeout=timeout,
                        allow_redirects=True
                    )
                    response.raise_for_status()
                    logger.info(f"[{user}] Geocodificação bem-sucedida: {endereco}")
                    break
                except requests.exceptions.Timeout:
                    logger.warning(f"[{user}] Timeout na transferência (tentativa {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        logger.error(f"[{user}] Timeout em todas as tentativas")
                        return JsonResponse({
                            'error': 'Serviço de mapas demorou muito. Tente novamente.'
                        }, status=504)
                except requests.exceptions.ConnectionError:
                    logger.warning(f"[{user}] Erro de conexão (tentativa {attempt + 1}/{max_retries})")
                    if attempt < max_retries - 1:
                        continue
                    else:
                        logger.error(f"[{user}] Erro de conexão em todas as tentativas")
                        return JsonResponse({
                            'error': 'Erro de conexão com serviço de mapas. Verificar sua internet.'
                        }, status=503)
            
            if response is None:
                logger.error(f"[{user}] Response é None após todas as tentativas")
                return JsonResponse({
                    'error': 'Não foi possível conectar ao serviço de mapas'
                }, status=503)
            
            results = response.json()
            logger.info(f"[{user}] Resposta do Nominatim: {len(results)} resultado(s)")
            
            if not results:
                logger.info(f"[{user}] Endereço não encontrado: {endereco}")
                return JsonResponse({'error': 'Endereço não encontrado. Tente outro endereço.'}, status=404)
            
            first_result = results[0]
            lat = float(first_result.get('lat'))
            lng = float(first_result.get('lon'))
            display_name = first_result.get('display_name', endereco)
            
            logger.info(f"[{user}] Geocodificação completada: {display_name} ({lat}, {lng})")
            
            return JsonResponse({
                'lat': lat,
                'lng': lng,
                'endereco_completo': display_name,
                'status': 'sucesso'
            })
            
        except requests.exceptions.RequestException as e:
            logger.error(f"[{request.user.username}] Erro de requisição: {str(e)}")
            return JsonResponse({
                'error': f'Erro ao conectar com serviço de mapas: {str(e)}'
            }, status=500)
        except (ValueError, KeyError) as e:
            logger.error(f"[{request.user.username}] Erro ao processar resposta: {str(e)}")
            return JsonResponse({'error': f'Erro ao processar resposta: {str(e)}'}, status=400)
        except Exception as e:
            logger.error(f"[{request.user.username}] Erro desconhecido: {str(e)}", exc_info=True)
            return JsonResponse({'error': f'Erro desconhecido: {str(e)}'}, status=500)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@staff_member_required
def remover_ponto(request, id):
    if request.method == 'POST':
        try:
            ponto = get_object_or_404(Ponto, id=id)

            ponto.delete()
            return JsonResponse({'status': 'removido'})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Método não permitido'}, status=405)


@login_required
def status_pontos(request):
    pontos = Ponto.objects.prefetch_related('conectores', 'agendamentos').all()
    data = []
    for p in pontos:
        conectores = p.conectores.all()
        aberto, mensagem = p.esta_aberto()
        ocupado, qtd_agendamentos, status_ocupacao = p.esta_ocupado()
        data.append({
            'id': p.id,
            'vagas_livres': p.vagas_livres(),
            'total_vagas': p.total_vagas(),
            'aberto': aberto,
            'status_horario': mensagem,
            'horario_abertura': p.horario_abertura.strftime('%H:%M'),
            'horario_fechamento': p.horario_fechamento.strftime('%H:%M'),
            'ocupado': ocupado,
            'status_ocupacao': status_ocupacao,
            'conectores': [
                {
                    'id': c.id,
                    'tipo': c.tipo,
                    'potencia': c.potencia,
                    'status': c.status,
                }
                for c in conectores
            ],
        })
    return JsonResponse({'pontos': data})


@login_required
def avaliar_ponto(request, id):
    if request.method == 'POST':
        try:
            ponto = get_object_or_404(Ponto, id=id)
            data = json.loads(request.body)

            estrelas = int(data.get('estrelas', 0))
            comentario = data.get('comentario', '').strip()

            if not 1 <= estrelas <= 5:
                return JsonResponse({'error': 'Estrelas devem ser entre 1 e 5'}, status=400)

            avaliacao, criada = Avaliacao.objects.update_or_create(
                ponto=ponto,
                usuario=request.user,
                defaults={'estrelas': estrelas, 'comentario': comentario},
            )

            return JsonResponse({
                'status': 'criada' if criada else 'atualizada',
                'media': ponto.media_avaliacoes(),
                'total': ponto.total_avaliacoes(),
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Método não permitido'}, status=405)


@login_required
def get_avaliacoes(request, id):
    ponto = get_object_or_404(Ponto, id=id)
    avals = ponto.avaliacoes.select_related('usuario').all()
    minha = avals.filter(usuario=request.user).first()

    return JsonResponse({
        'media': ponto.media_avaliacoes(),
        'total': ponto.total_avaliacoes(),
        'minha_avaliacao': {
            'estrelas': minha.estrelas,
            'comentario': minha.comentario,
        } if minha else None,
        'avaliacoes': [
            {
                'usuario': a.usuario.username,
                'estrelas': a.estrelas,
                'comentario': a.comentario,
                'data': a.criado_em.strftime('%d/%m/%Y'),
            }
            for a in avals
        ],
    })


@staff_member_required
def atualizar_disponibilidade(request, id):
    if request.method == 'POST':
        try:
            ponto = get_object_or_404(Ponto, id=id)
            data = json.loads(request.body)
            conectores_data = data.get('conectores', [])

            for idx, c_data in enumerate(conectores_data):
                conector = ponto.conectores.all()[idx]
                conector.status = c_data.get('status', 'livre')
                conector.save()

            return JsonResponse({
                'success': True,
                'vagas_livres': ponto.vagas_livres(),
                'total_vagas': ponto.total_vagas(),
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)

    return JsonResponse({'error': 'Método não permitido'}, status=405)


# ═══════════════════════════════════════════════════════════════════════════
# AGENDAMENTO DE RECARGA
# ═══════════════════════════════════════════════════════════════════════════

@login_required
def criar_agendamento(request):
    """Cria um novo agendamento de recarga."""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            
            ponto_id = data.get('ponto_id')
            data_inicio_str = data.get('data_inicio')  # ISO format: "2026-04-15T14:30"
            tempo_estimado = int(data.get('tempo_estimado', 60))
            energia_solicitada = float(data.get('energia_solicitada', 10))
            
            ponto = get_object_or_404(Ponto, id=ponto_id)
            
            # Converter string ISO para datetime
            data_inicio = datetime.fromisoformat(data_inicio_str)
            
            # Validar se o horário está dentro do período de funcionamento do posto
            aberto, mensagem = ponto.esta_aberto(data_inicio)
            if not aberto:
                return JsonResponse({
                    'error': f'Horário fora do funcionamento do posto. {mensagem}'
                }, status=400)
            
            # Criar agendamento
            agendamento = Agendamento.objects.create(
                usuario=request.user,
                ponto=ponto,
                data_inicio=data_inicio,
                tempo_estimado=tempo_estimado,
                energia_solicitada=energia_solicitada,
                status='pendente'
            )
            
            # Calcular valor estimado
            agendamento.calcular_valor_estimado()
            agendamento.save()
            
            return JsonResponse({
                'status': 'sucesso',
                'agendamento_id': agendamento.id,
                'mensagem': 'Agendamento criado com sucesso!',
                'valor_estimado': agendamento.valor_estimado,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@login_required
def meus_agendamentos(request):
    """Lista os agendamentos do usuário logado."""
    agendamentos = Agendamento.objects.filter(usuario=request.user).select_related('ponto').order_by('-data_inicio')
    
    data = {
        'agendamentos': [
            {
                'id': a.id,
                'ponto_nome': a.ponto.nome,
                'ponto_id': a.ponto.id,
                'data_inicio': a.data_inicio.isoformat(),
                'tempo_estimado': a.tempo_estimado,
                'energia_solicitada': a.energia_solicitada,
                'valor_estimado': a.valor_estimado,
                'status': a.status,
                'criado_em': a.criado_em.strftime('%d/%m/%Y %H:%M'),
            }
            for a in agendamentos
        ]
    }
    
    return JsonResponse(data)


@login_required
def cancelar_agendamento(request, id):
    """Cancela um agendamento do usuário."""
    if request.method == 'POST':
        try:
            agendamento = get_object_or_404(Agendamento, id=id, usuario=request.user)
            
            # Só pode cancelar se ainda está pendente ou confirmado
            if agendamento.status not in ['pendente', 'confirmado']:
                return JsonResponse({
                    'error': f'Não é possível cancelar agendamento com status {agendamento.get_status_display()}'
                }, status=400)
            
            agendamento.status = 'cancelado'
            agendamento.save()
            
            return JsonResponse({
                'status': 'sucesso',
                'mensagem': 'Agendamento cancelado com sucesso'
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@staff_member_required
def admin_agendamentos(request):
    """View para admin gerenciar agendamentos de todos os usuários."""
    ponto_id = request.GET.get('ponto_id')
    
    if ponto_id:
        agendamentos = Agendamento.objects.filter(ponto_id=ponto_id).select_related('usuario', 'ponto').order_by('data_inicio')
        ponto = get_object_or_404(Ponto, id=ponto_id)
    else:
        agendamentos = Agendamento.objects.select_related('usuario', 'ponto').order_by('data_inicio')
        ponto = None
    
    # Se é AJAX, retorna JSON
    if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        data = {
            'agendamentos': [
                {
                    'id': a.id,
                    'usuario': a.usuario.username,
                    'ponto': a.ponto.nome,
                    'ponto_id': a.ponto.id,
                    'data_inicio': a.data_inicio.isoformat(),
                    'tempo_estimado': a.tempo_estimado,
                    'energia_solicitada': a.energia_solicitada,
                    'valor_estimado': a.valor_estimado,
                    'status': a.status,
                    'criado_em': a.criado_em.strftime('%d/%m/%Y %H:%M'),
                }
                for a in agendamentos
            ],
            'pontos': [
                {'id': p.id, 'nome': p.nome}
                for p in Ponto.objects.all().order_by('nome')
            ]
        }
        return JsonResponse(data)
    
    # Senão, renderiza template HTML
    pontos = Ponto.objects.all().order_by('nome')
    context = {
        'agendamentos': agendamentos,
        'pontos': pontos,
        'ponto_selecionado': ponto,
    }
    return render(request, 'accounts/admin_agendamentos.html', context)


@staff_member_required
def atualizar_status_agendamento(request, id):
    """Atualiza o status de um agendamento (confirmado, em_andamento, concluído, cancelado)."""
    if request.method == 'POST':
        try:
            agendamento = get_object_or_404(Agendamento, id=id)
            data = json.loads(request.body)
            novo_status = data.get('status')
            
            if novo_status not in dict(Agendamento.STATUS_CHOICES):
                return JsonResponse({'error': 'Status inválido'}, status=400)
            
            agendamento.status = novo_status
            agendamento.save()
            
            return JsonResponse({
                'status': 'sucesso',
                'mensagem': f'Agendamento atualizado para {agendamento.get_status_display()}',
                'novo_status': novo_status,
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@staff_member_required
def aceitar_agendamento(request, id):
    """Aceita um agendamento pendente (muda para confirmado)."""
    if request.method == 'POST':
        try:
            agendamento = get_object_or_404(Agendamento, id=id)
            
            if agendamento.status != 'pendente':
                return JsonResponse({
                    'error': f'Agendamento com status {agendamento.get_status_display()} não pode ser aceito'
                }, status=400)
            
            agendamento.status = 'confirmado'
            agendamento.save()
            
            return JsonResponse({
                'status': 'sucesso',
                'mensagem': 'Agendamento aceito com sucesso!',
                'novo_status': 'confirmado',
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


@staff_member_required
def negar_agendamento(request, id):
    """Nega um agendamento pendente (muda para cancelado)."""
    if request.method == 'POST':
        try:
            agendamento = get_object_or_404(Agendamento, id=id)
            
            if agendamento.status != 'pendente':
                return JsonResponse({
                    'error': f'Agendamento com status {agendamento.get_status_display()} não pode ser negado'
                }, status=400)
            
            agendamento.status = 'cancelado'
            agendamento.save()
            
            return JsonResponse({
                'status': 'sucesso',
                'mensagem': 'Agendamento negado.',
                'novo_status': 'cancelado',
            })
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)


def processar_agendamentos_automaticos():
    """
    Processa agendamentos confirmados e atualiza status automaticamente:
    - Muda para 'em_andamento' quando chegar a hora
    - Muda para 'concluido' após 1 hora
    
    Deve ser chamada periodicamente (via Celery, APScheduler, etc.)
    """
    from datetime import datetime, timedelta
    
    agora = datetime.now()
    
    # 1. Encontrar agendamentos confirmados com horário de início <= agora
    agendamentos_para_iniciar = Agendamento.objects.filter(
        status='confirmado',
        data_inicio__lte=agora
    )
    
    for agendamento in agendamentos_para_iniciar:
        agendamento.status = 'em_andamento'
        agendamento.save()
    
    # 2. Encontrar agendamentos em andamento há mais de 1 hora e marcar como concluído
    agendamentos_para_concluir = Agendamento.objects.filter(
        status='em_andamento',
        data_inicio__lte=agora - timedelta(hours=1)
    )
    
    for agendamento in agendamentos_para_concluir:
        agendamento.status = 'concluido'
        agendamento.save()
    
    return {
        'iniciados': agendamentos_para_iniciar.count(),
        'concluidos': agendamentos_para_concluir.count()
    }


@staff_member_required
def processar_agendamentos_view(request):
    """
    View que executa o processamento automático de agendamentos.
    Pode ser chamada via AJAX ou endpoint HTTP.
    """
    if request.method == 'POST' or request.headers.get('X-Requested-With') == 'XMLHttpRequest':
        resultado = processar_agendamentos_automaticos()
        return JsonResponse({
            'status': 'sucesso',
            'resultado': resultado,
            'mensagem': f"✓ {resultado['iniciados']} agendamento(s) iniciado(s), {resultado['concluidos']} concluído(s)"
        })
    
    return JsonResponse({'error': 'Método não permitido'}, status=405)
