"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

const LINKS = [
  ["/exam", "পরীক্ষা"],
  ["/notebook", "ভুলের খাতা"],
  ["/bookmarks", "বুকমার্ক"],
  ["/progress", "প্রগ্রেস"],
  ["/bank", "প্রশ্নব্যাংক"],
  ["/batches", "ব্যাচ"],
  ["/profile", "প্রোফাইল"],
] as const;

export default function Nav() {
  const [signedIn, setSignedIn] = useState(false);
  const [admin, setAdmin] = useState(false);

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data } = await sb.auth.getUser();
      if (!data.user) return;
      setSignedIn(true);
      const { data: p } = await sb.from("profiles").select("role").eq("id", data.user.id).single();
      setAdmin(p?.role === "admin");
    })();
  }, []);

  return (
    <nav className="nav" aria-label="প্রধান মেনু">
      <a href="/" className="brand">Elite</a>
      {signedIn ? (
        <>
          {LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          {admin && <a href="/admin">অ্যাডমিন</a>}
        </>
      ) : (
        <a href="/login">লগইন</a>
      )}
    </nav>
  );
}
