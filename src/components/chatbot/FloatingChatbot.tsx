import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Minus, X, Sparkles, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../types';

const QUICK_PROMPTS = [
  'Apa bahasa daerah untuk terima kasih?',
  'Berikan petunjuk untuk level saya sekarang',
  'Bagaimana cara menanyakan kabar dalam Basa Sunda?',
];

export function FloatingChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providerLabel, setProviderLabel] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;
    let active = true;
    setLoading(true);
    apiRequest<{
      messages: ChatMessage[];
      providerStatus: { configured: boolean; label: string };
    }>('/chat/history')
      .then((data) => {
        if (!active) return;
        setMessages(data.messages || []);
        setProviderConfigured(Boolean(data.providerStatus?.configured));
        setProviderLabel(data.providerStatus?.label || '');
      })
      .catch(() => {
        if (active) setError('Gagal memuat riwayat percakapan.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, minimized]);

  if (!user) return null;

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    setInput('');

    // Optimistic preview
    const tempId = Date.now();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        conversation_id: 0,
        role: 'user',
        content: trimmed,
        provider_mode: 'user',
        created_at: new Date().toISOString(),
      },
    ]);

    try {
      const data = await apiRequest<{
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        providerLabel: string;
        fallbackWarning?: string | null;
      }>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });

      setProviderLabel(data.providerLabel || providerLabel);
      setMessages((prev) => [
        ...prev.filter((m) => m.id !== tempId),
        data.userMessage,
        data.assistantMessage,
      ]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(err?.message || 'Gagal menghubungi LOGATARA AI. Coba lagi sebentar.');
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    try {
      await apiRequest('/chat/history', { method: 'DELETE' });
      setMessages([]);
    } catch {
      setError('Gagal membersihkan riwayat.');
    }
  };

  return (
    <div className="fixed bottom-24 md:bottom-7 right-4 md:right-7 z-40 flex flex-col items-end">
      <AnimatePresence>
        {open && (
          <motion.section
            initial={{ opacity: 0, y: 20, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ duration: 0.22 }}
            aria-label="Jendela Obrolan LOGATARA AI"
            className="mb-3 w-[min(92vw,24rem)] bg-surface-ivory rounded-[1.75rem] shadow-storybook-lg border-2 border-on-surface-bark/12 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-primary text-on-primary px-4 py-3.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/characters/tara.png"
                  alt="Tara LOGATARA AI"
                  width={40}
                  height={40}
                  className="w-10 h-10 rounded-full object-cover border-2 border-tertiary-gold bg-surface-ivory shrink-0"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h2 className="font-display font-bold text-base leading-tight truncate">LOGATARA AI</h2>
                    <Sparkles className="w-3.5 h-3.5 text-tertiary-gold shrink-0" />
                  </div>
                  <p className="text-[11px] text-on-primary-container truncate">
                    {user.current_language?.language_name || 'Nusantara'} • Level {user.current_level_number || 1}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleClear}
                  title="Bersihkan riwayat"
                  aria-label="Bersihkan riwayat percakapan"
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setMinimized((m) => !m)}
                  title={minimized ? 'Perbesar' : 'Perkecil'}
                  aria-label={minimized ? 'Perbesar obrolan' : 'Perkecil obrolan'}
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setMinimized(false);
                  }}
                  title="Tutup"
                  aria-label="Tutup jendela LOGATARA AI"
                  className="p-1.5 rounded-full hover:bg-white/15 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Provider Transparency Strip */}
                {providerLabel && (
                  <div
                    className={`px-3.5 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 ${
                      providerConfigured
                        ? 'bg-primary-fixed text-primary'
                        : 'bg-tertiary-fixed/70 text-tertiary'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        providerConfigured ? 'bg-primary' : 'bg-secondary-terracotta'
                      }`}
                    />
                    <span className="truncate">{providerLabel}</span>
                  </div>
                )}

                {/* Messages */}
                <div
                  ref={scrollRef}
                  className="p-3.5 space-y-3 h-72 overflow-y-auto bg-surface-parchment/70"
                >
                  {loading ? (
                    <div className="flex items-center justify-center h-full text-on-surface-variant text-sm gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memuat percakapan...
                    </div>
                  ) : (
                    <>
                      <div className="bg-surface-ivory border border-on-surface-bark/10 p-3 rounded-2xl rounded-tl-sm max-w-[90%] shadow-sm">
                        <p className="text-sm text-on-surface leading-relaxed">
                          Halo <strong>{user.full_name}</strong>! Aku <strong>LOGATARA AI</strong> bersama Tara. Tanyakan kosakata, tata bahasa, budaya daerah, atau petunjuk latihanmu kapan saja!
                        </p>
                      </div>

                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-2xl max-w-[88%] text-sm leading-relaxed whitespace-pre-wrap ${
                            msg.role === 'user'
                              ? 'ml-auto bg-primary text-on-primary rounded-tr-sm shadow-sm'
                              : 'bg-surface-ivory border border-on-surface-bark/10 text-on-surface rounded-tl-sm shadow-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                      ))}

                      {sending && (
                        <div className="bg-surface-ivory border border-on-surface-bark/10 px-3.5 py-2.5 rounded-2xl rounded-tl-sm inline-flex items-center gap-2 text-xs text-on-surface-variant">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary-terracotta" />
                          LOGATARA AI sedang merangkai jawaban...
                        </div>
                      )}
                    </>
                  )}
                </div>

                {error && (
                  <div className="px-3.5 py-2 bg-error-container text-on-error-container text-xs font-semibold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Quick prompts */}
                <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 bg-surface-ivory border-t border-on-surface-bark/10">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={sending}
                      onClick={() => sendMessage(q)}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-high text-on-surface-bark transition-colors text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Input form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(input);
                  }}
                  className="p-3 bg-surface-ivory flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Tanya kosakata atau budaya daerah..."
                    aria-label="Pesan untuk LOGATARA AI"
                    className="flex-1 bg-surface-rice px-3.5 py-2 rounded-full text-sm text-on-surface border border-on-surface-bark/15 focus:outline-none focus:border-primary-olive"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    aria-label="Kirim pesan"
                    className="w-10 h-10 rounded-full bg-secondary-terracotta text-white flex items-center justify-center shrink-0 hover:brightness-105 active:scale-95 disabled:opacity-50 transition-all shadow-md"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>

      {/* Circular Floating Assistant Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev);
          setMinimized(false);
        }}
        aria-label={open ? 'Tutup LOGATARA AI' : 'Buka LOGATARA AI'}
        className="group relative flex items-center gap-2.5 bg-secondary-terracotta hover:brightness-105 text-white rounded-full p-1.5 pr-4 shadow-tactile-terracotta transition-transform active:translate-y-0.5"
      >
        <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-tertiary-gold bg-surface-ivory shrink-0">
          <img
            src="/assets/characters/tara.png"
            alt="Asisten LOGATARA AI"
            width={44}
            height={44}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-left hidden sm:block">
          <span className="block font-display font-bold text-xs leading-tight">LOGATARA AI</span>
          <span className="block text-[10px] text-secondary-fixed leading-tight">Tanya Tara</span>
        </div>
      </button>
    </div>
  );
}
