/**
 * Onboarding System
 * Guia interativo para novos usuários
 */

let currentOnboardingStep = 1;
const TOTAL_STEPS = 5;

/**
 * Inicializa o onboarding quando DOM está pronto
 */
// Fallback para window.apiUrls se não estiver definido
if (typeof window.apiUrls === 'undefined') {
    window.apiUrls = {
        atualizar_onboarding: "/atualizar-onboarding/",
        resetar_onboarding: "/resetar-onboarding/",
    };
    console.warn('⚠️ window.apiUrls não foi definido no template. Usando URLs padrão.');
} else {
    console.log('✅ window.apiUrls disponível:', window.apiUrls);
}

document.addEventListener('DOMContentLoaded', () => {
    initOnboarding();
});

/**
 * Inicializa sistema de onboarding
 */
function initOnboarding() {
    const modal = document.getElementById('onboardingModal');
    if (!modal) return;

    // Verificar se o onboarding já foi completado (from HTML data-attribute ou localStorage)
    const completed = modal.getAttribute('data-completed') === 'true' || 
                     localStorage.getItem('onboarding_completed') === 'true';
    
    console.log('🔍 Verificando onboarding:', { completed, dataAttr: modal.getAttribute('data-completed'), localStorage: localStorage.getItem('onboarding_completed') });
    
    // Só mostrar se não foi completado ainda
    if (!completed) {
        // Mostrar o modal
        modal.style.display = 'flex';

        // Mostrar o primeiro step
        showOnboardingStep(1);
        updateOnboardingUI();
    } else {
        console.log('✅ Onboarding já foi completado, ocultando modal');
        modal.style.display = 'none';
        modal.setAttribute('data-completed', 'true');
        localStorage.setItem('onboarding_completed', 'true');
    }
}

/**
 * Navega para o próximo step
 */
function nextOnboardingStep() {
    if (currentOnboardingStep < TOTAL_STEPS) {
        currentOnboardingStep++;
        showOnboardingStep(currentOnboardingStep);
        updateOnboardingUI();

        // Salvar no backend
        saveOnboardingProgress();
    } else {
        completeOnboarding();
    }
}

/**
 * Navega para o step anterior
 */
function prevOnboardingStep() {
    if (currentOnboardingStep > 1) {
        currentOnboardingStep--;
        showOnboardingStep(currentOnboardingStep);
        updateOnboardingUI();
    }
}

/**
 * Pula todo o onboarding
 */
function skipOnboarding() {
    if (confirm('Você tem certeza? Pode retomar depois no menu de configurações.')) {
        completeOnboarding();
    }
}

/**
 * Mostra um step específico
 */
function showOnboardingStep(stepNumber) {
    // Esconder todos os steps
    document.querySelectorAll('.onboarding-step').forEach(el => {
        el.classList.remove('active');
    });

    // Mostra o step ativo
    const activeStep = document.getElementById(`onboarding-step-${stepNumber}`);
    if (activeStep) {
        activeStep.classList.add('active');
    }

    // Atualiza indicadores de progresso
    document.querySelectorAll('.progress-step').forEach((el, idx) => {
        el.classList.remove('active');
        if (idx < stepNumber) {
            el.classList.add('active');
        }
    });

    // Atualiza barra de progresso
    const progress = (stepNumber / TOTAL_STEPS) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
}

/**
 * Atualiza UI dos botões
 */
function updateOnboardingUI() {
    const btnPrev = document.getElementById('btnPrev');
    const btnNext = document.getElementById('btnNext');
    const btnSkip = document.getElementById('btnSkip');

    // Mostrar botão anterior apenas após step 1
    if (currentOnboardingStep > 1) {
        btnPrev.style.display = 'block';
    } else {
        btnPrev.style.display = 'none';
    }

    // Mudar texto do botão final
    if (currentOnboardingStep === TOTAL_STEPS) {
        btnNext.textContent = 'Começar! 🚀';
    } else {
        btnNext.textContent = 'Próximo →';
    }

    // Esconder botão skip no último step
    if (currentOnboardingStep === TOTAL_STEPS) {
        btnSkip.style.opacity = '0.5';
        btnSkip.style.pointerEvents = 'none';
    } else {
        btnSkip.style.opacity = '1';
        btnSkip.style.pointerEvents = 'auto';
    }
}

