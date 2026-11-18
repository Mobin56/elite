"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useRequireUser } from "@/lib/hooks";
import { bn, bnDate } from "@/lib/format";

type Batch = { id: string; title: string; description: string | null; price_bdt: number; duration_days: number; all_subjects: boolean };
type Purchase = { id: string; amount_bdt: number; status: "pending" | "paid" | "failed" | "refunded"; created_at: string; expires_at: string | null; batches: { title: string } | null };

const PAY_NUMBER = process.env.NEXT_PUBLIC_PAY_NUMBER ?? "";
const METHODS = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket" } as const;
type Method = keyof typeof METHODS;

const STATUS: Record<Purchase["status"], string> = { pending: "যাচাই চলছে", paid: "চালু", failed: "বাতিল", refunded: "ফেরত" };

function friendly(msg: string): string {
  if (msg.includes("invalid coupon")) return "কুপনটি সঠিক নয় বা মেয়াদ শেষ।";
  if (msg.includes("already submitted")) return "এই ট্রানজেকশন আইডি আগেই জমা দেওয়া হয়েছে।";
  if (msg.includes("invalid transaction id")) return "ট্রানজেকশন আইডি সঠিক নয়। শুধু ইংরেজি অক্ষর ও সংখ্যা, ৬ থেকে ৪০ অক্ষর।";
  if (msg.includes("too many pending")) return "তোমার ৩টি অনুরোধ যাচাইয়ের অপেক্ষায় আছে। অনুমোদনের পর আবার চেষ্টা করো।";
  return msg;
}

export default function BatchesPage() {
  const uid = useRequireUser();
  const [batches, setBatches] = useState<Batch[] | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [sel, setSel] = useState<Batch | null>(null);
  const [coupon, setCoupon] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<Method>("bkash");
  const [trx, setTrx] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const sb = supabaseBrowser();
    const [b, bs, p] = await Promise.all([
      sb.from("batches").select("id,title,description,price_bdt,duration_days,all_subjects").eq("is_active", true).order("price_bdt"),
      sb.from("batch_subjects").select("batch_id"),
      sb.from("purchases").select("id,amount_bdt,status,created_at,expires_at,batches(title)").order("created_at", { ascending: false }),
    ]);
    // a batch for chosen subjects that has no subject attached would unlock nothing, so it is hidden
    const mapped = new Set((bs.data ?? []).map((x) => x.batch_id as string));
    setBatches(((b.data as Batch[]) ?? []).filter((x) => x.all_subjects || mapped.has(x.id)));
    setPurchases((p.data as unknown as Purchase[]) ?? []);
  }

  useEffect(() => { if (uid) load(); }, [uid]);

  function choose(b: Batch) {
    setSel(b); setAmount(b.price_bdt); setCoupon(""); setTrx(""); setMsg("");
  }

  async function applyCoupon() {
    if (!sel) return;
    setMsg("");
    const { data, error } = await supabaseBrowser().rpc("quote_price", { p_batch_id: sel.id, p_coupon_code: coupon });
    if (error) { setAmount(sel.price_bdt); return setMsg(friendly(error.message)); }
    const row = (data as { q_amount: number }[])[0];
    setAmount(row.q_amount);
    setMsg(coupon.trim() ? "কুপন প্রয়োগ হয়েছে।" : "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!sel) return;
    setBusy(true); setMsg("");
    const { error } = await supabaseBrowser().rpc("request_purchase", { p_batch_id: sel.id, p_coupon_code: coupon, p_gateway: method, p_txn_id: trx });
    setBusy(false);
    if (error) return setMsg(friendly(error.message));
    setMsg("অনুরোধ জমা হয়েছে। পেমেন্ট যাচাই হলে ব্যাচ চালু হবে।");
    setSel(null); setTrx(""); setCoupon("");
    load();
  }

  if (!uid || batches === null) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>প্রিমিয়াম ব্যাচ</h1>
      <p style={{ color: "var(--mute)" }}>ব্যাচে জয়েন করলে প্রতিটা প্রশ্নের ব্যাখ্যা ও প্রশ্নব্যাংকের উত্তর দেখতে পাবে।</p>

      {batches.length === 0 && <p style={{ color: "var(--mute)" }}>এখন কোনো ব্যাচ চালু নেই।</p>}
      {batches.map((b) => (
        <div className="card" key={b.id} style={{ marginTop: 12 }}>
          <h3>{b.title}</h3>
          <p>{bn(b.price_bdt)} টাকা · {bn(b.duration_days)} দিন · {b.all_subjects ? "সব বিষয়" : "নির্দিষ্ট বিষয়"}</p>
          {b.description && <p>{b.description}</p>}
          <button className="cta" type="button" onClick={() => choose(b)}>এই ব্যাচ নাও</button>
        </div>
      ))}

      {sel && (
        <form className="card" onSubmit={submit} style={{ marginTop: 16 }}>
          <h3>{sel.title}: পেমেন্ট</h3>
          <label htmlFor="cp">কুপন (থাকলে)</label>
          <div className="row">
            <input id="cp" className="inp" style={{ flex: 1 }} value={coupon} onChange={(e) => setCoupon(e.target.value)} />
            <button type="button" className="chip" onClick={applyCoupon}>প্রয়োগ করো</button>
          </div>
          <p><b>দিতে হবে: {bn(amount ?? sel.price_bdt)} টাকা</b></p>

          <label htmlFor="mt">কীভাবে পাঠিয়েছ</label>
          <select id="mt" className="inp" value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            {(Object.keys(METHODS) as Method[]).map((k) => <option key={k} value={k}>{METHODS[k]}</option>)}
          </select>

          {PAY_NUMBER ? (
            <p>এই নম্বরে <b>{bn(amount ?? sel.price_bdt)} টাকা</b> Send Money করো: <b>{PAY_NUMBER}</b>। তারপর নিচে ট্রানজেকশন আইডি (TrxID) বসাও।</p>
          ) : (
            <p role="alert" style={{ color: "#ffb86b" }}>পেমেন্ট নম্বর এখনো সেট করা হয়নি। অ্যাডমিনকে জানাও।</p>
          )}

          <label htmlFor="tx">ট্রানজেকশন আইডি (TrxID)</label>
          <input id="tx" className="inp" value={trx} onChange={(e) => setTrx(e.target.value)} required autoCapitalize="characters" />
          <button className="cta" type="submit" disabled={busy || !PAY_NUMBER}>জমা দাও</button>
        </form>
      )}
      {msg && <p role="status" style={{ color: "var(--mute)" }}>{msg}</p>}

      <h2>আমার অনুরোধ</h2>
      {purchases.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>এখনো কিছু নাওনি।</p>
      ) : (
        <div className="card">
          {purchases.map((p) => (
            <p key={p.id} style={{ margin: "8px 0" }}>
              {p.batches?.title ?? "ব্যাচ"} · {bn(p.amount_bdt)} টাকা · {bnDate(p.created_at)}: <b>{STATUS[p.status]}</b>
              {p.status === "paid" && p.expires_at ? ` (${bnDate(p.expires_at)} পর্যন্ত)` : ""}
            </p>
          ))}
        </div>
      )}
    </main>
  );
}
