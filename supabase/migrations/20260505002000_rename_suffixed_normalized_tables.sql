-- Cleanup for projects that already ran an older normalization migration
-- that created normalized tables with the generated _e75a6481 suffix.
--
-- Run this after confirming your data is present. Foreign keys update
-- automatically when PostgreSQL tables are renamed.

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

  if to_regclass('public.offices_e75a6481') is not null
     and to_regclass('public.offices') is null then
    alter table public.offices_e75a6481 rename to offices;
  end if;

  if to_regclass('public.platforms_e75a6481') is not null
     and to_regclass('public.platforms') is null then
    alter table public.platforms_e75a6481 rename to platforms;
  end if;

  if to_regclass('public.audit_submissions_e75a6481') is not null
     and to_regclass('public.audit_submissions') is null then
    alter table public.audit_submissions_e75a6481 rename to audit_submissions;
  end if;

  if to_regclass('public.submission_platforms_e75a6481') is not null
     and to_regclass('public.submission_platforms') is null then
    alter table public.submission_platforms_e75a6481 rename to submission_platforms;
  end if;

  if to_regclass('public.audit_scores_e75a6481') is not null
     and to_regclass('public.audit_scores') is null then
    alter table public.audit_scores_e75a6481 rename to audit_scores;
  end if;

  if to_regclass('public.central_reviews_e75a6481') is not null
     and to_regclass('public.central_reviews') is null then
    alter table public.central_reviews_e75a6481 rename to central_reviews;
  end if;

  if to_regclass('public.appeals_e75a6481') is not null
     and to_regclass('public.appeals') is null then
    alter table public.appeals_e75a6481 rename to appeals;
  end if;

  if to_regclass('public.access_requests_e75a6481') is not null
     and to_regclass('public.access_requests') is null then
    alter table public.access_requests_e75a6481 rename to access_requests;
  end if;

  if to_regclass('public.app_counters_e75a6481') is not null
     and to_regclass('public.app_counters') is null then
    alter table public.app_counters_e75a6481 rename to app_counters;
  end if;
end $$;
