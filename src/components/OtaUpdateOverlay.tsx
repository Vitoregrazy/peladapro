import React, { useEffect, useState } from 'react';
import { otaService, OtaStatus } from '../services/otaService';
import { RefreshCw, Sparkles } from 'lucide-react';

export const OtaUpdateOverlay: React.FC = () => {
  const [status, setStatus] = useState<OtaStatus | null>(null);

  useEffect(() => {
    void otaService.init();
    const unsubscribe = otaService.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  if (!status?.updating) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-md p-6 select-none animate-fadeIn">
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 text-center shadow-2xl shadow-emerald-500/10 space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <RefreshCw className="h-8 w-8 animate-spin" />
        </div>

        <div className="space-y-1">
          <h3 className="text-lg font-black text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>Atualizando PeladaPro</span>
          </h3>
          <p className="text-xs text-slate-300">
            Nova atualização detectada! Instalando melhorias automaticamente sem precisar baixar outro APK...
          </p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 ease-out rounded-full"
              style={{ width: `${Math.max(10, status.progress)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>Versão: {status.targetVersion || 'Mais recente'}</span>
            <span className="font-bold text-emerald-400">{status.progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
};

