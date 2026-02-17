-- Ensure avatars bucket exists and is publicly readable.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

-- Replace any legacy avatar policies with explicit, idempotent ones.
drop policy if exists "Authenticated Insert" on storage.objects;
drop policy if exists "Authenticated Update" on storage.objects;
drop policy if exists "Authenticated Delete" on storage.objects;
drop policy if exists "Public Access" on storage.objects;

drop policy if exists "Avatars: Insert own" on storage.objects;
drop policy if exists "Avatars: Update own" on storage.objects;
drop policy if exists "Avatars: Delete own" on storage.objects;
drop policy if exists "Avatars: Public read" on storage.objects;

create policy "Avatars: Insert own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatars: Update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatars: Delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Avatars: Public read"
on storage.objects
for select
to public
using (
  bucket_id = 'avatars'
);

