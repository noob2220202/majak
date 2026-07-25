import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import {
  advanceGame,
  applyAction,
  createBotV1,
  reactionOffers,
  startGame,
  turnChoices,
  type Bot,
  type GameState,
  type RoundAction,
  type RoundState,
  type RuleSettings,
  type Seat,
} from '@cheongiwa/engine';
import type {
  AutoSettings,
  GameEndView,
  GameSnapshotView,
  GameStartView,
  PublicGameEvent,
  RoundResultView,
  SeatProfileView,
} from '@cheongiwa/protocol';
import { buildChoices, buildRoundResult, buildRoundStart, buildSeatViews, redactEvent } from './views';

/**
 * 대국 세션 (PLAN.md §3.3~§3.5).
 * 서버 권위: 엔진은 여기서만 구동되고, 클라에는 개인 시점 뷰만 나간다.
 * 타이머(행동 5초 + 국당 예비 20초), 이탈 시 안전봇 대체, 5분 내 재접속 복귀.
 */

export interface SessionSeatInit {
  kind: 'human' | 'bot';
  userId: string | null;
  nickname: string;
  socket: Socket | null;
  /** 등급·장착 코스메틱 (없으면 기본값). 승패에 영향 없는 표시용이다. */
  profile?: Omit<SeatProfileView, 'seat'>;
}

interface SeatState extends SessionSeatInit {
  /** 마지막 이모티콘 전송 시각 (쿨다운용) */
  lastEmoteAt: number;
  disconnectedAt: number | null;
  abandoned: boolean;
  auto: AutoSettings;
  reserveMs: number;
  /** 현재 결정 대기: choices 전송 시각 (예비시간 정산용) */
  pendingSince: number | null;
  timer: NodeJS.Timeout | null;
}

export interface SessionOptions {
  turnBaseMs: number;
  reserveMs: number;
  resultDelayMs: number;
  botDelayMs: number;
  reconnectWindowMs: number;
  practice: boolean;
}

export const DEFAULT_SESSION_OPTIONS: SessionOptions = {
  turnBaseMs: 5000,
  reserveMs: 20000,
  resultDelayMs: 8000,
  botDelayMs: 350,
  reconnectWindowMs: 5 * 60 * 1000,
  practice: false,
};

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

/** 이모티콘 도배 방지 — 좌석당 최소 간격 */
const EMOTE_COOLDOWN_MS = 3000;

/** 프로필이 없는 좌석(봇 등)의 기본 표시값 */
const DEFAULT_PROFILE: Omit<SeatProfileView, 'seat'> = {
  tier: null,
  level: 0,
  tileBack: 'tileBack.sumaksae',
  winEffect: 'winEffect.basic',
};

export interface SessionEndSummary {
  gameId: string;
  seed: string;
  seedHash: string;
  rules: RuleSettings;
  practice: boolean;
  game: GameState;
  seats: Array<{
    seat: Seat;
    userId: string | null;
    nickname: string;
    isBot: boolean;
    completed: boolean;
  }>;
}

export class GameSession {
  readonly id: string;
  readonly seed: string;
  readonly seedHash: string;
  readonly rules: RuleSettings;
  readonly options: SessionOptions;
  readonly game: GameState;
  private readonly io: SocketIOServer;
  private readonly seats: SeatState[];
  private readonly smartBots: Bot[];
  private eventCursor = 0;
  private emoteNonce = 0;
  private stepping = false;
  private pendingResult: RoundResultView | null = null;
  private resultTimer: NodeJS.Timeout | null = null;
  /** 지연 실행 대기 중인 서버(봇·안전봇) 액션 타이머 — 중복 예약 방지 */
  private serverActionTimer: NodeJS.Timeout | null = null;
  private ended = false;
  private readonly onEnd: (summary: SessionEndSummary) => void;

