import type {
  CoinTossState,
  LiveMatchState,
  MatchRules,
  Player,
  RoomState,
} from '../types/pelada.js';
import {
  DEFAULT_RULES,
  normalizePlayerName,
  sanitizePlayersHostFlag,
} from './peladaLogic.js';

export function createDefaultCoinToss(teamAId = 'team-1'): CoinTossState {
  return {
    result: null,
    callerTeamId: teamAId,
    callerChoice: 'cara',
    winnerTeamId: null,
    ballTeamId: null,
    fieldSideTeamA: 'Lado Norte (Esquerdo)',
    fieldSideTeamB: 'Lado Sul (Direito)',
    flippedAt: null,
  };
}

export function createDefaultLiveMatch(
  durationMinutes = DEFAULT_RULES.durationMinutes,
  teamAId = 'team-1',
  teamBId = 'team-2'
): LiveMatchState {
  return {
    isRunning: false,
    remainingSeconds: durationMinutes * 60,
    configuredMinutes: durationMinutes,
    addedStoppageMinutes: 0,
    scoreA: 0,
    scoreB: 0,
    teamAId,
    teamBId,
    events: [],
    winnerTeamId: null,
    endedReason: null,
    timerStartedAt: null,
    remainingAtStart: durationMinutes * 60,
  };
}

export function normalizeCoinToss(
  raw: Partial<CoinTossState> | null | undefined,
  fallbackTeamAId = 'team-1'
): CoinTossState {
  const base = createDefaultCoinToss(fallbackTeamAId);
  if (!raw || typeof raw !== 'object') return base;
  return {
    result: raw.result === 'cara' || raw.result === 'coroa' ? raw.result : null,
    callerTeamId: raw.callerTeamId || base.callerTeamId,
    callerChoice: raw.callerChoice === 'coroa' ? 'coroa' : 'cara',
    winnerTeamId: raw.winnerTeamId ?? null,
    ballTeamId: raw.ballTeamId ?? null,
    fieldSideTeamA:
      raw.fieldSideTeamA === 'Lado Sul (Direito)'
        ? 'Lado Sul (Direito)'
        : 'Lado Norte (Esquerdo)',
    fieldSideTeamB:
      raw.fieldSideTeamB === 'Lado Norte (Esquerdo)'
        ? 'Lado Norte (Esquerdo)'
        : 'Lado Sul (Direito)',
    flippedAt: raw.flippedAt ?? null,
  };
}

export function normalizeLiveMatch(
  raw: Partial<LiveMatchState> | null | undefined,
  durationMinutes = DEFAULT_RULES.durationMinutes,
  teamAId = 'team-1',
  teamBId = 'team-2'
): LiveMatchState {
  const base = createDefaultLiveMatch(durationMinutes, teamAId, teamBId);
  if (!raw || typeof raw !== 'object') return base;
  return {
    isRunning: Boolean(raw.isRunning),
    remainingSeconds:
      typeof raw.remainingSeconds === 'number' && Number.isFinite(raw.remainingSeconds)
        ? Math.max(0, raw.remainingSeconds)
        : base.remainingSeconds,
    configuredMinutes:
      typeof raw.configuredMinutes === 'number' && Number.isFinite(raw.configuredMinutes)
        ? raw.configuredMinutes
        : base.configuredMinutes,
    addedStoppageMinutes:
      typeof raw.addedStoppageMinutes === 'number' && Number.isFinite(raw.addedStoppageMinutes)
        ? Math.max(0, raw.addedStoppageMinutes)
        : 0,
    scoreA: typeof raw.scoreA === 'number' && Number.isFinite(raw.scoreA) ? Math.max(0, raw.scoreA) : 0,
    scoreB: typeof raw.scoreB === 'number' && Number.isFinite(raw.scoreB) ? Math.max(0, raw.scoreB) : 0,
    teamAId: raw.teamAId || base.teamAId,
    teamBId: raw.teamBId || base.teamBId,
    events: Array.isArray(raw.events) ? raw.events : [],
    winnerTeamId: raw.winnerTeamId ?? null,
    endedReason: raw.endedReason ?? null,
    timerStartedAt: raw.timerStartedAt ?? null,
    remainingAtStart:
      typeof raw.remainingAtStart === 'number' && Number.isFinite(raw.remainingAtStart)
        ? Math.max(0, raw.remainingAtStart)
        : undefined,
  };
}

export function normalizeRules(raw: Partial<MatchRules> | null | undefined): MatchRules {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_RULES };
  return {
    linePlayersPerTeam:
      typeof raw.linePlayersPerTeam === 'number' && raw.linePlayersPerTeam >= 1
        ? raw.linePlayersPerTeam
        : DEFAULT_RULES.linePlayersPerTeam,
    goalkeepersPerTeam:
      typeof raw.goalkeepersPerTeam === 'number' && raw.goalkeepersPerTeam >= 0
        ? raw.goalkeepersPerTeam
        : DEFAULT_RULES.goalkeepersPerTeam,
    durationMinutes:
      typeof raw.durationMinutes === 'number' && raw.durationMinutes >= 1
        ? raw.durationMinutes
        : DEFAULT_RULES.durationMinutes,
    goalLimit:
      raw.goalLimit === null || typeof raw.goalLimit === 'number'
        ? raw.goalLimit
        : DEFAULT_RULES.goalLimit,
    extraTimeMinutes:
      typeof raw.extraTimeMinutes === 'number' ? raw.extraTimeMinutes : 0,
    autoRotateWinnerStays:
      typeof raw.autoRotateWinnerStays === 'boolean'
        ? raw.autoRotateWinnerStays
        : DEFAULT_RULES.autoRotateWinnerStays,
  };
}

export function hasDuplicatePlayer(players: Player[], candidate: Pick<Player, 'id' | 'name'>): boolean {
  const normCandidate = normalizePlayerName(candidate.name);
  return players.some(
    (p) =>
      (candidate.id && p.id === candidate.id) ||
      (normCandidate.length > 0 && normalizePlayerName(p.name) === normCandidate)
  );
}

export function normalizeRoomState(raw: Partial<RoomState> & { code: string }): RoomState {
  const players = sanitizePlayersHostFlag(Array.isArray(raw.players) ? raw.players : []);
  const rules = normalizeRules(raw.rules);
  const drawnTeams = players.length >= 2 && Array.isArray(raw.drawnTeams) ? raw.drawnTeams : [];
  const teamAId = drawnTeams[0]?.id || 'team-1';
  const teamBId = drawnTeams[1]?.id || 'team-2';

  return {
    code: String(raw.code || 'SOC-10').toUpperCase().trim(),
    name: String(raw.name || 'Pelada Privada'),
    hostName: String(raw.hostName || 'Organizador'),
    players,
    rules,
    drawnTeams,
    coinToss: normalizeCoinToss(raw.coinToss, teamAId),
    liveMatch: normalizeLiveMatch(raw.liveMatch, rules.durationMinutes, teamAId, teamBId),
    championship: raw.championship ?? null,
    participants: Array.isArray(raw.participants) ? raw.participants : [],
    activityFeed: Array.isArray(raw.activityFeed) ? raw.activityFeed : [],
    updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0,
    ...(raw.isServerSeed !== undefined ? { isServerSeed: Boolean(raw.isServerSeed) } : {}),
  };
}

