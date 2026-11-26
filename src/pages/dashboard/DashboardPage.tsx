import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Play,
  Map,
  Flame,
  Star,
  Zap,
  Award,
  Volume2,
  Bookmark,
  BookmarkCheck,
  Target,
  MapPin,
  Lock,
  CheckCircle2,
  ArrowRight,
  Pause,
  PlayCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { speakPhrase } from '../../services/audio/speechService';
import { StorybookDialog } from '../../components/common/StorybookDialog';
import { TaraSprite } from '../../components/character/TaraSprite';
import { assetUrl } from '../../utils/assets';
import type {
  AdventureLevel,
  Achievement,
  DailyPhrase,
  RegionalLanguage,
  VillageLocation,
} from '../../types';

interface DashboardData {
  profile: {
    id: number;
    full_name: string;
    email: string;
    avatar_url: string;
    total_xp: number;
    total_stars: number;
    daily_streak: number;
    current_level_number: number;
    explorer_rank_level: number;
    xp_in_current_tier: number;
    xp_for_next_tier: number;
  };
  activeLanguage: RegionalLanguage | null;
  progressSummary: {
    completedLevels: number;
    totalLevels: number;
    percent: number;
    nextLevel: AdventureLevel | null;
  };
  dailyMission: {
    title: string;
    description: string;
    completedTasks: number;
    targetTasks: number;
    xpToday: number;
    targetXp: number;
  };
  dailyPhrase: DailyPhrase | null;
  recentAchievements: Achievement[];
  totalAchievementsCount: number;
  locations: VillageLocation[];
}

