import { createClient } from '@supabase/supabase-js';

// URL corrigida (sem o /rest/v1/ no final)
const supabaseUrl = 'https://dwlcaplumgtgvbducrev.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bGNhcGx1bWd0Z3ZiZHVjcmV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY4MzY5NDMsImV4cCI6MjA2MjQxMjk0M30.8oGZIvEIruVdOjuMT-oPtgOGLh_QgfR3XV07V3AOe40';

// Exportando com o nome exato que a tela da Frota está procurando
export const supabaseFrota = createClient(supabaseUrl, supabaseKey);
