import type { RankView, RewardsView, SeatProfileView, WalletView } from './economy';
import type {
  AbortiveReason,
  FinalStanding,
  GameEndReason,
  LimitName,
  Meld,
  RuleSettings,
  Seat,
  TileId,
  TileKind,
  WaitKind,
  YakuEntry,
  YakumanEntry,
} from '@cheongiwa/engine';

/**
 * 서버 → 클라 페이로드 타입 (PLAN.md §3.3).
 * 원칙: 은닉 정보(타인 손패·패산·왕패)는 어떤 페이로드에도 싣지 않는다.
 * 타인 손패는 장수(handCount)로만, 쯔모패는 사실(hasDrawn)로만 전달한다.
 */

export interface ServerHello {
  protocolVersion: number;
}

export interface PlayerStats {
  games: number;
  top1: number;
  avgRank: number | null;
}

export interface AuthWelcome {
  userId: string;
  nickname: string;
  /** 최초 발급 시에만 포함 — 클라가 localStorage에 보관 */
  token?: string;
  stats: PlayerStats;
  /** 재접속 가능한 진행 중 대국 */
  activeGameId: string | null;
  /** 엽전 지갑·보유·장착 (§6) */
  wallet: WalletView;
  /** 등급 (유생→진사→급제→장원) */
  rank: RankView;
  /** 접속 시 지급된 빈곤 구제 등 (없으면 null) */
  pendingRewards: RewardsView | null;
}

