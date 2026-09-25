-- Adds teacher time extension and student task skipping to an existing classroom schema.
create or replace function public.classroom_control(p_room_id uuid,p_control text,p_task_id text,p_version integer)
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
 when 'add_time' then
  if r.status not in ('running','paused') or r.deadline_at is null then raise exception 'INVALID_CONTROL'; end if;
  update rooms set deadline_at=deadline_at+interval '5 minutes' where id=r.id;
 when 'end' then
  update rooms set status='ended',ended_at=now(),answers_locked=true,paused_ms=paused_ms+case when paused_at is not null then (extract(epoch from(now()-paused_at))*1000)::bigint else 0 end,paused_at=null,expires_at=least(expires_at,now()+interval '6 hours') where id=r.id;
 else raise exception 'INVALID_CONTROL';
 end case;
 update rooms set version=version+1 where id=r.id;
end $$;

create or replace function public.classroom_skip(p_room_id uuid,p_participant_id uuid,p_task_id text,p_task_mission integer,p_progress_version integer)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare r rooms%rowtype; p progress%rowtype; next_awards jsonb; total integer; done integer;
begin
 select * into strict r from rooms where id=p_room_id for update;
 select * into strict p from progress where participant_id=p_participant_id and room_id=p_room_id for update;
 if r.expires_at<=now() then raise exception 'ROOM_EXPIRED'; end if;
 if r.status='paused' then raise exception 'ROOM_PAUSED'; end if;
 if r.status='ended' then raise exception 'ROOM_ENDED'; end if;
 if r.status<>'running' or r.mode<>'individual' or r.current_mission<>p_task_mission or p.version<>p_progress_version or p.finished_at is not null then raise exception 'STALE_STATE'; end if;
 if p.awards ? p_task_id then raise exception 'ALREADY_SUBMITTED'; end if;
 next_awards:=jsonb_set(p.awards,array[p_task_id],'0'::jsonb,true);
 select coalesce(sum(value::integer),0),count(*) into total,done from jsonb_each_text(next_awards);
 update progress set awards=next_awards,score=total,completed_tasks=done,current_task=p_task_id,
 version=version+1,updated_at=now(),finished_at=case when p_task_id='final' then now() else finished_at end,
 elapsed_seconds=case when p_task_id='final' then greatest(0,floor(extract(epoch from(now()-r.started_at))-r.paused_ms/1000.0)::integer) else elapsed_seconds end
 where participant_id=p_participant_id;
 update participants set last_seen_at=now() where id=p_participant_id;
end $$;

revoke all on function public.classroom_skip(uuid,uuid,text,integer,integer) from public,anon,authenticated;
grant execute on function public.classroom_skip(uuid,uuid,text,integer,integer) to service_role;
