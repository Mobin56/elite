"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useRequireUser } from "@/lib/hooks";
import { bn } from "@/lib/format";

type Level = "ssc" | "hsc" | "admission";
type Subject = { id: string; level: Level; name_bn: string };
type Chapter = { id: string; subject_id: string; name_bn: string };
type Q = { id: string; body: string; options: string[]; chapter_id: string };
type Key = { question_id: string; correct_index: number; explanation: string | null };

const LEVELS: Record<Level, string> = { ssc: "SSC", hsc: "HSC", admission: "ভর্তি" };
const PAGE = 50;

export default function BankPage() {
  const uid = useRequireUser();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [level, setLevel] = useState<Level>("ssc");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [qs, setQs] = useState<Q[]>([]);
  const [page, setPage] = useState(0);
  const [keys, setKeys] = useState<Map<string, Key>>(new Map());
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const sb = supabaseBrowser();
      const [s, c] = await Promise.all([
        sb.from("subjects").select("id,level,name_bn").order("position"),
        sb.from("chapters").select("id,subject_id,name_bn").order("position"),
      ]);
      setSubjects((s.data as Subject[]) ?? []);
      setChapters((c.data as Chapter[]) ?? []);
    })();
  }, [uid]);

  const levelSubjects = subjects.filter((s) => s.level === level);
  const chapterList = chapters.filter((c) => c.subject_id === subjectId);

  useEffect(() => { setSubjectId(levelSubjects[0]?.id ?? ""); }, [level, subjects]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setChapterId(""); setPage(0); }, [subjectId]);

  useEffect(() => {
    if (!subjectId) { setQs([]); return; }
    let cancelled = false;
    (async () => {
      let q = supabaseBrowser().from("questions").select("id,body,options,chapter_id").eq("subject_id", subjectId).eq("is_active", true).order("created_at").range(page * PAGE, page * PAGE + PAGE - 1);
      if (chapterId) q = q.eq("chapter_id", chapterId);
      const { data } = await q;
      if (cancelled) return;
      setQs((data as Q[]) ?? []);
      setKeys(new Map());
      setLocked(false);
    })();
    return () => { cancelled = true; };
  }, [subjectId, chapterId, page]);

  async function reveal() {
    setBusy(true);
    const { data, error } = await supabaseBrowser().rpc("get_answer_keys", { p_question_ids: qs.map((q) => q.id) });
    setBusy(false);
    if (error) { setLocked(true); return; }
    const rows = (data as Key[]) ?? [];
    if (rows.length === 0) { setLocked(true); return; }
    setKeys(new Map(rows.map((r) => [r.question_id, r])));
  }

  if (!uid) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>প্রশ্নব্যাংক</h1>

      <div className="row">
        {(Object.keys(LEVELS) as Level[]).map((k) => (
          <button key={k} type="button" className={"chip" + (level === k ? " on" : "")} aria-pressed={level === k} onClick={() => setLevel(k)}>{LEVELS[k]}</button>
        ))}
      </div>
      <label htmlFor="sj">বিষয়</label>
      <select id="sj" className="inp" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
        {levelSubjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
      </select>
      <label htmlFor="ch">অধ্যায়</label>
      <select id="ch" className="inp" value={chapterId} onChange={(e) => { setChapterId(e.target.value); setPage(0); }}>
        <option value="">সব অধ্যায়</option>
        {chapterList.map((c) => <option key={c.id} value={c.id}>{c.name_bn}</option>)}
      </select>

      {qs.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>এই বাছাইয়ে কোনো প্রশ্ন নেই।</p>
      ) : (
        <>
          <button className="cta" type="button" onClick={reveal} disabled={busy}>উত্তর ও ব্যাখ্যা দেখাও</button>
          {locked && (
            <p className="ex lock">🔒 উত্তর ও ব্যাখ্যা দেখতে প্রিমিয়াম ব্যাচ লাগবে। <a href="/batches" style={{ color: "var(--blue)" }}>ব্যাচ দেখো</a></p>
          )}
          {qs.map((q, n) => {
            const k = keys.get(q.id);
            return (
              <div className="card" key={q.id} style={{ marginTop: 12 }}>
                <p style={{ marginTop: 0 }}><b>{bn(page * PAGE + n + 1)}. {q.body}</b></p>
                {q.options.map((o, x) => <div key={x} className={"opt" + (k && x === k.correct_index ? " ok" : "")}>{o}</div>)}
                {k?.explanation && <p className="ex"><b>ব্যাখ্যা:</b> {k.explanation}</p>}
              </div>
            );
          })}
          <div className="row">
            <button className="cta" type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>আগের পাতা</button>
            <button className="cta" type="button" disabled={qs.length < PAGE} onClick={() => setPage(page + 1)}>পরের পাতা</button>
          </div>
        </>
      )}
    </main>
  );
}
