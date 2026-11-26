import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Mic,
  Headphones,
  BookText,
  PenTool,
  CheckCircle2,
  Lock,
  Sparkles,
  Footprints,
  AlertCircle,
} from 'lucide-react';
import { apiRequest, ApiError } from '../../services/api/client';
import { useAuth } from '../../contexts/AuthContext';
import { LearningModuleView } from '../../components/learning/LearningModuleView';
import { SpeakingGame } from '../../components/game/SpeakingGame';
import { ListeningGame } from '../../components/game/ListeningGame';
import { ReadingGame } from '../../components/game/ReadingGame';
import { WritingGame } from '../../components/game/WritingGame';
import type { GameActivity, LearningModule } from '../../types';

type TabKey = 'module' | 'speaking' | 'listening' | 'reading' | 'writing';

interface LevelDetailResponse {
  level: {
    id: number;
    language_id: number;
    level_number: number;
    title: string;
    location_name: string;
    description: string;
    xp_reward: number;
    star_reward: number;
    language_name: string;
    province_name: string;
  };
  progress: {
    status: string;
    module_completed: boolean;
    speaking_completed: boolean;
    listening_completed: boolean;
    reading_completed: boolean;
    writing_completed: boolean;
    stars_earned: number;
    xp_earned: number;
  };
  module: LearningModule | null;
  activities: GameActivity[];
}

