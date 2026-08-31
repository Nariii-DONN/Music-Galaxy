/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_AUDIUS_API_KEY?: string
  readonly VITE_JAMENDO_CLIENT_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
