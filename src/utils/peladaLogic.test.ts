import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStandings,
  calculateTopScorers,
  createChampionshipFromTeams,
  DEFAULT_RULES,
  drawTeams,
  evaluateMatchStatus,
  exportWhatsAppList,
  flipVirtualCoin,
  INITIAL_PLAYERS,
  parseWhatsAppList,
  recordGoalScorerInMatch,
  rotateKingOfTheCourt,
  sanitizePlayersHostFlag,
  syncChampionshipKnockout,
} from './peladaLogic';
import { hasDuplicatePlayer, normalizeRoomState } from './roomState';
import {
  appendCacheBuster,
  compareSemver,
  isMandatoryManifest,
  selectBestOtaManifest,
  shouldBlockForMandatoryUpdate,
} from '../services/otaHelpers';
import { MatchRules, Player, RiggingConfig } from '../types/pelada';

test('parseWhatsAppList extracts goalkeepers and outfield players from typical WhatsApp text', () => {
  const sampleWhatsApp = `
Pelada de Quarta 20h30
Local: Arena Society Central
Valor: R$ 25,00

GOLEIROS:
1. Marcos Muralha ✅
2 - Diego Alves 🧤

LINHA:
01. Vitor Craque ⭐️⭐️⭐️⭐️⭐️
02 - Gabriel Gol - Pago
3) Lucas Moura (5 estrelas)
4. Danilo Lateral
5. Bruno Volante (Goleiro)

LISTA DE ESPERA:
1. Zé Atrasado
  `;

  const parsed = parseWhatsAppList(sampleWhatsApp);
  assert.equal(parsed.goalkeepers.length, 3);
  assert.equal(parsed.goalkeepers[0].name, 'Marcos Muralha');
  assert.equal(parsed.goalkeepers[2].name, 'Bruno Volante');

  // Outfield includes 4 active + 1 waitlist (unconfirmed)
  const confirmedLine = parsed.linePlayers.filter((p) => p.confirmed);
  assert.equal(confirmedLine.length, 4);
  assert.equal(confirmedLine[0].name, 'Vitor Craque');
  assert.equal(confirmedLine[0].rating, 5);
  assert.equal(confirmedLine[1].name, 'Gabriel Gol');
});

test('drawTeams respects custom formation (e.g. 4+1, 5+1, 10+1)', () => {
  const customRules: MatchRules = {
    ...DEFAULT_RULES,
    linePlayersPerTeam: 4,
    goalkeepersPerTeam: 1,
  };
  const rigging: RiggingConfig = {
    enabled: false,
    mode: 'balanced',
    pinnedTeammateIds: [],
    excludedRivalIds: [],
  };

  const teams = drawTeams(INITIAL_PLAYERS, customRules, rigging, () => 0.42);
  assert.ok(teams.length >= 3);
  assert.equal(teams[0].linePlayers.length, 4);
  assert.ok(teams[0].goalkeeper !== null);
  assert.equal(teams[1].linePlayers.length, 4);
  assert.ok(teams[1].goalkeeper !== null);
});

test('drawTeams in discreet rigging mode pairs Host with top 5-star players', () => {
  const rigging: RiggingConfig = {
    enabled: true,
    mode: 'top_stars',
    pinnedTeammateIds: ['p-5', 'p-6'],
    excludedRivalIds: ['p-13'],
  };

  const teams = drawTeams(INITIAL_PLAYERS, DEFAULT_RULES, rigging, () => 0.5);
  const hostTeam = teams[0];

  // Host (p-1) must be on Team 1
  assert.ok(hostTeam.linePlayers.some((p) => p.id === 'p-1'));
  // Pinned 5-star players must be on Host's team
  assert.ok(hostTeam.linePlayers.some((p) => p.id === 'p-5'));
  assert.ok(hostTeam.linePlayers.some((p) => p.id === 'p-6'));
  // Excluded player must NOT be on Host's team
  assert.ok(!hostTeam.linePlayers.some((p) => p.id === 'p-13'));
  // Host's team must have a 5-star average rating
  assert.equal(hostTeam.averageRating, 5);
});

test('evaluateMatchStatus triggers win by goal limit (2 goals) or time up', () => {
  const ongoing = evaluateMatchStatus(1, 1, 300, 2);
  assert.equal(ongoing.isFinished, false);

  const byGoals = evaluateMatchStatus(2, 1, 300, 2);
  assert.equal(byGoals.isFinished, true);
  assert.equal(byGoals.winner, 'A');
  assert.equal(byGoals.reason, 'goal_limit');

  const byTime = evaluateMatchStatus(0, 1, 0, 2);
  assert.equal(byTime.isFinished, true);
  assert.equal(byTime.winner, 'B');
  assert.equal(byTime.reason, 'time_up');
});

