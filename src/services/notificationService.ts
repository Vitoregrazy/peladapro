import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DrawnTeam } from '../types/pelada';

let isChannelCreated = false;
let notificationTapHandler: ((roomCode?: string) => void) | null = null;

/**
 * Initializes notification permissions and registers notification channels for PeladaPro.
 */
export async function initNotifications(onTap?: (roomCode?: string) => void): Promise<void> {
  if (onTap) {
    notificationTapHandler = onTap;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== 'granted') {
        await LocalNotifications.requestPermissions();
      }

      if (!isChannelCreated) {
        await LocalNotifications.createChannel({
          id: 'peladapro_draws',
          name: 'PeladaPro — Sorteio de Times',
          description: 'Avisos imediatos quando os times da pelada são sorteados',
          importance: 5, // Heads-up high priority popup
          visibility: 1, // Public on lockscreen
          vibration: true,
          lights: true,
          lightColor: '#10B981',
        });
        isChannelCreated = true;
      }

      await LocalNotifications.removeAllListeners();
      await LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
        const targetRoom = action.notification.extra?.roomCode;
        if (notificationTapHandler) {
          notificationTapHandler(targetRoom);
        }
      });
    } catch (err) {
      console.warn('[Notifications] Erro ao inicializar notificações nativas:', err);
    }
  } else if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      if (Notification.permission === 'default') {
        void Notification.requestPermission();
      }
    } catch {
      // Navegador sem suporte ou bloqueado
    }
  }
}

/**
 * Dispatches an instant notification with the PeladaPro official badge and branding
 * when a new draw is detected.
 */
export async function notifyDrawCompleted(
  roomCode: string,
  teams: DrawnTeam[],
  myAthleteName?: string | null
): Promise<void> {
  if (!teams || teams.length === 0) return;

  // Generate an idempotency fingerprint based on room and team roster
  const drawFingerprint = `${roomCode}_${teams.length}_${teams
    .map((t) => `${t.id}-${t.linePlayers.map((p) => p.name).join('')}`)
    .join('_')}`;

  const storageKey = `peladapro_last_notified_${roomCode}`;
  if (typeof window !== 'undefined') {
    const lastNotified = localStorage.getItem(storageKey);
    if (lastNotified === drawFingerprint) {
      // Already notified the user for this exact draw
      return;
    }
    localStorage.setItem(storageKey, drawFingerprint);
  }

  const title = 'PeladaPro ⚽';
  const cleanMyName = (myAthleteName || '').trim().toLowerCase();

  // Find if user is in any of the drawn teams
  const myTeam = cleanMyName
    ? teams.find((t) => {
        const inLine = t.linePlayers.some((p) => p.name.trim().toLowerCase() === cleanMyName);
        const inGk = t.goalkeeper?.name.trim().toLowerCase() === cleanMyName;
        return inLine || inGk;
      })
    : null;

  let body = `Times sorteados na sala ${roomCode}! Toque para conferir a escalação e a ordem de jogo.`;
  if (myTeam) {
    const teammatesCount =
      myTeam.linePlayers.length + (myTeam.goalkeeper ? 1 : 0) - 1;
    body = `Saiu o sorteio! Você caiu no ${myTeam.name} com mais ${teammatesCount} companheiros. Toque para ver seu time!`;
  }

  if (Capacitor.isNativePlatform()) {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() / 1000) % 2147483647,
            title,
            body,
            channelId: 'peladapro_draws',
            smallIcon: 'ic_stat_icon',
            largeIcon: 'ic_launcher',
            iconColor: '#10B981',
            extra: {
              roomCode,
              action: 'open_my_team',
            },
            schedule: {
              at: new Date(Date.now() + 250), // Disparo praticamente imediato
            },
          },
        ],
      });
    } catch (err) {
      console.warn('[Notifications] Falha ao agendar notificação local:', err);
    }
  } else if (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      const webNotif = new Notification(title, {
        body,
        icon: '/logo-192x192.png',
        badge: '/logo-192x192.png',
        tag: 'peladapro-draw',
      });
      webNotif.onclick = () => {
        window.focus();
        if (notificationTapHandler) {
          notificationTapHandler(roomCode);
        }
      };
    } catch {
      // Ignora erro no web notification
    }
  }
}
