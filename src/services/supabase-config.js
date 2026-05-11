import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jwugagaspfputbphtjkm.supabase.co'
const supabaseKey = 'sb_publishable_Ct9ytY359hGWZIytnLmcSw_Lnh5Khgz'

export const supabase = createClient(supabaseUrl, supabaseKey)