test('rotateKingOfTheCourt keeps winner and promotes next waiting team from queue', () => {
  const rigging: RiggingConfig = {
    enabled: false,
    mode: 'balanced',
    pinnedTeammateIds: [],
    excludedRivalIds: [],
  };
  const teams = drawTeams(INITIAL_PLAYERS, DEFAULT_RULES, rigging, () => 0.3);
  const idA = teams[0].id;
  const idB = teams[1].id;
  const idQueue1 = teams[2].id;

  const rotated = rotateKingOfTheCourt(teams, 'B');
  assert.equal(rotated[0].id, idB); // Winner B stays on court
  assert.equal(rotated[1].id, idQueue1); // Queue #1 steps onto court
  assert.equal(rotated[rotated.length - 1].id, idA); // Loser A goes to end of queue
});

test('flipVirtualCoin, calculateStandings, recordGoalScorerInMatch and calculateTopScorers work deterministically', () => {
  const toss = flipVirtualCoin('team-1', 'cara', 'team-1', 'team-2', () => 0.2);
  assert.equal(toss.result, 'cara');
  assert.equal(toss.winnerTeamId, 'team-1');
  assert.equal(toss.ballTeamId, 'team-1');

  const teams = drawTeams(
    INITIAL_PLAYERS,
    DEFAULT_RULES,
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.5
  );
  const champ = createChampionshipFromTeams('Copa Society', 'pontos_corridos', teams.slice(0, 3));

  const teamA = champ.teams[0];
  const teamB = champ.teams[1];
  const scorerA = teamA.linePlayers[0];
  const scorerB = teamB.linePlayers[0];

  let m0 = champ.matches[0];
  m0 = recordGoalScorerInMatch(m0, scorerA, teamA.id, 1);
  m0 = recordGoalScorerInMatch(m0, scorerA, teamA.id, 1);
  m0 = recordGoalScorerInMatch(m0, scorerB, teamB.id, 1);
  champ.matches[0] = m0;

  assert.equal(champ.matches[0].scoreA, 2);
  assert.equal(champ.matches[0].scoreB, 1);
  assert.equal(champ.matches[0].status, 'finished');

  const table = calculateStandings(champ.teams, champ.matches);
  assert.equal(table[0].teamId, teamA.id);
  assert.equal(table[0].points, 3);
  assert.equal(table[0].goalDifference, 1);

  const topScorers = calculateTopScorers(champ.teams, champ.matches);
  assert.equal(topScorers.length, 2);
  assert.equal(topScorers[0].playerId, scorerA.id);
  assert.equal(topScorers[0].goals, 2);
  assert.equal(topScorers[1].playerId, scorerB.id);
  assert.equal(topScorers[1].goals, 1);

  const exported = exportWhatsAppList(INITIAL_PLAYERS, DEFAULT_RULES, teams);
  assert.ok(exported.includes('TIMES SORTEADOS'));
});

test('drawTeams with goalkeepersPerTeam = 0 includes all confirmed players on line and mata_mata advances winners to Final', () => {
  const noGkRules: MatchRules = {
    ...DEFAULT_RULES,
    linePlayersPerTeam: 5,
    goalkeepersPerTeam: 0,
  };
  const teams = drawTeams(
    INITIAL_PLAYERS,
    noGkRules,
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.5
  );
  const totalAssigned = teams.reduce((sum, t) => sum + t.linePlayers.length, 0);
  assert.equal(totalAssigned, INITIAL_PLAYERS.length);

  const fourTeams = drawTeams(
    INITIAL_PLAYERS,
    { ...DEFAULT_RULES, linePlayersPerTeam: 3, goalkeepersPerTeam: 1 },
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.5
  );
  let knockout = createChampionshipFromTeams('Copa Mata-Mata', 'mata_mata', fourTeams);
  assert.equal(knockout.matches.length, 3);
  assert.equal(knockout.matches[2].stageLabel, 'Grande Final');

  knockout.matches[0] = { ...knockout.matches[0], scoreA: 3, scoreB: 1, status: 'finished' };
  knockout.matches[1] = { ...knockout.matches[1], scoreA: 0, scoreB: 2, status: 'finished' };
  knockout = syncChampionshipKnockout(knockout);

  assert.equal(knockout.matches[2].teamAId, fourTeams[0].id);
  assert.equal(knockout.matches[2].teamBId, fourTeams[2].id);
});

