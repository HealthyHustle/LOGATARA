import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Check,
  Sparkles,
  Globe2,
  MapPin,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import { assetUrl } from '../../utils/assets';
import type { RegionalLanguage } from '../../types';

export function OnboardingPage() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [languages, setLanguages] = useState<RegionalLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchKnown, setSearchKnown] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [knownIds, setKnownIds] = useState<number[]>([]);
  const [targetId, setTargetId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<{ languages: RegionalLanguage[] }>('/languages')
      .then((data) => {
        const list = data.languages || [];
        setLanguages(list);
        const firstVerified = list.find((l) => l.has_full_curriculum);
        if (firstVerified) setTargetId(firstVerified.id);
      })
      .catch(() => setError('Gagal memuat daftar bahasa daerah.'))
      .finally(() => setLoading(false));
  }, []);

  const filteredKnown = useMemo(() => {
    const q = searchKnown.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (l) =>
        l.language_name.toLowerCase().includes(q) ||
        (l.province_name || '').toLowerCase().includes(q) ||
        (l.alternative_names || '').toLowerCase().includes(q)
    );
  }, [languages, searchKnown]);

  const filteredTarget = useMemo(() => {
    const q = searchTarget.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (l) =>
        l.language_name.toLowerCase().includes(q) ||
        (l.province_name || '').toLowerCase().includes(q) ||
        (l.alternative_names || '').toLowerCase().includes(q)
    );
  }, [languages, searchTarget]);

  const toggleKnown = (id: number) => {
    setKnownIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleComplete = async () => {
    setError(null);
    if (!targetId) {
      setError('Silakan pilih satu bahasa daerah yang ingin kamu pelajari terlebih dahulu.');
      return;
    }
    setSaving(true);
    try {
      await apiRequest('/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          knownLanguageIds: knownIds,
          targetLanguageId: targetId,
        }),
      });
      await refreshUser();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan preferensi bahasa.');
    } finally {
      setSaving(false);
    }
  };

  const selectedTargetLang = languages.find((l) => l.id === targetId);

  return (
    <div className="min-h-screen bg-surface-parchment batik-watermark py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Welcome Banner */}
        <header className="storybook-card p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 bg-gradient-to-br from-surface-ivory via-surface-low to-surface-container/60">
          <div className="space-y-2.5 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <img
                src={assetUrl('/assets/icons/LOGO.png')}
                alt="LOGATARA"
                width={96}
                height={64}
                className="h-12 sm:h-14 w-auto object-contain"
              />
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-primary font-bold text-xs uppercase tracking-wide">
                <Sparkles className="w-3.5 h-3.5" />
                Langkah 2 dari 2 • Profil Bahasa Daerah
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
              Halo, {user?.full_name || 'Explorer'}! Mari Atur Perjalanan Bahasamu
            </h1>
            <p className="text-on-surface-variant text-sm sm:text-base max-w-2xl">
              Indonesia memiliki 38 provinsi dan ratusan bahasa daerah, bahkan satu provinsi bisa memiliki banyak bahasa! Pilih bahasa yang sudah kamu kenal dan bahasa yang ingin kamu pelajari bersama Tara.
            </p>
          </div>
          <img
            src={assetUrl('/assets/characters/tara-sprite.png')}
            alt="Tara menyambutmu"
            width={374}
            height={888}
            className="w-20 sm:w-24 h-auto object-contain drop-shadow-lg tara-idle shrink-0"
          />
        </header>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-error-container text-on-error-container font-semibold text-sm flex items-center gap-2.5"
          >
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="storybook-card p-12 text-center text-on-surface-variant">
            Memuat katalog bahasa daerah dari 38 provinsi Indonesia...
          </div>
        ) : (
          <>
            {/* SECTION A: Known Regional Languages (Multi-select) */}
            <section className="storybook-card p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-olive">
                    Bagian A • Opsional (Bisa Pilih Lebih dari Satu)
                  </span>
                  <h2 className="font-display text-2xl font-bold text-on-surface mt-0.5">
                    Bahasa Daerah yang Kamu Kuasai
                  </h2>
                </div>
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-primary-fixed text-primary text-xs font-bold self-start sm:self-auto">
                  <Globe2 className="w-4 h-4" />
                  {knownIds.length} Bahasa Dipilih
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-outline absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchKnown}
                  onChange={(e) => setSearchKnown(e.target.value)}
                  enterKeyHint="search"
                  placeholder="Cari nama bahasa atau provinsi (contoh: Sunda, Jawa, Papua, Bugis, Minang)..."
                  aria-label="Cari bahasa daerah yang kamu kuasai"
                  className="logatara-input w-full pl-11 pr-4 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-1">
                {filteredKnown.map((lang) => {
                  const selected = knownIds.includes(lang.id);
                  return (
                    <button
                      key={`known-${lang.id}`}
                      type="button"
                      onClick={() => toggleKnown(lang.id)}
                      aria-pressed={selected}
                      className={`text-left p-3.5 rounded-2xl border-2 transition-all flex items-start justify-between gap-2 ${
                        selected
                          ? 'bg-primary-fixed/40 border-primary-olive shadow-sm'
                          : 'bg-surface-ivory border-on-surface-bark/10 hover:bg-surface-low'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="font-display font-bold text-sm text-on-surface truncate">
                          {lang.language_name}
                        </p>
                        <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 text-secondary-terracotta shrink-0" />
                          {lang.province_name}
                        </p>
                      </div>
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                          selected
                            ? 'bg-primary text-white'
                            : 'bg-surface-container text-transparent border border-on-surface-bark/20'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* SECTION B: Target Learning Language */}
            <section className="storybook-card p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
                    Bagian B • Wajib Pilih Satu Target Utama
                  </span>
                  <h2 className="font-display text-2xl font-bold text-on-surface mt-0.5">
                    Bahasa Daerah yang Ingin Kamu Pelajari
                  </h2>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Bahasa bertanda <strong>Kurikulum Penuh</strong> sudah memiliki 7 level game lengkap terverifikasi; bahasa lainnya tersedia dalam katalog budaya 38 provinsi dan terus diverifikasi bersama penutur asli.
                  </p>
                </div>
                {selectedTargetLang && (
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-secondary-fixed text-on-secondary-fixed text-xs font-bold self-start sm:self-auto shrink-0">
                    Target: {selectedTargetLang.language_name}
                  </span>
                )}
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-outline absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  enterKeyHint="search"
                  placeholder="Cari bahasa daerah target belajar..."
                  aria-label="Cari bahasa daerah yang ingin dipelajari"
                  className="logatara-input w-full pl-11 pr-4 py-2.5 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto pr-1">
                {filteredTarget.map((lang) => {
                  const selected = targetId === lang.id;
                  return (
                    <button
                      key={`target-${lang.id}`}
                      type="button"
                      onClick={() => setTargetId(lang.id)}
                      aria-pressed={selected}
                      className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between gap-2 ${
                        selected
                          ? 'bg-secondary-fixed/50 border-secondary-terracotta shadow-md'
                          : 'bg-surface-ivory border-on-surface-bark/10 hover:bg-surface-low'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <div className="min-w-0">
                          <p className="font-display font-bold text-base text-on-surface truncate">
                            {lang.language_name}
                          </p>
                          <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-secondary-terracotta shrink-0" />
                            <span>{lang.province_name}</span>
                          </p>
                        </div>
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            selected
                              ? 'bg-secondary-terracotta text-white'
                              : 'bg-surface-container border border-on-surface-bark/20'
                          }`}
                        >
                          {selected && <Check className="w-3.5 h-3.5" />}
                        </span>
                      </div>

                      <div className="pt-1">
                        {lang.has_full_curriculum ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary">
                            <CheckCircle2 className="w-3 h-3" />
                            Kurikulum 7 Level + Translate
                          </span>
                        ) : lang.verification_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed">
                            <CheckCircle2 className="w-3 h-3" />
                            Kamus & Translate Terverifikasi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                            <Clock className="w-3 h-3" />
                            Katalog Budaya • Menunggu Verifikasi
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedTargetLang && !selectedTargetLang.has_full_curriculum && (
                <div className="p-4 rounded-2xl bg-tertiary-fixed/60 border border-tertiary-gold/40 text-sm text-on-tertiary-fixed">
                  <strong>Catatan Transparansi Data:</strong> Kurikulum permainan interaktif untuk{' '}
                  <strong>{selectedTargetLang.language_name}</strong> sedang dalam tahap verifikasi bersama penutur asli agar tidak ada terjemahan keliru. Kamu tetap dapat menyimpannya sebagai target atau memilih salah satu dari 8 bahasa kurikulum penuh (Basa Sunda, Basa Jawa, Basa Bali, Bahasa Minangkabau, Batak Toba, Bugis, Betawi, Banjar) kapan saja!
                </div>
              )}
            </section>

            {/* Footer Action Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
              <p className="text-sm text-on-surface-variant">
                Kamu selalu bisa menambah atau mengganti bahasa belajarmu kapan saja dari halaman Profil atau Peta.
              </p>
              <button
                type="button"
                disabled={saving || !targetId}
                onClick={handleComplete}
                className="btn-adventure px-8 py-3.5 text-base inline-flex items-center gap-2 disabled:opacity-60 w-full sm:w-auto justify-center"
              >
                <span>{saving ? 'Menyimpan Preferensi...' : 'Simpan & Masuk Kampung Nusantara'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
