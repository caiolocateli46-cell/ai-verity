/**
 * AI VERITY — script.js
 * Interface completa com histórico, trending, compartilhar e toast
 */

document.addEventListener('DOMContentLoaded', () => {

    // ── Refs DOM ──────────────────────────────────────────────
    const chat          = document.getElementById('chat');
    const welcome       = document.getElementById('welcome');
    const msgInput      = document.getElementById('msgInput');
    const sendBtn       = document.getElementById('sendBtn');
    const attachBtn     = document.getElementById('attachBtn');
    const fileInput     = document.getElementById('fileInput');
    const previewDiv    = document.getElementById('preview');
    const previewImg    = document.getElementById('previewImg');
    const previewName   = document.getElementById('previewName');
    const removePreview = document.getElementById('removePreview');
    const menuBtn       = document.getElementById('menuBtn');
    const newChatBtn    = document.getElementById('newChatBtn');
    const sidebar       = document.getElementById('sidebar');
    const overlay       = document.getElementById('overlay');
    const modal         = document.getElementById('modal');
    const modalBody     = document.getElementById('modal-body');
    const modalClose    = document.getElementById('modalClose');
    const toast         = document.getElementById('toast');
    const statTotal     = document.getElementById('statTotal');
    const statTrue      = document.getElementById('statTrue');
    const statFalse     = document.getElementById('statFalse');
    const historyList   = document.getElementById('historyList');
    const trendingList  = document.getElementById('trendingList');
    const dailyRemaining = document.getElementById('dailyRemaining');

    // ── Estado ────────────────────────────────────────────────
    let currentImage = null;
    let sending      = false;

    // ── Histórico local (sessionStorage) ─────────────────────
    let history = [];
    try { history = JSON.parse(sessionStorage.getItem('verity_history') || '[]'); } catch {}
    renderHistory();
    updateStats();

    // ── Trending ──────────────────────────────────────────────
    loadTrending();

    // ── Conteúdo dos modais ───────────────────────────────────
    const MODALS = {
        ia: `<h3>Como funciona</h3>
             <p>O <strong>AI VERITY</strong> usa a API <strong>Groq (Llama 3)</strong> com 5 agentes especialistas rodando em paralelo:</p>
             <br>
             <p>🔍 <strong>Verificador de Fatos</strong> — analisa a veracidade direta<br>
             🧭 <strong>Analista de Contexto</strong> — avalia o contexto histórico e social<br>
             📰 <strong>Verificador de Fontes</strong> — compara com fontes reconhecidas<br>
             ⚖️ <strong>Detector de Vieses</strong> — identifica manipulação política<br>
             🧠 <strong>Validador Lógico</strong> — verifica contradições internas</p>
             <br>
             <p>Cada agente tem um <strong>peso diferente</strong> na votação final. O resultado é calculado por soma ponderada de confiança.</p>`,

        faq: `<h3>Perguntas Frequentes</h3>
              <p><strong>Quantas consultas posso fazer?</strong><br>
              20 por IP por dia. O contador reseta à meia-noite.</p><br>
              <p><strong>As respostas são armazenadas?</strong><br>
              Sim, em cache local. Perguntas repetidas retornam instantaneamente.</p><br>
              <p><strong>Posso enviar imagens?</strong><br>
              Sim! Clique no 📎 para anexar prints de notícias (máx. 5MB).</p><br>
              <p><strong>A IA pode errar?</strong><br>
              Sim. O sistema indica o nível de confiança. Sempre verifique em fontes oficiais para decisões importantes.</p>`,

        creditos: `<h3>Créditos</h3>
                   <p><strong>Caio</strong> — IA e desenvolvimento back-end<br>
                   <strong>Laura</strong> — Design e estrutura front-end<br>
                   <strong>Camila</strong> — Ideias, pesquisa e soluções</p><br>
                   <p>Desenvolvido para o <strong>HACKANAV 2026</strong> — Combate à Desinformação Digital.</p><br>
                   <p>Stack: Node.js · Express · SQLite · Groq API · Llama 3</p>`
    };

    // ═══════════════════════════════════════════════════════
    // SIDEBAR
    // ═══════════════════════════════════════════════════════

    function openSidebar()  { sidebar.classList.add('open');  overlay.classList.add('show'); }
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('show'); }

    menuBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);

    newChatBtn?.addEventListener('click', () => {
        resetChat();
        closeSidebar();
    });

    // Nav items
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modalBody.innerHTML = MODALS[btn.dataset.tab] || '<p>Conteúdo indisponível.</p>';
            modal.style.display = 'flex';
            closeSidebar();
        });
    });

    // ═══════════════════════════════════════════════════════
    // MODAL
    // ═══════════════════════════════════════════════════════

    modalClose?.addEventListener('click', () => modal.style.display = 'none');
    modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && modal.style.display !== 'none') modal.style.display = 'none';
    });

    // ═══════════════════════════════════════════════════════
    // TOAST
    // ═══════════════════════════════════════════════════════

    let toastTimer;
    function showToast(msg, duration = 2500) {
        clearTimeout(toastTimer);
        toast.textContent = msg;
        toast.classList.add('show');
        toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    // ═══════════════════════════════════════════════════════
    // EXEMPLOS
    // ═══════════════════════════════════════════════════════

    document.querySelectorAll('.ex-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            msgInput.value = btn.dataset.text;
            msgInput.focus();
            autoResize();
        });
    });

    // ═══════════════════════════════════════════════════════
    // IMAGEM
    // ═══════════════════════════════════════════════════════

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('⚠️ Selecione apenas imagens (JPG, PNG, GIF, WEBP).');
            fileInput.value = '';
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            showToast('⚠️ Imagem muito grande. Máximo: 5 MB.');
            fileInput.value = '';
            return;
        }

        currentImage = file;
        previewName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = ev => {
            previewImg.src = ev.target.result;
            previewDiv.style.display = 'flex';
        };
        reader.readAsDataURL(file);
    });

    removePreview.addEventListener('click', clearPreview);

    function clearPreview() {
        previewDiv.style.display = 'none';
        previewImg.src = '';
        if (previewName) previewName.textContent = '';
        currentImage = null;
        fileInput.value = '';
    }

    // ═══════════════════════════════════════════════════════
    // HISTÓRICO LOCAL
    // ═══════════════════════════════════════════════════════

    function saveHistory(pergunta, decisao) {
        const item = {
            text: pergunta,
            decisao,
            ts: Date.now()
        };
        history.unshift(item);
        if (history.length > 50) history = history.slice(0, 50);
        try { sessionStorage.setItem('verity_history', JSON.stringify(history)); } catch {}
        renderHistory();
        updateStats();
    }

    function renderHistory() {
        if (!history.length) {
            historyList.innerHTML = '<p class="empty-msg">Nenhuma verificação ainda.</p>';
            return;
        }
        historyList.innerHTML = history.map(item => {
            const cls  = item.decisao === 'REAL' ? 'real' : 'falso';
            const time = formatTime(item.ts);
            return `<div class="history-item" data-text="${escHtml(item.text)}">
                <div class="history-dot ${cls}"></div>
                <span class="history-text">${escHtml(item.text)}</span>
                <span class="history-time">${time}</span>
            </div>`;
        }).join('');

        historyList.querySelectorAll('.history-item').forEach(el => {
            el.addEventListener('click', () => {
                msgInput.value = el.dataset.text;
                msgInput.focus();
                autoResize();
                closeSidebar();
            });
        });
    }

    function updateStats() {
        const total = history.length;
        const trues = history.filter(h => h.decisao === 'REAL').length;
        const falses = total - trues;
        statTotal.textContent = total;
        statTrue.textContent  = trues;
        statFalse.textContent = falses;
    }

    function formatTime(ts) {
        const d = new Date(ts);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
    }

    // ═══════════════════════════════════════════════════════
    // TRENDING (vem do servidor)
    // ═══════════════════════════════════════════════════════

    async function loadTrending() {
        try {
            const res  = await fetch('/trending');
            if (!res.ok) throw new Error();
            const data = await res.json();

            if (!data.length) {
                trendingList.innerHTML = '<p class="empty-msg">Ainda sem dados.</p>';
                return;
            }

            trendingList.innerHTML = data.map(item =>
                `<div class="trending-item" data-text="${escHtml(item.pergunta)}">
                    <span class="trending-text">${escHtml(item.pergunta)}</span>
                    <span class="trending-count">${item.total}×</span>
                </div>`
            ).join('');

            trendingList.querySelectorAll('.trending-item').forEach(el => {
                el.addEventListener('click', () => {
                    msgInput.value = el.dataset.text;
                    msgInput.focus();
                    autoResize();
                    closeSidebar();
                });
            });
        } catch {
            trendingList.innerHTML = '<p class="empty-msg">Indisponível.</p>';
        }
    }

    // ═══════════════════════════════════════════════════════
    // RENDERIZAÇÃO DE MENSAGENS
    // ═══════════════════════════════════════════════════════

    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function hideWelcome() {
        if (welcome?.parentNode === chat) welcome.remove();
    }

    function addUserMsg(text) {
        hideWelcome();
        const g = document.createElement('div');
        g.className = 'msg-group msg-user';
        g.innerHTML = `<div class="msg-inner"><div class="user-bubble"></div></div>`;
        g.querySelector('.user-bubble').textContent = text;
        chat.appendChild(g);
        scrollBottom();
    }

    function addLoadingMsg() {
        hideWelcome();
        const g = document.createElement('div');
        g.className = 'msg-group msg-bot';
        g.id = 'loadingMsg';
        g.innerHTML = `
            <div class="msg-inner">
                <div class="bot-ava">${botSvg()}</div>
                <div class="bot-body">
                    <div class="typing-row"><span></span><span></span><span></span></div>
                </div>
            </div>`;
        chat.appendChild(g);
        scrollBottom();
    }

    function removeLoading() { document.getElementById('loadingMsg')?.remove(); }

    function addBotResult(data, pergunta) {
        removeLoading();
        const isReal = data.decisao === 'REAL';
        const cls    = isReal ? 'real' : 'falso';
        const label  = isReal ? '✓ VERDADEIRO' : '✗ FALSO';
        const conf   = Math.round(data.confianca * 100);

        let agentsHtml = '';
        if (data.votos?.length) {
            agentsHtml = `<div class="agents-label">VOTAÇÃO DOS AGENTES</div>`;
            data.votos.forEach(v => {
                const vc  = v.decisao === 'REAL' ? 'real' : 'falso';
                const pct = Math.round(v.confianca * 100);
                agentsHtml += `
                <div class="agent-card">
                    <div class="agent-top">
                        <span class="agent-nm">${escHtml(v.agente)}</span>
                        <div class="agent-right">
                            <span class="agent-pct">${pct}%</span>
                            <span class="agent-badge ${vc}">${v.decisao}</span>
                        </div>
                    </div>
                    <div class="agent-just">${escHtml(v.justificativa)}</div>
                </div>`;
            });
        }

        const cacheHtml = data.fromCache
            ? `<div class="cache-label">⚡ resposta do cache</div>` : '';

        const g = document.createElement('div');
        g.className = 'msg-group msg-bot';
        g.innerHTML = `
            <div class="msg-inner">
                <div class="bot-ava">${botSvg()}</div>
                <div class="bot-body">
                    <div class="verdict-badge ${cls}">${label} — ${conf}% de confiança</div>
                    <div class="conf-bar"><div class="conf-fill ${cls}" style="width:0%"></div></div>
                    ${agentsHtml}
                    ${cacheHtml}
                    <div class="msg-actions">
                        <button class="action-btn share-btn" title="Copiar resultado">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1M8 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M8 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m0 0h2a2 2 0 0 1 2 2v3"
                                      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Copiar resultado
                        </button>
                        <button class="action-btn rever-btn" data-text="${escHtml(pergunta)}" title="Verificar novamente">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"
                                      stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                            Verificar novamente
                        </button>
                    </div>
                </div>
            </div>`;

        // Botão copiar
        g.querySelector('.share-btn').addEventListener('click', () => {
            const txt = `AI VERITY — Resultado\n\n"${pergunta}"\n\n${label} (${conf}% de confiança)\n\nVerifique em: ${location.href}`;
            navigator.clipboard.writeText(txt).then(() => showToast('✅ Copiado para a área de transferência!'));
        });

        // Botão verificar novamente
        g.querySelector('.rever-btn').addEventListener('click', (e) => {
            msgInput.value = e.currentTarget.dataset.text;
            msgInput.focus();
            autoResize();
        });

        chat.appendChild(g);

        // Anima a barra de confiança após render
        requestAnimationFrame(() => {
            const fill = g.querySelector('.conf-fill');
            if (fill) fill.style.width = conf + '%';
        });

        scrollBottom();
    }

    function addBotError(msg) {
        removeLoading();
        const g = document.createElement('div');
        g.className = 'msg-group msg-bot';
        g.innerHTML = `
            <div class="msg-inner">
                <div class="bot-ava" style="border-color:rgba(249,112,102,.3);color:#f97066;">${errorSvg()}</div>
                <div class="bot-body bot-err">${escHtml(msg)}</div>
            </div>`;
        chat.appendChild(g);
        scrollBottom();
    }

    function botSvg() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                  stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
    }

    function errorSvg() {
        return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`;
    }

    function scrollBottom() { chat.scrollTop = chat.scrollHeight; }

    function resetChat() {
        chat.innerHTML = '';
        chat.appendChild(welcome);
    }

    // ═══════════════════════════════════════════════════════
    // ENVIO
    // ═══════════════════════════════════════════════════════

    async function sendQuery() {
        if (sending) return;
        let text = msgInput.value.trim();

        if (!text && !currentImage) {
            addBotError('Digite uma afirmação ou selecione uma imagem.');
            return;
        }

        if (!text) text = 'Analise a imagem anexada.';

        const imageToSend = currentImage; // salva ANTES do clearPreview()

        sending = true;
        sendBtn.disabled = true;

        addUserMsg(text + (imageToSend ? ' 📎' : ''));
        msgInput.value = '';
        msgInput.style.height = 'auto';
        clearPreview();
        addLoadingMsg();

        try {
            let response;

            if (imageToSend) {
                const fd = new FormData();
                fd.append('pergunta', text);
                fd.append('imagem', imageToSend);
                response = await fetch('/verificar-com-imagem', { method: 'POST', body: fd });
            } else {
                response = await fetch('/verificar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pergunta: text })
                });
            }

            const data = await response.json();

            // Atualiza restantes
            if (data.remaining !== undefined) {
                dailyRemaining.textContent = `${data.remaining} restantes hoje`;
                dailyRemaining.className = 'remaining' + (data.remaining <= 5 ? ' low' : '');
            }

            if (response.status === 429) {
                addBotError(`⛔ ${data.erro}`);
                return;
            }

            if (!response.ok) throw new Error(data.erro || `Erro ${response.status}`);

            addBotResult(data, text);
            saveHistory(text, data.decisao);
            // Recarrega trending após nova verificação
            setTimeout(loadTrending, 500);

        } catch (err) {
            addBotError(err.message || 'Falha na comunicação com o servidor.');
        } finally {
            sending = false;
            sendBtn.disabled = false;
        }
    }

    // ═══════════════════════════════════════════════════════
    // EVENTOS
    // ═══════════════════════════════════════════════════════

    sendBtn.addEventListener('click', sendQuery);

    msgInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(); }
    });

    function autoResize() {
        msgInput.style.height = 'auto';
        msgInput.style.height = Math.min(msgInput.scrollHeight, 120) + 'px';
    }

    msgInput.addEventListener('input', autoResize);
});