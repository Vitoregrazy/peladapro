import { Capacitor } from '@capacitor/core';

export type ShareChannelResult = 'whatsapp' | 'share' | 'clipboard';

/**
 * Abre o WhatsApp diretamente com uma mensagem pré-preenchida e mantém
 * uma cópia silenciosa na área de transferência como garantia.
 *
 * IMPORTANTE: A chamada `window.open` ocorre de forma síncrona dentro do
 * evento de clique para evitar bloqueio de pop-up no navegador e garantir o
 * disparo do Intent do WhatsApp na WebView Android (Capacitor).
 */
export async function openWhatsAppWithText(
  text: string,
  shareTitle = 'PeladaPro — Times Sorteados'
): Promise<ShareChannelResult> {
  // Copia silenciosa em paralelo (sem await antes do window.open)
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    void navigator.clipboard.writeText(text).catch(() => {
      // ignora erro de permissão de área de transferência
    });
  }

  const encoded = encodeURIComponent(text);
  const waUrl = `https://wa.me/?text=${encoded}`;

  if (typeof window !== 'undefined') {
    const opened = window.open(waUrl, '_blank', 'noopener,noreferrer');
    if (opened || Capacitor.isNativePlatform()) {
      return 'whatsapp';
    }
  }

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: shareTitle, text });
      return 'share';
    } catch {
      // fallback final para clipboard
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return 'clipboard';
}