export function LevelPlayPage() {
  const { levelId } = useParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const [data, setData] = useState<LevelDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [lockedError, setLockedError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('module');
  const [completingLevel, setCompletingLevel] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);

  const loadLevel = useCallback(async () => {
    if (!levelId) return;
    setLoading(true);
    setLockedError(null);
    try {
      const res = await apiRequest<LevelDetailResponse>(`/levels/${levelId}`);
      setData(res);
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 403) {
        setLockedError(err.message);
      } else {
        setLockedError(err?.message || 'Gagal memuat data level.');
      }
    } finally {
      setLoading(false);
    }
  }, [levelId]);

  useEffect(() => {
    loadLevel();
  }, [loadLevel]);

  const handleCompleteModule = async () => {
    if (!levelId) return;
    const res = await apiRequest<{ message: string }>(`/levels/${levelId}/module-complete`, {
      method: 'POST',
    });
    setBannerMsg(res.message);
    setData((prev) =>
      prev ? { ...prev, progress: { ...prev.progress, module_completed: true } } : prev
    );
    await refreshUser();
    setActiveTab('speaking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitActivity = async (
    activityType: 'speaking' | 'listening' | 'reading' | 'writing',
    answers: Array<{ questionId: number; answer: string; evaluationMode: string }>
  ) => {
    const res = await apiRequest(`/levels/${levelId}/activities/${activityType}/submit`, {
      method: 'POST',
      body: JSON.stringify({ answers }),
    });
    if (res.progress) {
      setData((prev) => (prev ? { ...prev, progress: { ...prev.progress, ...res.progress } } : prev));
    }
    await refreshUser();
    return res;
  };

  const handleFinishLevelAndWalk = async () => {
    if (!levelId) return;
    setCompletingLevel(true);
    setBannerMsg(null);
    try {
      const res = await apiRequest<any>(`/levels/${levelId}/complete`, {
        method: 'POST',
      });
      await refreshUser();
      // Navigate immediately to Adventure Map so Tara visibly walks along the path to the next level!
      navigate('/map', {
        state: {
          walkFromLevel: res.walkFromLevel,
          walkToLevel: res.walkToLevel,
          xpAwarded: res.xpAwarded,
          starsAwarded: res.starsAwarded,
          newAchievements: res.newAchievements || [],
          celebrationTitle: res.celebrationTitle,
          celebrationSubtitle: res.celebrationSubtitle,
          replayMode: res.replayMode,
        },
      });
    } catch (err: any) {
      setBannerMsg(err?.message || 'Belum dapat menuntaskan level.');
    } finally {
      setCompletingLevel(false);
    }
  };

  if (loading) {
    return (
      <div className="storybook-card p-14 text-center text-on-surface-variant">
        Menyiapkan modul belajar dan tantangan di Kampung Nusantara...
      </div>
    );
  }

  if (lockedError || !data) {
    return (
      <div className="storybook-card p-8 sm:p-12 text-center space-y-4 max-w-xl mx-auto">
        <div className="w-16 h-16 rounded-full bg-error-container text-on-error-container flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8" />
        </div>
        <h1 className="font-display text-2xl font-bold text-primary">Akses Level Terkunci</h1>
        <p className="text-sm text-on-surface-variant">{lockedError}</p>
        <Link to="/map" className="btn-adventure px-6 py-3 text-sm inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Peta Petualangan
        </Link>
      </div>
    );
  }

  const { level, progress, module, activities } = data;
  const allGamesCompleted =
    progress.speaking_completed &&
    progress.listening_completed &&
    progress.reading_completed &&
    progress.writing_completed;

  const findAct = (type: GameActivity['activity_type']) =>
    activities.find((a) => a.activity_type === type);

  const tabs: Array<{ key: TabKey; label: string; icon: any; done: boolean }> = [
    { key: 'module', label: 'Modul Belajar', icon: BookOpen, done: progress.module_completed },
    { key: 'speaking', label: 'Berbicara', icon: Mic, done: progress.speaking_completed },
    { key: 'listening', label: 'Mendengarkan', icon: Headphones, done: progress.listening_completed },
    { key: 'reading', label: 'Membaca', icon: BookText, done: progress.reading_completed },
    { key: 'writing', label: 'Menulis', icon: PenTool, done: progress.writing_completed },
  ];

  return (
    <div className="space-y-6">
      {/* Top Level Header */}
      <section className="storybook-card p-5 sm:p-6 batik-watermark flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <Link
            to="/map"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-on-surface-variant hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Peta Kampung Nusantara
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-secondary-terracotta text-white text-xs font-bold">
              Level {level.level_number} • {level.location_name}
            </span>
            <span className="px-3 py-1 rounded-full bg-primary-fixed text-primary text-xs font-bold">
              {level.language_name} ({level.province_name})
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-primary">
            {level.title}
          </h1>
        </div>

        {/* Ready to Complete Level & Walk Tara CTA */}
        <div className="flex flex-col sm:items-end gap-2">
          {allGamesCompleted ? (
            <button
              type="button"
              disabled={completingLevel}
              onClick={handleFinishLevelAndWalk}
              className="btn-adventure px-6 py-3.5 text-sm sm:text-base inline-flex items-center gap-2 shadow-tactile-terracotta"
            >
              <Footprints className="w-5 h-5" />
              <span>
                {completingLevel
                  ? 'Membuka Level Berikutnya...'
                  : `Tuntaskan Level ${level.level_number} & Jalankan Tara!`}
              </span>
            </button>
          ) : (
            <div className="px-4 py-2.5 rounded-2xl bg-surface-low border border-on-surface-bark/10 text-xs font-semibold text-on-surface-bark flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-tertiary-gold shrink-0" />
              <span>
                Selesaikan keempat mode game (Berbicara, Mendengarkan, Membaca, Menulis) untuk membuka Level {level.level_number + 1}!
              </span>
            </div>
          )}
        </div>
      </section>

      {bannerMsg && (
        <div className="p-3.5 rounded-2xl bg-primary-fixed/60 text-primary text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{bannerMsg}</span>
        </div>
      )}

      {/* 5-Step Interactive Activity Stepper */}
      <nav aria-label="Tahapan Belajar Level" className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`p-3 rounded-2xl border-2 text-left transition-all flex items-center justify-between gap-2 ${
                active
                  ? 'bg-primary text-on-primary border-primary-canopy shadow-md'
                  : tab.done
                    ? 'bg-primary-fixed/50 text-primary border-primary/25 hover:bg-primary-fixed/80'
                    : 'bg-surface-ivory text-on-surface-bark border-on-surface-bark/12 hover:bg-surface-low'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="font-display font-bold text-xs sm:text-sm truncate">
                  {tab.label}
                </span>
              </div>
              {tab.done && (
                <CheckCircle2
                  className={`w-4 h-4 shrink-0 ${active ? 'text-tertiary-gold' : 'text-primary'}`}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Active Activity Stage */}
      <div>
        {activeTab === 'module' && module && (
          <LearningModuleView
            module={module}
            languageId={level.language_id}
            languageName={level.language_name}
            completed={progress.module_completed}
            onCompleteModule={handleCompleteModule}
          />
        )}

        {activeTab === 'speaking' && findAct('speaking') && (
          <SpeakingGame
            activity={findAct('speaking')!}
            languageName={level.language_name}
            onSubmitActivity={(ans) => handleSubmitActivity('speaking', ans)}
            onNextTab={() => {
              setActiveTab('listening');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'listening' && findAct('listening') && (
          <ListeningGame
            activity={findAct('listening')!}
            onSubmitActivity={(ans) => handleSubmitActivity('listening', ans)}
            onNextTab={() => {
              setActiveTab('reading');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'reading' && findAct('reading') && (
          <ReadingGame
            activity={findAct('reading')!}
            onSubmitActivity={(ans) => handleSubmitActivity('reading', ans)}
            onNextTab={() => {
              setActiveTab('writing');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {activeTab === 'writing' && findAct('writing') && (
          <WritingGame
            activity={findAct('writing')!}
            onSubmitActivity={(ans) => handleSubmitActivity('writing', ans)}
            onAllGamesReady={() => {
              if (allGamesCompleted) {
                handleFinishLevelAndWalk();
              } else {
                // Jump to whichever game is not yet done
                if (!progress.speaking_completed) setActiveTab('speaking');
                else if (!progress.listening_completed) setActiveTab('listening');
                else if (!progress.reading_completed) setActiveTab('reading');
                else handleFinishLevelAndWalk();
              }
            }}
          />
        )}
      </div>

      {/* Bottom Sticky Completion Callout when all 4 games are passed */}
      {allGamesCompleted && (
        <section className="storybook-card p-6 bg-gradient-to-r from-primary to-primary-olive text-white flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <img
              src="/assets/characters/tara-sprite.png"
              alt="Tara siap melangkah"
              width={542}
              height={883}
              className="w-16 h-auto object-contain tara-idle shrink-0"
            />
            <div>
              <h3 className="font-display text-xl font-bold">
                Semua Tantangan Level {level.level_number} Telah Tuntas!
              </h3>
              <p className="text-xs sm:text-sm text-on-primary-container">
                Klik tombol di samping untuk mengklaim +{level.xp_reward} XP & {level.star_reward} Bintang lalu saksikan Tara berjalan menuju Level {Math.min(7, level.level_number + 1)}!
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={completingLevel}
            onClick={handleFinishLevelAndWalk}
            className="btn-adventure px-7 py-3.5 text-sm sm:text-base inline-flex items-center gap-2 shrink-0"
          >
            <Footprints className="w-5 h-5" />
            <span>{completingLevel ? 'Menyimpan...' : 'Klaim & Jalankan Tara!'}</span>
          </button>
        </section>
      )}
    </div>
  );
}
