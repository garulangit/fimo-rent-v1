// Konfigurasi Supabase Storage: dashboard-branding-transjogja
export const supabaseConfig = {
  url: 'https://xtgmdkpldsrktscfuphh.supabase.co',
  anonKey: 'sb_publishable_g_JecmyM_cbEmzs1mb5ZQQ_52GXnkrb',
  // ID bucket aktual di project Supabase (label "Name:" ikut tersimpan saat dibuat).
  bucketName: 'Name: admin-files',
};

export const hasSupabaseConfig = Boolean(
  supabaseConfig.url && supabaseConfig.anonKey && supabaseConfig.bucketName
);
