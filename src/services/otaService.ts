import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '05/11/2026';

export interface OtaStatus {
  checking: boolean;
  updating: boolean;
  progress: number;
  currentVersion: string;
  targetVersion?: string;
  error?: string;
  mandatory?: boolean;
}

type OtaListener = (status: OtaStatus) => void;

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://peladapro-vitor-hugo-s-projects-d627ca8c.vercel.app'
).replace(/\/$/, '');

// Canal OTA principal: arquivos estáticos do GitHub (público, sem depender do deploy da Vercel)
export const OTA_RAW_BASE_URL = (
  import.meta.env.VITE_OTA_BASE_URL ||
  'https://raw.githubusercontent.com/Vitoregrazy/peladapro/main/public'
).replace(/\/$/, '');

const OTA_MANIFEST_SOURCES = [
  { url: `${OTA_RAW_BASE_URL}/version.json` },
  { url: `${API_BASE_URL}/version.json` },
];

const LOCAL_VERSION_KEY = 'peladapro_ota_installed_version';

/**
 * Compara duas versões SemVer (ex: "1.2.1" > "1.2.0" => 1)
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = v1.replace(/^v/i, '').trim().split('.').map(Number);
  const clean2 = v2.replace(/^v/i, '').trim().split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

class OtaService {
  private listeners = new Set<OtaListener>();
  private isUpdating = false;
  private pollIntervalId: number | null = null;
  private initialized = false;
  private status: OtaStatus = {
    checking: false,
    updating: false,
    progress: 0,
    currentVersion: this.getInstalledVersion(),
  };

  public getInstalledVersion(): string {
    const saved = localStorage.getItem(LOCAL_VERSION_KEY);
    const buildVer = APP_VERSION;
    if (buildVer && buildVer !== '0.0.0' && saved !== buildVer) {
      localStorage.setItem(LOCAL_VERSION_KEY, buildVer);
      return buildVer;
    }
    return saved || buildVer;
  }

  public subscribe(listener: OtaListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  private emit(partial: Partial<OtaStatus>) {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach((l) => l(this.status));
  }

  /**
   * Inicializa o sistema OTA ao abrir o App
   */
  public async init() {
    if (this.initialized) return;
    this.initialized = true;

    // 1. Confirma ao plugin nativo que o bundle iniciou sem crash (evita rollback nativo de 10s)
    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorUpdater.notifyAppReady();
        console.log(`[OTA] App marcado como Ready nativamente na versão ${APP_VERSION}`);
      } catch (e) {
        console.warn('[OTA] notifyAppReady:', e);
      }

      // Escuta progresso do download do bundle
      try {
        await CapacitorUpdater.addListener('download', (info: any) => {
          if (typeof info?.percent === 'number') {
            this.emit({ progress: Math.min(99, Math.max(5, Math.round(info.percent))) });
          }
        });
      } catch {
        // ignore
      }
    }

    // 2. Verifica imediatamente no boot (com pequeno atraso de 1s para o app renderizar)
    setTimeout(() => {
      void this.checkForUpdate();
    }, 1000);

    // 3. Verifica ao voltar para o aplicativo (visibilidade/foco)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.checkForUpdate();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        void this.checkForUpdate();
      });

      // 4. Polling periódico a cada 45 segundos para atualizar APKs em segundo plano
      if (this.pollIntervalId) window.clearInterval(this.pollIntervalId);
      this.pollIntervalId = window.setInterval(() => {
        void this.checkForUpdate();
      }, 45_000);
    }
  }

  /**
   * Chamado quando o WebSocket recebe { type: 'app:force_update' }
   */
  public async handleRealtimeForceUpdate() {
    console.log('⚡ [OTA] Sinal de atualização forçada recebido em tempo real!');
    await this.checkForUpdate(true);
  }

  /**
   * Consulta o version.json na Vercel e aplica a atualização se houver diferença
   */
  public async checkForUpdate(forceImmediate = false): Promise<{ hasUpdate: boolean; remoteVersion?: string; error?: string }> {
    if (this.isUpdating || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      return { hasUpdate: false };
    }

    this.emit({ checking: true });

    try {
      // Tenta cada fonte de manifesto (GitHub primeiro, Vercel como reserva) até achar um JSON válido
      let text = '';
      let lastStatus = 0;
      for (const base of OTA_MANIFEST_SOURCES) {
        try {
          const res = await fetch(`${base.url}?t=${Date.now()}`, {
            method: 'GET',
            cache: 'no-store',
          });
          lastStatus = res.status;
          if (!res.ok) continue;
          const body = await res.text();
          if (body.trim().startsWith('{')) {
            text = body;
            break;
          }
        } catch {
          // tenta a próxima fonte
        }
      }

      if (!text && lastStatus && lastStatus !== 200) {
        const errorMsg = `Servidor retornou status ${lastStatus}`;
        this.emit({ checking: false, error: errorMsg });
        return { hasUpdate: false, error: errorMsg };
      }

      if (!text.trim().startsWith('{')) {
        const errorMsg = 'Aguardando publicação do deploy na Vercel...';
        console.warn('[OTA] Resposta da Vercel foi HTML e não JSON:', text.slice(0, 80));
        this.emit({ checking: false, error: errorMsg });
        return { hasUpdate: false, error: errorMsg };
      }

      const remote = JSON.parse(text);
      const remoteVersion = String(remote.version || '');
      const currentVersion = this.getInstalledVersion();

      const hasNewer = compareSemver(remoteVersion, currentVersion) > 0;

      // Só atualiza para versões MAIS NOVAS (nunca faz downgrade de um APK mais recente)
      if (!remoteVersion || !hasNewer) {
        this.emit({ checking: false });
        return { hasUpdate: false, remoteVersion };
      }

      console.log(`🚀 [OTA] Nova versão detectada! Atual: ${currentVersion} -> Remota: ${remoteVersion}`);
      await this.applyForcedUpdate(remoteVersion, remote.bundleUrl || remote.bundlePath || '/ota-bundle.zip');
      return { hasUpdate: true, remoteVersion };
    } catch (err: any) {
      const errorMsg = err?.message || 'Sem conexão com o servidor de atualização';
      console.warn('[OTA] Falha ao consultar version.json:', errorMsg);
      this.emit({ checking: false, error: errorMsg });
      return { hasUpdate: false, error: errorMsg };
    }
  }

  /**
   * Baixa o bundle da Vercel e força a troca imediata no APK ou Web
   */
  public async applyForcedUpdate(targetVersion: string, bundlePath: string) {
    if (this.isUpdating) return;
    this.isUpdating = true;

    this.emit({
      checking: false,
      updating: true,
      progress: 10,
      targetVersion,
      mandatory: true,
      error: undefined,
    });

    const bundleUrl = bundlePath.startsWith('http')
      ? `${bundlePath}?v=${targetVersion}&t=${Date.now()}`
      : `${OTA_RAW_BASE_URL}${bundlePath.startsWith('/') ? '' : '/'}${bundlePath}?v=${targetVersion}&t=${Date.now()}`;

    try {
      if (Capacitor.isNativePlatform()) {
        // MODO NATIVO ANDROID: Limpa bundles antigos com a mesma versão antes de baixar
        try {
          const list = await CapacitorUpdater.list();
          const current = await CapacitorUpdater.current();
          if (Array.isArray(list?.bundles)) {
            for (const b of list.bundles) {
              if (b.version === targetVersion && b.id !== current?.bundle?.id) {
                await CapacitorUpdater.delete({ id: b.id });
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('[OTA] Limpeza prévia de bundles:', cleanupErr);
        }

        this.emit({ progress: 25 });
        const bundle = await CapacitorUpdater.download({
          url: bundleUrl,
          version: targetVersion,
        });

        this.emit({ progress: 100 });
        localStorage.setItem(LOCAL_VERSION_KEY, targetVersion);

        // Delay suave de 400ms para feedback visual
        await new Promise((r) => setTimeout(r, 400));

        // Força a troca imediata para o novo bundle baixado!
        await CapacitorUpdater.set({ id: bundle.id });
      } else {
        // MODO WEB / PWA: Limpa caches e força reload
        this.emit({ progress: 60 });
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {
            // ignore
          }
        }
        localStorage.setItem(LOCAL_VERSION_KEY, targetVersion);
        this.emit({ progress: 100 });
        await new Promise((r) => setTimeout(r, 300));
        window.location.replace(`${window.location.pathname}?v=${targetVersion}`);
      }
    } catch (error: any) {
      console.error('❌ [OTA] Erro ao aplicar atualização:', error);
      this.isUpdating = false;
      this.emit({
        updating: false,
        checking: false,
        error: error?.message || 'Falha ao baixar atualização',
      });
    }
  }
}

export const otaService = new OtaService();

