import type { Request, Response } from 'express';

interface Player {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  rating: number;
  isHost?: boolean;
  confirmed: boolean;
}

interface RoomState {
  code: string;
  name: string;
  hostName: string;
  players: Player[];
  rules: Record<string, unknown>;
  drawnTeams: unknown[];
  coinToss: Record<string, unknown>;
  liveMatch: Record<string, unknown>;
  championship: unknown;
  participants: { clientId: string; name: string; role: 'host' | 'guest'; joinedAt: number }[];
  activityFeed: { id: string; text: string; timestamp: number }[];
  updatedAt: number;
}

const DEFAULT_RULES = {
  linePlayersPerTeam: 5,
  goalkeepersPerTeam: 1,
  durationMinutes: 10,
  goalLimit: 2,
  extraTimeMinutes: 0,
  autoRotateWinnerStays: true,
};

const INITIAL_PLAYERS: Player[] = [
  { id: 'p-1', name: 'Vitor (Você)', isGoalkeeper: false, rating: 5, isHost: true, confirmed: true },
  { id: 'p-2', name: 'Matheus Muralha', isGoalkeeper: true, rating: 5, confirmed: true },
  { id: 'p-3', name: 'Cássio Luva', isGoalkeeper: true, rating: 4, confirmed: true },
  { id: 'p-4', name: 'Julio Cesar', isGoalkeeper: true, rating: 4, confirmed: true },
  { id: 'p-5', name: 'Lucas Paquetá', isGoalkeeper: false, rating: 5, confirmed: true },
  { id: 'p-6', name: 'Gabriel Jesus', isGoalkeeper: false, rating: 5, confirmed: true },
  { id: 'p-7', name: 'Bruno Guimarães', isGoalkeeper: false, rating: 5, confirmed: true },
  { id: 'p-8', name: 'Rafinha Canhota', isGoalkeeper: false, rating: 5, confirmed: true },
  { id: 'p-9', name: 'Thiago Silva', isGoalkeeper: false, rating: 4, confirmed: true },
  { id: 'p-10', name: 'Danilo Lateral', isGoalkeeper: false, rating: 4, confirmed: true },
  { id: 'p-11', name: 'Pedro Queixada', isGoalkeeper: false, rating: 4, confirmed: true },
  { id: 'p-12', name: 'Marquinhos Zaga', isGoalkeeper: false, rating: 4, confirmed: true },
  { id: 'p-13', name: 'André Volante', isGoalkeeper: false, rating: 3, confirmed: true },
  { id: 'p-14', name: 'Everton Cebolinha', isGoalkeeper: false, rating: 3, confirmed: true },
  { id: 'p-15', name: 'Gerson Coringa', isGoalkeeper: false, rating: 4, confirmed: true },
  { id: 'p-16', name: 'Caio Paulista', isGoalkeeper: false, rating: 3, confirmed: true },
  { id: 'p-17', name: 'Léo Pereira', isGoalkeeper: false, rating: 3, confirmed: true },
  { id: 'p-18', name: 'Arrascaeta', isGoalkeeper: false, rating: 5, confirmed: true },
];

const memoryRooms = new Map<string, RoomState>();
let schemaInitialized = false;

function buildSeedRoom(code: string, name: string, hostName: string): RoomState {
  return {
    code: code.toUpperCase(),
    name,
    hostName,
    players: INITIAL_PLAYERS.map((p) => ({ ...p })),
    rules: { ...DEFAULT_RULES },
    drawnTeams: [],
    coinToss: {
      result: null,
      callerTeamId: 'team-1',
      callerChoice: 'cara',
      winnerTeamId: null,
      ballTeamId: null,
      fieldSideTeamA: 'Lado Norte (Esquerdo)',
      fieldSideTeamB: 'Lado Sul (Direito)',
      flippedAt: null,
    },
    liveMatch: {
      isRunning: false,
      remainingSeconds: 600,
      configuredMinutes: 10,
      addedStoppageMinutes: 0,
      scoreA: 0,
      scoreB: 0,
      teamAId: 'team-1',
      teamBId: 'team-2',
      events: [],
      winnerTeamId: null,
      endedReason: null,
    },
    championship: null,
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

function getActiveStorageType(): 'vercel_postgres' | 'github_db' | 'memory_fallback' {
  if (getPostgresConnectionString()) return 'vercel_postgres';
  if (getGitHubDbConfig()) return 'github_db';
  return 'memory_fallback';
}

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
    if (!response.ok) return null;
    const data = (await response.json()) as { rows?: T[] };
    return data.rows || [];
  } catch {
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
  if (res !== null) schemaInitialized = true;
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
  } catch {
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
  } catch {
    return false;
  }
}

