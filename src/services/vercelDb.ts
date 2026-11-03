import {
  createChampionshipFromTeams,
  DEFAULT_RULES,
  drawTeams,
  INITIAL_PLAYERS,
} from '../utils/peladaLogic';
import { RoomState } from '../types/pelada';

const memoryRooms = new Map<string, RoomState>();
let schemaInitialized = false;

export function buildInitialRoom(code: string, name: string, hostName: string): RoomState {
  const initialTeams = drawTeams(
    INITIAL_PLAYERS,
    DEFAULT_RULES,
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.42
  );
  const initialChamp = createChampionshipFromTeams(
    'Copa Society dos Amigos',
    'pontos_corridos',
    initialTeams
  );

  return {
    code: code.toUpperCase(),
    name,
    hostName,
    players: INITIAL_PLAYERS.map((p) => ({ ...p })),
    rules: { ...DEFAULT_RULES },
    drawnTeams: initialTeams,
    coinToss: {
      result: null,
      callerTeamId: initialTeams[0]?.id || 'team-1',
      callerChoice: 'cara',
      winnerTeamId: null,
      ballTeamId: null,
      fieldSideTeamA: 'Lado Norte (Esquerdo)',
      fieldSideTeamB: 'Lado Sul (Direito)',
      flippedAt: null,
    },
    liveMatch: {
      isRunning: false,
      remainingSeconds: DEFAULT_RULES.durationMinutes * 60,
      configuredMinutes: DEFAULT_RULES.durationMinutes,
      addedStoppageMinutes: 0,
      scoreA: 0,
      scoreB: 0,
      teamAId: initialTeams[0]?.id || 'team-1',
      teamBId: initialTeams[1]?.id || 'team-2',
      events: [],
      winnerTeamId: null,
      endedReason: null,
    },
    championship: initialChamp,
    participants: [
      {
        clientId: 'seed-host',
        name: hostName,
        role: 'host',
        joinedAt: Date.now(),
      },
    ],
    activityFeed: [
      {
        id: 'act-init',
        text: `Sala privada ${code.toUpperCase()} criada por ${hostName}`,
        timestamp: Date.now(),
      },
    ],
    updatedAt: Date.now(),
  };
}

// Seed default room in memory
memoryRooms.set(
  'SOC-10',
  buildInitialRoom('SOC-10', 'Pelada Society de Terça 21h', 'Vitor (Organizador)')
);

function getPostgresConnectionString(): string | null {
  const url =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '';
  if (!url || url === 'MY_POSTGRES_URL' || !url.startsWith('postgres')) {
    return null;
  }
  return url;
}

function getGitHubDbConfig(): { token: string; repo: string; path: string } | null {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  const repo = process.env.GITHUB_REPO || '';
  const filePath = process.env.GITHUB_DB_PATH || 'db/rooms-data.json';
  if (!token || !repo || !repo.includes('/')) {
    return null;
  }
  return { token, repo: repo.trim(), path: filePath };
}

async function readRoomFromGitHub(code: string): Promise<RoomState | null> {
  const cfg = getGitHubDbConfig();
  if (!cfg) return null;
  try {
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    if (!data.content) return null;
    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
    const allRooms = JSON.parse(decoded) as Record<string, RoomState>;
    return allRooms[code] || null;
  } catch (err) {
    console.error('GitHub DB read error:', err);
    return null;
  }
}

async function writeRoomToGitHub(room: RoomState): Promise<boolean> {
  const cfg = getGitHubDbConfig();
  if (!cfg) return false;
  try {
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${cfg.path}`;
    const headers = {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };

    let existingSha: string | undefined;
    let allRooms: Record<string, RoomState> = {};

    const getRes = await fetch(url, { headers });
    if (getRes.ok) {
      const existingData = (await getRes.json()) as { sha?: string; content?: string };
      existingSha = existingData.sha;
      if (existingData.content) {
        try {
          allRooms = JSON.parse(
            Buffer.from(existingData.content, 'base64').toString('utf-8')
          ) as Record<string, RoomState>;
        } catch {
          allRooms = {};
        }
      }
    }

    allRooms[room.code] = room;
    const encodedContent = Buffer.from(JSON.stringify(allRooms, null, 2), 'utf-8').toString(
      'base64'
    );

    const putRes = await fetch(url, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `chore(db): update room ${room.code} at ${new Date().toISOString()}`,
        content: encodedContent,
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    return putRes.ok;
  } catch (err) {
    console.error('GitHub DB write error:', err);
    return false;
  }
}

/**
 * Executes parameterized SQL against Vercel Postgres / Neon over HTTPS SQL endpoint.
 */
async function executeVercelSql<T = Record<string, unknown>>(
  query: string,
  params: unknown[] = []
): Promise<T[] | null> {
  const connStr = getPostgresConnectionString();
  if (!connStr) return null;

  try {
    const parsed = new URL(connStr);
    const httpEndpoint = `https://${parsed.hostname}/sql`;
    const response = await fetch(httpEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Neon-Connection-String': connStr,
      },
      body: JSON.stringify({ query, params }),
    });

    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { rows?: T[] };
    return data.rows || [];
  } catch (err) {
    console.error('Vercel Postgres SQL execution error:', err);
    return null;
  }
}

