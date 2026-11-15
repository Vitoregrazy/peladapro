import React, { useState } from 'react';
import { Shield, Sparkles, UserCheck, Users, Eye, ArrowRight, User } from 'lucide-react';
import { DrawnTeam, Player } from '../types/pelada';

interface MyTeamCardProps {
  drawnTeams: DrawnTeam[];
  allPlayers: Player[];
  myAthleteName: string | null;
  onSelectAthlete: (name: string) => void;
  onScrollToTeam?: (teamId: string) => void;
}

export const MyTeamCard: React.FC<MyTeamCardProps> = ({
  drawnTeams,
  allPlayers,
  myAthleteName,
  onSelectAthlete,
  onScrollToTeam,
}) => {
  const [isChangingIdentity, setIsChangingIdentity] = useState(false);
  const [customNameInput, setCustomNameInput] = useState('');

  const cleanMyName = (myAthleteName || '').trim().toLowerCase();

  // Find user's team
  const myTeamIndex = drawnTeams.findIndex((team) => {
    const inLine = team.linePlayers.some(
      (p) => p.name.trim().toLowerCase() === cleanMyName
    );
    const inGk = team.goalkeeper?.name.trim().toLowerCase() === cleanMyName;
    return inLine || inGk;
  });

  const myTeam = myTeamIndex >= 0 ? drawnTeams[myTeamIndex] : null;

  // Filter out the user to show exact teammates
  const isUserGk = myTeam?.goalkeeper?.name.trim().toLowerCase() === cleanMyName;
  const lineTeammates = myTeam
    ? myTeam.linePlayers.filter((p) => p.name.trim().toLowerCase() !== cleanMyName)
    : [];
  const gkTeammate = !isUserGk ? myTeam?.goalkeeper : null;

  // Match order description
  const getMatchOrderDescription = (idx: number, teams: DrawnTeam[]) => {
    if (idx === 0) {
      const rival = teams[1]?.name || 'Time B';
      return `🔥 Titular no 1º Jogo contra o ${rival}`;
    }
    if (idx === 1) {
      const rival = teams[0]?.name || 'Time A';
      return `🔥 Titular no 1º Jogo contra o ${rival}`;
    }
    return `⏳ ${idx + 1}º Time da Fila · Aguardando pelo Rei da Quadra`;
  };

  const handleSelect = (name: string) => {
    if (!name.trim()) return;
    onSelectAthlete(name.trim());
    setIsChangingIdentity(false);
    setCustomNameInput('');
  };

  return (
    <section
      id="meu-time-anchor"
      className="rounded-2xl transition-all duration-300"
    >
      {/* 1. Identity Selector Banner (if not selected or changing) */}
      {(!myAthleteName || isChangingIdentity) ? (
        <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Quem é você na Pelada?
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Meu Time
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Identifique-se para ver seu time em destaque, saber seus companheiros e receber notificações.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div>
              <label htmlFor="select-athlete-dropdown" className="block text-xs font-medium text-slate-300 mb-1">
                Escolha seu nome na lista:
              </label>
              <select
                id="select-athlete-dropdown"
                value={myAthleteName || ''}
                onChange={(e) => handleSelect(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                <option value="">Selecione seu nome...</option>
                {allPlayers.map((player) => (
                  <option key={player.id} value={player.name}>
                    {player.name} {player.isGoalkeeper ? '🧤 (Goleiro)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="custom-athlete-name" className="block text-xs font-medium text-slate-300 mb-1">
                Ou digite seu nome se não estiver na lista:
              </label>
              <div className="flex gap-2">
                <input
                  id="custom-athlete-name"
                  type="text"
                  placeholder="Seu nome..."
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSelect(customNameInput);
                  }}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:border-emerald-500 outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSelect(customNameInput)}
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>

          {isChangingIdentity && myAthleteName && (
            <div className="mt-3 text-right">
              <button
                type="button"
                onClick={() => setIsChangingIdentity(false)}
                className="text-xs text-slate-400 hover:text-slate-200 underline"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Identity Switch Bar */
        <div className="flex items-center justify-between text-xs px-2 py-1 text-slate-400">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              Você está jogando como <strong className="text-slate-200">{myAthleteName}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsChangingIdentity(true)}
            className="text-emerald-400 hover:text-emerald-300 font-semibold underline text-xs transition-colors"
          >
            Trocar Atleta
          </button>
        </div>
      )}

      {/* 2. Highlight Card: MEU TIME */}
      {myTeam && !isChangingIdentity && (
        <div
          className="mt-3 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border-2 shadow-2xl p-5"
          style={{ borderColor: myTeam.accentHex }}
        >
          {/* Subtle Ambient Glow */}
          <div
            className="absolute top-0 right-0 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none"
            style={{ backgroundColor: myTeam.accentHex }}
          />

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center shadow-lg border border-white/20 text-slate-950 font-black text-xl"
                style={{ backgroundColor: myTeam.accentHex }}
              >
                <Shield className="w-6 h-6 text-slate-950" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 shadow-[0_0_12px_#34d399] animate-pulse">
                    ⭐ Seu Time
                  </span>
                  <span className="text-xs text-slate-400">
                    {isUserGk ? 'Você é o Goleiro 🧤' : 'Jogador de Linha'}
                  </span>
                </div>
                <h3 className="text-xl font-black text-white mt-0.5 flex items-center gap-2">
                  {myTeam.name}
                </h3>
              </div>
            </div>

            {onScrollToTeam && (
              <button
                type="button"
                onClick={() => onScrollToTeam(myTeam.id)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                Ver na Prancheta
              </button>
            )}
          </div>

          {/* Match / Status Order */}
          <div className="bg-slate-950/80 border border-slate-800/90 rounded-xl p-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-slate-300 font-medium">
                {getMatchOrderDescription(myTeamIndex, drawnTeams)}
              </span>
            </div>
            <span className="text-[11px] font-mono font-bold text-amber-400 shrink-0">
              {myTeam.averageRating.toFixed(1)} ★ Força
            </span>
          </div>

          {/* Teammates List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                Seus {lineTeammates.length + (gkTeammate ? 1 : 0)} Companheiros de Equipe:
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {/* Goalkeeper Teammate (if user is not the GK) */}
              {gkTeammate && (
                <div className="bg-slate-800/90 border border-amber-500/30 rounded-xl px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40">
                      GOL 🧤
                    </span>
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {gkTeammate.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 shrink-0">
                    {gkTeammate.rating}★
                  </span>
                </div>
              )}

              {/* Line Teammates */}
              {lineTeammates.map((mate, i) => (
                <div
                  key={mate.id}
                  className="bg-slate-800/70 border border-slate-700/60 rounded-xl px-3 py-2 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-slate-950 shrink-0"
                      style={{ backgroundColor: myTeam.accentHex }}
                    >
                      {i + 1}
                    </span>
                    <span className="font-medium text-slate-100 truncate">
                      {mate.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {mate.rating}★
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* If identified but not in any drawn team (e.g. reserve or spectator) */}
      {myAthleteName && !myTeam && drawnTeams.length > 0 && !isChangingIdentity && (
        <div className="mt-3 bg-slate-900 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 flex items-center justify-between">
          <span>
            Você não foi escalado nos times principais deste sorteio (está na fila de espera/reserva).
          </span>
          <button
            type="button"
            onClick={() => setIsChangingIdentity(true)}
            className="text-emerald-400 font-semibold underline shrink-0 ml-2"
          >
            Trocar
          </button>
        </div>
      )}
    </section>
  );
};
