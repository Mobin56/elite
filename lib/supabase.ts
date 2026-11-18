import { createBrowserClient } from "@supabase/ssr";

// Browser-side client. Uses only the public anon key; Row Level Security
// in the database decides what each student can read or write.
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
