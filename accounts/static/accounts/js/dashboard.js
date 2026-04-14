let map;
let markers = {};
let markerLocalizacaoUsuario = null;
let dadosPontos = [];
let usuarioLogadoEhAdmin = false;
let tiposFiltroAtivos = ['todos'];
let dispFiltroAtivo = 'todos';
let pontosAbertosDetalhes = null;
let localizacaoUsuario = null;

let pontoEditandoDisp = null;
let pontoAvaliacaoAtual = null;
let estrelasEscolhidas = 0;
let conectorFormCount = 0;

// Variáveis para agendamento
let pontoAgendamentoAtual = null;

const TIPOS_LABEL = {
    tipo1: 'Tipo 1 (J1772)',
    tipo2: 'Tipo 2 (Mennekes)',
    ccs1: 'CCS Combo 1',
    ccs2: 'CCS Combo 2',
    chademo: 'CHAdeMO',
    gbdc: 'GB/T DC',
    tesla: 'Tesla (NACS)',
    schuko: 'Schuko',
};

function initDashboard(pontosIniciais, ehAdmin) {
    usuarioLogadoEhAdmin = ehAdmin;

    // Inicializar Maplibre GL JS
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [-34.8770, -8.0476],
        zoom: 15,
        pitch: 0,
        bearing: 0
    });

    map.on('load', function() {
        pontosIniciais.forEach((p) => {
            const tipos = p.tipos_carregador
                ? p.tipos_carregador.split(',').map((t) => t.trim()).filter(Boolean)
                : [];
            p.vagas_livres = p.vagas_livres ?? ((p.conectores || []).filter((c) => c.status === 'livre').length || 0);
            p.total_vagas = p.total_vagas ?? ((p.conectores || []).length || 0);
            processarNovoPonto({ ...p, tipos });
        });

        atualizarStatsSidebar();
        iniciarStarPicker();
        iniciarPolling();
        
        // Obter localização do usuário
        obterLocalizacaoUsuario();
        
        // Adicionar suporte a wheel para o input de distância
        const distanciaInput = document.getElementById('inputDistancia');
        if (distanciaInput) {
            distanciaInput.addEventListener('wheel', function(e) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -1 : 1;
                const novoValor = Math.max(1, Math.min(100, parseInt(this.value) + delta));
                this.value = novoValor;
                atualizarDistanciaFiltro();
            });
        }
    });
}

function atualizarStatsSidebar() {
    const total = dadosPontos.length;
    const livres = dadosPontos.filter((p) => p.vagas_livres > 0).length;
    const ocupados = dadosPontos.filter((p) => p.vagas_livres === 0 && p.total_vagas > 0).length;
    const mw = dadosPontos.reduce((acc, p) => acc + (p.consumo || 0), 0) / 1000;

    const set = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    set('sbStatTotal', total);
    set('sbStatLivres', livres);
    set('sbStatOcupados', ocupados);
    set('sbStatMW', mw.toFixed(1));
}

function processarNovoPonto(p) {
    if (!p.vagas_livres && !p.total_vagas) {
        p.total_vagas = (p.conectores || []).length || 0;
        p.vagas_livres = (p.conectores || []).filter((c) => c.status === 'livre').length || 0;
    }

    const idx = dadosPontos.findIndex((x) => x.id === p.id);
    if (idx >= 0) {
        dadosPontos[idx] = { ...dadosPontos[idx], ...p };
    } else {
        dadosPontos.push(p);
    }

    if (markers[p.id]) {
        markers[p.id].remove();
        delete markers[p.id];
    }

    // Criar marcador com Maplibre GL (método nativo)
    const markerEl = document.createElement('div');
    markerEl.innerHTML = buildIconHtml(p);
    markerEl.style.cursor = 'pointer';
    markerEl.onclick = function(e) {
        e.stopPropagation();
        abrirSidebarDetalhes(p.id);
    };

    const marker = new maplibregl.Marker({ element: markerEl })
        .setLngLat([p.lng, p.lat])
        .addTo(map);

    // Armazenar com referência para o elemento (para atualizar depois)
    marker.__element = markerEl;
    marker.__pontoId = p.id;

    markers[p.id] = marker;

    atualizarProximos();
    atualizarStatsSidebar();
}

function buildIconHtml(p) {
    const livres = p.vagas_livres ?? 0;
    const total = p.total_vagas ?? 0;
    const cor = livres > 0 ? '#00e676' : '#ff3d5a';
    const emoji = livres > 0 ? '⚡' : '🔴';

    return `
        <div style="text-align:center;position:relative;">
            <div style="font-size:26px;filter:drop-shadow(0 0 6px ${cor});">${emoji}</div>
            <div style="background:${cor};color:#04080f;font-size:9px;font-weight:800;
                        border-radius:999px;padding:1px 5px;margin-top:-4px;
                        display:inline-block;white-space:nowrap;line-height:1.4;">
                ${livres}/${total}
            </div>
            ${p.media ? `<div style="font-size:9px;color:#f59e0b;margin-top:1px;">${p.media}★</div>` : ''}
        </div>`;
}