  constructor(
    io: SocketIOServer,
    seatInits: SessionSeatInit[],
    rules: RuleSettings,
    options: SessionOptions,
    onEnd: (summary: SessionEndSummary) => void,
  ) {
    this.io = io;
    this.id = randomUUID();
    this.seed = randomBytes(32).toString('hex');
    this.seedHash = sha256(this.seed);
    this.rules = rules;
    this.options = options;
    this.onEnd = onEnd;
    this.seats = seatInits.map((s) => ({
      ...s,
      disconnectedAt: s.kind === 'human' && !s.socket ? Date.now() : null,
      abandoned: false,
      auto: { autoWin: false, autoSkipCalls: false, autoTsumogiri: false },
      reserveMs: options.reserveMs,
      pendingSince: null,
      timer: null,
      lastEmoteAt: 0,
    }));
    this.smartBots = this.seats.map(() => createBotV1());
    this.game = startGame({ rules, seed: this.seed });
  }

  private get room(): string {
    return `game:${this.id}`;
  }

  /** 좌석별 공개 프로필 (등급·패 뒷면) — 은닉 정보 없음 */
  private profiles(): SeatProfileView[] {
    return this.seats.map((s, seat) => ({ seat, ...(s.profile ?? DEFAULT_PROFILE) }));
  }

  private round(): RoundState {
    const round = this.game.round;
    if (!round) throw new Error('진행 중인 국이 없음');
    return round;
  }

  seatOfUser(userId: string): Seat | null {
    const idx = this.seats.findIndex((s) => s.userId === userId);
    return idx >= 0 ? (idx as Seat) : null;
  }

  /**
   * 이모티콘 전송 (§7 Phase 5 이모티콘 소통).
   * 도배를 막기 위해 좌석당 쿨다운을 둔다. 보유 여부는 호출 측(app)이 검증한다.
   */
  sendEmote(seat: Seat, itemId: string, now = Date.now()): boolean {
    const s = this.seats[seat] as SeatState;
    if (now - s.lastEmoteAt < EMOTE_COOLDOWN_MS) return false;
    s.lastEmoteAt = now;
    this.emoteNonce++;
    this.broadcast('emote.show', { seat, itemId, nonce: this.emoteNonce });
    return true;
  }

  /** 서버가 대신 두는 좌석인가 (봇 / 연결 끊긴 인간) */
  private serverControlled(seat: Seat): boolean {
    const s = this.seats[seat] as SeatState;
    return s.kind === 'bot' || s.socket === null;
  }

  private emitTo(seat: Seat, event: string, payload: unknown): void {
    const s = this.seats[seat] as SeatState;
    if (s.socket) s.socket.emit(event, payload);
  }

  private broadcast(event: string, payload: unknown): void {
    this.io.to(this.room).emit(event, payload);
  }

  // ── 시작 ──

  start(): void {
    for (const [i, s] of this.seats.entries()) {
      if (s.socket) {
        void s.socket.join(this.room);
        const view: GameStartView = {
          gameId: this.id,
          seat: i as Seat,
          players: this.seats.map((p, seat) => ({
            seat: seat as Seat,
            nickname: p.nickname,
            isBot: p.kind === 'bot',
          })),
          rules: this.rules,
          seedHash: this.seedHash,
          profiles: this.profiles(),
        };
        s.socket.emit('game.start', view);
      }
    }
    this.beginRoundFlow();
  }

  private beginRoundFlow(): void {
    const round = this.round();
    this.eventCursor = 0; // deal 이벤트는 리댁션에서 제외되고, 첫 쯔모는 flush가 전달
    this.pendingResult = null;
    for (const s of this.seats) s.reserveMs = this.options.reserveMs;

    this.broadcast('game.event', {
      type: 'roundStart',
      info: buildRoundStart(this.game, round),
    } satisfies PublicGameEvent);

    for (const [i, s] of this.seats.entries()) {
      if (s.socket) {
        s.socket.emit('game.deal', { tiles: [...round.players[i as Seat].hand] });
      }
    }
    // 배패 직후 친의 첫 쯔모 이벤트 전달
    this.flushEvents();
    this.step();
  }

