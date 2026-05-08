-- storage.sql
-- Storage bucket for portrait photos.
--
-- Path convention: {user_id}/{profile_id}/{photo_id}/{variant}.jpg
-- The leading {user_id} segment is the RLS anchor: write policies check that
-- the first path segment matches auth.uid().
--
-- Public read: yes (we serve photos from the personal site directly).
-- Public write: no.
-- Authenticated write: yes, only inside their own {user_id}/... prefix.

insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do nothing;

-- public read of any object in the photos bucket
create policy "photos_public_read"
  on storage.objects for select
  using (bucket_id = 'photos');

-- authenticated user can write to objects whose path starts with their user_id
create policy "photos_owner_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "photos_owner_update"
  on storage.objects for update
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "photos_owner_delete"
  on storage.objects for delete
  using (
    bucket_id = 'photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
