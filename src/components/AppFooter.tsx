import React, { useState } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { APP_VERSION, BUILD_DATE, otaService, API_BASE_URL } from '../services/otaService';

interface AppFooterProps {
  roomCode?: string;
}

export const AppFooter: React.FC<AppFooterProps> = ({ roomCode = 'SOC-10' }) => {
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ isError: boolean; text: string } | null>(null);

  const handleManualCheck = async () => {
    if (checking) return;
    setChecking(true);
    setStatusMsg({ isError: false, text: 'Consultando servidor da Vercel...' });

    try {
      const res = await otaService.checkForUpdate(true);
      if (res.error) {
        setStatusMsg({
          isError: true,
          text: `Aviso: ${res.error}`,
        });
        setTimeout(() => setStatusMsg(null), 5000);
      } else if (res.hasUpdate) {
        setStatusMsg({
          isError: false,
          text: `Nova versão v${res.remoteVersion} encontrada! Instalando no aparelho...`,
        });
      } else {
        setStatusMsg({
          isError: false,
          text: `PeladaPro v${APP_VERSION} está 100% atualizado!`,
        });
        setTimeout(() => setStatusMsg(null), 4000);
      }
    } catch (err: any) {
      setStatusMsg({
        isError: true,
        text: err?.message || 'Não foi possível verificar. Verifique sua conexão.',
      });
      setTimeout(() => setStatusMsg(null), 4000);
    } finally {
      setChecking(false);
    }
  };

  return (
    <footer className="mt-8 border-t border-slate-800/80 bg-slate-950/80 py-5 px-4 text-center backdrop-blur-md">
      <div className="mx-auto max-w-md flex flex-col items-center gap-2.5">
        {/* Destacado: Versão Atual do Sistema */}
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-bold text-emerald-400 shadow-sm">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>PeladaPro v{APP_VERSION}</span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-300 font-semibold">Sistema Atualizado</span>
        </div>

        {/* Informações de Compilação & Verificação Manual */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] text-slate-400">
          <span>Build: {BUILD_DATE}</span>
          <span className="text-slate-600">•</span>
          <span>Sala: {roomCode}</span>
        </div>

        <div className="flex items-center gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleManualCheck}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${checking ? 'animate-spin text-emerald-400' : 'text-slate-400'}`}
            />
            <span>{checking ? 'Verificando Nuvem...' : 'Buscar Atualizações OTA'}</span>
          </button>

          <a
            href={API_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 px-3 py-1.5 text-xs font-bold border border-emerald-500/30 transition-all active:scale-95"
            title="Abrir versão Web diretamente no navegador"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Versão Web</span>
          </a>
        </div>

        {/* Feedback de Status */}
        {statusMsg && (
          <div
            className={`text-xs font-bold flex items-center justify-center gap-1.5 pt-1 animate-fadeIn ${
              statusMsg.isError ? 'text-amber-400' : 'text-emerald-400'
            }`}
          >
            {statusMsg.isError ? (
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}
      </div>
    </footer>
  );
};

