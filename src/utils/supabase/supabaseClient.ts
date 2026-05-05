import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://ybmarmktrhflvsgianqh.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlibWFybWt0cmhmbHZzZ2lhbnFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MTc4MTksImV4cCI6MjA5MzQ5MzgxOX0.UVGSq0mH18NJ0DqbkXpywo875OhWsHnn6NGMG4ti5AY",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      storageKey: "smartech-normalized-auth",
    },
  },
);
