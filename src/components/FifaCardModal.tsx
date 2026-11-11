import React, { useRef, useState } from 'react';
import { Check, Download, Share2, Sparkles, Star, Trophy, X } from 'lucide-react';
import { Player } from '../types/pelada';
import { openWhatsAppWithText } from '../utils/whatsappShare';

interface FifaCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  goalsScored?: number;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function renderFifaCardPng(params: {
  player: Player;
  ovr: number;
  pos: string;
  stats: { pac: number; dri: number; sho: number; def: number; pas: number; phy: number };
}): string {
  const width = 512;
  const height = 768;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível');

  // Card Outer Frame & Background Gradient (Hex puro, imune ao oklch do Tailwind v4)
  drawRoundedRect(ctx, 8, 8, width - 16, height - 16, 48);
  const bgGrad = ctx.createLinearGradient(0, 0, width, height);
  bgGrad.addColorStop(0, '#1c1917');
  bgGrad.addColorStop(0.45, '#292524');
  bgGrad.addColorStop(1, '#1c1917');
  ctx.fillStyle = bgGrad;
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f59e0b';
  ctx.stroke();

  // Subtle top radial glow
  const glow = ctx.createRadialGradient(width / 2, 120, 20, width / 2, 160, 280);
  glow.addColorStop(0, 'rgba(245, 158, 11, 0.25)');
  glow.addColorStop(1, 'rgba(245, 158, 11, 0)');
  ctx.fillStyle = glow;
  ctx.fill();

  // OVR & POS
  ctx.fillStyle = '#fcd34d';
  ctx.font = '900 74px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(params.ovr), 96, 108);

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 24px sans-serif';
  ctx.fillText(params.pos, 96, 142);

  // PeladaPro Crest Badge
  drawRoundedRect(ctx, width - 178, 46, 134, 42, 14);
  ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.stroke();
  ctx.fillStyle = '#fcd34d';
  ctx.font = '900 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PELADAPRO', width - 111, 73);

  // Center Avatar Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(width / 2, 290, 82, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1917';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = '#fbbf24';
  ctx.font = '900 58px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(params.player.name.charAt(0).toUpperCase(), width / 2, 310);

  // Player Name
  ctx.fillStyle = '#fef3c7';
  ctx.font = '900 32px sans-serif';
  ctx.fillText(params.player.name.toUpperCase().slice(0, 18), width / 2, 430);

  // Rating Stars
  ctx.font = '24px sans-serif';
  const rating = Math.max(1, Math.min(5, params.player.rating || 4));
  const starStr = '★'.repeat(rating) + '☆'.repeat(5 - rating);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(starStr, width / 2, 468);

  // Divider
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(52, 505);
  ctx.lineTo(width - 52, 505);
  ctx.stroke();

  // 6 Stats Grid
  const rows: [string, number, string, number][] = [
    ['RIT', params.stats.pac, 'DRI', params.stats.dri],
    ['FIN', params.stats.sho, 'DEF', params.stats.def],
    ['PAS', params.stats.pas, 'CHUR', params.stats.phy],
  ];

  rows.forEach(([lLabel, lVal, rLabel, rVal], idx) => {
    const y = 562 + idx * 58;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 28px monospace';
    ctx.fillText(String(lVal), 72, y);
    ctx.fillStyle = '#a8a29e';
    ctx.font = '700 20px sans-serif';
    ctx.fillText(lLabel, 134, y - 2);

    ctx.fillStyle = '#fbbf24';
    ctx.font = '900 28px monospace';
    ctx.fillText(String(rVal), 292, y);
    ctx.fillStyle = '#a8a29e';
    ctx.font = '700 20px sans-serif';
    ctx.fillText(rLabel, 356, y - 2);
  });

  return canvas.toDataURL('image/png');
}

