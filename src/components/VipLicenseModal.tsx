import React, { useState } from 'react';
import { Check, Copy, KeyRound, Lock, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';
import {
  activateVipLicense,
  generateVipKeyForDevice,
  getLicenseStatus,
  LicenseStatus,
} from '../services/licenseService';

interface VipLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLicenseChanged: () => void;
}

export const VipLicenseModal: React.FC<VipLicenseModalProps> = ({
  isOpen,
  onClose,
  onLicenseChanged,
}) => {
  const [status, setStatus] = useState<LicenseStatus>(() => getLicenseStatus());
  const [inputKey, setInputKey] = useState('');
  const [feedback, setFeedback] = useState<{ isError: boolean; text: string } | null>(null);

  // Painel Secreto do Vitor (Gerador de Chaves)
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [showSecretGenerator, setShowSecretGenerator] = useState(false);
  const [clientDeviceIdInput, setClientDeviceIdInput] = useState('');
  const [generatedClientKey, setGeneratedClientKey] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  if (!isOpen) return null;

  const handleApplyKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    const res = activateVipLicense(inputKey);
    if (res.success) {
      setFeedback({ isError: false, text: res.message });
      setStatus(getLicenseStatus());
      onLicenseChanged();
      setTimeout(() => {
        onClose();
      }, 1500);
    } else {
      setFeedback({ isError: true, text: res.message });
    }
  };

  const handleSecretTap = () => {
    const next = secretTapCount + 1;
    setSecretTapCount(next);
    if (next >= 5) {
      setShowSecretGenerator(true);
      setSecretTapCount(0);
    }
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientDeviceIdInput.trim()) return;
    const key = generateVipKeyForDevice(clientDeviceIdInput);
    setGeneratedClientKey(key);
  };

  const handleCopyGenerated = async () => {
    try {
      await navigator.clipboard.writeText(generatedClientKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } catch {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const openWhatsAppToVitor = () => {
    const msg = encodeURIComponent(
      `Fala Vitor! Quero ativar a versão VIP do PeladaPro para a minha pelada.\nMeu ID de Aparelho é: ${status.deviceId}`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 shadow-2xl animate-slideUp max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleSecretTap}
              className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center active:scale-90 transition-transform"
              title="Toque 5 vezes para abrir o Gerador do Vitor"
            >
              <KeyRound className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-base font-black text-white">Licença & Acesso VIP</h3>
              <p className="text-xs text-slate-400">ID: {status.deviceId}</p>
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

        {/* Status Card */}
        <div
          className={`p-4 rounded-2xl border ${
            status.isVip
              ? 'bg-emerald-500/10 border-emerald-500/40'
              : status.isTrialActive
              ? 'bg-amber-500/10 border-amber-500/40'
              : 'bg-red-500/10 border-red-500/40'
          }`}
        >
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
            {status.isVip ? (
              <>
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Acesso VIP Vitalício Ativo</span>
              </>
            ) : status.isTrialActive ? (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400">Período de Degustação Grátis</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-red-400" />
                <span className="text-red-400">Período de Testes Expirado</span>
              </>
            )}
          </div>

          <div className="text-sm font-semibold text-slate-200 mt-2">
            {status.isVip ? (
              <span>Todas as ferramentas, sorteio furtivo e placares estão 100% liberados.</span>
            ) : status.isTrialActive ? (
              <span>
                Você possui <strong className="text-amber-300">{status.daysRemaining} dias</strong>{' '}
                restantes para testar livremente com a sua galera!
              </span>
            ) : (
              <span>Seus 14 dias de teste gratuito terminaram. Ative sua chave VIP para continuar.</span>
            )}
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-3 rounded-xl text-xs font-bold ${
              feedback.isError
                ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleApplyKey} className="space-y-2.5">
          <label className="block text-xs font-bold text-slate-400">
            Possui uma Chave de Ativação VIP?
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value.toUpperCase())}
              placeholder="Ex: VIP-12345-PRO"
              className="flex-1 px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs uppercase focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition-all active:scale-95"
            >
              Ativar
            </button>
          </div>
        </form>

        {/* WhatsApp Call to Vitor */}
        {!status.isVip && (
          <div className="pt-2">
            <button
              type="button"
              onClick={openWhatsAppToVitor}
              className="w-full py-3 bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span>Chamar Vitor no WhatsApp p/ Liberar Chave</span>
            </button>
          </div>
        )}

        {/* Painel Secreto do Vitor (Gerador de Licenças) */}
        {showSecretGenerator && (
          <div className="p-4 bg-slate-950 border-2 border-amber-500/60 rounded-2xl space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Painel Mestre do Vitor (Gerador)</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSecretGenerator(false)}
                className="text-slate-500 hover:text-white text-xs"
              >
                Ocultar
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Cole o ID do aparelho do seu amigo abaixo para gerar a chave de ativação dele:
            </p>
            <form onSubmit={handleGenerateKey} className="flex gap-2">
              <input
                type="text"
                required
                value={clientDeviceIdInput}
                onChange={(e) => setClientDeviceIdInput(e.target.value.toUpperCase())}
                placeholder="Ex: PELADA-4819"
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-xs focus:border-amber-500 focus:outline-none"
              />
              <button
                type="submit"
                className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl"
              >
                Gerar
              </button>
            </form>

            {generatedClientKey && (
              <div className="p-2.5 bg-slate-900 rounded-xl border border-amber-500/30 flex items-center justify-between gap-2">
                <span className="font-mono font-bold text-amber-300 text-xs">
                  {generatedClientKey}
                </span>
                <button
                  type="button"
                  onClick={handleCopyGenerated}
                  className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded text-[11px] font-bold flex items-center gap-1"
                >
                  {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey ? 'Copiada' : 'Copiar'}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

