# Project Overview

Dashboard internal untuk mengelola inventaris bus, booking dan branding armada Trans Jogja, pendapatan, kelengkapan administrasi branding, serta pembuatan dokumen operasional. Aplikasi adalah SPA berbasis HTML/JavaScript di `public/`, dengan Firebase Authentication/Firestore sebagai sumber data utama dan Supabase Storage untuk alur upload administrasi yang digunakan saat ini.

# Technology Stack

- Node.js HTTP server bawaan (`server.js`); tidak ada framework frontend.
- HTML, CSS, dan JavaScript ES modules di `public/`.
- Firebase Web SDK 12.19.0 dari CDN: Authentication dan Firestore.
- Supabase JS dari `https://esm.sh/@supabase/supabase-js@2` untuk Storage.
- jsPDF dan AutoTable dari CDN untuk PDF surat.
- Node.js test scripts melalui `npm test`.
- Firebase Hosting, Firestore Rules, dan Firebase Storage Rules dikonfigurasi di root.

# Project Structure

- `public/index.html`: shell SPA, navigasi, markup seluruh view, dan inline pricing/revenue logic.
- `public/login.html`, `public/login.js`: halaman dan alur login.
- `public/app.js`: bootstrap aplikasi, routing hash, navigasi, dan guard view.
- `public/firebase.js`, `public/firebase-config.js`: inisialisasi Firebase Auth/Firestore dan konfigurasi client.
- `public/data-features.js`: CRUD bus/branding, booking, conflict check, CSV import/export, dan audit fields.
- `public/dashboard-monitoring.js`: helper kalender, overlap bulan, dan bucket jatuh tempo.
- `public/admin-features.js`, `public/admin-period-grouping.js`: administrasi dokumen/foto branding dan pengelompokan periode.
- `public/admin-config.js`: user role records, master data, dan pricelist bersama.
- `public/permissions.js`: role-to-permission map dan access context client.
- `public/nota-dinas.js`: draft/final Nota Dinas, audit metadata, preview, print, dan PDF.
- `public/surat-penawaran*.js`, `public/surat-konfirmasi*.js`: model, pemilihan data, kalkulasi quote, dan PDF surat.
- `public/trayek-master.js`: master kode/nama trayek.
- `public/styles.css`, `public/nota-dinas.css`: design system dan style dokumen.
- `public/supabase.js`, `public/supabase-config.js`: client Supabase Storage.
- `public/assets/`: aset lampiran surat.
- `tests/`: tests untuk pricing, trayek, permission, dashboard, dan surat.
- `master-bus.csv`, `contoh_export_branding.csv`: data/contoh CSV.
- `firestore.rules`, `storage.rules`, `supabase-storage-setup.sql`: aturan dan setup akses.

# How To Run

1. Pastikan Node.js tersedia dan dependency pada `package-lock.json` telah terpasang.
2. Jalankan server lokal dengan `npm start` atau `node server.js`.
3. Buka `http://localhost:5173/`; `/` dilayani sebagai `public/index.html`.
4. Jalankan verifikasi otomatis dengan `npm test`.

`server.js` adalah static server sederhana dan tidak menyediakan fallback SPA untuk setiap deep link; Firebase Hosting memiliki rewrite `**` ke `/index.html` di `firebase.json`.

# Architecture

`public/app.js` memanggil `connectFirebase()`, mengamati Auth, memuat access context, lalu menginisialisasi feature modules. Data operasional dibaca dari Firestore dan dirender langsung ke DOM. Navigasi menggunakan hash seperti `#dashboard`, `#master-bus`, dan `#branding`, bukan router framework.

Firebase client config berada di `public/firebase-config.js`; kredensial client tidak boleh diperlakukan sebagai secret server-side. Rules deployment didefinisikan di `firestore.rules` dan `storage.rules`. Alur administrasi saat ini menyimpan metadata dokumen di Firestore, meng-upload file melalui `public/admin-features.js` ke Supabase Storage, mengambil public URL, lalu memperbarui metadata Firestore.

# Authentication

`public/firebase.js` menggunakan Firebase Auth `signInWithEmailAndPassword`, `onAuthStateChanged`, dan `signOut`. `public/login.js` mengelola form login dan reset password. `public/session-security.js` menerapkan batas sesi maksimum 12 jam dan timeout tidak aktif 10 jam; nilai tersebut harus dipertahankan kecuali ada persetujuan eksplisit.

# Authorization / Roles

Role yang benar-benar diimplementasikan: `superadmin`, `admin`, `operator`, dan `viewer`. Mapping permission client ada di `public/permissions.js`; role aktif dimuat dari `userRoles/{uid}`. `superadmin` mendapat wildcard, `admin` mengelola data/pricelist/user sesuai mapping, `operator` memiliki akses operasional tanpa seluruh akses konfigurasi, dan `viewer` read-only.

