import { create } from 'zustand';
import {
  kindOfTile,
  meldKind,
  type Meld,
  type RuleSettings,
  type Seat,
  type TileId,
} from '@cheongiwa/engine';
import type {
  AccountView,
  AuthWelcome,
  EmoteShowView,
  RankView,
  RewardsView,
  SeatProfileView,
  ShopSlot,
  WalletView,
  ChoicesView,
  GameEndView,
  GameSnapshotView,
  GameStartView,
  PublicGameEvent,
  QueueStateView,
  RoomStateView,
  RoundResultView,
  RoundStartView,
  ServerErrorView,
} from '@cheongiwa/protocol';
import { getSocket } from '../net/socket';
import { describeEvent } from './eventText';
import { playSfx, setMuted, setVolume } from '../audio/sfx';
import type { AnnounceItem } from '../effects/Announce';
import type { EmoteBalloon } from '../effects/EmoteBubble';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';
export type Screen = 'auth' | 'lobby' | 'room' | 'game';

/** 좌석 공개 뷰 (로컬 미러 — 은닉 정보 없음) */
export interface SeatView {
  seat: Seat;
  nickname: string;
  isBot: boolean;
  connected: boolean;
  score: number;
  discards: Array<{ tileId: TileId; riichi: boolean; calledBy: Seat | null; tsumogiri: boolean }>;
  melds: Meld[];
  riichi: { double: boolean; accepted: boolean } | null;
  hasDrawn: boolean;
}

export interface LocalGame {
  gameId: string;
  mySeat: Seat;
  seedHash: string;
  rules: RuleSettings;
  players: Array<{ seat: Seat; nickname: string; isBot: boolean }>;
  /** 좌석별 등급·장착 코스메틱 (표시 전용) */
  profiles: SeatProfileView[];
  round: RoundStartView;
  seats: SeatView[];
  myHand: TileId[];
  myDrawn: TileId | null;
  activeSeat: Seat;
  phase: 'turn' | 'reaction' | 'ended';
  choices: ChoicesView | null;
  /** 국 결과 표시 중 (다음 국까지) */
  roundResult: RoundResultView | null;
  eventLog: string[];
  /** 마지막으로 표시했던 국 결과 (복기용) */
  lastResult: RoundResultView | null;
}

export interface FillOffer {
  decideMs: number;
}

interface GameStore {
  connection: ConnectionStatus;
  serverProtocol: number | null;
  screen: Screen;
  error: { code: string; message: string } | null;

  // 인증·전적
  userId: string | null;
  nickname: string;
  stats: AuthWelcome['stats'] | null;
  /** 로그인한 계정. null이면 게스트 (§3.1) */
  account: AccountView | null;
  /** 가입·복구 직후 한 번만 받는 복구 코드 — 사용자가 적어 두면 지운다 */
  recoveryCode: string | null;
  accountOpen: boolean;

  // 로비/매칭
  queue: QueueStateView | null;
  fillOffer: FillOffer | null;

  // 방
  room: RoomStateView | null;

  // 대국
  game: LocalGame | null;
  gameEnd: GameEndView | null;

  // 엽전 경제·등급 (§6)
  wallet: WalletView | null;
  rank: RankView | null;
  /** 방금 지급된 보상 (플로팅 표시 후 해제) */
  rewards: RewardsView | null;
  shopOpen: boolean;
  /** 좌석별로 지금 떠 있는 이모티콘 (§7 이모티콘 소통) */
  emotes: Record<number, EmoteBalloon | undefined>;
  emotesMuted: boolean;

  // 설정
  auto: { autoWin: boolean; autoSkipCalls: boolean; autoTsumogiri: boolean };
  hints: boolean;
  /** 연출 간소화 (§4.5) */
  simplified: boolean;
  sound: { muted: boolean; volume: number };

  /** 화면 중앙 선언 연출 큐 */
  announces: AnnounceItem[];

  setShopOpen(open: boolean): void;
  setAccountOpen(open: boolean): void;
  clearRecoveryCode(): void;
  clearRewards(): void;
  /** 내가 장착한 코스메틱 (없으면 기본값) */
  equipped(slot: ShopSlot): string | undefined;
  sendEmote(itemId: string): void;
  setEmotesMuted(v: boolean): void;
  setAuto(next: Partial<GameStore['auto']>): void;
  toggleHints(): void;
  toggleSimplified(): void;
  setSound(next: Partial<GameStore['sound']>): void;
  dismissError(): void;
  clearGameEnd(): void;
}

