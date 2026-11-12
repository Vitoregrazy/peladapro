import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { API_BASE_URL, OtaStatus, otaService } from '../services/otaService';

export const OtaUpdateOverlay: React.FC = () => {
  const [status, setStatus] = useState<OtaStatus | null>(null);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    void otaService.init();
    const unsubscribe = otaService.subscribe(setStatus);
    return () => unsubscribe();
  }, []);

  if (!status || (!status.updating && !status.blocked)) {
    return null;
  }

  const isBootCheck = status.blockingReason === 'boot_check' && !status.updating;

  const handleRetry = async () => {
    if (retrying || status.updating) return;
    setRetrying(true);
    try {
      await otaService.retryUpdate();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Atualização obrigatória do PeladaPro"
      onClick={(e) => e.stopPropagation()}
      onTouchMove={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/95 backdrop-blur-xl p-5 select-none animate-fadeIn touch-none"
    >
      <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-emerald-500/40 p-6 text-center shadow-2xl shadow-emerald-500/15 space-y-4">
        <div
          className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border ${
            status.error && !status.updating
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
          }`}
        >
          {status.updating || isBootCheck || retrying ? (
            <RefreshCw className="h-8 w-8 animate-spin" />
          ) : (
            <ShieldAlert className="h-8 w-8" />
          )}
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-950/90 border border-slate-800 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-300">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>Atualização Obrigatória</span>
          </div>

          <h3 className="text-lg font-black text-white flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isBootCheck
                ? 'Verificando PeladaPro'
                : status.updating
                  ? 'Atualizando PeladaPro'
                  : 'Atualização Necessária'}
            </span>
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {isBootCheck
              ? 'Validando a versão mais recente antes de liberar o acesso...'
              : status.updating
                ? 'Nova versão obrigatória detectada! Baixando e instalando automaticamente...'
                : 'Para continuar usando o PeladaPro, é obrigatório concluir a atualização para a nova versão.'}
          </p>

          {status.releaseNotes && !isBootCheck && (
            <p className="text-[11px] text-slate-400 bg-slate-950/70 border border-slate-800/80 rounded-xl p-2.5">
              {status.releaseNotes}
            </p>
          )}
        </div>

        {status.updating ? (
          <div className="space-y-2 pt-1">
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-950 border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 ease-out rounded-full"
                style={{ width: `${Math.max(10, status.progress)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>
                v{status.currentVersion} → v{status.targetVersion || 'Nova'}
              </span>
              <span className="font-bold text-emerald-400">{status.progress}%</span>
            </div>
          </div>
        ) : !isBootCheck ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2 text-[11px] font-mono">
              <span className="text-slate-400">Atual: v{status.currentVersion}</span>
              <span className="font-bold text-emerald-400">
                Exigida: v{status.targetVersion || 'Mais recente'}
              </span>
            </div>

            {status.error && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-left text-[11px] text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span className="break-words">{status.error}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleRetry}
              disabled={retrying}
              data-testid="ota-retry-update-btn"
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm py-3 px-4 transition-all active:scale-95 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
              <span>{retrying ? 'Baixando Atualização...' : 'Instalar Atualização Agora'}</span>
            </button>

            <a
              href={`${API_BASE_URL}?v=${encodeURIComponent(status.targetVersion || 'latest')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 text-xs font-semibold py-2.5 px-3 border border-slate-700 transition-all"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Abrir Versão Web</span>
            </a>
          </div>
        ) : null}
      </div>
    </div>
  );
};