async function ensureSchema(): Promise<void> {
  if (schemaInitialized || !getPostgresConnectionString()) return;
  const ddl = `
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
  `;
  const res = await executeVercelSql(ddl);
  if (res !== null) {
    schemaInitialized = true;
  }
}

function mapRowToRoom(row: Record<string, unknown>): RoomState {
  return {
    code: String(row.code),
    name: String(row.name),
    hostName: String(row.host_name),
    players: (row.players as RoomState['players']) || [],
    rules: (row.rules as RoomState['rules']) || { ...DEFAULT_RULES },
    drawnTeams: (row.drawn_teams as RoomState['drawnTeams']) || [],
    coinToss: row.coin_toss as RoomState['coinToss'],
    liveMatch: row.live_match as RoomState['liveMatch'],
    championship: (row.championship as RoomState['championship']) || null,
    participants: (row.participants as RoomState['participants']) || [],
    activityFeed: (row.activity_feed as RoomState['activityFeed']) || [],
    updatedAt: Number(row.updated_at) || Date.now(),
  };
}

export async function getRoomState(code: string): Promise<RoomState | null> {
  const normalized = code.toUpperCase().trim();
  await ensureSchema();

  const rows = await executeVercelSql(
    `SELECT * FROM pelada_rooms WHERE code = $1 LIMIT 1`,
    [normalized]
  );

  if (rows && rows.length > 0) {
    const dbRoom = mapRowToRoom(rows[0]);
    memoryRooms.set(normalized, dbRoom);
    return dbRoom;
  }

  const ghRoom = await readRoomFromGitHub(normalized);
  if (ghRoom) {
    memoryRooms.set(normalized, ghRoom);
    return ghRoom;
  }

  const mem = memoryRooms.get(normalized) || null;
  if (mem && (getPostgresConnectionString() || getGitHubDbConfig())) {
    await saveRoomState(mem);
  }
  return mem;
}

export async function saveRoomState(room: RoomState): Promise<RoomState> {
  const normalized = room.code.toUpperCase().trim();
  const updated: RoomState = {
    ...room,
    code: normalized,
    updatedAt: Date.now(),
  };
  memoryRooms.set(normalized, updated);

  if (getPostgresConnectionString()) {
    await ensureSchema();
    await executeVercelSql(
      `INSERT INTO pelada_rooms (
        code, name, host_name, players, rules, drawn_teams, coin_toss, live_match, championship, participants, activity_feed, updated_at
      ) VALUES (
        $1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12
      )
      ON CONFLICT (code) DO UPDATE SET
        name = EXCLUDED.name,
        host_name = EXCLUDED.host_name,
        players = EXCLUDED.players,
        rules = EXCLUDED.rules,
        drawn_teams = EXCLUDED.drawn_teams,
        coin_toss = EXCLUDED.coin_toss,
        live_match = EXCLUDED.live_match,
        championship = EXCLUDED.championship,
        participants = EXCLUDED.participants,
        activity_feed = EXCLUDED.activity_feed,
        updated_at = EXCLUDED.updated_at`,
      [
        updated.code,
        updated.name,
        updated.hostName,
        JSON.stringify(updated.players),
        JSON.stringify(updated.rules),
        JSON.stringify(updated.drawnTeams),
        JSON.stringify(updated.coinToss),
        JSON.stringify(updated.liveMatch),
        JSON.stringify(updated.championship),
        JSON.stringify(updated.participants),
        JSON.stringify(updated.activityFeed),
        updated.updatedAt,
      ]
    );
  } else if (getGitHubDbConfig()) {
    await writeRoomToGitHub(updated);
  }

  return updated;
}

export function getMemoryRoomsMap(): Map<string, RoomState> {
  return memoryRooms;
}

export function isVercelDbConfigured(): boolean {
  return Boolean(getPostgresConnectionString() || getGitHubDbConfig());
}

export function getActiveStorageType(): 'vercel_postgres' | 'github_db' | 'memory_fallback' {
  if (getPostgresConnectionString()) return 'vercel_postgres';
  if (getGitHubDbConfig()) return 'github_db';
  return 'memory_fallback';
}
