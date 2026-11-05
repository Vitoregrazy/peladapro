/**
 * Utilitário de URLs do PeladaPro.
 * Garante que convites compartilhados no WhatsApp e chamadas de API feitas pelo APK nativo
 * sempre utilizem a URL pública oficial na Vercel em vez de http://localhost.
 */

export const PUBLIC_APP_URL =
  'https://peladapro-vitor-hugo-s-projects-d627ca8c.vercel.app';

/**
 * Retorna a URL base correta para compartilhamento público
 */
export function getBaseAppUrl(): string {
  if (typeof window === 'undefined') return PUBLIC_APP_URL;
  const origin = window.location.origin || '';
  if (
    !origin ||
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('capacitor://')
  ) {
    return PUBLIC_APP_URL;
  }
  return origin;
}

/**
 * Gera o link oficial para convidados confirmarem presença direto pelo WhatsApp
 */
export function generateInviteLink(roomCode: string): string {
  const base = getBaseAppUrl();
  const cleanCode = (roomCode || 'SOC-10').trim().toUpperCase();
  return `${base}/?room=${encodeURIComponent(cleanCode)}&mode=checkin`;
}

/**
 * Constrói endpoints de API compatíveis tanto com o APK quanto com a Web
 */
export function buildApiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (typeof window === 'undefined') {
    return `${PUBLIC_APP_URL}${cleanEndpoint}`;
  }
  const origin = window.location.origin || '';
  // No APK nativo, força a chamada para a nuvem oficial
  if (
    origin.includes('localhost') ||
    origin.includes('127.0.0.1') ||
    origin.includes('capacitor://')
  ) {
    return `${PUBLIC_APP_URL}${cleanEndpoint}`;
  }
  return cleanEndpoint;
}

