// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const envUrl = import.meta.env?.VITE_SUPABASE_URL;
const envKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!envUrl || !envKey) {
  console.warn(
    '[supabaseClient] VITE_SUPABASE_URL oder VITE_SUPABASE_ANON_KEY fehlen. ' +
    'Bitte in .env(.local) setzen.'
  );
}

const supabaseUrl = envUrl || 'https://kirevrwmmthqgceprbhl.supabase.co';
const supabaseAnonKey = envKey ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcmV2cndtbXRocWdjZXByYmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1OTM2NzgsImV4cCI6MjA2MzE2OTY3OH0.93U4CZz2QdKTZV5k0NsAO7pJA-xSXumzoeKP2NL-D9w';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Optional: Supabase-Client fürs Debugging im Browser verfügbar machen
if (typeof window !== 'undefined') {
  window.supabase = supabase;
}