async function getRoomState(code: string): Promise<RoomState | null> {
  const normalized = code.toUpperCase().trim();
  if (getPostgresConnectionString()) {
    await ensureSchema();
    const rows = await executeVercelSql(
      `SELECT * FROM pelada_rooms WHERE code = $1 LIMIT 1`,
      [normalized]
    );
    if (rows && rows.length > 0) {
      const r = rows[0];
      const dbRoom: RoomState = {
        code: String(r.code),
        name: String(r.name),
        hostName: String(r.host_name),
        players: (r.players as Player[]) || [],
        rules: (r.rules as Record<string, unknown>) || { ...DEFAULT_RULES },
        drawnTeams: (r.drawn_teams as unknown[]) || [],
        coinToss: (r.coin_toss as Record<string, unknown>) || {},
        liveMatch: (r.live_match as Record<string, unknown>) || {},
        championship: r.championship ?? null,
        participants: (r.participants as RoomState['participants']) || [],
        activityFeed: (r.activity_feed as RoomState['activityFeed']) || [],
        updatedAt: Number(r.updated_at) || Date.now(),
      };
      memoryRooms.set(normalized, dbRoom);
      return dbRoom;
    }
  }

  const ghRoom = await readRoomFromGitHub(normalized);
  if (ghRoom) {
    memoryRooms.set(normalized, ghRoom);
    return ghRoom;
  }

  return memoryRooms.get(normalized) || null;
}

async function saveRoomState(room: RoomState): Promise<RoomState> {
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

export default async function handler(req: Request, res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const queryCode =
      (typeof req.query?.code === 'string' ? req.query.code : '') ||
      (req.params?.code ? String(req.params.code) : '');

    if (req.method === 'GET') {
      const code = (queryCode || 'SOC-10').toUpperCase().trim();
      let room = await getRoomState(code);
      if (!room && code === 'SOC-10') {
        room = await saveRoomState(
          buildSeedRoom('SOC-10', 'Pelada Society de Terça 21h', 'Vitor (Organizador)')
        );
      }
      if (!room) {
        res.status(404).json({ error: 'Sala não encontrada.' });
        return;
      }
      res.status(200).json({
        room,
        storage: getActiveStorageType(),
      });
      return;
    }

    if (req.method === 'POST') {
      const { code: requestedCode, name, hostName, customState } = req.body || {};
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const code = requestedCode
        ? String(requestedCode).toUpperCase().trim()
        : `FUT-${randomSuffix}`;

      const baseRoom = buildSeedRoom(
        code,
        name || 'Pelada Privada Ao Vivo',
        hostName || 'Organizador'
      );

      if (customState) {
        if (Array.isArray(customState.players)) baseRoom.players = customState.players;
        if (customState.rules) baseRoom.rules = customState.rules;
        if (Array.isArray(customState.drawnTeams)) baseRoom.drawnTeams = customState.drawnTeams;
        if (customState.coinToss) baseRoom.coinToss = customState.coinToss;
        if (customState.liveMatch) baseRoom.liveMatch = customState.liveMatch;
        if (customState.championship !== undefined) {
          baseRoom.championship = customState.championship;
        }
      }

      const saved = await saveRoomState(baseRoom);
      res.status(200).json({
        room: saved,
        storage: getActiveStorageType(),
      });
      return;
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const { roomCode, payload, activityText, action, player, playerId, userName, role } =
        req.body || {};
      const targetCode = (queryCode || roomCode || 'SOC-10').toUpperCase().trim();
      let room = await getRoomState(targetCode);

      if (!room) {
        room = buildSeedRoom(targetCode, `Arena ${targetCode}`, userName || 'Organizador');
      }

      if (action === 'join' && userName) {
        const cleanUser = String(userName).trim();
        room.participants = room.participants.filter((p) => p.name !== cleanUser);
        room.participants.push({
          clientId: `http-${Date.now()}`,
          name: cleanUser,
          role: role === 'host' ? 'host' : 'guest',
          joinedAt: Date.now(),
        });
        room.activityFeed = [
          {
            id: `act-${Date.now()}`,
            text: `${cleanUser} conectou-se à sala`,
            timestamp: Date.now(),
          },
          ...room.activityFeed.slice(0, 19),
        ];
      } else if (action === 'add_player' && player && player.id) {
        if (!room.players.some((p) => p.id === player.id)) {
          room.players.push(player);
          room.activityFeed = [
            {
              id: `act-${Date.now()}`,
              text: `${player.name} confirmou presença na lista (${
                player.isGoalkeeper ? 'Goleiro' : 'Linha'
              })`,
              timestamp: Date.now(),
            },
            ...room.activityFeed.slice(0, 19),
          ];
        }
      } else if (action === 'toggle_presence' && playerId) {
        const target = room.players.find((p) => p.id === playerId);
        if (target) {
          target.confirmed = !target.confirmed;
          room.activityFeed = [
            {
              id: `act-${Date.now()}`,
              text: `${target.name} ${
                target.confirmed ? 'confirmou presença' : 'saiu da lista'
              }`,
              timestamp: Date.now(),
            },
            ...room.activityFeed.slice(0, 19),
          ];
        }
      } else if (payload) {
        if (payload.players) room.players = payload.players;
        if (payload.rules) room.rules = payload.rules;
        if (payload.drawnTeams) room.drawnTeams = payload.drawnTeams;
        if (payload.coinToss) room.coinToss = payload.coinToss;
        if (payload.liveMatch) room.liveMatch = payload.liveMatch;
        if (payload.championship !== undefined) {
          room.championship = payload.championship;
        }
      }

      if (activityText) {
        room.activityFeed = [
          {
            id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            text: String(activityText),
            timestamp: Date.now(),
          },
          ...room.activityFeed.slice(0, 19),
        ];
      }

      const saved = await saveRoomState(room);
      res.status(200).json({
        room: saved,
        storage: getActiveStorageType(),
      });
      return;
    }

    res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('Erro na API /api/rooms:', err);
    res.status(500).json({ error: 'Erro interno ao processar sala no banco de dados.' });
  }
}
