-- Normalize SMARTech storage while preserving the existing Edge Function API.
-- Run this in the Supabase SQL editor before redeploying the Edge Function.

create extension if not exists pgcrypto;

create table if not exists offices_e75a6481 (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists platforms_e75a6481 (
  name text primary key
);

create table if not exists audit_submissions_e75a6481 (
  id text primary key,
  office_id uuid references offices_e75a6481(id) on delete set null,
  caption text not null default '',
  thumbnail text,
  status text not null default 'Rejected',
  recommendation text not null default '',
  posting_date date,
  reviewer text,
  submission_date date,
  last_updated date,
  audit_focus text not null default 'caption',
  pubmat_type text,
  has_been_revised boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists submission_platforms_e75a6481 (
  submission_id text not null references audit_submissions_e75a6481(id) on delete cascade,
  platform text not null references platforms_e75a6481(name) on delete restrict,
  primary key (submission_id, platform)
);

create table if not exists audit_scores_e75a6481 (
  submission_id text primary key references audit_submissions_e75a6481(id) on delete cascade,
  score numeric not null default 0,
  caption_score numeric,
  pubmat_score numeric,
  grammar numeric,
  inclusivity numeric,
  tone numeric
);

create table if not exists central_reviews_e75a6481 (
  submission_id text primary key references audit_submissions_e75a6481(id) on delete cascade,
  status text not null default 'Pending Review',
  comment text,
  reviewed_on date
);

create table if not exists appeals_e75a6481 (
  id uuid primary key default gen_random_uuid(),
  submission_id text not null references audit_submissions_e75a6481(id) on delete cascade,
  status text not null default 'Appealed',
  comment text,
  appealed_on date,
  created_at timestamptz not null default now()
);

create table if not exists access_requests_e75a6481 (
  id text primary key,
  type text not null,
  office_email text not null,
  office_name text not null,
  status text not null default 'Pending',
  submitted_at timestamptz not null default now(),
  reason text,
  new_assigned_person text,
  verification_code text unique,
  verification_code_expires_at timestamptz,
  requested_password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_counters_e75a6481 (
  key text primary key,
  value integer not null default 0
);

create index if not exists audit_submissions_office_idx on audit_submissions_e75a6481(office_id);
create index if not exists audit_submissions_focus_idx on audit_submissions_e75a6481(audit_focus);
create index if not exists audit_submissions_posting_date_idx on audit_submissions_e75a6481(posting_date);
create index if not exists submission_platforms_platform_idx on submission_platforms_e75a6481(platform);
create index if not exists appeals_submission_idx on appeals_e75a6481(submission_id, created_at desc);
create index if not exists access_requests_status_idx on access_requests_e75a6481(status);
create index if not exists access_requests_code_idx on access_requests_e75a6481(verification_code);

-- Seed known platforms.
insert into platforms_e75a6481(name)
values ('Facebook'), ('Instagram'), ('X'), ('TikTok')
on conflict (name) do nothing;

-- Migrate legacy JSON post rows when posts_e75a6481 exists.
do $$
begin
  if to_regclass('public.posts_e75a6481') is not null then
    insert into offices_e75a6481(name)
    select distinct nullif(value->>'office', '')
    from posts_e75a6481
    where nullif(value->>'office', '') is not null
    on conflict (name) do nothing;

    insert into audit_submissions_e75a6481 (
      id,
      office_id,
      caption,
      thumbnail,
      status,
      recommendation,
      posting_date,
      reviewer,
      submission_date,
      last_updated,
      audit_focus,
      pubmat_type,
      has_been_revised,
      created_at,
      updated_at
    )
    select
      p.id,
      o.id,
      coalesce(p.value->>'caption', ''),
      p.value->>'thumbnail',
      coalesce(p.value->>'status', 'Rejected'),
      coalesce(p.value->>'recommendation', p.value->>'remarks', ''),
      case when coalesce(p.value->>'date', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p.value->>'date')::date else null end,
      p.value->>'reviewer',
      case when coalesce(p.value->>'submissionDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p.value->>'submissionDate')::date else null end,
      case when coalesce(p.value->>'lastUpdated', '') ~ '^\d{4}-\d{2}-\d{2}$' then (p.value->>'lastUpdated')::date else null end,
      coalesce(p.value->>'auditFocus', 'caption'),
      p.value->>'pubmatType',
      case
        when lower(coalesce(p.value->>'hasBeenRevised', 'false')) = 'true' then true
        else false
      end,
      coalesce(p.created_at, now()),
      coalesce(p.updated_at, now())
    from posts_e75a6481 p
    left join offices_e75a6481 o on o.name = p.value->>'office'
    on conflict (id) do nothing;

    insert into platforms_e75a6481(name)
    select distinct platform_name
    from posts_e75a6481 p
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(p.value->'platform') = 'array' then p.value->'platform'
        when p.value ? 'platform' then jsonb_build_array(p.value->'platform')
        else '[]'::jsonb
      end
    ) as platform_name
    where nullif(platform_name, '') is not null
    on conflict (name) do nothing;

    insert into submission_platforms_e75a6481(submission_id, platform)
    select distinct p.id, platform_name
    from posts_e75a6481 p
    cross join lateral jsonb_array_elements_text(
      case
        when jsonb_typeof(p.value->'platform') = 'array' then p.value->'platform'
        when p.value ? 'platform' then jsonb_build_array(p.value->'platform')
        else '[]'::jsonb
      end
    ) as platform_name
    where nullif(platform_name, '') is not null
    on conflict (submission_id, platform) do nothing;

    insert into audit_scores_e75a6481 (
      submission_id,
      score,
      caption_score,
      pubmat_score,
      grammar,
      inclusivity,
      tone
    )
    select
      id,
      case when coalesce(value->>'score', '') ~ '^-?\d+(\.\d+)?$' then (value->>'score')::numeric else 0 end,
      case when coalesce(value->>'captionScore', '') ~ '^-?\d+(\.\d+)?$' then (value->>'captionScore')::numeric else null end,
      case when coalesce(value->>'pubmatScore', '') ~ '^-?\d+(\.\d+)?$' then (value->>'pubmatScore')::numeric else null end,
      case when coalesce(value->>'grammar', '') ~ '^-?\d+(\.\d+)?$' then (value->>'grammar')::numeric else null end,
      case when coalesce(value->>'inclusivity', '') ~ '^-?\d+(\.\d+)?$' then (value->>'inclusivity')::numeric else null end,
      case when coalesce(value->>'tone', '') ~ '^-?\d+(\.\d+)?$' then (value->>'tone')::numeric else null end
    from posts_e75a6481
    on conflict (submission_id) do nothing;

    insert into central_reviews_e75a6481(submission_id, status, comment, reviewed_on)
    select
      id,
      coalesce(value->>'centralReviewStatus', 'Pending Review'),
      value->>'centralReviewComment',
      case when coalesce(value->>'centralReviewDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (value->>'centralReviewDate')::date else null end
    from posts_e75a6481
    where value ? 'centralReviewStatus' or value ? 'centralReviewComment'
    on conflict (submission_id) do nothing;

    insert into appeals_e75a6481(submission_id, status, comment, appealed_on)
    select
      id,
      coalesce(value->>'appealStatus', 'Appealed'),
      value->>'appealComment',
      case when coalesce(value->>'appealDate', '') ~ '^\d{4}-\d{2}-\d{2}$' then (value->>'appealDate')::date else null end
    from posts_e75a6481
    where coalesce(value->>'appealStatus', 'Not Appealed') <> 'Not Appealed'
       or value ? 'appealComment'
    on conflict do nothing;
  end if;
end $$;

-- Migrate legacy access request array when the KV table exists.
do $$
begin
  if to_regclass('public.kv_store_e75a6481') is not null then
    insert into access_requests_e75a6481 (
      id,
      type,
      office_email,
      office_name,
      status,
      submitted_at,
      reason,
      new_assigned_person,
      verification_code,
      verification_code_expires_at,
      requested_password
    )
    select
      req->>'id',
      coalesce(req->>'type', 'forgot-password'),
      coalesce(req->>'officeEmail', ''),
      coalesce(req->>'officeName', ''),
      coalesce(req->>'status', 'Pending'),
      coalesce(nullif(req->>'submittedAt', '')::timestamptz, now()),
      req->>'reason',
      req->>'newAssignedPerson',
      req->>'verificationCode',
      nullif(req->>'verificationCodeExpiresAt', '')::timestamptz,
      req->>'requestedPassword'
    from kv_store_e75a6481 k
    cross join lateral jsonb_array_elements(k.value) req
    where k.key = 'access_requests'
      and req ? 'id'
    on conflict (id) do nothing;

    insert into app_counters_e75a6481(key, value)
    select 'account_password_counter', coalesce((value #>> '{}')::integer, 0)
    from kv_store_e75a6481
    where key = 'account_password_counter'
    on conflict (key) do nothing;
  end if;
end $$;