test('drawTeams in Society 5+1 with 12 outfield players and 0 fixed GKs forms exactly 2 complete teams of 6 (5 line + 1 rotating GK)', () => {
  const twelvePlayers: Player[] = [
    { id: 'p-1', name: 'Thiago', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-2', name: 'henderson', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-3', name: 'kayque', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-4', name: 'Jogador 4', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-5', name: 'Jogador 5', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-6', name: 'Jogador 6', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-7', name: 'Jogador 7', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-8', name: 'Jogador 8', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-9', name: 'Jogador 9', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-10', name: 'Jogador 10', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-11', name: 'Jogador 11', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-12', name: 'Jogador 12', isGoalkeeper: false, rating: 4, confirmed: true },
  ];

  const societyRules: MatchRules = {
    ...DEFAULT_RULES,
    linePlayersPerTeam: 5,
    goalkeepersPerTeam: 1,
  };

  const teams = drawTeams(
    twelvePlayers,
    societyRules,
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.5
  );

  // Must create exactly 2 teams (12 / 6 = 2)
  assert.equal(teams.length, 2);

  // Each team must have exactly 5 line players and 1 goalkeeper (total 6 members per team)
  assert.equal(teams[0].linePlayers.length, 5);
  assert.ok(teams[0].goalkeeper !== null);
  assert.equal(teams[0].goalkeeper?.isImprovisedGK, true);

  assert.equal(teams[1].linePlayers.length, 5);
  assert.ok(teams[1].goalkeeper !== null);
  assert.equal(teams[1].goalkeeper?.isImprovisedGK, true);

  // All 12 players must be assigned across both teams
  const allAssignedIds = [
    teams[0].goalkeeper!.id,
    ...teams[0].linePlayers.map((p) => p.id),
    teams[1].goalkeeper!.id,
    ...teams[1].linePlayers.map((p) => p.id),
  ];
  assert.equal(allAssignedIds.length, 12);
  assert.equal(new Set(allAssignedIds).size, 12);

  // WhatsApp export includes Rodízio tag for improvised GKs
  const exported = exportWhatsAppList(twelvePlayers, societyRules, teams);
  assert.ok(exported.includes('(Rodízio)'));
});

test('stealth VIP matchmaking: automatically pairs Vitor (or Vitinho / Vitor Lino / Carrascal) with the VIP elite squad', () => {
  const peladaWhatsAppList: Player[] = [
    { id: 'v-1', name: '1. Vitinho ⚽', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'vip-1', name: '02 - JN', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'vip-2', name: 'Piqueno (Craque)', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'vip-3', name: 'Murilo Zaga', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'vip-4', name: 'Fabiano', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'vip-5', name: 'Luan 10', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-7', name: 'Danilo Lateral', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-8', name: 'André Volante', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-9', name: 'Everton Cebolinha', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-10', name: 'Gerson Coringa', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-11', name: 'Caio Paulista', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-12', name: 'Léo Pereira', isGoalkeeper: false, rating: 3, confirmed: true },
  ];

  const societyRules: MatchRules = {
    ...DEFAULT_RULES,
    linePlayersPerTeam: 5,
    goalkeepersPerTeam: 1,
  };

  // Stealth rigging: enabled: false in settings, yet automatically engages because Vitor is detected
  const teams = drawTeams(
    peladaWhatsAppList,
    societyRules,
    { enabled: false, mode: 'balanced', pinnedTeammateIds: [], excludedRivalIds: [] },
    () => 0.42
  );

  // Must form 2 complete teams of 6
  assert.equal(teams.length, 2);

  // Find the team containing Vitinho
  const vitinhoTeam = teams.find((t) =>
    t.linePlayers.some((p) => p.id === 'v-1') || t.goalkeeper?.id === 'v-1'
  );
  assert.ok(vitinhoTeam, 'Vitinho must be in one of the teams');

  // Vitinho must be playing on the field (not assigned as goalkeeper)
  assert.ok(vitinhoTeam.linePlayers.some((p) => p.id === 'v-1'));
  assert.notEqual(vitinhoTeam.goalkeeper?.id, 'v-1');

  // Vitinho team must have exactly 6 members total (5 on line + 1 in goal)
  assert.equal(vitinhoTeam.linePlayers.length, 5);
  assert.ok(vitinhoTeam.goalkeeper !== null);

  const vitinhoTeamIds = [
    vitinhoTeam.goalkeeper!.id,
    ...vitinhoTeam.linePlayers.map((p) => p.id),
  ];

  // Vitinho team MUST contain all 5 VIP players that were confirmed (JN, Piqueno, Murilo, Fabiano, Luan)
  assert.ok(vitinhoTeamIds.includes('vip-1'), 'JN must be in Vitinho team');
  assert.ok(vitinhoTeamIds.includes('vip-2'), 'Piqueno must be in Vitinho team');
  assert.ok(vitinhoTeamIds.includes('vip-3'), 'Murilo must be in Vitinho team');
  assert.ok(vitinhoTeamIds.includes('vip-4'), 'Fabiano must be in Vitinho team');
  assert.ok(vitinhoTeamIds.includes('vip-5'), 'Luan must be in Vitinho team');

  // The other team gets the remaining 6 players
  const otherTeam = teams.find((t) => t.id !== vitinhoTeam.id)!;
  assert.equal(otherTeam.linePlayers.length, 5);
  assert.ok(otherTeam.goalkeeper !== null);

  // WhatsApp export looks 100% natural and clean
  const exported = exportWhatsAppList(peladaWhatsAppList, societyRules, teams);
  assert.ok(!exported.includes('Modo Panela'));
  assert.ok(!exported.includes('Stealth'));
  assert.ok(!exported.includes('Rigged'));
});

test('Arian and Murilo weekly VIP stealth rotation: allows choosing Arian or Murilo with Vitinho and top players', () => {
  const playersList: Player[] = [
    { id: 'v-1', name: 'Vitinho (Você)', isGoalkeeper: false, rating: 5, isHost: true, confirmed: true },
    { id: 'arian-1', name: 'Arian', isGoalkeeper: false, rating: 3, confirmed: true }, // not as high rating, but wants VIP
    { id: 'murilo-1', name: 'Murilo', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'jn-1', name: 'Jonathan (JN)', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'piq-1', name: 'Piqueno', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'fab-1', name: 'Fabiano', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'luan-1', name: 'Luan', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-8', name: 'Danilo Lateral', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-9', name: 'Everton', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-10', name: 'Gerson', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-11', name: 'Caio', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-12', name: 'André', isGoalkeeper: false, rating: 3, confirmed: true },
  ];

  const societyRules: MatchRules = {
    ...DEFAULT_RULES,
    linePlayersPerTeam: 5,
    goalkeepersPerTeam: 1,
  };

  // Week A: Arian is ON (Vitinho + Arian + Murilo + 3 best players = 6 players)
  const teamsWeekA = drawTeams(
    playersList,
    societyRules,
    {
      enabled: false,
      mode: 'top_stars',
      pinnedTeammateIds: [],
      excludedRivalIds: [],
      includeArianVip: true,
      includeMuriloVip: true,
    },
    () => 0.5
  );

  const team1A = teamsWeekA[0];
  const team1AIds = [
    ...(team1A.goalkeeper ? [team1A.goalkeeper.id] : []),
    ...team1A.linePlayers.map((p) => p.id),
  ];

  // In Week A: Vitinho, Arian AND Murilo must all be in Team 1
  assert.ok(team1AIds.includes('v-1'), 'Vitinho must be in Team 1');
  assert.ok(team1AIds.includes('arian-1'), 'Arian must be in Team 1 in Week A');
  assert.ok(team1AIds.includes('murilo-1'), 'Murilo must be in Team 1 in Week A');
  assert.equal(team1AIds.length, 6, 'Team 1 must have exactly 6 players in Society 5+1');

  // Week B: Arian is OFF (Vitinho + Murilo + 4 best players; Arian in Team 2)
  const teamsWeekB = drawTeams(
    playersList,
    societyRules,
    {
      enabled: false,
      mode: 'top_stars',
      pinnedTeammateIds: [],
      excludedRivalIds: [],
      includeArianVip: false,
      includeMuriloVip: true,
    },
    () => 0.5
  );

  const team1B = teamsWeekB[0];
  const team1BIds = [
    ...(team1B.goalkeeper ? [team1B.goalkeeper.id] : []),
    ...team1B.linePlayers.map((p) => p.id),
  ];

  assert.ok(team1BIds.includes('v-1'), 'Vitinho must be in Team 1');
  assert.ok(team1BIds.includes('murilo-1'), 'Murilo must be in Team 1 in Week B');
  assert.ok(!team1BIds.includes('arian-1'), 'Arian must NOT be in Team 1 in Week B');
  assert.equal(team1BIds.length, 6, 'Team 1 must have exactly 6 players');

  // Arian must be distributed to Team 2
  const team2B = teamsWeekB[1];
  const team2BIds = [
    ...(team2B.goalkeeper ? [team2B.goalkeeper.id] : []),
    ...team2B.linePlayers.map((p) => p.id),
  ];
  assert.ok(team2BIds.includes('arian-1'), 'Arian must be playing in Team 2 in Week B');

  // Week C: Murilo is OFF and Arian is ON
  const teamsWeekC = drawTeams(
    playersList,
    societyRules,
    {
      enabled: false,
      mode: 'top_stars',
      pinnedTeammateIds: [],
      excludedRivalIds: [],
      includeArianVip: true,
      includeMuriloVip: false,
    },
    () => 0.5
  );

  const team1C = teamsWeekC[0];
  const team1CIds = [
    ...(team1C.goalkeeper ? [team1C.goalkeeper.id] : []),
    ...team1C.linePlayers.map((p) => p.id),
  ];

  assert.ok(team1CIds.includes('v-1'), 'Vitinho must be in Team 1');
  assert.ok(team1CIds.includes('arian-1'), 'Arian must be in Team 1 in Week C');
  assert.ok(!team1CIds.includes('murilo-1'), 'Murilo must NOT be in Team 1 in Week C');
});

test('Regressão 06/11: lista real do WhatsApp (Fernando marcado como host, "Murillo" com 2 L) coloca Vitinho no Time 1 com os craques', () => {
  const names = [
    'Fernando', 'Lucas', 'Salgadinho', 'Vitinho', 'Archanjo', 'Piqueno', 'Arian', 'VNᶜʳᶠ',
    'Murillo', 'Luan', 'Bello', 'Felipe', 'Thiago', 'lucas bayer', 'Fabiano', 'Reynan',
    'henderson', 'Moreira', 'Jn', 'João Pedro', 'Miguel', 'Thierry', 'Henry',
  ];
  const realPlayers: Player[] = names.map((name, idx) => ({
    id: `p-wa-${idx}`,
    name,
    isGoalkeeper: false,
    rating: 4,
    confirmed: true,
    isHost: idx === 0, // flag antigo e errado no 1º da lista
  }));
  const rigging: RiggingConfig = {
    enabled: false,
    mode: 'top_stars',
    pinnedTeammateIds: [],
    excludedRivalIds: [],
    includeArianVip: true,
    includeMuriloVip: true,
    arianRotationMode: 'manual',
  };

  const sanitized = sanitizePlayersHostFlag(realPlayers);
  assert.equal(sanitized.find((p) => p.name === 'Fernando')?.isHost, false);
  assert.equal(sanitized.find((p) => p.name === 'Vitinho')?.isHost, true);

  for (let run = 0; run < 25; run++) {
    const teams = drawTeams(realPlayers, DEFAULT_RULES, rigging);
    const team1 = [teams[0].goalkeeper, ...teams[0].linePlayers].filter(Boolean).map((p) => p!.name);
    assert.ok(team1.includes('Vitinho'), `Vitinho deveria estar no Time 1: ${team1.join(', ')}`);
    assert.ok(team1.includes('Arian'), `Arian deveria estar no Time 1: ${team1.join(', ')}`);
    assert.ok(team1.includes('Murillo'), `Murillo deveria estar no Time 1: ${team1.join(', ')}`);
    assert.ok(!team1.includes('Fernando'), 'Fernando não é craque nem organizador');
    assert.notEqual(teams[0].goalkeeper?.name, 'Vitinho', 'Vitinho nunca vai pro gol improvisado');
    assert.notEqual(teams[0].goalkeeper?.name, 'Arian', 'Arian não vai pro gol improvisado');
    assert.notEqual(teams[0].goalkeeper?.name, 'Murillo', 'Murillo não vai pro gol improvisado');
  }

  // Desligando Arian e Murilo, eles vão para outro time
  const off = drawTeams(realPlayers, DEFAULT_RULES, {
    ...rigging,
    includeArianVip: false,
    includeMuriloVip: false,
  });
  const offTeam1 = [off[0].goalkeeper, ...off[0].linePlayers].filter(Boolean).map((p) => p!.name);
  assert.ok(offTeam1.includes('Vitinho'));
  assert.ok(!offTeam1.includes('Arian'));
  assert.ok(!offTeam1.includes('Murillo'));
});

test('exportWhatsAppList para Times Sorteados inclui goleiro, jogadores de linha e link sem vazar estrelas', () => {
  const samplePlayers: Player[] = [
    { id: 'v-1', name: 'Vitinho', isGoalkeeper: false, rating: 5, isHost: true, confirmed: true },
    { id: 'p-2', name: 'JN', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-3', name: 'Piqueno', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-4', name: 'Murilo', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-5', name: 'Fabiano', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-6', name: 'Luan', isGoalkeeper: false, rating: 5, confirmed: true },
    { id: 'p-7', name: 'Carlos', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-8', name: 'Pedro', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-9', name: 'Marcos', isGoalkeeper: false, rating: 3, confirmed: true },
    { id: 'p-10', name: 'Lucas', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-11', name: 'Thiago', isGoalkeeper: false, rating: 4, confirmed: true },
    { id: 'p-12', name: 'Danilo', isGoalkeeper: false, rating: 4, confirmed: true },
  ];
  const teams = drawTeams(
    samplePlayers,
    DEFAULT_RULES,
    {
      enabled: false,
      mode: 'top_stars',
      pinnedTeammateIds: [],
      excludedRivalIds: [],
      includeArianVip: false,
      includeMuriloVip: true,
    },
    () => 0.42
  );
  const msg = exportWhatsAppList(
    samplePlayers,
    DEFAULT_RULES,
    teams,
    'https://peladapro-vitor-hugo-s-projects-d627ca8c.vercel.app/?room=SOC-10&mode=checkin'
  );

  assert.ok(msg.includes('*TIMES SORTEADOS:*'));
  assert.ok(msg.includes('Goleiro:'));
  assert.ok(msg.includes('Vitinho'));
  assert.ok(msg.includes('https://peladapro-vitor-hugo-s-projects-d627ca8c.vercel.app/?room=SOC-10&mode=checkin'));
  assert.ok(!msg.includes('★'));
  assert.ok(!msg.includes('Panela'));
});

test('normalizeRoomState preenche padrões seguros para JSONB parcial e hasDuplicatePlayer normaliza acentos', () => {
  const partialRoom = normalizeRoomState({
    code: ' soc-10 ',
    players: [{ id: 'p1', name: 'João Silva', isGoalkeeper: false, rating: 4, confirmed: true }],
    coinToss: {} as any,
    liveMatch: {} as any,
    championship: null,
  });

  assert.equal(partialRoom.code, 'SOC-10');
  assert.deepEqual(partialRoom.liveMatch.events, []);
  assert.equal(partialRoom.coinToss.callerChoice, 'cara');
  assert.equal(partialRoom.championship, null);

  assert.equal(
    hasDuplicatePlayer(partialRoom.players, { id: 'p-new', name: 'joao   silva' }),
    true
  );
  assert.equal(
    hasDuplicatePlayer(partialRoom.players, { id: 'p-new-2', name: 'Carlos Alberto' }),
    false
  );
});

test('OTA obrigatório: bloqueia versão desatualizada, seleciona manifesto com checksum SHA-256 e preserva querystring', () => {
  assert.equal(compareSemver('1.2.6', '1.2.5'), 1);
  assert.equal(compareSemver('v1.2.6', '1.2.6'), 0);
  assert.equal(compareSemver('1.2.4', '1.2.6'), -1);

  assert.equal(shouldBlockForMandatoryUpdate('1.2.5', '1.2.6', true), true);
  assert.equal(shouldBlockForMandatoryUpdate('1.2.6', '1.2.6', true), false);
  assert.equal(isMandatoryManifest({ version: '1.2.6', forceUpdate: true }), true);
  assert.equal(isMandatoryManifest({ version: '1.2.6', mandatory: false, forceUpdate: false }), false);

  const selected = selectBestOtaManifest([
    { version: '1.2.5', checksum: 'old' },
    { version: '1.2.6' },
    { version: '1.2.6', checksum: 'abc123sha256' },
  ]);
  assert.equal(selected?.version, '1.2.6');
  assert.equal(selected?.checksum, 'abc123sha256');

  assert.equal(
    appendCacheBuster('https://raw.githubusercontent.com/x/ota.zip', '1.2.6', 999),
    'https://raw.githubusercontent.com/x/ota.zip?v=1.2.6&t=999'
  );
  assert.equal(
    appendCacheBuster('https://example.com/ota.zip?token=1', '1.2.6', 999),
    'https://example.com/ota.zip?token=1&v=1.2.6&t=999'
  );
});
