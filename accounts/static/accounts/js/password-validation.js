document.addEventListener('DOMContentLoaded', function() {
    const passwordInput = document.getElementById('password-input');
    const confirmPasswordInput = document.getElementById('confirm-password-input');
    const passwordStrengthBar = document.getElementById('password-strength-bar');
    const passwordChecklist = document.getElementById('password-checklist');
    const submitBtn = document.querySelector('.login-btn');
    const toggleButtons = document.querySelectorAll('.password-toggle');

    if (!passwordInput) return;

    // Toggle de visibilidade de senha
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input) {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                
                // Muda a cor do ícone
                this.style.color = isPassword ? 'var(--accent)' : 'var(--text-muted)';
            }
        });
    });

    passwordInput.addEventListener('input', function() {
        validarSenha(this.value);
    });

    confirmPasswordInput?.addEventListener('input', function() {
        validarConfirmacao();
    });

    async function validarSenha(password) {
        if (!password) {
            passwordStrengthBar.style.display = 'none';
            passwordChecklist.style.display = 'none';
            submitBtn.disabled = true;
            return;
        }

        try {
            const response = await fetch('/validar-senha/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({ password: password })
            });

            const data = await response.json();
            atualizarUI(data);
        } catch (error) {
            console.error('Erro ao validar senha:', error);
        }
    }

    function atualizarUI(data) {
        const { forca, score, requisitos, valida } = data;

        // Atualizar barra de força
        const barraInternal = passwordStrengthBar.querySelector('.password-strength-bar-internal');
        let cor, largura;

        if (forca === 'fraca') {
            cor = '#ff3b30';
            largura = 33;
        } else if (forca === 'moderada') {
            cor = '#ff9500';
            largura = 66;
        } else {
            cor = '#34c759';
            largura = 100;
        }

        barraInternal.style.width = largura + '%';
        barraInternal.style.backgroundColor = cor;

        // Atualizar checklist
        const items = passwordChecklist.querySelectorAll('.password-requirement-item');
        items.forEach((item, index) => {
            const keys = ['comprimento', 'maiuscula', 'minuscula', 'numero', 'especial'];
            const key = keys[index];
            const requisito = requisitos[key];

            if (requisito) {
                item.classList.add('atendido');
                item.classList.remove('nao-atendido');
            } else {
                item.classList.remove('atendido');
                item.classList.add('nao-atendido');
            }
        });

        // Habilitar/desabilitar botão e validar confirmação
        submitBtn.disabled = !valida || passwordInput.value !== (confirmPasswordInput?.value || '');

        // Mostrar/esconder UI
        passwordStrengthBar.style.display = 'block';
        passwordChecklist.style.display = 'block';
    }

    function validarConfirmacao() {
        if (!confirmPasswordInput?.value || !passwordInput.value) {
            submitBtn.disabled = true;
            return;
        }

        const senhasIguais = passwordInput.value === confirmPasswordInput.value;
        submitBtn.disabled = !senhasIguais;
    }

    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});
