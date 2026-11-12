import { Capacitor } from '@capacitor/core';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { PUBLIC_APP_URL } from './appUrl';
import {
  OtaManifest,
  appendCacheBuster,
  compareSemver,
  isMandatoryManifest,
  selectBestOtaManifest,
  shouldBlockForMandatoryUpdate,
} from './otaHelpers';

export { compareSemver };

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.2.0';
export const BUILD_DATE = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : '05/11/2026';

export interface OtaStatus {
  checking: boolean;
  updating: boolean;
  blocked: boolean;
  blockingReason?: 'mandatory_update' | 'boot_check';
  progress: number;
  currentVersion: string;
  targetVersion?: string;
  releaseNotes?: string;
  error?: string;
  mandatory?: boolean;
  webServerPending?: boolean;
}

type OtaListener = (status: OtaStatus) => void;

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || PUBLIC_APP_URL
).replace(/\/$/, '');

// Canal OTA principal para APK nativo: arquivos estáticos do GitHub (sem depender do deploy da Vercel)
export const OTA_RAW_BASE_URL = (
  import.meta.env.VITE_OTA_BASE_URL ||
  'https://raw.githubusercontent.com/Vitoregrazy/peladapro/main/public'
).replace(/\/$/, '');

const LOCAL_VERSION_KEY = 'peladapro_ota_installed_version';
const REQUIRED_VERSION_KEY = 'peladapro_ota_required_version';
const REQUIRED_META_KEY = 'peladapro_ota_required_meta';
const WEB_RELOAD_GUARD_KEY = 'peladapro_ota_web_reloaded_version';

