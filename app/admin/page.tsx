"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { parseCsv } from "@/lib/csv";
import { CSV_HEADER, Level, QuestionRow, rowsFromCsv, saveQuestions, validateRow } from "@/lib/admin";

type Batch = { id: string; title: string; price_bdt: number; duration_days: number; all_subjects: boolean; is_active: boolean };
type Subject = { id: string; level: string; name_bn: string };

export default function AdminPage() {
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  const [count, setCount] = useState(0);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  async function reload() {
    const sb = supabaseBrowser();
    const q = await sb.from("questions").select("id", { count: "exact", head: true });
    setCount(q.count ?? 0);
    const b = await sb.from("batches").select("id,title,price_bdt,duration_days,all_subjects,is_active").order("price_bdt");
    setBatches((b.data as Batch[]) ?? []);
    const s = await sb.from("subjects").select("id,level,name_bn").order("name_bn");
    setSubjects((s.data as Subject[]) ?? []);
  }

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) { window.location.href = "/login"; return; }
      const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
      if (p?.role !== "admin") { setState("denied"); return; }
      await reload();
      setState("ok");
    })();
  }, []);

  if (state === "loading") return <main className="wrap"><p>লোড হচ্ছে...</p></main>;
  if (state === "denied")
    return (
      <main className="wrap">
        <h1>অ্যাডমিন অ্যাক্সেস নেই</h1>
        <p style={{ color: "var(--mute)" }}>এই পেজ শুধু অ্যাডমিনদের জন্য।</p>
      </main>
    );

  return (
    <main className="wrap">
      <h1>অ্যাডমিন প্যানেল</h1>
      <p style={{ color: "var(--mute)" }}>মোট প্রশ্ন: {count}</p>
      <Payments />
      <AddQuestion onSaved={reload} />
      <CsvUpload onSaved={reload} />
      <Batches batches={batches} subjects={subjects} onSaved={reload} />
    </main>
  );
}

