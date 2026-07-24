import readline from 'node:readline';
import { io as connect } from 'socket.io-client';
import { isRedFiveId, kindOfTile, tileKindToNotation } from '@cheongiwa/engine';
import type {
  AuthWelcome,
  ChoicesView,
  GameEndView,
  GameSnapshotView,
  GameStartView,
  PublicGameEvent,
  RoomStateView,
  RoundResultView,
  ServerErrorView,
} from '@cheongiwa/protocol';

/**
 * 터미널 테스트 클라이언트 (Phase 2 완료 기준 데모용).
 *
 * 사용 예 (터미널 4개):
 *   1) npx tsx scripts/play-cli.ts --nick 갑 --create
 *   2) npx tsx scripts/play-cli.ts --nick 을 --join ABC123
 *   3) npx tsx scripts/play-cli.ts --nick 병 --join ABC123
 *   4) npx tsx scripts/play-cli.ts --nick 정 --join ABC123
 *   전원 입장 후 1번 터미널에서 Enter → 대국 시작
 *
 * 옵션: --url http://localhost:8787 --auto (전자동) --practice (봇 3 즉시)
 *       --quick (빠른 대전 큐) --token <재접속 토큰>
 */

const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const opt = (name: string): string | undefined => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const url = opt('url') ?? 'http://localhost:8787';
const nickname = opt('nick') ?? `손님${Math.floor(Math.random() * 1000)}`;
const auto = flag('auto');

const tile = (id: number): string => tileKindToNotation(kindOfTile(id), isRedFiveId(id));
const tiles = (ids: readonly number[]): string => ids.map(tile).join(' ');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const log = (...parts: unknown[]): void => console.log(...parts);

const socket = connect(url, { transports: ['websocket'] });
let mySeat = -1;
let myHand: number[] = [];
let drawn: number | null = null;
let isHost = false;

socket.on('connect_error', (e) => log('연결 실패:', e.message));

socket.on('server.hello', () => {
  const token = opt('token');
  socket.emit('auth.hello', token ? { token, nickname } : { nickname });
});

socket.on('auth.welcome', (w: AuthWelcome) => {
  log(`[인증] ${w.nickname} (전적 ${w.stats.games}국 · 1위 ${w.stats.top1})`);
  if (w.token) log(`[토큰] 재접속용: --token ${w.token}`);
  if (w.activeGameId) {
    log('[재접속] 진행 중 대국 복귀 — 스냅샷 요청');
    socket.emit('sync.request');
    return;
  }
  if (flag('practice')) socket.emit('lobby.practice');
  else if (flag('quick')) socket.emit('lobby.quickMatch');
  else if (opt('join')) socket.emit('room.join', { code: opt('join') });
  else if (flag('create')) socket.emit('room.create');
  else log('옵션을 지정하세요: --create | --join CODE | --practice | --quick');
});

socket.on('room.state', (state: RoomStateView) => {
  isHost = state.members.some((m) => m.isHost && m.nickname === nickname);
  const members = state.members
    .map((m) => `${m.isHost ? '[방장]' : ''}${m.nickname}${m.isBot ? '(봇)' : ''}${m.ready ? '(준비)' : ''}`)
    .join(' / ');
  log(`[방 ${state.code}] ${members}`);
  if (isHost) log('  Enter=시작(빈자리 봇 충원) · b=봇 추가');
  else {
    log('  준비 완료로 표시합니다');
    socket.emit('room.ready', { ready: true });
  }
});

socket.on('lobby.fillOffer', () => {
  log('[매칭] 인원 미달 — 봇으로 채우고 시작할까요? (y/n)');
});

socket.on('game.start', (view: GameStartView) => {
  mySeat = view.seat;
  const names = view.players
    .map((p) => `${p.seat === view.seat ? '나:' : ''}${p.nickname}${p.isBot ? '(봇)' : ''}`)
    .join(' · ');
  log(`\n=== 대국 시작 === ${names}`);
  log(`시드 커밋: ${view.seedHash.slice(0, 16)}…`);
  if (auto) {
    socket.emit('settings.auto', { autoWin: true, autoSkipCalls: true, autoTsumogiri: true });
    log('[자동 모드]');
  }
});

