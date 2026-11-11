import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const run = (cmd) => {
  console.log(`\n▶️  Executando: ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
};

try {
  console.log('====================================================');
  console.log('🚀 INICIANDO DEPLOY OTA FORÇADO - PELADAPRO');
  console.log('====================================================');

  // 1. Gera o build do Vite + dist/version.json + dist/ota-bundle.zip
  run('npm run build');

  const versionPath = path.resolve(process.cwd(), 'dist', 'version.json');
  let version = 'latest';
  if (fs.existsSync(versionPath)) {
    const data = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
    version = data.version || 'latest';
  }

  // 2. Dispara sinal de atualização em tempo real se houver servidor online
  const apiUrl = process.env.VITE_API_BASE_URL || 'https://peladapro-vitor-hugo-s-projects-d627ca8c.vercel.app';
  console.log(`\n📡 Notificando servidor em ${apiUrl}...`);

  try {
    const res = await fetch(`${apiUrl}/api/ota/force-broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version }),
    });
    if (res.ok) {
      console.log('⚡ Sinal de force_update transmitido para os APKs conectados!');
    }
  } catch {
    // offline / standalone
  }

  console.log('\n====================================================');
  console.log(`✅ PACOTE OTA GERADO COM SUCESSO! (Versão: ${version})`);
  console.log('📱 Todos os APKs instalados nos celulares atualizarão sozinhos:');
  console.log('   - No próximo boot do app');
  console.log('   - Ao voltar do segundo plano (minimizar/abrir)');
  console.log('   - A cada 45 segundos enquanto estiver aberto');
  console.log('====================================================\n');
} catch (err) {
  console.error('\n❌ Erro durante o Deploy OTA:', err.message);
  process.exit(1);
}

