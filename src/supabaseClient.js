// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kirevrwmmthqgceprbhl.supabase.co'; // ← DEINE URL
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpcmV2cndtbXRocWdjZXByYmhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc1OTM2NzgsImV4cCI6MjA2MzE2OTY3OH0.93U4CZz2QdKTZV5k0NsAO7pJA-xSXumzoeKP2NL-D9w';              // ← DEIN anon key

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
