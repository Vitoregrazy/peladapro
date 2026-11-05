import React, { useState } from 'react';
import { Check, CheckCircle2, Search, Shield, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { Player } from '../types/pelada';

interface GuestCheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomCode: string;
  roomName?: string;
  players: Player[];
  onAddPlayer: (player: Player) => void;
  onTogglePresence: (playerId: string) => void;
}

export const GuestCheckinModal: React.FC<GuestCheckinModalProps> = ({
  isOpen,
  onClose,
  roomCode,
  roomName,
  players,
  onAddPlayer,
  onTogglePresence,
}) => {
  const [guestName, setGuestName] = useState('');
  const [isGk, setIsGk] = useState(false);
  const [confirmedSuccess, setConfirmedSuccess] = useState<string | null>(null);
  const [filterSearch, setFilterSearch] = useState('');

  if (!isOpen) return null;

  const confirmedCount = players.filter((p) => p.confirmed).length;
  const filteredPlayers = filterSearch.trim()
    ? players.filter((p) =>
        p.name.toLowerCase().includes(filterSearch.trim().toLowerCase())
      )
    : players;

  const handleSubmitNewGuest = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = guestName.trim();
    if (!clean) return;

    const newPlayer: Player = {
      id: `p-guest-${Date.now()}`,
      name: clean,
      isGoalkeeper: isGk,
      rating: 4,
      confirmed: true,
    };

    onAddPlayer(newPlayer);
    setConfirmedSuccess(clean);
    setGuestName('');
    setTimeout(() => {
      setConfirmedSuccess(null);
    }, 4000);
  };

  const handleQuickToggle = (p: Player) => {
    onTogglePresence(p.id);
    setConfirmedSuccess(p.name);
    setTimeout(() => {
      setConfirmedSuccess(null);
    }, 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-slate-900 border-t sm:border border-emerald-500/30 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-5 shadow-2xl animate-slideUp max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SALA OFICIAL {roomCode}</span>
              <span aria-hidden="true">·</span>
              <span className="text-slate-400">{confirmedCount} Confirmados</span>
            </div>
            <h2 className="text-lg font-black text-white mt-0.5">
              {roomName || `Pelada ${roomCode}`}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Confirme sua presença abaixo para entrar no sorteio dos times.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {confirmedSuccess && (
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2.5 text-xs text-emerald-300 font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Presença de {confirmedSuccess} confirmada na lista! ⚽</span>
          </div>
        )}

        <div className="overflow-y-auto space-y-5 pr-1 flex-1">
          {/* Form: Não estou na lista */}
          <form
            onSubmit={handleSubmitNewGuest}
            className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Não está na lista? Digite seu nome:</span>
            </div>

            <div>
              <input
                type="text"
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Ex: João Silva, Fabinho..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsGk(false)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  !isGk
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🏃‍♂️ Linha
              </button>
              <button
                type="button"
                onClick={() => setIsGk(true)}
                className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                  isGk
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                🧤 Goleiro (GOL)
              </button>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              Confirmar Minha Vaga na Pelada
            </button>
          </form>

          {/* Quick List: Seu nome já está aqui? */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400">
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>Seu nome já está na lista? Toque para confirmar:</span>
              </span>
            </div>

            {players.length > 6 && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={filterSearch}
                  onChange={(e) => setFilterSearch(e.target.value)}
                  placeholder="Buscar seu nome na lista..."
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}

            <div className="divide-y divide-slate-800/80 bg-slate-950/60 border border-slate-800/80 rounded-2xl max-h-56 overflow-y-auto">
              {filteredPlayers.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  Nenhum nome encontrado. Digite seu nome no formulário acima!
                </div>
              ) : (
                filteredPlayers.map((p) => (
                <div
                  key={p.id}
                  className="p-3 flex items-center justify-between gap-2 hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded text-[10px] ${
                        p.isGoalkeeper
                          ? 'bg-amber-500/20 text-amber-400'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {p.isGoalkeeper ? 'GOL' : 'LINHA'}
                    </span>
                    <span className="font-semibold text-slate-200 text-sm truncate">
                      {p.name}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleQuickToggle(p)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 active:scale-95 shrink-0 ${
                      p.confirmed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p.confirmed ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Confirmado</span>
                      </>
                    ) : (
                      <span>Vou Jogar</span>
                    )}
                  </button>
                </div>
              )))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs"
          >
            Ver Telas e Times da Pelada
          </button>
        </div>
      </div>
    </div>
  );
};