/**
 * Salva progresso no backend
 */
function saveOnboardingProgress() {
    fetch(window.apiUrls.atualizar_onboarding, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken'),
        },
        body: JSON.stringify({
            step: currentOnboardingStep,
        }),
    })
    .then(res => res.json())
    .then(data => {
        console.log('✓ Progresso salvo:', data);
    })
    .catch(err => console.error('✗ Erro ao salvar:', err));
}

/**
 * Completa o onboarding
 */
function completeOnboarding() {
    const csrfToken = getCookie('csrftoken');
    console.log('🚀 Iniciando completeOnboarding. CSRF Token:', csrfToken ? 'OK' : 'MISSING');
    
    fetch(window.apiUrls.atualizar_onboarding, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify({
            step: TOTAL_STEPS,
        }),
    })
    .then(res => {
        console.log('📡 Status da resposta:', res.status);
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
    })
    .then(data => {
        console.log('✅ Resposta do servidor:', data);
        if (data.completado || data.status === 'sucesso') {
            console.log('🎉 Onboarding completado!');
            // Atualizar data-attribute do modal
            const modal = document.getElementById('onboardingModal');
            if (modal) {
                modal.setAttribute('data-completed', 'true');
            }
            // Salvar no localStorage também (backup)
            localStorage.setItem('onboarding_completed', 'true');
            // Mostrar animação de conclusão
            showOnboardingCompletion();
        } else {
            console.error('❌ Resposta não indicou sucesso:', data);
        }
    })
    .catch(err => {
        console.error('❌ Erro ao completar onboarding:', err);
        showToast('Erro ao completar onboarding. Tente novamente.');
    });
}

/**
 * Mostra animação de conclusão
 */
function showOnboardingCompletion() {
    const modal = document.getElementById('onboardingModal');
    const card = modal.querySelector('.onboarding-modal-card');

    // Animação de saída
    card.style.animation = 'slideOutUp 0.5s ease-out forwards';

    setTimeout(() => {
        modal.style.display = 'none';
        showCompletionToast();
        
        // Redirecionar para /home/ após 2 segundos (tempo suficiente para salvar sessão)
        setTimeout(() => {
            window.location.href = '/home/';
        }, 2000);
    }, 500);
}

/**
 * Mostra toast de conclusão
 */
function showCompletionToast() {
    const toast = document.createElement('div');
    toast.className = 'onboarding-toast';
    toast.innerHTML = '🎉 Onboarding Completo! Bem-vindo à Enertech!';
    document.body.appendChild(toast);

    // Animar entrada
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Remover após 3 segundos
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

/**
 * Obtém valor de um cookie (para CSRF token)
 */
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

/**
 * Abre modal de configurações
 */
function abrirConfiguracoes() {
    // Fecha a sidebar em mobile para melhor visualização
    const sb = document.getElementById('sidebar');
    if (sb && sb.classList.contains('sb--open')) {
        toggleSidebar();
    }
    document.getElementById('settingsModal').style.display = 'flex';
}

/**
 * Fecha modal de configurações
 */
function fecharConfiguracoes() {
    document.getElementById('settingsModal').style.display = 'none';
}

/**
 * Confirma retomar onboarding
 */
function confirmarRetomar() {
    if (confirm('Deseja retomar o tour de boas-vindas?')) {
        fetch(window.apiUrls.resetar_onboarding, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken'),
            },
        })
        .then(res => res.json())
        .then(data => {
            if (data.status === 'sucesso') {
                // Atualizar o data-attribute do modal
                const modal = document.getElementById('onboardingModal');
                modal.setAttribute('data-completed', 'false');
                
                // Limpar localStorage (reiniciar tour)
                localStorage.removeItem('onboarding_completed');
                
                // Reset variáveis
                currentOnboardingStep = 1;
                
                // Fechar sidebar se estiver aberta
                const sb = document.getElementById('sidebar');
                if (sb && sb.classList.contains('sb--open')) {
                    toggleSidebar();
                }
                
                // Mostrar o modal
                modal.style.display = 'flex';
                showOnboardingStep(1);
                updateOnboardingUI();
                
                showToast('✓ Tour reiniciado! Aproveite!', 'success');
            }
        })
        .catch(err => console.error('Erro:', err));
    }
}

/**
 * Mostra toast genérico
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}
