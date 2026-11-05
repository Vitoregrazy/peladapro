import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const resPath = path.resolve('android/app/src/main/res');

// High-resolution Vector Logo (1024x1024)
const logoMasterSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#090d16"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#064e3b"/>
    </linearGradient>
    <linearGradient id="shieldBorder" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="shieldInner" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="goldBadge" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
    <linearGradient id="ballShine" x1="20%" y1="20%" x2="80%" y2="80%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Full Icon Background -->
  <rect width="1024" height="1024" rx="220" fill="url(#bgGrad)"/>

  <!-- Field Line Accents -->
  <circle cx="512" cy="512" r="390" fill="none" stroke="#10b981" stroke-width="6" stroke-opacity="0.15" stroke-dasharray="16 12"/>
  <circle cx="512" cy="512" r="160" fill="none" stroke="#10b981" stroke-width="4" stroke-opacity="0.12"/>

  <!-- Outer Shield Glow -->
  <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="none" stroke="#34d399" stroke-width="18" filter="url(#neonGlow)" opacity="0.6"/>

  <!-- Outer Shield Contour -->
  <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="url(#shieldBorder)"/>

  <!-- Inner Shield -->
  <path d="M512 170 L790 265 C790 535 695 725 512 840 C329 725 234 535 234 265 Z" fill="url(#shieldInner)"/>

  <!-- Tactical Pitch Lines inside Shield -->
  <line x1="260" y1="480" x2="764" y2="480" stroke="#10b981" stroke-width="4" stroke-opacity="0.25"/>
  <circle cx="512" cy="480" r="130" fill="none" stroke="#10b981" stroke-width="4" stroke-opacity="0.25"/>
  <path d="M420 810 C420 740 604 740 604 810" fill="none" stroke="#10b981" stroke-width="4" stroke-opacity="0.3"/>

  <!-- Soccer Ball -->
  <circle cx="512" cy="450" r="140" fill="url(#ballShine)"/>
  <!-- Central Pentagon -->
  <polygon points="512,380 592,438 561,532 463,532 432,438" fill="#0f172a"/>
  <!-- Connected Seams -->
  <line x1="512" y1="380" x2="512" y2="310" stroke="#0f172a" stroke-width="10"/>
  <line x1="592" y1="438" x2="650" y2="420" stroke="#0f172a" stroke-width="10"/>
  <line x1="561" y1="532" x2="600" y2="585" stroke="#0f172a" stroke-width="10"/>
  <line x1="463" y1="532" x2="424" y2="585" stroke="#0f172a" stroke-width="10"/>
  <line x1="432" y1="438" x2="374" y2="420" stroke="#0f172a" stroke-width="10"/>
  <!-- Outer Pentagon Patches -->
  <polygon points="512,310 480,314 544,314" fill="#1e293b"/>
  <polygon points="650,420 645,465 652,380" fill="#1e293b"/>
  <polygon points="374,420 379,465 372,380" fill="#1e293b"/>

  <!-- Banner / PRO Badge -->
  <g transform="translate(512, 690)">
    <!-- Shield Banner Box -->
    <rect x="-190" y="-35" width="380" height="70" rx="18" fill="#090d16" stroke="#34d399" stroke-width="4"/>
    <text x="0" y="14" font-family="'Plus Jakarta Sans', 'Arial Black', sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="4">
      PELADA<tspan fill="#34d399">PRO</tspan>
    </text>
  </g>

  <!-- Stars of Excellence -->
  <g fill="#fbbf24">
    <polygon points="512,205 517,219 532,219 520,228 524,242 512,233 500,242 504,228 492,219 507,219"/>
    <polygon points="460,225 464,236 476,236 467,243 470,254 460,247 450,254 453,243 444,236 456,236" transform="scale(0.85) translate(80, 40)"/>
    <polygon points="564,225 568,236 580,236 571,243 574,254 564,247 554,254 557,243 548,236 560,236" transform="scale(0.85) translate(100, 40)"/>
  </g>
