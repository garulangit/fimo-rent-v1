import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { supabaseConfig, hasSupabaseConfig } from './supabase-config.js';

let supabaseClient = null;

if (hasSupabaseConfig) {
  supabaseClient = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export const supabase = supabaseClient;
export const BUCKET_NAME = supabaseConfig.bucketName;
