import React from 'react';
import { NavLink, Link, useNavigate } from 'react-router-dom';
import {
  Compass,
  Languages,
  Bot,
  Sparkles,
  User,
  Flame,
  Star,
  Zap,
  Map,
  Globe2,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { FloatingChatbot } from '../chatbot/FloatingChatbot';
import { assetUrl } from '../../utils/assets';

const DESKTOP_NAV = [
  { to: '/dashboard', label: 'Game', icon: Compass },
  { to: '/map', label: 'Peta', icon: Map },
  { to: '/translate', label: 'Translate', icon: Languages },
  { to: '/chatbot', label: 'Chatbot AI', icon: Bot },
  { to: '/daily-phrase', label: 'Frasa Harian', icon: Sparkles },
  { to: '/provinces', label: '38 Provinsi', icon: Globe2 },
  { to: '/profile', label: 'Profile', icon: User },
];

const MOBILE_NAV = [
  { to: '/dashboard', label: 'Game', icon: Compass },
  { to: '/translate', label: 'Translate', icon: Languages },
  { to: '/chatbot', label: 'Chatbot AI', icon: Bot },
  { to: '/daily-phrase', label: 'Frasa', icon: Sparkles },
  { to: '/profile', label: 'Profile', icon: User },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface-parchment text-on-surface flex flex-col">
      {/* Sticky Top Storybook Header */}
      <header className="sticky top-0 z-40 bg-surface-ivory/90 backdrop-blur-xl border-b border-on-surface-bark/10 shadow-storybook-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo + Active Language Pill */}
          <div className="flex items-center gap-3 min-w-0">
            <Link to="/dashboard" className="flex items-center gap-2 shrink-0 group">
              <img
                src={assetUrl('/assets/icons/logatara-logo.svg')}
                alt="LOGATARA"
                width={156}
                height={39}
                className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]"
              />
            </Link>

            {user?.current_language && (
              <Link
                to="/map"
                className="hidden xl:inline-flex items-center gap-1.5 bg-surface-low hover:bg-surface-container px-3 py-1 rounded-full border border-on-surface-bark/10 transition-colors"
                title="Bahasa belajar aktif"
              >
                <span className="w-2 h-2 rounded-full bg-secondary-terracotta" />
                <span className="text-xs font-bold text-primary truncate max-w-[130px]">
                  {user.current_language.language_name}
                </span>
              </Link>
            )}
          </div>

          {/* Desktop Navigation */}
          <nav aria-label="Navigasi Utama" className="hidden lg:flex items-center gap-1">
            {DESKTOP_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface-bark hover:bg-surface-container/80 hover:text-on-surface'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Gamification Stats & Avatar */}
          {user && (
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div
                className="flex items-center gap-1 bg-surface-ivory px-2.5 py-1 rounded-full border border-on-surface-bark/10 shadow-xs"
                title="Runtun harian"
              >
                <Flame className="w-4 h-4 text-secondary-terracotta fill-secondary-terracotta" />
                <span className="text-xs font-bold">{user.daily_streak || 1}</span>
              </div>
              <div
                className="hidden sm:flex items-center gap-1 bg-surface-ivory px-2.5 py-1 rounded-full border border-on-surface-bark/10 shadow-xs"
                title="Total Bintang"
              >
                <Star className="w-4 h-4 text-tertiary-gold fill-tertiary-gold" />
                <span className="text-xs font-bold">{user.total_stars || 0}</span>
              </div>
              <div
                className="flex items-center gap-1 bg-primary-fixed/80 px-2.5 py-1 rounded-full border border-primary/15"
                title="Total XP"
              >
                <Zap className="w-3.5 h-3.5 text-primary fill-primary" />
                <span className="text-xs font-bold text-primary">{user.total_xp || 0} XP</span>
              </div>

              <Link
                to="/profile"
                className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary-olive/40 bg-surface-ivory hover:border-secondary-terracotta transition-colors"
                title={user.full_name}
              >
                <img
                  src={assetUrl(user.avatar_url || '/assets/characters/tara.png')}
                  alt={`Profil ${user.full_name}`}
                  width={36}
                  height={36}
                  className="w-full h-full object-cover"
                />
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                title="Keluar"
                aria-label="Keluar dari akun"
                className="hidden sm:flex p-2 rounded-full text-on-surface-bark hover:bg-error-container hover:text-on-error-container transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-28 lg:pb-14">
        {children}
      </main>

      {/* Persistent Bottom-Right Floating LOGATARA AI Chatbot */}
      <FloatingChatbot />

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi Seluler"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-ivory/95 backdrop-blur-xl border-t border-on-surface-bark/10 shadow-[0_-4px_16px_rgba(92,67,49,0.08)]"
      >
        <div className="max-w-lg mx-auto px-2 h-18 py-1.5 flex items-center justify-around">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center min-w-[58px] py-1.5 px-2 rounded-2xl transition-colors ${
                    isActive
                      ? 'bg-primary text-on-primary font-bold shadow-sm'
                      : 'text-on-surface-bark hover:text-primary'
                  }`
                }
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] mt-0.5 leading-none">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
