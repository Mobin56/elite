const CONTACT = process.env.NEXT_PUBLIC_CONTACT ?? "";

export default function Legal({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="wrap legal">
      <h1>{title}</h1>
      <p style={{ color: "var(--mute)" }}>সর্বশেষ হালনাগাদ: {updated}</p>
      {children}
      <h2>যোগাযোগ</h2>
      <p>{CONTACT ? `প্রশ্ন বা অভিযোগ থাকলে যোগাযোগ করো: ${CONTACT}` : "প্রশ্ন বা অভিযোগ থাকলে আমাদের সাপোর্টে জানাও।"}</p>
    </main>
  );
}
