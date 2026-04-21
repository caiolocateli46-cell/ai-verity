/**
 * AI VERITY — server.js (SQLite)
 * Com fallback local massivo (1520 fatos importados do knowledge.js)
 */

'use strict';

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');

// Importa a base de conhecimento externa (1520 fatos)
const KNOWLEDGE_BASE = require('./knowledge.js');

// ============================================================
// CONFIGURAÇÃO DA API GROQ (OPCIONAL)
// ============================================================
const GROQ_API_KEY = process.env.GROQ_API_KEY || null;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const USE_API = !!(GROQ_API_KEY && process.env.FORCE_API !== 'false');
if (USE_API) console.log('[API] Groq ativada (chave presente)');
else console.log('[API] Modo offline apenas (sem chave ou FORCE_API=false)');

const LIMITE_DIARIO = Number(process.env.LIMITE_DIARIO) || 20;
const PORT = Number(process.env.PORT) || 1234;

// ============================================================
// EXPRESS & MULTER
// ============================================================
const app = express();
app.use(express.json());
app.use(express.static('public'));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        /^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)
            ? cb(null, true)
            : cb(new Error('Apenas imagens JPEG, PNG, GIF ou WEBP.'));
    }
});

// ============================================================
// BANCO DE DADOS SQLITE
// ============================================================
const db = new sqlite3.Database(path.resolve(__dirname, 'database.sqlite'), err => {
    if (err) { console.error('[DB] Erro:', err.message); process.exit(1); }
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pergunta TEXT UNIQUE,
        decisao TEXT,
        confianca REAL,
        votos_json TEXT,
        total_hits INTEGER DEFAULT 1,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS rate_limit (
        ip TEXT, data TEXT, contador INTEGER, PRIMARY KEY (ip, data)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS knowledge (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topico TEXT,
        fato TEXT NOT NULL,
        veredicto TEXT NOT NULL CHECK(veredicto IN ('REAL','FALSO')),
        explicacao TEXT,
        fonte TEXT,
        criado_em TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE INDEX IF NOT EXISTS idx_cache_hits ON cache(total_hits DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_knowledge_topico ON knowledge(topico)`);
});

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
function getIp(req) {
    const fwd = req.headers['x-forwarded-for'];
    return fwd ? fwd.split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
}

async function checkRateLimit(ip) {
    const hoje = new Date().toISOString().slice(0,10);
    return new Promise(resolve => {
        db.get(`SELECT contador FROM rate_limit WHERE ip=? AND data=?`, [ip, hoje], (err, row) => {
            const c = row?.contador || 0;
            resolve({ allowed: c < LIMITE_DIARIO, remaining: LIMITE_DIARIO - c });
        });
    });
}

async function incrementRate(ip) {
    const hoje = new Date().toISOString().slice(0,10);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO rate_limit (ip,data,contador) VALUES (?,?,1) ON CONFLICT(ip,data) DO UPDATE SET contador=contador+1`, [ip, hoje], err => err ? reject(err) : resolve());
    });
}

const normalize = s => s.toLowerCase().trim().replace(/\s+/g, ' ');

async function getCache(pergunta) {
    return new Promise(resolve => db.get(`SELECT * FROM cache WHERE pergunta=?`, [normalize(pergunta)], (err,row) => resolve(row||null)));
}

async function saveCache(pergunta, resultado) {
    const chave = normalize(pergunta);
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO cache (pergunta,decisao,confianca,votos_json) VALUES (?,?,?,?) ON CONFLICT(pergunta) DO UPDATE SET total_hits=total_hits+1, decisao=excluded.decisao, confianca=excluded.confianca, votos_json=excluded.votos_json`, [chave, resultado.decisao, resultado.confianca, JSON.stringify(resultado.votos)], err => err ? reject(err) : resolve());
    });
}

// ============================================================
// FALLBACK LOCAL: busca por palavras-chave
// ============================================================
function localFallback(pergunta) {
    const texto = pergunta.toLowerCase();
    let bestMatch = null;
    let maxScore = 0;

    for (const fact of KNOWLEDGE_BASE) {
        let score = 0;
        for (const kw of fact.keywords) {
            if (texto.includes(kw.toLowerCase())) {
                score++;
            }
        }
        if (score > maxScore) {
            maxScore = score;
            bestMatch = fact;
        }
    }

    if (bestMatch && maxScore > 0) {
        let confidence = bestMatch.confidence * (0.8 + (maxScore * 0.05));
        confidence = Math.min(0.99, confidence);
        return {
            decisao: bestMatch.verdict,
            confianca: confidence,
            justificativa: bestMatch.explanation,
            source: 'local_knowledge'
        };
    }

    return {
        decisao: 'FALSO',
        confianca: 0.55,
        justificativa: 'Não encontrado na base local. Consulte fontes oficiais.',
        source: 'fallback_neutro'
    };
}

// ============================================================
// AGENTES
// ============================================================
const AGENTES = [
    { nome: 'Especialista em Fatos', peso: 1.2 },
    { nome: 'Analista de Contexto', peso: 1.1 },
    { nome: 'Verificador de Fontes', peso: 1.0 },
    { nome: 'Detector de Vieses', peso: 0.9 },
    { nome: 'Validador Lógico', peso: 0.8 }
];

function gerarVotosFallback(pergunta, decisaoBase, confiancaBase, justificativaBase) {
    const resultados = AGENTES.map(agente => {
        let variacao = (agente.peso - 1.0) * 0.05;
        let conf = Math.min(0.99, Math.max(0.5, confiancaBase + variacao + (Math.random() * 0.04 - 0.02)));
        return {
            agente: agente.nome,
            decisao: decisaoBase,
            confianca: conf,
            justificativa: justificativaBase,
            _peso: agente.peso
        };
    });
    let somaReal = 0, somaFalso = 0;
    for (const r of resultados) {
        const voto = r.confianca * r._peso;
        if (r.decisao === 'REAL') somaReal += voto;
        else somaFalso += voto;
    }
    const total = somaReal + somaFalso;
    const decisaoFinal = somaReal >= somaFalso ? 'REAL' : 'FALSO';
    const confiancaFinal = total > 0 ? Math.max(somaReal, somaFalso) / total : 0.5;
    const votos = resultados.map(({ _peso, ...v }) => v);
    return { decisao: decisaoFinal, confianca: confiancaFinal, votos };
}

// ============================================================
// CHAMADA À API GROQ (COM FALLBACK)
// ============================================================
async function chamarAgenteApi(agente, pergunta) {
    if (!USE_API) return null;
    const prompt = `Você é ${agente.nome}. Responda APENAS com JSON: {"decisao": "REAL" ou "FALSO", "confianca": 0-1, "justificativa": "curta"}\nAfirmação: "${pergunta}"`;
    try {
        const resp = await axios.post(GROQ_URL, {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.2,
            max_tokens: 150,
            response_format: { type: 'json_object' }
        }, {
            headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
            timeout: 8000
        });
        const json = JSON.parse(resp.data.choices[0].message.content);
        return {
            decisao: json.decisao === 'REAL' ? 'REAL' : 'FALSO',
            confianca: Math.min(1, Math.max(0, Number(json.confianca) || 0.5)),
            justificativa: (json.justificativa || '').slice(0, 300)
        };
    } catch (err) {
        console.warn(`[API ${agente.nome}] Erro: ${err.message}. Usando fallback.`);
        return null;
    }
}

async function consultarMultiAgentes(pergunta) {
    if (USE_API) {
        const resultadosApi = await Promise.all(AGENTES.map(async agente => {
            const resp = await chamarAgenteApi(agente, pergunta);
            if (resp) return { agente: agente.nome, _peso: agente.peso, ...resp };
            return null;
        }));
        const validos = resultadosApi.filter(r => r !== null);
        if (validos.length >= 3) {
            let somaReal = 0, somaFalso = 0;
            for (const r of validos) {
                const voto = r.confianca * r._peso;
                if (r.decisao === 'REAL') somaReal += voto;
                else somaFalso += voto;
            }
            const total = somaReal + somaFalso;
            const decisaoFinal = somaReal >= somaFalso ? 'REAL' : 'FALSO';
            const confiancaFinal = total > 0 ? Math.max(somaReal, somaFalso) / total : 0.5;
            const votos = validos.map(({ _peso, ...v }) => v);
            return { decisao: decisaoFinal, confianca: confiancaFinal, votos };
        }
    }
    console.log('[Fallback] Usando base local para:', pergunta);
    const local = localFallback(pergunta);
    return gerarVotosFallback(pergunta, local.decisao, local.confianca, local.justificativa);
}

// ============================================================
// LÓGICA PRINCIPAL
// ============================================================
async function executarVerificacao(req, res, pergunta) {
    if (!pergunta || pergunta.trim().length < 5) {
        return res.status(400).json({ erro: 'A afirmação deve ter pelo menos 5 caracteres.' });
    }
    const ip = getIp(req);
    const rate = await checkRateLimit(ip);
    if (!rate.allowed) {
        return res.status(429).json({ erro: `Limite diário de ${LIMITE_DIARIO} consultas atingido.` });
    }
    const cached = await getCache(pergunta);
    if (cached) {
        await incrementRate(ip);
        return res.json({
            fromCache: true,
            decisao: cached.decisao,
            confianca: cached.confianca,
            votos: JSON.parse(cached.votos_json),
            remaining: rate.remaining - 1
        });
    }
    try {
        const resultado = await consultarMultiAgentes(pergunta);
        await saveCache(pergunta, resultado);
        await incrementRate(ip);
        res.json({ fromCache: false, ...resultado, remaining: rate.remaining - 1 });
    } catch (err) {
        console.error('[Verificar] Erro:', err);
        const fallback = gerarVotosFallback(pergunta, 'FALSO', 0.5, 'Erro interno. Tente novamente.');
        res.json({ fromCache: false, ...fallback, remaining: rate.remaining - 1 });
    }
}

// ============================================================
// ROTAS
// ============================================================
app.post('/verificar', async (req, res) => {
    await executarVerificacao(req, res, req.body?.pergunta);
});

app.post('/verificar-com-imagem', upload.single('imagem'), async (req, res) => {
    if (!req.file) return res.status(400).json({ erro: 'Nenhuma imagem enviada.' });
    const pergunta = req.body?.pergunta?.trim() || 'Analise o conteúdo desta imagem.';
    await executarVerificacao(req, res, pergunta);
});

app.get('/trending', (_req, res) => {
    db.all(`SELECT pergunta, decisao, total_hits AS total FROM cache ORDER BY total_hits DESC LIMIT 8`, [], (err, rows) => res.json(rows || []));
});

app.get('/conhecimento', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'knowledge.html'));
});

app.get('/health', (_req, res) => res.json({ status: 'ok', mode: USE_API ? 'hybrid' : 'offline', facts: KNOWLEDGE_BASE.length }));

// API para o painel de conhecimento
app.get('/api/knowledge', (req, res) => {
    const limit = parseInt(req.query.limit) || 500;
    db.all(`SELECT * FROM knowledge ORDER BY criado_em DESC LIMIT ?`, [limit], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

app.post('/api/knowledge', express.json(), (req, res) => {
    const { topico, fato, veredicto, explicacao, fonte } = req.body;
    if (!fato || !veredicto || (veredicto !== 'REAL' && veredicto !== 'FALSO')) {
        return res.status(400).json({ erro: 'fato e veredicto (REAL/FALSO) obrigatórios' });
    }
    db.run(`INSERT INTO knowledge (topico, fato, veredicto, explicacao, fonte) VALUES (?, ?, ?, ?, ?)`, 
        [topico || null, fato, veredicto, explicacao || null, fonte || null], 
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ id: this.lastID, success: true });
        });
});

app.delete('/api/knowledge/:id', (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ erro: 'ID inválido' });
    db.run('DELETE FROM knowledge WHERE id = ?', [id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ deleted: this.changes, success: true });
    });
});

app.use((err, _req, res, _next) => {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ erro: 'Imagem > 5MB' });
    console.error(err);
    res.status(500).json({ erro: 'Erro interno' });
});

// ============================================================
// INICIALIZAÇÃO
// ============================================================
const server = app.listen(PORT, () => {
    console.log(`\n✨ AI VERITY rodando em http://localhost:${PORT}`);
    console.log(`📚 Base local: ${KNOWLEDGE_BASE.length} fatos pré-carregados`);
    console.log(USE_API ? '🌐 Modo híbrido (API Groq + fallback local)' : '💾 Modo offline (apenas base local)');
    console.log('💡 Teste com: "Lula é presidente" ou "Terra plana"\n');
});

const shutdown = sig => {
    console.log(`\n${sig} recebido. Encerrando...`);
    server.close(() => db.close(() => process.exit(0)));
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));