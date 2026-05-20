# Guia para contribuir com a Enertech 🚗⚡

Muito obrigado por ajudar a desenvolver a **Enertech**! Para que todo mundo consiga trabalhar em harmonia, sem um apagar o código do outro e sem quebrar o site em produção, criamos esse guia rápido de como o nosso time deve trabalhar. 

Siga esses passos sempre que for atualizar o código:

---

## 📌 1. Onde pegar as tarefas?

* **Novas histórias:** Dê uma olhada no nosso [Painel do Jira](https://cesar-team-fitr7l7q.atlassian.net/jira/software/projects/SCRUM/boards/34). Quando escolher o que vai fazer, mude o status do card para *In Progress* para o resto do grupo saber que a tarefa está em andamento.
* **Correção de Bugs:** Erros menores ou ajustes ficam listados direto na aba de **Issues do GitHub** do nosso repositório.

### Regra das Branches (Git)
Para não bagunçar o código principal, nunca envie alterações direto na `main`. Crie sempre uma branch separada usando esses padrões:
* Se for criar algo novo: `git checkout -b feature/SCRUM-[Número do card]-[nome da tarefa]`
  
* Se for corrigir um bug: `git checkout -b bugfix/issue-[Número da issue]-[nome do bug]`

Sempre faça commits semanais para registrar o andar do projeto.

---

## 🛠️ 2. Como rodar o projeto no seu computador (Django)

Para abrir o site na sua máquina e testar suas alterações localmente, abra o terminal e siga esses comandos:

```bash
# 1. Baixe o repositório para o seu computador
git clone [https://github.com/luizvieiraa/Enertech.git](https://github.com/luizvieiraa/Enertech.git)
cd Enertech

# 2. Crie o ambiente virtual (venv) para isolar o Python
python -m venv venv

# 3. Ative o ambiente virtual
# Se estiver usando Windows:
.\venv\Scripts\activate
# Se estiver no Mac ou Linux:
source venv/bin/activate

# 4. Instale todas as dependências que o site precisa
pip install -r requirements.txt

# 5. Atualize o banco de dados local
python manage.py migrate

# 6. Ligue o servidor do site
python manage.py runserver
```

## Declaração final:
* Depois de seguir todas essas instruções corretamente, você estará apto a colaborar com o projeto!⚡