async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<{ status: number; data: OtaManifest | null }> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`, {
      method: 'GET',
      cache: 'no-store',
      signal: controller?.signal,
    });
    if (!res.ok) {
      return { status: res.status, data: null };
    }
    const body = await res.text();
    if (!body.trim().startsWith('{')) {
      return { status: res.status, data: null };
    }
    return { status: res.status, data: JSON.parse(body) as OtaManifest };
  } catch {
    return { status: 0, data: null };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

class OtaService {
  private listeners = new Set<OtaListener>();
  private isUpdating = false;
  private pollIntervalId: number | null = null;
  private initialized = false;
  private status: OtaStatus = this.buildInitialStatus();

  private buildInitialStatus(): OtaStatus {
    const currentVersion = this.getInstalledVersion();
    const persisted = this.readPersistedMandatoryUpdate();

    if (persisted && shouldBlockForMandatoryUpdate(currentVersion, persisted.version, true)) {
      return {
        checking: false,
        updating: false,
        blocked: true,
        blockingReason: 'mandatory_update',
        progress: 0,
        currentVersion,
        targetVersion: persisted.version,
        releaseNotes: persisted.releaseNotes,
        mandatory: true,
      };
    }

    // Já estamos rodando na versão igual ou superior: limpa qualquer trava residual
    this.clearPersistedMandatoryUpdate();
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(WEB_RELOAD_GUARD_KEY);
    }

    return {
      checking: false,
      updating: false,
      blocked: false,
      progress: 0,
      currentVersion,
    };
  }

  private readPersistedMandatoryUpdate(): OtaManifest | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const savedVersion = localStorage.getItem(REQUIRED_VERSION_KEY);
      if (!savedVersion) return null;
      const rawMeta = localStorage.getItem(REQUIRED_META_KEY);
      if (rawMeta) {
        const parsed = JSON.parse(rawMeta) as OtaManifest;
        return { ...parsed, version: parsed.version || savedVersion };
      }
      return { version: savedVersion, mandatory: true, forceUpdate: true };
    } catch {
      return null;
    }
  }

  private persistMandatoryUpdate(manifest: OtaManifest) {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(REQUIRED_VERSION_KEY, manifest.version);
      localStorage.setItem(REQUIRED_META_KEY, JSON.stringify(manifest));
    } catch {
      // ignore storage quota errors
    }
  }

  private clearPersistedMandatoryUpdate() {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(REQUIRED_VERSION_KEY);
      localStorage.removeItem(REQUIRED_META_KEY);
    } catch {
      // ignore
    }
  }

  public getInstalledVersion(): string {
    const buildVer = APP_VERSION;
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem(LOCAL_VERSION_KEY);
      if (buildVer && buildVer !== '0.0.0' && saved !== buildVer) {
        localStorage.setItem(LOCAL_VERSION_KEY, buildVer);
      }
    }
    return buildVer;
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

    // 1. Confirma ao plugin nativo que o bundle iniciou sem crash (evita rollback nativo)
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

    // 2. Verifica imediatamente no boot: se online, trava entrada até validar que está na última versão
    const isOnline = typeof navigator === 'undefined' ? true : navigator.onLine;
    if (isOnline && !this.status.blocked) {
      this.emit({
        checking: true,
        blocked: true,
        blockingReason: 'boot_check',
      });
    }

    void this.checkForUpdate(true, true);

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
        void this.checkForUpdate(true);
      });

      // 4. Polling periódico a cada 45 segundos para atualizar APKs/Web em segundo plano
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
   * Botão "Instalar Atualização Agora" na tela de bloqueio obrigatório
   */
  public async retryUpdate(): Promise<{ hasUpdate: boolean; remoteVersion?: string; error?: string }> {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(WEB_RELOAD_GUARD_KEY);
    }
    return this.checkForUpdate(true);
  }

  /**
   * Consulta version.json, impõe bloqueio obrigatório e aplica atualização se houver versão mais nova
   */
  public async checkForUpdate(
    _forceImmediate = false,
    isBootCheck = false
  ): Promise<{ hasUpdate: boolean; remoteVersion?: string; error?: string }> {
    if (this.isUpdating) {
      return { hasUpdate: Boolean(this.status.targetVersion), remoteVersion: this.status.targetVersion };
    }

    const currentVersion = this.getInstalledVersion();

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const persisted = this.readPersistedMandatoryUpdate();
      const stayBlocked = shouldBlockForMandatoryUpdate(currentVersion, persisted?.version, true);
      this.emit({
        checking: false,
        blocked: stayBlocked,
        blockingReason: stayBlocked ? 'mandatory_update' : undefined,
        error: stayBlocked ? 'Sem internet para baixar a atualização obrigatória.' : undefined,
      });
      return {
        hasUpdate: stayBlocked,
        remoteVersion: persisted?.version,
        error: stayBlocked ? 'Sem internet para baixar a atualização obrigatória.' : undefined,
      };
    }

    this.emit({ checking: true, error: undefined });

    const isNative = Capacitor.isNativePlatform();
    const timeoutMs = isBootCheck ? 4000 : 8000;
    const sources = isNative
      ? [`${OTA_RAW_BASE_URL}/version.json`, `${API_BASE_URL}/version.json`, `${API_BASE_URL}/api/version`]
      : [
          typeof window !== 'undefined' && window.location.origin
            ? `${window.location.origin}/version.json`
            : `${API_BASE_URL}/version.json`,
          `${API_BASE_URL}/version.json`,
          `${OTA_RAW_BASE_URL}/version.json`,
        ];

    try {
      const results = await Promise.all(
        sources.map(async (url, index) => ({
          index,
          url,
          ...(await fetchJsonWithTimeout(url, timeoutMs)),
        }))
      );

      const validManifests = results
        .map((r) => r.data)
        .filter((d): d is OtaManifest => Boolean(d && d.version));

      const remote = selectBestOtaManifest(validManifests);

      if (!remote) {
        // Se já existe versão obrigatória salva localmente e menor que a atual, mantém bloqueado
        const persisted = this.readPersistedMandatoryUpdate();
        const stayBlocked = shouldBlockForMandatoryUpdate(currentVersion, persisted?.version, true);
        const lastStatus = results.find((r) => r.status && r.status !== 200)?.status || 0;
        const errorMsg = lastStatus
          ? `Servidor retornou status ${lastStatus}`
          : 'Não foi possível ler o manifesto de atualização.';

        this.emit({
          checking: false,
          blocked: stayBlocked,
          blockingReason: stayBlocked ? 'mandatory_update' : undefined,
          error: stayBlocked ? errorMsg : undefined,
        });
        return { hasUpdate: stayBlocked, remoteVersion: persisted?.version, error: errorMsg };
      }

      const remoteVersion = String(remote.version || '').trim();
      const hasNewer = compareSemver(remoteVersion, currentVersion) > 0;

      if (!hasNewer) {
        this.clearPersistedMandatoryUpdate();
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(WEB_RELOAD_GUARD_KEY);
        }
        this.emit({
          checking: false,
          updating: false,
          blocked: false,
          blockingReason: undefined,
          webServerPending: false,
          error: undefined,
        });
        return { hasUpdate: false, remoteVersion };
      }

      const mandatory = isMandatoryManifest(remote);
      if (mandatory) {
        this.persistMandatoryUpdate(remote);
      }

      // Na Web, verifica se o próprio domínio atual já publicou essa versão ou se ainda está em cache antigo
      const sameOriginManifest = !isNative ? results[0]?.data : null;
      const webOriginReady = isNative
        ? true
        : Boolean(sameOriginManifest?.version && compareSemver(sameOriginManifest.version, remoteVersion) >= 0);

      // Proteção anti-loop na Web: se já recarregou 1x tentando buscar essa versão e o servidor/cache
      // ainda entregou o bundle antigo, NÃO libera o site — mantém a tela de bloqueio obrigatório!
      if (!isNative && typeof sessionStorage !== 'undefined') {
        const alreadyTried = sessionStorage.getItem(WEB_RELOAD_GUARD_KEY);
        if (alreadyTried === remoteVersion || !webOriginReady) {
          this.emit({
            checking: false,
            updating: false,
            blocked: mandatory,
            blockingReason: mandatory ? 'mandatory_update' : undefined,
            targetVersion: remoteVersion,
            releaseNotes: remote.releaseNotes,
            mandatory,
            webServerPending: !webOriginReady,
            error: !webOriginReady
              ? `A nova versão v${remoteVersion} já foi publicada e está aguardando propagação no servidor Web.`
              : `O navegador ainda carregou o cache antigo após recarregar. Limpe o cache ou clique em "Instalar Atualização Agora".`,
          });
          return {
            hasUpdate: true,
            remoteVersion,
            error: 'Atualização obrigatória pendente na Web.',
          };
        }
      }

      console.log(`🚀 [OTA] Nova versão obrigatória detectada! Atual: ${currentVersion} -> Remota: ${remoteVersion}`);
      const applyResult = await this.applyForcedUpdate(
        remoteVersion,
        remote.bundleUrl || remote.bundlePath || '/ota-bundle.zip',
        {
          checksum: remote.checksum,
          releaseNotes: remote.releaseNotes,
          mandatory,
        }
      );

      if (!applyResult.ok) {
        return {
          hasUpdate: true,
          remoteVersion,
          error: applyResult.error || 'Falha ao instalar atualização.',
        };
      }

      return { hasUpdate: true, remoteVersion };
    } catch (err: any) {
      const persisted = this.readPersistedMandatoryUpdate();
      const stayBlocked = shouldBlockForMandatoryUpdate(currentVersion, persisted?.version, true);
      const errorMsg = err?.message || 'Sem conexão com o servidor de atualização';
      console.warn('[OTA] Falha ao consultar version.json:', errorMsg);
      this.emit({
        checking: false,
        blocked: stayBlocked,
        blockingReason: stayBlocked ? 'mandatory_update' : undefined,
        error: stayBlocked ? errorMsg : undefined,
      });
      return { hasUpdate: stayBlocked, error: errorMsg };
    }
  }

  /**
   * Baixa o bundle com verificação SHA-256 checksum e força troca imediata no APK ou Web.
   */
  public async applyForcedUpdate(
    targetVersion: string,
    bundlePath: string,
    options?: { checksum?: string; releaseNotes?: string; mandatory?: boolean }
  ): Promise<{ ok: boolean; error?: string }> {
    if (this.isUpdating) return { ok: false, error: 'Atualização já em andamento.' };
    this.isUpdating = true;

    const mandatory = options?.mandatory ?? true;

    this.emit({
      checking: false,
      updating: true,
      blocked: mandatory,
      blockingReason: mandatory ? 'mandatory_update' : undefined,
      progress: 10,
      targetVersion,
      releaseNotes: options?.releaseNotes,
      mandatory,
      webServerPending: false,
      error: undefined,
    });

    const rawUrl = bundlePath.startsWith('http')
      ? bundlePath
      : `${OTA_RAW_BASE_URL}${bundlePath.startsWith('/') ? '' : '/'}${bundlePath}`;
    const bundleUrl = appendCacheBuster(rawUrl, targetVersion);

    try {
      if (Capacitor.isNativePlatform()) {
        // @capgo/capacitor-updater v8 exige checksum SHA-256 em downloads sem manifest
        const checksum = options?.checksum?.trim();
        if (!checksum) {
          throw new Error('Manifesto OTA sem checksum SHA-256 obrigatório.');
        }

        // Limpa bundles anteriores da mesma versão que não estejam em uso (inclui falhos/parciais)
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
          checksum,
        });

        this.emit({ progress: 98 });
        await new Promise((r) => setTimeout(r, 350));

        // Força a troca imediata e recarrega o WebView para o novo bundle!
        await CapacitorUpdater.set({ id: bundle.id });
        this.isUpdating = false;
        return { ok: true };
      } else {
        // MODO WEB / PWA: Remove service workers e caches e força reload único com cache-buster
        this.emit({ progress: 60 });
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(WEB_RELOAD_GUARD_KEY, targetVersion);
        }
        if ('serviceWorker' in navigator) {
          try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          } catch {
            // ignore
          }
        }
        if ('caches' in window) {
          try {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          } catch {
            // ignore
          }
        }
        this.emit({ progress: 100 });
        await new Promise((r) => setTimeout(r, 250));
        window.location.replace(appendCacheBuster(window.location.pathname, targetVersion));
        return { ok: true };
      }
    } catch (error: any) {
      const errMsg = error?.message || 'Falha ao baixar ou instalar atualização';
      console.error('❌ [OTA] Erro ao aplicar atualização:', error);
      this.isUpdating = false;
      this.emit({
        updating: false,
        checking: false,
        blocked: mandatory,
        blockingReason: mandatory ? 'mandatory_update' : undefined,
        targetVersion,
        releaseNotes: options?.releaseNotes,
        mandatory,
        error: errMsg,
      });
      return { ok: false, error: errMsg };
    }
  }
}

export const otaService = new OtaService();
