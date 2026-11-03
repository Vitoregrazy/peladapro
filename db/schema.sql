-- Schema para Banco de Dados da Vercel (Vercel Postgres / Neon)
-- Tabela principal que armazena o estado completo das salas, sorteios, súmula e campeonatos do PeladaPro

CREATE TABLE IF NOT EXISTS pelada_rooms (
  code VARCHAR(20) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  host_name VARCHAR(120) NOT NULL,
  players JSONB NOT NULL DEFAULT '[]'::jsonb,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  drawn_teams JSONB NOT NULL DEFAULT '[]'::jsonb,
  coin_toss JSONB NOT NULL DEFAULT '{}'::jsonb,
  live_match JSONB NOT NULL DEFAULT '{}'::jsonb,
  championship JSONB,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  activity_feed JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pelada_rooms_updated_at ON pelada_rooms (updated_at DESC);