export interface RoomMemberView {
  slot: number;
  nickname: string;
  isBot: boolean;
  ready: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface RoomStateView {
  code: string;
  members: RoomMemberView[];
  rules: RuleSettings;
  /** 연습 모드 방(보상 없음) 여부 */
  practice: boolean;
}

export interface QueueStateView {
  inQueue: boolean;
  position: number;
  waitingMs: number;
}

export interface GameStartView {
  gameId: string;
  /** 내 좌석 */
  seat: Seat;
  players: Array<{ seat: Seat; nickname: string; isBot: boolean }>;
  rules: RuleSettings;
  /** 시드 커밋 (SHA-256 hex) — 종료 시 원본 공개로 검증 (§1.2-3) */
  seedHash: string;
  /** 좌석별 등급·장착 코스메틱 (공개 정보 — 승패에 영향 없음, §6.1-2) */
  profiles: SeatProfileView[];
}

/** 국 시작 정보 (모두 공개 정보) */
export interface RoundStartView {
  kyoku: number;
  roundWind: TileKind;
  dealer: Seat;
  honba: number;
  pot: number;
  scores: number[];
  doraIndicators: TileKind[];
  liveRemaining: number;
}

/** 내 배패 (개인별 전송) */
export interface DealView {
  tiles: TileId[];
}

/** 내 쯔모패 (개인별 전송) */
export interface DrawView {
  tileId: TileId;
}

/** 공개 이벤트 브로드캐스트 (§3.3 game.event) */
export type PublicGameEvent =
  | { type: 'roundStart'; info: RoundStartView }
  | { type: 'draw'; seat: Seat; rinshan: boolean; liveRemaining: number }
  | { type: 'discard'; seat: Seat; tileId: TileId; riichi: boolean; tsumogiri: boolean }
  | { type: 'call'; seat: Seat; meld: Meld }
  | { type: 'riichiAccepted'; seat: Seat; pot: number; score: number }
  | { type: 'doraRevealed'; indicator: TileKind }
  | { type: 'kyuushuDeclared'; seat: Seat }
  | { type: 'playerConnection'; seat: Seat; connected: boolean };

export interface ChoiceTimeout {
  /** 행동당 기본 시간 */
  baseMs: number;
  /** 남은 국당 예비시간 (소진식) */
  reserveMs: number;
}

/** 지금 가능한 행동 목록 (서버 계산, 개인별 전송 — §3.3 game.choices) */
export type ChoicesView =
  | {
      kind: 'turn';
      discards: TileId[];
      riichiDiscards: TileId[];
      canTsumo: boolean;
      ankanKinds: TileKind[];
      shouminkanTiles: TileId[];
      canKyuushu: boolean;
      timeout: ChoiceTimeout;
    }
  | {
      kind: 'reaction';
      canRon: boolean;
      canPon: boolean;
      canDaiminkan: boolean;
      chiCombos: Array<[TileId, TileId]>;
      timeout: ChoiceTimeout;
    };

export interface RevealedHandView {
  seat: Seat;
  /** 공개된 손패 (화료패 포함) */
  tiles: TileId[];
  melds: Meld[];
}

export interface WinResultView {
  seat: Seat;
  from: Seat | null;
  hand: RevealedHandView;
  winningTile: TileId;
  wait: WaitKind | null;
  yaku: YakuEntry[];
  yakuman: YakumanEntry[];
  han: number;
  fu: number;
  basePoints: number;
  limit: LimitName;
  gained: number;
  pao: Seat | null;
  /** 리치 화료자만 채워짐 (§2.1) */
  uraIndicators: TileKind[];
}

/** 국 결과 (§3.3 game.roundResult) */
export type RoundResultView =
  | {
      type: 'win';
      wins: WinResultView[];
      deltas: number[];
      scores: number[];
      dealerRepeats: boolean;
    }
  | {
      type: 'exhaustive';
      tenpai: boolean[];
      /** 텐파이자 손패 공개 (표준 관례) */
      revealed: RevealedHandView[];
      nagashi: Seat[];
      deltas: number[];
      scores: number[];
      dealerRepeats: boolean;
    }
  | {
      type: 'abortive';
      reason: AbortiveReason;
      deltas: number[];
      scores: number[];
    };

/** 최종 결과 (§3.3 game.end) — 시드 원본 공개 */
export interface GameEndView {
  gameId: string;
  standings: FinalStanding[];
  endReason: GameEndReason;
  seedHash: string;
  seed: string;
}

/** 타인 좌석 공개 뷰 — 손패는 장수만 */
export interface SeatPublicView {
  seat: Seat;
  nickname: string;
  isBot: boolean;
  connected: boolean;
  score: number;
  discards: Array<{ tileId: TileId; riichi: boolean; calledBy: Seat | null; tsumogiri: boolean }>;
  melds: Meld[];
  riichi: { double: boolean; accepted: boolean } | null;
  handCount: number;
  hasDrawn: boolean;
}

/** 내 시점 전체 상태 (재접속 리싱크 — §3.3 sync.snapshot) */
export interface GameSnapshotView {
  gameId: string;
  seat: Seat;
  rules: RuleSettings;
  seedHash: string;
  round: RoundStartView;
  players: SeatPublicView[];
  profiles: SeatProfileView[];
  myHand: TileId[];
  myDrawnTile: TileId | null;
  activeSeat: Seat;
  phase: 'turn' | 'reaction' | 'ended';
  choices: ChoicesView | null;
  /** 국 결과 표시 중이면 그 결과 */
  pendingResult: RoundResultView | null;
}

export interface ServerErrorView {
  code:
    | 'BAD_REQUEST'
    | 'UNAUTHENTICATED'
    | 'NOT_FOUND'
    | 'ROOM_FULL'
    | 'NOT_HOST'
    | 'NOT_IN_GAME'
    | 'ILLEGAL_ACTION'
    | 'INTERNAL';
  message: string;
}

/** 서버 → 클라 이벤트 이름 */
export const SERVER_EVENTS = [
  'server.hello',
  'auth.welcome',
  'lobby.queue',
  'lobby.fillOffer',
  'room.state',
  'room.closed',
  'game.start',
  'game.deal',
  'game.event',
  'game.draw',
  'game.choices',
  'game.roundResult',
  'game.end',
  'sync.snapshot',
  'wallet.state',
  'wallet.rewards',
  'rank.state',
  'emote.show',
  'server.error',
] as const;
export type ServerEventName = (typeof SERVER_EVENTS)[number];
