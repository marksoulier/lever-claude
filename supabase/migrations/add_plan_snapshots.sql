-- Plan projection snapshots: historical record of how a plan's projected
-- retirement balance changed over time as the user added events, updated
-- context, uploaded documents, or received new information.
--
-- Unlike net_worth_snapshots (actual current wealth), these record the
-- PROJECTED future balance at the moment the snapshot was taken.
-- Together they tell the story of a plan's evolution.
--
-- Apply via: Supabase Dashboard → SQL Editor → run this file
-- Or: mcp__supabase__apply_migration

create table if not exists plan_snapshots (
  id                          uuid default gen_random_uuid() primary key,
  plan_id                     uuid references plans(id) on delete cascade not null,
  user_id                     uuid references auth.users(id) not null,
  recorded_at                 timestamptz default now() not null,

  -- Core projection at time of snapshot
  projected_balance           bigint not null,
  success_probability         integer,
  monthly_income_at_retirement integer,
  monthly_contribution        integer,

  -- Plan state at time of snapshot
  event_count                 integer default 0,

  -- What triggered this snapshot (for the "how your plan evolved" narrative)
  trigger_source              text,   -- 'update_plan' | 'update_context' | 'document_read' | 'update_contribution' | 'create_plan'
  snapshot_note               text    -- optional human-readable description: "Added mortgage event"
);

-- Index for efficient per-plan history queries
create index if not exists plan_snapshots_plan_id_recorded_at
  on plan_snapshots(plan_id, recorded_at desc);

-- RLS: users can only read their own snapshots
alter table plan_snapshots enable row level security;

create policy "users can read own plan snapshots"
  on plan_snapshots for select
  using (auth.uid() = user_id);

create policy "service role can insert plan snapshots"
  on plan_snapshots for insert
  with check (true);