const PREFS_KEY = 'cheongiwa.prefs';

interface StoredPrefs {
  hints?: boolean;
  simplified?: boolean;
  muted?: boolean;
  volume?: number;
  emotesMuted?: boolean;
}

function loadPrefs(): StoredPrefs {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as StoredPrefs;
  } catch {
    return {};
  }
}

function savePrefs(p: StoredPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // 저장 실패는 무시 (프라이빗 모드 등)
  }
}

const emptyAuto = { autoWin: false, autoSkipCalls: false, autoTsumogiri: false };

const seatsFromRound = (
  round: RoundStartView,
  players: LocalGame['players'],
  prev?: SeatView[],
): SeatView[] =>
  players.map((p) => ({
    seat: p.seat,
    nickname: p.nickname,
    isBot: p.isBot,
    connected: prev?.find((s) => s.seat === p.seat)?.connected ?? true,
    score: round.scores[p.seat] ?? 0,
    discards: [],
    melds: [],
    riichi: null,
    hasDrawn: false,
  }));

const prefs = loadPrefs();
setMuted(prefs.muted ?? false);
setVolume(prefs.volume ?? 0.6);

export const useGame = create<GameStore>((set, get) => ({
  connection: 'connecting',
  serverProtocol: null,
  screen: 'auth',
  error: null,
  userId: null,
  nickname: '',
  stats: null,
  account: null,
  recoveryCode: null,
  accountOpen: false,
  queue: null,
  fillOffer: null,
  room: null,
  game: null,
  gameEnd: null,
  wallet: null,
  rank: null,
  rewards: null,
  shopOpen: false,
  emotes: {},
  emotesMuted: prefs.emotesMuted ?? false,
  auto: { ...emptyAuto },
  hints: prefs.hints ?? true,
  simplified: prefs.simplified ?? false,
  sound: { muted: prefs.muted ?? false, volume: prefs.volume ?? 0.6 },
  announces: [],

  setAccountOpen(open) {
    set({ accountOpen: open, error: null });
  },

  clearRecoveryCode() {
    set({ recoveryCode: null });
  },

  setShopOpen(open) {
    set({ shopOpen: open });
  },
  clearRewards() {
    set({ rewards: null });
  },
  equipped(slot) {
    return get().wallet?.loadout[slot];
  },
  sendEmote(itemId) {
    getSocket().emit('emote.send', { itemId });
  },
  setEmotesMuted(v) {
    set({ emotesMuted: v });
    savePrefs({ ...loadPrefs(), emotesMuted: v });
  },
  setAuto(next) {
    const auto = { ...get().auto, ...next };
    set({ auto });
    getSocket().emit('settings.auto', auto);
  },
  toggleHints() {
    const hints = !get().hints;
    set({ hints });
    savePrefs({ ...loadPrefs(), hints });
  },
  toggleSimplified() {
    const simplified = !get().simplified;
    set({ simplified });
    savePrefs({ ...loadPrefs(), simplified });
  },
  setSound(next) {
    const sound = { ...get().sound, ...next };
    set({ sound });
    setMuted(sound.muted);
    setVolume(sound.volume);
    savePrefs({ ...loadPrefs(), muted: sound.muted, volume: sound.volume });
  },
  dismissError() {
    set({ error: null });
  },
  clearGameEnd() {
    set({ gameEnd: null, game: null, screen: 'lobby', auto: { ...emptyAuto }, announces: [] });
  },
}));

// ── 선언 연출 큐 ────────────────────────────────────────────────
let announceSeq = 0;

/** 화면 중앙에 큰 글자를 띄운다 (자동 소멸) */
function pushAnnounce(kind: AnnounceItem['kind'], text: string, from: AnnounceItem['from']): void {
  const id = ++announceSeq;
  useGame.setState((s) => ({ announces: [...s.announces, { id, kind, text, from }] }));
  const ttl = useGame.getState().simplified ? 380 : 1100;
  setTimeout(() => {
    useGame.setState((s) => ({ announces: s.announces.filter((a) => a.id !== id) }));
  }, ttl);
}

const MELD_ANNOUNCE: Record<string, string> = {
  chi: '치',
  pon: '퐁',
  daiminkan: '깡',
  shouminkan: '깡',
  ankan: '깡',
};

