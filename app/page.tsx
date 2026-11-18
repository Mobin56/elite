import AuthRedirect from "@/components/AuthRedirect";

const FEATURES = [
  { t: "অধ্যায় ধরে পরীক্ষা", d: "প্রতিটা অধ্যায়ের আলাদা প্র্যাকটিস সেট।" },
  { t: "মডেল টেস্ট", d: "পুরো সিলেবাসের টাইমড মডেল টেস্ট।" },
  { t: "বোর্ড ও বিশ্ববিদ্যালয় ধরে", d: "আগের বছরের প্রশ্ন বোর্ড ও ভর্তি পরীক্ষা অনুযায়ী।" },
  { t: "জোন রিপোর্ট", d: "কোন অধ্যায়ে তুমি স্ট্রং, কনফিউজড বা উইক, এক নজরে।" },
  { t: "ভুলের খাতা", d: "ভুল প্রশ্নগুলো জমা থাকে, আবার পরীক্ষা দিয়ে ঠিক করো।" },
  { t: "প্রিমিয়াম ব্যাখ্যা", d: "ব্যাচে জয়েন করলে প্রতিটা প্রশ্নের ব্যাখ্যা ও পুরো প্রশ্নব্যাংক।" },
];

export default function Home() {
  return (
    <main className="wrap">
      <AuthRedirect />
      <section className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="logo" src="/logo.jpg" alt="Elite Academic & Admission Aid" />
        <h1>SSC থেকে ভর্তি, এক জায়গায় প্রস্তুতি</h1>
        <p>নিজের দুর্বল অধ্যায় চিনে নাও, তারপর সেটাই বারবার অনুশীলন করো।</p>
        <a className="cta" href="/exam">পরীক্ষা শুরু করো</a>{" "}
        <a className="cta" href="/login" style={{ background: "transparent", border: "1px solid #2a3170" }}>লগইন</a>
      </section>

      <section className="grid">
        {FEATURES.map((f) => (
          <div className="card" key={f.t}>
            <h3>{f.t}</h3>
            <p>{f.d}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
