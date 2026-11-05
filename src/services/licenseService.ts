/**
 * Sistema de Licenciamento, Modo Teste (Trial) e Chaves VIP do PeladaPro.
 * Permite que amigos testem o APK por 14 dias grátis antes de cobrar pelo app.
 */

const STORAGE_INSTALL_DATE = 'peladapro_install_date';
const STORAGE_DEVICE_ID = 'peladapro_device_id';
const STORAGE_VIP_LICENSE = 'peladapro_vip_license';
const TRIAL_DURATION_DAYS = 14;

// Chaves Mestras Universais do Vitor
const MASTER_VIP_KEYS = new Set([
  'VITOR-VIP-PRO',
  'PELADA-PRO-2026',
  'PELADA-VIP-PASS',
  'CHAVE-MESTRA-VITOR',
]);

/**
 * Gera um ID único e curto para o dispositivo (ex: PELADA-8421)
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'PELADA-0000';
  let deviceId = localStorage.getItem(STORAGE_DEVICE_ID);
  if (!deviceId) {
    const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
    deviceId = `PELADA-${randomHex}`;
    localStorage.setItem(STORAGE_DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * Algoritmo de geração de Chave VIP para um Device ID específico.
 * Usado pelo Vitor para liberar o app para amigos.
 */
export function generateVipKeyForDevice(deviceId: string): string {
  const clean = deviceId.trim().toUpperCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const code = Math.abs(hash % 90000) + 10000;
  return `VIP-${code}-PRO`;
}

/**
 * Valida se uma Chave VIP é válida (Mestra ou específica do aparelho)
 */
export function validateVipKey(key: string, deviceId: string): boolean {
  const normalized = key.trim().toUpperCase();
  if (MASTER_VIP_KEYS.has(normalized)) return true;
  const expectedKey = generateVipKeyForDevice(deviceId);
  return normalized === expectedKey;
}

export interface LicenseStatus {
  isVip: boolean;
  isTrialActive: boolean;
  isExpired: boolean;
  daysRemaining: number;
  deviceId: string;
  vipKey: string | null;
}

/**
 * Obtém o status atual da licença do usuário
 */
export function getLicenseStatus(): LicenseStatus {
  if (typeof window === 'undefined') {
    return {
      isVip: true,
      isTrialActive: true,
      isExpired: false,
      daysRemaining: 14,
      deviceId: 'PELADA-DEV',
      vipKey: null,
    };
  }

  const deviceId = getOrCreateDeviceId();
  const savedKey = localStorage.getItem(STORAGE_VIP_LICENSE);

  // Se já possui uma chave VIP válida salva
  if (savedKey && validateVipKey(savedKey, deviceId)) {
    return {
      isVip: true,
      isTrialActive: false,
      isExpired: false,
      daysRemaining: 999,
      deviceId,
      vipKey: savedKey,
    };
  }

  // Verifica período de trial
  let installDateStr = localStorage.getItem(STORAGE_INSTALL_DATE);
  if (!installDateStr) {
    installDateStr = String(Date.now());
    localStorage.setItem(STORAGE_INSTALL_DATE, installDateStr);
  }

  const installDate = Number(installDateStr) || Date.now();
  const elapsedMs = Date.now() - installDate;
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, TRIAL_DURATION_DAYS - elapsedDays);
  const isTrialActive = daysRemaining > 0;
  const isExpired = !isTrialActive;

  return {
    isVip: false,
    isTrialActive,
    isExpired,
    daysRemaining,
    deviceId,
    vipKey: null,
  };
}

/**
 * Ativa uma licença VIP no dispositivo
 */
export function activateVipLicense(key: string): { success: boolean; message: string } {
  const deviceId = getOrCreateDeviceId();
  if (validateVipKey(key, deviceId)) {
    localStorage.setItem(STORAGE_VIP_LICENSE, key.trim().toUpperCase());
    return { success: true, message: '🎉 Licença VIP ativada com sucesso!' };
  }
  return {
    success: false,
    message: 'Chave de ativação inválida para este aparelho.',
  };
}