socket.on('game.deal', (d: { tiles: number[] }) => {
  myHand = [...d.tiles];
  drawn = null;
  log(`[배패] ${tiles(myHand)}`);
});

socket.on('game.draw', (d: { tileId: number }) => {
  drawn = d.tileId;
});

socket.on('game.event', (e: PublicGameEvent) => {
  switch (e.type) {
    case 'roundStart': {
      const windName = ['동', '남', '서'][e.info.roundWind - 27] ?? '?';
      log(
        `\n── ${windName}${(e.info.kyoku % 4) + 1}국 ${e.info.honba}본장 · 도라표시 ${e.info.doraIndicators.map((k) => tileKindToNotation(k)).join(' ')} · 점수 ${e.info.scores.join('/')}`,
      );
      break;
    }
    case 'discard':
      if (e.seat === mySeat) {
        if (drawn === e.tileId) {
          drawn = null;
        } else {
          myHand = myHand.filter((t) => t !== e.tileId);
          if (drawn !== null) {
            myHand.push(drawn);
            drawn = null;
            myHand.sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b);
          }
        }
      }
      log(`  ${seatName(e.seat)} 타패 ${tile(e.tileId)}${e.riichi ? ' [리치!]' : ''}`);
      break;
    case 'call':
      if (e.seat === mySeat) {
        myHand = myHand.filter((t) => !e.meld.tiles.includes(t));
      }
      log(`  ${seatName(e.seat)} ${e.meld.type} (${tiles(e.meld.tiles)})`);
      break;
    case 'riichiAccepted':
      log(`  ${seatName(e.seat)} 리치 성립 (공탁 ${e.pot})`);
      break;
    case 'doraRevealed':
      log(`  신도라 표시 ${tileKindToNotation(e.indicator)}`);
      break;
    case 'kyuushuDeclared':
      log(`  ${seatName(e.seat)} 구종구패 선언`);
      break;
    case 'playerConnection':
      log(`  ${seatName(e.seat)} ${e.connected ? '재접속' : '연결 끊김(봇 대체)'}`);
      break;
    default:
      break;
  }
});

let lastChoices: ChoicesView | null = null;

socket.on('game.choices', (c: ChoicesView) => {
  lastChoices = c;
  if (c.kind === 'turn') {
    const hand = [...myHand];
    log(`[내 차례] 손패 ${tiles(hand)}${drawn !== null ? ` | 쯔모 ${tile(drawn)}` : ''}`);
    const opts: string[] = [];
    if (c.canTsumo) opts.push('t=쯔모');
    if (c.riichiDiscards.length > 0) opts.push('r<번호>=리치');
    if (c.ankanKinds.length > 0) opts.push('k=안깡');
    if (c.canKyuushu) opts.push('9=구종구패');
    log(
      `  버릴 패: ${c.discards.map((t, i) => `${i}:${tile(t)}`).join(' ')}  (${opts.join(' · ') || '번호 입력'})`,
    );
  } else {
    const opts: string[] = [];
    if (c.canRon) opts.push('r=론');
    if (c.canPon) opts.push('p=퐁');
    if (c.canDaiminkan) opts.push('k=깡');
    if (c.chiCombos.length > 0) opts.push('c=치');
    log(`[반응] ${opts.join(' · ')} · Enter=패스`);
  }
});

