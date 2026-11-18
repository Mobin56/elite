"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Tab = "password" | "code";

function friendly(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("rate limit")) return "অনেক বেশি মেইল পাঠানো হয়েছে। এক ঘণ্টা পরে চেষ্টা করো, অথবা পাসওয়ার্ড দিয়ে লগইন করো।";
  if (m.includes("invalid login")) return "ইমেইল বা পাসওয়ার্ড ভুল।";
  if (m.includes("already registered")) return "এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে। লগইন করো।";
  if (m.includes("email not confirmed")) return "ইমেইল এখনো কনফার্ম হয়নি।";
  if (m.includes("password")) return "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।";
  return msg;
}

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function passwordLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg(friendly(error.message));
    window.location.href = "/profile";
  }

  async function signUp() {
    if (!email.trim() || password.length < 8) return setMsg("ইমেইল দাও এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দাও।");
    setBusy(true); setMsg("");
    const { data, error } = await supabaseBrowser().auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (error) return setMsg(friendly(error.message));
    if (data.session) { window.location.href = "/profile"; return; }
    setMsg("অ্যাকাউন্ট খোলা হয়েছে। ইমেইলে কনফার্মেশন লিংক গেছে, সেটাতে ক্লিক করে তারপর লগইন করো।");
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setMsg(friendly(error.message));
    setSent(true);
    setMsg("তোমার ইমেইলে একটি মেইল গেছে। মেইলের লিংকে ক্লিক করলেই লগইন হয়ে যাবে। কোড দেখালে নিচে বসাও। মেইল না এলে স্প্যাম ফোল্ডার দেখো।");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) return setMsg("কোডটি সঠিক নয় বা মেয়াদ শেষ।");
    window.location.href = "/profile";
  }

  return (
    <main className="wrap" style={{ maxWidth: 420 }}>
      <h1>লগইন</h1>
      <div className="row">
        <button type="button" className={"chip" + (tab === "password" ? " on" : "")} aria-pressed={tab === "password"} onClick={() => { setTab("password"); setMsg(""); }}>পাসওয়ার্ড দিয়ে</button>
        <button type="button" className={"chip" + (tab === "code" ? " on" : "")} aria-pressed={tab === "code"} onClick={() => { setTab("code"); setMsg(""); }}>ইমেইল লিংক দিয়ে</button>
      </div>

      {tab === "password" ? (
        <form onSubmit={passwordLogin} className="card">
          <label htmlFor="em">ইমেইল</label>
          <input id="em" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="inp" autoComplete="email" />
          <label htmlFor="pw">পাসওয়ার্ড</label>
          <input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="inp" autoComplete="current-password" />
          <button className="cta" disabled={busy} type="submit">লগইন করো</button>
          <button className="cta" disabled={busy} type="button" onClick={signUp} style={{ background: "transparent", border: "1px solid #2a3170" }}>নতুন অ্যাকাউন্ট খোলো</button>
        </form>
      ) : !sent ? (
        <form onSubmit={sendCode} className="card">
          <label htmlFor="em2">ইমেইল</label>
          <input id="em2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="inp" autoComplete="email" />
          <button className="cta" disabled={busy} type="submit">লিংক পাঠাও</button>
        </form>
      ) : (
        <form onSubmit={verify} className="card">
          <label htmlFor="cd">কোড (মেইলে কোড থাকলে)</label>
          <input id="cd" inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} className="inp" autoComplete="one-time-code" />
          <button className="cta" disabled={busy || !code.trim()} type="submit">কোড দিয়ে লগইন করো</button>
        </form>
      )}
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
    </main>
  );
}
