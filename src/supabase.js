// supabase.js — centralise la config Supabase
const SUPABASE_URL = 'YOUR_SUPABASE_URL'
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)