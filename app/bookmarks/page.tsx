"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useRequireUser } from "@/lib/hooks";
import { bn } from "@/lib/format";

type Item = { id: string; body: string; options: string[] };

export default function BookmarksPage() {
  const uid = useRequireUser();
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const sb = supabaseBrowser();
      const { data: bm } = await sb.from("bookmarks").select("question_id").eq("user_id", uid).order("created_at", { ascending: false });
      const ids = (bm ?? []).map((b) => b.question_id as string);
      if (ids.length === 0) { setItems([]); return; }
      const { data: qs } = await sb.from("questions").select("id,body,options").in("id", ids);
      const byId = new Map((qs ?? []).map((q) => [q.id as string, q as Item]));
      setItems(ids.map((id) => byId.get(id)).filter((x): x is Item => !!x));
    })();
  }, [uid]);

  async function remove(id: string) {
    setErr("");
    const { error } = await supabaseBrowser().from("bookmarks").delete().eq("user_id", uid!).eq("question_id", id);
    if (error) return setErr("সরানো যায়নি: " + error.message);
    setItems((items ?? []).filter((x) => x.id !== id));
  }

  if (!uid || items === null) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>বুকমার্ক</h1>
      {err && <p role="alert" style={{ color: "#ff8f8f" }}>{err}</p>}
      {items.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>এখনো কোনো প্রশ্ন সেভ করোনি। পরীক্ষার সময় "সেভ করো" বাটনে চাপ দিলে এখানে জমবে।</p>
      ) : (
        <>
          <p style={{ color: "var(--mute)" }}>{bn(items.length)}টি সেভ করা প্রশ্ন।</p>
          {items.map((q) => (
            <div className="card" key={q.id} style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0 }}><b>{q.body}</b></p>
              {q.options.map((o, k) => <div className="opt" key={k}>{o}</div>)}
              <button type="button" className="chip" onClick={() => remove(q.id)}>সরিয়ে দাও</button>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