function buildPopupHtml(p) {
    const livres = p.vagas_livres ?? 0;
    const total = p.total_vagas ?? 0;
    const corStatus = livres > 0 ? '#00e676' : '#ff3d5a';
    const txtStatus = livres > 0
        ? `🟢 <strong>${livres} vaga${livres !== 1 ? 's' : ''} livre${livres !== 1 ? 's' : ''}</strong>`
        : '🔴 <strong>Todas as vagas ocupadas</strong>';

    // Verificar se está aberto
    const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + 
                      agora.getMinutes().toString().padStart(2, '0');
    const abremEm = p.horario_abertura || '08:00';
    const fechamEm = p.horario_fechamento || '20:00';
    
    const estaAberto = horaAtual >= abremEm && horaAtual < fechamEm;
    const corHorario = estaAberto ? '#00e676' : '#ff6b6b';
    const statusHorario = estaAberto 
        ? `🟢 Aberto até ${fechamEm}` 
        : `🔴 Fechado. Abre às ${abremEm}`;
    
    // Verificar se está ocupado
    const estaOcupado = p.ocupado || false;
    const statusOcupacao = estaOcupado ? p.status_ocupacao : '';
    
    // Botão de agendar desabilidado se fechado
    const btnAgendarHtml = estaAberto
        ? `<button onclick="abrirAgendamento(${p.id})"
                style="flex:1;min-width:80px;padding:8px;background:rgba(0,180,220,0.15);
                       border:1px solid rgba(0,180,220,0.35);border-radius:8px;
                       color:#0db8de;font-weight:700;font-size:11px;cursor:pointer;">
                📅 Agendar
            </button>`
        : `<button disabled
                style="flex:1;min-width:80px;padding:8px;background:rgba(100,100,100,0.1);
                       border:1px solid rgba(100,100,100,0.3);border-radius:8px;
                       color:#666;font-weight:700;font-size:11px;cursor:not-allowed;opacity:0.6;">
                📅 Fechado
            </button>`;

    const conectoresHtml = (p.conectores || []).map((c) => {
        const cor = c.status === 'livre' ? '#00e676' : c.status === 'ocupado' ? '#ff3d5a' : '#94a3b8';
        const dot = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${cor};margin-right:5px;"></span>`;
        return `<div style="font-size:11px;color:#94a3b8;margin:2px 0;">${dot}${TIPOS_LABEL[c.tipo] || c.tipo} · ${c.potencia} kW</div>`;
    }).join('');

    const mediaHtml = p.media
        ? `${'★'.repeat(Math.round(p.media))}${'☆'.repeat(5 - Math.round(p.media))} <span style="font-size:11px;color:#7a91b0;">${p.media} (${p.total_aval})</span>`
        : '<span style="color:#3d5470;font-size:11px;">Sem avaliações</span>';

    const gmUrl = `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving`;

    return `
        <div style="min-width:200px;font-family:'DM Sans',sans-serif;">
            <strong style="font-size:14px;color:#e8f4fd;">${p.nome}</strong>
            <div style="margin:8px 0 4px;font-size:12px;color:${corHorario};">${statusHorario}</div>
            ${estaOcupado ? `<div style="margin:4px 0;font-size:12px;color:#ff6b6b;">${statusOcupacao}</div>` : ''}
            <div style="margin:8px 0 4px;font-size:12px;color:${corStatus};">${txtStatus}</div>
            ${conectoresHtml ? `<div style="background:rgba(0,0,0,0.2);border-radius:8px;padding:8px;margin:6px 0;">${conectoresHtml}</div>` : ''}
            <hr style="border-color:rgba(0,230,118,0.15);margin:8px 0;">
            <div style="font-size:12px;color:#94a3b8;margin-bottom:4px;">
                💰 R$ ${p.preco_start.toFixed(2)} início &nbsp;·&nbsp;
                R$ ${p.preco_kwh.toFixed(2)}/kWh &nbsp;·&nbsp;
                R$ ${p.preco_ociosidade.toFixed(2)}/min
            </div>
            <div style="font-size:13px;color:#f59e0b;margin-bottom:10px;">${mediaHtml}</div>
            <div style="display:flex;gap:7px;flex-wrap:wrap;">
                ${btnAgendarHtml}
                <button onclick="abrirAvaliacao(${p.id})"
                    style="flex:1;min-width:70px;padding:8px;background:rgba(0,230,118,0.12);
                           border:1px solid rgba(0,230,118,0.3);border-radius:8px;
                           color:#00e676;font-weight:700;font-size:11px;cursor:pointer;">
                    ★ Avaliar
                </button>
                <a href="${gmUrl}" target="_blank" rel="noopener"
                    style="flex:1;min-width:60px;padding:8px;background:rgba(66,133,244,0.15);
                           border:1px solid rgba(66,133,244,0.35);border-radius:8px;
                           color:#6ba3f5;font-weight:700;font-size:11px;
                           text-decoration:none;text-align:center;display:flex;
                           align-items:center;justify-content:center;gap:4px;">
                    🗺️ Rota
                </a>
            </div>
        </div>`;
}


/* ╔═════════════════════════════════════════╗ */
/* ║ NOVAS FUNÇÕES - GEOLOCALIZAÇÃO E PRÓXIMOS ║ */
/* ╚═════════════════════════════════════════╝ */

