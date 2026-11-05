import React, { useState, useEffect } from 'react';
import { Check, Copy, DollarSign, QrCode, Share2, Users, X } from 'lucide-react';
import { Player } from '../types/pelada';

interface PixRateioModalProps {
  isOpen: boolean;
  onClose: () => void;
  players: Player[];
}

export const PixRateioModal: React.FC<PixRateioModalProps> = ({
  isOpen,
  onClose,
  players,
}) => {
  const confirmedPlayers = players.filter((p) => p.confirmed);
  const confirmedCount = Math.max(1, confirmedPlayers.length);

  const [totalAmount, setTotalAmount] = useState<number>(() => {
    const saved = localStorage.getItem('peladapro_last_total_pix');
    return saved ? Number(saved) : 240;
  });

  const [pixKey, setPixKey] = useState<string>(() => {
    return localStorage.getItem('peladapro_pix_key') || '';
  });

  const [pixKeyType, setPixKeyType] = useState<string>(() => {
    return localStorage.getItem('peladapro_pix_type') || 'telefone';
  });

  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedKeyOnly, setCopiedKeyOnly] = useState(false);

  useEffect(() => {
    if (pixKey) localStorage.setItem('peladapro_pix_key', pixKey);
    if (pixKeyType) localStorage.setItem('peladapro_pix_type', pixKeyType);
    if (totalAmount) localStorage.setItem('peladapro_last_total_pix', String(totalAmount));
  }, [pixKey, pixKeyType, totalAmount]);

  if (!isOpen) return null;

  const perPersonAmount = Number((totalAmount / confirmedCount).toFixed(2));

  const buildWhatsAppMessage = () => {
    let msg = `⚽ *RATEIO DA PELADA — PIX*\n`;
    msg += `🏟️ *Valor Total:* R$ ${totalAmount.toFixed(2)}\n`;
    msg += `👥 *Confirmados:* ${confirmedCount} atletas\n`;
    msg += `💰 *Valor por Pessoa:* R$ ${perPersonAmount.toFixed(2)}\n\n`;

    if (pixKey.trim()) {
      msg += `🔑 *Chave Pix (${pixKeyType}):*\n\`${pixKey.trim()}\`\n\n`;
    }

    msg += `📋 *Lista de Pagamento:*\n`;
    confirmedPlayers.forEach((p, idx) => {
      msg += `${idx + 1}. ${p.name} — [   ]\n`;
    });

    msg += `\n_Favor mandar comprovante no grupo após o Pix!_ ⚡`;
    return msg;
  };

  const handleCopyWhatsAppMessage = async () => {
    const msg = buildWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(msg);
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      setCopiedMessage(true);
      setTimeout(() => setCopiedMessage(false), 2500);
    }
  };

  const handleCopyKeyOnly = async () => {
    if (!pixKey.trim()) return;
    try {
      await navigator.clipboard.writeText(pixKey.trim());
      setCopiedKeyOnly(true);
      setTimeout(() => setCopiedKeyOnly(false), 2000);
    } catch {
      setCopiedKeyOnly(true);
      setTimeout(() => setCopiedKeyOnly(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-slideUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">Rateio & Cobrança Pix</h3>
              <p className="text-xs text-slate-400">Divida a quadra ou churrasco em 1 clique</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Valor Total da Quadra
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-bold">R$</span>
              <input
                type="number"
                min="0"
                step="5"
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value) || 0)}
                className="w-full pl-8 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono font-bold text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 mb-1">
              Atletas na Divisão
            </label>
            <div className="flex items-center justify-between px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl">
              <span className="text-xs font-semibold text-slate-300">Confirmados:</span>
              <span className="text-sm font-mono font-bold text-emerald-400">{confirmedCount}</span>
            </div>
          </div>
        </div>

        {/* Chave Pix */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-400">Sua Chave Pix (Salva)</label>
            <select
              value={pixKeyType}
              onChange={(e) => setPixKeyType(e.target.value)}
              className="text-[11px] bg-slate-950 text-slate-300 border border-slate-800 rounded px-1.5 py-0.5 focus:outline-none"
            >
              <option value="telefone">Celular</option>
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="aleatoria">Chave Aleatória</option>
            </select>
          </div>
          <input
            type="text"
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Ex: 11999998888 ou seu@email.com"
            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:border-emerald-500 focus:outline-none"
          />
        </div>

        {/* Destaque do Valor por Pessoa */}
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
          <div>
            <div className="text-[11px] text-emerald-400 font-bold uppercase tracking-wider">
              Valor por Atleta
            </div>
            <div className="text-2xl font-black font-mono text-white mt-0.5">
              R$ {perPersonAmount.toFixed(2)}
            </div>
          </div>
          {pixKey.trim() && (
            <button
              type="button"
              onClick={handleCopyKeyOnly}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 flex items-center gap-1 active:scale-95"
            >
              {copiedKeyOnly ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedKeyOnly ? 'Copiada!' : 'Copiar Pix'}</span>
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleCopyWhatsAppMessage}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
          >
            {copiedMessage ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedMessage ? 'Mensagem Copiada! Cole no Zap' : 'Copiar Cobrança Completa p/ WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white font-bold text-xs rounded-xl"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

