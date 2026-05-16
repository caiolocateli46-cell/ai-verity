// Injeta variáveis do .env no window para uso no HTML puro
(window as any).__VITE_GROQ_KEY__ = import.meta.env.VITE_GROQ_API_KEY || '';
(window as any).__VITE_GROQ_MODEL__ = import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile';

// React root não utilizado — app roda em HTML/CSS/JS puro
export {};
