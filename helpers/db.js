const SUPABASE_URL = "https://bfogmteyuogypvwixtfn.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_sOfe3QgN0vgZV8x_aJDy9g_mos0_1Et"; // or the eyJ... anon key

export const db = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);