export function DashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLoc, setSelectedLoc] = useState<VillageLocation | null>(null);
  const [speakingId, setSpeakingId] = useState(false);
  const [phraseSaved, setPhraseSaved] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);

  useEffect(() => {
    apiRequest<DashboardData>('/dashboard')
      .then((res) => {
        setData(res);
        setPhraseSaved(Boolean(res.dailyPhrase?.is_saved));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSavePhrase = async () => {
    if (!data?.dailyPhrase) return;
    if (phraseSaved) {
      await apiRequest(`/daily-phrases/${data.dailyPhrase.id}/save`, { method: 'DELETE' });
      setPhraseSaved(false);
    } else {
      await apiRequest(`/daily-phrases/${data.dailyPhrase.id}/save`, { method: 'POST' });
      setPhraseSaved(true);
    }
  };

  if (loading || !data) {
    return (
      <div className="storybook-card p-14 text-center text-on-surface-variant">
        Membuka gerbang Kampung Nusantara bersama Tara...
      </div>
    );
  }

  const { profile, activeLanguage, progressSummary, dailyMission, dailyPhrase, recentAchievements, locations } = data;
  const activeLoc =
    locations.find((l) => l.levelNumber === profile.current_level_number) || locations[0];

  return (
    <div className={`space-y-6 ${motionPaused ? 'motion-paused' : ''}`}>
      {/* Greeting & Explorer Info Ribbon */}
      <section className="storybook-card p-5 sm:p-6 batik-watermark flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={assetUrl(profile.avatar_url || '/assets/characters/tara.png')}
            alt={`Avatar ${profile.full_name}`}
            width={64}
            height={64}
            className="w-16 h-16 rounded-full object-cover border-3 border-tertiary-gold shadow-md bg-surface-ivory shrink-0"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
              Halo, Explorer! Selamat datang kembali!
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary leading-tight">
              {profile.full_name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-bold">
                <MapPin className="w-3 h-3" />
                {activeLanguage ? `${activeLanguage.language_name} (${activeLanguage.province_name})` : 'Pilih Bahasa'}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                Level Petualangan {profile.current_level_number}
              </span>
            </div>
          </div>
        </div>

        {/* Live Stats Cluster */}
        <div className="grid grid-cols-3 gap-2.5 sm:flex sm:items-center">
          <div className="px-3.5 py-2 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary fill-primary shrink-0" />
            <div>
              <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Total XP</span>
              <span className="font-display font-bold text-base text-on-surface">{profile.total_xp}</span>
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center gap-2">
            <Star className="w-5 h-5 text-tertiary-gold fill-tertiary-gold shrink-0" />
            <div>
              <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Bintang</span>
              <span className="font-display font-bold text-base text-on-surface">{profile.total_stars}</span>
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center gap-2">
            <Flame className="w-5 h-5 text-secondary-terracotta fill-secondary-terracotta shrink-0" />
            <div>
              <span className="block text-[10px] font-bold uppercase text-on-surface-variant">Runtun</span>
              <span className="font-display font-bold text-base text-on-surface">{profile.daily_streak} Hari</span>
            </div>
          </div>
        </div>
      </section>

      {/* HERO VISUAL: Interactive 3D Kampung Nusantara World (Prominent Centerpiece!) */}
      <section className="relative rounded-[2rem] overflow-hidden shadow-storybook-lg border-2 border-on-surface-bark/15 bg-surface-container">
        {/* Top Overlay Controls */}
        <div className="relative z-20 px-4 sm:px-6 py-3 bg-surface-ivory/85 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 border-b border-on-surface-bark/10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-secondary-terracotta" />
            <h2 className="font-display font-bold text-base sm:text-lg text-primary">
              Dunia Kampung Nusantara — Jelajahi 7 Lokasi Budaya
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMotionPaused((p) => !p)}
              className="btn-parchment px-3 py-1.5 text-xs inline-flex items-center gap-1"
            >
              {motionPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{motionPaused ? 'Putar' : 'Jeda'} Animasi</span>
            </button>
            <Link to="/map" className="btn-foliage px-4 py-1.5 text-xs inline-flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" />
              <span>Buka Peta Level</span>
            </Link>
          </div>
        </div>

        {/* Interactive Diorama Canvas */}
        <div className="relative w-full overflow-x-auto">
          <div className="relative min-w-[700px] w-full aspect-[1376/768]">
            <img
              src={assetUrl('/assets/environments/kampung-nusantara.png')}
              alt="Diorama 3D Kampung Nusantara dengan Joglo, Tongkonan, Rumah Batik, Pasar Tradisional, dan Sawah Terasering"
              width={1376}
              height={768}
              fetchPriority="high"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-on-surface/35 via-transparent to-transparent pointer-events-none" />

            {/* 7 Interactive Village Location Hotspots */}
            {locations.map((loc) => {
              const isLocked = loc.status === 'locked';
              const isCompleted = loc.status === 'completed';
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLoc(loc)}
                  style={{ left: `${loc.x}%`, top: `${loc.y}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group flex flex-col items-center focus:outline-none focus-visible:ring-4 focus-visible:ring-tertiary-gold rounded-2xl"
                >
                  <span
                    className={`px-3 py-1.5 rounded-full text-xs font-bold shadow-lg border-2 flex items-center gap-1.5 transition-transform group-hover:scale-105 ${
                      isCompleted
                        ? 'bg-primary text-white border-surface-ivory'
                        : isLocked
                          ? 'bg-surface-ivory/90 text-on-surface-variant border-on-surface-bark/20'
                          : 'bg-secondary-terracotta text-white border-tertiary-gold'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : isLocked ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Play className="w-3 h-3 fill-current" />
                    )}
                    <span>{loc.name}</span>
                  </span>
                  <span className="mt-1 px-2 py-0.5 rounded-full bg-on-surface/75 text-white text-[10px] font-semibold backdrop-blur-xs opacity-90 group-hover:opacity-100">
                    Lv {loc.levelNumber} • {loc.subtitle}
                  </span>
                </button>
              );
            })}

            {/* Tara Character Standing in the Village */}
            {activeLoc && (
              <div
                style={{
                  left: `${Math.min(88, Math.max(12, activeLoc.x - 8))}%`,
                  top: `${Math.min(86, Math.max(24, activeLoc.y + 8))}%`,
                  transform: 'translate(-50%, -80%)',
                }}
                className="absolute z-30"
              >
                <TaraSprite
                  state="idle"
                  speechText={`Klik ${activeLoc.name} atau Lanjutkan Petualangan!`}
                  onClick={() => navigate('/map')}
                  size="sm"
                />
              </div>
            )}

            {/* Floating Continue Adventure CTA inside Village Bottom Bar */}
            <div className="absolute bottom-4 left-4 right-4 z-30 flex flex-wrap items-center justify-between gap-3 bg-surface-ivory/92 backdrop-blur-md p-3.5 sm:p-4 rounded-2xl shadow-storybook border border-on-surface-bark/10">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-terracotta">
                  Lanjutkan Petualangan
                </span>
                <p className="font-display font-bold text-base sm:text-lg text-on-surface">
                  {progressSummary.nextLevel
                    ? `Level ${progressSummary.nextLevel.level_number}: ${progressSummary.nextLevel.title} (${progressSummary.nextLevel.location_name})`
                    : 'Jelajahi Peta Kampung Nusantara'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {progressSummary.nextLevel && (
                  <button
                    type="button"
                    onClick={() => navigate(`/level/${progressSummary.nextLevel!.id}`)}
                    className="btn-adventure px-5 py-2.5 text-sm inline-flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Mainkan Level {progressSummary.nextLevel.level_number}</span>
                  </button>
                )}
                <Link to="/map" className="btn-parchment px-4 py-2.5 text-sm">
                  Peta Lengkap
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Storybook Dashboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* Card 1: Current Learning Progress & XP Progress */}
        <article className="storybook-card p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-primary">Progres Belajar & XP</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-primary-fixed text-primary text-xs font-bold">
                Rank Explorer Lv.{profile.explorer_rank_level}
              </span>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-on-surface-bark mb-1">
                <span>Penyelesaian Peta ({activeLanguage?.language_name || 'Nusantara'})</span>
                <span>
                  {progressSummary.completedLevels}/{progressSummary.totalLevels} Level ({progressSummary.percent}%)
                </span>
              </div>
              <div className="h-3 rounded-full bg-surface-container overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-primary-olive transition-all duration-500"
                  style={{ width: `${Math.max(4, progressSummary.percent)}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-bold text-on-surface-bark mb-1">
                <span>XP menuju Rank {profile.explorer_rank_level + 1}</span>
                <span>
                  {profile.xp_in_current_tier}/{profile.xp_for_next_tier} XP
                </span>
              </div>
              <div className="h-3 rounded-full bg-surface-container overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-secondary-terracotta transition-all duration-500"
                  style={{
                    width: `${Math.round((profile.xp_in_current_tier / profile.xp_for_next_tier) * 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <Link
            to="/provinces"
            className="text-xs font-bold text-secondary-terracotta hover:underline inline-flex items-center gap-1 pt-2"
          >
            <span>Jelajahi 38 Provinsi & Bahasa Daerah</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </article>

        {/* Card 2: Daily Mission */}
        <article className="storybook-card p-5 space-y-4 flex flex-col justify-between bg-gradient-to-br from-surface-ivory to-surface-low">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-primary flex items-center gap-2">
                <Target className="w-5 h-5 text-secondary-terracotta" />
                {dailyMission.title}
              </h3>
              <span className="text-xs font-bold text-secondary-terracotta">Hari Ini</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {dailyMission.description}
            </p>
            <div>
              <div className="flex justify-between text-xs font-bold text-on-surface-bark mb-1">
                <span>Aktivitas Selesai</span>
                <span>
                  {dailyMission.completedTasks}/{dailyMission.targetTasks} Tugas • {dailyMission.xpToday} XP
                </span>
              </div>
              <div className="h-3 rounded-full bg-surface-container overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full bg-tertiary-gold transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((dailyMission.completedTasks / dailyMission.targetTasks) * 100))}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <Link to="/map" className="btn-foliage py-2.5 text-center text-xs">
            Selesaikan Misi di Peta
          </Link>
        </article>

        {/* Card 3: Daily Regional Phrase */}
        {dailyPhrase && (
          <article className="storybook-card p-5 space-y-3 relative overflow-hidden flex flex-col justify-between">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-secondary-terracotta via-tertiary-gold to-primary-olive" />
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-terracotta">
                  Frasa Daerah Hari Ini
                </span>
                <span className="px-2 py-0.5 rounded-full bg-surface-container text-[11px] font-bold text-on-surface-bark">
                  {dailyPhrase.language_name}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-surface-low flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-xl font-bold text-on-surface">
                    "{dailyPhrase.regional_phrase}"
                  </p>
                  <p className="text-xs font-semibold text-primary mt-0.5">
                    Arti: "{dailyPhrase.indonesian_meaning}"
                  </p>
                  <p className="text-[11px] text-on-surface-variant font-mono mt-1">
                    {dailyPhrase.pronunciation}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    speakPhrase(dailyPhrase.regional_phrase, {
                      onStart: () => setSpeakingId(true),
                      onEnd: () => setSpeakingId(false),
                    })
                  }
                  aria-label={`Dengarkan pelafalan ${dailyPhrase.regional_phrase}`}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 ${
                    speakingId
                      ? 'bg-secondary-terracotta text-white'
                      : 'bg-tertiary-fixed text-on-tertiary-fixed hover:bg-tertiary-gold'
                  }`}
                >
                  <Volume2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSavePhrase}
                className="btn-parchment flex-1 py-2 text-xs inline-flex items-center justify-center gap-1.5"
              >
                {phraseSaved ? (
                  <>
                    <BookmarkCheck className="w-4 h-4 text-primary" /> Tersimpan
                  </>
                ) : (
                  <>
                    <Bookmark className="w-4 h-4" /> Simpan Frasa
                  </>
                )}
              </button>
              <Link to="/daily-phrase" className="btn-foliage px-4 py-2 text-xs">
                Detail
              </Link>
            </div>
          </article>
        )}
      </div>

      {/* Recent Achievements Strip */}
      <section className="storybook-card p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-tertiary-gold" />
            <h3 className="font-display text-xl font-bold text-primary">
              Pencapaian & Lencana Terbaru ({recentAchievements.length}/{data.totalAchievementsCount})
            </h3>
          </div>
          <Link to="/profile" className="text-xs font-bold text-secondary-terracotta hover:underline">
            Lihat Semua di Profil →
          </Link>
        </div>

        {recentAchievements.length === 0 ? (
          <div className="p-5 rounded-2xl bg-surface-low text-center text-sm text-on-surface-variant">
            Belum ada lencana yang terbuka. Selesaikan Level 1 di <strong>Balai Desa</strong> untuk meraih lencana pertamamu: <strong>Penjelajah Nusantara</strong>!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {recentAchievements.map((ach) => (
              <div
                key={ach.id}
                className="p-3.5 rounded-2xl bg-surface-low border border-on-surface-bark/10 flex items-center gap-3"
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: ach.badge_color || '#4C6444' }}
                >
                  <Award className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold text-sm text-on-surface truncate">{ach.title}</p>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2">{ach.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Native <dialog> Interactive Village Location Modal */}
      <StorybookDialog
        open={Boolean(selectedLoc)}
        onClose={() => setSelectedLoc(null)}
        title={selectedLoc ? `${selectedLoc.name} • Level ${selectedLoc.levelNumber}` : 'Lokasi Kampung'}
      >
        {selectedLoc && (
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
              Misi Budaya: {selectedLoc.subtitle}
            </p>
            <p className="text-sm text-on-surface-variant leading-relaxed">{selectedLoc.description}</p>

            {selectedLoc.status === 'locked' ? (
              <div className="p-3.5 rounded-2xl bg-error-container text-on-error-container text-sm font-semibold flex items-start gap-2">
                <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                <span>
                  Lokasi ini masih terkunci! Selesaikan Level {selectedLoc.levelNumber - 1} terlebih dahulu agar Tara bisa menuju {selectedLoc.name}.
                </span>
              </div>
            ) : (
              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLoc(null)}
                  className="btn-parchment px-5 py-2.5 text-sm"
                >
                  Tutup
                </button>
                {selectedLoc.levelId && (
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedLoc.levelId;
                      setSelectedLoc(null);
                      navigate(`/level/${id}`);
                    }}
                    className="btn-adventure px-6 py-2.5 text-sm inline-flex items-center gap-2"
                  >
                    <span>Mulai Misi di {selectedLoc.name}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </StorybookDialog>
    </div>
  );
}
