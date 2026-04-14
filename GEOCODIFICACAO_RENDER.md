# Solução para Geocodificação no Render

## Problema
A funcionalidade de adicionar novo posto pela localização funcionava no localhost mas não no Render.

## Causas Comuns
1. **Timeout curto** - Nominatim pode levar mais tempo em produção
2. **ALLOWED_HOSTS não configurado** - Rejeita requisições
3. **User-Agent inadequado** - Nominatim exige User-Agent válido
4. **SSL/TLS** - Modo HTTPS pode bloquear requisições
5. **Rate limiting** - Nominatim tem limites de requisições

## Soluções Implementadas

### 1. Backend (views.py)
- ✅ Aumentado timeout de 5s para 10s
- ✅ Adicionado retry automático (até 3 tentativas)
- ✅ Melhorado User-Agent com email de contato
- ✅ Melhorado tratamento de erros com mensagens claras
- ✅ Suporte a diferentes tipos de erro (timeout, conexão, etc)

### 2. Frontend (dashboard.js)
- ✅ Adicionado retry automático (até 2 tentativas)
- ✅ Mensagens de erro mais amigáveis
- ✅ Feedback visual durante retry
- ✅ Tratamento melhorado de diferentes status HTTP

### 3. Configurações Django (settings.py)
- ✅ ALLOWED_HOSTS dinâmico para Render
- ✅ CSRF_TRUSTED_ORIGINS configurado
- ✅ SSL/TLS configurado para HTTPS
- ✅ Segurança otimizada para produção

## Como Configurar no Render

### Passo 1: Defina as Variáveis de Ambiente
No dashboard do Render, vá para Environment e adicione:

```
SECRET_KEY=sua-chave-segura-aqui-minimo-32-caracteres
DEBUG=False
ALLOWED_HOSTS=seu-app-name.onrender.com
CSRF_TRUSTED_ORIGINS=https://seu-app-name.onrender.com
DATABASE_URL=postgresql://user:pass@host/db
```

### Passo 2: Deploy
```bash
git push origin main
```

### Passo 3: Teste a Geocodificação
1. Vá para a página de adicionar novo posto
2. Digite um endereço (ex: "São Paulo, Brasil")
3. Clique em "Buscar"
4. O sistema agora deve:
   - Tentar conectar ao Nominatim
   - Retry automaticamente se falhar
   - Mostrar mensagens de erro claras

## Teste Local (Simulando Produção)

```bash
DEBUG=False python manage.py runserver
```

## Logs Úteis para Debugging

Se ainda houver problemas, check:
1. Logs do Render: Dashboard → Logs
2. Network tab do navegador: F12 → Network
3. Status HTTP retornado

## Alternativa: Usar Google Maps

Se o Nominatim continuar com problemas, pode mudar para Google Maps API:

```python
# Adicionar para usar Google Maps em vez de Nominatim
GOOGLE_MAPS_API_KEY = os.getenv('GOOGLE_MAPS_API_KEY')
```

Mas Nominatim é free e não requer chaves!
