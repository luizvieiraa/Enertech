# projeto-FDS

## Entrega 01 - (16/03):
### Documento com as historias e cenarios BDD :
[Link para Docs](https://docs.google.com/document/d/17qf1O3JAC6Jr1MacRRqNku-bDXHiBcaBE9ix0eBqRLQ/edit?tab=t.0)

### Sprint Board (JIRA):
[Link para o Sprint Board](https://github.com/user-attachments/assets/580f6635-26c8-45b5-a276-24950ce4ddd1)
 
### Backlog (JIRA):
[Link para o Jira](https://cesar-team-fitr7l7q.atlassian.net/jira/software/projects/SCRUM/boards/34)

[Link para o Backlog](https://cesar-team-fitr7l7q.atlassian.net/jira/software/projects/SCRUM/boards/34/backlog)

* **SCRUM 1** - [Link para o scrum 1](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-1)
* **SCRUM 2** - [Link para o scrum 2](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-2)
* **SCRUM 3** - [Link para o scrum 3](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-3)
* **SCRUM 4** - [Link para o scrum 4](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-4)
* **SCRUM 5** - [Link para o scrum 5](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-5)
* **SCRUM 6** - [Link para o scrum 6](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-6)
* **SCRUM 7** - [Link para o scrum 7](https://cesar-team-fitr7l7q.atlassian.net/browse/SCRUM-7)

## Link para screencast: 
[Link para o screencast](https://youtu.be/kJDK5AWO-w8?si=KTadK9UZGcNILxKG)

-------------------------------------------------------------------------------------------------------------------

## Entrega 02 - (30/03):

## 🎯 Objetivo da Sprint 2
Implementar pelo menos 3 histórias selecionadas do backlog, garantindo:
- Versionamento ativo com commits semanais
- Uso do issue tracker no GitHub
- Deploy em produção
- Documentação completa no README
- Screencast demonstrativo até **30/03**

## 📌 Quadro da Sprint 2

[Print do Quadro da Sprint 2](https://github.com/user-attachments/assets/aaeebf23-d22a-4ad3-bf8b-698ff1e69af9)

Histórias selecionadas:
- SCRUM-2: Filtro
- SCRUM-3: Detalhamento do eletroposto
- SCRUM-5: Reportar problema em eletroposto

## 📋 Backlog

[Print do Backlog](https://github.com/user-attachments/assets/fd777505-eebe-474a-85c0-ab5b3f594c79)

- SCRUM-4: Avaliação
- SCRUM-6: Cadastro de usuário
- SCRUM-7: Login inválido
- SCRUM-8: Ranking de eletropostos
 
## 🔗 Repositório e Versionamento
- [Link para o repositório GitHub](https://github.com/luizvieiraa/Enertech/tree/main)
- Commits semanais documentando progresso
- Issue tracker atualizado com bugs e melhorias

## 🚀 Deploy
- [Link para o sistema em produção](https://enertech-sq4i.onrender.com)

## 🎥 Screencast
[Link para o screencast](https://youtu.be/jMHKG2hMUsI?si=onBhtmm84sfaa9-f)

## Bug tracker

Status do Sistema: Estável (Fase de Autenticação Concluída)

1. Erro de Rota de Saída (NoReverseMatch)
Descrição: O sistema disparava um erro crítico ao tentar renderizar a página de login, alegando que a URL 'logout' não existia.

Causa Raiz: O template (provavelmente o base.html) continha uma tag {% url 'logout' %}, mas a rota correspondente não havia sido declarada no arquivo accounts/urls.py.

Resolução: Adição da rota path('logout/', auth_views.LogoutView.as_view(), name='logout') e configuração do LOGOUT_REDIRECT_URL no settings.py.

Severidade: Alta (Bloqueava o carregamento da página).

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
2. Falha de Submissão Silenciosa (Formulário Inerte)
Descrição: O usuário preenchia os dados de login, clicava em "Entrar", mas a página apenas recarregava sem processar a autenticação (nenhum POST registrado no log do servidor).

Causa Raiz: Conflito de estrutura no HTML. Tags de formulário no base.html (como o botão de Logout) estavam interferindo ou "sobrepondo" o formulário de Login dentro do bloco de conteúdo, impedindo o disparo do evento de submit.

Resolução: Reestruturação do base.html utilizando condicionais {% if user.is_authenticated %} para isolar componentes da Dashboard (Sidebar/Topbar) do conteúdo de autenticação.

Severidade: Crítica (Impedia o acesso ao sistema).

----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
3. Duplicidade de Blocos de Template (TemplateSyntaxError)
Descrição: Erro de sintaxe: block tag with name 'content' appears more than once.

Causa Raiz: Tentativa de declarar o mesmo {% block content %} duas vezes dentro do arquivo base.html (uma para o layout logado e outra para o layout deslogado). O motor de templates do Django não permite nomes de blocos duplicados no mesmo arquivo pai.

Resolução: Unificação do bloco content. A lógica de "Logado vs Deslogado" passou a ser controlada por if/else ao redor dos elementos de UI (Sidebar), mantendo apenas uma declaração de bloco de conteúdo.

Severidade: Alta (Impedia o servidor de renderizar qualquer página).

-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
4. Mudança de Protocolo de Logout (Django 5.0+)
Descrição: Erros potenciais ao tentar deslogar via link simples (GET).

Causa Raiz: Nas versões mais recentes do Django, o LogoutView exige o método POST por questões de segurança contra ataques CSRF.

Resolução: Substituição de links <a> por pequenos formulários <form method="post"> com botões de submit para a ação de logout na Topbar.

Severidade: Média (Segurança e Conformidade).

-------------------------------------------------------------------------------------------------------------------
5.Implementação de Agendamento de Recarga

Descrição:Foi implementada a funcionalidade de agendamento de recarga, permitindo ao usuário selecionar um eletroposto, escolher data e horário para realizar a recarga.

Causa Raiz: Ausência de validação para verificar conflitos de horário no backend.

Resolução: Implementação de validação no formulário/model para impedir agendamentos duplicados no mesmo intervalo de tempo.

Severidade: Alta (Comprometia a lógica de funcionamento do sistema).

-------------------------------------------------------------------------------------------------------------------
6.Implementação de Distância até Eletroposto

Descrição:Foi implementado o cálculo de distância entre o usuário e os eletropostos cadastrados no sistema.

Causa Raiz: Conversão incorreta das coordenadas geográficas (latitude/longitude).

Resolução: Ajuste da lógica de cálculo utilizando coordenadas padronizadas e função adequada de distância geográfica.

Severidade: Alta.

-------------------------------------------------------------------------------------------------------------------
## Entrega 03 - (27/04):

## Objetivo da Sprint 3

Implementar novas funcionalidades relacionadas à experiência do usuário e localização de eletropostos, garantindo:

* Versionamento ativo com commits semanais
* Uso contínuo do issue tracker no GitHub
* Atualização do deploy em produção
* README atualizado com as novas funcionalidades
* Screencast demonstrativo da Sprint 3

---

## 📌 Quadro da Sprint 3

**Sprint:** quadro Sprint 3 — 25 abr – 2 mai (2 tickets)

[Print do Quadro da Sprint 3](https://github.com/user-attachments/assets/715e3dfb-599a-4e07-964c-56be8d84473b)

### Histórias selecionadas:

* **SCRUM-9:** Agendamento de recarga
* **SCRUM-10:** Distância até eletroposto

---

## 📋 Backlog
[Print do Backlog](https://github.com/user-attachments/assets/4e17010a-29b5-4c3c-aa28-2627a5f63c81)

- SCRUM-9: Agendamento de recarga
- SCRUM-10: Distância até eletroposto

---

## 🔗 Repositório e Versionamento
- [Link para o repositório GitHub](https://github.com/luizvieiraa/Enertech/tree/main)
- Commits semanais documentando progresso
- Issue tracker atualizado com bugs e melhorias

---

## 🚀 Link do Deploy
[Link para o deploy](https://enertech-sq4i.onrender.com)

---

## 🎥 Screencast
[Link para o screencast](https://youtu.be/F9EFx8x7fEQ?si=dq450Kz7wLFkS81B)

[Link para o screencast do e2e](https://youtu.be/dGR5i2hcrdk?si=4ygCGreKUCRIj_9J)


## Relatório em par:
Optamos por nao realizar os relatórios, pois foram considerados uma melhoria futura, prevista para uma etapa posterior após estabilização das funcionalidades centrais do sistema.

 
## Entrega 04 - (18/05):

## 🎯 Objetivo da Sprint 4

Finalizar as histórias que faltam do backlog do projeto e implementar a automação dos processos de testes e deploy, garantindo:
* Implementação das histórias restantes 
* Criação e gerenciamento da Sprint 4 no JIRA
* Ambiente de versionamento atuante 
* Configuração de CI/CD com build, testes e deploy automatizados no GitHub
* Testes de sistema (E2E) automatizados 
* Documentação clara no arquivo README e criação do CONTRIBUTING.md

## 📌 Quadro da Sprint 4
* **Sprint 4:** Finalização do Backlog

[Print do Quadro da Sprint 4](https://github.com/user-attachments/assets/e110c9f2-36b9-4235-bb26-d09f2f75e214) 

### Histórias finais adicionadas:
* SCRUM-7: Login inválido
* SCRUM-8: Ranking de eletropostos

## 📋 Backlog Finalizado

[Print do Backlog](https://github.com/user-attachments/assets/dcf491c4-161d-485b-951a-061b7b1fa12f)

## 🔗 Repositório, Versionamento e Issue Tracker
* continuamos com commits semanais na branch principal, destacando as evoluções
* Eventuais falhas e tarefas pontuais do projeto foram centralizadas diretamente na aba de **Issues do GitHub**, mantendo o tracker atualizado para a entrega.

[Print 1 Bug Tracker](https://github.com/user-attachments/assets/9c6cf5e5-9340-42f2-ba2c-fa2bcde2dc46)
[Print 2 Bug Tracker](https://github.com/user-attachments/assets/a282334a-f3b2-4c49-8d8f-9b4c16a616fc)

## Testes de Sistema Automatizados E2E
* 🎥 **Screencast da execução dos testes** 
[Link para o screencast do e2e](https://youtu.be/dGR5i2hcrdk?si=4ygCGreKUCRIj_9J)

---

## 🚀 Esteira de CI/CD (Integração e Deploy Contínuo)

# 🚀 CI/CD e Testes Automatizados

Este projeto utiliza uma pipeline de **CI/CD (Continuous Integration / Continuous Delivery)** para garantir qualidade, estabilidade e automação no processo de desenvolvimento e deploy.

---

# 🔄 Fluxo da Pipeline

Sempre que ocorre um:

- `push`
- `pull request`
- merge na branch principal

a pipeline é executada automaticamente.

```text
Desenvolvedor faz push
        ↓
Pipeline inicia automaticamente
        ↓
Instala dependências
        ↓
Executa lint
        ↓
Executa testes
        ↓
Realiza build
        ↓
Deploy automático
```

---

# ✅ Etapas Executadas

## 1. Instalação de Dependências

O ambiente é configurado automaticamente e todas as dependências do projeto são instaladas.

### Exemplo

```bash
npm install
```

ou

```bash
pip install -r requirements.txt
```

---

## 2. Lint e Qualidade de Código

Ferramentas de análise estática são executadas para manter padronização e qualidade do código.

### Ferramentas utilizadas

- ESLint
- Prettier
- Flake8
- SonarQube

### Objetivos

- evitar erros comuns
- manter padrão de escrita
- identificar problemas de segurança
- reduzir código duplicado

---

## 3. Testes Automatizados

Os testes garantem que as funcionalidades continuem funcionando corretamente após novas alterações.

### 🧪 Testes Unitários

Validam funções e componentes isoladamente.

```bash
npm test
```

ou

```bash
pytest
```

---

### 🔗 Testes de Integração

Garantem que diferentes partes do sistema funcionem corretamente juntas.

### Exemplos

- API + banco de dados
- autenticação
- serviços externos

---

## 4. Build da Aplicação

Após os testes, o sistema realiza o build da aplicação para validar que tudo pode ser compilado corretamente.

```bash
npm run build
```

---

## 5. Deploy Automático

Se todas as etapas forem aprovadas, o deploy pode ser realizado automaticamente para:

- desenvolvimento
- homologação
- produção

---

# 🛠 Tecnologias Utilizadas

- GitHub Actions
- Docker
- Jest
- Pytest
- Vercel
- AWS
- Railway

---

# 🎯 Benefícios do CI/CD

- Redução de bugs em produção
- Feedback rápido sobre falhas
- Melhor qualidade de código
- Automatização do deploy
- Maior segurança nas entregas
- Integração contínua entre equipes

---

# 📌 Objetivo

Garantir que toda alteração enviada ao repositório passe por validações automáticas antes de ser integrada ou publicada em produção.

* 🎥 **Screencast do processo de CI/CD (Build, Testes e Deploy):** [https://youtu.be/jUmGOmFH7u0?si=1Rri_9Vg4s_tBlx0]

---

## 🚀 Link do Deploy Atualizado
- https://enertech-sq4i.onrender.com/

---

## Programação em Par exeperimentada: Relato Final 
- Continuamos dividindo as tarefas individualmente para encaixar no horário de todo mundo e render mais. Porém, nesta reta final, o acompanhamento foi diário. O grupo se apoiou muito, revisando códigos e resolvendo juntos os problemas com os testes automatizados e o CI/CD. Conseguimos manter o foco individual, mas com o time todo alinhado no sistema completo.

----

## 📄 Instruções para Configuração do Ambiente Local
As orientações para preparar a infraestrutura e configurar o ambiente local da aplicação estão detalhadas no arquivo de documentação complementar na raiz do projeto:

* 🔗 [CONTRIBUTING.md](./CONTRIBUTING.md)
