/**
 * Sistema de Efeitos Sonoros Nativos do Juiz via Web Audio API.
 * Sintetiza o som de apito profissional de futebol (estilo Fox 40)
 * de forma 100% offline, sem arquivos externos pesados.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return localStorage.getItem('peladapro_sound_enabled') !== 'false';
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('peladapro_sound_enabled', enabled ? 'true' : 'false');
}

/**
 * Sintetiza um silvo de apito com dupla frequência e flutter
 */
function synthesizeWhistleBurst(ctx: AudioContext, startTime: number, duration: number): void {
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const flutter = ctx.createOscillator();
  const flutterGain = ctx.createGain();
  const masterGain = ctx.createGain();

  // Frequências clássicas de apito esportivo (harmonias estridentes)
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(2950, startTime);

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(3250, startTime);

  // Flutter (vibração rápida da bolinha dentro do apito ~25Hz)
  flutter.type = 'sine';
  flutter.frequency.setValueAtTime(26, startTime);
  flutterGain.gain.setValueAtTime(140, startTime);

  flutter.connect(osc1.frequency);
  flutter.connect(osc2.frequency);

  // Envelope sonoro (ataque rápido, corpo e decaimento)
  masterGain.gain.setValueAtTime(0, startTime);
  masterGain.gain.linearRampToValueAtTime(0.28, startTime + 0.03);
  masterGain.gain.setValueAtTime(0.28, startTime + duration - 0.04);
  masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc1.connect(masterGain);
  osc2.connect(masterGain);
  masterGain.connect(ctx.destination);

  flutter.start(startTime);
  osc1.start(startTime);
  osc2.start(startTime);

  flutter.stop(startTime + duration);
  osc1.stop(startTime + duration);
  osc2.stop(startTime + duration);
}

/**
 * Apito simples (Início de jogo ou falta: "PI!")
 */
export function playWhistleShort(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  synthesizeWhistleBurst(ctx, ctx.currentTime, 0.45);
}

/**
 * Apito triplo clássico de fim de jogo ("PI-PI-PIIIII!")
 */
export function playWhistleMatchEnd(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  synthesizeWhistleBurst(ctx, now, 0.22);
  synthesizeWhistleBurst(ctx, now + 0.32, 0.22);
  synthesizeWhistleBurst(ctx, now + 0.65, 0.75);
}

/**
 * Som de moeda no ar e resultado
 */
export function playCoinSound(): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(2400, now + 0.18);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

