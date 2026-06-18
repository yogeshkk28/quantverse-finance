import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { ChatMessage } from '../types';

const SYSTEM_PROMPT = `You are QuantBot, an expert quantitative finance analyst specializing in Indian and global markets. When analyzing a stock, always cover: 1) Fundamental Summary (P/E, revenue growth, ROE), 2) Technical Signals (RSI, MACD, EMA trend), 3) Risk Score (1-10), 4) Bullish/Bearish Outlook with reasoning, 5) Key levels to watch. Be concise but data-rich. Use ₹ for Indian stocks.`;

const QUICK_PROMPTS = ['Analyze Reliance Industries', 'Is Nifty overbought?', 'Best sectors right now?', 'Compare HDFC Bank vs ICICI Bank', 'Top 5 mid-cap stocks'];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const simulateResponse = async (query: string) => {
    await new Promise(r => setTimeout(r, 1500 + Math.random() * 1000));
    const q = query.toLowerCase();
    if (q.includes('reliance')) return `## Reliance Industries Analysis\n\n**Fundamental Summary**\n- P/E Ratio: 27.8 (above sector avg)\n- Revenue Growth: 14.2% YoY\n- ROE: 12.4% (improving)\n- Debt-to-Equity: 0.42\n\n**Technical Signals**\n- RSI(14): 55 — Neutral\n- MACD: Bullish crossover daily\n- EMA: Above EMA20, testing EMA50\n\n**Risk Score: 5/10**\n\n**Bullish Outlook**\nJio + Retail growth strong. Target: ₹3,050.\n\n**Key Levels**\n- Support: ₹2,850 | ₹2,780\n- Resistance: ₹3,025 | ₹3,150`;
    if (q.includes('nifty') || q.includes('overbought')) return `## Nifty 50 Assessment\n\n**Current**: 24,532 (+1.29%)\n\n**Signals**\n- RSI(14): 62 — Not overbought yet\n- MACD: Positive histogram\n- EMA: Above all major EMAs\n\n**NOT overbought** — RSI well below 70.\n\n**Risk: 4/10**\n\n**Levels**: Resistance 24,650-24,800 | Support 24,200`;
    if (q.includes('sector')) return `## Top Sectors\n\n**1. IT** — Bullish. AI tailwinds.\n**2. Power** — Bullish. Green transition.\n**3. Banking** — Neutral-Bullish. 16% credit growth.\n**4. Auto** — Bullish. EV theme.\n**5. Pharma** — Cautious. RSI oversold.`;
    return `## Analysis: ${query}\n\n**Fundamentals**: P/E 22.4, Revenue Growth 12.8%, ROE 16.2%\n\n**Technicals**: RSI 52, MACD converging, EMA neutral\n\n**Risk: 5/10** — Neutral bias\n\n*Try "Analyze [STOCK]" for detailed analysis*`;
  };

  const sendMessage = async (content: string) => {
    if (!content.trim() || loading) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: content.trim(), timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      if (!apiKey) { const r = await simulateResponse(content); setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: r, timestamp: new Date() }]); setLoading(false); return; }
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: content.trim() }] }),
      });
      if (!res.ok) { const r = await simulateResponse(content); setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: r, timestamp: new Date() }]); setLoading(false); return; }
      const data = await res.json();
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: data.content?.[0]?.text ?? 'No response', timestamp: new Date() }]);
    } catch { const r = await simulateResponse(content); setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'assistant', content: r, timestamp: new Date() }]); }
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)]">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 mb-4">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white">AI Assistant</h1>
        <p className="text-white/30 text-sm mt-1">Powered by QuantBot</p>
      </motion.div>

      {!messages.length && (
        <div className="flex flex-wrap gap-2 mb-4 shrink-0">
          {QUICK_PROMPTS.map(p => <button key={p} onClick={() => sendMessage(p)} className="text-xs px-3.5 py-2 glass-card-sm hover:border-accent-orange/30 transition text-white/40 hover:text-white/70"><Sparkles className="w-3 h-3 inline mr-1.5 text-accent-orange" />{p}</button>)}
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0">
        {!messages.length && <div className="flex items-center justify-center h-full"><div className="text-center"><Bot className="w-16 h-16 text-accent-orange/20 mx-auto mb-3" /><p className="text-white/20 text-sm">Ask QuantBot anything</p></div></div>}

        {messages.map(msg => (
          <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 rounded-xl bg-accent-orange/15 flex items-center justify-center shrink-0 mt-1"><Bot className="w-4 h-4 text-accent-orange" /></div>}
            <div className={`max-w-[80%] ${msg.role === 'user' ? 'glass-card-sm px-4 py-3' : 'glass-card-sm px-4 py-3'}`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-invert prose-sm max-w-none text-white/75 [&>h2]:text-accent-orange [&>h2]:font-extrabold [&>h2]:text-base [&>h2]:mt-3 [&>h2]:mb-1 [&>h3]:text-accent-amber [&>h3]:font-bold [&>h3]:text-sm [&>p]:text-sm [&_strong]:text-white [&_li]:text-white/60">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : <p className="text-sm text-white/80">{msg.content}</p>}
              <p className="text-[10px] text-white/15 mt-1.5">{msg.timestamp.toLocaleTimeString()}</p>
            </div>
            {msg.role === 'user' && <div className="w-8 h-8 rounded-xl bg-white/8 flex items-center justify-center shrink-0 mt-1"><User className="w-4 h-4 text-white/40" /></div>}
          </motion.div>
        ))}
        {loading && <div className="flex gap-3"><div className="w-8 h-8 rounded-xl bg-accent-orange/15 flex items-center justify-center shrink-0"><Bot className="w-4 h-4 text-accent-orange" /></div><div className="glass-card-sm px-4 py-3 flex items-center gap-2"><Loader2 className="w-4 h-4 text-accent-orange animate-spin" /><span className="text-sm text-white/30">Thinking...</span></div></div>}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 pt-3 border-t border-white/5">
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="flex gap-3">
          <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Try: Analyze Reliance Industries" disabled={loading}
            className="flex-1 bg-white/5 border border-white/8 rounded-2xl px-5 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-accent-orange/30 transition" />
          <button type="submit" disabled={loading || !input.trim()} className="px-5 py-3 bg-gradient-orange rounded-2xl text-white hover:opacity-90 transition disabled:opacity-30 glow-orange"><Send className="w-5 h-5" /></button>
        </form>
      </div>
    </div>
  );
}
