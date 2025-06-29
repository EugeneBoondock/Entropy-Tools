import { createClient } from '@supabase/supabase-js';

// Service-role key with elevated privileges (store securely in prod)
const SUPABASE_URL = process.env.VITE_SUPABASE_URL as string;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false }
}); 