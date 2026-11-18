const CONTACT = process.env.NEXT_PUBLIC_CONTACT ?? "";

export default function Footer() {
  return (
    <footer className="foot">
      <a href="/terms">শর্তাবলি</a>
      <a href="/privacy">প্রাইভেসি পলিসি</a>
      <a href="/refund">রিফান্ড পলিসি</a>
      {CONTACT && <span>যোগাযোগ: {CONTACT}</span>}
    </footer>
  );
}