// ── 이벤트 리듀서 헬퍼 ──────────────────────────────────────────────

function applyPublicEvent(game: LocalGame, event: PublicGameEvent): LocalGame {
  const seats = game.seats.map((s) => ({ ...s, discards: [...s.discards], melds: [...s.melds] }));
  const at = (seat: Seat): SeatView => seats[seat] as SeatView;
  let myHand = game.myHand;
  let myDrawn = game.myDrawn;
  let round = game.round;

  switch (event.type) {
    case 'roundStart':
      return {
        ...game,
        round: event.info,
        seats: seatsFromRound(event.info, game.players, game.seats).map((s) => ({
          ...s,
          score: event.info.scores[s.seat] ?? s.score,
        })),
        myHand: [],
        myDrawn: null,
        activeSeat: event.info.dealer,
        phase: 'turn',
        choices: null,
        roundResult: null,
        eventLog: [describeEvent(event, game.players), ...game.eventLog].slice(0, 60),
      };

    case 'draw':
      at(event.seat).hasDrawn = true;
      round = { ...round, liveRemaining: event.liveRemaining };
      return {
        ...game,
        round,
        seats,
        activeSeat: event.seat,
        phase: 'turn',
        eventLog: game.eventLog, // 쯔모는 로그에 남기지 않음 (소음)
      };

    case 'discard': {
      const seat = at(event.seat);
      seat.hasDrawn = false;
      seat.discards.push({
        tileId: event.tileId,
        riichi: event.riichi,
        calledBy: null,
        tsumogiri: event.tsumogiri,
      });
      if (event.seat === game.mySeat) {
        if (myDrawn === event.tileId) {
          myDrawn = null;
        } else {
          myHand = myHand.filter((t) => t !== event.tileId);
          if (myDrawn !== null) {
            myHand = [...myHand, myDrawn].sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b);
            myDrawn = null;
          }
        }
      }
      break;
    }

    case 'call': {
      const seat = at(event.seat);
      if (event.meld.type === 'shouminkan') {
        const kind = meldKind(event.meld);
        seat.melds = seat.melds.map((m) =>
          m.type === 'pon' && meldKind(m) === kind ? event.meld : m,
        );
        if (event.seat === game.mySeat) {
          const added = event.meld.addedTileId;
          if (myDrawn === added) myDrawn = null;
          else myHand = myHand.filter((t) => t !== added);
        }
      } else {
        seat.melds.push(event.meld);
        if (event.seat === game.mySeat) {
          for (const id of event.meld.tiles) {
            if (myDrawn === id) myDrawn = null;
            else if (myHand.includes(id)) myHand = myHand.filter((t) => t !== id);
          }
        }
        // 울려간 패를 방출 좌석의 강에서 표시
        if (
          (event.meld.type === 'chi' ||
            event.meld.type === 'pon' ||
            event.meld.type === 'daiminkan') &&
          'from' in event.meld
        ) {
          const from = at(event.meld.from);
          for (let i = from.discards.length - 1; i >= 0; i--) {
            const d = from.discards[i];
            if (d && d.calledBy === null && d.tileId === event.meld.calledTileId) {
              from.discards[i] = { ...d, calledBy: event.seat };
              break;
            }
          }
        }
      }
      break;
    }

    case 'riichiAccepted':
      at(event.seat).riichi = { double: at(event.seat).riichi?.double ?? false, accepted: true };
      at(event.seat).score = event.score;
      round = { ...round, pot: event.pot };
      break;

    case 'doraRevealed':
      round = { ...round, doraIndicators: [...round.doraIndicators, event.indicator] };
      break;

    case 'playerConnection':
      at(event.seat).connected = event.connected;
      break;

    case 'kyuushuDeclared':
      break;
  }

  // 울기 직후에는 그 좌석이 타패해야 하므로 활성 좌석을 갱신
  const activeSeat = event.type === 'call' ? event.seat : game.activeSeat;

  return {
    ...game,
    round,
    seats,
    myHand,
    myDrawn,
    activeSeat,
    eventLog: [describeEvent(event, game.players), ...game.eventLog].slice(0, 60),
  };
}

