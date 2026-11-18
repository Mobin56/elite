"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useRequireUser } from "@/lib/hooks";
import { bn } from "@/lib/format";

type Item = { id: string; body: string; options: string[]; wrong: number };

export default function NotebookPage() {
  const uid = useRequireUser();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const sb = supabaseBrowser();
      const { data: wn } = await sb.from("wrong_notebook").select("question_id,wrong_count").eq("user_id", uid).order("last_wrong_at", { ascending: false });
      const ids = (wn ?? []).map((w) => w.question_id as string);
      if (ids.length === 0) { setItems([]); return; }
      const { data: qs } = await sb.from("questions").select("id,body,options").in("id", ids);
      const byId = new Map((qs ?? []).map((q) => [q.id as string, q]));
      setItems(
        (wn ?? [])
          .map((w) => {
            const q = byId.get(w.question_id as string);
            return q ? { id: q.id as string, body: q.body as string, options: q.options as string[], wrong: w.wrong_count as number } : null;
          })
          .filter((x): x is Item => x !== null)
      );
    })();
  }, [uid]);

  if (!uid || items === null) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>ভুলের খাতা</h1>
      {items.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>এখনো কোনো ভুল জমেনি। পরীক্ষা দিলে ভুল প্রশ্নগুলো এখানে আসবে। ঠিক উত্তর দিলে প্রশ্নটা খাতা থেকে সরে যাবে।</p>
      ) : (
        <>
          <p style={{ color: "var(--mute)" }}>{bn(items.length)}টি প্রশ্ন ঠিক করা বাকি।</p>
          <a className="cta" href="/exam?retake=1">ভুলগুলো আবার পরীক্ষা দাও</a>
          {items.map((q) => (
            <div className="card" key={q.id} style={{ marginTop: 12 }}>
              <p style={{ marginTop: 0 }}><b>{q.body}</b></p>
              {q.options.map((o, k) => <div className="opt" key={k}>{o}</div>)}
              <p style={{ color: "var(--mute)", marginBottom: 0 }}>{bn(q.wrong)} বার ভুল</p>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
