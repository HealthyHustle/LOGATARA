# LOGATARA — Indonesian Regional Language Adventure Platform

> **"Jelajahi Bahasa, Hidupkan Budaya, Satukan Nusantara."**

LOGATARA adalah platform petualangan edukatif interaktif berbasis web untuk mengenalkan, mengajarkan, dan melestarikan bahasa daerah serta warisan budaya di seluruh **38 provinsi Indonesia**.

---

## Fitur Utama yang Diimplementasikan

1. **Integrasi Desain & Aset Asli Stitch (`Logatara Storybook Language Redesign`, Project ID `716658888698608172`)**:
   - `public/assets/environments/kampung-nusantara.png` — Diorama 3D Kampung Nusantara (Screen ID `672e8988713444b4a5a6408cca589191`).
   - `public/assets/characters/tara.png` & `public/assets/characters/tara-sprite.png` — Karakter 3D asli Tara (Screen ID `4ba1672b03f74a7dae43de61778a60ab`).
   - `public/assets/maps/adventure-map.png` — Referensi peta petualangan (Screen ID `d3a597ac0fe44f54a074aeef42ec83e2`).
   - `public/assets/icons/logatara-logo.svg` — Logo resmi LOGATARA.
   - Menggunakan palet warna *Warm Storybook Heritage* (`#FDF8EE`, `#4C6444`, `#354C2E`, `#C85A32`, `#F2B842`, `#5C4331`) serta tipografi **Quicksand** & **Plus Jakarta Sans**.

2. **Autentikasi & Language Onboarding**:
   - Registrasi, login, logout, hash kata sandi aman (`crypto.scryptSync` + salt acak per pengguna + `timingSafeEqual`), sesi JWT `HttpOnly` cookie & Bearer token, serta proteksi rute penuh.
   - Onboarding dua bagian: **Bahasa Daerah yang Kamu Kuasai** (multi-pilihan) & **Bahasa Daerah yang Ingin Kamu Pelajari**, lengkap dengan pencarian dan keterkaitan multi-bahasa per provinsi.

3. **Dashboard Kampung Nusantara & Peta Petualangan 7 Level**:
   - 7 lokasi budaya interaktif langsung di atas diorama Kampung Nusantara (*Balai Desa, Rumah Batik, Sanggar Budaya, Pasar Tradisional, Sawah, Rumah Adat, Perpustakaan Nusantara*).
   - **Animasi Tara Berjalan di Jalur Peta (Coordinate-Based Path Animation)**: Saat menyelesaikan level, Tara secara fisik berjalan mengikuti kurva jalur desa (`SVGPathElement.getPointAtLength`) dari koordinat Level `N` ke Level `N+1` lengkap dengan animasi langkah, arah hadap dinamis, jejak debu, jalur emas menyala, suara langkah, lompatan selebrasi, serta dialog pembukaan level (*"Selamat! Level 2 berhasil dibuka! Petualanganmu di Kampung Nusantara berlanjut!"*).
   - Progres tersimpan permanen di database dan tahan terhadap duplikasi XP (*replay-safe*).

4. **Modul Belajar & 4 Mode Game Interaktif**:
   - **Modul Belajar**: Kosakata, terjemahan, pelafalan fonetis, audio, konteks budaya, dan tombol simpan ke Kamus Saku.
   - **Speaking (Berbicara)**: Contoh audio, rekaman mikrofon (`MediaRecorder`), penanganan izin mikrofon, pemutaran ulang rekaman sendiri, dan pelabelan jujur *Evaluasi Pelafalan Mandiri* ketika pengenalan suara otomatis browser tidak mendukung bahasa daerah terkait.
   - **Listening (Mendengarkan)**: Pemutaran audio normal & lambat (`0.7x`), pilihan ganda, umpan balik & skor, serta bantuan teks fonetis jika sintesis suara tidak tersedia.
   - **Reading (Membaca)**: Cerita budaya lokal dengan kosakata daerah tersorot interaktif (klik kata untuk melihat arti & audio) + soal pemahaman.
   - **Writing (Menulis)**: Susun potongan kata menjadi kalimat daerah + latihan terjemahan dengan validasi toleran diakritik.

5. **38 Provinsi Indonesia & Transparansi Data Bahasa**:
   - Mencakup **seluruh 38 provinsi Indonesia** (termasuk Papua Selatan, Papua Tengah, Papua Pegunungan, dan Papua Barat Daya) dengan **78 bahasa daerah** (relasi *many-to-one* per provinsi).
   - **Seluruh 78 bahasa daerah dari 38 provinsi** kini telah memiliki **Kamus & Translate Terverifikasi** (960+ kosakata dasar terverifikasi dua arah Indonesia ↔ Bahasa Daerah, mendukung normalisasi diakritik, sinonim, serta komposisi kalimat kata-per-kata).
   - **8 bahasa utama** juga telah dilengkapi **Kurikulum Game Petualangan 7 Level penuh**: *Basa Sunda, Basa Jawa (Ngoko & Krama), Basa Bali, Bahasa Minangkabau, Bahasa Batak Toba, Bahasa Bugis, Bahasa Betawi, dan Bahasa Banjar*.

6. **Translate & Kamus Daerah, Frasa Harian, LOGATARA AI Chatbot, Profil & Lencana**:
   - Penerjemah dua arah berbasis kamus terverifikasi + pencarian kamus & simpan kosakata.
   - **Frasa Nusantara Hari Ini** + riwayat frasa & simpan ke profil.
   - **LOGATARA AI** (tombol mengambang kanan bawah & halaman khusus) dengan penyimpanan riwayat percakapan di database.

---

## Cara Menjalankan Aplikasi

```bash
# 1. Instal dependensi
npm install

# 2. (Opsional) Salin file konfigurasi lingkungan
copy .env.example .env

# 3. Jalankan mode pengembangan (Backend API :3001 + Frontend Vite :5173)
npm run dev

# ATAU bangun dan jalankan mode produksi pada satu port (:3001)
npm run build
npm start
```

Buka browser di `http://localhost:5173` (mode dev) atau `http://localhost:3001` (mode produksi).

---

## Konfigurasi Opsional (Produksi & Integrasi Eksternal)

Lihat `.env.example` untuk semua variabel lingkungan:

1. **Database**:
   - **Default (tanpa konfigurasi)**: Secara otomatis menggunakan database SQLite persisten (`backend/database/logatara.sqlite`) dengan seluruh **21 tabel ternormalisasi** (20 tabel spesifikasi + `vocabulary`) dan *foreign keys* aktif.
   - **PostgreSQL / Supabase**: Isi `DATABASE_URL=postgresql://...` di `.env`. Skema PostgreSQL lengkap tersedia di `backend/database/schema.postgres.sql` dan otomatis diterapkan saat server dimulai.

2. **Provider AI (LOGATARA AI Chatbot)**:
   - Isi `GEMINI_API_KEY` (Google Gemini) **atau** `OPENAI_API_KEY` (OpenAI-compatible) di `.env`.
   - Jika belum dikonfigurasi, LOGATARA AI otomatis berjalan dalam **Mode Pengetahuan Lokal** yang terlabel jelas di antarmuka dan menjawab berdasarkan kamus, modul, serta data budaya terverifikasi di database.

3. **Audio & Pengenalan Suara**:
   - Memanfaatkan Web Speech API (`speechSynthesis`), Web Audio API, dan `MediaRecorder` browser. Perangkat tanpa suara sintesis atau mikrofon tetap mendapatkan panduan pelafalan fonetis dan mode evaluasi latihan mandiri yang jelas.