</svg>
`;

// Adaptive Icon Foreground (Centered inside safe zone, transparent background)
const adaptiveForegroundSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="fgShieldBorder" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="fgShieldInner" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="fgBallShine" x1="20%" y1="20%" x2="80%" y2="80%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#e2e8f0"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <filter id="fgGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Scaled group to fit within 66% Android safe zone (center 676x676) -->
  <g transform="translate(512, 512) scale(0.72) translate(-512, -512)">
    <!-- Outer Shield Glow -->
    <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="none" stroke="#34d399" stroke-width="18" filter="url(#fgGlow)" opacity="0.6"/>

    <!-- Outer Shield Contour -->
    <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="url(#fgShieldBorder)"/>

    <!-- Inner Shield -->
    <path d="M512 170 L790 265 C790 535 695 725 512 840 C329 725 234 535 234 265 Z" fill="url(#fgShieldInner)"/>

    <!-- Tactical Pitch Lines inside Shield -->
    <line x1="260" y1="480" x2="764" y2="480" stroke="#10b981" stroke-width="4" stroke-opacity="0.25"/>
    <circle cx="512" cy="480" r="130" fill="none" stroke="#10b981" stroke-width="4" stroke-opacity="0.25"/>

    <!-- Soccer Ball -->
    <circle cx="512" cy="450" r="140" fill="url(#fgBallShine)"/>
    <polygon points="512,380 592,438 561,532 463,532 432,438" fill="#0f172a"/>
    <line x1="512" y1="380" x2="512" y2="310" stroke="#0f172a" stroke-width="10"/>
    <line x1="592" y1="438" x2="650" y2="420" stroke="#0f172a" stroke-width="10"/>
    <line x1="561" y1="532" x2="600" y2="585" stroke="#0f172a" stroke-width="10"/>
    <line x1="463" y1="532" x2="424" y2="585" stroke="#0f172a" stroke-width="10"/>
    <line x1="432" y1="438" x2="374" y2="420" stroke="#0f172a" stroke-width="10"/>

    <!-- Banner / PRO Badge -->
    <g transform="translate(512, 690)">
      <rect x="-190" y="-35" width="380" height="70" rx="18" fill="#090d16" stroke="#34d399" stroke-width="4"/>
      <text x="0" y="14" font-family="'Plus Jakarta Sans', 'Arial Black', sans-serif" font-weight="900" font-size="44" fill="#ffffff" text-anchor="middle" letter-spacing="4">
        PELADA<tspan fill="#34d399">PRO</tspan>
      </text>
    </g>

    <!-- Star -->
    <g fill="#fbbf24">
      <polygon points="512,205 517,219 532,219 520,228 524,242 512,233 500,242 504,228 492,219 507,219"/>
    </g>
  </g>
</svg>
`;

