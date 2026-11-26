import React, { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Map,
  Star,
  Zap,
  Lock,
  Play,
  CheckCircle2,
  Sparkles,
  Footprints,
  Award,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { apiRequest } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import { AdventureMapStage } from '../../components/game/AdventureMapStage';
import { StorybookDialog } from '../../components/common/StorybookDialog';
import type { AdventureLevel, Achievement, RegionalLanguage } from '../../types';

interface MapApiResponse {
  activeLanguage: RegionalLanguage | null;
  verifiedLanguages: Array<{ id: number; language_name: string; province_name: string }>;
  taraPosition: {
    currentLevelNumber: number;
    pendingWalkFrom: number | null;
    pendingWalkTo: number | null;
  };
  stats: {
    totalXp: number;
    totalStars: number;
    dailyStreak: number;
  };
  levels: AdventureLevel[];
}

interface CelebrationState {
  open: boolean;
  unlockedLevel: number;
  title: string;
  subtitle: string;
  xpAwarded: number;
  starsAwarded: number;
  newAchievements: Achievement[];
  replayMode?: boolean;
}

export function AdventureMapPage() {
  const { refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = (location.state || {}) as {
    walkFromLevel?: number;
    walkToLevel?: number;
    xpAwarded?: number;
    starsAwarded?: number;
    newAchievements?: Achievement[];
    celebrationTitle?: string;
    celebrationSubtitle?: string;
    replayMode?: boolean;
  };

  const [mapData, setMapData] = useState<MapApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLevel, setSelectedLevel] = useState<AdventureLevel | null>(null);
  const [lockedNotice, setLockedNotice] = useState<string | null>(null);
  const [walkTrigger, setWalkTrigger] = useState<{ from: number; to: number; key: number } | null>(null);
  const [celebration, setCelebration] = useState<CelebrationState>({
    open: false,
    unlockedLevel: 2,
    title: '',
    subtitle: '',
    xpAwarded: 0,
    starsAwarded: 0,
    newAchievements: [],
  });

  const loadMap = useCallback(async (languageId?: number) => {
    setLoading(true);
    try {
      const url = languageId ? `/adventure/map?languageId=${languageId}` : '/adventure/map';
      const data = await apiRequest<MapApiResponse>(url);
      setMapData(data);

      // Trigger Tara's real walking animation if returning from a completed level or persisted pending walk
      const from = navState.walkFromLevel || data.taraPosition.pendingWalkFrom;
      const to = navState.walkToLevel || data.taraPosition.pendingWalkTo;

      if (from && to && to === from + 1) {
        setWalkTrigger({ from, to, key: Date.now() });
      }
    } finally {
      setLoading(false);
    }
  }, [navState.walkFromLevel, navState.walkToLevel]);

  useEffect(() => {
    loadMap();
  }, [loadMap]);

  const handleWalkComplete = useCallback(
    async (fromLevel: number, toLevel: number) => {
      try {
        await apiRequest('/adventure/walk-ack', { method: 'POST' });
        await refreshUser();
      } catch {
        // Non-blocking ack
      }

      setCelebration({
        open: true,
        unlockedLevel: toLevel,
        title: navState.celebrationTitle || `Selamat! Level ${toLevel} berhasil dibuka!`,
        subtitle:
          navState.celebrationSubtitle || 'Petualanganmu di Kampung Nusantara berlanjut!',
        xpAwarded: navState.xpAwarded ?? 100,
        starsAwarded: navState.starsAwarded ?? 3,
        newAchievements: navState.newAchievements || [],
        replayMode: navState.replayMode,
      });

      // Clear router navigation state so refresh doesn't re-trigger old navState
      navigate('/map', { replace: true, state: {} });
    },
    [navState, navigate, refreshUser]
  );

  const handleSwitchLanguage = async (langId: number) => {
    await apiRequest('/profile/active-language', {
      method: 'PUT',
      body: JSON.stringify({ languageId: langId }),
    });
    await refreshUser();
    setWalkTrigger(null);
    await loadMap(langId);
  };

  const handleSelectLevel = (lv: AdventureLevel) => {
    if (lv.status === 'locked') {
      setLockedNotice(
        `Level ${lv.level_number} (${lv.title}) masih terkunci! Selesaikan Level ${lv.level_number - 1} terlebih dahulu agar Tara dapat berjalan ke lokasi ini.`
      );
      setSelectedLevel(lv);
      return;
    }
    setLockedNotice(null);
    setSelectedLevel(lv);
  };

  // Allow users to replay Tara's walk animation along any segment they have ALREADY genuinely unlocked!
  const handleReplayUnlockedWalk = () => {
    if (!mapData) return;
    const highest = mapData.taraPosition.currentLevelNumber;
    if (highest < 2) return;
    setWalkTrigger({ from: highest - 1, to: highest, key: Date.now() });
  };

  const nextUnlockedLevelObj = mapData?.levels.find(
    (l) => l.level_number === celebration.unlockedLevel
  );

  return (
    <div className="space-y-6">
      {/* Storybook Header */}
      <section className="storybook-card p-5 sm:p-7 batik-watermark flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-wide">
              <Map className="w-3.5 h-3.5" />
              Peta Petualangan Kampung Nusantara
            </span>
            {mapData?.activeLanguage && (
              <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold">
                {mapData.activeLanguage.province_name}
              </span>
            )}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-primary">
            Jejak Bahasa {mapData?.activeLanguage?.language_name || 'Nusantara'}
          </h1>
          <p className="text-sm text-on-surface-variant mt-1 max-w-2xl">
            Tuntaskan modul belajar dan keempat permainan di setiap level untuk membuka jalur berikutnya dan menyaksikan Tara berjalan melintasi Kampung Nusantara!
          </p>
        </div>

        {/* Language Quick Switcher (8 Verified Full-Curriculum Languages) */}
        {mapData && (
          <div className="flex flex-col sm:items-end gap-2">
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">
              Pilih Bahasa Kurikulum Penuh:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {mapData.verifiedLanguages.map((vl) => {
                const isCurrent = mapData.activeLanguage?.id === vl.id;
                return (
                  <button
                    key={vl.id}
                    type="button"
                    onClick={() => handleSwitchLanguage(vl.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface-container text-on-surface-bark hover:bg-surface-high'
                    }`}
                  >
                    {vl.language_name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <div className="storybook-card p-14 text-center text-on-surface-variant">
          Menyiapkan Peta Kampung Nusantara bersama Tara...
        </div>
      ) : !mapData?.activeLanguage?.has_full_curriculum ? (
        <div className="storybook-card p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-secondary-terracotta mx-auto" />
          <h2 className="font-display text-2xl font-bold text-primary">
            Kurikulum 7 Level untuk {mapData?.activeLanguage?.language_name} Sedang Diverifikasi
          </h2>
          <p className="text-sm text-on-surface-variant max-w-xl mx-auto">
            Kami menjaga keaslian bahasa daerah dan tidak mengarang kosakata yang belum diverifikasi penutur asli. Pilih salah satu dari 8 bahasa daerah terverifikasi di atas untuk mulai bermain di Peta Kampung Nusantara!
          </p>
        </div>
      ) : (
        <>
          {/* Interactive Kampung Nusantara Adventure Map + Walking Tara */}
          <AdventureMapStage
            levels={mapData.levels}
            taraLevelNumber={mapData.taraPosition.currentLevelNumber}
            walkTrigger={walkTrigger}
            onWalkComplete={handleWalkComplete}
            onSelectLevel={handleSelectLevel}
          />

          {/* Replay Tara Walk Strip (only enabled once Level 2+ is genuinely unlocked) */}
          {mapData.taraPosition.currentLevelNumber >= 2 && (
            <div className="storybook-card p-4 flex flex-wrap items-center justify-between gap-3 bg-surface-low">
              <div className="flex items-center gap-2.5 text-sm text-on-surface-bark">
                <Footprints className="w-5 h-5 text-secondary-terracotta shrink-0" />
                <span>
                  Tara kini berada di <strong>Level {mapData.taraPosition.currentLevelNumber}</strong>! Ingin melihat ulang perjalanan Tara menuju level ini?
                </span>
              </div>
              <button
                type="button"
                onClick={handleReplayUnlockedWalk}
                className="btn-parchment px-4 py-2 text-xs inline-flex items-center gap-1.5"
              >
                <Footprints className="w-4 h-4 text-secondary-terracotta" />
                <span>Putar Ulang Langkah Tara</span>
              </button>
            </div>
          )}

          {/* 7-Level Progression Cards List */}
          <section className="space-y-3">
            <h2 className="font-display text-2xl font-bold text-primary">
              Daftar 7 Level Petualangan
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mapData.levels.map((lv) => {
                const isLocked = lv.status === 'locked';
                const isCompleted = lv.status === 'completed';
                const doneCount = [
                  lv.speaking_completed,
                  lv.listening_completed,
                  lv.reading_completed,
                  lv.writing_completed,
                ].filter(Boolean).length;

                return (
                  <article
                    key={lv.id}
                    className={`storybook-card p-5 flex flex-col justify-between gap-4 transition-all ${
                      isLocked ? 'opacity-75 bg-surface-rice/70' : 'hover:shadow-storybook-lg'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            isCompleted
                              ? 'bg-primary-fixed text-primary'
                              : isLocked
                                ? 'bg-surface-container text-on-surface-variant'
                                : 'bg-secondary-fixed text-on-secondary-fixed'
                          }`}
                        >
                          Level {lv.level_number} • {lv.location_name}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-primary">
                          <Zap className="w-3.5 h-3.5 fill-primary" />+{lv.xp_reward} XP
                        </span>
                      </div>

                      <h3 className="font-display text-xl font-bold text-on-surface">{lv.title}</h3>
                      <p className="text-xs text-on-surface-variant leading-relaxed">
                        {lv.description}
                      </p>

                      {!isLocked && (
                        <div className="pt-1">
                          <div className="flex justify-between text-[11px] font-bold text-on-surface-bark mb-1">
                            <span>Progres 4 Mode Game</span>
                            <span>{doneCount}/4 Selesai</span>
                          </div>
                          <div className="h-2 rounded-full bg-surface-container overflow-hidden">
                            <div
                              className="h-full bg-primary-olive rounded-full transition-all"
                              style={{ width: `${(doneCount / 4) * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-on-surface-bark/10">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${
                              s <= lv.stars_earned
                                ? 'text-tertiary-gold fill-tertiary-gold'
                                : 'text-outline-variant/60'
                            }`}
                          />
                        ))}
                      </div>

                      {isLocked ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-outline">
                          <Lock className="w-4 h-4" /> Terkunci
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => navigate(`/level/${lv.id}`)}
                          className={`${
                            isCompleted ? 'btn-foliage' : 'btn-adventure'
                          } px-4 py-2 text-xs inline-flex items-center gap-1.5`}
                        >
                          {isCompleted ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" /> Main Lagi
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" /> Mulai Level
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}

      {/* Native <dialog> Level Preview / Locked Notice */}
      <StorybookDialog
        open={Boolean(selectedLevel)}
        onClose={() => setSelectedLevel(null)}
        title={
          selectedLevel
            ? `Level ${selectedLevel.level_number}: ${selectedLevel.title}`
            : 'Detail Level'
        }
      >
        {selectedLevel && (
          <div className="space-y-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container text-xs font-bold text-on-surface-bark">
              Lokasi Kampung: {selectedLevel.location_name}
            </div>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              {selectedLevel.description}
            </p>

            {lockedNotice ? (
              <div className="p-4 rounded-2xl bg-error-container text-on-error-container text-sm font-semibold flex items-start gap-2.5">
                <Lock className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{lockedNotice}</span>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="p-3 rounded-2xl bg-surface-low flex items-center justify-between">
                    <span className="font-semibold">Berbicara</span>
                    <span className="font-bold text-primary">
                      {selectedLevel.speaking_completed ? '✓ Selesai' : 'Siap'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-low flex items-center justify-between">
                    <span className="font-semibold">Mendengarkan</span>
                    <span className="font-bold text-primary">
                      {selectedLevel.listening_completed ? '✓ Selesai' : 'Siap'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-low flex items-center justify-between">
                    <span className="font-semibold">Membaca</span>
                    <span className="font-bold text-primary">
                      {selectedLevel.reading_completed ? '✓ Selesai' : 'Siap'}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-low flex items-center justify-between">
                    <span className="font-semibold">Menulis</span>
                    <span className="font-bold text-primary">
                      {selectedLevel.writing_completed ? '✓ Selesai' : 'Siap'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedLevel(null)}
                    className="btn-parchment px-5 py-2.5 text-sm"
                  >
                    Tutup
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const id = selectedLevel.id;
                      setSelectedLevel(null);
                      navigate(`/level/${id}`);
                    }}
                    className="btn-adventure px-6 py-2.5 text-sm inline-flex items-center gap-2"
                  >
                    <span>Masuk Modul & Game</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </StorybookDialog>

      {/* Native <dialog> Level Unlock Celebration Modal (Exact Section 08 Messages!) */}
      <StorybookDialog
        open={celebration.open}
        onClose={() => setCelebration((c) => ({ ...c, open: false }))}
        title={celebration.title || `Selamat! Level ${celebration.unlockedLevel} berhasil dibuka!`}
      >
        <div className="text-center space-y-5">
          <div className="flex justify-center items-center gap-4">
            <img
              src="/assets/characters/tara-sprite.png"
              alt="Tara merayakan keberhasilanmu"
              width={542}
              height={883}
              className="w-24 h-auto object-contain drop-shadow-lg tara-celebrating"
            />
          </div>

          <div className="space-y-1">
            <p className="font-display font-bold text-lg text-secondary-terracotta">
              {celebration.subtitle || 'Petualanganmu di Kampung Nusantara berlanjut!'}
            </p>
            {celebration.replayMode && (
              <p className="text-xs text-on-surface-variant">
                Mode Latihan Ulang: Hadiah XP level ini sudah tercatat sebelumnya (anti-duplikat).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-primary-fixed/60 border border-primary/15">
              <Zap className="w-6 h-6 text-primary fill-primary mx-auto mb-1" />
              <p className="font-display text-xl font-bold text-primary">
                +{celebration.xpAwarded} XP
              </p>
              <p className="text-[11px] font-semibold text-on-surface-variant">Hadiah Petualang</p>
            </div>
            <div className="p-3.5 rounded-2xl bg-tertiary-fixed/70 border border-tertiary-gold/30">
              <Star className="w-6 h-6 text-tertiary-gold fill-tertiary-gold mx-auto mb-1" />
              <p className="font-display text-xl font-bold text-on-tertiary-fixed">
                +{celebration.starsAwarded} Bintang
              </p>
              <p className="text-[11px] font-semibold text-on-surface-variant">Pencapaian Level</p>
            </div>
          </div>

          {celebration.newAchievements.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-surface-low border border-secondary-terracotta/20 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-secondary-terracotta uppercase">
                <Award className="w-4 h-4" /> Lencana Baru Terbuka!
              </div>
              {celebration.newAchievements.map((ach) => (
                <p key={ach.id} className="text-sm font-bold text-on-surface flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-tertiary-gold shrink-0" />
                  {ach.title} (+{ach.xp_bonus} XP)
                </p>
              ))}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setCelebration((c) => ({ ...c, open: false }))}
              className="btn-parchment flex-1 py-3 text-sm"
            >
              Lihat Peta
            </button>
            {nextUnlockedLevelObj && (
              <button
                type="button"
                onClick={() => {
                  setCelebration((c) => ({ ...c, open: false }));
                  navigate(`/level/${nextUnlockedLevelObj.id}`);
                }}
                className="btn-adventure flex-1 py-3 text-sm inline-flex items-center justify-center gap-1.5"
              >
                <span>Buka Level {nextUnlockedLevelObj.level_number}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </StorybookDialog>
    </div>
  );
}