function snapshotToGame(snap: GameSnapshotView, players: LocalGame['players']): LocalGame {
  return {
    gameId: snap.gameId,
    mySeat: snap.seat,
    seedHash: snap.seedHash,
    rules: snap.rules,
    players,
    profiles: snap.profiles,
    round: snap.round,
    seats: snap.players.map((p) => ({
      seat: p.seat,
      nickname: p.nickname,
      isBot: p.isBot,
      connected: p.connected,
      score: p.score,
      discards: p.discards,
      melds: p.melds,
      riichi: p.riichi,
      hasDrawn: p.hasDrawn,
    })),
    myHand: [...snap.myHand].sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b),
    myDrawn: snap.myDrawnTile,
    activeSeat: snap.activeSeat,
    phase: snap.phase,
    choices: snap.choices,
    roundResult: snap.pendingResult,
    eventLog: [],
    lastResult: snap.pendingResult,
  };
}

// ── 소켓 배선 ──────────────────────────────────────────────────────

let wired = false;

export function initNetworking(): void {
  if (wired) return;
  wired = true;
  const socket = getSocket();
  const set = useGame.setState;
  const get = useGame.getState;

  const token = localStorage.getItem('cheongiwa.token') ?? undefined;
  const savedNick = localStorage.getItem('cheongiwa.nick') ?? undefined;

  socket.on('connect', () => set({ connection: 'connected' }));
  socket.io.on('reconnect_attempt', () => set({ connection: 'connecting' }));
  socket.on('connect_error', () => set({ connection: 'disconnected' }));
  socket.on('disconnect', () => set({ connection: 'disconnected' }));

  socket.on('server.hello', (hello: { protocolVersion: number }) => {
    set({ serverProtocol: hello.protocolVersion });
    // 토큰이 있으면 자동 재인증 (재접속 흐름)
    if (token) socket.emit('auth.hello', { token, nickname: savedNick });
  });

  socket.on('auth.welcome', (w: AuthWelcome) => {
    if (w.token) localStorage.setItem('cheongiwa.token', w.token);
    localStorage.setItem('cheongiwa.nick', w.nickname);
    set({
      userId: w.userId,
      nickname: w.nickname,
      stats: w.stats,
      account: w.account,
      // 복구 코드는 가입·재설정 응답에만 실린다. 여기서 안 받아 두면 다시는 못 본다.
      recoveryCode: w.recoveryCode ?? null,
      // 복구 코드를 받았으면 적어 둘 수 있게 계정 창을 띄운 채로 둔다
      accountOpen: w.recoveryCode ? true : false,
      error: null,
      wallet: w.wallet,
      rank: w.rank,
      rewards: w.pendingRewards,
      screen: w.activeGameId ? get().screen : 'lobby',
    });
    if (w.activeGameId) socket.emit('sync.request');
  });

  socket.on('auth.loggedOut', () => {
    localStorage.removeItem('cheongiwa.token');
    localStorage.removeItem('cheongiwa.nick');
    set({
      userId: null,
      nickname: '',
      stats: null,
      account: null,
      recoveryCode: null,
      accountOpen: false,
      wallet: null,
      rank: null,
      rewards: null,
      room: null,
      queue: null,
      game: null,
      gameEnd: null,
      screen: 'auth',
    });
  });

  socket.on('lobby.queue', (q: QueueStateView) => {
    set({ queue: q.inQueue ? q : null });
  });

  socket.on('lobby.fillOffer', (o: FillOffer) => set({ fillOffer: o }));

  socket.on('room.state', (r: RoomStateView) => {
    set({ room: r, screen: 'room', queue: null, fillOffer: null });
  });

  socket.on('room.closed', () => set({ room: null, screen: 'lobby' }));

  socket.on('game.start', (view: GameStartView) => {
    const round: RoundStartView = {
      kyoku: 0,
      roundWind: 27,
      dealer: 0,
      honba: 0,
      pot: 0,
      scores: [25000, 25000, 25000, 25000],
      doraIndicators: [],
      liveRemaining: 70,
    };
    set({
      screen: 'game',
      room: null,
      queue: null,
      fillOffer: null,
      gameEnd: null,
      emotes: {},
      game: {
        gameId: view.gameId,
        mySeat: view.seat,
        seedHash: view.seedHash,
        rules: view.rules,
        players: view.players,
        profiles: view.profiles,
        round,
        seats: seatsFromRound(round, view.players),
        myHand: [],
        myDrawn: null,
        activeSeat: 0,
        phase: 'turn',
        choices: null,
        roundResult: null,
        eventLog: [],
        lastResult: null,
      },
    });
    // 시작 시 저장된 자동 설정 반영
    socket.emit('settings.auto', get().auto);
  });

  socket.on('game.deal', (d: { tiles: TileId[] }) => {
    const game = get().game;
    if (!game) return;
    set({
      game: {
        ...game,
        myHand: [...d.tiles].sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b),
        myDrawn: null,
      },
    });
  });

  socket.on('game.draw', (d: { tileId: TileId }) => {
    const game = get().game;
    if (!game) return;
    set({ game: { ...game, myDrawn: d.tileId } });
  });

  socket.on('game.event', (event: PublicGameEvent) => {
    const game = get().game;
    if (!game) return;
    set({ game: applyPublicEvent(game, event) });

    // 효과음·선언 연출 (§4.5·§4.6)
    const rel = (seat: Seat): AnnounceItem['from'] => {
      const d = (seat - game.mySeat + 4) % 4;
      return (['self', 'right', 'top', 'left'] as const)[d] as AnnounceItem['from'];
    };
    switch (event.type) {
      case 'draw':
        if (event.seat === game.mySeat) playSfx('draw');
        break;
      case 'discard':
        playSfx('discard');
        if (event.riichi) {
          playSfx('riichi');
          pushAnnounce('riichi', '리치', rel(event.seat));
        }
        break;
      case 'call': {
        playSfx('call');
        const label = MELD_ANNOUNCE[event.meld.type];
        if (label) pushAnnounce('call', label, rel(event.seat));
        break;
      }
      default:
        break;
    }
  });

  socket.on('game.choices', (choices: ChoicesView) => {
    const game = get().game;
    if (!game) return;
    // choices가 오면 그 좌석의 결정 단계 — 활성 좌석/단계 갱신
    set({
      game: {
        ...game,
        choices,
        phase: choices.kind === 'turn' ? 'turn' : 'reaction',
        activeSeat: choices.kind === 'turn' ? game.mySeat : game.activeSeat,
      },
    });
  });

  socket.on('game.roundResult', (result: RoundResultView) => {
    const game = get().game;
    if (!game) return;

    // 화료 선언 연출 + 효과음
    if (result.type === 'win') {
      const first = result.wins[0];
      if (first) {
        const d = (first.seat - game.mySeat + 4) % 4;
        const from = (['self', 'right', 'top', 'left'] as const)[d] as AnnounceItem['from'];
        pushAnnounce(first.from === null ? 'tsumo' : 'ron', first.from === null ? '쯔모' : '론', from);
      }
      playSfx(result.wins.some((w) => w.yakuman.length > 0) ? 'yakuman' : 'win');
    } else {
      pushAnnounce('ryuukyoku', '유국', 'self');
      playSfx('draw_end');
    }

    // 점수 반영
    const seats = game.seats.map((s) => ({ ...s, score: result.scores[s.seat] ?? s.score }));
    set({
      game: {
        ...game,
        seats,
        phase: 'ended',
        choices: null,
        roundResult: result,
        lastResult: result,
      },
    });
  });

  socket.on('game.end', (end: GameEndView) => {
    set({ gameEnd: end });
  });

  socket.on('sync.snapshot', (snap: GameSnapshotView) => {
    const players =
      get().game?.players ??
      snap.players.map((p) => ({ seat: p.seat, nickname: p.nickname, isBot: p.isBot }));
    set({ screen: 'game', game: snapshotToGame(snap, players) });
  });

  socket.on('emote.show', (e: EmoteShowView) => {
    if (useGame.getState().emotesMuted) return;
    set((st) => ({ emotes: { ...st.emotes, [e.seat]: e } }));
    // 일정 시간 뒤 자기 것만 지운다 (그 사이 새 이모티콘이 오면 그게 남는다)
    setTimeout(() => {
      set((st) => (st.emotes[e.seat]?.nonce === e.nonce
        ? { emotes: { ...st.emotes, [e.seat]: undefined } }
        : {}));
    }, 2600);
  });

  socket.on('wallet.state', (wallet: WalletView) => set({ wallet }));
  socket.on('rank.state', (rank: RankView) => set({ rank }));
  socket.on('wallet.rewards', (rewards: RewardsView) => {
    set({ rewards });
    playSfx('result');
  });

  socket.on('server.error', (e: ServerErrorView) => {
    set({ error: { code: e.code, message: e.message } });
  });
}
