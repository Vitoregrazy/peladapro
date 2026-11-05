import React, { useRef, useState } from 'react';
import { Award, Download, Share2, Sparkles, Star, Trophy, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { Player } from '../types/pelada';

interface FifaCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  player: Player | null;
  goalsScored?: number;
}

export const FifaCardModal: React.FC<FifaCardModalProps> = ({
  isOpen,
  onClose,
  player,
  goalsScored = 0,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

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

  const handleDownloadCard = async () => {
    if (!cardRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const dataUrl = canvas.toDataURL('image/png');
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
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Cartinha Craque da Pelada', text });
        return;
      } catch {
        // Fallback
      }
    }
    await navigator.clipboard.writeText(text);
    alert('Texto do Craque copiado! Cole no grupo do WhatsApp.');
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
            <Share2 className="w-4 h-4" />
            <span>Mandar no Zap</span>
          </button>
        </div>
      </div>
    </div>
  );
};

