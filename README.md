# Elite Academy

SSC, HSC ar admission exam practice platform. Next.js + Supabase.

## What is done (Phase 0 to 7)

- Next.js project with the Elite logo on the landing page (`public/logo.jpg`)
- Supabase database: `supabase/migrations/0001_schema.sql`
- Sample data: `supabase/seed.sql` (16 questions, 3 batches, coupon `EID50`)
- Login by email link or code (`/login`) and profile page (`/profile`). Phone OTP comes later, when an SMS gateway is chosen.
- Admin panel `/admin`: add questions, CSV bulk upload, create batches and prices, approve payments
- Exam `/exam`: chapter, model, board and university wise, server-side grading, zone report, retake from the wrong-answer notebook
- Student pages: `/notebook`, `/bookmarks`, `/progress`, `/bank` (answers only for premium), `/batches` (buy with bKash/Nagad/Rocket TrxID, coupon)
- `supabase/migrations/0002_purchases.sql`: quote_price, request_purchase, approve_purchase, reject_purchase
- `npm run typecheck` checks the code without starting the server
- Launch steps: see `DEPLOY.md`

The schema was run against a local PostgreSQL 16 with Supabase-style stubs and tested:
students cannot read answer keys, grading happens in `submit_attempt()`, explanations unlock only
with a paid and unexpired batch, wrong-answer notebook and streak update on submit, students only
see their own progress, and a student cannot make themselves admin.
0002 was tested the same way (coupons, duplicate TrxID, students cannot approve or write purchases, expiry). The pages were type-checked but not clicked through in a browser by the author.

## Setup, step by step

1. Install Node.js 20 or newer. In this folder run `npm install`.
2. Create a Supabase project at supabase.com. In Authentication, Providers, keep Email on. In Authentication, Email Templates, Magic Link, add `{{ .Token }}` to the body so the email shows the 6 digit code.
3. Supabase dashboard, SQL Editor: paste the **contents** of `supabase/migrations/0001_schema.sql`, Run.
   Then `0002_purchases.sql`, Run. Then `supabase/seed.sql`, Run (development only).
4. Copy `.env.example` to `.env.local` and fill the three Supabase values (Project Settings, API).
5. `npm run dev` and open http://localhost:3000.
6. Make yourself admin: log in once at /login with your email, then in the SQL Editor run
   `update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'YOUR_EMAIL');`

## Data model in short

| Table | Purpose |
|---|---|
| profiles | One row per user, role: student, teacher or admin |
| subjects, chapters, boards, universities | Content structure |
| questions | Question text and options (students can read) |
| question_keys | Correct answer and explanation (admins only) |
| batches, batch_subjects, coupons, purchases | Selling and access |
| attempts, attempt_answers | Every exam a student took |
| wrong_notebook, bookmarks, streaks | Student progress |
| chapter_zones (view) | Strong, confused or weak per chapter |

Functions: `submit_attempt`, `get_answer_keys`, `has_premium`, `has_bank_access`.

## Rules to keep

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Mark a purchase `paid` only from the server after the payment gateway confirms the payment.
- Do not load `seed.sql` into production.

## Next

See the end of `DEPLOY.md` for what is not built yet and a suggested order.
