-- =====================================================
-- 海龟汤联机版 — Supabase 数据库初始化脚本
-- 在 Supabase Dashboard → SQL Editor 中运行此脚本
-- =====================================================

-- 1. 房间表
create table if not exists public.rooms (
  id          text        primary key,          -- 4位数字房间号，如 "1234"
  puzzle_data jsonb       not null,             -- 完整的题目数据（汤面+汤底）
  status      text        not null default 'waiting'
                          check (status in ('waiting', 'playing', 'revealed')),
  created_at  timestamptz not null default now()
);

-- 2. 消息表
create table if not exists public.messages (
  id          bigserial   primary key,
  room_id     text        not null references public.rooms(id) on delete cascade,
  player_name text        not null,             -- 玩家昵称
  content     text        not null,
  is_ai       boolean     not null default false,
  created_at  timestamptz not null default now()
);

-- 3. 开启 Realtime 实时推送（关键！）
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.messages;

-- 4. 允许匿名用户读写（仅供本地/原型使用，生产环境请配置 RLS）
alter table public.rooms   enable row level security;
alter table public.messages enable row level security;

create policy "allow all rooms"    on public.rooms    for all using (true) with check (true);
create policy "allow all messages" on public.messages for all using (true) with check (true);

-- 5. 玩家统计表 (V5 积分系统)
create table if not exists public.player_stats (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,             -- 简单起见，可以用本地存储的唯一 ID 或昵称
  theme       text        not null,             -- 对应 PuzzleTheme
  matches_won integer     not null default 0,   -- 胜利次数
  total_questions integer not null default 0,   -- 总提问数
  last_played timestamptz not null default now()
);

alter table public.player_stats enable row level security;
create policy "allow all stats" on public.player_stats for all using (true) with check (true);

-- =====================================================
-- 谁是卧底模块
-- =====================================================

-- 6. 谁是卧底房间表
create table if not exists public.undercover_rooms (
  id          text        primary key,          -- 4位数字房间号
  session_data jsonb       not null,             -- 包含游戏阶段、玩家列表、当前发言人等状态
  status      text        not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  created_at  timestamptz not null default now()
);

-- 7. 谁是卧底消息表 (用于发言记录与复盘)
create table if not exists public.undercover_messages (
  id          bigserial   primary key,
  room_id     text        not null references public.undercover_rooms(id) on delete cascade,
  player_name text        not null,
  content     text        not null,
  is_ai       boolean     not null default false,
  message_type text       not null default 'chat', -- 'chat', 'system', 'vote'
  created_at  timestamptz not null default now()
);

alter publication supabase_realtime add table public.undercover_rooms;
alter publication supabase_realtime add table public.undercover_messages;

alter table public.undercover_rooms enable row level security;
alter table public.undercover_messages enable row level security;

create policy "allow all undercover rooms" on public.undercover_rooms for all using (true) with check (true);
create policy "allow all undercover messages" on public.undercover_messages for all using (true) with check (true);
