# 🛡️ AI VERITY — Motor de Verificação de Fatos

> Plataforma de combate à desinformação digital com consenso multi-agente via Groq LPU™  
> Desenvolvida para o **Campeonato Nacional HackNav**

---

## ✨ Funcionalidades

- **Consenso Multi-Agente Real** — Chama múltiplos modelos de IA em paralelo e sintetiza um veredicto por consenso
- **8 Modelos de IA disponíveis** via Groq API (Llama 4, Qwen3, GPT OSS, Kimi K2, DeepSeek R1, Gemma 2...)
- **5 Idiomas** — Português, English, Español, Français, Deutsch
- **5 Humores de resposta** — Formal, Didático, Direto, Analítico, Socrático
- **Acessibilidade completa** — 13 funções (TTS, VLibras, fonte dislexia, guia de leitura, alto contraste...)
- **4 Temas visuais** — Escuro, Claro, Contraste Total, Sépia
- **Login / Cadastro** com persistência local
- **Splash screen** animada com grid, partículas e scanline
- **HTML/CSS/JS puro** — sem framework, ultra-rápido

---

## 🤖 Modelos de IA Integrados

| Modelo | Empresa | Especialidade |
|--------|---------|---------------|
| Llama 4 Scout 17B | Meta | Multimodal, contexto 128K |
| Llama 4 Maverick 17B | Meta | Contexto amplo, 128 experts |
| Llama 3.3 70B Versatile | Meta | Raciocínio geral ★ Recomendado |
| Qwen3 32B | Alibaba | Raciocínio científico avançado |
| GPT OSS 120B | OpenAI | Maior modelo open-source |
| Kimi K2 | Moonshot AI | Verificação cruzada de fatos |
| DeepSeek R1 Distill 70B | DeepSeek | Detecção de falácias lógicas |
| Gemma 2 9B | Google | Verificações rápidas |

---

## 🚀 Como Rodar Localmente

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/ai-verity.git
cd ai-verity
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o `.env`
```bash
cp .env.example .env
```
Abra o `.env` e insira sua chave do Groq:
```
VITE_GROQ_API_KEY=gsk_sua_chave_aqui
```
> Obtenha sua chave grátis em: https://console.groq.com

### 4. Rode o servidor de desenvolvimento
```bash
npm run dev
```

### 5. Build para produção
```bash
npm run build
```
O arquivo `dist/index.html` será gerado (single-file, pronto para deploy).

---

## 🔑 Configuração da API Key

A chave pode ser fornecida de duas formas:

1. **Via `.env`** (recomendado para desenvolvimento local)  
   ```
   VITE_GROQ_API_KEY=gsk_...
   ```

2. **Via Interface** — Nas Configurações → aba API, você pode inserir a chave manualmente. Ela fica salva apenas no `localStorage` do navegador.

> ⚠️ **NUNCA commite o arquivo `.env` com a chave real.** Ele já está no `.gitignore`.

---

## ♿ Acessibilidade

| Categoria | Funções |
|-----------|---------|
| Visão | Alto contraste, dessaturar cores, sublinhar links |
| Leitura | Tamanho de fonte (4×), fonte para dislexia, espaço entre linhas/letras, guia de leitura |
| Interação | Reduzir animações, cursor grande, leitura em voz alta (TTS), VLibras (Libras) |

Todas as configurações são salvas automaticamente no navegador.

---

## 🌐 Idiomas Suportados

🇧🇷 Português · 🇺🇸 English · 🇪🇸 Español · 🇫🇷 Français · 🇩🇪 Deutsch

---

## 🏗️ Stack Tecnológico

- **Frontend:** HTML5, CSS3, JavaScript (puro, sem framework)
- **Build:** Vite + vite-plugin-singlefile (gera um único `.html`)
- **IA:** Groq API (LPU™) — até 10× mais rápido que GPU
- **Acessibilidade:** VLibras (gov.br), Web Speech API
- **Persistência:** localStorage (sem banco de dados)

---

## 📁 Estrutura do Projeto

```
ai-verity/
├── index.html          # App completo (HTML/CSS/JS inline)
├── src/
│   ├── main.tsx        # Entry point Vite (injeta variáveis .env)
│   ├── App.tsx         # Componente React vazio (necessário pro build)
│   ├── index.css       # Tailwind import
│   └── vite-env.d.ts   # Tipos das variáveis de ambiente
├── .env                # Suas chaves (NÃO commitar!)
├── .env.example        # Template das variáveis
├── .gitignore
├── package.json
├── vite.config.ts
└── README.md
```

---

## 🏆 HackNav — Campeonato Nacional

AI VERITY foi desenvolvida por estudantes do 8º/9º ano para o campeonato **HackNav**, com tema **Desinformação Digital**.

O projeto ganhou na fase escolar e compete na fase nacional com prêmio de viagem para a **NASA (Texas)**.

---

## 📄 Licença

MIT — Livre para uso educacional.
