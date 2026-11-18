"use client";

import { useEffect } from "react";
import { supabaseBrowser } from "@/lib/supabase";

// After the email link is clicked, Supabase sends the student back to the site URL with a session
// in the address. This checks for a session and moves a signed-in student to the profile page.
export default function AuthRedirect() {
  useEffect(() => {
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (data.session) window.location.replace("/profile");
    });
  }, []);
  return null;
}