socket.on('game.roundResult', (r: RoundResultView) => {
  if (r.type === 'win') {
    for (const w of r.wins) {
      const yaku = [
        ...w.yakuman.map((y) => `${y.name}(역만${y.power > 1 ? '×2' : ''})`),
        ...w.yaku.map((y) => `${y.name} ${y.han}판`),
      ].join(', ');
      log(
        `\n[화료] ${seatName(w.seat)} ${w.from !== null ? `론(←${seatName(w.from)})` : '쯔모'} ${tiles(w.hand.tiles)} | ${yaku} | ${w.fu}부 ${w.han}판${w.limit ? ` ${w.limit}` : ''} +${w.gained}`,
      );
    }
  } else if (r.type === 'exhaustive') {
    log(`\n[황패유국] 텐파이 ${r.tenpai.map((t, i) => (t ? seatName(i) : null)).filter(Boolean).join(',') || '없음'}${r.nagashi.length ? ` · 나가시만관 ${r.nagashi.map(seatName).join(',')}` : ''}`);
  } else {
    log(`\n[도중유국] ${r.reason}`);
  }
  log(`  점수: ${r.scores.join(' / ')}`);
});

socket.on('game.end', (e: GameEndView) => {
  log('\n=== 대국 종료 ===');
  for (const s of e.standings) {
    log(`  ${s.rank}위 ${seatName(s.seat)} ${s.rawScore}점 (우마 ${s.uma > 0 ? '+' : ''}${s.uma}) = ${s.finalPoints}`);
  }
  log(`시드 공개: ${e.seed}`);
  log(`검증: sha256(시드) == 시작 커밋 ${e.seedHash.slice(0, 16)}…`);
  process.exit(0);
});

socket.on('sync.snapshot', (s: GameSnapshotView) => {
  mySeat = s.seat;
  myHand = [...s.myHand];
  drawn = s.myDrawnTile;
  log(`[복귀] ${seatName(s.seat)} · 손패 ${tiles(myHand)} · 점수 ${s.round.scores.join('/')}`);
  if (s.choices) {
    lastChoices = s.choices;
    log('[복귀] 진행 중이던 결정이 있습니다 — 번호/명령을 입력하세요');
  }
  if (auto) {
    socket.emit('settings.auto', { autoWin: true, autoSkipCalls: true, autoTsumogiri: true });
  }
});

socket.on('server.error', (e: ServerErrorView) => log(`[오류:${e.code}] ${e.message}`));

function seatName(seat: number): string {
  return ['동가', '남가', '서가', '북가'][seat] ?? `${seat}`;
}

rl.on('line', (line) => {
  const input = line.trim();
  if (input === 'y') {
    socket.emit('lobby.fillAccept', { accept: true });
    return;
  }
  if (input === 'n') {
    socket.emit('lobby.fillAccept', { accept: false });
    return;
  }
  if (mySeat < 0) {
    if (isHost) {
      if (input === 'b') socket.emit('room.addBot');
      else socket.emit('room.start');
    }
    return;
  }
  const c = lastChoices;
  if (!c) return;
  if (c.kind === 'turn') {
    if (input === 't' && c.canTsumo) socket.emit('game.action', { type: 'tsumo' });
    else if (input === '9' && c.canKyuushu) socket.emit('game.action', { type: 'kyuushu' });
    else if (input === 'k' && c.ankanKinds.length > 0) {
      socket.emit('game.action', { type: 'ankan', kind: c.ankanKinds[0] });
    } else if (input.startsWith('r')) {
      const idx = Number(input.slice(1) || '0');
      const tileId = c.riichiDiscards[idx] ?? c.riichiDiscards[0];
      if (tileId !== undefined) {
        socket.emit('game.action', { type: 'discard', tileId, riichi: true });
      }
    } else {
      const idx = Number(input || 'NaN');
      const tileId = c.discards[idx] ?? (drawn !== null ? drawn : c.discards[0]);
      if (tileId !== undefined) socket.emit('game.action', { type: 'discard', tileId });
    }
  } else {
    if (input === 'r' && c.canRon) socket.emit('game.action', { type: 'ron' });
    else if (input === 'p' && c.canPon) socket.emit('game.action', { type: 'pon' });
    else if (input === 'k' && c.canDaiminkan) socket.emit('game.action', { type: 'daiminkan' });
    else if (input === 'c' && c.chiCombos.length > 0) {
      socket.emit('game.action', { type: 'chi', tiles: c.chiCombos[0] });
    } else socket.emit('game.action', { type: 'pass' });
  }
  lastChoices = null;
});
