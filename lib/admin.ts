import { supabaseBrowser } from "@/lib/supabase";

export type Level = "ssc" | "hsc" | "admission";

export type QuestionRow = {
  level: Level;
  subject: string;
  chapter: string;
  board?: string;
  university?: string;
  year?: number | null;
  body: string;
  options: string[];
  correct: number; // 0-based
  explanation?: string;
};

export const CSV_HEADER = [
  "level", "subject", "chapter", "board", "university", "year",
  "question", "option1", "option2", "option3", "option4", "correct", "explanation",
];

export function validateRow(r: QuestionRow): string | null {
  if (!["ssc", "hsc", "admission"].includes(r.level)) return "level must be ssc, hsc or admission";
  if (!r.subject.trim() || !r.chapter.trim()) return "subject and chapter are required";
  if (!r.body.trim()) return "question text is empty";
  if (r.options.length < 2 || r.options.some((o) => !o.trim())) return "need at least 2 non-empty options";
  if (!Number.isInteger(r.correct) || r.correct < 0 || r.correct >= r.options.length) return "correct answer is out of range";
  return null;
}

export function rowsFromCsv(table: string[][]): { rows: QuestionRow[]; errors: string[] } {
  const rows: QuestionRow[] = [];
  const errors: string[] = [];
  if (table.length < 2) return { rows, errors: ["File has no data rows."] };
  const head = table[0].map((h) => h.trim().toLowerCase());
  const idx = (n: string) => head.indexOf(n);
  for (const need of ["level", "subject", "chapter", "question", "option1", "option2", "correct"]) {
    if (idx(need) < 0) return { rows, errors: [`Missing column: ${need}`] };
  }
  const get = (r: string[], n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? "").trim() : "");
  table.slice(1).forEach((r, i) => {
    const opts = ["option1", "option2", "option3", "option4", "option5", "option6"].map((n) => get(r, n)).filter((o) => o !== "");
    const row: QuestionRow = {
      level: get(r, "level").toLowerCase() as Level,
      subject: get(r, "subject"),
      chapter: get(r, "chapter"),
      board: get(r, "board") || undefined,
      university: get(r, "university") || undefined,
      year: get(r, "year") ? Number(get(r, "year")) : null,
      body: get(r, "question"),
      options: opts,
      correct: Number(get(r, "correct")) - 1, // file uses 1-based
      explanation: get(r, "explanation") || undefined,
    };
    const err = validateRow(row);
    if (err) errors.push(`Row ${i + 2}: ${err}`);
    else rows.push(row);
  });
  return { rows, errors };
}

// Look up a name, or create it if missing.
async function ensure(table: string, match: Record<string, string>, extra: Record<string, unknown> = {}): Promise<string> {
  const sb = supabaseBrowser();
  let q = sb.from(table).select("id");
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const found = await q.maybeSingle();
  if (found.error) throw new Error(found.error.message);
  if (found.data) return found.data.id as string;
  const made = await sb.from(table).insert({ ...match, ...extra }).select("id").single();
  if (made.error) throw new Error(made.error.message);
  return made.data.id as string;
}

// Save questions and their answer keys. If the keys fail, the questions of that chunk are removed again.
export async function saveQuestions(rows: QuestionRow[]): Promise<{ saved: number; error?: string }> {
  const sb = supabaseBrowser();
  const cache = new Map<string, string>();
  const once = async (key: string, fn: () => Promise<string>) => {
    if (!cache.has(key)) cache.set(key, await fn());
    return cache.get(key)!;
  };
  let saved = 0;
  try {
    const { data: u } = await sb.auth.getUser();
    const uid = u.user?.id ?? null;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const qRows = [];
      for (const r of chunk) {
        const subject_id = await once(`s|${r.level}|${r.subject}`, () => ensure("subjects", { level: r.level, name_bn: r.subject }));
        const chapter_id = await once(`c|${subject_id}|${r.chapter}`, () => ensure("chapters", { subject_id, name_bn: r.chapter }));
        const board_id = r.board ? await once(`b|${r.board}`, () => ensure("boards", { name_bn: r.board! })) : null;
        const university_id = r.university ? await once(`u|${r.university}`, () => ensure("universities", { name_bn: r.university! })) : null;
        qRows.push({ subject_id, chapter_id, board_id, university_id, exam_year: r.year ?? null, body: r.body, options: r.options, created_by: uid });
      }
      const ins = await sb.from("questions").insert(qRows).select("id");
      if (ins.error || !ins.data) throw new Error(ins.error?.message ?? "insert failed");
      const ids = ins.data.map((d) => d.id as string);
      const keys = ids.map((question_id, k) => ({
        question_id,
        correct_index: chunk[k].correct,
        explanation: chunk[k].explanation ?? null,
      }));
      const kr = await sb.from("question_keys").insert(keys);
      if (kr.error) {
        await sb.from("questions").delete().in("id", ids);
        throw new Error("answers not saved: " + kr.error.message);
      }
      saved += ids.length;
    }
    return { saved };
  } catch (e) {
    return { saved, error: e instanceof Error ? e.message : String(e) };
  }
}
