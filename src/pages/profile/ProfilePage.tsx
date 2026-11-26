import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Award,
  Zap,
  Star,
  Flame,
  Bookmark,
  Trash2,
  Volume2,
  CheckCircle2,
  Lock,
  Save,
  History,
  Globe2,
  LogOut,
  Camera,
  Upload,
  Sparkles,
  Check,
  Search,
  RotateCcw,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import { speakPhrase } from '../../services/audio/speechService';
import { assetUrl } from '../../utils/assets';
import type { Achievement, RegionalLanguage } from '../../types';

const PRESET_3D_AVATARS = [
  {
    id: 'tara',
    name: 'Tara',
    role: 'Penjelajah Nusantara',
    path: '/assets/characters/tara.png',
  },
  {
    id: 'sari',
    name: 'Sari',
    role: 'Penjelajah Sunda-Jawa',
    path: '/assets/characters/avatar-sari.png',
  },
  {
    id: 'bagus',
    name: 'Bagus',
    role: 'Penjelajah Bali',
    path: '/assets/characters/avatar-bagus.png',
  },
  {
    id: 'nala',
    name: 'Nala',
    role: 'Penjelajah Timur Nusantara',
    path: '/assets/characters/avatar-nala.png',
  },
];

/**
 * Center-crops any uploaded photo into a crisp 256x256 JPEG data URL (< 40 KB)
 * so it saves reliably to both SQLite/PostgreSQL and browser localStorage on GitHub Pages.
 */
function compressAvatarImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('File harus berupa gambar (JPG, PNG, atau WebP).'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Ukuran file maksimal 8 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gambar tidak valid atau rusak.'));
      img.onload = () => {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Browser tidak mendukung pemrosesan gambar.'));
          return;
        }
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.fillStyle = '#FFFDF8';
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function ProfilePage() {
  const { refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [data, setData] = useState<any>(null);
  const [allLanguages, setAllLanguages] = useState<RegionalLanguage[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit profile form state
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('/assets/characters/tara.png');
  const [avatarTab, setAvatarTab] = useState<'3d' | 'upload'>('3d');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [targetLangId, setTargetLangId] = useState<number>(0);
  const [knownLangIds, setKnownLangIds] = useState<number[]>([]);
  const [knownSearch, setKnownSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, langsRes] = await Promise.all([
        apiRequest('/profile/full'),
        apiRequest<{ languages: RegionalLanguage[] }>('/languages'),
      ]);
      setData(profileRes);
      setAllLanguages(langsRes.languages || []);
      setFullName(profileRes.profile.full_name || '');
      setBio(profileRes.profile.bio || '');
      const currentAvatar = profileRes.profile.avatar_url || '/assets/characters/tara.png';
      setAvatarUrl(currentAvatar);
      if (currentAvatar.startsWith('data:image/')) {
        setAvatarTab('upload');
      }
      setTargetLangId(profileRes.profile.current_language_id || 0);
      setKnownLangIds((profileRes.knownLanguages || []).map((l: any) => l.id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const filteredKnownOptions = useMemo(() => {
    const q = knownSearch.trim().toLowerCase();
    if (!q) return allLanguages.slice(0, 18);
    return allLanguages
      .filter(
        (l) =>
          l.language_name.toLowerCase().includes(q) ||
          (l.province_name || '').toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [allLanguages, knownSearch]);

  const toggleKnownLang = (id: number) => {
    setKnownLangIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const compressedDataUrl = await compressAvatarImage(file);
      setAvatarUrl(compressedDataUrl);
      setAvatarTab('upload');
    } catch (err: any) {
      setUploadError(err?.message || 'Gagal memproses foto.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveFeedback(null);
    try {
      await apiRequest('/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName: fullName.trim(),
          bio: bio.trim(),
          avatarUrl,
          targetLanguageId: targetLangId || undefined,
          knownLanguageIds: knownLangIds,
        }),
      });
      await refreshUser();
      await loadProfile();
      setSaveFeedback('Profil, foto avatar, dan preferensi bahasa berhasil disimpan!');
    } catch (err: any) {
      setSaveFeedback(err?.message || 'Gagal memperbarui profil.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVocab = async (id: number) => {
    await apiRequest(`/saved-vocabulary/${id}`, { method: 'DELETE' });
    loadProfile();
  };

  const handleRemovePhrase = async (dailyPhraseId: number) => {
    await apiRequest(`/daily-phrases/${dailyPhraseId}/save`, { method: 'DELETE' });
    loadProfile();
  };

  if (loading || !data) {
    return (
      <div className="storybook-card p-12 text-center text-on-surface-variant">
        Memuat profil Explorer Nusantara...
      </div>
    );
  }

  const {
    profile,
    knownLanguages,
    learningLanguages,
    completedLevels,
    xpHistory,
    achievements,
    savedVocabulary,
    savedPhrases,
  } = data;

  return (
    <div className="space-y-8">
      {/* Top Explorer Banner */}
      <section className="storybook-card p-6 sm:p-8 batik-watermark flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="relative shrink-0">
            <img
              src={assetUrl(avatarUrl || '/assets/characters/tara.png')}
              alt={profile.full_name}
              width={96}
              height={96}
              className="w-24 h-24 rounded-full object-cover border-4 border-tertiary-gold shadow-storybook bg-surface-ivory"
            />
            <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-white border-2 border-surface-ivory flex items-center justify-center shadow-sm">
              <Camera className="w-4 h-4" />
            </span>
          </div>
          <div className="space-y-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-bold">
              Explorer Level {profile.current_level_number}
            </span>
            <h1 className="font-display text-3xl font-bold text-primary">{profile.full_name}</h1>
            <p className="text-sm text-on-surface-variant">{profile.email}</p>
            <p className="text-sm text-on-surface-bark italic">"{profile.bio}"</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 items-center lg:items-end">
          <div className="grid grid-cols-3 gap-2.5 w-full sm:w-auto">
            <div className="p-3 rounded-2xl bg-surface-low border border-on-surface-bark/10 text-center min-w-[92px]">
              <Zap className="w-5 h-5 text-primary fill-primary mx-auto mb-0.5" />
              <span className="block font-display text-lg font-bold">{profile.total_xp}</span>
              <span className="text-[10px] font-bold uppercase text-on-surface-variant">XP</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-low border border-on-surface-bark/10 text-center min-w-[92px]">
              <Star className="w-5 h-5 text-tertiary-gold fill-tertiary-gold mx-auto mb-0.5" />
              <span className="block font-display text-lg font-bold">{profile.total_stars}</span>
              <span className="text-[10px] font-bold uppercase text-on-surface-variant">Bintang</span>
            </div>
            <div className="p-3 rounded-2xl bg-surface-low border border-on-surface-bark/10 text-center min-w-[92px]">
              <Flame className="w-5 h-5 text-secondary-terracotta fill-secondary-terracotta mx-auto mb-0.5" />
              <span className="block font-display text-lg font-bold">{profile.daily_streak}</span>
              <span className="text-[10px] font-bold uppercase text-on-surface-variant">Runtun</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="btn-parchment px-4 py-2 text-xs inline-flex items-center gap-1.5 text-error"
          >
            <LogOut className="w-4 h-4" /> Keluar dari Akun
          </button>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Enhanced Edit Profile (Photo Upload + 3D Nusantara Avatars + Known & Learning Languages) */}
        <section className="lg:col-span-5 storybook-card p-6 space-y-5">
          <h2 className="font-display text-2xl font-bold text-primary">
            Edit Profil & Foto Avatar
          </h2>

          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar Studio Picker */}
            <div className="p-4 rounded-2xl bg-surface-low border border-on-surface-bark/10 space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase text-on-surface-variant flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-secondary-terracotta" />
                  Foto Profil Explorer
                </span>
                <div className="inline-flex rounded-full bg-surface-container p-0.5">
                  <button
                    type="button"
                    onClick={() => setAvatarTab('3d')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                      avatarTab === '3d'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-on-surface-bark hover:text-primary'
                    }`}
                  >
                    Karakter 3D
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarTab('upload')}
                    className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                      avatarTab === 'upload'
                        ? 'bg-primary text-white shadow-xs'
                        : 'text-on-surface-bark hover:text-primary'
                    }`}
                  >
                    Unggah Foto
                  </button>
                </div>
              </div>

              {avatarTab === '3d' ? (
                <div className="grid grid-cols-2 gap-2.5">
                  {PRESET_3D_AVATARS.map((char) => {
                    const isSelected = avatarUrl === char.path;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(char.path);
                          setUploadError(null);
                        }}
                        aria-pressed={isSelected}
                        className={`p-2.5 rounded-2xl border-2 text-left flex items-center gap-2.5 transition-all ${
                          isSelected
                            ? 'bg-primary-fixed/60 border-primary shadow-sm'
                            : 'bg-surface-ivory border-on-surface-bark/10 hover:bg-surface-container/60'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <img
                            src={assetUrl(char.path)}
                            alt={`Karakter 3D ${char.name}`}
                            width={48}
                            height={48}
                            className="w-12 h-12 rounded-full object-cover border-2 border-tertiary-gold/70 bg-surface-ivory"
                          />
                          {isSelected && (
                            <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-sm text-on-surface truncate">
                            {char.name}
                          </p>
                          <p className="text-[10px] text-on-surface-variant leading-tight line-clamp-2">
                            {char.role}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <img
                      src={assetUrl(avatarUrl || '/assets/characters/tara.png')}
                      alt="Pratinjau foto profil"
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover border-2 border-tertiary-gold bg-surface-ivory shrink-0"
                    />
                    <div className="flex-1 space-y-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handlePhotoFileChange}
                        className="sr-only"
                        id="profile-photo-upload"
                      />
                      <div className="flex flex-wrap gap-2">
                        <label
                          htmlFor="profile-photo-upload"
                          className="btn-adventure px-4 py-2 text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>Pilih Foto Sendiri</span>
                        </label>
                        {avatarUrl.startsWith('data:image/') && (
                          <button
                            type="button"
                            onClick={() => {
                              setAvatarUrl('/assets/characters/tara.png');
                              setAvatarTab('3d');
                            }}
                            className="btn-parchment px-3 py-2 text-xs inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reset ke Tara
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-on-surface-variant">
                        Format JPG/PNG/WebP. Foto otomatis dipotong persegi & dikompresi agar ringan.
                      </p>
                    </div>
                  </div>

                  {uploadError && (
                    <p className="text-xs font-bold text-on-error-container bg-error-container px-3 py-2 rounded-xl">
                      ⚠️ {uploadError}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="profile-fullname" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
                Nama Lengkap
              </label>
              <input
                id="profile-fullname"
                type="text"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="logatara-input w-full px-4 py-2.5 text-sm"
              />
            </div>

            <div>
              <label htmlFor="profile-bio" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
                Bio Penjelajah
              </label>
              <textarea
                id="profile-bio"
                rows={2}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="logatara-input w-full px-4 py-2.5 text-sm resize-none"
              />
            </div>

            <div>
              <label htmlFor="profile-target-lang" className="block text-xs font-bold uppercase text-on-surface-variant mb-1">
                Bahasa Belajar Aktif
              </label>
              <select
                id="profile-target-lang"
                value={targetLangId}
                onChange={(e) => setTargetLangId(Number(e.target.value))}
                className="logatara-input w-full px-4 py-2.5 text-sm font-semibold"
              >
                {allLanguages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.language_name} ({l.province_name}) {l.has_full_curriculum ? '✓ Game 7 Level & Translate' : '✓ Translate Terverifikasi'}
                  </option>
                ))}
              </select>
            </div>

            {/* Editable Known Languages Picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label htmlFor="known-lang-search" className="text-xs font-bold uppercase text-on-surface-variant">
                  Edit Bahasa Daerah yang Dikuasai ({knownLangIds.length})
                </label>
              </div>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-outline absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="known-lang-search"
                  type="search"
                  value={knownSearch}
                  onChange={(e) => setKnownSearch(e.target.value)}
                  placeholder="Cari & pilih bahasa yang kamu kuasai..."
                  className="logatara-input w-full pl-9 pr-3 py-2 text-xs"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-2xl bg-surface-low border border-on-surface-bark/10">
                {filteredKnownOptions.map((l) => {
                  const active = knownLangIds.includes(l.id);
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleKnownLang(l.id)}
                      aria-pressed={active}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors inline-flex items-center gap-1 ${
                        active
                          ? 'bg-primary text-white'
                          : 'bg-surface-ivory border border-on-surface-bark/15 text-on-surface-bark hover:bg-surface-container'
                      }`}
                    >
                      {active && <Check className="w-3 h-3" />}
                      <span>{l.language_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {saveFeedback && (
              <p className="text-xs font-bold text-primary bg-primary-fixed/60 px-3 py-2 rounded-xl">
                {saveFeedback}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="btn-foliage w-full py-3 text-sm inline-flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Perubahan Profil'}</span>
            </button>
          </form>

          {/* Language Badges Summary */}
          <div className="pt-4 border-t border-on-surface-bark/10 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase text-on-surface-variant flex items-center gap-1.5 mb-2">
                <Globe2 className="w-4 h-4 text-primary" /> Bahasa Daerah yang Dikuasai
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {knownLanguages.length === 0 ? (
                  <span className="text-xs text-outline">Belum dipilih</span>
                ) : (
                  knownLanguages.map((l: any) => (
                    <span
                      key={l.id}
                      className="px-2.5 py-1 rounded-full bg-surface-container text-xs font-bold text-on-surface-bark"
                    >
                      {l.language_name}
                    </span>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-bold uppercase text-on-surface-variant mb-2">
                Bahasa yang Sedang Dipelajari
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {learningLanguages.map((l: any) => (
                  <span
                    key={l.id}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      l.is_primary
                        ? 'bg-secondary-terracotta text-white'
                        : 'bg-primary-fixed text-primary'
                    }`}
                  >
                    {l.language_name} {l.is_primary ? '(Aktif)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Right: Achievements & Learning History */}
        <section className="lg:col-span-7 space-y-6">
          {/* Achievement Badges */}
          <div className="storybook-card p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
              <Award className="w-6 h-6 text-tertiary-gold" />
              Lencana Pencapaian
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {achievements.map((ach: Achievement) => (
                <div
                  key={ach.id}
                  className={`p-4 rounded-2xl border-2 flex items-start gap-3 ${
                    ach.unlocked
                      ? 'bg-surface-low border-tertiary-gold/60'
                      : 'bg-surface-rice/50 border-on-surface-bark/10 opacity-65'
                  }`}
                >
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0"
                    style={{ backgroundColor: ach.unlocked ? ach.badge_color : '#8E8A82' }}
                  >
                    {ach.unlocked ? <Award className="w-6 h-6" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-display font-bold text-sm text-on-surface">{ach.title}</p>
                    <p className="text-xs text-on-surface-variant leading-snug mt-0.5">
                      {ach.description}
                    </p>
                    <span className="inline-block mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-ivory border border-on-surface-bark/10">
                      {ach.unlocked ? `✓ Terbuka (+${ach.xp_bonus} XP)` : `Hadiah +${ach.xp_bonus} XP`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Completed Levels & XP History */}
          <div className="storybook-card p-6 space-y-4">
            <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
              <History className="w-6 h-6 text-secondary-terracotta" />
              Riwayat Level & Perolehan XP
            </h2>

            {completedLevels.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-on-surface-variant">
                  Level yang Telah Diselesaikan ({completedLevels.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {completedLevels.map((lv: any) => (
                    <span
                      key={lv.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-fixed text-primary text-xs font-bold"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {lv.language_name} (Lv.{lv.level_number}: {lv.title})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {xpHistory.length === 0 ? (
                <p className="text-sm text-on-surface-variant">
                  Belum ada riwayat XP. Selesaikan modul belajar atau aktivitas game pertamamu!
                </p>
              ) : (
                xpHistory.map((tx: any) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-2xl bg-surface-low flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <p className="font-bold text-on-surface">{tx.description}</p>
                      <p className="text-[11px] text-outline">{tx.created_at}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {tx.xp_amount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary font-bold">
                          +{tx.xp_amount} XP
                        </span>
                      )}
                      {tx.stars_amount > 0 && (
                        <span className="px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed font-bold">
                          +{tx.stars_amount} ★
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Saved Vocabulary & Saved Phrases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="storybook-card p-6 space-y-4">
          <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-secondary-terracotta" />
            Kamus Saku Tersimpan ({savedVocabulary.length})
          </h2>
          {savedVocabulary.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Belum ada kosakata tersimpan. Simpan kata favoritmu dari Modul Belajar atau halaman Translate!
            </p>
          ) : (
            <div className="space-y-2.5">
              {savedVocabulary.map((v: any) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-primary">{v.language_name}</span>
                    <p className="font-display font-bold text-base text-on-surface">
                      {v.regional_word}{' '}
                      <span className="text-xs font-normal text-on-surface-variant">
                        ({v.indonesian_meaning})
                      </span>
                    </p>
                    {v.pronunciation && (
                      <p className="font-mono text-[11px] text-secondary-terracotta">/{v.pronunciation}/</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakPhrase(v.regional_word)}
                      aria-label={`Putar ${v.regional_word}`}
                      className="p-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveVocab(v.id)}
                      aria-label={`Hapus ${v.regional_word}`}
                      className="p-2 rounded-full hover:bg-error-container text-error"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="storybook-card p-6 space-y-4">
          <h2 className="font-display text-2xl font-bold text-primary flex items-center gap-2">
            <Bookmark className="w-5 h-5 text-tertiary-gold" />
            Frasa Harian Tersimpan ({savedPhrases.length})
          </h2>
          {savedPhrases.length === 0 ? (
            <p className="text-sm text-on-surface-variant">
              Belum ada frasa harian tersimpan. Kunjungi halaman Frasa Harian untuk menyimpannya!
            </p>
          ) : (
            <div className="space-y-2.5">
              {savedPhrases.map((p: any) => (
                <div
                  key={p.saved_id}
                  className="p-3.5 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center justify-between gap-3"
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase text-secondary-terracotta">
                      {p.language_name} • {p.province_name}
                    </span>
                    <p className="font-display font-bold text-base text-on-surface">
                      "{p.regional_phrase}"
                    </p>
                    <p className="text-xs text-primary font-semibold">{p.indonesian_meaning}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakPhrase(p.regional_phrase)}
                      aria-label={`Putar ${p.regional_phrase}`}
                      className="p-2 rounded-full bg-tertiary-fixed text-on-tertiary-fixed"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemovePhrase(p.id)}
                      aria-label={`Hapus frasa ${p.regional_phrase}`}
                      className="p-2 rounded-full hover:bg-error-container text-error"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