function obterLocalizacaoUsuario() {
    if (!navigator.geolocation) {
        console.warn('Geolocalização não suportada neste navegador');
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            localizacaoUsuario = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            console.log('📍 Localização obtida:', localizacaoUsuario);
            adicionarMarkerLocalizacaoUsuario();
            atualizarProximos();
        },
        (error) => {
            console.warn('Erro ao obter localização:', error.message);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function buildUserLocationHtml() {
    return `
        <div style="text-align:center;position:relative;">
            <div style="
                width:20px;
                height:20px;
                background:rgba(0,180,220,0.15);
                border:2px solid #0db8de;
                border-radius:50%;
                display:flex;
                align-items:center;
                justify-content:center;
                box-shadow:0 0 0 0 #0db8de;
                animation:pulsoUsuario 2s infinite;
            ">
                <div style="
                    width:8px;
                    height:8px;
                    background:#0db8de;
                    border-radius:50%;
                "></div>
            </div>
        </div>`;
}

function adicionarMarkerLocalizacaoUsuario() {
    if (!localizacaoUsuario || !map) return;
    
    // Remover marcador anterior se existir
    if (markerLocalizacaoUsuario) {
        markerLocalizacaoUsuario.remove();
    }
    
    const markerEl = document.createElement('div');
    markerEl.innerHTML = buildUserLocationHtml();
    markerEl.style.cursor = 'default';
    
    markerLocalizacaoUsuario = new maplibregl.Marker({ element: markerEl })
        .setLngLat([localizacaoUsuario.lng, localizacaoUsuario.lat])
        .addTo(map);
    
    // Centralizar o mapa na localização do usuário com animação suave
    map.flyTo({
        center: [localizacaoUsuario.lng, localizacaoUsuario.lat],
        zoom: 16,
        duration: 1500,
        easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
    });
}


function calcularDistancia(lat1, lng1, lat2, lng2) {
    // Fórmula de Haversine para calcular distância entre dois pontos
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function atualizarProximos() {
    const box = document.getElementById('proximosBox');
    const lista = document.getElementById('proximosLista');
    
    if (!box || !lista) return;
    
    if (!localizacaoUsuario) {
        box.style.display = 'none';
        return;
    }

    // Obter a distância configurada no filtro
    const distanciaInput = document.getElementById('inputDistancia');
    const distanciaMaxima = distanciaInput ? parseInt(distanciaInput.value) : 10;

    // Filtrar eletropostos dentro da distância APLICANDO OS FILTROS DA SIDEBAR
    const filtrados = getPontosFiltrados();
    const proximos = filtrados
        .map((p) => ({
            ...p,
            distancia: calcularDistancia(
                localizacaoUsuario.lat, 
                localizacaoUsuario.lng, 
                p.lat, 
                p.lng
            )
        }))
        .filter((p) => p.distancia <= distanciaMaxima)
        .sort((a, b) => a.distancia - b.distancia);

    if (proximos.length === 0) {
        lista.innerHTML = `<div class="proximos-empty">Nenhum eletroposto a ${distanciaMaxima}km de você</div>`;
        box.style.display = 'flex';
        return;
    }

    lista.innerHTML = proximos
        .map((p) => {
            const livres = p.vagas_livres ?? 0;
            const status = livres > 0 ? '🟢' : '🔴';
            const distanceStr = p.distancia >= 1 
                ? `${p.distancia.toFixed(1)}km` 
                : `${Math.round(p.distancia * 1000)}m`;
            
            return `
                <div class="proximos-item" onclick="focarPonto(${p.lat}, ${p.lng}, ${p.id}); abrirSidebarDetalhes(${p.id});">
                    <div class="proximos-item-name">${p.nome}</div>
                    <div class="proximos-item-info">
                        <span>${status} ${livres} vaga${livres !== 1 ? 's' : ''}</span>
                        <span>📍 ${distanceStr}</span>
                    </div>
                </div>`;
        })
        .join('');

    box.style.display = 'flex';
}

function fecharProximos() {
    const box = document.getElementById('proximosBox');
    if (box) box.style.display = 'none';
}

function buildConectoresListHtml(conectores) {
    if (!conectores.length) return '';
    return `<div class="conectores-grid">
        ${conectores.map((c) => {
            const cor = c.status === 'livre' ? '#00e676' : c.status === 'ocupado' ? '#ff3d5a' : '#94a3b8';
            const label = c.status === 'livre' ? 'Livre' : c.status === 'ocupado' ? 'Ocupado' : 'Inativo';
            return `
                <div class="conector-row">
                    <span class="conector-dot" style="background:${cor};box-shadow:0 0 5px ${cor};"></span>
                    <span class="conector-tipo">${TIPOS_LABEL[c.tipo] || c.tipo}</span>
                    <span class="conector-kw">${c.potencia} kW</span>
                    <span class="conector-status" style="color:${cor};">${label}</span>
                </div>`;
        }).join('')}
    </div>`;
}

function iniciarPolling() {
    setInterval(atualizarStatus, 15000);
}

function atualizarStatus() {
    fetch('/status-pontos/')
        .then((r) => r.json())
        .then((data) => {
            data.pontos.forEach((s) => {
                const ponto = dadosPontos.find((p) => p.id === s.id);
                if (!ponto) return;

                ponto.vagas_livres = s.vagas_livres;
                ponto.total_vagas = s.total_vagas;
                ponto.conectores = s.conectores;

                if (markers[ponto.id]) {
                    markers[ponto.id].getElement().innerHTML = buildIconHtml(ponto);
                }

                const conEl = document.getElementById(`conectores-${ponto.id}`);
                if (conEl) conEl.innerHTML = buildConectoresListHtml(ponto.conectores);

                const itemEl = document.querySelector(`.item-ponto[data-id="${ponto.id}"] .status-badge`);
                if (itemEl) {
                    const livres = ponto.vagas_livres;
                    const total = ponto.total_vagas;
                    itemEl.style.color = livres > 0 ? 'var(--accent)' : 'var(--danger)';
                    itemEl.textContent = livres > 0
                        ? `🟢 ${livres} de ${total} vaga${total !== 1 ? 's' : ''} livre${livres !== 1 ? 's' : ''}`
                        : `🔴 Todas ocupadas (${total} vaga${total !== 1 ? 's' : ''})`;
                }
            });
            atualizarStatsSidebar();
        })
        .catch((err) => console.warn('Polling falhou:', err));
}

window.adicionarConectorForm = function () {
    conectorFormCount++;
    const idx = conectorFormCount;
    const div = document.createElement('div');
    div.className = 'conector-form-row';
    div.id = `conector-row-${idx}`;
    div.innerHTML = `
        <select class="form-control conector-tipo-sel" style="flex:2;">
            <option value="">Tipo de conector...</option>
            ${Object.entries(TIPOS_LABEL).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
        <input type="number" step="0.1" class="form-control conector-kw-inp" placeholder="kW" style="flex:1;">
        <button type="button" class="btn btn-small btn-danger"
                onclick="removerConectorForm(${idx})" style="flex-shrink:0;">✕</button>`;
    document.getElementById('listaConectoresForm').appendChild(div);
};

window.removerConectorForm = function (idx) {
    document.getElementById(`conector-row-${idx}`)?.remove();
};

function getConectoresDoForm() {
    return [...document.querySelectorAll('#listaConectoresForm .conector-form-row')]
        .map((row) => ({
            tipo: row.querySelector('.conector-tipo-sel').value,
            potencia: parseFloat(row.querySelector('.conector-kw-inp').value) || 0,
        }))
        .filter((c) => c.tipo);
}

function getPontosFiltrados() {
    const termo = (document.getElementById('inputBusca')?.value || '').toLowerCase();
    const maxKwh = parseFloat(document.getElementById('inputKwh')?.value ?? 5);
    const minKw = parseFloat(document.getElementById('inputKw')?.value ?? 0);
    const distanciaMaxima = parseFloat(document.getElementById('inputDistancia')?.value ?? 10);

    return dadosPontos.filter((p) => {
        const nomeBate = p.nome.toLowerCase().includes(termo);
        const kwhBate = p.preco_kwh <= maxKwh;
        const kwBate = p.consumo >= minKw;
        const tipoBate = tiposFiltroAtivos.includes('todos')
            || tiposFiltroAtivos.some((t) => (p.tipos || []).includes(t));
        const dispBate = dispFiltroAtivo === 'todos' ? true
            : dispFiltroAtivo === 'livres' ? p.vagas_livres > 0
                : dispFiltroAtivo === 'ocupado' ? (p.vagas_livres === 0 && p.total_vagas > 0)
                    : true;
        
        // Filtro de distância (apenas se usuário tem localização)
        let distanciaBate = true;
        if (localizacaoUsuario) {
            const distancia = calcularDistancia(
                localizacaoUsuario.lat, 
                localizacaoUsuario.lng, 
                p.lat, 
                p.lng
            );
            distanciaBate = distancia <= distanciaMaxima;
        }
        
        return nomeBate && kwhBate && kwBate && tipoBate && dispBate && distanciaBate;
    });
}

function aplicarFiltros() {
    const kwh = parseFloat(document.getElementById('inputKwh')?.value ?? 5);
    const kw = parseFloat(document.getElementById('inputKw')?.value ?? 0);
    const lKwh = document.getElementById('labelKwh');
    const lKw = document.getElementById('labelKw');
    if (lKwh) lKwh.textContent = `R$ ${kwh.toFixed(2).replace('.', ',')}`;
    if (lKw) lKw.textContent = `${kw} kW`;

    const filtradosIds = new Set(getPontosFiltrados().map((p) => p.id));
    dadosPontos.forEach((p) => {
        if (markers[p.id]) {
            if (filtradosIds.has(p.id)) {
                markers[p.id].getElement().style.display = 'block';
            } else {
                markers[p.id].getElement().style.display = 'none';
            }
        }
    });
    atualizarProximos();
}

function atualizarDistanciaFiltro() {
    const distancia = parseFloat(document.getElementById('inputDistancia')?.value ?? 10);
    const lDistancia = document.getElementById('labelDistancia');
    if (lDistancia) lDistancia.textContent = `${distancia} km`;
    
    // Atualizar visibilidade dos ícones no mapa
    const filtradosIds = new Set(getPontosFiltrados().map((p) => p.id));
    dadosPontos.forEach((p) => {
        if (markers[p.id]) {
            if (filtradosIds.has(p.id)) {
                markers[p.id].getElement().style.display = 'block';
            } else {
                markers[p.id].getElement().style.display = 'none';
            }
        }
    });
    
    atualizarProximos();
}

function resetarFiltros() {
    const b = document.getElementById('inputBusca');
    const k = document.getElementById('inputKwh');
    const w = document.getElementById('inputKw');
    const d = document.getElementById('inputDistancia');
    if (b) b.value = '';
    if (k) k.value = k.max;
    if (w) w.value = 0;
    if (d) d.value = 10;

    tiposFiltroAtivos = ['todos'];
    dispFiltroAtivo = 'todos';

    document.querySelectorAll('#chipsConector .sb-chip').forEach((c) =>
        c.classList.toggle('sb-chip--active', c.dataset.tipo === 'todos'));
    document.querySelectorAll('[data-disp]').forEach((c) =>
        c.classList.toggle('sb-chip--active', c.dataset.disp === 'todos'));

    aplicarFiltros();
    atualizarDistanciaFiltro();
}

function toggleChip(el) {
    const tipo = el.dataset.tipo;
    if (tipo === 'todos') {
        tiposFiltroAtivos = ['todos'];
        document.querySelectorAll('#chipsConector .sb-chip').forEach((c) =>
            c.classList.toggle('sb-chip--active', c.dataset.tipo === 'todos'));
    } else {
        tiposFiltroAtivos = tiposFiltroAtivos.filter((t) => t !== 'todos');
        document.querySelector('#chipsConector .sb-chip[data-tipo="todos"]')?.classList.remove('sb-chip--active');
        if (tiposFiltroAtivos.includes(tipo)) {
            tiposFiltroAtivos = tiposFiltroAtivos.filter((t) => t !== tipo);
            el.classList.remove('sb-chip--active');
        } else {
            tiposFiltroAtivos.push(tipo);
            el.classList.add('sb-chip--active');
        }
        if (tiposFiltroAtivos.length === 0) {
            tiposFiltroAtivos = ['todos'];
            document.querySelector('#chipsConector .sb-chip[data-tipo="todos"]')?.classList.add('sb-chip--active');
        }
    }
    aplicarFiltros();
}

window.toggleDisp = function (el) {
    document.querySelectorAll('[data-disp]').forEach((c) => c.classList.remove('sb-chip--active'));
    el.classList.add('sb-chip--active');
    dispFiltroAtivo = el.dataset.disp;
    aplicarFiltros();
};

window.abrirFormulario = function () {
    document.getElementById('formPonto').style.display = 'flex';
};

window.fecharFormulario = function () {
    const modal = document.getElementById('formPonto');
    if (!modal) return;
    modal.style.display = 'none';
    document.querySelectorAll('#formPonto input, #formPonto textarea').forEach((i) => {
        i.value = '';
    });
    document.getElementById('listaConectoresForm').innerHTML = '';
    conectorFormCount = 0;
};

function focarPonto(lat, lng, id) {
    map.flyTo({
        center: [lng, lat],
        zoom: 16,
        duration: 1000
    });
}

window.buscarEndereco = async function() {
    const endereco = document.getElementById('endereco_campo').value.trim();
    const resultadoEl = document.getElementById('endereco_resultado');
    
    if (!endereco) {
        resultadoEl.textContent = '⚠️ Digite um endereço';
        resultadoEl.style.color = '#f59e0b';
        return;
    }
    
    resultadoEl.textContent = '🔄 Buscando...';
    resultadoEl.style.color = '#94a3b8';
    
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch('/geocodificar-endereco/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCSRFToken()
                },
                body: JSON.stringify({ endereco }),
                timeout: 15000
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                const errorMsg = data.error || 'Erro ao buscar endereço';
                
                // Mensagens de erro mais amigáveis
                if (response.status === 404) {
                    resultadoEl.textContent = `❌ Endereço não encontrado. Tente ser mais específico.`;
                } else if (response.status === 503 || response.status === 504) {
                    if (attempt < maxRetries - 1) {
                        resultadoEl.textContent = '🔄 Serviço indisponível, tentando novamente...';
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        continue;
                    } else {
                        resultadoEl.textContent = `❌ Serviço de mapas indisponível. Tente mais tarde.`;
                    }
                } else {
                    resultadoEl.textContent = `❌ ${errorMsg}`;
                }
                resultadoEl.style.color = '#ff3d5a';
                return;
            }
            
            // Sucesso!
            document.getElementById('lat').value = data.lat.toFixed(6);
            document.getElementById('lng').value = data.lng.toFixed(6);
            
            resultadoEl.textContent = `✅ ${data.endereco_completo}`;
            resultadoEl.style.color = '#00e676';
            
            // Focar no mapa no endereço encontrado
            if (map) {
                map.flyTo({
                    center: [data.lng, data.lat],
                    zoom: 17,
                    duration: 1000
                });
            }
            
            return;
            
        } catch (error) {
            lastError = error;
            
            if (attempt < maxRetries - 1) {
                resultadoEl.textContent = '🔄 Tentando novamente...';
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                resultadoEl.textContent = `❌ Erro de conexão: ${error.message || 'Tente novamente'}`;
                resultadoEl.style.color = '#ff3d5a';
            }
        }
    }
}