Authorization client hanya untuk UX. Enforcement database ada di `firestore.rules`/`storage.rules` dan wajib dipertahankan. Rules Firestore mengizinkan role dibaca oleh pemiliknya, admin, atau pemegang `users.view`; role tidak boleh diasumsikan ada atau valid hanya karena UI menampilkan view.

# Database

Collection/path yang terverifikasi dari kode:

- `buses/{busId}`: master bus, termasuk `noPolisi`, `noLamb`, `tipeBus`, `jalurBus`, `warnaBus`, dan `karoseri`.
- `brandings/{brandingId}`: booking/branding, termasuk bus, `namaBrand`, `namaPT`, `jenisBranding`, `tanggalBooking`, `tanggalMulai`, `tanggalSelesai`, `status`, `keterangan`, `pricingSnapshot`, `updatedBy`, dan `updatedAt`.
- `userRoles/{uid}`: `role`, `active`, dan optional `permissions`.
- `appConfig/masterData`: nilai dropdown/master data.
- `appConfig/brandingPricing`: pricelist bersama, versi, konfigurasi PPN, dan timestamp pembaruan.
- `brandAdmins/{brandId}`: metadata dokumen branding; `fotoBranding/{noPolisi}` adalah subcollection foto.
- `notaDinas/{notaDinasId}`: draft/final Nota Dinas dan audit fields `createdBy`, `createdAt`, `updatedBy`, `updatedAt`.

Relasi branding ke bus memakai nomor polisi. Relasi administrasi ke brand dibentuk oleh identifier gabungan nama brand dan nama PT di `public/admin-features.js`. Jangan mengubah nama collection, path, atau bentuk field tanpa persetujuan eksplisit dan pemeriksaan migrasi.

# Storage

Source code upload ada di `public/admin-features.js`. Dokumen yang didukung: PDF; PKS maksimal 2 MB, dokumen administrasi lain maksimal 500 KB. Foto branding menerima JPG/JPEG/PNG maksimal 500 KB. Path client adalah `brands/{brandId}/administrasi/{docKey}/{timestamp}_{docKey}.{ext}` dan `brands/{brandId}/foto-branding/{noPolisi}/{timestamp}.{ext}`.

`public/supabase-config.js` mengatur URL, anon client key, dan nama bucket runtime. `supabase-storage-setup.sql` mendokumentasikan bucket/policy setup, tetapi nama bucket pada SQL dan konfigurasi runtime harus diverifikasi bersama sebelum perubahan. Firestore tetap menyimpan `storageRef`, `downloadURL`, `fileName`, `uploadedAt`, dan `uploadedBy`.

# Business Rules

- Jenis branding pada booking: `Full Body`, `Back Body`, dan `Side Body`.
- Bus dengan branding yang rentang tanggalnya beririsan tidak dapat dipilih. Konflik dan pengecualian record saat edit dihitung di `getBusConflict()`/helper dalam `public/data-features.js`; ini validasi client-side, bukan constraint transaksi server-side.
- Tanggal mulai tidak boleh setelah tanggal selesai. Booking ditulis satu record per bus yang dipilih.
- Durasi kontrak dihitung dari tanggal mulai/selesai; pricing memakai `pricingSnapshot` agar booking lama tidak berubah saat pricelist diperbarui.
- Pricelist mendukung media bus, space iklan, dan durasi 1/3/6/12 bulan. `Side Body` dihitung dari Left Body + Right Body; tier yang tidak tersedia dapat fallback ke harga 1 bulan × durasi jika harga dasar tersedia.
- PPN default pada source adalah 11%, tetapi `appConfig/brandingPricing` dapat mengatur enabled/percent.
- Revenue dihitung dari base price, PPN, total, dan monthly allocated revenue; alokasi bulanan mengikuti bulan yang beririsan dengan rentang booking. Source ada di inline script `public/index.html` (`calculateBookingFinancials` dan `calculateDashboardRevenue`).
- CSV master bus dan branding divalidasi berdasarkan header; import branding mensyaratkan pricelist bersama tersedia dan membuat/memperbarui record Firestore.
- Surat Penawaran memilih status `BOOKING` untuk sumber Booking, atau `PROSES`/`BERJALAN`/`SELESAI` untuk sumber Branding. Surat Konfirmasi memakai aturan status yang sama.
- Nota Dinas memiliki status draft/final; Firestore Rules menolak update record `FINAL`, mewajibkan audit fields, dan hanya role operasional yang dapat membuat/mengubahnya.

