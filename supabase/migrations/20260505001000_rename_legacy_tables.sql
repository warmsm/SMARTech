-- Optional cleanup after the normalized migration has succeeded.
-- This renames only legacy backup/fallback tables; normalized tables keep clean names.

do $$
begin
  if to_regclass('public.posts_e75a6481') is not null
     and to_regclass('public.posts_legacy') is null then
    alter table public.posts_e75a6481 rename to posts_legacy;
  end if;

  if to_regclass('public.kv_store_e75a6481') is not null
     and to_regclass('public.kv_store_legacy') is null then
    alter table public.kv_store_e75a6481 rename to kv_store_legacy;
  end if;
end $$;