window.salvarPonto = function () {
    const nome = document.getElementById('nome_posto').value.trim();
    const lat = document.getElementById('lat').value;
    const lng = document.getElementById('lng').value;
    const consumo = document.getElementById('consumo').value;
    const preco_start = document.getElementById('preco_start').value;
    const preco_kwh = document.getElementById('preco_kwh').value;
    const preco_ociosidade = document.getElementById('preco_ociosidade').value;
    const horario_abertura = document.getElementById('horario_abertura').value;
    const horario_fechamento = document.getElementById('horario_fechamento').value;
    const conectores = getConectoresDoForm();
    const tipos_carregador = [...new Set(conectores.map((c) => c.tipo))];

    if (!nome || !lat || !lng) {
        showToast('Preencha Nome, Latitude e Longitude!', 'danger');
        return;
    }

    showToast('Salvando posto...', 'info');

    fetch('/salvar-ponto/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify({ nome, lat, lng, consumo, preco_start, preco_kwh, preco_ociosidade, horario_abertura, horario_fechamento, tipos_carregador, conectores }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.id) {
                processarNovoPonto({
                    id: data.id,
                    lat: parseFloat(lat),
                    lng: parseFloat(lng),
                    consumo: parseFloat(consumo) || 0,
                    nome,
                    preco_start: parseFloat(preco_start) || 0,
                    preco_kwh: parseFloat(preco_kwh) || 0,
                    preco_ociosidade: parseFloat(preco_ociosidade) || 0,
                    horario_abertura,
                    horario_fechamento,
                    tipos: tipos_carregador,
                    media: null,
                    total_aval: 0,
                    vagas_livres: conectores.length,
                    total_vagas: conectores.length,
                    conectores: conectores.map((c, i) => ({ id: i, tipo: c.tipo, potencia: c.potencia, status: 'livre' })),
                });
                fecharFormulario();
                showToast(`Posto "${nome}" adicionado!`, 'success');
            } else {
                showToast(`Erro ao salvar: ${data.error || 'Erro desconhecido'}`, 'danger');
            }
        })
        .catch(() => showToast('Erro de conexão ao salvar.', 'danger'));
};

