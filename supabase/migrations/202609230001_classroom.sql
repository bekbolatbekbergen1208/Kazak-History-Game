-- Account-free classrooms. All data access goes through trusted Next.js routes.
-- Browser publishable/anon keys have NO access to classroom tables or RPCs.
create table public.rooms (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[0-9]{6}$'),
 teacher_token_hash text not null,
 projector_token_hash text not null,
 status text not null default 'lobby' check(status in ('lobby','running','paused','ended')),
 current_mission integer not null default 0 check(current_mission between 0 and 3),
 mode text not null default 'individual' check(mode in ('individual','class')),
 active_task text,
 round_id integer not null default 0,
 expected_participants uuid[] not null default '{}',
 answers_locked boolean not null default false,
 answer_revealed boolean not null default false,
 started_at timestamptz,
 paused_at timestamptz,
 paused_ms bigint not null default 0,
 deadline_at timestamptz,
 ended_at timestamptz,
 expires_at timestamptz not null default (now()+interval '24 hours'),
 created_at timestamptz not null default now(),
 version integer not null default 0
);
create table public.participants (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null references public.rooms(id) on delete cascade,
 name text not null check(char_length(name) between 2 and 32),
 token_hash text not null unique,
 joined_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now(),
 unique(id,room_id)
);
create index participants_room_idx on public.participants(room_id);
create table public.progress (
 participant_id uuid primary key,
 room_id uuid not null,
 awards jsonb not null default '{}',
 drafts jsonb not null default '{}',
 score integer not null default 0 check(score between 0 and 100),
 current_task text,
 completed_tasks integer not null default 0 check(completed_tasks between 0 and 18),
 finished_at timestamptz,
 elapsed_seconds integer,
 version integer not null default 0,
 updated_at timestamptz not null default now(),
 foreign key(participant_id,room_id) references public.participants(id,room_id) on delete cascade
);
create index progress_room_idx on public.progress(room_id);
create table public.responses (
 id uuid primary key default gen_random_uuid(),
 room_id uuid not null,
 participant_id uuid not null,
 request_id uuid not null,
 task_id text not null,
 round_id integer not null,
 mode text not null check(mode in ('individual','class')),
 answer jsonb not null,
 correct boolean not null,
 points integer not null default 0 check(points between 0 and 10),
 created_at timestamptz not null default now(),
 foreign key(participant_id,room_id) references public.participants(id,room_id) on delete cascade,
 unique(participant_id,request_id)
);
create index responses_analytics_idx on public.responses(room_id,task_id,round_id,created_at);
create unique index responses_class_once_idx on public.responses(participant_id,task_id,round_id) where mode='class';
create table public.classroom_limits (key text primary key,hits integer not null,window_start timestamptz not null);

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.responses enable row level security;
alter table public.progress enable row level security;
alter table public.classroom_limits enable row level security;
revoke all on public.rooms,public.participants,public.responses,public.progress,public.classroom_limits from anon,authenticated;
grant all on public.rooms,public.participants,public.responses,public.progress,public.classroom_limits to service_role;
-- No public SELECT policy is intentional: even a room code is not a teacher capability.

