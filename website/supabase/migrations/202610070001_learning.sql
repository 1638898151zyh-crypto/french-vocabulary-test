-- Apply once in the new Supabase project. No old service credentials are needed at runtime.
begin;
create table if not exists public.learning_records (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 etag text not null,
 updated_at timestamptz not null default now(),
 constraint learning_size check (octet_length(data::text)<=16000000),
 constraint learning_shape check (data->>'mode'='multi-atelier' and data->>'version'='2' and jsonb_typeof(data->'progress')='object')
);
alter table public.learning_records enable row level security;
drop policy if exists "read own learning records" on public.learning_records;
create policy "read own learning records" on public.learning_records for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.learning_records from anon,authenticated;
grant select on public.learning_records to authenticated;

-- Atomic compare-and-swap: concurrent devices cannot silently overwrite each other.
create or replace function public.save_learning_record(p_data jsonb,p_expected_etag text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare owner_id uuid:=auth.uid(); next_etag text:=gen_random_uuid()::text; changed integer;
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='28000'; end if;
 if p_data->>'mode' is distinct from 'multi-atelier' or p_data->>'version' is distinct from '2'
  or jsonb_typeof(p_data->'progress') is distinct from 'object' or octet_length(p_data::text)>16000000
 then raise exception 'Invalid learning record' using errcode='22023'; end if;
 if p_expected_etag is null then
  insert into public.learning_records(user_id,data,etag) values(owner_id,p_data,next_etag) on conflict(user_id) do nothing;
 else
  update public.learning_records set data=p_data,etag=next_etag,updated_at=now() where user_id=owner_id and etag=p_expected_etag;
 end if;
 get diagnostics changed=row_count;
 return jsonb_build_object('modified',changed=1,'etag',case when changed=1 then next_etag else null end);
end $$;
revoke all on function public.save_learning_record(jsonb,text) from public,anon;
grant execute on function public.save_learning_record(jsonb,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',true,262144,array['image/webp','image/png','image/jpeg'])
on conflict(id) do update set public=true,file_size_limit=262144,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "upload own avatar" on storage.objects;
create policy "upload own avatar" on storage.objects for insert to authenticated with check (
 bucket_id='avatars' and owner_id=(select auth.uid())::text
 and name ~* '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(webp|png|jpg)$'
);
commit;
