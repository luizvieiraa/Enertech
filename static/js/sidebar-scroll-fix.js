// Prevenir scroll bubbling na sidebar direita
(function() {
    const detalhesConteudo = document.getElementById('detalhesConteudo');
    
    if (detalhesConteudo) {
        // Prevenir scroll do body quando mouse está na sidebar
        detalhesConteudo.addEventListener('wheel', function(e) {
            const element = this;
            const scrollTop = element.scrollTop;
            const scrollHeight = element.scrollHeight;
            const clientHeight = element.clientHeight;
            
            // Se está no topo e tenta rolar para cima, ou no final e tenta rolar para baixo
            if ((scrollTop === 0 && e.deltaY < 0) || (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0)) {
                // Deixa fazer scroll normal, mas previne que suba mais
                if (scrollTop === 0 && e.deltaY < 0) {
                    e.preventDefault();
                }
                if (scrollTop + clientHeight >= scrollHeight && e.deltaY > 0) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
        
        // Para touch devices
        let lastY = 0;
        detalhesConteudo.addEventListener('touchstart', function(e) {
            lastY = e.touches[0].clientY;
        }, { passive: true });
        
        detalhesConteudo.addEventListener('touchmove', function(e) {
            const element = this;
            const scrollTop = element.scrollTop;
            const scrollHeight = element.scrollHeight;
            const clientHeight = element.clientHeight;
            const currentY = e.touches[0].clientY;
            const diff = currentY - lastY;
            
            // Se está no topo e tenta rolar para cima, ou no final e tenta rolar para baixo
            if ((scrollTop === 0 && diff > 0) || (scrollTop + clientHeight >= scrollHeight && diff < 0)) {
                e.preventDefault();
            }
            lastY = currentY;
        }, { passive: false });
    }
})();