window.removerPonto = function (id) {
    const ponto = dadosPontos.find((p) => p.id === id);
    if (!confirm(`Remover "${ponto?.nome || 'este posto'}"?`)) return;

    fetch(`/remover-ponto/${id}/`, {
        method: 'POST',
        headers: { 'X-CSRFToken': getCSRFToken() },
    })
        .then((r) => {
            if (r.ok) {
                markers[id]?.remove();
                delete markers[id];
                dadosPontos = dadosPontos.filter((p) => p.id !== id);
                atualizarProximos();
                atualizarStatsSidebar();
                showToast('Posto removido.', 'success');
            } else {
                showToast('Erro ao remover posto.', 'danger');
            }
        })
        .catch(() => showToast('Erro de conexão.', 'danger'));
};

window.abrirAvaliacao = function (id) {
    pontoAvaliacaoAtual = id;
    estrelasEscolhidas = 0;
    atualizarStars(0);

    const ponto = dadosPontos.find((p) => p.id === id);
    document.getElementById('avalNomePosto').textContent = ponto?.nome || '—';
    document.getElementById('avalComentario').value = '';
    document.getElementById('avalLista').innerHTML = '<div class="aval-empty">Carregando...</div>';
    atualizarMediaHeader(ponto?.media, ponto?.total_aval);

    document.getElementById('modalAvaliacao').style.display = 'flex';

    fetch(`/avaliacoes/${id}/`)
        .then((r) => r.json())
        .then((data) => {
            atualizarMediaHeader(data.media, data.total);
            renderListaAvaliacoes(data.avaliacoes);
            if (data.minha_avaliacao) {
                estrelasEscolhidas = data.minha_avaliacao.estrelas;
                atualizarStars(estrelasEscolhidas);
                document.getElementById('avalComentario').value = data.minha_avaliacao.comentario;
            }
        })
        .catch(() => {
            document.getElementById('avalLista').innerHTML =
                '<div class="aval-empty">Erro ao carregar avaliações.</div>';
        });
};

window.fecharAvaliacao = function () {
    document.getElementById('modalAvaliacao').style.display = 'none';
    pontoAvaliacaoAtual = null;
};

window.enviarAvaliacao = function () {
    if (!estrelasEscolhidas) {
        showToast('Selecione pelo menos 1 estrela!', 'danger');
        return;
    }
    const comentario = document.getElementById('avalComentario').value.trim();

    fetch(`/avaliar-ponto/${pontoAvaliacaoAtual}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify({ estrelas: estrelasEscolhidas, comentario }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.error) {
                showToast(`Erro: ${data.error}`, 'danger');
                return;
            }
            const ponto = dadosPontos.find((p) => p.id === pontoAvaliacaoAtual);
            if (ponto) {
                ponto.media = data.media;
                ponto.total_aval = data.total;
            }
            atualizarMediaHeader(data.media, data.total);
            fetch(`/avaliacoes/${pontoAvaliacaoAtual}/`)
                .then((r) => r.json())
                .then((d) => renderListaAvaliacoes(d.avaliacoes));
            if (markers[pontoAvaliacaoAtual]) {
                markers[pontoAvaliacaoAtual].getElement().innerHTML = buildIconHtml(ponto);
            }
            atualizarProximos();
            showToast('Avaliação enviada!', 'success');
        })
        .catch(() => showToast('Erro ao enviar avaliação.', 'danger'));
};

function iniciarStarPicker() {
    document.querySelectorAll('#starPicker .star').forEach((star) => {
        star.addEventListener('mouseover', () => atualizarStars(parseInt(star.dataset.val, 10)));
        star.addEventListener('mouseout', () => atualizarStars(estrelasEscolhidas));
        star.addEventListener('click', () => {
            estrelasEscolhidas = parseInt(star.dataset.val, 10);
            atualizarStars(estrelasEscolhidas);
        });
    });
}

function atualizarStars(val) {
    document.querySelectorAll('#starPicker .star').forEach((s) =>
        s.classList.toggle('star--on', parseInt(s.dataset.val, 10) <= val));
}

function atualizarMediaHeader(media, total) {
    const sEl = document.getElementById('avalMediaStars');
    const nEl = document.getElementById('avalMediaNum');
    if (!sEl || !nEl) return;
    if (media) {
        sEl.textContent = '★'.repeat(Math.round(media)) + '☆'.repeat(5 - Math.round(media));
        nEl.textContent = `${media} de 5 · ${total} avaliação${total !== 1 ? 'ões' : ''}`;
    } else {
        sEl.textContent = '☆☆☆☆☆';
        nEl.textContent = 'Sem avaliações ainda';
    }
}

function renderListaAvaliacoes(avals) {
    const el = document.getElementById('avalLista');
    if (!avals?.length) {
        el.innerHTML = '<div class="aval-empty">Nenhuma avaliação ainda. Seja o primeiro!</div>';
        return;
    }
    el.innerHTML = avals.map((a) => `
        <div class="aval-item">
            <div class="aval-item-header">
                <span class="aval-usuario">👤 ${a.usuario}</span>
                <span class="aval-stars-sm">${'★'.repeat(a.estrelas)}${'☆'.repeat(5 - a.estrelas)}</span>
                <span class="aval-data">${a.data}</span>
            </div>
            ${a.comentario
                ? `<div class="aval-comentario">${a.comentario}</div>`
                : '<div class="aval-comentario" style="opacity:0.4;font-style:italic;">Sem comentário</div>'}
        </div>`).join('');
}

window.abrirEditarDisp = function (id) {
    pontoEditandoDisp = id;
    const ponto = dadosPontos.find((p) => p.id === id);
    if (!ponto) return;

    document.getElementById('modalDispTitle').textContent = `⚙️ Editar: ${ponto.nome}`;
    document.getElementById('modalDispSubtitle').textContent =
        `${ponto.vagas_livres} de ${ponto.total_vagas} vaga${ponto.total_vagas !== 1 ? 's' : ''} disponível${ponto.vagas_livres !== 1 ? 's' : ''}`;

    const listEl = document.getElementById('conectoresEditList');
    listEl.innerHTML = (ponto.conectores || []).map((c, idx) => `
        <div style="display:flex;align-items:center;gap:12px;padding:12px;
                    background:var(--bg-item);border-radius:8px;margin-bottom:8px;">
            <input type="checkbox" id="conector-${idx}" class="conector-checkbox"
                   ${c.status === 'livre' ? 'checked' : ''} data-idx="${idx}">
            <label for="conector-${idx}" style="flex:1;cursor:pointer;margin:0;">
                <div style="font-weight:600;color:var(--text-primary);">${TIPOS_LABEL[c.tipo] || c.tipo}</div>
                <div style="font-size:11px;color:var(--text-muted);">${c.potencia} kW</div>
            </label>
            <span style="font-size:12px;padding:4px 8px;border-radius:4px;
                ${c.status === 'livre'
                    ? 'background:rgba(0,230,118,0.15);color:var(--accent);'
                    : 'background:rgba(255,61,90,0.15);color:var(--danger);'}">
                ${c.status === 'livre' ? '🟢 Livre' : c.status === 'ocupado' ? '🔴 Ocupado' : '⚫ Inativo'}
            </span>
        </div>`).join('');

    document.getElementById('modalEditarDisp').style.display = 'flex';
};

window.fecharEditarDisp = function () {
    document.getElementById('modalEditarDisp').style.display = 'none';
    pontoEditandoDisp = null;
};

window.salvarDisponibilidade = function () {
    if (!pontoEditandoDisp) return;
    const ponto = dadosPontos.find((p) => p.id === pontoEditandoDisp);
    if (!ponto) return;

    const checkboxes = document.querySelectorAll('.conector-checkbox');
    const novasConectores = (ponto.conectores || []).map((c, idx) => ({
        ...c,
        status: checkboxes[idx]?.checked ? 'livre' : 'ocupado',
    }));

    showToast('Salvando disponibilidade...', 'info');

    fetch(`/atualizar-disponibilidade/${pontoEditandoDisp}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCSRFToken() },
        body: JSON.stringify({ conectores: novasConectores }),
    })
        .then((r) => r.json())
        .then((data) => {
            if (data.success) {
                ponto.conectores = novasConectores;
                ponto.vagas_livres = novasConectores.filter((c) => c.status === 'livre').length;
                ponto.total_vagas = novasConectores.length;

                if (markers[pontoEditandoDisp]) {
                    markers[pontoEditandoDisp].getElement().innerHTML = buildIconHtml(ponto);
                }

                atualizarProximos();
                atualizarStatsSidebar();
                fecharEditarDisp();
                showToast('Disponibilidade atualizada!', 'success');
            } else {
                showToast(`Erro: ${data.error || 'Erro ao atualizar'}`, 'danger');
            }
        })
        .catch(() => showToast('Erro de conexão.', 'danger'));
};

