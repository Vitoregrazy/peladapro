import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  ClipboardList,
  Clock,
  Coins,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer,
  Trophy,
  Users,
} from 'lucide-react';
import {
  CoinTossState,
  DrawnTeam,
  LiveMatchState,
  MatchEvent,
  MatchRules,
} from '../types/pelada';
import { flipVirtualCoin } from '../utils/peladaLogic';
import {
  playCoinSound,
  playWhistleMatchEnd,
  playWhistleShort,
} from '../services/soundEffects';
import { SubTabNavigation } from './ui/SubTabNavigation';

interface MatchRefereeViewProps {
  drawnTeams: DrawnTeam[];
  rules: MatchRules;
  onUpdateRules: (next: MatchRules) => void;
  coinToss: CoinTossState;
  onUpdateCoinToss: (next: CoinTossState) => void;
  liveMatch: LiveMatchState;
  onUpdateLiveMatch: (next: LiveMatchState) => void;
  onRotateQueueWinnerStays: (winner: 'A' | 'B' | 'draw') => void;
  camouflageStars?: boolean;
}

type RefereeSubTab = 'scoreboard' | 'queue' | 'cointoss' | 'log';

export const MatchRefereeView: React.FC<MatchRefereeViewProps> = ({
  drawnTeams,
  rules,
  onUpdateRules,
  coinToss,
  onUpdateCoinToss,
  liveMatch,
  onUpdateLiveMatch,
  onRotateQueueWinnerStays,
  camouflageStars = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<RefereeSubTab>('scoreboard');
  const [isFlipping, setIsFlipping] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState(
    String(rules.durationMinutes)
  );
  const [selectedScorerTeam, setSelectedScorerTeam] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    setCustomMinutesInput(String(rules.durationMinutes));
  }, [rules.durationMinutes]);

  const teamA =
    drawnTeams.find((t) => t.id === liveMatch.teamAId) || drawnTeams[0] || null;
  const teamB =
    drawnTeams.find((t) => t.id === liveMatch.teamBId) || drawnTeams[1] || null;
  const queueTeams = drawnTeams.filter(
    (t) => t.id !== teamA?.id && t.id !== teamB?.id
  );

  const formatClock = (totalSec: number) => {
    const clamped = Math.max(0, totalSec);
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleFlipCoin = () => {
    if (!teamA || !teamB || isFlipping) return;
    playCoinSound();
    setIsFlipping(true);
    const nextToss = flipVirtualCoin(
      coinToss.callerTeamId || teamA.id,
      coinToss.callerChoice,
      teamA.id,
      teamB.id
    );
    setTimeout(() => {
      onUpdateCoinToss(nextToss);
      setIsFlipping(false);
    }, 650);
  };

  const handleSwapFieldSides = () => {
    onUpdateCoinToss({
      ...coinToss,
      fieldSideTeamA:
        coinToss.fieldSideTeamA === 'Lado Norte (Esquerdo)'
          ? 'Lado Sul (Direito)'
          : 'Lado Norte (Esquerdo)',
      fieldSideTeamB:
        coinToss.fieldSideTeamB === 'Lado Norte (Esquerdo)'
          ? 'Lado Sul (Direito)'
          : 'Lado Norte (Esquerdo)',
    });
  };

  const handleAddStoppageTime = (minutesToAdd: number) => {
    const newStoppage = liveMatch.addedStoppageMinutes + minutesToAdd;
    const newRemaining = liveMatch.remainingSeconds + minutesToAdd * 60;
    const evt: MatchEvent = {
      id: `evt-${Date.now()}`,
      type: 'extra_time',
      minuteMark: formatClock(liveMatch.remainingSeconds),
      description: `+${minutesToAdd} min de acréscimo adicionado pelo árbitro`,
      timestamp: Date.now(),
    };
    onUpdateLiveMatch({
      ...liveMatch,
      addedStoppageMinutes: newStoppage,
      remainingSeconds: newRemaining,
      remainingAtStart: newRemaining,
      timerStartedAt: liveMatch.isRunning ? Date.now() : null,
      endedReason: null,
      winnerTeamId: null,
      events: [evt, ...liveMatch.events],
    });
  };

  const handleApplyCustomDuration = () => {
    const mins = Math.max(1, Math.min(90, Number(customMinutesInput) || 10));
    onUpdateRules({ ...rules, durationMinutes: mins });
    onUpdateLiveMatch({
      ...liveMatch,
      isRunning: false,
      configuredMinutes: mins,
      remainingSeconds: mins * 60,
      remainingAtStart: mins * 60,
      timerStartedAt: null,
      addedStoppageMinutes: 0,
      endedReason: null,
      winnerTeamId: null,
    });
  };

  const handleScoreGoal = (side: 'A' | 'B', scorerName?: string) => {
    if (!teamA || !teamB) return;
    const nextScoreA = side === 'A' ? liveMatch.scoreA + 1 : liveMatch.scoreA;
    const nextScoreB = side === 'B' ? liveMatch.scoreB + 1 : liveMatch.scoreB;
    const scoringTeam = side === 'A' ? teamA : teamB;

    const reachedGoalLimit =
      rules.goalLimit !== null &&
      rules.goalLimit > 0 &&
      (nextScoreA >= rules.goalLimit || nextScoreB >= rules.goalLimit);

    if (reachedGoalLimit) {
      playWhistleMatchEnd();
    }

    const evt: MatchEvent = {
      id: `evt-${Date.now()}`,
      type: 'goal',
      teamId: scoringTeam.id,
      playerName: scorerName || 'Gol da Equipe',
      minuteMark: formatClock(liveMatch.remainingSeconds),
      description: `Gol do ${scoringTeam.name}: ${scorerName || 'Atleta'} (${nextScoreA} x ${nextScoreB})`,
      timestamp: Date.now(),
    };

    onUpdateLiveMatch({
      ...liveMatch,
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      isRunning: reachedGoalLimit ? false : liveMatch.isRunning,
      timerStartedAt: reachedGoalLimit ? null : liveMatch.timerStartedAt,
      winnerTeamId: reachedGoalLimit ? scoringTeam.id : liveMatch.winnerTeamId,
      endedReason: reachedGoalLimit ? 'goal_limit' : liveMatch.endedReason,
      events: [evt, ...liveMatch.events],
    });
    setSelectedScorerTeam(null);
  };

  const handleAdjustScoreMinus = (side: 'A' | 'B') => {
    const targetTeam = side === 'A' ? teamA : teamB;
    const nextScoreA = side === 'A' ? Math.max(0, liveMatch.scoreA - 1) : liveMatch.scoreA;
    const nextScoreB = side === 'B' ? Math.max(0, liveMatch.scoreB - 1) : liveMatch.scoreB;

    let removedOne = false;
    const updatedEvents = liveMatch.events.filter((ev) => {
      if (!removedOne && ev.type === 'goal' && ev.teamId === targetTeam?.id) {
        removedOne = true;
        return false;
      }
      return true;
    });

    onUpdateLiveMatch({
      ...liveMatch,
      scoreA: nextScoreA,
      scoreB: nextScoreB,
      events: updatedEvents,
      endedReason: null,
      winnerTeamId: null,
    });
  };

  const handleResetMatch = () => {
    onUpdateLiveMatch({
      ...liveMatch,
      isRunning: false,
      remainingSeconds: rules.durationMinutes * 60,
      remainingAtStart: rules.durationMinutes * 60,
      timerStartedAt: null,
      configuredMinutes: rules.durationMinutes,
      addedStoppageMinutes: 0,
      scoreA: 0,
      scoreB: 0,
      events: [],
      winnerTeamId: null,
      endedReason: null,
    });
  };

  const winnerSide: 'A' | 'B' | 'draw' =
    liveMatch.scoreA > liveMatch.scoreB
      ? 'A'
      : liveMatch.scoreB > liveMatch.scoreA
      ? 'B'
      : 'draw';

  return (
    <div className="space-y-4">
      {/* Sub-Abas do Juiz (Mobile & Desktop) */}
      <SubTabNavigation<RefereeSubTab>
        activeTab={activeSubTab}
        onChange={setActiveSubTab}
        tabs={[
          {
            id: 'scoreboard',
            label: 'Placar & Tempo',
            icon: Timer,
            badge: `${liveMatch.scoreA}x${liveMatch.scoreB}`,
          },
          {
            id: 'queue',
            label: 'Fila de Espera',
            icon: Users,
            badge: queueTeams.length > 0 ? queueTeams.length : undefined,
          },
          {
            id: 'cointoss',
            label: 'Cara ou Coroa',
            icon: Coins,
            badge: coinToss.result ? coinToss.result.toUpperCase() : undefined,
          },
          {
            id: 'log',
            label: 'Súmula',
            icon: ClipboardList,
            badge: liveMatch.events.length > 0 ? liveMatch.events.length : undefined,
          },
        ]}
      />

      {/* =========================================================
          SUB-ABA 1: PLACAR & CRONÔMETRO (Zero Scroll no Celular)
      ========================================================= */}
      {activeSubTab === 'scoreboard' && (
        <div className="space-y-4">
          <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-5">
            {/* Context bar with quick duration configuration */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span>Tempo Padrão: <strong className="text-slate-200">{rules.durationMinutes} min</strong></span>
                <span aria-hidden="true">·</span>
                <span>Meta: <strong className="text-slate-200">{rules.goalLimit ? `${rules.goalLimit} Gols` : 'Sem limite'}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <label htmlFor="custom-match-minutes" className="text-xs text-slate-400">
                  Ajustar:
                </label>
                <input
                  id="custom-match-minutes"
                  type="number"
                  min={1}
                  max={90}
                  value={customMinutesInput}
                  onChange={(e) => setCustomMinutesInput(e.target.value)}
                  className="w-14 px-2 py-1 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-slate-100 tabular-nums text-center"
                />
                <button
                  type="button"
                  onClick={handleApplyCustomDuration}
                  className="px-2.5 py-1 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors whitespace-nowrap"
                >
                  OK
                </button>
              </div>
            </div>

            {/* Digital Clock Display */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-5 text-center space-y-3 shadow-inner">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Cronômetro Oficial</span>
                {liveMatch.addedStoppageMinutes > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-400 font-semibold tabular-nums">
                      +{liveMatch.addedStoppageMinutes} min de Acréscimo
                    </span>
                  </>
                )}
              </div>

              <div
                className={`text-6xl sm:text-7xl font-mono font-black tracking-tight tabular-nums select-none ${
                  liveMatch.remainingSeconds <= 60
                    ? 'text-red-400 animate-pulse'
                    : liveMatch.isRunning
                    ? 'text-emerald-400'
                    : 'text-slate-100'
                }`}
                data-testid="match-timer-display"
              >
                {formatClock(liveMatch.remainingSeconds)}
              </div>

              {/* Primary Clock Controls */}
              <div className="flex items-center justify-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (liveMatch.isRunning) {
                      const elapsedSec = liveMatch.timerStartedAt
                        ? Math.floor((Date.now() - liveMatch.timerStartedAt) / 1000)
                        : 0;
                      const baseRem = liveMatch.remainingAtStart ?? liveMatch.remainingSeconds;
                      const exactRemaining = Math.max(0, baseRem - elapsedSec);
                      onUpdateLiveMatch({
                        ...liveMatch,
                        isRunning: false,
                        remainingSeconds: exactRemaining,
                        remainingAtStart: exactRemaining,
                        timerStartedAt: null,
                      });
                      return;
                    }

                    playWhistleShort();
                    if (liveMatch.endedReason === 'goal_limit') {
                      const resetSeconds = rules.durationMinutes * 60;
                      onUpdateLiveMatch({
                        ...liveMatch,
                        isRunning: true,
                        remainingSeconds: resetSeconds,
                        remainingAtStart: resetSeconds,
                        timerStartedAt: Date.now(),
                        configuredMinutes: rules.durationMinutes,
                        addedStoppageMinutes: 0,
                        scoreA: 0,
                        scoreB: 0,
                        events: [],
                        endedReason: null,
                        winnerTeamId: null,
                      });
                    } else if (liveMatch.remainingSeconds <= 0) {
                      const resetSeconds = rules.durationMinutes * 60;
                      onUpdateLiveMatch({
                        ...liveMatch,
                        isRunning: true,
                        remainingSeconds: resetSeconds,
                        remainingAtStart: resetSeconds,
                        timerStartedAt: Date.now(),
                        addedStoppageMinutes: 0,
                        endedReason: null,
                        winnerTeamId: null,
                      });
                    } else {
                      onUpdateLiveMatch({
                        ...liveMatch,
                        isRunning: true,
                        remainingAtStart: liveMatch.remainingSeconds,
                        timerStartedAt: Date.now(),
                        endedReason: null,
                        winnerTeamId: null,
                      });
                    }
                  }}
                  className={`flex-1 max-w-xs py-3 px-5 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg ${
                    liveMatch.isRunning
                      ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20'
                      : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
                  }`}
                >
                  {liveMatch.isRunning ? (
                    <>
                      <Pause className="w-4 h-4" />
                      PAUSAR TEMPO
                    </>
                  ) : liveMatch.endedReason === 'goal_limit' ? (
                    <>
                      <Play className="w-4 h-4" />
                      NOVA PARTIDA
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      INICIAR TEMPO
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetMatch}
                  title="Reiniciar Jogo"
                  className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 active:scale-95 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              {/* Stoppage Time (Acréscimos) Bar */}
              <div className="pt-3 border-t border-slate-900 flex flex-wrap items-center justify-center gap-1.5">
                <span className="text-[11px] text-slate-400 mr-1">Dar Acréscimo:</span>
                {[1, 2, 3, 5].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleAddStoppageTime(mins)}
                    className="px-2.5 py-1 text-xs font-mono font-semibold bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 rounded-lg active:scale-95 transition-colors tabular-nums"
                  >
                    +{mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Match Finished Alert Banner */}
            {liveMatch.endedReason && (
              <div className="bg-emerald-950/70 border border-emerald-500/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                <div className="space-y-1">
                  <div className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <Trophy className="w-4 h-4" />
                    {liveMatch.endedReason === 'goal_limit'
                      ? `Fim de Jogo! Limite de ${rules.goalLimit} Gols Atingido`
                      : 'Fim do Tempo Regulamentar!'}
                  </div>
                  <p className="text-sm font-semibold text-slate-100">
                    {winnerSide === 'A'
                      ? `Vitória do ${teamA?.name}!`
                      : winnerSide === 'B'
                      ? `Vitória do ${teamB?.name}!`
                      : 'Partida encerrada em empate.'}
                  </p>
                </div>
                {queueTeams.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onRotateQueueWinnerStays(winnerSide)}
                    className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl active:scale-95 shadow-md shadow-emerald-500/20"
                  >
                    Próximo da Fila (Vencedor Fica)
                  </button>
                )}
              </div>
            )}

            {/* Teams Scoreboard - Mobile Ergonomic Side-by-Side */}
            {teamA && teamB ? (
              <div className="grid grid-cols-2 gap-3">
                {/* Team A Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] text-slate-400 block truncate">
                      {coinToss.fieldSideTeamA}
                      {coinToss.ballTeamId === teamA.id ? ' · Bola' : ''}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-100 mt-0.5 truncate flex items-center justify-center sm:justify-start gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: teamA.accentHex }}
                      />
                      <span className="truncate">{teamA.name}</span>
                    </h3>
                  </div>

                  <div className="text-center py-1">
                    <span
                      className="text-5xl sm:text-6xl font-mono font-black text-emerald-400 tabular-nums leading-none"
                      data-testid="score-team-a"
                    >
                      {liveMatch.scoreA}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleScoreGoal('A')}
                      className="w-full py-3 px-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 shadow-md"
                    >
                      <Plus className="w-4 h-4 stroke-[3px]" />
                      GOL {teamA.shortName}
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedScorerTeam(selectedScorerTeam === 'A' ? null : 'A')
                        }
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-colors ${
                          selectedScorerTeam === 'A'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        Autor...
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustScoreMinus('A')}
                        aria-label={`Diminuir gol de ${teamA.name}`}
                        className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-xs font-mono font-bold rounded-lg transition-colors"
                      >
                        -1 Gol
                      </button>
                    </div>
                  </div>

                  {selectedScorerTeam === 'A' && (
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Quem marcou?
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {[...(teamA.goalkeeper ? [teamA.goalkeeper] : []), ...teamA.linePlayers].map(
                          (p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleScoreGoal('A', p.name)}
                              className="px-2 py-1 text-[11px] bg-slate-900 hover:bg-emerald-950 text-slate-200 border border-slate-800 rounded-md transition-colors truncate max-w-full"
                            >
                              {p.name.split(' ')[0]}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Team B Box */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between gap-3">
                  <div className="text-center sm:text-left">
                    <span className="text-[10px] text-slate-400 block truncate">
                      {coinToss.fieldSideTeamB}
                      {coinToss.ballTeamId === teamB.id ? ' · Bola' : ''}
                    </span>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-100 mt-0.5 truncate flex items-center justify-center sm:justify-start gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: teamB.accentHex }}
                      />
                      <span className="truncate">{teamB.name}</span>
                    </h3>
                  </div>

                  <div className="text-center py-1">
                    <span
                      className="text-5xl sm:text-6xl font-mono font-black text-sky-400 tabular-nums leading-none"
                      data-testid="score-team-b"
                    >
                      {liveMatch.scoreB}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <button
                      type="button"
                      onClick={() => handleScoreGoal('B')}
                      className="w-full py-3 px-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 active:scale-95 shadow-md"
                    >
                      <Plus className="w-4 h-4 stroke-[3px]" />
                      GOL {teamB.shortName}
                    </button>

                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedScorerTeam(selectedScorerTeam === 'B' ? null : 'B')
                        }
                        className={`py-1.5 px-2 text-xs font-bold rounded-lg border transition-colors ${
                          selectedScorerTeam === 'B'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-slate-900 text-slate-300 border-slate-800'
                        }`}
                      >
                        Autor...
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAdjustScoreMinus('B')}
                        aria-label={`Diminuir gol de ${teamB.name}`}
                        className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-slate-400 border border-slate-800 text-xs font-mono font-bold rounded-lg transition-colors"
                      >
                        -1 Gol
                      </button>
                    </div>
                  </div>

                  {selectedScorerTeam === 'B' && (
                    <div className="pt-2 border-t border-slate-800 space-y-1">
                      <span className="text-[10px] text-slate-400 block font-medium">
                        Quem marcou?
                      </span>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {[...(teamB.goalkeeper ? [teamB.goalkeeper] : []), ...teamB.linePlayers].map(
                          (p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleScoreGoal('B', p.name)}
                              className="px-2 py-1 text-[11px] bg-slate-900 hover:bg-sky-950 text-slate-200 border border-slate-800 rounded-md transition-colors truncate max-w-full"
                            >
                              {p.name.split(' ')[0]}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Quick Action to Rotate Queue / Next Game */}
            {queueTeams.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onRotateQueueWinnerStays(winnerSide)}
                  className="w-full py-3 px-4 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  <span>ENCERRAR / PRÓXIMO TIME DA FILA ({queueTeams[0]?.name})</span>
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {/* =========================================================
          SUB-ABA 2: FILA DE ESPERA (REI DA QUADRA)
      ========================================================= */}
      {activeSubTab === 'queue' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <div className="text-xs text-slate-400">Rodízio de Times (Rei da Quadra)</div>
            <h3 className="text-base font-bold text-slate-100 mt-0.5">
              Fila de Espera & Próximos Jogos
            </h3>
          </div>

          {/* Teams currently on court */}
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4">
            <span className="text-[11px] font-bold uppercase text-emerald-400 tracking-wider">
              Em Quadra Agora
            </span>
            <div className="flex items-center justify-between mt-2 text-sm sm:text-base font-extrabold text-white">
              <span className="truncate flex-1">{teamA?.name || 'Time A'}</span>
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 shrink-0 mx-2">
                {liveMatch.scoreA} x {liveMatch.scoreB}
              </span>
              <span className="truncate flex-1 text-right">{teamB?.name || 'Time B'}</span>
            </div>
          </div>

          {queueTeams.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-6 text-center text-xs text-slate-400">
              Apenas 2 times sorteados no momento. Adicione mais jogadores no Sorteio para formar fila de espera.
            </div>
          ) : (
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-slate-400 block">
                Ordem dos Próximos ({queueTeams.length} times aguardando):
              </span>

              {queueTeams.map((qt, idx) => (
                <div
                  key={qt.id}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-400 font-mono font-bold text-xs flex items-center justify-center shrink-0">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="text-sm font-semibold text-slate-100 block">
                        {qt.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {qt.linePlayers.length + (qt.goalkeeper ? 1 : 0)} jogadores
                      </span>
                    </div>
                  </div>
                  <span className="text-xs font-mono text-amber-400 tabular-nums">
                    {camouflageStars ? '4.2' : qt.averageRating.toFixed(1)} ★
                  </span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => onRotateQueueWinnerStays('A')}
                  className="py-3 px-3 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 rounded-xl text-xs font-bold text-emerald-300 transition-colors whitespace-nowrap truncate active:scale-95"
                >
                  {teamA?.shortName} Venceu (Fica)
                </button>
                <button
                  type="button"
                  onClick={() => onRotateQueueWinnerStays('B')}
                  className="py-3 px-3 bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-xl text-xs font-bold text-sky-300 transition-colors whitespace-nowrap truncate active:scale-95"
                >
                  {teamB?.shortName} Venceu (Fica)
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          SUB-ABA 3: CARA OU COROA (Moeda & Lados)
      ========================================================= */}
      {activeSubTab === 'cointoss' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5 text-center">
          <div className="flex items-start justify-between gap-3 text-left">
            <div>
              <div className="text-xs text-slate-400">
                Sorteio de Lado de Campo e Bola
              </div>
              <h2 className="text-lg font-bold text-slate-100 mt-0.5 flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                Cara ou Coroa Virtual
              </h2>
            </div>
            <button
              type="button"
              onClick={handleSwapFieldSides}
              className="px-3 py-1.5 text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 active:scale-95"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Inverter Lados
            </button>
          </div>

          {/* Choice Selector for Team A */}
          {teamA && teamB && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-left">
              <span className="text-xs text-slate-300">
                Escolha do <strong>{teamA.shortName}</strong>:
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCoinToss({
                      ...coinToss,
                      callerTeamId: teamA.id,
                      callerChoice: 'cara',
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap active:scale-95 ${
                    coinToss.callerChoice === 'cara'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  CARA (Escudo)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateCoinToss({
                      ...coinToss,
                      callerTeamId: teamA.id,
                      callerChoice: 'coroa',
                    })
                  }
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap active:scale-95 ${
                    coinToss.callerChoice === 'coroa'
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  COROA (Bola)
                </button>
              </div>
            </div>
          )}

          {/* Interactive 3D Coin Display */}
          <div className="flex flex-col items-center justify-center py-4 gap-4">
            <div
              className={`w-32 h-32 rounded-full border-4 border-amber-300 bg-gradient-to-br from-amber-300 via-amber-500 to-amber-700 shadow-2xl flex flex-col items-center justify-center text-slate-950 select-none ${
                isFlipping ? 'animate-coin-flip' : ''
              }`}
              data-testid="virtual-coin-graphic"
            >
              <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-80">
                PELADAPRO
              </span>
              <span className="text-xl font-black tracking-tight mt-0.5">
                {isFlipping
                  ? 'GIRANDO...'
                  : coinToss.result
                  ? coinToss.result.toUpperCase()
                  : 'MOEDA'}
              </span>
              <span className="text-[10px] font-bold opacity-80">
                {coinToss.result === 'cara'
                  ? 'Lado Escudo'
                  : coinToss.result === 'coroa'
                  ? 'Lado Bola'
                  : 'Pronta'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleFlipCoin}
              disabled={isFlipping}
              className="w-full max-w-sm py-3.5 px-4 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 whitespace-nowrap"
            >
              {isFlipping ? 'Lançando Moeda para o Alto...' : 'LANÇAR MOEDA (CARA OU COROA)'}
            </button>
          </div>

          {/* Coin Result Summary */}
          {coinToss.result && teamA && teamB && (
            <div
              className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2 text-xs text-left"
              data-testid="coin-toss-result"
            >
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Resultado da Moeda:</span>
                <strong className="text-amber-400 uppercase font-black">{coinToss.result}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Posse de Bola Inicial:</span>
                <strong className="text-emerald-400 font-bold">
                  {coinToss.ballTeamId === teamA.id ? teamA.name : teamB.name}
                </strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{teamA.shortName}:</span>
                <span className="text-slate-200">{coinToss.fieldSideTeamA}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">{teamB.shortName}:</span>
                <span className="text-slate-200">{coinToss.fieldSideTeamB}</span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          SUB-ABA 4: SÚMULA DE EVENTOS DA PARTIDA
      ========================================================= */}
      {activeSubTab === 'log' && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-100">
              Súmula Ao Vivo da Partida
            </h3>
            <span className="text-xs text-slate-400">
              {liveMatch.events.length} registro(s)
            </span>
          </div>

          {liveMatch.events.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-8 text-center text-xs text-slate-400">
              Nenhum gol ou acréscimo registrado ainda nesta partida.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80 text-xs">
              {liveMatch.events.map((ev) => (
                <div
                  key={ev.id}
                  className="py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    <span className="text-slate-200 truncate">{ev.description}</span>
                  </div>
                  <span className="font-mono text-slate-400 tabular-nums shrink-0 font-semibold">
                    {ev.minuteMark}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
};