  // ── 이벤트 전파 ──

  private flushEvents(): void {
    const round = this.round();
    while (this.eventCursor < round.events.length) {
      const event = round.events[this.eventCursor];
      this.eventCursor++;
      if (!event) continue;
      if (event.type === 'draw') {
        // 쯔모패 id는 본인에게만
        this.emitTo(event.seat, 'game.draw', { tileId: event.tileId });
      }
      const pub = redactEvent(round, event);
      if (pub) this.broadcast('game.event', pub);
    }
  }

  // ── 진행 루프 ──

  private step(): void {
    if (this.ended || this.stepping) return;
    this.stepping = true;
    try {
      let guard = 0;
      for (;;) {
        if (++guard > 1000) throw new Error('세션 진행 한도 초과');
        const round = this.game.round;
        if (!round) return;
        this.sweepStalePending(round);

        if (round.phase === 'ended') {
          this.handleRoundEnd();
          return;
        }

        if (round.phase === 'turn') {
          const seat = round.active;
          if (this.serverControlled(seat)) {
            if (this.scheduleServerAction(seat, () => this.serverTurnAction(seat))) return;
            continue;
          }
          const auto = this.tryAutoTurn(seat);
          if (auto) {
            this.applySeatAction(seat, auto);
            continue;
          }
          if ((this.seats[seat] as SeatState).pendingSince === null) {
            this.sendChoicesAndArm(seat);
          }
          return;
        }

        // reaction
        const pending = reactionOffers(round);
        let acted = false;
        let humanWaiting = false;
        for (const seat of [...pending.keys()].sort((a, b) => a - b)) {
          if (this.serverControlled(seat)) {
            if (this.scheduleServerAction(seat, () => this.serverReactionAction(seat))) return;
            acted = true;
            break; // 상태가 변했으므로 루프 재시작
          }
          const auto = this.tryAutoReaction(seat);
          if (auto) {
            this.applySeatAction(seat, auto);
            acted = true;
            break;
          }
          const s = this.seats[seat] as SeatState;
          if (s.pendingSince === null) this.sendChoicesAndArm(seat);
          humanWaiting = true;
        }
        if (acted) continue;
        if (humanWaiting) return;
        return;
      }
    } finally {
      this.stepping = false;
    }
  }

