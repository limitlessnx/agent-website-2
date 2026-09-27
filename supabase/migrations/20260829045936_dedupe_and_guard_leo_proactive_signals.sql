with ranked as (
  select id,
         row_number() over (
           partition by user_id
           order by
             nullif(content::jsonb->>'lastDetectedAt','')::timestamptz desc nulls last,
             coalesce(nullif(content::jsonb->>'occurrences','')::int,0) desc,
             id
         ) as rn
  from public.bot_sessions
  where role = 'leo_proactive_signal'
)
delete from public.bot_sessions b
using ranked r
where b.id = r.id and r.rn > 1;

create unique index if not exists bot_sessions_leo_proactive_signal_user_key
on public.bot_sessions(user_id)
where role = 'leo_proactive_signal';
