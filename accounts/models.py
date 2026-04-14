from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator

TIPOS_CARREGADOR_CHOICES = [
    ('tipo1',    'Tipo 1 (J1772)'),
    ('tipo2',    'Tipo 2 (Mennekes)'),
    ('ccs1',     'CCS Combo 1'),
    ('ccs2',     'CCS Combo 2'),
    ('chademo',  'CHAdeMO'),
    ('gbdc',     'GB/T DC'),
    ('tesla',    'Tesla (NACS)'),
    ('schuko',   'Schuko (doméstico)'),
]

STATUS_CHOICES = [
    ('livre',    'Livre'),
    ('ocupado',  'Ocupado'),
    ('inativo',  'Inativo / Manutenção'),
]


class Ponto(models.Model):
    nome             = models.CharField(max_length=100, default="Posto Sem Nome")
    latitude         = models.FloatField()
    longitude        = models.FloatField()
    consumo          = models.FloatField(default=0)
    preco_start      = models.FloatField(default=0)
    preco_kwh        = models.FloatField(default=0)
    preco_ociosidade = models.FloatField(default=0)
    # tipos_carregador mantido para compatibilidade com filtros
    tipos_carregador = models.CharField(max_length=200, default='', blank=True)
    # Horários de funcionamento
    horario_abertura = models.TimeField(default='08:00', help_text="Horário de abertura (HH:MM)")
    horario_fechamento = models.TimeField(default='20:00', help_text="Horário de fechamento (HH:MM)")
    criado_em        = models.DateTimeField(auto_now_add=True)

    # ── helpers ──
    def tipos_lista(self):
        return [t.strip() for t in self.tipos_carregador.split(',') if t.strip()]

    def media_avaliacoes(self):
        avals = self.avaliacoes.all()
        if not avals.exists():
            return None
        return round(sum(a.estrelas for a in avals) / avals.count(), 1)

    def total_avaliacoes(self):
        return self.avaliacoes.count()

    def vagas_livres(self):
        return self.conectores.filter(status='livre').count()

    def total_vagas(self):
        return self.conectores.exclude(status='inativo').count()

    def esta_aberto(self, datetime_obj=None):
        """
        Verifica se o posto está aberto em um determinado horário.
        Se datetime_obj não for fornecido, usa o horário atual.
        Retorna: (aberto: bool, mensagem: str)
        """
        from datetime import datetime
        
        if datetime_obj is None:
            datetime_obj = datetime.now()
        
        hora_atual = datetime_obj.time()
        
        # Comparar horários
        if self.horario_abertura <= hora_atual < self.horario_fechamento:
            return True, f"Aberto até {self.horario_fechamento.strftime('%H:%M')}"
        else:
            return False, f"Fechado. Funciona de {self.horario_abertura.strftime('%H:%M')} até {self.horario_fechamento.strftime('%H:%M')}"

    def esta_ocupado(self):
        """
        Verifica se há agendamentos em andamento neste ponto.
        Retorna: (ocupado: bool, quantidade: int, mensagem: str)
        """
        agendamentos_em_andamento = self.agendamentos.filter(status='em_andamento').count()
        if agendamentos_em_andamento > 0:
            msg = f"🔴 Ocupado" if agendamentos_em_andamento == 1 else f"🔴 Ocupado ({agendamentos_em_andamento})"
            return True, agendamentos_em_andamento, msg
        return False, 0, "🟢 Disponível"

    def __str__(self):
        return self.nome


class Conector(models.Model):
    """Representa um conector/vaga individual dentro de um Ponto."""
    ponto      = models.ForeignKey(Ponto, on_delete=models.CASCADE, related_name='conectores')
    tipo       = models.CharField(max_length=20, choices=TIPOS_CARREGADOR_CHOICES)
    status     = models.CharField(max_length=10, choices=STATUS_CHOICES, default='livre')
    potencia   = models.FloatField(default=0, help_text="Potência individual deste conector (kW)")
    criado_em  = models.DateTimeField(auto_now_add=True)
    atualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['tipo', 'id']

    def __str__(self):
        return f'{self.ponto.nome} — {self.get_tipo_display()} [{self.get_status_display()}]'


class Avaliacao(models.Model):
    ponto      = models.ForeignKey(Ponto, on_delete=models.CASCADE, related_name='avaliacoes')
    usuario    = models.ForeignKey(User,  on_delete=models.CASCADE, related_name='avaliacoes')
    estrelas   = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comentario = models.TextField(blank=True, default='')
    criado_em  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('ponto', 'usuario')
        ordering = ['-criado_em']

    def __str__(self):
        return f'{self.usuario.username} → {self.ponto.nome} ({self.estrelas}★)'


class Agendamento(models.Model):
    """Agendamento de recarga de veículo elétrico em um ponto de carregamento."""
    
    STATUS_CHOICES = [
        ('pendente', 'Pendente'),
        ('confirmado', 'Confirmado'),
        ('em_andamento', 'Em Andamento'),
        ('concluido', 'Concluído'),
        ('cancelado', 'Cancelado'),
    ]
    
    usuario             = models.ForeignKey(User, on_delete=models.CASCADE, related_name='agendamentos')
    ponto               = models.ForeignKey(Ponto, on_delete=models.CASCADE, related_name='agendamentos')
    conector            = models.ForeignKey(Conector, on_delete=models.SET_NULL, null=True, blank=True)
    
    data_inicio         = models.DateTimeField(help_text="Data e hora do início da recarga agendada")
    tempo_estimado      = models.IntegerField(default=60, help_text="Tempo estimado em minutos")
    energia_solicitada  = models.FloatField(help_text="Energia solicitada em kWh")
    
    status              = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    valor_estimado      = models.FloatField(null=True, blank=True, help_text="Valor estimado em R$")
    
    criado_em           = models.DateTimeField(auto_now_add=True)
    atualizado_em       = models.DateTimeField(auto_now=True)
    
    class Meta:
        ordering = ['-data_inicio']
    
    def calcular_valor_estimado(self):
        """Calcula o valor estimado baseado na precificação do ponto."""
        if self.ponto:
            custo = self.ponto.preco_start
            custo += self.energia_solicitada * self.ponto.preco_kwh
            custo += (self.tempo_estimado / 60) * self.ponto.preco_ociosidade
            self.valor_estimado = round(custo, 2)
        return self.valor_estimado
    
    def __str__(self):
        return f'{self.usuario.username} → {self.ponto.nome} em {self.data_inicio.strftime("%d/%m %H:%M")}'