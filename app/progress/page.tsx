"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase";
import { useRequireUser } from "@/lib/hooks";
import { bn, bnDate } from "@/lib/format";

type Zone = { subject_id: string; chapter_id: string; answered: number; correct: number; accuracy: number; zone: "strong" | "confused" | "weak" };
type Attempt = { id: string; mode: string; score: number; total: number; created_at: string };

const ZONE_LABEL = { strong: "স্ট্রং", confused: "কনফিউজড", weak: "উইক" } as const;
const MODE_LABEL: Record<string, string> = { chapter: "অধ্যায়", model: "মডেল টেস্ট", board: "বোর্ড", university: "বিশ্ববিদ্যালয়", retake: "ভুলের খাতা" };

export default function ProgressPage() {
  const uid = useRequireUser();
  const [zones, setZones] = useState<Zone[] | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [streak, setStreak] = useState({ cur: 0, best: 0 });

  useEffect(() => {
    if (!uid) return;
    (async () => {
      const sb = supabaseBrowser();
      const [z, a, s, ch, sj] = await Promise.all([
        sb.from("chapter_zones").select("subject_id,chapter_id,answered,correct,accuracy,zone").eq("user_id", uid),
        sb.from("attempts").select("id,mode,score,total,created_at").eq("user_id", uid).order("created_at", { ascending: false }).limit(10),
        sb.from("streaks").select("current_streak,longest_streak").eq("user_id", uid).maybeSingle(),
        sb.from("chapters").select("id,name_bn"),
        sb.from("subjects").select("id,name_bn"),
      ]);
      const n: Record<string, string> = {};
      (ch.data ?? []).forEach((x) => (n[x.id as string] = x.name_bn as string));
      (sj.data ?? []).forEach((x) => (n[x.id as string] = x.name_bn as string));
      setNames(n);
      setZones(((z.data as Zone[]) ?? []).sort((x, y) => Number(x.accuracy) - Number(y.accuracy)));
      setAttempts((a.data as Attempt[]) ?? []);
      setStreak({ cur: s.data?.current_streak ?? 0, best: s.data?.longest_streak ?? 0 });
    })();
  }, [uid]);

  if (!uid || zones === null) return <main className="wrap"><p>লোড হচ্ছে...</p></main>;

  return (
    <main className="wrap" style={{ maxWidth: 640 }}>
      <h1>আমার প্রগ্রেস</h1>
      <p style={{ color: "var(--mute)" }}>স্ট্রিক: {bn(streak.cur)} দিন (সর্বোচ্চ {bn(streak.best)} দিন)</p>

      <h2>অধ্যায় অনুযায়ী জোন</h2>
      {zones.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>পরীক্ষা দিলে এখানে দেখবে কোন অধ্যায়ে তুমি দুর্বল। সবচেয়ে দুর্বল অধ্যায় আগে দেখানো হয়।</p>
      ) : (
        <div className="card">
          {zones.map((z) => (
            <p key={z.chapter_id} style={{ margin: "8px 0" }}>
              {names[z.subject_id]} · {names[z.chapter_id]}: <b>{ZONE_LABEL[z.zone]}</b> ({bn(z.correct)}/{bn(z.answered)}, {bn(Math.round(Number(z.accuracy)))}%)
            </p>
          ))}
        </div>
      )}

      <h2>সাম্প্রতিক পরীক্ষা</h2>
      {attempts.length === 0 ? (
        <p style={{ color: "var(--mute)" }}>এখনো কোনো পরীক্ষা দাওনি।</p>
      ) : (
        <div className="card">
          {attempts.map((a) => (
            <p key={a.id} style={{ margin: "8px 0" }}>
              {bnDate(a.created_at)} · {MODE_LABEL[a.mode] ?? a.mode}: <b>{bn(a.score)}/{bn(a.total)}</b>
            </p>
          ))}
        </div>
      )}
      <a className="cta" href="/exam">পরীক্ষা দাও</a>
    </main>
  );
}
