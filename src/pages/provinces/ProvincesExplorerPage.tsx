import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe2, Search, MapPin, CheckCircle2, Clock, ArrowRight } from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import type { Province } from '../../types';

const ISLAND_GROUPS = [
  'Semua',
  'Sumatera',
  'Jawa',
  'Bali & Nusa Tenggara',
  'Kalimantan',
  'Sulawesi',
  'Maluku',
  'Papua',
];

export function ProvincesExplorerPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [totalProvinces, setTotalProvinces] = useState(38);
  const [totalLanguages, setTotalLanguages] = useState(0);
  const [island, setIsland] = useState('Semua');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (island !== 'Semua') params.set('island', island);
    if (search.trim()) params.set('q', search.trim());

    setLoading(true);
    apiRequest<{ totalProvinces: number; totalLanguages: number; provinces: Province[] }>(
      `/provinces?${params.toString()}`
    )
      .then((res) => {
        setProvinces(res.provinces || []);
        setTotalProvinces(res.totalProvinces || 38);
        setTotalLanguages(res.totalLanguages || 0);
      })
      .finally(() => setLoading(false));
  }, [island, search]);

  const handleStartLanguage = async (langId: number) => {
    await apiRequest('/profile/active-language', {
      method: 'PUT',
      body: JSON.stringify({ languageId: langId }),
    });
    await refreshUser();
    navigate('/map');
  };

  return (
    <div className="space-y-6">
      <section className="storybook-card p-6 batik-watermark space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-white text-xs font-bold uppercase">
            <Globe2 className="w-3.5 h-3.5" />
            Eksplorasi {totalProvinces} Provinsi Indonesia
          </span>
          <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
            {totalLanguages}+ Bahasa Daerah Terpetakan (Multi-Bahasa per Provinsi)
          </span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
          Peta Kekayaan Bahasa 38 Provinsi Nusantara
        </h1>
        <p className="text-sm text-on-surface-variant max-w-3xl">
          Satu provinsi di Indonesia sering memiliki banyak bahasa dan ragam dialek lokal. Seluruh bahasa daerah di katalog 38 provinsi ini telah memiliki <strong>Kamus & Translate Terverifikasi</strong>, dan 8 bahasa utama telah dilengkapi <strong>Kurikulum Game 7 Level</strong> penuh.
        </p>
      </section>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex flex-wrap gap-1.5">
          {ISLAND_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setIsland(g)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all ${
                island === g
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-surface-ivory border border-on-surface-bark/15 text-on-surface-bark hover:bg-surface-container'
              }`}
            >
              {g}
            </button>
          ))}
        </div>

        <div className="relative md:w-72">
          <Search className="w-4 h-4 text-outline absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari provinsi, budaya, atau bahasa..."
            aria-label="Cari provinsi atau bahasa daerah"
            className="logatara-input w-full pl-10 pr-4 py-2 text-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="storybook-card p-12 text-center text-on-surface-variant">
          Memuat 38 provinsi Indonesia...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {provinces.map((prov) => (
            <article key={prov.id} className="storybook-card p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-terracotta">
                    {prov.island_group} • {prov.province_code}
                  </span>
                  <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-1.5">
                    <MapPin className="w-5 h-5 text-secondary-terracotta shrink-0" />
                    {prov.province_name}
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-surface-container text-xs font-bold text-on-surface-bark shrink-0">
                  {prov.languages.length} Bahasa
                </span>
              </div>

              <p className="text-xs sm:text-sm text-on-surface-variant leading-relaxed">
                {prov.region_description}
              </p>
              <p className="text-xs text-on-surface-bark bg-surface-low p-3 rounded-2xl border border-on-surface-bark/10">
                <strong>Warisan Budaya:</strong> {prov.cultural_information}
              </p>

              <div className="space-y-2.5 pt-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Bahasa Daerah di {prov.province_name}:
                </h3>
                {prov.languages.map((lang) => (
                  <div
                    key={lang.id}
                    className="p-3.5 rounded-2xl bg-surface-ivory border border-on-surface-bark/12 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-display font-bold text-base text-on-surface">
                          {lang.language_name}
                        </span>
                        {lang.has_full_curriculum ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-fixed text-primary text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Game 7 Level & Translate ✓
                          </span>
                        ) : lang.verification_status === 'verified' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold">
                            <CheckCircle2 className="w-3 h-3" /> Kamus & Translate Terverifikasi ({lang.vocab_count || 0} kata)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-[10px] font-semibold">
                            <Clock className="w-3 h-3" /> Menunggu Verifikasi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant">{lang.language_description}</p>
                      <p className="text-[10px] text-outline">Sumber: {lang.source_metadata}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <button
                        type="button"
                        onClick={() => navigate(`/translate?langId=${lang.id}`)}
                        className="btn-parchment px-3.5 py-2 text-xs inline-flex items-center gap-1"
                      >
                        <span>Translate</span>
                      </button>
                      {lang.has_full_curriculum && (
                        <button
                          type="button"
                          onClick={() => handleStartLanguage(lang.id)}
                          className="btn-adventure px-4 py-2 text-xs inline-flex items-center gap-1.5"
                        >
                          <span>Pelajari</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