export const FifaCardModal: React.FC<FifaCardModalProps> = ({
  isOpen,
  onClose,
  player,
  goalsScored = 0,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sharedFeedback, setSharedFeedback] = useState(false);

  if (!isOpen || !player) return null;

  // Rating and attributes calculation
  const ovr = Math.min(99, Math.max(78, (player.rating || 4) * 18 + (player.isHost ? 7 : 0) + goalsScored * 2));
  const pos = player.isGoalkeeper ? 'GOL' : player.rating >= 5 ? 'ATA' : player.rating === 4 ? 'MEI' : 'ZAG';

  // Dynamic attributes
  const pac = Math.min(99, 75 + player.rating * 4 + (player.isHost ? 5 : 0));
  const sho = Math.min(99, 70 + (goalsScored > 0 ? goalsScored * 6 : player.rating * 5));
  const pas = Math.min(99, 74 + player.rating * 4);
  const dri = Math.min(99, 76 + player.rating * 4 + (player.isHost ? 4 : 0));
  const def = player.isGoalkeeper ? 88 : Math.min(95, 68 + player.rating * 4);
  const phy = Math.min(99, 82 + player.rating * 3);

  const handleDownloadCard = () => {
    setIsGenerating(true);
    try {
      const dataUrl = renderFifaCardPng({
        player,
        ovr,
        pos,
        stats: { pac, dri, sho, def, pas, phy },
      });
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `cartinha-${player.name.replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
    } catch (err) {
      console.error('Erro gerando cartinha:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleShareWhatsApp = async () => {
    const text = `🏆 *CRAQUE DA PELADA — PELADAPRO*\nAtleta: *${player.name}*\n⭐ Overall: *${ovr} OVR*\nPosição: *${pos}*\n⚽ Gols na Rodada: *${goalsScored}*\n_Gerado no PeladaPro App_ ⚡`;
    await openWhatsAppWithText(text, 'Cartinha Craque da Pelada');
    setSharedFeedback(true);
    setTimeout(() => setSharedFeedback(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-amber-500/30 rounded-3xl p-5 space-y-4 shadow-2xl animate-scaleUp">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-black text-white uppercase tracking-wider">
              Cartinha do Craque (EA FC)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The Visual Gold FIFA Shield Card */}
        <div className="flex justify-center py-2">
          <div
            ref={cardRef}
            className="w-64 h-96 relative rounded-[28px] overflow-hidden p-5 flex flex-col justify-between select-none shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #1c1917 0%, #292524 40%, #1c1917 100%)',
              border: '4px solid #f59e0b',
              boxShadow: '0 0 30px rgba(245, 158, 11, 0.35)',
            }}
          >
            {/* Background Texture & Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/25 via-transparent to-transparent pointer-events-none" />

            {/* Top Row: OVR, Position, Country & Crest */}
            <div className="relative z-10 flex items-start justify-between">
              <div className="flex flex-col items-center">
                <span className="text-4xl font-black font-mono text-amber-300 leading-none">
                  {ovr}
                </span>
                <span className="text-xs font-black text-amber-400 mt-0.5 tracking-wider">
                  {pos}
                </span>
                <span className="text-base mt-1" title="Brasil">🇧🇷</span>
              </div>

              {/* PeladaPro Mini Crest Badge */}
              <div className="px-2 py-1 rounded-lg bg-amber-500/20 border border-amber-400/40 text-[9px] font-black text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>PELADAPRO</span>
              </div>
            </div>

            {/* Center: Player Avatar / Silhueta */}
            <div className="relative z-10 flex flex-col items-center my-auto">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-amber-300 p-0.5 shadow-lg">
                <div className="w-full h-full rounded-full bg-stone-900 flex items-center justify-center text-amber-400 font-black text-2xl">
                  {player.name.charAt(0).toUpperCase()}
                </div>
              </div>
              <h4 className="mt-2 text-lg font-black text-amber-100 uppercase tracking-wider text-center truncate max-w-[200px]">
                {player.name}
              </h4>
              <div className="flex gap-1 mt-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${
                      i < player.rating ? 'text-amber-400 fill-amber-400' : 'text-stone-700'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Bottom: 6 Attributes Grid */}
            <div className="relative z-10 border-t border-amber-500/40 pt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-bold text-amber-100">
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{pac}</span>
                <span className="text-stone-400 text-[10px]">RIT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{dri}</span>
                <span className="text-stone-400 text-[10px]">DRI</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{sho}</span>
                <span className="text-stone-400 text-[10px]">FIN</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{def}</span>
                <span className="text-stone-400 text-[10px]">DEF</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{pas}</span>
                <span className="text-stone-400 text-[10px]">PAS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-400 font-mono">{phy}</span>
                <span className="text-stone-400 text-[10px]">CHUR</span>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleDownloadCard}
            className="py-2.5 px-3 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>{isGenerating ? 'Gerando...' : 'Baixar Imagem'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all"
          >
            {sharedFeedback ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{sharedFeedback ? 'WhatsApp Aberto!' : 'Mandar no Zap'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