// Splash Screen Template Generator (Dynamic dimensions)
function buildSplashSvg(width, height) {
  const isPort = height >= width;
  const crestScale = isPort ? Math.min(width * 0.55, 480) / 1024 : Math.min(height * 0.55, 420) / 1024;
  const centerY = isPort ? height * 0.44 : height * 0.45;
  const titleY = centerY + (isPort ? 240 : 180);
  const subtitleY = titleY + 40;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="splashBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060910"/>
      <stop offset="50%" stop-color="#0b1329"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="spCrestBorder" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="50%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="spCrestInner" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
    <linearGradient id="spBall" x1="20%" y1="20%" x2="80%" y2="80%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#94a3b8"/>
    </linearGradient>
    <filter id="spGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="20" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#splashBg)"/>

  <!-- Subtle Tactical Field Arc in background -->
  <circle cx="${width / 2}" cy="${centerY}" r="${Math.min(width, height) * 0.6}" fill="none" stroke="#10b981" stroke-width="2" stroke-opacity="0.12" stroke-dasharray="12 8"/>

  <!-- Centered Crest Group -->
  <g transform="translate(${width / 2}, ${centerY}) scale(${crestScale}) translate(-512, -512)">
    <!-- Outer Shield Glow -->
    <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="none" stroke="#34d399" stroke-width="24" filter="url(#spGlow)" opacity="0.7"/>
    <path d="M512 140 L825 245 C825 550 720 765 512 885 C304 765 199 550 199 245 Z" fill="url(#spCrestBorder)"/>
    <path d="M512 170 L790 265 C790 535 695 725 512 840 C329 725 234 535 234 265 Z" fill="url(#spCrestInner)"/>

    <!-- Soccer Ball -->
    <circle cx="512" cy="450" r="140" fill="url(#spBall)"/>
    <polygon points="512,380 592,438 561,532 463,532 432,438" fill="#0f172a"/>
    <line x1="512" y1="380" x2="512" y2="310" stroke="#0f172a" stroke-width="10"/>
    <line x1="592" y1="438" x2="650" y2="420" stroke="#0f172a" stroke-width="10"/>
    <line x1="561" y1="532" x2="600" y2="585" stroke="#0f172a" stroke-width="10"/>
    <line x1="463" y1="532" x2="424" y2="585" stroke="#0f172a" stroke-width="10"/>
    <line x1="432" y1="438" x2="374" y2="420" stroke="#0f172a" stroke-width="10"/>

    <!-- Stars -->
    <g fill="#fbbf24">
      <polygon points="512,205 517,219 532,219 520,228 524,242 512,233 500,242 504,228 492,219 507,219"/>
    </g>
  </g>

  <!-- Typography -->
  <text x="${width / 2}" y="${titleY}" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif" font-weight="900" font-size="${isPort ? 34 : 28}" fill="#ffffff" text-anchor="middle" letter-spacing="3">
    PELADA<tspan fill="#34d399">PRO</tspan>
  </text>
  <text x="${width / 2}" y="${subtitleY}" font-family="'Plus Jakarta Sans', 'Segoe UI', sans-serif" font-weight="600" font-size="${isPort ? 13 : 11}" fill="#94a3b8" text-anchor="middle" letter-spacing="2">
    SORTEIO &amp; GESTÃO INTELIGENTE
  </text>
</svg>
`;
}

// Android Mipmap configurations
const mipmaps = [
  { folder: 'mipmap-mdpi', launcher: 48, foreground: 108 },
  { folder: 'mipmap-hdpi', launcher: 72, foreground: 162 },
  { folder: 'mipmap-xhdpi', launcher: 96, foreground: 216 },
  { folder: 'mipmap-xxhdpi', launcher: 144, foreground: 324 },
  { folder: 'mipmap-xxxhdpi', launcher: 192, foreground: 432 },
];

// Android Splash configurations
const splashes = [
  { folder: 'drawable', width: 480, height: 800 },
  { folder: 'drawable-port-mdpi', width: 320, height: 480 },
  { folder: 'drawable-port-hdpi', width: 480, height: 800 },
  { folder: 'drawable-port-xhdpi', width: 720, height: 1280 },
  { folder: 'drawable-port-xxhdpi', width: 960, height: 1600 },
  { folder: 'drawable-port-xxxhdpi', width: 1280, height: 1920 },
  { folder: 'drawable-land-mdpi', width: 480, height: 320 },
  { folder: 'drawable-land-hdpi', width: 800, height: 480 },
  { folder: 'drawable-land-xhdpi', width: 1280, height: 720 },
  { folder: 'drawable-land-xxhdpi', width: 1600, height: 960 },
  { folder: 'drawable-land-xxxhdpi', width: 1920, height: 1280 },
];

async function generateAllAssets() {
  console.log('🎨 Gerando Ícones e Splash Screens nativos do PeladaPro...');

  // 1. Generate Mipmap Icons
  const masterBuffer = Buffer.from(logoMasterSvg);
  const fgBuffer = Buffer.from(adaptiveForegroundSvg);

  for (const m of mipmaps) {
    const dir = path.join(resPath, m.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // ic_launcher.png (Squircle/Arredondado)
    await sharp(masterBuffer)
      .resize(m.launcher, m.launcher)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));

    // ic_launcher_round.png (Circular)
    const circleMask = Buffer.from(
      `<svg width="${m.launcher}" height="${m.launcher}"><circle cx="${m.launcher / 2}" cy="${m.launcher / 2}" r="${m.launcher / 2}" fill="#fff"/></svg>`
    );
    await sharp(masterBuffer)
      .resize(m.launcher, m.launcher)
      .composite([{ input: circleMask, blend: 'dest-in' }])
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));

    // ic_launcher_foreground.png (Adaptive Icon)
    await sharp(fgBuffer)
      .resize(m.foreground, m.foreground)
      .png()
      .toFile(path.join(dir, 'ic_launcher_foreground.png'));

    console.log(`  ✓ ${m.folder} (${m.launcher}x${m.launcher} + ${m.foreground}x${m.foreground})`);
  }

  // 2. Update ic_launcher_background.xml color to dark slate
  const bgXmlPath = path.join(resPath, 'values', 'ic_launcher_background.xml');
  if (fs.existsSync(bgXmlPath)) {
    fs.writeFileSync(
      bgXmlPath,
      `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0F172A</color>\n</resources>\n`
    );
    console.log('  ✓ values/ic_launcher_background.xml atualizado para #0F172A');
  }

  // 3. Generate Splash Screens
  for (const s of splashes) {
    const dir = path.join(resPath, s.folder);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const svg = buildSplashSvg(s.width, s.height);
    await sharp(Buffer.from(svg))
      .resize(s.width, s.height)
      .png()
      .toFile(path.join(dir, 'splash.png'));

    console.log(`  ✓ ${s.folder}/splash.png (${s.width}x${s.height})`);
  }

  console.log('✨ Todos os ícones e Splash Screens foram gerados com sucesso!');
}

generateAllAssets().catch((err) => {
  console.error('Erro gerando assets:', err);
  process.exit(1);
});

