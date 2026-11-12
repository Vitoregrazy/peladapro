export interface OtaManifest {
  version: string;
  buildId?: string;
  checksum?: string;
  timestamp?: string;
  forceUpdate?: boolean;
  mandatory?: boolean;
  bundlePath?: string;
  bundleUrl?: string;
  releaseNotes?: string;
}

/**
 * Compara duas versões SemVer (ex: "1.2.6" > "1.2.5" => 1)
 */
export function compareSemver(v1: string, v2: string): number {
  const clean1 = String(v1 || '')
    .replace(/^v/i, '')
    .split('-')[0]
    .trim()
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);
  const clean2 = String(v2 || '')
    .replace(/^v/i, '')
    .split('-')[0]
    .trim()
    .split('.')
    .map((n) => Number.parseInt(n, 10) || 0);

  for (let i = 0; i < 3; i++) {
    const a = clean1[i] || 0;
    const b = clean2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

/**
 * Anexa parâmetros anti-cache sem corromper URLs que já possuem querystring.
 */
export function appendCacheBuster(url: string, version: string, timestamp = Date.now()): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(version)}&t=${timestamp}`;
}

/**
 * Determina se um manifesto exige bloqueio obrigatório até a atualização concluir.
 * Por padrão no PeladaPro, atualizações novas são obrigatórias salvo desativação explícita dupla.
 */
export function isMandatoryManifest(manifest: Partial<OtaManifest> | null | undefined): boolean {
  if (!manifest) return false;
  if (manifest.mandatory === false && manifest.forceUpdate === false) return false;
  return Boolean(manifest.mandatory ?? manifest.forceUpdate ?? true);
}

/**
 * Verifica se a versão atual está bloqueada diante de uma versão remota exigida.
 */
export function shouldBlockForMandatoryUpdate(
  currentVersion: string,
  requiredVersion: string | null | undefined,
  mandatory = true
): boolean {
  if (!mandatory || !requiredVersion) return false;
  return compareSemver(requiredVersion, currentVersion) > 0;
}

/**
 * Seleciona o melhor manifesto válido entre múltiplas fontes (GitHub / Vercel).
 * Prioriza a versão mais alta e, em empate, prefere manifesto com checksum SHA-256 válido.
 */
export function selectBestOtaManifest(candidates: OtaManifest[]): OtaManifest | null {
  const valid = candidates.filter((c) => Boolean(c && typeof c.version === 'string' && c.version.trim()));
  if (valid.length === 0) return null;

  return valid.reduce((best, item) => {
    const cmp = compareSemver(item.version, best.version);
    if (cmp > 0) return item;
    if (cmp === 0 && !best.checksum && Boolean(item.checksum)) return item;
    return best;
  });
}

