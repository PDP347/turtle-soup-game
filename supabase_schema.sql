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
