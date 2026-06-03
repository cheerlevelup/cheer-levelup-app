import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://nizqbinjxtkwbgbodzml.supabase.co";

const supabaseAnonKey =
  "sb_publishable_4Q2S5V7_eNLS3HP5vVv0rw_1lB3Mcha";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);