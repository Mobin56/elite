-- Sample data for development only (16 questions from the prototype).
-- Run after 0001_schema.sql. Do not load into production.

insert into public.subjects (level, name_bn, position) values ('ssc', 'পদার্থবিজ্ঞান', 0) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('ssc', 'গণিত', 1) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('hsc', 'রসায়ন', 2) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('hsc', 'পদার্থবিজ্ঞান', 3) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('hsc', 'গণিত', 4) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('admission', 'ইংরেজি', 5) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('admission', 'সাধারণ জ্ঞান', 6) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('admission', 'গণিত', 7) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('admission', 'পদার্থবিজ্ঞান', 8) on conflict do nothing;
insert into public.subjects (level, name_bn, position) values ('admission', 'জীববিজ্ঞান', 9) on conflict do nothing;

insert into public.chapters (subject_id, name_bn, position) select id, 'গতি', 0 from public.subjects where level='ssc' and name_bn='পদার্থবিজ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'কাজ ও শক্তি', 1 from public.subjects where level='ssc' and name_bn='পদার্থবিজ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'বীজগণিত', 2 from public.subjects where level='ssc' and name_bn='গণিত' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'জ্যামিতি', 3 from public.subjects where level='ssc' and name_bn='গণিত' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'পরমাণুর গঠন', 4 from public.subjects where level='hsc' and name_bn='রসায়ন' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'ভেক্টর', 5 from public.subjects where level='hsc' and name_bn='পদার্থবিজ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'ক্যালকুলাস', 6 from public.subjects where level='hsc' and name_bn='গণিত' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'Vocabulary', 7 from public.subjects where level='admission' and name_bn='ইংরেজি' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'বাংলাদেশ', 8 from public.subjects where level='admission' and name_bn='সাধারণ জ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'লগারিদম', 9 from public.subjects where level='admission' and name_bn='গণিত' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'আলো', 10 from public.subjects where level='admission' and name_bn='পদার্থবিজ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'জিন', 11 from public.subjects where level='admission' and name_bn='জীববিজ্ঞান' on conflict do nothing;
insert into public.chapters (subject_id, name_bn, position) select id, 'কোষ', 12 from public.subjects where level='admission' and name_bn='জীববিজ্ঞান' on conflict do nothing;

