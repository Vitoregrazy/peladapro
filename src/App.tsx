import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Crown,
  DollarSign,
  Download,
  EyeOff,
  FileSpreadsheet,
  KeyRound,
  MessageCircle,
  Play,
  Plus,
  Search,
  Shield,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import {
  Championship,
  CoinTossState,
  DrawnTeam,
  LiveMatchState,
  MatchRules,
  Player,
  RiggingConfig,
  RoomState,
} from './types/pelada';
import {
  createChampionshipFromTeams,
  DEFAULT_RULES,
  drawTeams,
  evaluateMatchStatus,
  exportWhatsAppList,
  INITIAL_PLAYERS,
  isArianIdentity,
  isHostByName,
  resolveHostPlayer,
  sanitizePlayersHostFlag,
  isMuriloIdentity,
  resolveArianVipStatus,
  resolveMuriloVipStatus,
  rotateKingOfTheCourt,
} from './utils/peladaLogic';
import {
  createDefaultCoinToss,
  createDefaultLiveMatch,
  hasDuplicatePlayer,
  normalizeRoomState,
} from './utils/roomState';
import { openWhatsAppWithText } from './utils/whatsappShare';
import { exportPeladaPdf } from './utils/pdfExport';
import { TacticalPitchCard } from './components/TacticalPitchCard';
import { WhatsAppModal } from './components/WhatsAppModal';
import { MatchRefereeView } from './components/MatchRefereeView';
import { ChampionshipView } from './components/ChampionshipView';
import { LiveRoomView } from './components/LiveRoomView';
import { SubTabNavigation } from './components/ui/SubTabNavigation';
import { OtaUpdateOverlay } from './components/OtaUpdateOverlay';
import { GuestCheckinModal } from './components/GuestCheckinModal';
import { PixRateioModal } from './components/PixRateioModal';
import { VipLicenseModal } from './components/VipLicenseModal';
import { FifaCardModal } from './components/FifaCardModal';
import { AppFooter } from './components/AppFooter';
import { buildApiUrl, generateInviteLink } from './services/appUrl';
import { getLicenseStatus, LicenseStatus } from './services/licenseService';
import {
  isSoundEnabled,
  playWhistleMatchEnd,
  setSoundEnabled,
} from './services/soundEffects';
import { OtaStatus, otaService } from './services/otaService';
import { Capacitor } from '@capacitor/core';

type ActiveTab = 'draw' | 'match' | 'tournament' | 'live';
type DrawSubTab = 'players' | 'teams' | 'rules';

const FORMATION_PRESETS = [
  { label: '3+1 (Mini Quadra)', line: 3, gk: 1 },
  { label: '4+1 (Futsal)', line: 4, gk: 1 },
  { label: '5+1 (Society)', line: 5, gk: 1 },
  { label: '6+1 (Society Maior)', line: 6, gk: 1 },
  { label: '7+1 (Fut7)', line: 7, gk: 1 },
  { label: '10+1 (Campo Oficial)', line: 10, gk: 1 },
];

const LOCAL_STORAGE_KEY = 'peladapro_local_state_v2';

interface HydratedState {
  players: Player[];
  drawnTeams: DrawnTeam[];
  rules: MatchRules;
  championship: Championship | null;
  roomCode: string;
  updatedAt: number;
}

function loadInitialState(urlRoomCode?: string | null): HydratedState {
  const requestedRoom = urlRoomCode ? urlRoomCode.toUpperCase().trim() : null;

  if (typeof window === 'undefined') {
    return {
      players: INITIAL_PLAYERS,
      drawnTeams: [],
      rules: DEFAULT_RULES,
      championship: null,
      roomCode: requestedRoom || 'SOC-10',
      updatedAt: 0,
    };
  }

  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const savedRoomCode = String(parsed.roomCode || 'SOC-10').toUpperCase().trim();

      // Se abriu um link de outra sala diferente da salva localmente, não mistura estados
      if (requestedRoom && requestedRoom !== savedRoomCode) {
        return {
          players: [],
          drawnTeams: [],
          rules: DEFAULT_RULES,
          championship: null,
          roomCode: requestedRoom,
          updatedAt: 0,
        };
      }

      const loadedPlayers = sanitizePlayersHostFlag(
        Array.isArray(parsed.players) ? parsed.players : []
      );
      // Se não há jogadores suficientes, nunca exibe times antigos!
      const loadedTeams =
        loadedPlayers.length >= 2 && Array.isArray(parsed.drawnTeams)
          ? parsed.drawnTeams
          : [];
      return {
        players: loadedPlayers,
        drawnTeams: loadedTeams,
        rules: parsed.rules || DEFAULT_RULES,
        championship: parsed.championship ?? null,
        roomCode: requestedRoom || savedRoomCode || 'SOC-10',
        updatedAt: Number(parsed.updatedAt || 0),
      };
    }
  } catch (err) {
    console.warn('[Storage] Falha ao ler estado salvo:', err);
  }

  return {
    players: requestedRoom ? [] : INITIAL_PLAYERS,
    drawnTeams: [],
    rules: DEFAULT_RULES,
    championship: null,
    roomCode: requestedRoom || 'SOC-10',
    updatedAt: 0,
  };
}

