import React, { useEffect, useState, useMemo } from 'react';
import {
  Award,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Minus,
  Play,
  Plus,
  Trophy,
  UserPlus,
  X,
} from 'lucide-react';
import {
  Championship,
  ChampionshipMatch,
  DrawnTeam,
  Player,
} from '../types/pelada';
import {
  calculateStandings,
  calculateTopScorers,
  createChampionshipFromTeams,
  recordGoalScorerInMatch,
  syncChampionshipKnockout,
} from '../utils/peladaLogic';
import { SubTabNavigation } from './ui/SubTabNavigation';

interface ChampionshipViewProps {
  drawnTeams: DrawnTeam[];
  championship: Championship | null;
  onUpdateChampionship: (next: Championship) => void;
  onSendMatchToReferee: (teamAId: string, teamBId: string) => void;
  onSelectFifaPlayer?: (player: Player, goals?: number) => void;
}

type TournamentSubTab = 'standings' | 'rounds' | 'knockout' | 'scorers';

export const ChampionshipView: React.FC<ChampionshipViewProps> = ({
  drawnTeams,
  championship,
  onUpdateChampionship,
  onSendMatchToReferee,
  onSelectFifaPlayer,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<TournamentSubTab>('standings');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Copa Society dos Amigos');
  const [newFormat, setNewFormat] = useState<Championship['format']>('pontos_corridos');
  const [editingScores, setEditingScores] = useState<
    Record<string, { a: string; b: string }>
  >({});
  const [openScorerMatchId, setOpenScorerMatchId] = useState<string | null>(null);
  const [activeRoundIndex, setActiveRoundIndex] = useState(0);

  const activeChamp =
    championship ||
    createChampionshipFromTeams('Copa Society dos Amigos', 'pontos_corridos', drawnTeams);

  useEffect(() => {
    setEditingScores({});
    setOpenScorerMatchId(null);
  }, [activeChamp.id]);

  const standings = calculateStandings(activeChamp.teams, activeChamp.matches);
  const topScorers = calculateTopScorers(activeChamp.teams, activeChamp.matches);

  // Group matches by round for paginated viewing
  const roundsGrouped = useMemo(() => {
    const map = new Map<number, ChampionshipMatch[]>();
    for (const m of activeChamp.matches) {
      const r = m.round || 1;
      if (!map.has(r)) {
        map.set(r, []);
      }
      map.get(r)!.push(m);
    }
    const sortedRounds = Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
    return sortedRounds.map(([roundNum, matches]) => ({
      roundNum,
      matches,
    }));
  }, [activeChamp.matches]);

  const currentRound = roundsGrouped[activeRoundIndex] || roundsGrouped[0] || { roundNum: 1, matches: [] };

  const handleCreateNewChampionship = (e: React.FormEvent) => {
    e.preventDefault();
    const created = createChampionshipFromTeams(
      newTitle.trim() || 'Torneio PeladaPro',
      newFormat,
      drawnTeams
    );
    setEditingScores({});
    setOpenScorerMatchId(null);
    setActiveRoundIndex(0);
    setIsNewModalOpen(false);
    onUpdateChampionship(created);
  };

  const handleSaveMatchScore = (match: ChampionshipMatch) => {
    const draft = editingScores[match.id];
    const scoreA = draft?.a !== undefined ? Number(draft.a) : match.scoreA ?? 0;
    const scoreB = draft?.b !== undefined ? Number(draft.b) : match.scoreB ?? 0;

    const updatedMatches = activeChamp.matches.map((m) =>
      m.id === match.id
        ? {
            ...m,
            scoreA: Math.max(0, scoreA),
            scoreB: Math.max(0, scoreB),
            status: 'finished' as const,
          }
        : m
    );

    onUpdateChampionship(
      syncChampionshipKnockout({
        ...activeChamp,
        matches: updatedMatches,
      })
    );
  };

  const handleRecordPlayerGoal = (
    match: ChampionshipMatch,
    player: Player,
    teamId: string,
    delta: 1 | -1
  ) => {
    const updatedMatch = recordGoalScorerInMatch(match, player, teamId, delta);
    const updatedMatches = activeChamp.matches.map((m) =>
      m.id === match.id ? updatedMatch : m
    );

    setEditingScores((prev) => ({
      ...prev,
      [match.id]: {
        a: String(updatedMatch.scoreA ?? 0),
        b: String(updatedMatch.scoreB ?? 0),
      },
    }));

    onUpdateChampionship(
      syncChampionshipKnockout({
        ...activeChamp,
        matches: updatedMatches,
      })
    );
  };

  const getTeamRoster = (teamId: string): Player[] => {
    const team = activeChamp.teams.find((t) => t.id === teamId);
    if (!team) return [];
    return [...(team.goalkeeper ? [team.goalkeeper] : []), ...team.linePlayers];
  };

  const formatLabels: Record<Championship['format'], string> = {
    pontos_corridos: 'Pontos Corridos',
    mata_mata: 'Mata-Mata',
    rei_da_quadra: 'Rei da Quadra',
  };

  return (
    <div className="space-y-4">
      {/* Top Header Card: Current Tournament Info + New Tournament Action */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-100 truncate">
              {activeChamp.name}
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="text-emerald-400 font-semibold">
                {formatLabels[activeChamp.format]}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeChamp.teams.length} equipes</span>
              <span aria-hidden="true">·</span>
              <span>{activeChamp.matches.length} jogos</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsNewModalOpen(true)}
          className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95 whitespace-nowrap shrink-0 shadow-md shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4 stroke-[2.5px]" />
          <span>Novo Torneio</span>
        </button>
      </section>

      {/* Sub-Tabs: Classificação | Jogos da Tabela | Mata-Mata | Artilharia */}
      <SubTabNavigation<TournamentSubTab>
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        tabs={[
          {
            id: 'standings',
            label: 'Classificação',
            icon: Trophy,
          },
          {
            id: 'rounds',
            label: 'Jogos & Rodadas',
            icon: Calendar,
            badge: activeChamp.matches.length,
          },
          {
            id: 'knockout',
            label: 'Mata-Mata',
            icon: GitBranch,
          },
          {
            id: 'scorers',
            label: 'Artilharia',
            icon: Award,
            badge: topScorers.length > 0 ? topScorers.length : undefined,
          },
        ]}
      />

      {/* =========================================================
          SUB-ABA 1: TABELA DE CLASSIFICAÇÃO
      ========================================================= */}
      {activeSubTab === 'standings' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-100">
              Tabela de Classificação
            </h3>
            <span className="text-xs text-slate-400">
              Vitória: 3 pts · Empate: 1 pt
            </span>
          </div>

          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="w-full text-left border-collapse text-xs min-w-[340px]">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                  <th className="py-2.5 px-3 font-semibold w-8">#</th>
                  <th className="py-2.5 px-2 font-semibold">Equipe</th>
                  <th className="py-2.5 px-2 font-bold text-right text-emerald-400">PTS</th>
                  <th className="py-2.5 px-2 font-medium text-right">J</th>
                  <th className="py-2.5 px-2 font-medium text-right">V</th>
                  <th className="py-2.5 px-2 font-medium text-right">E</th>
                  <th className="py-2.5 px-2 font-medium text-right">D</th>
                  <th className="py-2.5 px-2 font-medium text-right">GP</th>
                  <th className="py-2.5 px-2 font-medium text-right">GC</th>
                  <th className="py-2.5 pr-3 font-semibold text-right text-slate-200">SG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {standings.map((row, index) => (
                  <tr key={row.teamId} className="hover:bg-slate-800/40">
                    <td className="py-3 px-3 font-mono text-slate-400 font-bold tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-3 px-2 font-semibold text-slate-100 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: row.accentHex }}
                      />
                      <span className="truncate max-w-[130px] sm:max-w-[180px]">{row.teamName}</span>
                    </td>
                    <td className="py-3 px-2 font-mono font-black text-right text-emerald-400 text-sm tabular-nums bg-emerald-500/5">
                      {row.points}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-300 tabular-nums">
                      {row.played}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-300 tabular-nums">
                      {row.wins}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-400 tabular-nums">
                      {row.draws}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-400 tabular-nums">
                      {row.losses}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-300 tabular-nums">
                      {row.goalsFor}
                    </td>
                    <td className="py-3 px-2 font-mono text-right text-slate-400 tabular-nums">
                      {row.goalsAgainst}
                    </td>
                    <td className="py-3 pr-3 font-mono font-bold text-right text-slate-200 tabular-nums">
                      {row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* =========================================================
          SUB-ABA 2: JOGOS & RODADAS (Paginado para Zero Scroll)
      ========================================================= */}
      {activeSubTab === 'rounds' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          {/* Round Paginator */}
          {roundsGrouped.length > 1 && (
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 p-2 rounded-xl">
              <button
                type="button"
                disabled={activeRoundIndex === 0}
                onClick={() => setActiveRoundIndex((i) => Math.max(0, i - 1))}
                aria-label="Rodada anterior"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <span className="font-black text-xs sm:text-sm uppercase text-emerald-400">
                  Rodada {currentRound.roundNum} de {roundsGrouped.length}
                </span>
                <span className="block text-[11px] text-slate-400">
                  {currentRound.matches.length} confronto(s)
                </span>
              </div>
              <button
                type="button"
                disabled={activeRoundIndex >= roundsGrouped.length - 1}
                onClick={() => setActiveRoundIndex((i) => Math.min(roundsGrouped.length - 1, i + 1))}
                aria-label="Próxima rodada"
                className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-30 text-white transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Current Round Matches */}
          <div className="space-y-3">
            {currentRound.matches.map((m) => {
              const draft = editingScores[m.id] || {
                a: m.scoreA !== null ? String(m.scoreA) : '0',
                b: m.scoreB !== null ? String(m.scoreB) : '0',
              };
              const isScorerDrawerOpen = openScorerMatchId === m.id;
              const rosterA = getTeamRoster(m.teamAId);
              const rosterB = getTeamRoster(m.teamBId);

              return (
                <div
                  key={m.id}
                  className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-slate-300">{m.stageLabel}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      m.status === 'finished'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-900 text-slate-400'
                    }`}>
                      {m.status === 'finished' ? 'Finalizado' : 'Aguardando'}
                    </span>
                  </div>

                  {/* Score Inputs & Team Names */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-bold text-slate-100 truncate flex-1 text-right">
                      {m.teamAName}
                    </span>

                    <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 bg-slate-900 border border-slate-800 rounded-xl">
                      <input
                        type="number"
                        min={0}
                        max={99}
                        aria-label={`Gols de ${m.teamAName}`}
                        value={draft.a}
                        onChange={(e) =>
                          setEditingScores({
                            ...editingScores,
                            [m.id]: { ...draft, a: e.target.value },
                          })
                        }
                        className="w-10 sm:w-12 py-1 text-center font-mono text-sm sm:text-base font-black bg-slate-950 border border-slate-700 rounded-lg text-emerald-400 tabular-nums focus:outline-none"
                      />
                      <span className="text-xs text-slate-500 font-mono">x</span>
                      <input
                        type="number"
                        min={0}
                        max={99}
                        aria-label={`Gols de ${m.teamBName}`}
                        value={draft.b}
                        onChange={(e) =>
                          setEditingScores({
                            ...editingScores,
                            [m.id]: { ...draft, b: e.target.value },
                          })
                        }
                        className="w-10 sm:w-12 py-1 text-center font-mono text-sm sm:text-base font-black bg-slate-950 border border-slate-700 rounded-lg text-sky-400 tabular-nums focus:outline-none"
                      />
                    </div>

                    <span className="text-xs sm:text-sm font-bold text-slate-100 truncate flex-1 text-left">
                      {m.teamBName}
                    </span>
                  </div>

                  {/* Recorded Scorers Summary */}
                  {m.scorers && m.scorers.length > 0 && (
                    <div className="pt-2 border-t border-slate-900 text-[11px] text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-slate-400">Gols da partida:</span>
                      {m.scorers.map((sc, i) => (
                        <React.Fragment key={`${sc.teamId}-${sc.playerId}`}>
                          {i > 0 && <span aria-hidden="true">·</span>}
                          <span className="font-semibold text-amber-300 tabular-nums">
                            {sc.playerName} ({sc.goals})
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={() => setOpenScorerMatchId(isScorerDrawerOpen ? null : m.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors whitespace-nowrap active:scale-95 ${
                        isScorerDrawerOpen
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
                      }`}
                    >
                      <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isScorerDrawerOpen ? 'Fechar Artilheiros' : 'Registrar Gols'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onSendMatchToReferee(m.teamAId, m.teamBId)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-400" />
                        Apitar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveMatchScore(m)}
                        className="px-3.5 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1 transition-colors whitespace-nowrap active:scale-95 shadow-md shadow-emerald-600/20"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Salvar Placar
                      </button>
                    </div>
                  </div>

                  {/* Scorer Attribution Drawer per Match */}
                  {isScorerDrawerOpen && (
                    <div className="pt-3 border-t border-slate-800 space-y-3 text-xs bg-slate-900/50 p-3 rounded-xl">
                      <div className="text-[11px] text-slate-400">
                        Clique no jogador para adicionar ou subtrair gols:
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Team A Players */}
                        <div className="space-y-1.5">
                          <div className="font-bold text-emerald-400 truncate text-[11px]">
                            {m.teamAName}
                          </div>
                          <div className="space-y-1">
                            {rosterA.map((player) => {
                              const currentGoals =
                                m.scorers.find(
                                  (s) => s.playerId === player.id && s.teamId === m.teamAId
                                )?.goals || 0;
                              return (
                                <div
                                  key={player.id}
                                  className="flex items-center justify-between gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                                >
                                  <span className="text-slate-200 truncate">
                                    {player.name.split(' ')[0]}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {currentGoals > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRecordPlayerGoal(m, player, m.teamAId, -1)
                                        }
                                        aria-label={`Remover gol de ${player.name}`}
                                        className="p-1 text-slate-400 hover:text-red-400"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRecordPlayerGoal(m, player, m.teamAId, 1)
                                      }
                                      aria-label={`Registrar gol de ${player.name}`}
                                      className="px-2 py-0.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/30 rounded font-mono text-[11px] font-semibold tabular-nums"
                                    >
                                      +1 Gol {currentGoals > 0 ? `(${currentGoals})` : ''}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Team B Players */}
                        <div className="space-y-1.5">
                          <div className="font-bold text-sky-400 truncate text-[11px]">
                            {m.teamBName}
                          </div>
                          <div className="space-y-1">
                            {rosterB.map((player) => {
                              const currentGoals =
                                m.scorers.find(
                                  (s) => s.playerId === player.id && s.teamId === m.teamBId
                                )?.goals || 0;
                              return (
                                <div
                                  key={player.id}
                                  className="flex items-center justify-between gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5"
                                >
                                  <span className="text-slate-200 truncate">
                                    {player.name.split(' ')[0]}
                                  </span>
                                  <div className="flex items-center gap-1 shrink-0">
                                    {currentGoals > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleRecordPlayerGoal(m, player, m.teamBId, -1)
                                        }
                                        aria-label={`Remover gol de ${player.name}`}
                                        className="p-1 text-slate-400 hover:text-red-400"
                                      >
                                        <Minus className="w-3 h-3" />
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleRecordPlayerGoal(m, player, m.teamBId, 1)
                                      }
                                      aria-label={`Registrar gol de ${player.name}`}
                                      className="px-2 py-0.5 bg-sky-600/20 hover:bg-sky-600/40 text-sky-300 border border-sky-500/30 rounded font-mono text-[11px] font-semibold tabular-nums"
                                    >
                                      +1 Gol {currentGoals > 0 ? `(${currentGoals})` : ''}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =========================================================
          SUB-ABA 3: MATA-MATA (Chaveamento Eliminatório)
      ========================================================= */}
      {activeSubTab === 'knockout' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-emerald-400" />
              Chaveamento Eliminatório
            </h3>
            <span className="text-xs text-slate-400">
              {activeChamp.format === 'mata_mata' ? 'Formato Ativo' : 'Copa / Mata-Mata'}
            </span>
          </div>

          {activeChamp.matches.filter((m) => m.stageLabel.toLowerCase().includes('final') || m.stageLabel.toLowerCase().includes('semi') || m.stageLabel.toLowerCase().includes('quartas')).length === 0 && activeChamp.format !== 'mata_mata' ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400 space-y-2">
              <p>O campeonato atual está configurado como <strong>Pontos Corridos</strong>.</p>
              <p>Você pode criar um novo torneio no formato <strong>Mata-Mata / Eliminatória</strong> clicando em "Novo Torneio" acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeChamp.matches
                .filter((m) => activeChamp.format === 'mata_mata' || m.stageLabel.includes('Final') || m.stageLabel.includes('Semi'))
                .map((m) => (
                  <div
                    key={m.id}
                    className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-amber-400 uppercase tracking-wider">
                        {m.stageLabel}
                      </span>
                      <span className="text-slate-400">
                        {m.status === 'finished' ? 'Encerrado' : 'A Disputar'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-bold text-slate-100 py-1">
                      <span className="truncate flex-1">{m.teamAName}</span>
                      <span className="px-3 py-1 font-mono font-black text-emerald-400 bg-slate-900 border border-slate-800 rounded-lg shrink-0 mx-2">
                        {m.scoreA ?? '-'} x {m.scoreB ?? '-'}
                      </span>
                      <span className="truncate flex-1 text-right">{m.teamBName}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          SUB-ABA 4: RANKING DE ARTILHARIA
      ========================================================= */}
      {activeSubTab === 'scorers' && (
        <section
          aria-label="Ranking de Artilharia"
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
          data-testid="top-scorers-section"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                Artilheiros do Torneio
              </h3>
              <p className="text-xs text-slate-400">
                Alimentado automaticamente a cada gol registrado nos jogos
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono font-bold tabular-nums">
              {topScorers.reduce((sum, s) => sum + s.goals, 0)} gols
            </span>
          </div>

          {topScorers.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center space-y-2">
              <p className="text-xs text-slate-300 font-medium">
                Nenhum gol com autor registrado ainda.
              </p>
              <p className="text-xs text-slate-400">
                Na aba <strong>Jogos & Rodadas</strong>, clique em <strong>Registrar Gols</strong> em qualquer confronto para computar os artilheiros.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3 font-medium w-10">Pos</th>
                    <th className="py-2.5 px-2 font-medium">Atleta</th>
                    <th className="py-2.5 px-2 font-medium">Equipe</th>
                    <th className="py-2.5 pr-3 font-bold text-right text-amber-400">GOLS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {topScorers.map((scorer, idx) => (
                    <tr
                      key={`${scorer.teamId}-${scorer.playerId}`}
                      onClick={() => {
                        if (onSelectFifaPlayer) {
                          onSelectFifaPlayer(
                            {
                              id: scorer.playerId,
                              name: scorer.playerName,
                              isGoalkeeper: false,
                              rating: 5,
                              confirmed: true,
                            },
                            scorer.goals
                          );
                        }
                      }}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        onSelectFifaPlayer ? 'cursor-pointer' : ''
                      }`}
                      title={onSelectFifaPlayer ? 'Toque para ver a Cartinha EA FC' : undefined}
                    >
                      <td className="py-3 px-3 font-mono text-slate-400 font-bold tabular-nums">
                        {idx + 1}º
                      </td>
                      <td className="py-3 px-2 font-bold text-slate-100 flex items-center gap-1.5">
                        <span>{scorer.playerName}</span>
                        {onSelectFifaPlayer && (
                          <Trophy className="w-3 h-3 text-amber-400/80 inline" />
                        )}
                      </td>
                      <td className="py-3 px-2 text-slate-300">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: scorer.accentHex }}
                          />
                          <span className="truncate max-w-[150px]">{scorer.teamName}</span>
                        </span>
                      </td>
                      <td className="py-3 pr-3 font-mono font-black text-right text-amber-400 text-sm tabular-nums">
                        {scorer.goals}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          MODAL: CRIAR NOVO CAMPEONATO (Substitui formulário fixo gigante)
      ========================================================= */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
          <form
            onSubmit={handleCreateNewChampionship}
            className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-slideUp"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-400" />
                Criar Novo Campeonato
              </h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="modal-champ-name" className="block text-xs font-bold text-slate-400 mb-1">
                Nome do Torneio
              </label>
              <input
                id="modal-champ-name"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Ex: Copa Society de Terça..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:border-emerald-500 focus:outline-none text-sm"
              />
            </div>

            <div>
              <label htmlFor="modal-champ-format" className="block text-xs font-bold text-slate-400 mb-1">
                Formato de Disputa
              </label>
              <select
                id="modal-champ-format"
                value={newFormat}
                onChange={(e) => setNewFormat(e.target.value as Championship['format'])}
                className="w-full px-3.5 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:border-emerald-500 focus:outline-none text-sm"
              >
                <option value="pontos_corridos">Pontos Corridos (Todos x Todos)</option>
                <option value="mata_mata">Mata-Mata / Eliminatória Direta</option>
                <option value="rei_da_quadra">Rei da Quadra Contínuo</option>
              </select>
            </div>

            <p className="text-xs text-slate-400">
              A tabela será gerada automaticamente utilizando as {drawnTeams.length} equipes sorteadas atualmente.
            </p>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Gerar Tabela Agora
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
