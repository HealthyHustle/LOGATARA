import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Compass, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDeferredFormValidation } from '../../hooks/useDeferredFormValidation';
import { assetUrl } from '../../utils/assets';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const formRef = useDeferredFormValidation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setServerError(null);

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = await login(email.trim(), password);
      if (!loggedUser.onboarding_completed) {
        navigate('/onboarding', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: any) {
      setServerError(err?.message || 'Email atau kata sandi tidak cocok.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-parchment batik-watermark flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Diorama Hero */}
        <section className="lg:col-span-6 relative rounded-[2rem] overflow-hidden shadow-storybook-lg bg-primary text-on-primary flex flex-col justify-between min-h-[280px] lg:min-h-[560px]">
          <img
            src={assetUrl('/assets/environments/kampung-nusantara.png')}
            alt="Kampung Nusantara — Dunia Petualangan LOGATARA"
            width={1376}
            height={768}
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-canopy via-primary-canopy/40 to-transparent" />

          <div className="relative z-10 p-6">
            <div className="inline-flex bg-surface-ivory/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md">
              <img
                src={assetUrl('/assets/icons/logatara-logo.svg')}
                alt="LOGATARA"
                width={140}
                height={35}
                className="h-8 w-auto"
              />
            </div>
          </div>

          <div className="relative z-10 p-6 sm:p-8 flex items-end justify-between gap-4">
            <div className="max-w-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3">
                <Compass className="w-3.5 h-3.5 text-tertiary-gold" />
                <span>Selamat Datang Kembali!</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-white">
                Tara Menunggumu di Kampung Nusantara!
              </h1>
              <p className="text-sm sm:text-base text-surface-low/95 mt-2 leading-relaxed">
                "Jelajahi Bahasa, Hidupkan Budaya, Satukan Nusantara."
              </p>
            </div>
            <img
              src={assetUrl('/assets/characters/tara-sprite.png')}
              alt="Karakter Tara LOGATARA"
              width={542}
              height={883}
              className="hidden sm:block w-28 md:w-32 h-auto object-contain drop-shadow-xl tara-idle shrink-0"
            />
          </div>
        </section>

        {/* Right Sign-In Form */}
        <section className="lg:col-span-6 storybook-card p-6 sm:p-9 flex flex-col justify-center">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-olive">
              Masuk Akun Explorer
            </span>
            <h2 className="font-display text-3xl font-bold text-primary mt-1">
              Lanjutkan Petualanganmu
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Masuk dengan email dan kata sandimu untuk melanjutkan level terakhir di peta desa.
            </p>
          </div>

          {serverError && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-error-container text-on-error-container text-sm font-semibold flex items-start gap-2.5"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          <form ref={formRef} onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="field-group">
              <label htmlFor="login-email" className="block text-sm font-bold text-on-surface mb-1">
                Email
              </label>
              <span id="login-email-hint" className="block text-xs text-on-surface-variant mb-1.5">
                Masukkan alamat email akun LOGATARA-mu.
              </span>
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby="login-email-hint"
                data-error="login-email-error"
                placeholder="bima@nusantara.id"
                className="logatara-input w-full px-4 py-3 text-base"
              />
              <div id="login-email-error" className="field-error-msg">
                <span role="img" aria-label="Error">⚠️</span>
                Masukkan alamat email yang valid (contoh: kamu@contoh.com).
              </div>
            </div>

            <div className="field-group">
              <label htmlFor="login-password" className="block text-sm font-bold text-on-surface mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-error="login-password-error"
                  placeholder="Masukkan kata sandimu"
                  className="logatara-input w-full px-4 py-3 pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-on-surface-bark hover:bg-surface-container transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <div id="login-password-error" className="field-error-msg">
                <span role="img" aria-label="Error">⚠️</span>
                Kata sandi wajib diisi.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-adventure w-full py-3.5 px-6 text-base flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              <span>{submitting ? 'Memeriksa Akun...' : 'Masuk ke Kampung Nusantara'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant mt-6">
            Baru pertama kali ke Kampung Nusantara?{' '}
            <Link to="/register" className="font-bold text-secondary-terracotta hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