# Navigation

Navigasi aktual di `public/index.html`/`public/app.js`:

- Overview: Dashboard.
- Operations: Master Bus, Data Branding, Booking Branding, Setting Harga Branding, Rekap Branding, Pendapatan Branding.
- Monitoring: Kelengkapan Administrasi, History.
- View dokumen di markup: Buat Nota Dinas, Kirim Surat Penawaran, dan Buat Surat Konfirmasi.

# UI / Design System

UI memakai sidebar responsive, hash-based single-view sections, tabel/filter/modal, dan tombol berbasis permission. Design tokens berada di `public/styles.css`: warna utama hijau `#0E4A31`, aksen kuning `#FDC421`, surface terang, radius 7/12/16 px, Inter untuk UI, dan Cormorant Garamond untuk display. `public/nota-dinas.css` menambahkan layout dokumen dan aturan print. Pertahankan logo/aset di `public/icon/` dan `public/assets/`; jangan menggambar ulang atau mengganti aset tanpa permintaan.

# Data Integrity Rules

- Pertahankan Firebase Auth dan Firestore sebagai identity/metadata system; jangan memindahkan metadata ke Supabase tanpa persetujuan.
- Pertahankan `pricingSnapshot` pada record yang sudah dibuat.
- Jangan melewati conflict check, audit fields, status final, atau validasi ukuran/jenis file.
- Pastikan perubahan client konsisten dengan Firestore Rules, Storage Rules, dan policy Supabase yang benar-benar terdeploy.
- Jangan menganggap public URL atau anon policy sebagai bukti otorisasi Firebase.

# Agent Development Rules

- Inspect source, runtime path, konfigurasi, dan rules sebelum mengedit.
- Reuse module, helper, collection, dan struktur yang ada; hindari refactor luas atau service duplikat.
- Jangan mengubah schema, rules, Firebase, Supabase, Auth, atau perilaku bisnis tanpa persetujuan eksplisit.
- Batasi perubahan pada file yang diperlukan dan pertahankan perubahan lokal pengguna.
- Setelah perubahan, jalankan `npm test`, pemeriksaan sintaks JavaScript yang relevan, dan verifikasi browser/console untuk alur UI yang terdampak.
- Bedakan hasil unit test dari bukti end-to-end deployed Firebase/Supabase; jangan mengklaim upload atau deployment berhasil tanpa verifikasi runtime.
- Jika fakta tidak dapat diverifikasi dari repository atau environment, tulis `Not verified in repository.`

# Security Rules

- Jangan mengekspos atau menambahkan secret, password, token, atau service-role key ke source.
- Jangan bypass Auth atau menjadikan pemeriksaan permission frontend sebagai satu-satunya kontrol.
- Jangan memperlonggar Firestore/Storage Rules menjadi unrestricted access.
- Setup SQL saat ini memuat policy `anon` dan bucket public; setiap perubahan harus dianggap security-sensitive dan mendapat persetujuan.
- Sanitasi output HTML dan pertahankan validasi tipe/ukuran file yang sudah ada.

# Known Issues

- `server.js` static lokal tidak sama dengan Firebase Hosting rewrite; deep-link behavior lokal perlu diverifikasi sebelum dianggap setara production.
- Runtime Supabase memakai nilai bucket yang perlu dicocokkan dengan `supabase-storage-setup.sql`; bucket/policy terdeploy tidak dapat dipastikan hanya dari file lokal.
- Setup SQL mendokumentasikan bucket public dan policy upload/update/delete untuk `anon`; ini memudahkan client upload tetapi bukan bukti authorization berbasis Firebase.
- Conflict check dan beberapa validasi bisnis berjalan di browser; enforcement atomik lintas client tidak terverifikasi dari repository.
- Status deployment Firebase, Rules terdeploy, isi Firestore/Supabase, dan end-to-end upload production: Not verified in repository.

# Future / Planned Features

Repository menunjukkan konfigurasi master data, user management, pricelist bersama, history, administrasi, dan surat sebagai fitur yang digunakan atau dikembangkan. Roadmap tambahan di luar modul yang ada: Not verified in repository.

# Important Agent Workflow

1. Inspect: identifikasi checkout, entry point, source of truth, rules, dan runtime config.
2. Understand: telusuri data flow Auth → Firestore/Supabase → DOM/PDF.
3. Plan: tentukan perubahan minimal dan risiko kompatibilitas.
4. Modify only required files: jangan mengubah file lain atau konfigurasi eksternal tanpa izin.
5. Test: jalankan test/syntax check dan verifikasi browser yang relevan.
6. Report: jelaskan perubahan, bukti verifikasi, dan bagian yang masih `Not verified in repository.`
