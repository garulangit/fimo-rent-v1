-- ==============================================================================
-- SETUP DAN STORAGE POLICIES SUPABASE STORAGE: admin-files
-- Jalankan skrip ini di SQL Editor pada Supabase Dashboard:
-- https://supabase.com/dashboard/project/xtgmdkpldsrktscfuphh/sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- OPSI A: BUCKET PUBLIC (Direkomendasikan agar URL dokumen langsung dapat diakses)
-- ------------------------------------------------------------------------------

-- 1. Buat bucket 'admin-files' dengan status PUBLIC
insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', true)
on conflict (id) do update set public = true;

-- 2. Policy SELECT: Mengizinkan pembacaan file (download / view)
create policy "admin_files_public_select"
on storage.objects for select
to public
using (bucket_id = 'admin-files');

-- 3. Policy INSERT: Mengizinkan upload file via anon client
create policy "admin_files_public_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'admin-files');

-- 4. Policy UPDATE: Mengizinkan replace/update file via anon client
create policy "admin_files_public_update"
on storage.objects for update
to anon
using (bucket_id = 'admin-files')
with check (bucket_id = 'admin-files');

-- 5. Policy DELETE: Mengizinkan penghapusan file lama via anon client
create policy "admin_files_public_delete"
on storage.objects for delete
to anon
using (bucket_id = 'admin-files');


-- ------------------------------------------------------------------------------
-- OPSI B: JIKA INGIN BUCKET PRIVATE (Akses melalui Signed URL)
-- Jika Anda ingin bucket berstatus private, gunakan skrip di bawah ini:
-- ------------------------------------------------------------------------------
/*
-- 1. Ubah atau buat bucket menjadi private
insert into storage.buckets (id, name, public)
values ('admin-files', 'admin-files', false)
on conflict (id) do update set public = false;

-- 2. Policy SELECT untuk anon (diperlukan untuk createSignedUrl)
create policy "admin_files_private_select"
on storage.objects for select
to anon
using (bucket_id = 'admin-files');

-- 3. Policy INSERT
create policy "admin_files_private_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'admin-files');

-- 4. Policy UPDATE
create policy "admin_files_private_update"
on storage.objects for update
to anon
using (bucket_id = 'admin-files')
with check (bucket_id = 'admin-files');

-- 5. Policy DELETE
create policy "admin_files_private_delete"
on storage.objects for delete
to anon
using (bucket_id = 'admin-files');
*/
