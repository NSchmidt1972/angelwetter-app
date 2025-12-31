// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env?.VITE_SUPABASE_URL?.trim();
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY?.trim();

if (!envUrl || !envKey) {
  throw new Error(
    '[supabaseClient] VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY müssen gesetzt sein. ' +
    'Lege eine .env.local an (siehe .env.example).'
  );
}

export const SUPABASE_URL = envUrl;
export const SUPABASE_ANON_KEY = envKey;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Optional: Supabase-Client fürs Debugging im Browser verfügbar machen
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
