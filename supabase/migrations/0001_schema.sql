-- Elite Academy: initial schema (Phase 1)
-- Run in Supabase: SQL Editor -> paste -> Run. Safe to run once on an empty project.
--
-- Design rules
--   * Students never read answer keys directly. Correct answers and explanations live in
--     question_keys, which only admins can read. Students get them through functions:
--       submit_attempt()    grades an exam on the server, always returns the correct index,
--                           returns the explanation only if the student has a premium batch
--       get_answer_keys()   question-bank answers, premium only
--   * Purchases are written only by the server (service role) after the payment gateway confirms.
--   * Row Level Security is on for every table.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- types
create type public.level_t        as enum ('ssc', 'hsc', 'admission');
create type public.role_t         as enum ('student', 'teacher', 'admin');
create type public.attempt_mode_t as enum ('chapter', 'model', 'board', 'university', 'retake');
create type public.purchase_status_t as enum ('pending', 'paid', 'failed', 'refunded');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  phone       text unique,
  level       public.level_t,
  role        public.role_t not null default 'student',
  created_at  timestamptz not null default now()
);

create or replace function public.my_role()
returns public.role_t
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false) $$;

-- create a profile row automatically when someone signs up (phone OTP or otherwise)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, nullif(new.phone, ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- content structure
create table public.subjects (
  id       uuid primary key default gen_random_uuid(),
  level    public.level_t not null,
  name_bn  text not null,
  position int  not null default 0,
  unique (level, name_bn)
);

create table public.chapters (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  name_bn     text not null,
  position    int  not null default 0,
  unique (subject_id, name_bn)
);

create table public.boards (
  id       uuid primary key default gen_random_uuid(),
  name_bn  text not null unique
);

create table public.universities (
  id       uuid primary key default gen_random_uuid(),
  name_bn  text not null unique
);

-- ---------------------------------------------------------------- questions
create table public.questions (
  id             uuid primary key default gen_random_uuid(),
  subject_id     uuid not null references public.subjects(id) on delete restrict,
  chapter_id     uuid not null references public.chapters(id) on delete restrict,
  board_id       uuid references public.boards(id) on delete set null,
  university_id  uuid references public.universities(id) on delete set null,
  exam_year      int,
  model_no       int,
  body           text not null,
  options        jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 6),
  difficulty     smallint not null default 2 check (difficulty between 1 and 3),
  is_active      boolean not null default true,
  created_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index questions_chapter_idx    on public.questions (chapter_id) where is_active;
create index questions_board_idx      on public.questions (board_id) where is_active;
create index questions_university_idx on public.questions (university_id) where is_active;
create index questions_subject_idx    on public.questions (subject_id) where is_active;

-- answers live in a separate table so students cannot select them
create table public.question_keys (
  question_id    uuid primary key references public.questions(id) on delete cascade,
  correct_index  smallint not null check (correct_index >= 0),
  explanation    text
);

-- students flag a wrong or unclear question
create table public.question_reports (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references public.questions(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  reason       text not null,
  resolved     boolean not null default false,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------- batches, coupons, purchases
create table public.batches (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null,
  description        text,
  level              public.level_t,
  price_bdt          int  not null check (price_bdt >= 0),
  duration_days      int  not null check (duration_days > 0),
  all_subjects       boolean not null default false,   -- true: covers every subject
  includes_explanations boolean not null default true,
  includes_question_bank boolean not null default true,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create table public.batch_subjects (
  batch_id    uuid not null references public.batches(id) on delete cascade,
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  primary key (batch_id, subject_id)
);

create table public.coupons (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique check (code = upper(code)),
  percent_off   int  not null check (percent_off between 1 and 100),
  batch_id      uuid references public.batches(id) on delete cascade,  -- null: any batch
  max_uses      int,
  used_count    int  not null default 0,
  valid_from    timestamptz not null default now(),
  valid_until   timestamptz,
  is_active     boolean not null default true
);

create table public.purchases (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  batch_id          uuid not null references public.batches(id) on delete restrict,
  coupon_id         uuid references public.coupons(id) on delete set null,
  amount_bdt        int  not null check (amount_bdt >= 0),
  status            public.purchase_status_t not null default 'pending',
  gateway           text,
  gateway_txn_id    text,
  created_at        timestamptz not null default now(),
  paid_at           timestamptz,
  expires_at        timestamptz
);
create index purchases_user_idx on public.purchases (user_id, status, expires_at);
create unique index purchases_txn_uidx on public.purchases (gateway, gateway_txn_id) where gateway_txn_id is not null;

-- true if the signed-in student has a paid, unexpired batch that covers this subject
create or replace function public.has_premium(p_subject_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.purchases p
    join public.batches b on b.id = p.batch_id
    where p.user_id = auth.uid()
      and p.status = 'paid'
      and (p.expires_at is null or p.expires_at > now())
      and b.includes_explanations
      and (b.all_subjects
           or exists (select 1 from public.batch_subjects bs
                      where bs.batch_id = b.id and bs.subject_id = p_subject_id))
  )
$$;

-- ---------------------------------------------------------------- attempts and progress
create table public.attempts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  mode             public.attempt_mode_t not null,
  subject_id       uuid references public.subjects(id) on delete set null,
  chapter_id       uuid references public.chapters(id) on delete set null,
  board_id         uuid references public.boards(id) on delete set null,
  university_id    uuid references public.universities(id) on delete set null,
  score            int  not null default 0,
  total            int  not null default 0,
  duration_seconds int,
  created_at       timestamptz not null default now()
);
create index attempts_user_idx on public.attempts (user_id, created_at desc);

create table public.attempt_answers (
  attempt_id      uuid not null references public.attempts(id) on delete cascade,
  question_id     uuid not null references public.questions(id) on delete cascade,
  selected_index  smallint,
  is_correct      boolean not null,
  primary key (attempt_id, question_id)
);
create index attempt_answers_question_idx on public.attempt_answers (question_id);

create table public.wrong_notebook (
  user_id        uuid not null references public.profiles(id) on delete cascade,
  question_id    uuid not null references public.questions(id) on delete cascade,
  wrong_count    int  not null default 1,
  last_wrong_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.bookmarks (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  question_id  uuid not null references public.questions(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.streaks (
  user_id           uuid primary key references public.profiles(id) on delete cascade,
  current_streak    int  not null default 0,
  longest_streak    int  not null default 0,
  last_active_date  date
);

-- zone report: accuracy per chapter for the signed-in student (RLS applies through security_invoker)
create or replace view public.chapter_zones with (security_invoker = true) as
select
  a.user_id,
  q.subject_id,
  q.chapter_id,
  count(*)                                         as answered,
  count(*) filter (where aa.is_correct)            as correct,
  round(100.0 * count(*) filter (where aa.is_correct) / count(*), 1) as accuracy,
  case
    when 100.0 * count(*) filter (where aa.is_correct) / count(*) >= 70 then 'strong'
    when 100.0 * count(*) filter (where aa.is_correct) / count(*) >= 50 then 'confused'
    else 'weak'
  end                                              as zone
from public.attempt_answers aa
join public.attempts  a on a.id = aa.attempt_id
join public.questions q on q.id = aa.question_id
group by a.user_id, q.subject_id, q.chapter_id;

-- ---------------------------------------------------------------- server functions
-- Grade an exam. p_answers: [{"question_id": "...", "selected_index": 1}, ...]
create or replace function public.submit_attempt(
  p_mode             public.attempt_mode_t,
  p_subject_id       uuid,
  p_chapter_id       uuid,
  p_board_id         uuid,
  p_university_id    uuid,
  p_duration_seconds int,
  p_answers          jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  uid        uuid := auth.uid();
  att_id     uuid;
  n_score    int;
  n_total    int;
  today      date := (now() at time zone 'Asia/Dhaka')::date;
  result     jsonb;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'array'
     or jsonb_array_length(p_answers) not between 1 and 200 then
    raise exception 'answers must be an array of 1 to 200 items';
  end if;

  insert into public.attempts (user_id, mode, subject_id, chapter_id, board_id, university_id, duration_seconds)
  values (uid, p_mode, p_subject_id, p_chapter_id, p_board_id, p_university_id, p_duration_seconds)
  returning id into att_id;

  insert into public.attempt_answers (attempt_id, question_id, selected_index, is_correct)
  select distinct on (a.question_id)
         att_id, a.question_id, a.selected_index,
         (a.selected_index is not null and a.selected_index = k.correct_index)
  from jsonb_to_recordset(p_answers) as a(question_id uuid, selected_index smallint)
  join public.questions     q on q.id = a.question_id and q.is_active
  join public.question_keys k on k.question_id = a.question_id
  order by a.question_id;

  select count(*) filter (where is_correct), count(*)
    into n_score, n_total
  from public.attempt_answers where attempt_id = att_id;

  if n_total = 0 then
    raise exception 'no valid questions in submission';
  end if;

  update public.attempts set score = n_score, total = n_total where id = att_id;

  -- wrong-answer notebook: add wrong ones, clear the ones answered correctly now
  insert into public.wrong_notebook (user_id, question_id)
  select uid, question_id from public.attempt_answers
  where attempt_id = att_id and not is_correct
  on conflict (user_id, question_id)
  do update set wrong_count = public.wrong_notebook.wrong_count + 1, last_wrong_at = now();

  delete from public.wrong_notebook w
  using public.attempt_answers aa
  where aa.attempt_id = att_id and aa.is_correct
    and w.user_id = uid and w.question_id = aa.question_id;

  -- daily streak (Bangladesh date)
  insert into public.streaks (user_id, current_streak, longest_streak, last_active_date)
  values (uid, 1, 1, today)
  on conflict (user_id) do update set
    current_streak = case
      when public.streaks.last_active_date = today     then public.streaks.current_streak
      when public.streaks.last_active_date = today - 1 then public.streaks.current_streak + 1
      else 1 end,
    last_active_date = today;
  update public.streaks set longest_streak = greatest(longest_streak, current_streak) where user_id = uid;

  select jsonb_build_object(
    'attempt_id', att_id,
    'score', n_score,
    'total', n_total,
    'results', coalesce(jsonb_agg(jsonb_build_object(
        'question_id', aa.question_id,
        'selected_index', aa.selected_index,
        'is_correct', aa.is_correct,
        'correct_index', k.correct_index,
        'explanation', case when public.has_premium(q.subject_id) then k.explanation else null end,
        'explanation_locked', not public.has_premium(q.subject_id)
      )), '[]'::jsonb)
  ) into result
  from public.attempt_answers aa
  join public.questions     q on q.id = aa.question_id
  join public.question_keys k on k.question_id = aa.question_id
  where aa.attempt_id = att_id;

  return result;
end $$;

-- true if the signed-in student has a paid, unexpired batch with question-bank access for this subject
create or replace function public.has_bank_access(p_subject_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.purchases p
    join public.batches b on b.id = p.batch_id
    where p.user_id = auth.uid()
      and p.status = 'paid'
      and (p.expires_at is null or p.expires_at > now())
      and b.includes_question_bank
      and (b.all_subjects
           or exists (select 1 from public.batch_subjects bs
                      where bs.batch_id = b.id and bs.subject_id = p_subject_id))
  )
$$;

-- Question bank answers: premium only. Questions the student has no access to are simply left out.
create or replace function public.get_answer_keys(p_question_ids uuid[])
returns table (question_id uuid, correct_index smallint, explanation text)
language sql stable security definer set search_path = public
as $$
  select k.question_id, k.correct_index, k.explanation
  from public.question_keys k
  join public.questions q on q.id = k.question_id
  where k.question_id = any (p_question_ids)
    and coalesce(array_length(p_question_ids, 1), 0) <= 100
    and public.has_bank_access(q.subject_id)
$$;

-- ---------------------------------------------------------------- function permissions
revoke all on function public.submit_attempt(public.attempt_mode_t, uuid, uuid, uuid, uuid, int, jsonb) from public;
revoke all on function public.get_answer_keys(uuid[])  from public;
revoke all on function public.has_premium(uuid)         from public;
revoke all on function public.has_bank_access(uuid)     from public;
revoke all on function public.my_role()                 from public;
revoke all on function public.is_admin()                from public;

grant execute on function public.submit_attempt(public.attempt_mode_t, uuid, uuid, uuid, uuid, int, jsonb) to authenticated;
grant execute on function public.get_answer_keys(uuid[])  to authenticated;
grant execute on function public.has_premium(uuid)         to authenticated;
grant execute on function public.has_bank_access(uuid)     to authenticated;
grant execute on function public.my_role()                 to authenticated;
grant execute on function public.is_admin()                to authenticated;

-- ---------------------------------------------------------------- row level security
alter table public.profiles         enable row level security;
alter table public.subjects         enable row level security;
alter table public.chapters         enable row level security;
alter table public.boards           enable row level security;
alter table public.universities     enable row level security;
alter table public.questions        enable row level security;
alter table public.question_keys    enable row level security;
alter table public.question_reports enable row level security;
alter table public.batches          enable row level security;
alter table public.batch_subjects   enable row level security;
alter table public.coupons          enable row level security;
alter table public.purchases        enable row level security;
alter table public.attempts         enable row level security;
alter table public.attempt_answers  enable row level security;
alter table public.wrong_notebook   enable row level security;
alter table public.bookmarks        enable row level security;
alter table public.streaks          enable row level security;

-- profiles: read/update your own row, cannot change your own role; admins see all
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.my_role());
create policy profiles_admin_all on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- public catalogue: any signed-in student can read; only admins write
create policy subjects_read     on public.subjects     for select to authenticated using (true);
create policy chapters_read     on public.chapters     for select to authenticated using (true);
create policy boards_read       on public.boards       for select to authenticated using (true);
create policy universities_read on public.universities for select to authenticated using (true);
create policy batches_read      on public.batches      for select to authenticated using (is_active or public.is_admin());
create policy batch_subjects_read on public.batch_subjects for select to authenticated using (true);

create policy subjects_admin     on public.subjects     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy chapters_admin     on public.chapters     for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy boards_admin       on public.boards       for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy universities_admin on public.universities for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy batches_admin      on public.batches      for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy batch_subjects_admin on public.batch_subjects for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- questions: students read active ones (no answers); admins manage everything
create policy questions_read  on public.questions for select to authenticated using (is_active or public.is_admin());
create policy questions_admin on public.questions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- answer keys: admins only (students use submit_attempt / get_answer_keys)
create policy question_keys_admin on public.question_keys for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- reports: students file and see their own; admins see and resolve all
create policy reports_insert on public.question_reports for insert to authenticated with check (user_id = auth.uid());
create policy reports_select on public.question_reports for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy reports_admin  on public.question_reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- coupons: no direct student access; checked by the server with the service role
create policy coupons_admin on public.coupons for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- purchases: students see their own; rows are created and confirmed only by the server (service role)
create policy purchases_select on public.purchases for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy purchases_admin  on public.purchases for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- progress data: own rows only (written by submit_attempt, except bookmarks)
create policy attempts_select on public.attempts for select to authenticated using (user_id = auth.uid() or public.is_admin());
create policy attempt_answers_select on public.attempt_answers for select to authenticated
  using (exists (select 1 from public.attempts a where a.id = attempt_id and (a.user_id = auth.uid() or public.is_admin())));
create policy wrong_notebook_select on public.wrong_notebook for select to authenticated using (user_id = auth.uid());
create policy streaks_select on public.streaks for select to authenticated using (user_id = auth.uid());

create policy bookmarks_select on public.bookmarks for select to authenticated using (user_id = auth.uid());
create policy bookmarks_insert on public.bookmarks for insert to authenticated with check (user_id = auth.uid());
create policy bookmarks_delete on public.bookmarks for delete to authenticated using (user_id = auth.uid());

-- Defense in depth: progress tables have no insert/update/delete policy for students, and we also
-- remove the table privilege so only submit_attempt() (security definer) can change them.
revoke insert, update, delete on public.attempts, public.attempt_answers,
                               public.wrong_notebook, public.streaks
  from authenticated;