  /** 더 이상 결정 대상이 아닌 좌석의 대기·타이머 정리 (반응 해소 후 등) */
  private sweepStalePending(round: RoundState): void {
    const offers = round.phase === 'reaction' ? reactionOffers(round) : null;
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const s = this.seats[seat] as SeatState;
      if (s.pendingSince === null) continue;
      const stillPending =
        (round.phase === 'turn' && round.active === seat) ||
        (offers !== null && offers.has(seat));
      if (!stillPending) this.clearPending(seat, false);
    }
  }

  /**
   * botDelay가 있으면 지연 실행하고 true, 없으면 즉시 실행하고 false.
   * 이미 예약된 서버 액션이 있으면 재예약하지 않는다 (step()이 여러 경로에서
   * 호출돼도 봇이 두 번 두지 않도록 — 예: settings.auto가 트리거한 step).
   */
  private scheduleServerAction(seat: Seat, act: () => void): boolean {
    if (this.options.botDelayMs > 0) {
      if (this.serverActionTimer) return true;
      this.serverActionTimer = setTimeout(() => {
        this.serverActionTimer = null;
        if (this.ended) return;
        act();
        this.step();
      }, this.options.botDelayMs);
      return true;
    }
    act();
    return false;
  }

  private serverTurnAction(seat: Seat): void {
    const round = this.game.round;
    if (!round || round.phase !== 'turn' || round.active !== seat) return;
    const s = this.seats[seat] as SeatState;
    const c = turnChoices(round);
    const safeDiscard = (): RoundAction => {
      const drawn = round.players[seat].drawnTile;
      const tileId = drawn !== null && c.discards.includes(drawn) ? drawn : (c.discards[0] as number);
      return c.canTsumo ? { type: 'tsumo' } : { type: 'discard', tileId };
    };
    let action: RoundAction;
    try {
      action =
        s.kind === 'bot'
          ? (this.smartBots[seat] as Bot).chooseTurnAction(round, seat)
          : safeDiscard();
    } catch {
      action = safeDiscard(); // 봇 예외는 안전 타패로 폴백 (서버 크래시 방지)
    }
    try {
      this.applySeatAction(seat, action);
    } catch {
      this.applySeatAction(seat, safeDiscard());
    }
  }

  private serverReactionAction(seat: Seat): void {
    const round = this.game.round;
    if (!round || round.phase !== 'reaction' || !reactionOffers(round).has(seat)) return;
    const s = this.seats[seat] as SeatState;
    let action: RoundAction = { type: 'pass' };
    try {
      if (s.kind === 'bot') action = (this.smartBots[seat] as Bot).chooseReaction(round, seat);
    } catch {
      action = { type: 'pass' };
    }
    try {
      this.applySeatAction(seat, action);
    } catch {
      this.applySeatAction(seat, { type: 'pass' });
    }
  }

  private tryAutoTurn(seat: Seat): RoundAction | null {
    const s = this.seats[seat] as SeatState;
    const round = this.round();
    const c = turnChoices(round);
    if (s.auto.autoWin && c.canTsumo) return { type: 'tsumo' };
    const drawn = round.players[seat].drawnTile;
    // 리치 중 선택지가 쯔모기리뿐이면 자동 진행 (통용 편의)
    if (
      round.players[seat].riichi &&
      !c.canTsumo &&
      c.ankanKinds.length === 0 &&
      drawn !== null
    ) {
      return { type: 'discard', tileId: drawn };
    }
    if (s.auto.autoTsumogiri && drawn !== null && c.discards.includes(drawn)) {
      return { type: 'discard', tileId: drawn };
    }
    return null;
  }

  private tryAutoReaction(seat: Seat): RoundAction | null {
    const s = this.seats[seat] as SeatState;
    const offers = reactionOffers(this.round()).get(seat);
    if (!offers) return null;
    const canRon = offers.some((o) => o.type === 'ron');
    if (s.auto.autoWin && canRon) return { type: 'ron' };
    if (s.auto.autoSkipCalls && !canRon) return { type: 'pass' };
    return null;
  }

  // ── 인간 결정 대기 ──

  private currentTimeout(seat: Seat): { baseMs: number; reserveMs: number } {
    const s = this.seats[seat] as SeatState;
    return { baseMs: this.options.turnBaseMs, reserveMs: s.reserveMs };
  }

  private sendChoicesAndArm(seat: Seat): void {
    const s = this.seats[seat] as SeatState;
    const choices = buildChoices(this.round(), seat, this.currentTimeout(seat));
    if (!choices) return;
    s.pendingSince = Date.now();
    this.emitTo(seat, 'game.choices', choices);
    const total = this.options.turnBaseMs + s.reserveMs;
    s.timer = setTimeout(() => this.onTimeout(seat), total);
  }

  private clearPending(seat: Seat, consumeReserve: boolean): void {
    const s = this.seats[seat] as SeatState;
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;
    if (s.pendingSince !== null && consumeReserve) {
      const elapsed = Date.now() - s.pendingSince;
      const over = Math.max(0, elapsed - this.options.turnBaseMs);
      s.reserveMs = Math.max(0, s.reserveMs - over);
    }
    s.pendingSince = null;
  }

  private onTimeout(seat: Seat): void {
    if (this.ended) return;
    const s = this.seats[seat] as SeatState;
    s.timer = null;
    s.pendingSince = null;
    s.reserveMs = 0;
    const round = this.game.round;
    if (!round || round.phase === 'ended') return;
    // 시간 초과: 타패 차례면 쯔모기리, 울기 선택이면 패스 (§3.4)
    if (round.phase === 'turn' && round.active === seat) {
      const c = turnChoices(round);
      const drawn = round.players[seat].drawnTile;
      const tileId = drawn !== null && c.discards.includes(drawn) ? drawn : c.discards[0];
      if (tileId !== undefined) this.applySeatAction(seat, { type: 'discard', tileId });
    } else if (round.phase === 'reaction' && reactionOffers(round).has(seat)) {
      this.applySeatAction(seat, { type: 'pass' });
    }
    this.step();
  }

  /** 클라이언트 액션 진입점. 성공 여부를 돌려준다. */
  handleAction(userId: string, action: RoundAction): { ok: true } | { ok: false; message: string } {
    if (this.ended) return { ok: false, message: '이미 종료된 대국입니다' };
    const seat = this.seatOfUser(userId);
    if (seat === null) return { ok: false, message: '이 대국의 참가자가 아닙니다' };
    const round = this.game.round;
    if (!round || round.phase === 'ended') {
      return { ok: false, message: '지금은 행동할 수 없습니다' };
    }
    try {
      this.applySeatAction(seat, action, true);
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : '불법 액션' };
    }
    this.step();
    return { ok: true };
  }

  /** 엔진 적용 + 이벤트 전파. 인간 액션이면 성공 시에만 타이머 정산. */
  private applySeatAction(seat: Seat, action: RoundAction, humanInitiated = false): void {
    const round = this.round();
    applyAction(round, seat, action); // 실패 시 throw — 상태 불변
    if (humanInitiated) this.clearPending(seat, true);
    else this.clearPending(seat, false);
    this.flushEvents();
  }

  // ── 국·대국 종료 ──

  private handleRoundEnd(): void {
    // step()은 여러 경로(자동설정·봇 타이머·액션)에서 호출되므로 중복 진입을 막는다.
    // 그렇지 않으면 결과 타이머가 두 번 예약되어 다음 국을 두 번 진행하려다 실패한다.
    if (this.resultTimer) return;
    const round = this.round();
    this.flushEvents();
    // 남은 결정 대기 정리
    for (const seat of [0, 1, 2, 3] as Seat[]) this.clearPending(seat, false);

    const view = buildRoundResult(round);
    this.pendingResult = view;
    this.broadcast('game.roundResult', view);

    const proceed = (): void => {
      this.resultTimer = null;
      if (this.ended) return;
      advanceGame(this.game); // 아가리야메는 자동 종료 선택 (ASSUMPTIONS)
      if (this.game.phase === 'ended') {
        this.finishGame();
      } else {
        this.beginRoundFlow();
      }
    };
    // stepping 재진입을 피하기 위해 지연 0이어도 다음 틱에서 진행
    this.resultTimer = setTimeout(proceed, this.options.resultDelayMs);
  }

  private finishGame(): void {
    this.ended = true;
    const view: GameEndView = {
      gameId: this.id,
      standings: this.game.standings ?? [],
      endReason: this.game.endReason ?? 'finished',
      seedHash: this.seedHash,
      seed: this.seed, // 시드 원본 공개 (§1.2-3 공정성 증명)
    };
    this.broadcast('game.end', view);
    const summary: SessionEndSummary = {
      gameId: this.id,
      seed: this.seed,
      seedHash: this.seedHash,
      rules: this.rules,
      practice: this.options.practice,
      game: this.game,
      seats: this.seats.map((s, i) => ({
        seat: i as Seat,
        userId: s.userId,
        nickname: s.nickname,
        isBot: s.kind === 'bot',
        completed: s.kind === 'bot' ? true : s.socket !== null && !s.abandoned,
      })),
    };
    for (const s of this.seats) {
      if (s.timer) clearTimeout(s.timer);
      if (s.socket) void s.socket.leave(this.room);
    }
    if (this.resultTimer) clearTimeout(this.resultTimer);
    if (this.serverActionTimer) clearTimeout(this.serverActionTimer);
    this.onEnd(summary);
  }

  // ── 접속 관리 ──

  setAutoSettings(userId: string, auto: AutoSettings): void {
    const seat = this.seatOfUser(userId);
    if (seat === null) return;
    (this.seats[seat] as SeatState).auto = auto;
    // 대기 중이던 결정에 즉시 반영
    this.step();
  }

  markDisconnected(socketId: string): void {
    const idx = this.seats.findIndex((s) => s.socket?.id === socketId);
    if (idx < 0 || this.ended) return;
    const seat = idx as Seat;
    const s = this.seats[seat] as SeatState;
    s.socket = null;
    s.disconnectedAt = Date.now();
    this.broadcast('game.event', {
      type: 'playerConnection',
      seat,
      connected: false,
    } satisfies PublicGameEvent);
    // 대기 중 결정은 즉시 안전봇 처리 (§3.4 — 대국은 중단되지 않는다)
    if (s.pendingSince !== null) {
      this.clearPending(seat, false);
      const round = this.game.round;
      if (round && round.phase !== 'ended') {
        if (round.phase === 'turn' && round.active === seat) this.serverTurnAction(seat);
        else if (reactionOffers(round).has(seat)) this.serverReactionAction(seat);
      }
    }
    this.step();
  }

  /** 재접속 (5분 내). 성공 시 좌석 번호 반환. */
  rebind(userId: string, socket: Socket): Seat | null {
    if (this.ended) return null;
    const seat = this.seatOfUser(userId);
    if (seat === null) return null;
    const s = this.seats[seat] as SeatState;
    if (
      s.disconnectedAt !== null &&
      Date.now() - s.disconnectedAt > this.options.reconnectWindowMs
    ) {
      s.abandoned = true;
      return null;
    }
    s.socket = socket;
    s.disconnectedAt = null;
    void socket.join(this.room);
    this.broadcast('game.event', {
      type: 'playerConnection',
      seat,
      connected: true,
    } satisfies PublicGameEvent);
    return seat;
  }

  /** 내 시점 전체 상태 (§3.3 sync.snapshot) */
  snapshotFor(userId: string): GameSnapshotView | null {
    const seat = this.seatOfUser(userId);
    if (seat === null || !this.game.round) return null;
    const round = this.game.round;
    const meta = this.seats.map((s) => ({
      nickname: s.nickname,
      isBot: s.kind === 'bot',
      connected: s.kind === 'bot' || s.socket !== null,
    }));
    const s = this.seats[seat] as SeatState;
    const choices =
      s.pendingSince !== null ? buildChoices(round, seat, this.currentTimeout(seat)) : null;
    return {
      gameId: this.id,
      seat,
      rules: this.rules,
      seedHash: this.seedHash,
      round: buildRoundStart(this.game, round),
      players: buildSeatViews(round, meta),
      profiles: this.profiles(),
      myHand: [...round.players[seat].hand],
      myDrawnTile: round.players[seat].drawnTile,
      activeSeat: round.active,
      phase: round.phase,
      choices,
      pendingResult: this.pendingResult,
    };
  }

  get isEnded(): boolean {
    return this.ended;
  }

  /** 서버 종료 시 강제 정리 — 저장 없이 타이머만 해제 */
  dispose(): void {
    this.ended = true;
    if (this.resultTimer) clearTimeout(this.resultTimer);
    if (this.serverActionTimer) clearTimeout(this.serverActionTimer);
    for (const s of this.seats) {
      if (s.timer) clearTimeout(s.timer);
      s.timer = null;
    }
  }
}