create function public.classroom_rate_limit(p_key text,p_limit integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer;
begin
 insert into classroom_limits(key,hits,window_start) values(p_key,1,now())
 on conflict(key) do update set
 hits=case when classroom_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else classroom_limits.hits+1 end,
 window_start=case when classroom_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else classroom_limits.window_start end
 returning hits into n;
 return n<=p_limit;
end $$;

create function public.classroom_join(p_room_id uuid,p_name text,p_token_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare r rooms%rowtype; pid uuid;
begin
 select * into strict r from rooms where id=p_room_id for update;
 if r.expires_at<=now() then raise exception 'ROOM_EXPIRED'; end if;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 if (select count(*) from participants where room_id=r.id)>=100 then raise exception 'ROOM_FULL'; end if;
 insert into participants(room_id,name,token_hash) values(r.id,p_name,p_token_hash) returning id into pid;
 insert into progress(participant_id,room_id) values(pid,r.id);
 return pid;
end $$;

create function public.classroom_control(p_room_id uuid,p_control text,p_task_id text,p_version integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r rooms%rowtype; count_answered integer;
begin
 select * into strict r from rooms where id=p_room_id for update;
 if r.expires_at<=now() then raise exception 'ROOM_EXPIRED'; end if;
 if r.version<>p_version then raise exception 'STALE_STATE'; end if;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 case p_control
 when 'start' then
  if r.status<>'lobby' then raise exception 'INVALID_CONTROL'; end if;
  update rooms set status='running',started_at=now(),deadline_at=now()+interval '12 minutes' where id=r.id;
 when 'pause' then
  if r.status<>'running' then raise exception 'INVALID_CONTROL'; end if;
  update rooms set status='paused',paused_at=now() where id=r.id;
 when 'resume' then
  if r.status<>'paused' then raise exception 'INVALID_CONTROL'; end if;
  update rooms set status='running',paused_ms=paused_ms+(extract(epoch from (now()-paused_at))*1000)::bigint,deadline_at=deadline_at+(now()-paused_at),paused_at=null where id=r.id;
 when 'next_mission' then
  if r.status not in ('running','paused') or r.current_mission>=3 then raise exception 'INVALID_CONTROL'; end if;
  update rooms set current_mission=current_mission+1,mode='individual',active_task=null,answers_locked=false,answer_revealed=false,expected_participants='{}',round_id=round_id+1 where id=r.id;
 when 'launch_question' then
  if r.status<>'running' or p_task_id is null then raise exception 'INVALID_CONTROL'; end if;
  update rooms set mode='class',active_task=p_task_id,round_id=round_id+1,answers_locked=false,answer_revealed=false,expected_participants=array(select id from participants where room_id=r.id order by joined_at) where id=r.id;
 when 'individual' then
  if r.status not in ('running','paused') then raise exception 'INVALID_CONTROL'; end if;
  update rooms set mode='individual',active_task=null,answers_locked=false,answer_revealed=false,expected_participants='{}',round_id=round_id+1 where id=r.id;
 when 'reveal' then
  if r.mode<>'class' then raise exception 'INVALID_CONTROL'; end if;
  select count(distinct participant_id) into count_answered from responses where room_id=r.id and task_id=r.active_task and mode='class' and round_id=r.round_id and participant_id=any(r.expected_participants);
  if not r.answers_locked and (cardinality(r.expected_participants)=0 or count_answered<cardinality(r.expected_participants)) then raise exception 'WAIT_FOR_ANSWERS'; end if;
  update rooms set answer_revealed=true,answers_locked=true where id=r.id;
 when 'lock' then
  if r.status not in ('running','paused') then raise exception 'INVALID_CONTROL'; end if;
  update rooms set answers_locked=true where id=r.id;
 when 'unlock' then
  if r.status not in ('running','paused') or r.answer_revealed then raise exception 'INVALID_CONTROL'; end if;
  update rooms set answers_locked=false where id=r.id;
 when 'end' then
  update rooms set status='ended',ended_at=now(),answers_locked=true,paused_ms=paused_ms+case when paused_at is not null then (extract(epoch from(now()-paused_at))*1000)::bigint else 0 end,paused_at=null,expires_at=least(expires_at,now()+interval '6 hours') where id=r.id;
 else raise exception 'INVALID_CONTROL';
 end case;
 update rooms set version=version+1 where id=r.id;
end $$;

create function public.classroom_save_draft(p_room_id uuid,p_participant_id uuid,p_task_id text,p_draft jsonb)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 update progress set drafts=jsonb_set(drafts,array[p_task_id],p_draft,true),current_task=p_task_id,updated_at=now()
 where room_id=p_room_id and participant_id=p_participant_id and finished_at is null and not awards ? p_task_id;
end $$;

create function public.classroom_submit(
 p_room_id uuid,p_participant_id uuid,p_request_id uuid,p_task_id text,
 p_task_mission integer,p_round integer,p_mode text,p_answer jsonb,p_correct boolean,p_max_points integer,p_progress_version integer
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r rooms%rowtype; p progress%rowtype; prior responses%rowtype; response responses%rowtype; earned integer:=0; mistakes integer; next_awards jsonb; total integer; done integer;
begin
 -- One lock order for all writers avoids answer/pause races and duplicate awards.
 select * into strict r from rooms where id=p_room_id for update;
 select * into strict p from progress where participant_id=p_participant_id and room_id=p_room_id for update;
 select * into prior from responses where participant_id=p_participant_id and request_id=p_request_id;
 if found then return to_jsonb(prior); end if; -- Idempotent retry after an uncertain connection.
 if r.expires_at<=now() then raise exception 'ROOM_EXPIRED'; end if;
 if r.status='paused' then raise exception 'ROOM_PAUSED'; end if;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 if r.status<>'running' or r.current_mission<>p_task_mission or r.mode<>p_mode or r.round_id<>p_round or p.version<>p_progress_version or p.finished_at is not null then raise exception 'STALE_STATE'; end if;
 if r.answers_locked then raise exception 'ANSWERS_LOCKED'; end if;
 if p_mode='class' then
  if r.active_task<>p_task_id then raise exception 'STALE_STATE'; end if;
  if not p_participant_id=any(r.expected_participants) then raise exception 'NOT_EXPECTED'; end if;
  if exists(select 1 from responses where participant_id=p_participant_id and task_id=p_task_id and round_id=p_round and mode='class') then raise exception 'ALREADY_SUBMITTED'; end if;
 elsif p.awards ? p_task_id then raise exception 'ALREADY_SUBMITTED';
 end if;
 select count(*) into mistakes from responses where participant_id=p_participant_id and task_id=p_task_id and not correct;
 next_awards:=p.awards;
 if p_correct and not p.awards ? p_task_id then
  earned:=greatest(ceil(p_max_points/2.0)::integer,p_max_points-mistakes);
  next_awards:=jsonb_set(next_awards,array[p_task_id],to_jsonb(earned),true);
 end if;
 insert into responses(room_id,participant_id,request_id,task_id,round_id,mode,answer,correct,points)
 values(r.id,p_participant_id,p_request_id,p_task_id,p_round,p_mode,p_answer,p_correct,earned) returning * into response;
 select coalesce(sum(value::integer),0),count(*) into total,done from jsonb_each_text(next_awards);
 update progress set awards=next_awards,score=total,completed_tasks=done,
 drafts=jsonb_set(drafts,array[p_task_id],p_answer,true),current_task=p_task_id,version=version+1,updated_at=now(),
 finished_at=case when p_task_id='final' and p_correct then now() else finished_at end,
 elapsed_seconds=case when p_task_id='final' and p_correct then greatest(0,floor(extract(epoch from(now()-r.started_at))-r.paused_ms/1000.0)::integer) else elapsed_seconds end
 where participant_id=p_participant_id;
 update participants set last_seen_at=now() where id=p_participant_id;
 return to_jsonb(response);
end $$;

-- Messages contain invalidation ONLY; names, answers, grades and tokens never leave via a public channel.
-- After any notification clients fetch a role-scoped snapshot through the Next.js API.
create function public.classroom_notify() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; pid uuid;
begin
 if tg_table_name='rooms' then
  rid:=new.id;
  perform realtime.send('{}'::jsonb,'invalidate','classroom:'||rid::text,false);
 else
  rid:=new.room_id;
  perform realtime.send('{}'::jsonb,'invalidate','monitor:'||rid::text,false);
  if tg_table_name='progress' then
   pid:=new.participant_id;
   perform realtime.send('{}'::jsonb,'invalidate','student:'||pid::text,false);
  end if;
 end if;
 return new;
end $$;
create trigger room_changed after update on public.rooms for each row execute function public.classroom_notify();
create trigger participant_changed after insert or update on public.participants for each row execute function public.classroom_notify();
create trigger progress_changed after insert or update on public.progress for each row execute function public.classroom_notify();
create trigger response_changed after insert on public.responses for each row execute function public.classroom_notify();

create function public.cleanup_classrooms() returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare deleted integer;
begin
 delete from rooms where expires_at<now();get diagnostics deleted=row_count;
 delete from classroom_limits where window_start<now()-interval '2 hours';
 return deleted;
end $$;
revoke all on function public.classroom_rate_limit(text,integer,integer),public.classroom_join(uuid,text,text),public.classroom_control(uuid,text,text,integer),public.classroom_save_draft(uuid,uuid,text,jsonb),public.classroom_submit(uuid,uuid,uuid,text,integer,integer,text,jsonb,boolean,integer,integer),public.classroom_notify(),public.cleanup_classrooms() from public,anon,authenticated;
grant execute on function public.classroom_rate_limit(text,integer,integer),public.classroom_join(uuid,text,text),public.classroom_control(uuid,text,text,integer),public.classroom_save_draft(uuid,uuid,text,jsonb),public.classroom_submit(uuid,uuid,uuid,text,integer,integer,text,jsonb,boolean,integer,integer),public.cleanup_classrooms() to service_role;
