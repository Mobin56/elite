"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

// Returns the signed-in user's id, or sends the visitor to the login page.
export function useRequireUser(): string | null {
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    supabaseBrowser().auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = "/login";
      else setUid(data.user.id);
    });
  }, []);
  return uid;
}
