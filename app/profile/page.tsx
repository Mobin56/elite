"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Level = "ssc" | "hsc" | "admission";
const LEVELS: Record<Level, string> = { ssc: "SSC", hsc: "HSC", admission: "ভর্তি" };

export default function ProfilePage() {
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState<Level>("ssc");
  const [streak, setStreak] = useState(0);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) {
        window.location.href = "/login";
        return;
      }
      const { data: p } = await sb.from("profiles").select("full_name, level").eq("id", u.user.id).single();
      if (p?.full_name) setName(p.full_name);
      if (p?.level) setLevel(p.level as Level);
      const { data: s } = await sb.from("streaks").select("current_streak").eq("user_id", u.user.id).maybeSingle();
      setStreak(s?.current_streak ?? 0);
      setReady(true);
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    const { error } = await sb.from("profiles").update({ full_name: name.trim(), level }).eq("id", u.user.id);
    setMsg(error ? "সেভ হয়নি: " + error.message : "সেভ হয়েছে।");
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/";
  }

  if (!ready) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <h1>আমার প্রোফাইল</h1>
      <p style={{ color: "var(--mute)" }}>স্ট্রিক: {streak} দিন</p>
      <form onSubmit={save} className="card">
        <label htmlFor="nm">নাম</label>
        <input id="nm" required value={name} onChange={(e) => setName(e.target.value)} className="inp" />
        <label htmlFor="lv">স্তর</label>
        <select id="lv" value={level} onChange={(e) => setLevel(e.target.value as Level)} className="inp">
          {Object.entries(LEVELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <button className="cta" type="submit">সেভ করো</button>
      </form>
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
      <button className="cta" style={{ background: "transparent", border: "1px solid #2a3170" }} onClick={logout}>লগআউট</button>
    </main>
  );
}
