import { createClient } from '@supabase/supabase-js';
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL2;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY2;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Variáveis de ambiente do Supabase não encontradas! Verifique o seu ficheiro .env");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
