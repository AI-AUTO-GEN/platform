import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://nangyrlyayskchsjqymn.supabase.co'
const supabaseKey = 'sb_publishable_3s2AlbIMwdlU5VvGngkqPw_VTqi2Q4t'

// n8n webhook endpoint (Master AI Content Pipeline V3)
export const N8N_WEBHOOK = 'https://nsk404.app.n8n.cloud/webhook/track-and-generate'

export const supabase = createClient(supabaseUrl, supabaseKey)
