import React, { useEffect, useState, useRef } from 'react';
import { Send, Sparkles, Trash2, Loader2, AlertCircle, Bot } from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { ChatMessage } from '../../types';

const STARTER_QUESTIONS = [
  'Apa bahasa Sunda, Jawa, dan Bali untuk terima kasih?',
  'Berikan petunjuk belajar untuk level saya sekarang',
  'Bagaimana cara menanyakan kabar dalam Basa Sunda?',
  'Jelaskan budaya dan bahasa daerah di Sulawesi Selatan',
  'Apa arti "Sampurasun" dan bagaimana cara menjawabnya?',
];

export function ChatbotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providerLabel, setProviderLabel] = useState('');
  const [providerConfigured, setProviderConfigured] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiRequest<{
      messages: ChatMessage[];
      providerStatus: { configured: boolean; label: string };
    }>('/chat/history')
      .then((data) => {
        setMessages(data.messages || []);
        setProviderLabel(data.providerStatus?.label || '');
        setProviderConfigured(Boolean(data.providerStatus?.configured));
      })
      .catch(() => setError('Gagal memuat riwayat percakapan.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setError(null);
    setSending(true);
    setInput('');

    try {
      const data = await apiRequest<{
        userMessage: ChatMessage;
        assistantMessage: ChatMessage;
        providerLabel: string;
      }>('/chat/message', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });
      setProviderLabel(data.providerLabel || providerLabel);
      setMessages((prev) => [...prev, data.userMessage, data.assistantMessage]);
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim pesan ke LOGATARA AI.');
    } finally {
      setSending(false);
    }
  };

  const clearHistory = async () => {
    await apiRequest('/chat/history', { method: 'DELETE' });
    setMessages([]);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <section className="storybook-card p-5 sm:p-6 batik-watermark flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src="/assets/characters/tara.png"
            alt="LOGATARA AI bersama Tara"
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover border-3 border-tertiary-gold shadow-md bg-surface-ivory"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">LOGATARA AI</h1>
              <Sparkles className="w-5 h-5 text-tertiary-gold" />
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant">
              Asisten belajar bahasa & budaya Nusantara • Konteks aktif:{' '}
              <strong>{user?.current_language?.language_name || 'Nusantara'}</strong> (Level{' '}
              {user?.current_level_number || 1})
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={clearHistory}
          className="btn-parchment px-4 py-2 text-xs inline-flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Trash2 className="w-4 h-4 text-error" />
          <span>Bersihkan Riwayat</span>
        </button>
      </section>

      {/* Provider Mode Transparency Bar */}
      {providerLabel && (
        <div
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 ${
            providerConfigured
              ? 'bg-primary-fixed text-primary'
              : 'bg-tertiary-fixed/70 text-on-tertiary-fixed border border-tertiary-gold/40'
          }`}
        >
          <Bot className="w-4 h-4 shrink-0" />
          <span>Status Provider AI: {providerLabel}</span>
        </div>
      )}

      {/* Chat Workspace */}
      <section className="storybook-card overflow-hidden flex flex-col h-[540px]">
        <div ref={listRef} className="flex-1 overflow-y-auto p-5 space-y-4 bg-surface-parchment/70">
          {loading ? (
            <div className="flex items-center justify-center h-full text-on-surface-variant gap-2 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" /> Memuat percakapan...
            </div>
          ) : (
            <>
              <div className="bg-surface-ivory border border-on-surface-bark/10 p-4 rounded-3xl rounded-tl-sm max-w-[85%] shadow-sm text-sm leading-relaxed">
                Halo <strong>{user?.full_name}</strong>! Aku <strong>LOGATARA AI</strong>. Kamu bisa bertanya tentang kosakata daerah, tata krama unggah-ungguh, arti ungkapan, contoh percakapan, cerita budaya 38 provinsi, hingga petunjuk level yang sedang kamu mainkan!
              </div>

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-3xl max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap shadow-sm ${
                    msg.role === 'user'
                      ? 'ml-auto bg-primary text-white rounded-tr-sm'
                      : 'bg-surface-ivory border border-on-surface-bark/10 text-on-surface rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                </div>
              ))}

              {sending && (
                <div className="bg-surface-ivory border border-on-surface-bark/10 px-4 py-3 rounded-3xl rounded-tl-sm inline-flex items-center gap-2 text-xs text-on-surface-variant">
                  <Loader2 className="w-4 h-4 animate-spin text-secondary-terracotta" />
                  LOGATARA AI sedang menyiapkan jawaban...
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="px-5 py-2.5 bg-error-container text-on-error-container text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick Prompt Pills */}
        <div className="px-4 py-2.5 bg-surface-ivory border-t border-on-surface-bark/10 flex flex-wrap gap-1.5">
          {STARTER_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              disabled={sending}
              onClick={() => sendMessage(q)}
              className="text-xs font-semibold px-3 py-1.5 rounded-full bg-surface-container hover:bg-surface-high text-on-surface-bark transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-4 bg-surface-ivory border-t border-on-surface-bark/10 flex items-center gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ketik pertanyaanmu tentang bahasa daerah atau budaya Indonesia..."
            aria-label="Ketik pesan untuk LOGATARA AI"
            className="logatara-input flex-1 px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="btn-adventure px-5 py-3 text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Kirim</span>
          </button>
        </form>
      </section>
    </div>
  );
}
