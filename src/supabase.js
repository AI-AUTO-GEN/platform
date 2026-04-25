import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nangyrlyayskchsjqymn.supabase.co'
const supabaseKey = 'sb_publishable_3s2AlbIMwdlU5VvGngkqPw_VTqi2Q4t'

// N8N webhook URLs are centralized in config/constants.js

export const supabase = createClient(supabaseUrl, supabaseKey)
