import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import AdmZip from 'adm-zip';

const distDir = path.resolve(process.cwd(), 'dist');
const tmpVersionFile = path.resolve(process.cwd(), '.ota-version.tmp');

if (!fs.existsSync(distDir)) {
  console.error('❌ Pasta dist/ não encontrada. Execute vite build primeiro.');
  process.exit(1);
}

// 1. Lê a mesma versão injetada no bundle pelo Vite
let version = `v-${Date.now()}`;
if (fs.existsSync(tmpVersionFile)) {
  try {
    version = fs.readFileSync(tmpVersionFile, 'utf-8').trim();
    fs.unlinkSync(tmpVersionFile);
  } catch {
    // fallback
  }
}

console.log(`📦 [OTA] Empacotando versão ${version}...`);

// 2. Cria o arquivo ZIP com todo o conteúdo de dist/ na raiz do ZIP
const zip = new AdmZip();
const entries = fs.readdirSync(distDir);

for (const entry of entries) {
  if (entry === 'ota-bundle.zip' || entry === 'version.json') continue;
  const fullPath = path.join(distDir, entry);
  const stat = fs.statSync(fullPath);

  if (stat.isDirectory()) {
    zip.addLocalFolder(fullPath, entry);
  } else {
    zip.addLocalFile(fullPath);
  }
}

const zipPath = path.join(distDir, 'ota-bundle.zip');
zip.writeZip(zipPath);

// Calcula SHA-256 do zip para integridade
const zipBuffer = fs.readFileSync(zipPath);
const checksum = crypto.createHash('sha256').update(zipBuffer).digest('hex');

// 3. Gera o dist/version.json e espelha em public/
const versionManifest = {
  version,
  buildId: `${version}-${Date.now()}`,
  checksum,
  timestamp: new Date().toISOString(),
  forceUpdate: true,
  mandatory: true,
  bundlePath: '/ota-bundle.zip',
  bundleUrl: 'https://raw.githubusercontent.com/Vitoregrazy/peladapro/main/public/ota-bundle.zip',
  releaseNotes: 'Atualização oficial PeladaPro: melhorias de estabilidade, sincronização em tempo real e envio para WhatsApp.',
};

fs.writeFileSync(
  path.join(distDir, 'version.json'),
  JSON.stringify(versionManifest, null, 2),
  'utf-8'
);

// Garante que public/ também tenha o bundle e o manifesto para builds e servidor estático
const publicDir = path.resolve(process.cwd(), 'public');
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(
  path.join(publicDir, 'version.json'),
  JSON.stringify(versionManifest, null, 2),
  'utf-8'
);
fs.copyFileSync(zipPath, path.join(publicDir, 'ota-bundle.zip'));

console.log(`✅ [OTA] Pacote gerado com sucesso!`);
console.log(`   -> Versão: ${version}`);
console.log(`   -> Bundle: dist/ota-bundle.zip e public/ota-bundle.zip (${(zipBuffer.length / 1024).toFixed(1)} KB)`);
console.log(`   -> Manifest: dist/version.json e public/version.json`);