export default function App() {
  const initialUrlRoom =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('room')
      : null;
  const initialHydrated = useMemo(() => loadInitialState(initialUrlRoom), [initialUrlRoom]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('draw');
  const [drawSubTab, setDrawSubTab] = useState<DrawSubTab>('players');
  const [players, setPlayers] = useState<Player[]>(initialHydrated.players);
  const [rules, setRules] = useState<MatchRules>(initialHydrated.rules);
  const [drawnTeams, setDrawnTeams] = useState<DrawnTeam[]>(initialHydrated.drawnTeams);
  const stateUpdatedAtRef = useRef<number>(initialHydrated.updatedAt);
  const lastUserMutationAtRef = useRef<number>(0);
  const syncAbortControllerRef = useRef<AbortController | null>(null);

  // Estado OTA global para bloqueio obrigatório até atualizar
  const [otaStatus, setOtaStatus] = useState<OtaStatus | null>(null);
  useEffect(() => {
    void otaService.init();
    return otaService.subscribe(setOtaStatus);
  }, []);

  // License & VIP State (Degustação de 14 dias + Chave VIP)
  const [license, setLicense] = useState<LicenseStatus>(() => getLicenseStatus());
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);
  const [vipSecretOpenOnBoot, setVipSecretOpenOnBoot] = useState(false);
  const [logoTaps, setLogoTaps] = useState(0);

  // Modais de Próximo Nível (Check-in, Rateio Pix, Cartinha FIFA)
  const [isCheckinModalOpen, setIsCheckinModalOpen] = useState(false);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [isFifaCardOpen, setIsFifaCardOpen] = useState(false);
  const [selectedFifaPlayer, setSelectedFifaPlayer] = useState<Player | null>(null);
  const [selectedFifaGoals, setSelectedFifaGoals] = useState<number>(0);
  const [soundActive, setSoundActive] = useState<boolean>(() => isSoundEnabled());

  // Discreet Rigging ("Modo Panela Invisível")
  const [rigging, setRigging] = useState<RiggingConfig>(() => {
    try {
      const saved = localStorage.getItem('pelada_rigging_config');
      if (saved) return JSON.parse(saved);
    } catch { }
    return {
      enabled: false,
      mode: 'top_stars',
      pinnedTeammateIds: ['p-5', 'p-6'],
      excludedRivalIds: [],
      camouflageStars: true,
      includeArianVip: true,
      includeMuriloVip: true,
      arianRotationMode: 'manual',
    };
  });
  const [showDiscreetPanel, setShowDiscreetPanel] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('pelada_rigging_config', JSON.stringify(rigging));
    } catch { }
  }, [rigging]);

  // Double-tap tracker for discreet VIP player toggles (Arian / Murilo)
  const lastPlayerTapRef = useRef<{ [playerId: string]: number }>({});
  const singleTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const togglePlayerPresence = (player: Player) => {
    const next = players.map((p) =>
      p.id === player.id ? { ...p, confirmed: !p.confirmed } : p
    );
    setPlayers(next);
    broadcastSync(
      { players: next },
      `${player.name} ${!player.confirmed ? 'confirmou presença' : 'saiu da lista'}`
    );
  };

  const updateRiggingAndRedraw = (
    updater: RiggingConfig | ((prev: RiggingConfig) => RiggingConfig)
  ) => {
    setRigging((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (drawnTeams.length > 0 && !liveMatch.isRunning) {
        const nextTeams = drawTeams(players, rules, next);
        setDrawnTeams(nextTeams);
        broadcastSync({ drawnTeams: nextTeams });
      }
      return next;
    });
  };

  const handlePlayerNameTap = (player: Player) => {
    const now = Date.now();
    const lastTap = lastPlayerTapRef.current[player.id] || 0;

    if (now - lastTap < 360) {
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      lastPlayerTapRef.current[player.id] = 0;

      if (isArianIdentity(player)) {
        updateRiggingAndRedraw((prev) => ({
          ...prev,
          includeArianVip: !resolveArianVipStatus(prev),
          arianRotationMode: 'manual',
        }));
        try {
          navigator.vibrate?.(45);
        } catch { }
        return;
      }

      if (isMuriloIdentity(player)) {
        updateRiggingAndRedraw((prev) => ({
          ...prev,
          includeMuriloVip: !resolveMuriloVipStatus(prev),
        }));
        try {
          navigator.vibrate?.(45);
        } catch { }
        return;
      }
    } else {
      lastPlayerTapRef.current[player.id] = now;
      if (singleTapTimerRef.current) {
        clearTimeout(singleTapTimerRef.current);
      }
      singleTapTimerRef.current = setTimeout(() => {
        singleTapTimerRef.current = null;
        togglePlayerPresence(player);
      }, 360);
    }
  };

  // New Player Form State & Modal
  const [isAddPlayerModalOpen, setIsAddPlayerModalOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerIsGk, setNewPlayerIsGk] = useState(false);
  const [newPlayerRating, setNewPlayerRating] = useState(4);
  const [rosterFilter, setRosterFilter] = useState<'all' | 'present' | 'line' | 'gk'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeamView, setSelectedTeamView] = useState<'all' | number>('all');

  // WhatsApp Modal & Export Feedback
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [whatsAppModalTab, setWhatsAppModalTab] = useState<'import' | 'export'>('import');
  const [whatsAppExportMode, setWhatsAppExportMode] = useState<'teams' | 'list' | 'link'>('teams');
  const [pdfExported, setPdfExported] = useState(false);
  const [teamsWhatsAppFeedback, setTeamsWhatsAppFeedback] = useState<'whatsapp' | 'copied' | null>(null);

  // Coin Toss State
  const [coinToss, setCoinToss] = useState<CoinTossState>(() =>
    createDefaultCoinToss(initialHydrated.drawnTeams[0]?.id || 'team-1')
  );

  // Live Match Timer & Scoreboard State
  const [liveMatch, setLiveMatch] = useState<LiveMatchState>(() =>
    createDefaultLiveMatch(
      initialHydrated.rules.durationMinutes,
      initialHydrated.drawnTeams[0]?.id || 'team-1',
      initialHydrated.drawnTeams[1]?.id || 'team-2'
    )
  );

  // Championship State
  const [championship, setChampionship] = useState<Championship | null>(
    () =>
      initialHydrated.championship ||
      createChampionshipFromTeams('Copa Society dos Amigos', 'pontos_corridos', drawnTeams)
  );

  // Real-Time WebSocket Room State
  const [roomCode, setRoomCode] = useState<string>(initialHydrated.roomCode);
  const [userName, setUserName] = useState<string>('Vitor (Organizador)');
  const [isWsConnected, setIsWsConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const isApplyingRemoteRef = useRef(false);
  // Snapshot sempre atualizado do estado local, usado pelo polling sem recriar o efeito de conexão
  const latestLocalStateRef = useRef({ players, drawnTeams, rules });
  latestLocalStateRef.current = { players, drawnTeams, rules };

  // Auto-detect Check-in link from WhatsApp (?room=...&mode=checkin)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isCheckin =
        params.get('mode') === 'checkin' ||
        Boolean(params.get('room') && !params.get('admin'));
      if (isCheckin) {
        setIsCheckinModalOpen(true);
      }
    }
  }, []);

  // Connect to WebSocket Room + Vercel Database HTTP Sync Fallback
  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const applyRemoteRoom = (r: RoomState) => {
      const clean = normalizeRoomState(r);
      isApplyingRemoteRef.current = true;
      stateUpdatedAtRef.current = Number(clean.updatedAt || Date.now());
      setRoomState(clean);

      setPlayers(clean.players);
      setRules(clean.rules);
      setDrawnTeams(clean.drawnTeams);
      setCoinToss(clean.coinToss);
      setLiveMatch(clean.liveMatch);
      setChampionship(clean.championship);

      try {
        localStorage.setItem(
          LOCAL_STORAGE_KEY,
          JSON.stringify({
            players: clean.players,
            drawnTeams: clean.drawnTeams,
            rules: clean.rules,
            championship: clean.championship,
            updatedAt: clean.updatedAt || Date.now(),
            roomCode: clean.code || roomCode,
          })
        );
      } catch {
        // ignore
      }

      setTimeout(() => {
        isApplyingRemoteRef.current = false;
      }, 50);
    };

    const pollFallback = () => {
      // Bloqueia polling por 8 segundos após mutação local para não conflitar com edições rápidas
      if (Date.now() - lastUserMutationAtRef.current < 8000) {
        return;
      }

      fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.room) return;
          const serverRoom: RoomState = data.room;
          setIsWsConnected(true);

          const serverUpdated = Number(serverRoom.updatedAt || 0);

          // Só re-hidrata seed vazio do servidor se este dispositivo tiver estado salvo real (updatedAt > 0)
          if (
            serverRoom.isServerSeed ||
            (stateUpdatedAtRef.current > 0 && serverUpdated < stateUpdatedAtRef.current)
          ) {
            if (
              stateUpdatedAtRef.current > 0 &&
              latestLocalStateRef.current.players.length > 0
            ) {
              void fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  roomCode,
                  payload: { ...latestLocalStateRef.current },
                  updatedAt: stateUpdatedAtRef.current,
                }),
              });
            } else if (!serverRoom.isServerSeed && serverRoom.players.length > 0) {
              applyRemoteRoom(serverRoom);
            }
            return;
          }

          // Servidor possui dados mais recentes de outro dispositivo
          if (serverUpdated > stateUpdatedAtRef.current) {
            applyRemoteRoom(serverRoom);
          }
        })
        .catch(() => {
          // Keep offline state
        });
    };

    pollFallback();
    pollTimer = setInterval(pollFallback, 6000);

    const handleVisibilityRefresh = () => {
      if (document.visibilityState === 'visible') {
        pollFallback();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityRefresh);

    const connect = () => {
      // WebSocket só existe no servidor local (server.ts). No APK (localhost do Capacitor)
      // e na Vercel não há endpoint WS: usamos apenas o sync HTTP para não gerar reconexões infinitas.
      const host = window.location.host || '';
      if (Capacitor.isNativePlatform() || host.endsWith('vercel.app')) return;
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${host}/ws`;

        socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          setIsWsConnected(true);
          socket?.send(
            JSON.stringify({
              type: 'room:join',
              roomCode,
              userName,
              role: 'host',
            })
          );
        };

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'room:state' && data.room) {
              applyRemoteRoom(data.room);
            }
            if (data.type === 'app:force_update') {
              void otaService.handleRealtimeForceUpdate();
            }
          } catch {
            // ignore malformed frame
          }
        };

        socket.onclose = () => {
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch {
        // fallback to HTTP Vercel DB sync
      }
    };

    connect();

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityRefresh);
      if (pollTimer) clearInterval(pollTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
    // Depende só da sala: o estado local é lido via latestLocalStateRef
  }, [roomCode]);

  // Persist locally for offline APK resilience
  useEffect(() => {
    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          players,
          rules,
          drawnTeams,
          championship,
          roomCode,
          updatedAt: stateUpdatedAtRef.current,
        })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [players, rules, drawnTeams, championship, roomCode]);

  const broadcastSync = (
    partial: Partial<{
      players: Player[];
      rules: MatchRules;
      drawnTeams: DrawnTeam[];
      coinToss: CoinTossState;
      liveMatch: LiveMatchState;
      championship: Championship | null;
    }>,
    activityText?: string
  ) => {
    if (isApplyingRemoteRef.current) return;
    const now = Date.now();
    stateUpdatedAtRef.current = now;
    lastUserMutationAtRef.current = now;

    const syncPlayers = partial.players ?? players;
    const syncDrawnTeams =
      syncPlayers.length < 2
        ? []
        : partial.drawnTeams !== undefined
          ? partial.drawnTeams
          : drawnTeams;

    const syncPayload = {
      players: syncPlayers,
      rules: partial.rules ?? rules,
      drawnTeams: syncDrawnTeams,
      coinToss: partial.coinToss ?? coinToss,
      liveMatch: partial.liveMatch ?? liveMatch,
      championship:
        partial.championship !== undefined ? partial.championship : championship,
    };

    try {
      localStorage.setItem(
        LOCAL_STORAGE_KEY,
        JSON.stringify({
          players: syncPlayers,
          drawnTeams: syncDrawnTeams,
          rules: syncPayload.rules,
          updatedAt: now,
          roomCode,
        })
      );
    } catch {
      // ignore
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:sync_full',
          payload: syncPayload,
          activityText,
          updatedAt: now,
        })
      );
      return;
    }

    // Cancela requisição HTTP anterior em voo para evitar Race Condition
    if (syncAbortControllerRef.current) {
      syncAbortControllerRef.current.abort();
    }
    const controller = new AbortController();
    syncAbortControllerRef.current = controller;

    // Persist directly to Vercel Database API (/api/rooms/:code)
    void fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        roomCode,
        payload: syncPayload,
        activityText,
        updatedAt: now,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.room) {
          setIsWsConnected(true);
          setRoomState(data.room);
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.warn('[Sync] Offline fallback');
        }
      });
  };

  const handleClearAllPlayers = () => {
    if (
      window.confirm(
        'Iniciar Nova Pelada? Isso removerá todos os atletas da lista e descartará o sorteio anterior.'
      )
    ) {
      setPlayers([]);
      setDrawnTeams([]);
      broadcastSync(
        { players: [], drawnTeams: [], championship: null },
        'Nova Pelada iniciada: lista e times limpos'
      );
    }
  };

  const handleClearDrawnTeams = () => {
    setDrawnTeams([]);
    broadcastSync(
      { drawnTeams: [] },
      'Sorteio anterior descartado'
    );
  };

  // Match Countdown Interval (baseado em relógio real + Screen Wake Lock)
  useEffect(() => {
    if (!liveMatch.isRunning) return;

    let wakeLockSentinel: { release?: () => Promise<void> } | null = null;
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      void (navigator as unknown as { wakeLock?: { request: (type: string) => Promise<any> } })
        .wakeLock?.request('screen')
        .then((sentinel) => {
          wakeLockSentinel = sentinel;
        })
        .catch(() => {
          // dispositivo sem suporte ou permissão
        });
    }

    const interval = setInterval(() => {
      setLiveMatch((prev) => {
        if (!prev.isRunning) return prev;
        const nextSec = prev.timerStartedAt
          ? Math.max(
            0,
            (prev.remainingAtStart ?? prev.remainingSeconds) -
            Math.floor((Date.now() - prev.timerStartedAt) / 1000)
          )
          : Math.max(0, prev.remainingSeconds - 1);

        const evalStatus = evaluateMatchStatus(
          prev.scoreA,
          prev.scoreB,
          nextSec,
          rules.goalLimit
        );

        if (evalStatus.isFinished) {
          playWhistleMatchEnd();
          const winnerTeamId =
            evalStatus.winner === 'A'
              ? prev.teamAId
              : evalStatus.winner === 'B'
                ? prev.teamBId
                : null;
          return {
            ...prev,
            remainingSeconds: nextSec,
            remainingAtStart: nextSec,
            timerStartedAt: null,
            isRunning: false,
            winnerTeamId,
            endedReason: evalStatus.reason,
          };
        }
        return {
          ...prev,
          remainingSeconds: nextSec,
        };
      });
    }, 500);

    return () => {
      clearInterval(interval);
      if (wakeLockSentinel?.release) {
        void wakeLockSentinel.release().catch(() => { });
      }
    };
  }, [liveMatch.isRunning, rules.goalLimit]);

  const applyNewDraw = (
    nextTeams: DrawnTeam[],
    nextPlayers: Player[],
    activityText: string
  ) => {
    setDrawnTeams(nextTeams);

    const nextMatch: LiveMatchState = createDefaultLiveMatch(
      rules.durationMinutes,
      nextTeams[0]?.id || 'team-1',
      nextTeams[1]?.id || 'team-2'
    );
    setLiveMatch(nextMatch);

    const nextChamp = createChampionshipFromTeams(
      championship?.name || 'Copa Society dos Amigos',
      championship?.format || 'pontos_corridos',
      nextTeams
    );
    setChampionship(nextChamp);

    setShowDiscreetPanel(false);
    setSelectedTeamView('all');
    setDrawSubTab('teams');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    broadcastSync(
      {
        players: nextPlayers,
        drawnTeams: nextTeams,
        liveMatch: nextMatch,
        championship: nextChamp,
      },
      activityText
    );
  };

  // Handlers
  const handleExecuteDraw = () => {
    const nextTeams = drawTeams(players, rules, rigging);
    applyNewDraw(
      nextTeams,
      players,
      `Novo sorteio realizado (${rules.linePlayersPerTeam}+${rules.goalkeepersPerTeam})`
    );
  };

  const handleUpdateRules = (nextRules: MatchRules) => {
    const formationChanged =
      nextRules.linePlayersPerTeam !== rules.linePlayersPerTeam ||
      nextRules.goalkeepersPerTeam !== rules.goalkeepersPerTeam;

    setRules(nextRules);

    const updatedTeams =
      formationChanged && drawnTeams.length > 0
        ? drawTeams(players, nextRules, rigging)
        : drawnTeams;

    if (formationChanged && drawnTeams.length > 0) {
      setDrawnTeams(updatedTeams);
    }

    const nextMatch: LiveMatchState = {
      ...liveMatch,
      configuredMinutes: nextRules.durationMinutes,
      remainingSeconds: liveMatch.isRunning
        ? liveMatch.remainingSeconds
        : nextRules.durationMinutes * 60,
      remainingAtStart: liveMatch.isRunning
        ? liveMatch.remainingAtStart
        : nextRules.durationMinutes * 60,
      teamAId: updatedTeams[0]?.id || 'team-1',
      teamBId: updatedTeams[1]?.id || 'team-2',
    };
    setLiveMatch(nextMatch);
    broadcastSync(
      { rules: nextRules, drawnTeams: updatedTeams, liveMatch: nextMatch },
      `Regras alteradas: ${nextRules.linePlayersPerTeam} na linha + ${nextRules.goalkeepersPerTeam} no gol (${nextRules.durationMinutes} min)`
    );
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    const created: Player = {
      id: `p-${Date.now()}`,
      name: newPlayerName.trim(),
      isGoalkeeper: newPlayerIsGk,
      rating: newPlayerRating,
      confirmed: true,
    };
    const nextPlayers = sanitizePlayersHostFlag([created, ...players]);
    setPlayers(nextPlayers);
    setNewPlayerName('');
    setIsAddPlayerModalOpen(false);
    broadcastSync(
      { players: nextPlayers },
      `${created.name} adicionado à lista (${created.isGoalkeeper ? 'Goleiro' : 'Linha'})`
    );
  };

  const handleImportWhatsAppPlayers = (
    imported: Omit<Player, 'id'>[],
    replaceExisting: boolean
  ) => {
    const withIds: Player[] = imported.map((item, idx) => ({
      ...item,
      id: `p-wa-${Date.now()}-${idx}`,
      // Só marca como organizador quem realmente é o Vitor (pelo nome), nunca o 1º da lista
      isHost: !item.isGoalkeeper && isHostByName({ ...item, id: '' } as Player),
    }));

    const nextPlayers = sanitizePlayersHostFlag(
      replaceExisting ? withIds : [...players, ...withIds]
    );
    setPlayers(nextPlayers);
    const nextTeams = drawTeams(nextPlayers, rules, rigging);
    applyNewDraw(
      nextTeams,
      nextPlayers,
      `Lista do WhatsApp importada (${withIds.length} atletas)`
    );
  };

  const handleGuestAddPlayer = async (newPlayer: Player) => {
    lastUserMutationAtRef.current = Date.now();
    const sanitizedNew = sanitizePlayersHostFlag([newPlayer])[0];
    setPlayers((prev) => {
      if (hasDuplicatePlayer(prev, sanitizedNew)) {
        return prev;
      }
      return sanitizePlayersHostFlag([...prev, sanitizedNew]);
    });

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:add_player',
          player: sanitizedNew,
        })
      );
    }

    try {
      const res = await fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action: 'add_player',
          player: sanitizedNew,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.room) {
          stateUpdatedAtRef.current = Number(data.room.updatedAt || Date.now());
          setRoomState(data.room);
        }
      }
    } catch (err) {
      console.error('Falha ao sincronizar novo jogador na nuvem:', err);
    }
  };

  const handleGuestTogglePresence = async (playerId: string) => {
    lastUserMutationAtRef.current = Date.now();
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, confirmed: !p.confirmed } : p))
    );

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'room:toggle_presence',
          playerId,
        })
      );
    }

    try {
      const res = await fetch(buildApiUrl(`/api/rooms/${encodeURIComponent(roomCode)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomCode,
          action: 'toggle_presence',
          playerId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.room) {
          stateUpdatedAtRef.current = Number(data.room.updatedAt || Date.now());
          setRoomState(data.room);
        }
      }
    } catch (err) {
      console.error('Falha ao alternar presença na nuvem:', err);
    }
  };

  const handleToggleHostPlayer = (playerId: string) => {
    const nextPlayers = players.map((p) => ({
      ...p,
      isHost: p.id === playerId,
    }));
    setPlayers(nextPlayers);
    if (drawnTeams.length > 0 && !liveMatch.isRunning) {
      const nextTeams = drawTeams(nextPlayers, rules, rigging);
      setDrawnTeams(nextTeams);
      broadcastSync({ players: nextPlayers, drawnTeams: nextTeams });
    } else {
      broadcastSync({ players: nextPlayers });
    }
  };

  const handleTogglePinTeammate = (playerId: string) => {
    updateRiggingAndRedraw((prev) => {
      const exists = prev.pinnedTeammateIds.includes(playerId);
      const pinnedTeammateIds = exists
        ? prev.pinnedTeammateIds.filter((id) => id !== playerId)
        : [...prev.pinnedTeammateIds, playerId];
      const excludedRivalIds = prev.excludedRivalIds.filter((id) => id !== playerId);
      return {
        ...prev,
        enabled: true,
        mode: 'handpicked',
        pinnedTeammateIds,
        excludedRivalIds,
      };
    });
  };

  const handleToggleExcludeRival = (playerId: string) => {
    updateRiggingAndRedraw((prev) => {
      const exists = prev.excludedRivalIds.includes(playerId);
      const excludedRivalIds = exists
        ? prev.excludedRivalIds.filter((id) => id !== playerId)
        : [...prev.excludedRivalIds, playerId];
      const pinnedTeammateIds = prev.pinnedTeammateIds.filter((id) => id !== playerId);
      return {
        ...prev,
        enabled: true,
        excludedRivalIds,
        pinnedTeammateIds,
      };
    });
  };

  const handleRotateWinnerStays = (winner: 'A' | 'B' | 'draw') => {
    const rotated = rotateKingOfTheCourt(drawnTeams, winner);
    setDrawnTeams(rotated);
    const nextMatch: LiveMatchState = createDefaultLiveMatch(
      rules.durationMinutes,
      rotated[0]?.id || 'team-1',
      rotated[1]?.id || 'team-2'
    );
    setLiveMatch(nextMatch);
    broadcastSync(
      { drawnTeams: rotated, liveMatch: nextMatch },
      `Fila rodou! Em campo: ${rotated[0]?.name} x ${rotated[1]?.name}`
    );
  };

  const handleCreateNewPrivateRoom = async (roomTitle: string, host: string) => {
    try {
      const res = await fetch(buildApiUrl('/api/rooms'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomTitle,
          hostName: host,
          customState: {
            players,
            rules,
            drawnTeams,
            championship,
          },
        }),
      });
      const data = await res.json();
      if (data.room?.code) {
        setUserName(host);
        setRoomCode(data.room.code);
        window.history.replaceState({}, '', `/?room=${data.room.code}`);
      }
    } catch {
      const fallbackCode = `FUT-${Math.floor(100 + Math.random() * 900)}`;
      setRoomCode(fallbackCode);
      window.history.replaceState({}, '', `/?room=${fallbackCode}`);
    }
  };

  const confirmedPlayers = useMemo(() => players.filter((p) => p.confirmed), [players]);
  const confirmedGks = useMemo(
    () => confirmedPlayers.filter((p) => p.isGoalkeeper),
    [confirmedPlayers]
  );
  const confirmedLine = useMemo(
    () => confirmedPlayers.filter((p) => !p.isGoalkeeper),
    [confirmedPlayers]
  );

  const filteredRoster = useMemo(() => {
    return players.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (rosterFilter === 'present') return p.confirmed;
      if (rosterFilter === 'gk') return p.isGoalkeeper;
      if (rosterFilter === 'line') return !p.isGoalkeeper;
      return true;
    });
  }, [players, searchQuery, rosterFilter]);

  const hostPlayer = resolveHostPlayer(players.filter((p) => p.confirmed)) || players.find((p) => p.isHost);

  const handleExportPdf = () => {
    exportPeladaPdf({
      roomCode,
      rules,
      players,
      drawnTeams,
      camouflageStars: rigging.enabled && Boolean(rigging.camouflageStars),
    });
    setPdfExported(true);
    setTimeout(() => setPdfExported(false), 3000);
  };

  const displayedTeams =
    selectedTeamView === 'all'
      ? drawnTeams
      : drawnTeams[selectedTeamView]
        ? [drawnTeams[selectedTeamView]]
        : drawnTeams;

  const isMandatoryOtaLocked = Boolean(
    otaStatus?.updating ||
      (otaStatus?.blocked && otaStatus?.blockingReason === 'mandatory_update')
  );
  const isBootChecking = Boolean(otaStatus?.blocked && otaStatus?.blockingReason === 'boot_check');

  if (isMandatoryOtaLocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <OtaUpdateOverlay />
      </div>
    );
  }

  return (
    <div
      aria-hidden={isBootChecking}
      className={`min-h-screen bg-slate-950 text-slate-100 flex flex-col pb-24 md:pb-12 ${
        isBootChecking ? 'max-h-screen overflow-hidden pointer-events-none select-none' : ''
      }`}
    >
      <OtaUpdateOverlay />
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/90 px-3 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark with Secret 5-Tap VIP Generator + Trial Badge */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = logoTaps + 1;
              setLogoTaps(next);
              if (next >= 5) {
                setVipSecretOpenOnBoot(true);
                setIsVipModalOpen(true);
                setLogoTaps(0);
              }
            }}
            className="text-lg sm:text-xl font-black tracking-tight text-slate-100 whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 transition-transform"
            title="Toque 5x para Gerador Mestre de Chaves"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>PeladaPro</span>
          </button>

          {/* License Badge */}
          <button
            type="button"
            onClick={() => {
              setVipSecretOpenOnBoot(false);
              setIsVipModalOpen(true);
            }}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all active:scale-90 ${license.isVip
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : license.isTrialActive
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-red-500/20 text-red-300 border-red-500/40 animate-pulse'
              }`}
          >
            {license.isVip ? '⭐ VIP' : license.isTrialActive ? `⏱️ ${license.daysRemaining}d` : '🔒 Expirado'}
          </button>
        </div>

        {/* Zone 2: Desktop 4 concise navigation links */}
        <nav
          aria-label="Navegação Principal"
          className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-400"
        >
          <button
            type="button"
            onClick={() => setActiveTab('draw')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'draw'
                ? 'text-emerald-400 border-emerald-400'
                : 'border-transparent'
              }`}
          >
            Sorteio & Elenco
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('match')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'match'
                ? 'text-emerald-400 border-emerald-400'
                : 'border-transparent'
              }`}
          >
            Juiz, Moeda & Tempo
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tournament')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'tournament'
                ? 'text-emerald-400 border-emerald-400'
                : 'border-transparent'
              }`}
          >
            Campeonatos
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`hover:text-slate-100 transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${activeTab === 'live'
                ? 'text-emerald-400 border-emerald-400'
                : 'border-transparent'
              }`}
          >
            Sala Ao Vivo ({roomCode})
          </button>
        </nav>

        {/* Zone 3: Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Sound Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const next = !soundActive;
              setSoundActive(next);
              setSoundEnabled(next);
            }}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title={soundActive ? 'Desativar Som do Apito' : 'Ativar Som do Apito'}
          >
            {soundActive ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Rateio Pix Button */}
          <button
            type="button"
            onClick={() => setIsPixModalOpen(true)}
            className="px-2.5 sm:px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
            title="Dividir quadra e cobrar via Pix"
          >
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Rateio Pix</span>
          </button>

          {/* WhatsApp Button */}
          <button
            type="button"
            onClick={() => {
              setWhatsAppModalTab('import');
              setWhatsAppExportMode('teams');
              setIsWhatsAppOpen(true);
            }}
            className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 hover:bg-emerald-400 rounded-xl transition-all active:scale-95 whitespace-nowrap shrink-0 flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-6 space-y-4 flex-1">
        {/* TAB 1: SORTEIO & ELENCO */}
        {activeTab === 'draw' && (
          <div className="space-y-4">
            {/* SUB-ABAS FIXAS DO SORTEIO */}
            <SubTabNavigation<DrawSubTab>
              activeTab={drawSubTab}
              onChange={setDrawSubTab}
              tabs={[
                {
                  id: 'players',
                  label: 'Jogadores',
                  icon: Users,
                  badge: `${confirmedPlayers.length}/${players.length}`,
                },
                {
                  id: 'teams',
                  label: 'Times Sorteados',
                  icon: Shield,
                  badge: drawnTeams.length > 0 ? drawnTeams.length : undefined,
                  highlight: drawnTeams.length > 0,
                },
                {
                  id: 'rules',
                  label: 'Regras & Formato',
                  icon: SlidersHorizontal,
                  badge: `${rules.linePlayersPerTeam}+${rules.goalkeepersPerTeam}`,
                },
              ]}
            />

            {/* Discreet Rigging Drawer ("Modo Panela Invisível") */}
            {showDiscreetPanel && (
              <section
                aria-label="Configuração de Sorteio Discreto"
                className="bg-slate-900 border border-amber-500/30 rounded-2xl p-4 sm:p-6 space-y-4 animate-slideDown"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-amber-400 font-bold">
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Modo Panela Invisível · Oculto Automaticamente ao Sortear</span>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-100 mt-0.5">
                      Jogar com os Melhores Jogadores Sem Ninguém Saber
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Quando ativado, o sorteio coloca você ({hostPlayer?.name || 'Organizador'}) com os melhores craques, mantendo a aparência de um sorteio 100% equilibrado.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Arian & Murilo Quick Steganographic Toggles */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-300">Arian:</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateRiggingAndRedraw((prev) => ({
                            ...prev,
                            includeArianVip: !resolveArianVipStatus(prev),
                            arianRotationMode: 'manual',
                          }))
                        }
                        className={`text-[10px] font-black px-2 py-0.5 rounded transition-colors ${resolveArianVipStatus(rigging)
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                          }`}
                      >
                        {resolveArianVipStatus(rigging) ? 'Panela .' : 'Outro Time'}
                      </button>

                      <span className="text-[11px] font-bold text-slate-300 ml-1">Murilo:</span>
                      <button
                        type="button"
                        onClick={() =>
                          updateRiggingAndRedraw((prev) => ({
                            ...prev,
                            includeMuriloVip: !resolveMuriloVipStatus(prev),
                          }))
                        }
                        className={`text-[10px] font-black px-2 py-0.5 rounded transition-colors ${resolveMuriloVipStatus(rigging)
                            ? 'bg-emerald-500 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                          }`}
                      >
                        {resolveMuriloVipStatus(rigging) ? 'Panela .' : 'Outro Time'}
                      </button>
                    </div>

                    <label className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={Boolean(rigging.camouflageStars)}
                        onChange={(e) =>
                          setRigging((prev) => ({
                            ...prev,
                            camouflageStars: e.target.checked,
                          }))
                        }
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500"
                      />
                      Camuflar Estrelas (4.2★)
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setRigging((prev) => ({ ...prev, enabled: !prev.enabled }))
                      }
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap active:scale-95 ${rigging.enabled
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-950 text-slate-300 border border-slate-800'
                        }`}
                    >
                      {rigging.enabled
                        ? 'Modo Panela: ATIVADO (Invisível)'
                        : 'Ativar Modo Panela Secreto'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowDiscreetPanel(false)}
                      className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-950 hover:bg-slate-800 text-slate-400 border border-slate-800 whitespace-nowrap"
                    >
                      Fechar
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="font-bold text-slate-200">
                      1. Quem é você na lista?
                    </div>
                    <select
                      aria-label="Selecionar meu jogador"
                      value={hostPlayer?.id || ''}
                      onChange={(e) => handleToggleHostPlayer(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-slate-100"
                    >
                      {players.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.rating}★)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="font-bold text-slate-200">
                      2. Estratégia
                    </div>
                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setRigging((prev) => ({
                            ...prev,
                            enabled: true,
                            mode: 'top_stars',
                          }))
                        }
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${rigging.enabled && rigging.mode === 'top_stars'
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                      >
                        Craques 5★ + Melhor Goleiro
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setRigging((prev) => ({
                            ...prev,
                            enabled: true,
                            mode: 'handpicked',
                          }))
                        }
                        className={`w-full text-left px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${rigging.enabled && rigging.mode === 'handpicked'
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                          }`}
                      >
                        Parceiros Fixos Escolhidos Manualmente
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                    <div className="font-bold text-slate-200">
                      3. Parceiros ({rigging.pinnedTeammateIds.length}) & Evitados ({rigging.excludedRivalIds.length})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
                      {players
                        .filter((p) => !p.isHost)
                        .map((p) => {
                          const isPinned = rigging.pinnedTeammateIds.includes(p.id);
                          const isExcluded = rigging.excludedRivalIds.includes(p.id);
                          return (
                            <div key={p.id} className="inline-flex items-center rounded-lg overflow-hidden border border-slate-800 bg-slate-900">
                              <button
                                type="button"
                                onClick={() => handleTogglePinTeammate(p.id)}
                                className={`px-2 py-1 text-xs ${isPinned
                                    ? 'bg-emerald-950 text-emerald-300 font-bold'
                                    : 'text-slate-400 hover:text-slate-200'
                                  }`}
                              >
                                {isPinned ? '✓ ' : '+ '}
                                {p.name.split(' ')[0]}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleExcludeRival(p.id)}
                                aria-label={`Evitar ${p.name}`}
                                className={`px-1.5 py-1 text-xs border-l border-slate-800 ${isExcluded
                                    ? 'bg-red-950 text-red-300 font-black'
                                    : 'text-slate-500 hover:text-red-400'
                                  }`}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* =========================================================
                SUB-ABA 1.1: LISTA DE JOGADORES & PRESENÇA
            ========================================================= */}
            {drawSubTab === 'players' && (
              <div className="space-y-4">
                {/* Compact Summary Strip + Add Player Button */}
                <div className="flex items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 sm:p-4 rounded-2xl">
                  <div className="flex items-center gap-2 sm:gap-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-1.5 text-center">
                      <span className="block text-base sm:text-lg font-black text-emerald-400 leading-none">
                        {confirmedPlayers.length}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Confirmados
                      </span>
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-1.5 text-center">
                      <span className="block text-base sm:text-lg font-black text-amber-400 leading-none">
                        {confirmedGks.length}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Goleiros
                      </span>
                    </div>

                    <div className="hidden sm:block text-xs text-slate-400">
                      Formato: <strong className="text-slate-200">{rules.linePlayersPerTeam}+{rules.goalkeepersPerTeam}</strong> · {rules.durationMinutes} min
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {players.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllPlayers}
                        className="flex items-center gap-1.5 bg-slate-900 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 text-xs font-bold px-3 py-2.5 rounded-xl active:scale-95 transition-all whitespace-nowrap"
                        title="Limpar todos os jogadores e iniciar nova pelada do zero"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Nova Pelada</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsAddPlayerModalOpen(true)}
                      className="flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 sm:px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4 stroke-[2.5px]" />
                      <span>+ Atleta</span>
                    </button>
                  </div>
                </div>

                {/* Search Bar + Quick Filter Pills */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar jogador por nome..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                    {[
                      { id: 'all', label: `Todos (${players.length})` },
                      { id: 'present', label: `Confirmados (${confirmedPlayers.length})` },
                      { id: 'line', label: `Linha (${players.filter((p) => !p.isGoalkeeper).length})` },
                      { id: 'gk', label: `Goleiros (${players.filter((p) => p.isGoalkeeper).length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setRosterFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${rosterFilter === f.id
                            ? 'bg-slate-200 text-slate-950 shadow'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Fast Roster List */}
                <div className="space-y-2">
                  {filteredRoster.map((player) => {
                    const isGK = player.isGoalkeeper;
                    return (
                      <div
                        key={player.id}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${player.confirmed
                            ? 'bg-slate-900/95 border-emerald-500/40 shadow-sm'
                            : 'bg-slate-950/60 border-slate-800/70 opacity-60'
                          }`}
                      >
                        {/* Tap to Toggle Presence */}
                        <button
                          type="button"
                          onClick={() => {
                            if (isArianIdentity(player) || isMuriloIdentity(player)) {
                              handlePlayerNameTap(player);
                              return;
                            }
                            togglePlayerPresence(player);
                          }}
                          className="flex items-center gap-3 flex-1 text-left min-w-0 py-1"
                        >
                          {player.confirmed ? (
                            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 shrink-0 fill-emerald-500/20" />
                          ) : (
                            <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-slate-600 shrink-0" />
                          )}

                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span
                                className="font-bold text-xs sm:text-sm text-white truncate cursor-pointer select-none py-0.5 pr-1"
                                title={player.name}
                              >
                                {player.name}
                                {isArianIdentity(player) && resolveArianVipStatus(rigging) ? '.' : ''}
                                {isMuriloIdentity(player) && resolveMuriloVipStatus(rigging) ? '.' : ''}
                              </span>
                              {player.isHost && (
                                <Crown
                                  className="w-3.5 h-3.5 text-amber-400 shrink-0"
                                  aria-label="Organizador"
                                />
                              )}
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded uppercase shrink-0 ${isGK
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                    : 'bg-slate-800 text-slate-300'
                                  }`}
                              >
                                {isGK ? 'GOL' : 'LIN'}
                              </span>
                            </div>

                            {/* 1-Click Star Rating Rating Bar */}
                            <div className="flex items-center gap-0.5 mt-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <span
                                  key={star}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = players.map((p) =>
                                      p.id === player.id ? { ...p, rating: star } : p
                                    );
                                    setPlayers(next);
                                    broadcastSync({ players: next });
                                  }}
                                  className="p-0.5 cursor-pointer"
                                  title={`${star} estrelas`}
                                >
                                  <Star
                                    className={`w-3.5 h-3.5 ${star <= player.rating
                                        ? 'text-amber-400 fill-amber-400'
                                        : 'text-slate-700'
                                      }`}
                                  />
                                </span>
                              ))}
                              <span className="text-[11px] font-mono text-slate-400 ml-1 tabular-nums">
                                {player.rating}★
                              </span>
                            </div>
                          </div>
                        </button>

                        {/* Right Role Toggle & Delete Actions */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFifaPlayer(player);
                              setIsFifaCardOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-all active:scale-90"
                            title="Gerar Cartinha EA FC / FIFA"
                          >
                            <Trophy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const next = players.map((p) =>
                                p.id === player.id
                                  ? { ...p, isGoalkeeper: !p.isGoalkeeper }
                                  : p
                              );
                              setPlayers(next);
                              broadcastSync({ players: next });
                            }}
                            className="px-2 py-1 text-[11px] font-semibold rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 transition-colors"
                          >
                            {player.isGoalkeeper ? 'Para Linha' : 'Para o Gol'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const next = players.filter((p) => p.id !== player.id);
                              setPlayers(next);
                              const nextTeams = next.length < 2 ? [] : drawnTeams;
                              setDrawnTeams(nextTeams);
                              setRigging((prev) => ({
                                ...prev,
                                pinnedTeammateIds: prev.pinnedTeammateIds.filter(
                                  (id) => id !== player.id
                                ),
                                excludedRivalIds: prev.excludedRivalIds.filter(
                                  (id) => id !== player.id
                                ),
                              }));
                              broadcastSync(
                                { players: next, drawnTeams: nextTeams },
                                `${player.name} removido da lista`
                              );
                            }}
                            aria-label={`Remover ${player.name}`}
                            className="p-1.5 text-slate-500 hover:text-red-400 active:scale-90 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Floating Bottom Action: Sortear Times */}
                <div className="sticky bottom-16 sm:bottom-4 z-20 pt-2 pb-1 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
                  <button
                    type="button"
                    onClick={handleExecuteDraw}
                    disabled={confirmedPlayers.length < 2}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-sm sm:text-base py-3.5 sm:py-4 rounded-2xl shadow-xl shadow-emerald-500/25 active:scale-98 transition-all"
                  >
                    <Shuffle className="w-5 h-5 stroke-[2.5px]" />
                    <span>SORTEAR TIMES ({confirmedPlayers.length} ATLETAS PRONTOS)</span>
                  </button>
                </div>
              </div>
            )}

            {/* =========================================================
                SUB-ABA 1.2: TIMES SORTEADOS & ESQUEMA TÁTICO
            ========================================================= */}
            {drawSubTab === 'teams' && (
              <div className="space-y-4">
                {drawnTeams.length === 0 ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4 my-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400">
                      <Shield className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-black text-white">
                        Nenhum time sorteado ainda
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        Você tem {confirmedPlayers.length} atletas confirmados na lista prontos para entrar em campo.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleExecuteDraw}
                      className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-6 py-3 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      <Shuffle className="w-4 h-4" />
                      <span>Sortear Times Agora</span>
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Top Action Bar */}
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl space-y-2.5">
                      {/* Primary CTA Row: 1-Tap Send Drawn Teams to WhatsApp */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          data-testid="send-teams-whatsapp-btn"
                          onClick={() => {
                            const inviteUrl = generateInviteLink(roomCode);
                            const text = exportWhatsAppList(players, rules, drawnTeams, inviteUrl);
                            void openWhatsAppWithText(text, 'PeladaPro — Times Sorteados');
                            setTeamsWhatsAppFeedback('whatsapp');
                            setTimeout(() => setTeamsWhatsAppFeedback(null), 2500);
                          }}
                          className="flex-1 px-4 py-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-slate-950 font-black text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-[#25D366]/20"
                        >
                          {teamsWhatsAppFeedback === 'whatsapp' ? (
                            <>
                              <Check className="w-4 h-4 stroke-[2.5px]" />
                              <span>WhatsApp Aberto &amp; Lista Copiada!</span>
                            </>
                          ) : (
                            <>
                              <MessageCircle className="w-4 h-4 stroke-[2.5px]" />
                              <span>Enviar Times no WhatsApp</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={async () => {
                            const inviteUrl = generateInviteLink(roomCode);
                            const text = exportWhatsAppList(players, rules, drawnTeams, inviteUrl);
                            try {
                              await navigator.clipboard?.writeText(text);
                            } catch {
                              // ignore
                            }
                            setTeamsWhatsAppFeedback('copied');
                            setTimeout(() => setTeamsWhatsAppFeedback(null), 2000);
                          }}
                          title="Copiar texto dos times sorteados"
                          className="px-3.5 py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors active:scale-95 shrink-0"
                        >
                          {teamsWhatsAppFeedback === 'copied' ? (
                            <>
                              <Check className="w-4 h-4 text-emerald-400" />
                              <span className="hidden sm:inline">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-4 h-4 text-emerald-400" />
                              <span className="hidden sm:inline">Copiar</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Secondary Controls Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleExecuteDraw}
                            className="px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all active:scale-95"
                          >
                            <Shuffle className="w-3.5 h-3.5" />
                            <span>Refazer Sorteio</span>
                          </button>

                          <button
                            type="button"
                            data-testid="export-pdf-main-btn"
                            onClick={handleExportPdf}
                            className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap active:scale-95"
                          >
                            {pdfExported ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                                <span>PDF Gerado!</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Baixar PDF</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={handleClearDrawnTeams}
                            className="px-3 py-2 bg-slate-950 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 hover:border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap active:scale-95"
                            title="Descartar sorteio e limpar times atuais"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Descartar</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab('match')}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors whitespace-nowrap active:scale-95 border border-slate-700"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Ir para o Juiz</span>
                        </button>
                      </div>
                    </div>

                    {/* Team Filter Pills: "Ver Todos" or specific "Time 1", "Time 2" */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTeamView('all')}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${selectedTeamView === 'all'
                            ? 'bg-slate-100 text-slate-950 shadow'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                          }`}
                      >
                        Ver Todos ({drawnTeams.length})
                      </button>

                      {drawnTeams.map((t, idx) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setSelectedTeamView(idx)}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${selectedTeamView === idx
                              ? 'bg-emerald-500 text-slate-950 shadow'
                              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:text-slate-100'
                            }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: t.accentHex }}
                          />
                          <span>{t.name}</span>
                        </button>
                      ))}
                    </div>

                    {/* Tactical Pitch Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {displayedTeams.map((team, idx) => (
                        <TacticalPitchCard
                          key={team.id}
                          team={team}
                          index={selectedTeamView === 'all' ? idx : Number(selectedTeamView)}
                          rules={rules}
                          camouflageStars={rigging.enabled && Boolean(rigging.camouflageStars)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* =========================================================
                SUB-ABA 1.3: REGRAS DO JOGO & FORMATO
            ========================================================= */}
            {drawSubTab === 'rules' && (
              <div className="space-y-4">
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-slate-100 flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                        Formato & Regras da Pelada
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Defina a quantidade de jogadores, goleiros e tempo
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDiscreetPanel(!showDiscreetPanel)}
                      title="Parâmetros Avançados"
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 transition-colors"
                    >
                      <SlidersHorizontal className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Formation Presets */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-300 block">
                      Escolha Rápida de Modalidade:
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {FORMATION_PRESETS.map((preset) => {
                        const isSelected =
                          rules.linePlayersPerTeam === preset.line &&
                          rules.goalkeepersPerTeam === preset.gk;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              handleUpdateRules({
                                ...rules,
                                linePlayersPerTeam: preset.line,
                                goalkeepersPerTeam: preset.gk,
                              })
                            }
                            className={`px-3 py-2.5 text-xs font-bold rounded-xl border transition-all truncate active:scale-95 ${isSelected
                                ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Steppers */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                      <label htmlFor="input-line-players" className="text-xs text-slate-400 block font-medium">
                        Jogadores na Linha
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          id="input-line-players"
                          type="number"
                          min={1}
                          max={11}
                          value={rules.linePlayersPerTeam}
                          onChange={(e) =>
                            handleUpdateRules({
                              ...rules,
                              linePlayersPerTeam: Math.max(
                                1,
                                Math.min(11, Number(e.target.value) || 5)
                              ),
                            })
                          }
                          className="w-16 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-sm font-bold text-slate-100 tabular-nums text-center"
                        />
                        <span className="text-xs text-slate-400">por time</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                      <label htmlFor="select-gk-per-team" className="text-xs text-slate-400 block font-medium">
                        Goleiro por Time
                      </label>
                      <select
                        id="select-gk-per-team"
                        value={rules.goalkeepersPerTeam}
                        onChange={(e) =>
                          handleUpdateRules({
                            ...rules,
                            goalkeepersPerTeam: Number(e.target.value),
                          })
                        }
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100"
                      >
                        <option value={1}>1 no Gol ({rules.linePlayersPerTeam}+1)</option>
                        <option value={0}>Sem Goleiro Fixo</option>
                      </select>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                      <label htmlFor="input-duration-mins" className="text-xs text-slate-400 block font-medium">
                        Tempo da Partida (min)
                      </label>
                      <div className="flex items-center justify-between gap-2">
                        <input
                          id="input-duration-mins"
                          type="number"
                          min={1}
                          max={90}
                          value={rules.durationMinutes}
                          onChange={(e) =>
                            handleUpdateRules({
                              ...rules,
                              durationMinutes: Math.max(
                                1,
                                Math.min(90, Number(e.target.value) || 10)
                              ),
                            })
                          }
                          className="w-16 px-2.5 py-1 bg-slate-900 border border-slate-800 rounded-lg font-mono text-sm font-bold text-slate-100 tabular-nums text-center"
                        />
                        <span className="text-xs text-slate-400">minutos</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
                      <label htmlFor="select-goal-limit" className="text-xs text-slate-400 block font-medium">
                        Fim por Limite de Gols
                      </label>
                      <select
                        id="select-goal-limit"
                        value={rules.goalLimit ?? 0}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          handleUpdateRules({
                            ...rules,
                            goalLimit: val === 0 ? null : val,
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-semibold text-slate-100"
                      >
                        <option value={1}>1 Gol (Gol de Ouro)</option>
                        <option value={2}>2 Gols (Padrão Society)</option>
                        <option value={3}>3 Gols</option>
                        <option value={4}>4 Gols</option>
                        <option value={5}>5 Gols</option>
                        <option value={0}>Sem Limite de Gols</option>
                      </select>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleExecuteDraw}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Aplicar Regras e Sortear Times</span>
                  </button>
                </section>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: JUIZ, MOEDA & CRONÔMETRO */}
        {activeTab === 'match' && (
          <MatchRefereeView
            drawnTeams={drawnTeams}
            rules={rules}
            onUpdateRules={handleUpdateRules}
            coinToss={coinToss}
            onUpdateCoinToss={(nextToss) => {
              setCoinToss(nextToss);
              broadcastSync(
                { coinToss: nextToss },
                `Sorteio de moeda: deu ${nextToss.result?.toUpperCase()}`
              );
            }}
            liveMatch={liveMatch}
            onUpdateLiveMatch={(nextMatch) => {
              setLiveMatch(nextMatch);
              broadcastSync({ liveMatch: nextMatch });
            }}
            onRotateQueueWinnerStays={handleRotateWinnerStays}
            camouflageStars={rigging.enabled && Boolean(rigging.camouflageStars)}
          />
        )}

        {/* TAB 3: CAMPEONATOS */}
        {activeTab === 'tournament' && (
          <ChampionshipView
            drawnTeams={drawnTeams}
            championship={championship}
            onUpdateChampionship={(nextChamp) => {
              setChampionship(nextChamp);
              broadcastSync(
                { championship: nextChamp },
                `Tabela do campeonato "${nextChamp.name}" atualizada`
              );
            }}
            onSendMatchToReferee={(teamAId, teamBId) => {
              const nextMatch: LiveMatchState = createDefaultLiveMatch(
                rules.durationMinutes,
                teamAId,
                teamBId
              );
              setLiveMatch(nextMatch);
              broadcastSync(
                { liveMatch: nextMatch },
                `Partida enviada para arbitragem`
              );
              setActiveTab('match');
            }}
            onSelectFifaPlayer={(player, goals) => {
              setSelectedFifaPlayer(player);
              setSelectedFifaGoals(goals || 0);
              setIsFifaCardOpen(true);
            }}
          />
        )}

        {/* TAB 4: SALA AO VIVO */}
        {activeTab === 'live' && (
          <LiveRoomView
            roomCode={roomCode}
            userName={userName}
            isConnected={isWsConnected}
            roomState={roomState}
            players={players}
            onJoinRoom={(code, name) => {
              const normalizedCode = (code || 'SOC-10').trim().toUpperCase();
              const normalizedName = (name || 'Atleta').trim();
              setUserName(normalizedName);
              setRoomCode(normalizedCode);
              window.history.replaceState({}, '', `/?room=${normalizedCode}`);
              if (
                normalizedCode === roomCode &&
                wsRef.current &&
                wsRef.current.readyState === WebSocket.OPEN
              ) {
                wsRef.current.send(
                  JSON.stringify({
                    type: 'room:join',
                    roomCode: normalizedCode,
                    userName: normalizedName,
                    role: 'host',
                  })
                );
              }
            }}
            onCreateNewPrivateRoom={handleCreateNewPrivateRoom}
            onAddGuestPlayerToRoom={handleGuestAddPlayer}
            onToggleRoomPlayerPresence={handleGuestTogglePresence}
          />
        )}
      </main>

      {/* Rodapé Oficial Destacado com Versão do Sistema */}
      <AppFooter roomCode={roomCode} />

      {/* Mobile Fixed Bottom Navigation Bar (4 Main Abas) */}
      <nav
        aria-label="Navegação Mobile"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800 grid grid-cols-4 items-center h-16 px-1"
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab('draw');
          }}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold active:scale-95 transition-all ${activeTab === 'draw' ? 'text-emerald-400' : 'text-slate-400'
            }`}
        >
          <Shuffle className="w-5 h-5 mb-0.5" />
          <span>Sorteio</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('match')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold active:scale-95 transition-all ${activeTab === 'match' ? 'text-emerald-400' : 'text-slate-400'
            }`}
        >
          <Clock className="w-5 h-5 mb-0.5" />
          <span>Juiz & Tempo</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tournament')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold active:scale-95 transition-all ${activeTab === 'tournament' ? 'text-emerald-400' : 'text-slate-400'
            }`}
        >
          <Trophy className="w-5 h-5 mb-0.5" />
          <span>Campeonato</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('live')}
          className={`flex flex-col items-center justify-center py-1 text-[11px] font-bold active:scale-95 transition-all ${activeTab === 'live' ? 'text-emerald-400' : 'text-slate-400'
            }`}
        >
          <Wifi className="w-5 h-5 mb-0.5" />
          <span>Ao Vivo</span>
        </button>
      </nav>

      {/* MODAL / BOTTOM SHEET: CADASTRAR NOVO ATLETA */}
      {isAddPlayerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <form
            onSubmit={handleAddPlayer}
            className="w-full max-w-md bg-slate-900 border-t sm:border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 space-y-4 shadow-2xl animate-slideUp"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span>Adicionar Novo Atleta</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddPlayerModalOpen(false)}
                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label htmlFor="modal-player-name" className="block text-xs font-bold text-slate-400 mb-1">
                Nome ou Apelido
              </label>
              <input
                id="modal-player-name"
                type="text"
                autoFocus
                required
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Ex: Romário, Pelé, Cafu..."
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:border-emerald-500 focus:outline-none text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNewPlayerIsGk(false)}
                className={`py-3 rounded-xl font-bold text-xs border transition-colors ${!newPlayerIsGk
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
              >
                Jogador de Linha
              </button>
              <button
                type="button"
                onClick={() => setNewPlayerIsGk(true)}
                className={`py-3 rounded-xl font-bold text-xs border transition-colors ${newPlayerIsGk
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400'
                  }`}
              >
                Goleiro (GOL)
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Nível Técnico ({newPlayerRating} Estrelas)
              </label>
              <div className="flex justify-between bg-slate-950 border border-slate-800 rounded-xl p-2.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewPlayerRating(star)}
                    className="p-1.5"
                  >
                    <Star
                      className={`w-7 h-7 ${star <= newPlayerRating
                          ? 'text-amber-400 fill-amber-400'
                          : 'text-slate-700'
                        }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
            >
              Adicionar e Confirmar Presença
            </button>
          </form>
        </div>
      )}

      {/* WhatsApp Import/Export Modal */}
      <WhatsAppModal
        isOpen={isWhatsAppOpen}
        onClose={() => setIsWhatsAppOpen(false)}
        players={players}
        rules={rules}
        drawnTeams={drawnTeams}
        onImportPlayers={handleImportWhatsAppPlayers}
        onExportPdf={handleExportPdf}
        roomCode={roomCode}
        initialTab={whatsAppModalTab}
        initialExportMode={whatsAppExportMode}
      />

      {/* Guest Check-in Modal (Link direto do WhatsApp) */}
      <GuestCheckinModal
        isOpen={isCheckinModalOpen}
        onClose={() => setIsCheckinModalOpen(false)}
        roomCode={roomCode}
        roomName={roomState?.name}
        players={players}
        onAddPlayer={handleGuestAddPlayer}
        onTogglePresence={handleGuestTogglePresence}
      />

      {/* Modal Rateio Pix & Cobrança da Quadra */}
      <PixRateioModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        players={players}
      />

      {/* Modal Licença, Degustação & Gerador VIP do Vitor */}
      <VipLicenseModal
        isOpen={isVipModalOpen}
        onClose={() => {
          setIsVipModalOpen(false);
          setVipSecretOpenOnBoot(false);
        }}
        onLicenseChanged={() => setLicense(getLicenseStatus())}
        rigging={rigging}
        onRiggingChange={updateRiggingAndRedraw}
        initialSecretOpen={vipSecretOpenOnBoot}
      />

      {/* Modal Cartinha EA FC / FIFA Craque do Jogo */}
      <FifaCardModal
        isOpen={isFifaCardOpen}
        onClose={() => {
          setIsFifaCardOpen(false);
          setSelectedFifaPlayer(null);
          setSelectedFifaGoals(0);
        }}
        player={selectedFifaPlayer}
        goalsScored={selectedFifaGoals}
      />
    </div>
  );
}