insert into public.boards (name_bn) values ('ঢাকা') on conflict do nothing;
insert into public.boards (name_bn) values ('রাজশাহী') on conflict do nothing;
insert into public.universities (name_bn) values ('ঢাকা বিশ্ববিদ্যালয়') on conflict do nothing;
insert into public.universities (name_bn) values ('বুয়েট') on conflict do nothing;
insert into public.universities (name_bn) values ('মেডিকেল') on conflict do nothing;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'সমবেগে চলমান বস্তুর ত্বরণ কত?', '["০", "১", "ধ্রুবক", "অসীম"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'গতি'
  left join public.boards b on b.name_bn = 'ঢাকা'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'পদার্থবিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 0, 'সমবেগে বেগ বদলায় না, তাই ত্বরণ শূন্য।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'বেগের একক কোনটি?', '["m/s", "m/s²", "kg", "N"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'গতি'
  left join public.boards b on b.name_bn = 'রাজশাহী'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'পদার্থবিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 0, 'বেগ = দূরত্ব ÷ সময়, তাই একক m/s।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'কাজের একক কী?', '["নিউটন", "জুল", "ওয়াট", "পাস্কাল"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'কাজ ও শক্তি'
  left join public.boards b on b.name_bn = 'ঢাকা'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'পদার্থবিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'কাজ = বল × সরণ। এর একক জুল।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'x² = 49 হলে x = ?', '["৭", "±৭", "৪৯", "১৪"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'বীজগণিত'
  left join public.boards b on b.name_bn = 'ঢাকা'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'x² = ৪৯ হলে x = ±৭, কারণ (−৭)² ও ৭² দুটোই ৪৯।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, '(a+b)² = ?', '["a²+b²", "a²+2ab+b²", "a²−2ab+b²", "2a+2b"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'বীজগণিত'
  left join public.boards b on b.name_bn = 'রাজশাহী'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, '(a+b)² এর বিস্তার a²+2ab+b²।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'ত্রিভুজের তিন কোণের সমষ্টি কত?', '["৯০°", "১৮০°", "২৭০°", "৩৬০°"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'জ্যামিতি'
  left join public.boards b on b.name_bn = 'রাজশাহী'
  left join public.universities u on false
  where s.level = 'ssc' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'যেকোনো ত্রিভুজের তিন কোণের সমষ্টি ১৮০°।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'কার্বনের পারমাণবিক সংখ্যা কত?', '["৪", "৬", "৮", "১২"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'পরমাণুর গঠন'
  left join public.boards b on b.name_bn = 'ঢাকা'
  left join public.universities u on false
  where s.level = 'hsc' and s.name_bn = 'রসায়ন'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'কার্বনে ৬টি প্রোটন আছে, তাই পারমাণবিক সংখ্যা ৬।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'কোনটি স্কেলার রাশি?', '["বেগ", "ত্বরণ", "দূরত্ব", "বল"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'ভেক্টর'
  left join public.boards b on b.name_bn = 'রাজশাহী'
  left join public.universities u on false
  where s.level = 'hsc' and s.name_bn = 'পদার্থবিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 2, 'দূরত্বের শুধু মান আছে, দিক নেই, তাই স্কেলার।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'd/dx (sin x) = ?', '["cos x", "−cos x", "tan x", "−sin x"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'ক্যালকুলাস'
  left join public.boards b on b.name_bn = 'ঢাকা'
  left join public.universities u on false
  where s.level = 'hsc' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 0, 'sin x এর অন্তরজ cos x।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'd/dx (x²) = ?', '["x", "2x", "x²", "2"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'ক্যালকুলাস'
  left join public.boards b on b.name_bn = 'রাজশাহী'
  left join public.universities u on false
  where s.level = 'hsc' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'd/dx (xⁿ) = n·xⁿ⁻¹, তাই x² এর জন্য 2x।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, '''Abundant'' শব্দের সমার্থক কোনটি?', '["Scarce", "Plentiful", "Rare", "Tiny"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'Vocabulary'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'ঢাকা বিশ্ববিদ্যালয়'
  where s.level = 'admission' and s.name_bn = 'ইংরেজি'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'Abundant মানে প্রচুর, Plentiful এর অর্থও তা-ই।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'বাংলাদেশের জাতীয় ফুল কোনটি?', '["গোলাপ", "শাপলা", "জবা", "রজনীগন্ধা"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'বাংলাদেশ'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'ঢাকা বিশ্ববিদ্যালয়'
  where s.level = 'admission' and s.name_bn = 'সাধারণ জ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'শাপলা বাংলাদেশের জাতীয় ফুল।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'log₁₀ 100 = ?', '["১", "২", "১০", "১০০"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'লগারিদম'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'বুয়েট'
  where s.level = 'admission' and s.name_bn = 'গণিত'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'log₁₀ 100 = log₁₀ 10² = ২।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'শূন্য মাধ্যমে আলোর বেগ প্রায় কত?', '["৩×১০⁸ m/s", "৩×১০⁶ m/s", "৩×১০⁵ m/s", "৩×১০¹⁰ m/s"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'আলো'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'বুয়েট'
  where s.level = 'admission' and s.name_bn = 'পদার্থবিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 0, 'শূন্য মাধ্যমে আলোর বেগ প্রায় ৩×১০⁸ m/s।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'DNA-র পূর্ণরূপ কী?', '["Deoxyribo Nucleic Acid", "Di Nitro Acid", "Deoxy Natural Acid", "Double Nucleic Acid"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'জিন'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'মেডিকেল'
  where s.level = 'admission' and s.name_bn = 'জীববিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 0, 'DNA এর পূর্ণরূপ Deoxyribo Nucleic Acid।' from q;

with q as (
  insert into public.questions (subject_id, chapter_id, board_id, university_id, body, options)
  select s.id, c.id, b.id, u.id, 'কোষের শক্তিঘর কোনটি?', '["রাইবোজোম", "মাইটোকন্ড্রিয়া", "নিউক্লিয়াস", "গলজি বডি"]'::jsonb
  from public.subjects s
  join public.chapters c on c.subject_id = s.id and c.name_bn = 'কোষ'
  left join public.boards b on false
  left join public.universities u on u.name_bn = 'মেডিকেল'
  where s.level = 'admission' and s.name_bn = 'জীববিজ্ঞান'
  returning id)
insert into public.question_keys (question_id, correct_index, explanation) select id, 1, 'মাইটোকন্ড্রিয়া ATP তৈরি করে, তাই একে কোষের শক্তিঘর বলে।' from q;


-- Premium batches (plan-wise version of the prototype pricing)
insert into public.batches (title, description, price_bdt, duration_days, all_subjects) values
  ('Elite 49', 'একটি বিষয়, ১ মাস', 49, 30, false),
  ('Elite 99', 'সব বিষয়, ১ মাস', 99, 30, true),
  ('Elite 499', 'সব বিষয় ও মডেল টেস্ট, ১ বছর', 499, 365, true);

insert into public.coupons (code, percent_off, max_uses) values ('EID50', 50, 100) on conflict do nothing;