function AddQuestion({ onSaved }: { onSaved: () => void }) {
  const [f, setF] = useState({ level: "ssc" as Level, subject: "", chapter: "", board: "", university: "", year: "", body: "", o1: "", o2: "", o3: "", o4: "", correct: "1", explanation: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const row: QuestionRow = {
      level: f.level, subject: f.subject.trim(), chapter: f.chapter.trim(),
      board: f.board.trim() || undefined, university: f.university.trim() || undefined,
      year: f.year ? Number(f.year) : null, body: f.body.trim(),
      options: [f.o1, f.o2, f.o3, f.o4].map((x) => x.trim()).filter(Boolean),
      correct: Number(f.correct) - 1, explanation: f.explanation.trim() || undefined,
    };
    const err = validateRow(row);
    if (err) return setMsg("ভুল: " + err);
    setBusy(true);
    const r = await saveQuestions([row]);
    setBusy(false);
    if (r.error) return setMsg("সেভ হয়নি: " + r.error);
    setMsg("প্রশ্ন সেভ হয়েছে।");
    setF({ ...f, body: "", o1: "", o2: "", o3: "", o4: "", explanation: "" });
    onSaved();
  }

  return (
    <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
      <h3>একটি প্রশ্ন যোগ করো</h3>
      <label htmlFor="lv">স্তর</label>
      <select id="lv" className="inp" value={f.level} onChange={set("level")}>
        <option value="ssc">SSC</option><option value="hsc">HSC</option><option value="admission">ভর্তি</option>
      </select>
      <label htmlFor="sj">বিষয়</label><input id="sj" className="inp" value={f.subject} onChange={set("subject")} required />
      <label htmlFor="ch">অধ্যায়</label><input id="ch" className="inp" value={f.chapter} onChange={set("chapter")} required />
      <label htmlFor="bd">বোর্ড (ঐচ্ছিক)</label><input id="bd" className="inp" value={f.board} onChange={set("board")} />
      <label htmlFor="un">বিশ্ববিদ্যালয় (ঐচ্ছিক)</label><input id="un" className="inp" value={f.university} onChange={set("university")} />
      <label htmlFor="yr">সাল (ঐচ্ছিক)</label><input id="yr" className="inp" inputMode="numeric" value={f.year} onChange={set("year")} />
      <label htmlFor="qb">প্রশ্ন</label><textarea id="qb" className="inp" rows={3} value={f.body} onChange={set("body")} required />
      {(["o1", "o2", "o3", "o4"] as const).map((k, i) => (
        <div key={k}><label htmlFor={k}>অপশন {i + 1}</label><input id={k} className="inp" value={f[k]} onChange={set(k)} required={i < 2} /></div>
      ))}
      <label htmlFor="cr">সঠিক উত্তর</label>
      <select id="cr" className="inp" value={f.correct} onChange={set("correct")}>
        <option value="1">অপশন ১</option><option value="2">অপশন ২</option><option value="3">অপশন ৩</option><option value="4">অপশন ৪</option>
      </select>
      <label htmlFor="ex">ব্যাখ্যা (প্রিমিয়াম ছাত্ররা দেখবে)</label><textarea id="ex" className="inp" rows={2} value={f.explanation} onChange={set("explanation")} />
      <button className="cta" type="submit" disabled={busy}>সেভ করো</button>
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
    </form>
  );
}

function CsvUpload({ onSaved }: { onSaved: () => void }) {
  const [msg, setMsg] = useState("");
  const [errs, setErrs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function sample() {
    const line = ["ssc", "গণিত", "বীজগণিত", "ঢাকা", "", "2024", "x² = 49 হলে x = ?", "৭", "±৭", "৪৯", "১৪", "2", "(−৭)² ও ৭² দুটোই ৪৯।"];
    const csv = "﻿" + CSV_HEADER.join(",") + "\n" + line.map((c) => `"${c.replace(/"/g, '""')}"`).join(",") + "\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "questions-sample.csv";
    a.click();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrs([]); setMsg("");
    const { rows, errors } = rowsFromCsv(parseCsv(await file.text()));
    if (errors.length) { setErrs(errors.slice(0, 20)); setMsg("ফাইলে ভুল আছে। কিছুই সেভ হয়নি। ঠিক করে আবার দাও।"); e.target.value = ""; return; }
    setBusy(true);
    const r = await saveQuestions(rows);
    setBusy(false);
    setMsg(r.error ? `${r.saved}টি সেভ হয়েছে, তারপর ভুল: ${r.error}` : `${r.saved}টি প্রশ্ন সেভ হয়েছে।`);
    e.target.value = "";
    onSaved();
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>CSV দিয়ে একসাথে অনেক প্রশ্ন</h3>
      <p>কলাম: {CSV_HEADER.join(", ")}। সঠিক উত্তর ১ থেকে ৪ এর সংখ্যা। level হবে ssc, hsc বা admission।</p>
      <button className="cta" type="button" onClick={sample}>নমুনা CSV নামাও</button>
      <label htmlFor="csv">CSV ফাইল বেছে নাও</label>
      <input id="csv" type="file" accept=".csv,text/csv" onChange={onFile} disabled={busy} className="inp" />
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
      {errs.length > 0 && <ul>{errs.map((x) => <li key={x}>{x}</li>)}</ul>}
    </div>
  );
}

function Batches({ batches, subjects, onSaved }: { batches: Batch[]; subjects: Subject[]; onSaved: () => void }) {
  const [t, setT] = useState(""); const [price, setPrice] = useState(""); const [days, setDays] = useState("30");
  const [all, setAll] = useState(true); const [picked, setPicked] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const sb = supabaseBrowser();
    if (!all && picked.length === 0) return setMsg("অন্তত একটি বিষয় বেছে নাও।");
    const ins = await sb.from("batches").insert({ title: t.trim(), price_bdt: Number(price), duration_days: Number(days), all_subjects: all }).select("id").single();
    if (ins.error) return setMsg("সেভ হয়নি: " + ins.error.message);
    if (!all) {
      const r = await sb.from("batch_subjects").insert(picked.map((subject_id) => ({ batch_id: ins.data.id, subject_id })));
      if (r.error) { await sb.from("batches").delete().eq("id", ins.data.id); return setMsg("বিষয় যোগ হয়নি: " + r.error.message); }
    }
    setMsg("ব্যাচ তৈরি হয়েছে।"); setT(""); setPrice(""); setPicked([]); onSaved();
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>ব্যাচ ও দাম</h3>
      <ul>{batches.map((b) => <li key={b.id}>{b.title}: {b.price_bdt} টাকা, {b.duration_days} দিন, {b.all_subjects ? "সব বিষয়" : "নির্দিষ্ট বিষয়"}</li>)}</ul>
      <form onSubmit={create}>
        <label htmlFor="bt">ব্যাচের নাম</label><input id="bt" className="inp" value={t} onChange={(e) => setT(e.target.value)} required />
        <label htmlFor="bp">দাম (টাকা)</label><input id="bp" className="inp" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} required />
        <label htmlFor="bdd">মেয়াদ (দিন)</label><input id="bdd" className="inp" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} required />
        <label><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> সব বিষয়</label>
        {!all && subjects.map((s) => (
          <label key={s.id}>
            <input type="checkbox" checked={picked.includes(s.id)} onChange={(e) => setPicked(e.target.checked ? [...picked, s.id] : picked.filter((x) => x !== s.id))} /> {s.name_bn} ({s.level})
          </label>
        ))}
        <button className="cta" type="submit">ব্যাচ তৈরি করো</button>
      </form>
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
    </div>
  );
}

