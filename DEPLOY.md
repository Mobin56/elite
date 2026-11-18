# Elite Academy: launch guide

Ei file-e ache app live korar age ja ja korte hobe. Upore theke niche order-e koro.

## 1. Supabase-e SQL (ekbar)

SQL Editor-e file-er **bhitorer lekha** paste kore Run koro, ei order-e:

1. `supabase/migrations/0001_schema.sql` (age korle abar korbe na)
2. `supabase/migrations/0002_purchases.sql`
3. `supabase/seed.sql` shudhu development-e. Live korar age seed-er sample question muche dao (Table Editor, questions, sob select, delete) ba notun project nao.

## 2. Nijeke admin banao

Age ekbar site-e email diye login koro. Tarpor SQL Editor-e:

```sql
update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'TOMAR_EMAIL');
```

## 3. Payment number

`.env.local` (ar Vercel-e) `NEXT_PUBLIC_CONTACT=` er pashe support email ba number dao (footer ar Terms, Privacy, Refund page-e dekhabe). Ar `NEXT_PUBLIC_PAY_NUMBER=` er pashe oi bKash/Nagad/Rocket number boshao jetay student-ra taka pathabe. Ekhon payment **manual**:

1. Student number-e Send Money kore TrxID `/batches` page-e jomaye
2. Tumi `/admin` page-e "পেমেন্ট যাচাই" section-e dekho
3. bKash/Nagad app-e TrxID ar taka mila, tarpor "অনুমোদন" chapo. Batch chalu hoye jay

Eta chhoto shuru-r jonno bhalo. Student onek hole SSLCommerz, ShurjoPay ba UddoktaPay lagabe (trade license lagte pare).

## 4. Email login (khub joruri)

Supabase-er built-in email ghonta-y khub kom pathate dey. Student barle login mail ashbe na. Live korar age **custom SMTP** lagao: Supabase, Authentication, Emails, SMTP Settings. Free option: Brevo ba Resend.

## 5. Content

- Admin panel-er CSV upload diye ashol question dao. Prothome ekta batch-er jonno (jemon HSC Physics) 200 question diye shuru koro
- Question onno boi/coaching theke copy kore dio na. Copyright check koro
- Batch toiri korar somoy "nirdishto bishoy" hole oi bishoy gulo bachai koro, na hole batch-e kono kichu unlock hoy na (batch page-o oi batch lukiye rakhe)

## 6. GitHub

```
cd ~/Documents/elite-academy
git init
git add .
git commit -m "Elite Academy"
```
GitHub-e notun private repo khule oi repo-r dewa command ei folder-e chalao. `.env.local` git-e jay na (`.gitignore`-e ache).

## 7. Vercel (hosting, free)

1. vercel.com-e GitHub diye login, Add New Project, repo bachai
2. Environment Variables-e tinta dao: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PAY_NUMBER`
3. Deploy chapo. Kichu minute por `xxx.vercel.app` link pabe

## 8. Domain

Domain kino (.com ba .com.bd). Vercel-e Project, Settings, Domains, domain add koro. Vercel je DNS record dey seta domain provider-er DNS page-e boshao.

## 9. Supabase-e site address

Authentication, URL Configuration-e:
- **Site URL**: `https://TOMAR-DOMAIN`
- **Redirect URLs**: `https://TOMAR-DOMAIN/**` ar `http://localhost:3000/**`

Eta na korle email-er login link `localhost`-e niye jabe.

## 10. Launch-er age test (duita alada account diye)

- [ ] Notun email-e login hoy, naam/level save hoy
- [ ] Exam deowa jay, result ar zone report ashe
- [ ] Free account-e ব্যাখ্যা 🔒 dekhay
- [ ] Batch kine (nijer number-e 49 taka pathiye) admin approve korle ব্যাখ্যা khule jay
- [ ] Coupon `EID50`: **production-e coupon toiri koro**, seed-er ta ke bhorosha koro na
- [ ] Ek student onno student-er data dekhte pay na
- [ ] Phone-e (choto screen-e) sob page thik dekhay
- [ ] `/terms`, `/privacy`, `/refund` page: eigulo **draft**. Refund-er shomoy (24 ghonta, 3 kormodibosh) ami default boshiyechi, tumi nijer policy onujayi bodlao. Lawyer dekhiye nile bhalo

## 11. Ekhono toiri hoyni

Phone OTP (SMS gateway lagbe), live exam, leaderboard, referral, SMS reminder, parent report, teacher panel, certificate, anti-cheat, offline mode, AI doubt solver. Launch-er por student-der feedback dekhe ei order-e kora bhalo: leaderboard, reminder, teacher panel, tarpor baki.

## Shotorkota

- `service_role` key **kokhono** browser code, GitHub ba kono chat-e dio na. Ei app-er ekhon oi key lagei na
- Supabase free plan-e automatic backup nei. Mase ekbar Table Editor theke questions ar purchases export koro
