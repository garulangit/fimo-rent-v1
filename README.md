# Dashboard Branding Trans Jogja

Aplikasi web internal untuk membantu pengelolaan inventaris bus Trans Jogja, pemesanan dan kontrak branding, pemantauan pendapatan, kelengkapan administrasi, serta pembuatan dokumen operasional.

## Teknologi

- HTML, CSS, dan JavaScript ES Modules tanpa framework frontend.
- Node.js HTTP server bawaan untuk menjalankan aplikasi secara lokal.
- Firebase Authentication dan Cloud Firestore untuk autentikasi, data aplikasi, serta metadata.
- Supabase Storage untuk berkas administrasi dan foto branding.
- Node.js test scripts untuk pengujian otomatis.

## Fitur utama

- **Dashboard dan monitoring:** ringkasan armada, branding aktif, okupansi, pendapatan, dan kalender kontrak.
- **Operasional:** data master bus, data branding, booking, deteksi konflik tanggal/penempatan, dan impor/ekspor CSV.
- **Pendapatan:** pengaturan pricelist bersama, konfigurasi PPN, dan rekap pendapatan.
- **Administrasi:** pemantauan dokumen kontrak dan foto branding.
- **Dokumen:** pembuatan Nota Dinas, Surat Penawaran, dan Surat Konfirmasi.
- **Administrasi akun:** pengelolaan role pengguna dan data master sesuai izin akses.
- **Tema:** pilihan Light dan Dark dengan preferensi yang tersimpan di browser.

## Persiapan dan menjalankan aplikasi

Pastikan Node.js dan npm tersedia. Dari folder proyek, jalankan:

```bash
npm install
npm start
```

Buka <http://localhost:5173>. Server lokal menyajikan berkas dari folder `public/`.

### Firebase Emulator (opsional)

Secara default, aplikasi lokal menggunakan konfigurasi Firebase yang sama dengan aplikasi production. Untuk menjalankan pengujian lokal yang terisolasi dari Auth dan Firestore production:

1. Jalankan emulator:

   ```bash
   npm run emulators
   ```

2. Di terminal lain, siapkan akun dan role lokal:

   ```bash
   npm run emulators:seed
   ```

3. Jalankan aplikasi di terminal lain:

   ```bash
   npm start
   ```

4. Buka <http://localhost:5173/login.html?firebaseEmulator=1> untuk secara eksplisit mengaktifkan emulator pada tab tersebut.

Mode emulator tersimpan hanya selama tab browser aktif dan tetap digunakan setelah redirect login. Untuk kembali ke Firebase production pada tab yang sama, buka <http://localhost:5173/login.html?firebaseEmulator=0>; membuka tab baru juga memulai mode production. Emulator memakai project ID demo dan tidak berpindah otomatis ke production jika emulator tidak tersedia. Detail akun uji dan workflow verifikasi ada di [docs/FIREBASE_EMULATORS.md](docs/FIREBASE_EMULATORS.md). Pengujian emulator otomatis dapat dijalankan dengan `npm run emulators:test`.

## Pengujian

Jalankan seluruh unit test yang tersedia:

```bash
npm test
```

Test memeriksa kalkulasi pendapatan, data trayek, izin akses, dashboard, dan pembuatan surat. Untuk verifikasi Firestore Rules pada emulator, gunakan `npm run emulators:test`.

## Arsitektur singkat

`public/app.js` menjadi bootstrap SPA dan mengatur navigasi berbasis hash. Setelah autentikasi, role aktif pengguna dimuat dari `userRoles/{uid}` dan permission dipakai untuk mengatur navigasi serta akses antarmuka. Keamanan data tetap ditegakkan oleh Firestore Rules; pemeriksaan permission di browser bukan pengganti Rules.

Metadata aplikasi disimpan di Firestore. File PDF dan foto diunggah melalui Supabase Storage, sedangkan metadata berkasnya disimpan di Firestore. Data harga booking disimpan sebagai snapshot agar perubahan pricelist tidak mengubah nilai historis.

## Role pengguna

- `superadmin`: akses penuh, termasuk pengelolaan akun superadmin.
- `admin`: akses administratif sesuai permission yang diberikan.
- `operator`: akses operasional tanpa akses pengelolaan akun.
- `viewer`: akses baca sesuai permission yang diberikan.

Akun harus memiliki dokumen role aktif pada `userRoles/{uid}`. Aturan akses terperinci berada di `public/permissions.js` dan `firestore.rules`.

## Struktur penting

| Lokasi | Isi |
|---|---|
| `public/` | Halaman, stylesheet, modul aplikasi, dan konfigurasi client |
| `public/app.js` | Bootstrap aplikasi, navigasi, dan guard tampilan |
| `public/firebase.js` | Inisialisasi Firebase Authentication dan Firestore |
| `public/permissions.js` | Pemetaan role ke permission |
| `public/data-features.js` | Fitur master bus, branding, booking, dan CSV |
| `public/admin-config.js` | Akun, data master, dan pricelist |
| `scripts/firebase-emulator.mjs` | Seed akun dan pengujian Firebase Emulator |
| `tests/` | Unit test |
| `firestore.rules` | Aturan keamanan Firestore |
| `firebase.json` | Konfigurasi Firebase Hosting dan Emulator |
| `docs/` | Konteks proyek, design system, roadmap, dan panduan emulator |

## Keamanan dan konfigurasi

- Jangan masukkan password produksi, token, service-account key, private key, atau Supabase `service_role` key ke repository.
- Konfigurasi Firebase Web dan Supabase publishable/anon yang digunakan frontend bukan kredensial server-side; akses data tetap harus dibatasi oleh konfigurasi layanan dan aturan keamanan.
- Gunakan Firebase Emulator untuk pengujian yang mengubah atau mengandalkan data uji; ikuti panduan opt-in agar tidak menguji terhadap production.
- `firestore.rules` dan `storage.rules` adalah batas keamanan; jangan melonggarkan aturan hanya untuk melewati pemeriksaan antarmuka.

## Dokumentasi proyek

- [Konteks proyek](docs/PROJECT_CONTEXT.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Roadmap](docs/ROADMAP.md)
- [Aturan pengembangan agent](docs/AGENTS.md)
- [Panduan Firebase Emulator](docs/FIREBASE_EMULATORS.md)
