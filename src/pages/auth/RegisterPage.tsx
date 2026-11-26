import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, AlertCircle, Sparkles, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDeferredFormValidation } from '../../hooks/useDeferredFormValidation';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const formRef = useDeferredFormValidation();

  const [fullName, setFullName] = useState('');
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
      await register(fullName.trim(), email.trim(), password);
      navigate('/onboarding', { replace: true });
    } catch (err: any) {
      setServerError(err?.message || 'Gagal membuat akun. Periksa kembali data yang kamu masukkan.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-parchment batik-watermark flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Storybook Hero Panel */}
        <section className="lg:col-span-6 relative rounded-[2rem] overflow-hidden shadow-storybook-lg bg-primary text-on-primary flex flex-col justify-between min-h-[300px] lg:min-h-[600px]">
          <img
            src="/assets/environments/kampung-nusantara.png"
            alt="Diorama 3D Kampung Nusantara"
            width={1376}
            height={768}
            fetchPriority="high"
            className="absolute inset-0 w-full h-full object-cover opacity-90"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary-canopy via-primary-canopy/45 to-transparent" />

          <div className="relative z-10 p-6 flex items-center justify-between">
            <div className="bg-surface-ivory/95 backdrop-blur-md px-3.5 py-2 rounded-full shadow-md">
              <img
                src="/assets/icons/logatara-logo.svg"
                alt="LOGATARA"
                width={140}
                height={35}
                className="h-8 w-auto"
              />
            </div>
            <span className="px-3 py-1 rounded-full bg-tertiary-gold text-on-tertiary-fixed font-display font-bold text-xs shadow-sm">
              38 Provinsi Nusantara
            </span>
          </div>

          <div className="relative z-10 p-6 sm:p-8 flex items-end justify-between gap-4">
            <div className="max-w-sm">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5 text-tertiary-gold" />
                <span>Petualangan Bahasa Daerah</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight text-white">
                Mulai Petualangan di Kampung Nusantara!
              </h1>
              <p className="text-sm sm:text-base text-surface-low/95 mt-2 leading-relaxed">
                "Jelajahi Bahasa, Hidupkan Budaya, Satukan Nusantara." Belajar bersama Tara melalui permainan interaktif.
              </p>
            </div>
            <img
              src="/assets/characters/tara-sprite.png"
              alt="Tara, Penjelajah Budaya LOGATARA"
              width={542}
              height={883}
              className="hidden sm:block w-28 md:w-32 h-auto object-contain drop-shadow-xl tara-idle shrink-0"
            />
          </div>
        </section>

        {/* Right Sign-Up Form Panel */}
        <section className="lg:col-span-6 storybook-card p-6 sm:p-9 flex flex-col justify-center">
          <div className="mb-6">
            <span className="text-xs font-bold uppercase tracking-wider text-secondary-terracotta">
              Langkah 1 dari 2 • Akun Explorer
            </span>
            <h2 className="font-display text-3xl font-bold text-primary mt-1">
              Daftar Akun LOGATARA
            </h2>
            <p className="text-sm text-on-surface-variant mt-1">
              Buat akun gratis untuk menyimpan progres petualangan, XP, bintang, dan kamus saku daerahmu.
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
            {/* Single Full Name Input (autocomplete="name") */}
            <div className="field-group">
              <label htmlFor="register-full-name" className="block text-sm font-bold text-on-surface mb-1">
                Nama Lengkap
              </label>
              <span id="name-hint" className="block text-xs text-on-surface-variant mb-1.5">
                Nama panggilan atau nama lengkapmu sebagai Explorer Kampung Nusantara.
              </span>
              <input
                id="register-full-name"
                name="full-name"
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                required
                minLength={2}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-describedby="name-hint"
                data-error="name-error"
                placeholder="Contoh: Bima Nusantara"
                className="logatara-input w-full px-4 py-3 text-base"
              />
              <div id="name-error" className="field-error-msg">
                <span role="img" aria-label="Error">⚠️</span>
                Masukkan nama lengkap minimal 2 karakter.
              </div>
            </div>

            {/* Email Input (type="email", autocomplete="username", spellCheck=false) */}
            <div className="field-group">
              <label htmlFor="register-email" className="block text-sm font-bold text-on-surface mb-1">
                Email
              </label>
              <span id="email-hint" className="block text-xs text-on-surface-variant mb-1.5">
                Format: kamu@contoh.com
              </span>
              <input
                id="register-email"
                name="email"
                type="email"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="next"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby="email-hint"
                data-error="email-error"
                placeholder="bima@nusantara.id"
                className="logatara-input w-full px-4 py-3 text-base"
              />
              <div id="email-error" className="field-error-msg">
                <span role="img" aria-label="Error">⚠️</span>
                Masukkan alamat email yang valid dengan format kamu@contoh.com.
              </div>
            </div>

            {/* Password Input (autocomplete="new-password", rules placed ABOVE input) */}
            <div className="field-group">
              <label htmlFor="register-password" className="block text-sm font-bold text-on-surface mb-1">
                Kata Sandi
              </label>
              <p id="password-rules" className="field-rules-list text-xs text-on-surface-variant mb-1.5">
                Minimal 8 karakter (disarankan kombinasi huruf dan angka).
              </p>
              <div className="relative">
                <input
                  id="register-password"
                  name="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  enterKeyHint="done"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-describedby="password-rules"
                  data-error="password-error"
                  placeholder="Minimal 8 karakter"
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
              <div id="password-error" className="field-error-msg">
                <span role="img" aria-label="Error">⚠️</span>
                Kata sandi harus terdiri dari minimal 8 karakter.
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-adventure w-full py-3.5 px-6 text-base flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              <span>{submitting ? 'Membuat Akun...' : 'Buat Akun Explorer'}</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          <p className="text-center text-sm text-on-surface-variant mt-6">
            Sudah punya akun LOGATARA?{' '}
            <Link to="/login" className="font-bold text-secondary-terracotta hover:underline">
              Masuk di sini
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