type Pending = {
  id: string; amount_bdt: number; gateway: string; gateway_txn_id: string; created_at: string;
  batches: { title: string } | null;
  profiles: { full_name: string | null; email: string | null; phone: string | null } | null;
};

function Payments() {
  const [rows, setRows] = useState<Pending[] | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const { data, error } = await supabaseBrowser()
      .from("purchases")
      .select("id,amount_bdt,gateway,gateway_txn_id,created_at,batches(title),profiles(full_name,email,phone)")
      .eq("status", "pending")
      .order("created_at");
    if (error) setMsg("লোড হয়নি: " + error.message);
    setRows((data as unknown as Pending[]) ?? []);
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, fn: "approve_purchase" | "reject_purchase") {
    setMsg("");
    const { error } = await supabaseBrowser().rpc(fn, { p_purchase_id: id });
    if (error) return setMsg("হয়নি: " + error.message);
    setMsg(fn === "approve_purchase" ? "অনুমোদন হয়েছে, ব্যাচ চালু।" : "বাতিল করা হয়েছে।");
    load();
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3>পেমেন্ট যাচাই</h3>
      <p>bKash/Nagad/Rocket অ্যাপে TrxID ও টাকার অঙ্ক মিলিয়ে তারপর অনুমোদন দাও।</p>
      {rows === null ? <p>লোড হচ্ছে...</p> : rows.length === 0 ? <p style={{ color: "var(--mute)" }}>কোনো অপেক্ষমাণ অনুরোধ নেই।</p> : rows.map((r) => (
        <div key={r.id} style={{ borderTop: "1px solid #2a3170", paddingTop: 8, marginTop: 8 }}>
          <p style={{ margin: 0 }}>
            <b>{r.profiles?.full_name || r.profiles?.email || r.profiles?.phone || "অজানা"}</b>
            {r.profiles?.email ? ` · ${r.profiles.email}` : ""}
          </p>
          <p style={{ margin: "4px 0" }}>{r.batches?.title}: <b>{r.amount_bdt} টাকা</b> · {r.gateway} · TrxID <b>{r.gateway_txn_id}</b></p>
          <div className="row">
            <button className="cta" type="button" onClick={() => act(r.id, "approve_purchase")}>অনুমোদন</button>
            <button className="cta" type="button" style={{ background: "transparent", border: "1px solid #2a3170" }} onClick={() => act(r.id, "reject_purchase")}>বাতিল</button>
          </div>
        </div>
      ))}
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}
    </div>
  );
}
