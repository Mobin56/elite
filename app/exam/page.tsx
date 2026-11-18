"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";

type Level = "ssc" | "hsc" | "admission";
type Mode = "chapter" | "model" | "board" | "university";
type Subject = { id: string; level: Level; name_bn: string };
type Chapter = { id: string; subject_id: string; name_bn: string };
type Named = { id: string; name_bn: string };
type Q = { id: string; body: string; options: string[]; chapter_id: string; subject_id: string };
type Result = { question_id: string; selected_index: number | null; is_correct: boolean; correct_index: number; explanation: string | null; explanation_locked: boolean };
type Outcome = { attempt_id: string; score: number; total: number; results: Result[] };

const LEVELS: Record<Level, string> = { ssc: "SSC", hsc: "HSC", admission: "ভর্তি" };
const MODES: Record<Mode, string> = { chapter: "অধ্যায় ধরে", model: "মডেল টেস্ট", board: "বোর্ড ধরে", university: "বিশ্ববিদ্যালয় ধরে" };
const SIZE: Record<Mode, number> = { chapter: 10, board: 10, university: 10, model: 20 };
const bn = (n: number) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[Number(d)]);

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

export default function ExamPage() {
  const [ready, setReady] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [boards, setBoards] = useState<Named[]>([]);
  const [unis, setUnis] = useState<Named[]>([]);

  const [level, setLevel] = useState<Level>("ssc");
  const [mode, setMode] = useState<Mode>("chapter");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [boardId, setBoardId] = useState("");
  const [uniId, setUniId] = useState("");
  const [pool, setPool] = useState<Q[]>([]);

  const [phase, setPhase] = useState<"pick" | "exam" | "result">("pick");
  const [set, setSet] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [i, setI] = useState(0);
  const [secs, setSecs] = useState(0);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const t0 = useRef(0);
  const [retake, setRetake] = useState(false);
  const [marks, setMarks] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const sb = supabaseBrowser();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) { window.location.href = "/login"; return; }
      const [s, c, b, un, p] = await Promise.all([
        sb.from("subjects").select("id,level,name_bn").order("position"),
        sb.from("chapters").select("id,subject_id,name_bn").order("position"),
        sb.from("boards").select("id,name_bn").order("name_bn"),
        sb.from("universities").select("id,name_bn").order("name_bn"),
        sb.from("profiles").select("level").eq("id", u.user.id).single(),
      ]);
      setSubjects((s.data as Subject[]) ?? []);
      setChapters((c.data as Chapter[]) ?? []);
      setBoards((b.data as Named[]) ?? []);
      setUnis((un.data as Named[]) ?? []);
      if (p.data?.level) setLevel(p.data.level as Level);
      const { data: bm } = await sb.from("bookmarks").select("question_id").eq("user_id", u.user.id);
      setMarks(new Set((bm ?? []).map((b) => b.question_id as string)));
      setRetake(new URLSearchParams(window.location.search).get("retake") === "1");
      setReady(true);
    })();
  }, []);

  const levelSubjects = useMemo(() => subjects.filter((s) => s.level === level), [subjects, level]);
  const modes: Mode[] = level === "admission" ? ["chapter", "model", "university"] : ["chapter", "model", "board"];
  const chapterList = chapters.filter((c) => c.subject_id === subjectId);

  // keep selections valid when the level or mode changes
  useEffect(() => { if (!modes.includes(mode)) setMode("chapter"); }, [level]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setSubjectId(levelSubjects[0]?.id ?? ""); }, [levelSubjects]);
  useEffect(() => { setChapterId(chapterList[0]?.id ?? ""); }, [subjectId, chapters]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!boardId && boards[0]) setBoardId(boards[0].id); }, [boards, boardId]);
  useEffect(() => { if (!uniId && unis[0]) setUniId(unis[0].id); }, [unis, uniId]);

  // load the matching questions (answers are never part of this query)
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      if (retake) {
        const sb = supabaseBrowser();
        const { data: u } = await sb.auth.getUser();
        const { data: wn } = await sb.from("wrong_notebook").select("question_id").eq("user_id", u.user?.id ?? "").limit(200);
        const wids = (wn ?? []).map((w) => w.question_id as string);
        if (wids.length === 0) { if (!cancelled) setPool([]); return; }
        const { data } = await sb.from("questions").select("id,body,options,chapter_id,subject_id").in("id", wids).eq("is_active", true);
        if (!cancelled) setPool((data as Q[]) ?? []);
        return;
      }
      const ids = levelSubjects.map((s) => s.id);
      if (ids.length === 0) { setPool([]); return; }
      let q = supabaseBrowser().from("questions").select("id,body,options,chapter_id,subject_id").in("subject_id", ids).eq("is_active", true).limit(500);
      if (mode === "chapter") { if (!chapterId) { setPool([]); return; } q = q.eq("chapter_id", chapterId); }
      if (mode === "board") { if (!boardId) { setPool([]); return; } q = q.eq("board_id", boardId); }
      if (mode === "university") { if (!uniId) { setPool([]); return; } q = q.eq("university_id", uniId); }
      const { data } = await q;
      if (!cancelled) setPool((data as Q[]) ?? []);
    })();
    return () => { cancelled = true; };
  }, [ready, retake, levelSubjects, mode, chapterId, boardId, uniId]);

  useEffect(() => {
    if (phase !== "exam") return;
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0.current) / 1000)), 500);
    return () => clearInterval(id);
  }, [phase]);

  function start() {
    const picked = shuffle(pool).slice(0, retake ? 20 : SIZE[mode]);
    if (picked.length === 0) return;
    setSet(picked); setAnswers(Array(picked.length).fill(null)); setI(0); setSecs(0); setErr(""); setOutcome(null);
    t0.current = Date.now();
    setPhase("exam");
  }

  async function finish() {
    setBusy(true); setErr("");
    const secsUsed = Math.floor((Date.now() - t0.current) / 1000);
    const { data, error } = await supabaseBrowser().rpc("submit_attempt", {
      p_mode: retake ? "retake" : mode,
      p_subject_id: !retake && mode === "chapter" ? subjectId : null,
      p_chapter_id: !retake && mode === "chapter" ? chapterId : null,
      p_board_id: !retake && mode === "board" ? boardId : null,
      p_university_id: !retake && mode === "university" ? uniId : null,
      p_duration_seconds: secsUsed,
      p_answers: set.map((q, k) => ({ question_id: q.id, selected_index: answers[k] })),
    });
    setBusy(false);
    if (error) { setErr("জমা দেওয়া যায়নি: " + error.message); return; }
    setSecs(secsUsed);
    setOutcome(data as Outcome);
    setPhase("result");
    window.scrollTo(0, 0);
  }

  async function toggleMark(id: string) {
    const sb = supabaseBrowser();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return;
    if (marks.has(id)) {
      const { error } = await sb.from("bookmarks").delete().eq("user_id", u.user.id).eq("question_id", id);
      if (!error) setMarks((m) => { const n = new Set(m); n.delete(id); return n; });
    } else {
      const { error } = await sb.from("bookmarks").insert({ user_id: u.user.id, question_id: id });
      if (!error) setMarks((m) => new Set(m).add(id));
    }
  }

  const markBtn = (id: string) => (
    <button type="button" className="chip" aria-pressed={marks.has(id)} onClick={() => toggleMark(id)}>
      {marks.has(id) ? "★ সেভ করা" : "☆ সেভ করো"}
    </button>
  );

  if (!ready) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  const mm = (s: number) => bn(Math.floor(s / 60)).padStart(2, "০") + ":" + bn(s % 60).padStart(2, "০");

  if (phase === "pick" && retake)
    return (
      <main className="wrap" style={{ maxWidth: 640 }}>
        <h1>ভুলের খাতা থেকে পরীক্ষা</h1>
        <p style={{ color: "var(--mute)" }}>
          {pool.length === 0 ? "ভুলের খাতা এখন ফাঁকা। দারুণ!" : `${bn(pool.length)}টি ভুল প্রশ্ন আছে। এবার আসবে ${bn(Math.min(20, pool.length))}টি। ঠিক উত্তর দিলে প্রশ্নটা খাতা থেকে সরে যাবে।`}
        </p>
        <button className="cta" type="button" disabled={pool.length === 0} onClick={start}>পরীক্ষা শুরু করো</button>
        <button className="cta" type="button" style={{ background: "transparent", border: "1px solid #2a3170" }} onClick={() => setRetake(false)}>সাধারণ পরীক্ষা দাও</button>
      </main>
    );

  if (phase === "pick")
    return (
      <main className="wrap" style={{ maxWidth: 640 }}>
        <h1>পরীক্ষা দাও</h1>

        <label>স্তর</label>
        <div className="row">
          {(Object.keys(LEVELS) as Level[]).map((k) => (
            <button key={k} type="button" className={"chip" + (level === k ? " on" : "")} aria-pressed={level === k} onClick={() => setLevel(k)}>{LEVELS[k]}</button>
          ))}
        </div>

        <label>পরীক্ষার ধরন</label>
        <div className="row">
          {modes.map((k) => (
            <button key={k} type="button" className={"chip" + (mode === k ? " on" : "")} aria-pressed={mode === k} onClick={() => setMode(k)}>{MODES[k]}</button>
          ))}
        </div>

        {mode === "chapter" && (
          <>
            <label htmlFor="sj">বিষয়</label>
            <select id="sj" className="inp" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {levelSubjects.map((s) => <option key={s.id} value={s.id}>{s.name_bn}</option>)}
            </select>
            <label htmlFor="ch">অধ্যায়</label>
            <select id="ch" className="inp" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
              {chapterList.map((c) => <option key={c.id} value={c.id}>{c.name_bn}</option>)}
            </select>
          </>
        )}
        {mode === "board" && (
          <>
            <label htmlFor="bd">বোর্ড</label>
            <select id="bd" className="inp" value={boardId} onChange={(e) => setBoardId(e.target.value)}>
              {boards.map((b) => <option key={b.id} value={b.id}>{b.name_bn}</option>)}
            </select>
          </>
        )}
        {mode === "university" && (
          <>
            <label htmlFor="un">বিশ্ববিদ্যালয়</label>
            <select id="un" className="inp" value={uniId} onChange={(e) => setUniId(e.target.value)}>
              {unis.map((b) => <option key={b.id} value={b.id}>{b.name_bn}</option>)}
            </select>
          </>
        )}

        <p style={{ color: "var(--mute)" }}>
          {pool.length === 0 ? "এই বাছাইয়ে এখনো কোনো প্রশ্ন নেই।" : `${bn(pool.length)}টি প্রশ্ন আছে। পরীক্ষায় আসবে ${bn(Math.min(SIZE[mode], pool.length))}টি।`}
        </p>
        <button className="cta" type="button" disabled={pool.length === 0} onClick={start}>পরীক্ষা শুরু করো</button>
      </main>
    );

  if (phase === "exam") {
    const q = set[i];
    const last = i === set.length - 1;
    return (
      <main className="wrap" style={{ maxWidth: 640 }}>
        <div style={{ display: "flex", justifyContent: "space-between", color: "var(--mute)" }}>
          <span>প্রশ্ন {bn(i + 1)} / {bn(set.length)}</span><span>{mm(secs)}</span>
        </div>
        <progress value={i} max={set.length} style={{ width: "100%" }} aria-label="অগ্রগতি" />
        <h2 style={{ fontSize: "1.2rem" }}>{q.body}</h2>
        {markBtn(q.id)}
        {q.options.map((o, k) => (
          <button key={k} type="button" className={"opt" + (answers[i] === k ? " sel" : "")} aria-pressed={answers[i] === k}
            onClick={() => setAnswers(answers.map((a, x) => (x === i ? k : a)))}>{o}</button>
        ))}
        <div className="row" style={{ marginTop: 16 }}>
          <button className="cta" type="button" disabled={i === 0} onClick={() => setI(i - 1)}>আগের</button>
          {last ? (
            <button className="cta" type="button" disabled={busy} onClick={finish}>পরীক্ষা শেষ করো</button>
          ) : (
            <button className="cta" type="button" onClick={() => setI(i + 1)}>পরের</button>
          )}
        </div>
        <p style={{ color: "var(--mute)" }}>উত্তর দেওয়া হয়েছে {bn(answers.filter((a) => a !== null).length)} / {bn(set.length)}</p>
        {err && <p role="alert" style={{ color: "#ff8f8f" }}>{err}</p>}
      </main>
    );
  }

  // result
  const res = new Map((outcome?.results ?? []).map((r) => [r.question_id, r]));
  const zone = new Map<string, { ok: number; n: number }>();
  set.forEach((q) => {
    const r = res.get(q.id);
    const z = zone.get(q.chapter_id) ?? { ok: 0, n: 0 };
    z.n++; if (r?.is_correct) z.ok++;
    zone.set(q.chapter_id, z);
  });
  const chName = (id: string) => chapters.find((c) => c.id === id)?.name_bn ?? "";
  const locked = (outcome?.results ?? []).some((r) => r.explanation_locked);

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <p style={{ color: "var(--mute)" }}>তোমার ফলাফল</p>
      <div style={{ fontSize: "3rem", fontWeight: 700 }}>{bn(outcome?.score ?? 0)} / {bn(outcome?.total ?? 0)}</div>
      <p style={{ color: "var(--mute)" }}>সময় লেগেছে {mm(secs)}</p>

      <h2>জোন রিপোর্ট</h2>
      <div className="card">
        {[...zone.entries()].map(([id, z]) => {
          const p = (z.ok / z.n) * 100;
          const label = p >= 70 ? "স্ট্রং" : p >= 50 ? "কনফিউজড" : "উইক";
          return <p key={id} style={{ margin: "6px 0" }}>{chName(id)}: <b>{label}</b> ({bn(z.ok)}/{bn(z.n)})</p>;
        })}
      </div>

      <h2>উত্তর মিলিয়ে দেখো</h2>
      {locked && <p style={{ color: "var(--mute)" }}>ব্যাখ্যা দেখতে প্রিমিয়াম ব্যাচে জয়েন করতে হবে।</p>}
      {set.map((q) => {
        const r = res.get(q.id);
        return (
          <div className="card" key={q.id} style={{ marginTop: 12 }}>
            <p style={{ marginTop: 0 }}><b>{q.body}</b></p>
            {markBtn(q.id)}
            {q.options.map((o, k) => (
              <div key={k} className={"opt" + (r && k === r.correct_index ? " ok" : r && k === r.selected_index ? " no" : "")}>{o}</div>
            ))}
            {r && r.selected_index === null && <p style={{ color: "var(--mute)" }}>উত্তর দাওনি।</p>}
            {r?.explanation && <p className="ex"><b>ব্যাখ্যা:</b> {r.explanation}</p>}
            {r?.explanation_locked && <p className="ex lock">🔒 ব্যাখ্যা প্রিমিয়ামে</p>}
          </div>
        );
      })}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="cta" type="button" onClick={start}>আবার পরীক্ষা দাও</button>
        <button className="cta" type="button" onClick={() => setPhase("pick")}>বাছাই বদলাও</button>
      </div>
    </main>
  );
}