function getCSRFToken() {
    const v = `; ${document.cookie}`;
    const p = v.split('; csrftoken=');
    if (p.length === 2) return p.pop().split(';').shift();
    return '';
}


/* ========================================= */
/* SIDEBAR DETALHES (NOVA SIDEBAR DIREITA)   */
/* ========================================= */

function abrirSidebarDetalhes(pontoId) {
    pontosAbertosDetalhes = pontoId;
    const ponto = dadosPontos.find((p) => p.id === pontoId);
    if (!ponto) return;

    const sb = document.getElementById('sidebarDetalhes');
    const overlay = document.getElementById('sbOverlayDetalhes');
    if (!sb || !overlay) return;

    document.getElementById('detalhesNome').textContent = ponto.nome;
    
    // Verificar se está aberto
    const agora = new Date();
    const horaAtual = agora.getHours().toString().padStart(2, '0') + ':' + 
                      agora.getMinutes().toString().padStart(2, '0');
    const abremEm = ponto.horario_abertura || '08:00';
    const fechamEm = ponto.horario_fechamento || '20:00';
    
    const estaAberto = horaAtual >= abremEm && horaAtual < fechamEm;
    const corHorario = estaAberto ? '#00e676' : '#ff6b6b';
    const statusHorarioLabel = estaAberto 
        ? `🟢 Aberto até ${fechamEm}` 
        : `🔴 Fechado. Abre às ${abremEm}`;
    
    let conteudo = `
        <div class="detalhe-section">
            <div class="detalhe-label">Status Operacional</div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: ${estaAberto ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 107, 107, 0.1)'}; border-radius: 6px; border: 1px solid ${estaAberto ? 'rgba(0, 230, 118, 0.3)' : 'rgba(255, 107, 107, 0.3)'};">
                <span style="font-size: 16px;">${estaAberto ? '🟢' : '🔴'}</span>
                <div>
                    <div style="font-weight: 600; color: ${corHorario};">${estaAberto ? 'Aberto' : 'Fechado'}</div>
                    <div style="font-size: 12px; color: #94a3b8;">Funciona de ${abremEm} às ${fechamEm}</div>
                </div>
            </div>
        </div>

        <div class="detalhe-section">
            <div class="detalhe-label">Status de Disponibilidade</div>
            <div class="detalhe-status ${ponto.vagas_livres > 0 ? 'livre' : 'ocupado'}">
                ${ponto.vagas_livres > 0 ? '🟢' : '🔴'}
                ${ponto.vagas_livres > 0 
                    ? `${ponto.vagas_livres} de ${ponto.total_vagas} vaga${ponto.total_vagas !== 1 ? 's' : ''} livre${ponto.vagas_livres !== 1 ? 's' : ''}` 
                    : `Todas as ${ponto.total_vagas} vaga${ponto.total_vagas !== 1 ? 's' : ''} ocupadas`}
            </div>
        </div>

        ${ponto.ocupado ? `
        <div class="detalhe-section">
            <div class="detalhe-label">Status de Ocupação</div>
            <div style="display: flex; align-items: center; gap: 8px; padding: 8px; background: rgba(255, 107, 107, 0.1); border-radius: 6px; border: 1px solid rgba(255, 107, 107, 0.3);">
                <span style="font-size: 16px;">🔴</span>
                <div>
                    <div style="font-weight: 600; color: #ff6b6b;">Em Andamento</div>
                    <div style="font-size: 12px; color: #94a3b8;">${ponto.status_ocupacao}</div>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="detalhe-section">
            <div class="detalhe-label">Avaliação</div>
            <div style="display: flex; align-items: center; gap: 8px;">
                ${ponto.media 
                    ? `<span style="font-size: 18px; color: var(--warning);">${'★'.repeat(Math.round(ponto.media))}${'☆'.repeat(5 - Math.round(ponto.media))}</span>
                       <span style="color: var(--text-secondary); font-size: 13px;">${ponto.media} de 5 · ${ponto.total_aval} avaliação${ponto.total_aval !== 1 ? 'ões' : ''}</span>`
                    : `<span style="color: var(--text-muted); font-size: 13px;">Sem avaliações ainda</span>`}
            </div>
        </div>

        <div class="detalhe-section">
            <div class="detalhe-label">Localização</div>
            <div style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
                <div><strong>Latitude:</strong> ${ponto.lat.toFixed(6)}</div>
                <div><strong>Longitude:</strong> ${ponto.lng.toFixed(6)}</div>
            </div>
        </div>

        <div class="detalhe-section">
            <div class="detalhe-label">Potência</div>
            <div class="detalhe-value">${ponto.consumo} kW</div>
        </div>

        <div class="detalhe-section">
            <div class="detalhe-label">Preços</div>
            <div class="detalhe-preco">
                <div class="detalhe-preco-item">
                    <span class="detalhe-preco-label">Taxa de Início</span>
                    <span class="detalhe-preco-valor">R$ ${ponto.preco_start.toFixed(2)}</span>
                </div>
                <div class="detalhe-preco-item">
                    <span class="detalhe-preco-label">Por kWh</span>
                    <span class="detalhe-preco-valor">R$ ${ponto.preco_kwh.toFixed(2)}</span>
                </div>
                <div class="detalhe-preco-item">
                    <span class="detalhe-preco-label">Ociosidade /min</span>
                    <span class="detalhe-preco-valor">R$ ${ponto.preco_ociosidade.toFixed(2)}</span>
                </div>
            </div>
        </div>

        <div class="detalhe-section">
            <div class="detalhe-label">Conectores</div>
            <div class="detalhe-conectores">
                ${ponto.conectores && ponto.conectores.length > 0
                    ? ponto.conectores.map((c) => {
                        const cor = c.status === 'livre' ? '#00e676' : c.status === 'ocupado' ? '#ff3d5a' : '#94a3b8';
                        const statusLabel = c.status === 'livre' ? 'Livre' : c.status === 'ocupado' ? 'Ocupado' : 'Inativo';
                        const statusCor = c.status === 'livre' ? 'var(--accent)' : 'var(--danger)';
                        return `
                            <div class="detalhe-conector-item">
                                <div class="detalhe-conector-dot" style="background: ${cor}; box-shadow: 0 0 6px ${cor};"></div>
                                <div class="detalhe-conector-info">
                                    <div class="detalhe-conector-tipo">${TIPOS_LABEL[c.tipo] || c.tipo}</div>
                                    <div class="detalhe-conector-kw">${c.potencia} kW</div>
                                </div>
                                <div class="detalhe-conector-status" style="color: ${statusCor};">${statusLabel}</div>
                            </div>`;
                    }).join('')
                    : '<div style="color: var(--text-muted); font-size: 13px;">Nenhum conector registrado</div>'}
            </div>
        </div>

        <div class="detalhe-btn-group">
            <button class="detalhe-btn" onclick="focarPonto(${ponto.lat}, ${ponto.lng}, ${ponto.id})">
                📍 Focar no Mapa
            </button>
            ${estaAberto
                ? `<button class="detalhe-btn" onclick="abrirAgendamento(${ponto.id})">
                    📅 Agendar
                  </button>`
                : `<button class="detalhe-btn" disabled style="opacity: 0.6; cursor: not-allowed; background: rgba(100, 100, 100, 0.1);">
                    🔒 Fechado
                  </button>`
            }
            <button class="detalhe-btn" onclick="abrirAvaliacao(${ponto.id})">
                ⭐ Avaliar
            </button>
        </div>

        <div style="margin-top: 12px;">
            <a href="https://www.google.com/maps/dir/?api=1&destination=${ponto.lat},${ponto.lng}&travelmode=driving" target="_blank" rel="noopener" class="detalhe-btn" style="display: block; text-align: center; text-decoration: none;">
                🗺️ Abrir no Google Maps
            </a>
        </div>
    `;

    if (usuarioLogadoEhAdmin) {
        conteudo += `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
            <button class="detalhe-btn" onclick="abrirEditarDisp(${ponto.id})">
                ⚙️ Editar Vagas
            </button>
            <button class="detalhe-btn danger" onclick="removerPonto(${ponto.id})">
                🗑️ Deletar
            </button>
        </div>`;
    }

    document.getElementById('detalhesConteudo').innerHTML = conteudo;
    
    sb.classList.add('open');
    overlay.classList.add('open');
}

function fecharSidebarDetalhes() {
    const sb = document.getElementById('sidebarDetalhes');
    const overlay = document.getElementById('sbOverlayDetalhes');
    if (sb) sb.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
    pontosAbertosDetalhes = null;
}


/* ========================================= */
/* TOGGLE FILTROS                            */
/* ========================================= */

function toggleFilterPanel() {
    const content = document.getElementById('sbFiltersContent');
    const btn = document.querySelector('.sb-filter-toggle-btn');
    const btnText = document.getElementById('filterBtnText');
    
    if (!content || !btn) return;
    
    const isOpen = content.classList.contains('filters-open');
    
    if (isOpen) {
        content.classList.remove('filters-open');
        content.classList.add('filters-collapsed');
        btn.classList.remove('active');
        btnText.textContent = 'Abrir Filtros';
    } else {
        content.classList.add('filters-open');
        content.classList.remove('filters-collapsed');
        btn.classList.add('active');
        btnText.textContent = 'Fechar Filtros';
    }
}

/* ========================================= */
/* AGENDAMENTO DE RECARGA                    */
/* ========================================= */

window.abrirAgendamento = function(pontoId) {
    pontoAgendamentoAtual = pontoId;
    const ponto = dadosPontos.find((p) => p.id === pontoId);
    if (!ponto) return;

    document.getElementById('agendPostoInfo').innerHTML = `
        <div style="background: rgba(0, 230, 118, 0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(0, 230, 118, 0.3);">
            <div style="font-weight: 600; color: #e0f2fe;">${ponto.nome}</div>
            <div style="font-size: 12px; margin-top: 5px;">
                💰 R$ ${ponto.preco_start.toFixed(2)} início · R$ ${ponto.preco_kwh.toFixed(2)}/kWh
            </div>
            <div style="font-size: 12px; margin-top: 3px;">
                ⏰ Funciona de ${ponto.horario_abertura || '08:00'} às ${ponto.horario_fechamento || '20:00'}
            </div>
        </div>
    `;

    // Definir data/hora mínima como agora
    const agora = new Date();
    const dataMinima = new Date(agora.getTime() + 30 * 60000); // 30 minutos a partir de agora
    document.getElementById('agendData').min = dataMinima.toISOString().slice(0, 16);
    document.getElementById('agendData').value = dataMinima.toISOString().slice(0, 16);

    // Limpar aviso de horário
    document.getElementById('agendHorarioAviso').style.display = 'none';
    document.getElementById('agendHorarioStatus').textContent = '';
    document.getElementById('btnConfirmarAgendamento').disabled = false;

    // Recompute valor estimado ao abrir
    atualizarValorAgendamento();
    validarHorarioAgendamento();

    document.getElementById('modalAgendamento').style.display = 'flex';
};

window.fecharAgendamento = function() {
    document.getElementById('modalAgendamento').style.display = 'none';
    pontoAgendamentoAtual = null;
};

window.atualizarValorAgendamento = function() {
    const ponto = dadosPontos.find((p) => p.id === pontoAgendamentoAtual);
    if (!ponto) return;

    const tempo = parseFloat(document.getElementById('agendTempo').value) || 60;
    const energia = parseFloat(document.getElementById('agendEnergia').value) || 10;

    const valor = ponto.preco_start + (energia * ponto.preco_kwh) + ((tempo / 60) * ponto.preco_ociosidade);
    document.getElementById('agendValorEstimado').textContent = `R$ ${valor.toFixed(2)}`;
};

window.validarHorarioAgendamento = function() {
    if (!pontoAgendamentoAtual) return;
    
    const ponto = dadosPontos.find((p) => p.id === pontoAgendamentoAtual);
    if (!ponto) return;
    
    const dataStr = document.getElementById('agendData').value;
    if (!dataStr) return;
    
    const data = new Date(dataStr);
    const horas = data.getHours().toString().padStart(2, '0');
    const minutos = data.getMinutes().toString().padStart(2, '0');
    const horaAtual = `${horas}:${minutos}`;
    
    const abremEm = ponto.horario_abertura || '08:00';
    const fechamEm = ponto.horario_fechamento || '20:00';
    
    const estaAberto = horaAtual >= abremEm && horaAtual < fechamEm;
    
    const avisoEl = document.getElementById('agendHorarioAviso');
    const statusEl = document.getElementById('agendHorarioStatus');
    const btnConfirmar = document.getElementById('btnConfirmarAgendamento');
    
    if (!estaAberto) {
        avisoEl.style.display = 'block';
        document.getElementById('agendHorarioAvisoMsg').textContent = 
            `Este horário (${horaAtual}) está fora do período de funcionamento (${abremEm} às ${fechamEm}). O agendamento será recusado.`;
        statusEl.textContent = `❌ Horário fora de funcionamento`;
        statusEl.style.color = '#ff6b6b';
        btnConfirmar.disabled = true;
        btnConfirmar.style.opacity = '0.5';
        btnConfirmar.style.cursor = 'not-allowed';
    } else {
        avisoEl.style.display = 'none';
        statusEl.textContent = `✓ Horário válido`;
        statusEl.style.color = '#00e676';
        btnConfirmar.disabled = false;
        btnConfirmar.style.opacity = '1';
        btnConfirmar.style.cursor = 'pointer';
    }
};

window.confirmarAgendamento = function() {
    if (!pontoAgendamentoAtual) return;

    const ponto = dadosPontos.find((p) => p.id === pontoAgendamentoAtual);
    if (!ponto) return;

    const data = document.getElementById('agendData').value;
    const tempo = parseInt(document.getElementById('agendTempo').value) || 60;
    const energia = parseFloat(document.getElementById('agendEnergia').value) || 10;

    if (!data) {
        showToast('Selecione data e hora!', 'danger');
        return;
    }

    // Validar horário novamente antes de enviar
    const dataObj = new Date(data);
    const horas = dataObj.getHours().toString().padStart(2, '0');
    const minutos = dataObj.getMinutes().toString().padStart(2, '0');
    const horaAtual = `${horas}:${minutos}`;
    
    const abremEm = ponto.horario_abertura || '08:00';
    const fechamEm = ponto.horario_fechamento || '20:00';
    
    if (horaAtual < abremEm || horaAtual >= fechamEm) {
        showToast(`❌ Não é permitido agendar fora do horário de funcionamento (${abremEm} até ${fechamEm})`, 'danger');
        return;
    }

    showToast('Criando agendamento...', 'info');

    fetch('/agendamentos/criar/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCSRFToken()
        },
        body: JSON.stringify({
            ponto_id: pontoAgendamentoAtual,
            data_inicio: data,
            tempo_estimado: tempo,
            energia_solicitada: energia
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.status === 'sucesso') {
            showToast(`✅ Agendamento criado! Aguardando confirmação do administrador.`, 'success');
            fecharAgendamento();
        } else {
            showToast(`Erro: ${data.error || 'Erro desconhecido'}`, 'danger');
        }
    })
    .catch(err => {
        console.error('Erro:', err);
        showToast('Erro ao criar agendamento', 'danger');
    });
};

window.abrirMeusAgendamentos = function() {
    showToast('Carregando seus agendamentos...', 'info');

    fetch('/agendamentos/meus/')
        .then(r => r.json())
        .then(data => {
            const agendamentos = data.agendamentos;
            if (agendamentos.length === 0) {
                showToast('Você não tem agendamentos', 'info');
                return;
            }

            let html = '<div style="max-width: 600px; max-height: 80vh; overflow-y: auto;">';
            agendamentos.forEach(agend => {
                const data = new Date(agend.data_inicio).toLocaleString('pt-BR');
                const statusCor = agend.status === 'pendente' ? '#fbbf24'
                    : agend.status === 'confirmado' ? '#3b82f6'
                    : agend.status === 'em_andamento' ? '#f97316'
                    : agend.status === 'concluido' ? '#22c55e'
                    : '#ef4444';
                
                html += `
                    <div style="background: rgba(30, 30, 30, 0.8); padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid rgba(0, 230, 118, 0.2);">
                        <div style="font-weight: 600; color: #e0f2fe; margin-bottom: 5px;">${agend.ponto_nome}</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 3px;">📅 ${data}</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 3px;">⚡ ${agend.energia_solicitada} kWh · ⏱️ ${agend.tempo_estimado}min</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-bottom: 5px;">💰 R$ ${agend.valor_estimado || '0,00'}</div>
                        <div style="display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; color: ${statusCor}; background: ${statusCor}33;">
                            ${agend.status.charAt(0).toUpperCase() + agend.status.slice(1)}
                        </div>
                    </div>
                `;
            });
            html += '</div>';

            // Mostrar modal provisório com agendamentos
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.display = 'flex';
            modal.innerHTML = `
                <div class="card" style="max-width: 600px;">
                    <div class="card-title">📅 Meus Agendamentos</div>
                    ${html}
                    <button class="btn" onclick="this.closest('.modal-overlay').remove();" style="width: 100%; margin-top: 12px;">Fechar</button>
                </div>
            `;
            document.body.appendChild(modal);
        })
        .catch(err => {
            console.error('Erro:', err);
            showToast('Erro ao carregar agendamentos', 'danger');
        });
};
