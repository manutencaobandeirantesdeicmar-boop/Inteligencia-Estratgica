import { createClient } from '@supabase/supabase-js';

// Busca as variáveis específicas da frota
const supabaseUrl = import.meta.env.VITE_SUPABASE_FROTA_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_FROTA_ANON_KEY;

// Exportando com o nome exato que a tela da Frota está procurando
export const supabaseFrota = createClient(supabaseUrl, supabaseKey);
