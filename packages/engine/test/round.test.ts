import { describe, expect, it } from 'vitest';
import {
  applyAction,
  isFuriten,
  kindOfTile,
  reactionOffers,
  turnChoices,
  type RoundState,
  type Seat,
  type WinEntry,
} from '../src';
import { cycleTsumogiri, discardKind, passAll, rig, runOutTsumogiri, tsumogiri } from './round-helpers';

function winEntries(state: RoundState): readonly WinEntry[] {
  if (state.result?.type !== 'win') throw new Error('win 결과가 아님');
  return state.result.wins;
}

function yakuIdsOf(entry: WinEntry): string[] {
  return [...entry.agari.yakuman.map((y) => y.id), ...entry.agari.yaku.map((y) => y.id)];
}

describe('턴 진행과 화료', () => {
  it('친 배패 14장째 즉시 쯔모 = 천화', () => {
    const state = rig({
      hands: [
        '123m456m789m123p1z',
        '2358m2358p2358s2z',
        '2469m2469p2469s3z',
        '3578m3578p3578s4z',
      ],
      draws: ['1z'],
    });
    expect(turnChoices(state).canTsumo).toBe(true);
    applyAction(state, 0, { type: 'tsumo' });
    const [win] = winEntries(state);
    expect(yakuIdsOf(win as WinEntry)).toContain('tenhou');
  });

  it('기본 론: 점수 이동과 결과 기록', () => {
    const state = rig({
      hands: [
        '159m159p159s66s55z',
        '123m456p78s11122z', // 6s·9s 대기, 장풍 동
        '2358m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['6z'],
      doraInd: '5z', // 도라 = 6z (아무도 없음 — 점수 오염 방지)
    });
    discardKind(state, 0, '6s');
    const offers = reactionOffers(state);
    expect(offers.get(1)?.some((o) => o.type === 'ron')).toBe(true);
    applyAction(state, 1, { type: 'ron' });

    const [win] = winEntries(state);
    expect((win as WinEntry).seat).toBe(1);
    expect((win as WinEntry).from).toBe(0);
    expect((win as WinEntry).agari.fu).toBe(40);
    expect(state.result?.deltas).toEqual([-1300, 1300, 0, 0]);
    // 론패는 강에서 회수되어 화료자에게
    expect(state.players[0].discards.at(-1)?.calledBy).toBe(1);
  });
});

describe('후리텐 (§2.5)', () => {
  const hands: [string, string, string, string] = [
    '159m159p159s55z77z',
    '123m456p78s11122z', // 6s·9s 대기
    '159m159p129s66s44z',
    '2358m2358p38s66s3z',
  ];

  it('자기 버림패 후리텐: 론 불가', () => {
    const state = rig({ hands, draws: ['6z', '9s', '3z'] });
    tsumogiri(state, 0); // 6z
    passAll(state);
    tsumogiri(state, 1); // 9s — 자기 대기패를 버림
    passAll(state);
    expect(isFuriten(state, 1)).toBe(true);
    discardKind(state, 2, '6s');
    expect(reactionOffers(state).get(1)).toBeUndefined(); // s1에게 론 제공 없음
    passAll(state);
    expect(state.phase).toBe('turn');
    expect(state.active).toBe(3);
  });

  it('동순 후리텐: 패스하면 다음 자기 타패까지 론 불가, 이후 회복', () => {
    const state = rig({ hands, draws: ['6z', '3z', '3z', null, '4z', '4z'] });
    tsumogiri(state, 0);
    passAll(state);
    tsumogiri(state, 1);
    passAll(state);
    tsumogiri(state, 2);
    passAll(state);
    discardKind(state, 3, '6s'); // s1 대기패
    expect(reactionOffers(state).get(1)?.some((o) => o.type === 'ron')).toBe(true);
    passAll(state); // s1 패스 → 동순 후리텐
    expect(state.players[1].temporaryFuriten).toBe(true);
    expect(isFuriten(state, 1)).toBe(true);

    tsumogiri(state, 0);
    passAll(state);
    tsumogiri(state, 1); // 자기 타패 → 후리텐 해제
    passAll(state);
    expect(isFuriten(state, 1)).toBe(false);

    discardKind(state, 2, '6s');
    expect(reactionOffers(state).get(1)?.some((o) => o.type === 'ron')).toBe(true);
    applyAction(state, 1, { type: 'ron' });
    expect(state.result?.type).toBe('win');
  });
});

describe('리치 (§2.4)', () => {
  it('공탁·일발 쯔모·우라도라', () => {
    const state = rig({
      hands: [
        '159m159p159s55z66z',
        '234m456m789p45s22z', // 3s·6s 대기
        '2358m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['7z', '1z', '7z', '7z', '1z', '4z', null, null, null, '3s'],
      ura: '1z', // 우라도라 = 2z
    });
    cycleTsumogiri(state, 5); // s0 s1 s2 s3 s0
    // s1 두 번째 턴: 리치 선언 (첫 타패가 아니므로 더블리치 아님)
    const choices = turnChoices(state);
    expect(choices.riichiDiscards.length).toBeGreaterThan(0);
    const drawn = state.players[1].drawnTile as number;
    applyAction(state, 1, { type: 'discard', tileId: drawn, riichi: true });
    passAll(state);
    expect(state.players[1].riichi?.accepted).toBe(true);
    expect(state.pot).toBe(1);
    expect(state.scores[1]).toBe(24000);

    cycleTsumogiri(state, 3); // s2 s3 s0
    // s1 리치 후 첫 쯔모 = 3s → 일발 쯔모
    expect(turnChoices(state).canTsumo).toBe(true);
    applyAction(state, 1, { type: 'tsumo' });
    const [win] = winEntries(state);
    const ids = yakuIdsOf(win as WinEntry);
    expect(ids).toEqual(expect.arrayContaining(['riichi', 'ippatsu', 'menzenTsumo']));
    expect(ids).not.toContain('doubleRiichi');
    expect((win as WinEntry).agari.yaku.find((y) => y.id === 'uraDora')?.han).toBe(2);
    expect(state.pot).toBe(0); // 공탁 회수
  });

  it('리치 후 론을 놓치면 영구 후리텐 — 쯔모는 가능', () => {
    const state = rig({
      hands: [
        '159m159p159s55z66z',
        '234m456m789p45s22z',
        '1259m1259p33s67z3z',
        '2469m2469p2469s4z',
      ],
      draws: ['7z', '1z', '7z', '7z', '1z', '4z', null, null, null, '6s'],
    });
    cycleTsumogiri(state, 5);
    const drawn = state.players[1].drawnTile as number;
    applyAction(state, 1, { type: 'discard', tileId: drawn, riichi: true });
    passAll(state);

    // s2가 s1의 대기패 3s를 버림 → s1 패스 → 영구 후리텐
    discardKind(state, 2, '3s');
    expect(reactionOffers(state).get(1)?.some((o) => o.type === 'ron')).toBe(true);
    passAll(state);
    expect(state.players[1].riichiFuriten).toBe(true);

    tsumogiri(state, 3);
    passAll(state);
    tsumogiri(state, 0);
    passAll(state);
    // 이후 6s를 쯔모하면 화료 가능 (후리텐은 론만 막음)
    expect(turnChoices(state).canTsumo).toBe(true);
    applyAction(state, 1, { type: 'tsumo' });
    expect(state.result?.type).toBe('win');
  });

  it('점수 1,000 미만이면 리치 불가', () => {
    const state = rig({
      hands: [
        '159m159p159s55z66z',
        '234m456m789p45s22z',
        '2358m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['7z', '1z'],
      scores: [25000, 900, 25000, 25000],
    });
    tsumogiri(state, 0);
    passAll(state);
    expect(turnChoices(state).riichiDiscards).toEqual([]);
  });

  it('리치 후 안깡: 대기가 변하지 않을 때만 허용', () => {
    // 허용: 555z 보유 + 7z 단기 대기, 4번째 5z 쯔모
    const allowed = rig({
      hands: [
        '159m159p159s44z66z',
        '555z123m456p789s7z',
        '2358m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['1z', '2z', '1z', '2z', '1z', '3z', null, null, null, '5z'],
      rinshan: ['6z'],
    });
    cycleTsumogiri(allowed, 5);
    const drawnA = allowed.players[1].drawnTile as number;
    applyAction(allowed, 1, { type: 'discard', tileId: drawnA, riichi: true });
    passAll(allowed);
    cycleTsumogiri(allowed, 3);
    // s1이 5z(kind 31) 쯔모 → 안깡 허용
    expect(turnChoices(allowed).ankanKinds).toContain(31);
    applyAction(allowed, 1, { type: 'ankan', kind: 31 });
    expect(allowed.players[1].melds[0]?.type).toBe('ankan');
    expect(allowed.wall.doraRevealed).toBe(2); // 안깡 즉시 신도라
    expect(allowed.players[1].drawnTile).not.toBeNull(); // 영상패 쯔모

    // 불허: 대기가 바뀌는 안깡 (34555m에서 5m 깡 → 7z 샨퐁 대기 소실)
    const denied = rig({
      hands: [
        '169m159p159s44z66z',
        '34555m456p789s77z',
        '2368m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['1z', '2z', '1z', '2z', '1z', '3z', null, null, null, '5m'],
    });
    cycleTsumogiri(denied, 5);
    const drawnB = denied.players[1].drawnTile as number;
    applyAction(denied, 1, { type: 'discard', tileId: drawnB, riichi: true });
    passAll(denied);
    cycleTsumogiri(denied, 3);
    // s1이 4번째 5m 쯔모
    expect(kindOfTile(denied.players[1].drawnTile as number)).toBe(4); // 5m
    expect(turnChoices(denied).ankanKinds).not.toContain(4);
  });
});

describe('울기와 창깡 (§2.3)', () => {
  it('가깡에 창깡 성립, 깡은 무효화', () => {
    const state = rig({
      hands: [
        '5p159m19p159s55z46z',
        '345m345s67p99s111z', // 5p·8p 대기, 장풍
        '55p2358m2358s2s3z4z',
        '2469m2469p2469s7z',
      ],
      draws: ['6z', null, '1z', '2z', '5p'],
    });
    // s0이 5p 타패 → s2 퐁 (s1은 대기패 통과로 동순 후리텐)
    discardKind(state, 0, '5p');
    const offers = reactionOffers(state);
    expect(offers.get(2)?.some((o) => o.type === 'pon')).toBe(true);
    for (const seat of [...offers.keys()].sort()) {
      if (seat === 2) applyAction(state, 2 as Seat, { type: 'pon' });
      else applyAction(state, seat, { type: 'pass' });
    }
    expect(state.players[2].melds[0]?.type).toBe('pon');
    expect(state.players[1].temporaryFuriten).toBe(true);

    discardKind(state, 2, '4z'); // 퐁 후 타패
    passAll(state);
    tsumogiri(state, 3);
    passAll(state);
    tsumogiri(state, 0);
    passAll(state);
    tsumogiri(state, 1); // s1 자기 타패 → 후리텐 해제
    passAll(state);
    expect(isFuriten(state, 1)).toBe(false);

    // s2가 4번째 5p 쯔모 → 가깡 → s1 창깡
    const choices = turnChoices(state);
    expect(choices.shouminkanTiles.length).toBe(1);
    applyAction(state, 2, { type: 'shouminkan', tileId: choices.shouminkanTiles[0] as number });
    expect(state.phase).toBe('reaction');
    applyAction(state, 1, { type: 'ron' });

    const [win] = winEntries(state);
    expect(yakuIdsOf(win as WinEntry)).toContain('chankan');
    expect((win as WinEntry).from).toBe(2);
    // 깡 무효 → 퐁 유지, 깡 카운트 0
    expect(state.players[2].melds[0]?.type).toBe('pon');
    expect(state.totalKans).toBe(0);
  });

  it('쿠이카에 금지: 같은 종류·스지 반대끝 즉시 타패 불가', () => {
    const state = rig({
      hands: [
        '3m159m19p159s55z67z',
        '134569m19p19s177z',
        '2358m2358p2358s3z',
        '2469m2469p2469s4z',
      ],
      draws: ['6z'],
    });
    discardKind(state, 0, '3m');
    const offers = reactionOffers(state);
    const chi = offers.get(1)?.find((o) => o.type === 'chi');
    expect(chi && chi.type === 'chi' ? chi.combos.length : 0).toBe(1);
    const combo = (chi as { combos: ReadonlyArray<readonly [number, number]> }).combos[0];
    applyAction(state, 1, { type: 'chi', tiles: combo as [number, number] });

    const discards = turnChoices(state).discards.map(kindOfTile);
    expect(discards).not.toContain(2); // 3m (같은 종류)
    expect(discards).not.toContain(5); // 6m (반대끝)
    expect(discards).toContain(0); // 1m은 가능
  });
});

describe('더블론·트리플론 (§2.2)', () => {
  it('더블론: 공탁·본장은 방총자에서 가까운 화료자에게', () => {
    const state = rig({
      hands: [
        '159m124p159s44z77z',
        '111m555z45m678p99s', // 3m·6m 대기, 백
        '3m39m129p1259s37z2z',
        '666z45m345p22s678s', // 3m·6m 대기, 발
      ],
      draws: ['4z', '4z', '2z'],
      honba: 1,
      pot: 2,
      doraInd: '2z', // 도라 = 3z (화료자 손에 없음)
    });
    tsumogiri(state, 0);
    passAll(state);
    tsumogiri(state, 1);
    passAll(state);
    discardKind(state, 2, '3m');
    expect(reactionOffers(state).size).toBe(2);
    applyAction(state, 1, { type: 'ron' });
    applyAction(state, 3, { type: 'ron' });

    const wins = winEntries(state);
    expect(wins.map((w) => w.seat)).toEqual([3, 1]); // 반시계로 s3이 먼저
    // s3: 1300 + 본장300 + 공탁2000 / s1: 1600 / s2: -3200
    expect(state.result?.deltas).toEqual([0, 1600, -3200, 3600]);
    expect(state.pot).toBe(0);
  });

  it('트리플론 유국 (기본) / 토글 OFF면 3인 화료', () => {
    const tripleHands: [string, string, string, string] = [
      '777z45m345p22s678s', // 3m·6m 대기, 중
      '111m555z45m678p99s', // 3m·6m 대기, 백
      '3m139m129p159s137z',
      '666z45m345s22p678p', // 3m·6m 대기, 발
    ];

    const draw = rig({ hands: tripleHands, draws: ['4z', '2z'], dealer: 1 });
    tsumogiri(draw, 1);
    passAll(draw);
    discardKind(draw, 2, '3m');
    expect(reactionOffers(draw).size).toBe(3);
    applyAction(draw, 0, { type: 'ron' });
    applyAction(draw, 1, { type: 'ron' });
    applyAction(draw, 3, { type: 'ron' });
    expect(draw.result?.type).toBe('abortive');
    expect(draw.result?.type === 'abortive' && draw.result.reason).toBe('tripleRon');

    const allowed = rig({
      hands: tripleHands,
      draws: ['4z', '2z'],
      dealer: 1,
      rules: { tripleRonDraw: false },
    });
    tsumogiri(allowed, 1);
    passAll(allowed);
    discardKind(allowed, 2, '3m');
    applyAction(allowed, 0, { type: 'ron' });
    applyAction(allowed, 1, { type: 'ron' });
    applyAction(allowed, 3, { type: 'ron' });
    expect(allowed.result?.type).toBe('win');
    expect(winEntries(allowed)).toHaveLength(3);
  });
});

describe('유국 (§2.9)', () => {
  it('나가시만관: 요구패만 버리고 울리지 않으면 만관 지급', () => {
    // 다른 좌석 보유분을 피해 잔여 3장인 종류만 사용
    const yaochuuDraws = [
      '1z', '1z', '1z', '1m', '1m', '1m', '1p', '1p', '1p',
      '1s', '1s', '1s', '5z', '5z', '5z', '6z', '6z', '6z',
    ];
    const state = rig({
      hands: [
        '2358m2358p2358s2z',
        '19m19p19s1234567z',
        '2469m2469p2469s3z',
        '3578m3578p3578s4z',
      ],
      draws: Array.from({ length: 70 }, (_, i) =>
        i % 4 === 1 ? (yaochuuDraws[Math.floor(i / 4)] ?? null) : null,
      ),
    });
    runOutTsumogiri(state);
    expect(state.result?.type).toBe('exhaustive');
    if (state.result?.type === 'exhaustive') {
      expect(state.result.nagashi).toEqual([1]);
      expect(state.result.deltas).toEqual([-4000, 8000, -2000, -2000]);
    }
  });

  it('노텐벌부: 1인 텐파이 3,000점 이동', () => {
    const state = rig({
      hands: [
        '2358m2358p2358s2z',
        '2469m2469p2469s3z',
        '123m456m789m123p1z', // 텐파이
        '3578m3578p3578s4z',
      ],
    });
    runOutTsumogiri(state);
    expect(state.result?.type).toBe('exhaustive');
    if (state.result?.type === 'exhaustive') {
      expect(state.result.tenpai).toEqual([false, false, true, false]);
      expect(state.result.deltas).toEqual([-1000, -1000, 3000, -1000]);
      expect(state.result.dealerRepeats).toBe(false);
    }
  });

  it('노텐벌부: 2:2는 1,500점씩', () => {
    const state = rig({
      hands: [
        '123m456m789m123p1z', // 텐파이
        '2469m2469p2469s3z',
        '123s456s789s123p9p', // 텐파이
        '3578m3578p3578s4z',
      ],
    });
    runOutTsumogiri(state);
    expect(state.result?.type).toBe('exhaustive');
    if (state.result?.type === 'exhaustive') {
      expect(state.result.tenpai).toEqual([true, false, true, false]);
      expect(state.result.deltas).toEqual([1500, -1500, 1500, -1500]);
      expect(state.result.dealerRepeats).toBe(true);
    }
  });

  it('해저모월: 마지막 쯔모 화료', () => {
    const state = rig({
      hands: [
        '2358m2358p2358s2z',
        '123m456m789m123p1z',
        '2469m2469p2469s3z',
        '3578m3578p3578s4z',
      ],
      draws: Array.from({ length: 70 }, (_, i) => (i === 69 ? '1z' : null)),
    });
    let guard = 0;
    while (state.phase !== 'ended') {
      if (++guard > 400) throw new Error('진행 오류');
      if (state.phase === 'turn') {
        if (state.active === 1 && state.wall.liveRemaining === 0 && turnChoices(state).canTsumo) {
          applyAction(state, 1, { type: 'tsumo' });
          break;
        }
        tsumogiri(state, state.active);
      } else {
        passAll(state);
      }
    }
    const [win] = winEntries(state);
    expect(yakuIdsOf(win as WinEntry)).toContain('haitei');
  });

  it('하저로어: 마지막 타패 론', () => {
    const state = rig({
      hands: [
        '2358m2358p25s122z', // 1z·2z 잔여분 보유 (유출 방지)
        '2469m2469p2469s3z',
        '3578m3578p3578s4z',
        '123m456p789s22z11z', // 1z·2z 샨퐁 대기, 장풍
      ],
      draws: Array.from({ length: 70 }, (_, i) => (i === 69 ? '1z' : null)),
    });
    let guard = 0;
    while (state.phase !== 'ended') {
      if (++guard > 500) throw new Error('진행 오류');
      if (state.phase === 'turn') {
        tsumogiri(state, state.active);
      } else {
        const offers = reactionOffers(state);
        if (state.wall.liveRemaining === 0 && offers.get(3)?.some((o) => o.type === 'ron')) {
          applyAction(state, 3, { type: 'ron' });
          continue;
        }
        passAll(state);
      }
    }
    const [win] = winEntries(state);
    expect(yakuIdsOf(win as WinEntry)).toContain('houtei');
  });
});

describe('도중유국 (§2.9)', () => {
  it('구종구패', () => {
    const state = rig({
      hands: [
        '19m19p19s123456z2m',
        '2358m2358p2358s7z',
        '2469m2469p2469s7z',
        '3578m3578p3578s7z',
      ],
      draws: ['5m'],
    });
    expect(turnChoices(state).canKyuushu).toBe(true);
    applyAction(state, 0, { type: 'kyuushu' });
    expect(state.result?.type).toBe('abortive');
    expect(state.result?.type === 'abortive' && state.result.reason).toBe('kyuushu');
  });

  it('사풍연타: 첫 바퀴 4인이 같은 풍패', () => {
    const state = rig({
      hands: [
        '1z2358m2358p2358s',
        '1z2469m2469p2469s',
        '1z3578m3578p3578s',
        '1z2345m2345p234s2s',
      ],
      draws: ['5z', '5z', '5z', '5z'],
    });
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      discardKind(state, seat, '1z');
      passAll(state);
    }
    expect(state.result?.type === 'abortive' && state.result.reason).toBe('suufonRenda');
  });

  it('사가리치: 4인 전원 리치', () => {
    const state = rig({
      hands: [
        '123m456m789m99p11z',
        '123p456p789p99s22z',
        '123s456s789s11m33z',
        '234m567p234s88s44z',
      ],
      draws: ['6z', '6z', '6z', '6z'],
    });
    for (const seat of [0, 1, 2, 3] as Seat[]) {
      const drawn = state.players[seat].drawnTile as number;
      applyAction(state, seat, { type: 'discard', tileId: drawn, riichi: true });
      passAll(state);
      if (state.phase === 'ended') break;
    }
    expect(state.result?.type === 'abortive' && state.result.reason).toBe('suuchaRiichi');
    expect(state.pot).toBe(4);
    expect(state.result?.deltas).toEqual([-1000, -1000, -1000, -1000]);
  });

  it('사깡산료: 2인이 합계 4깡 후 타패 통과', () => {
    const state = rig({
      hands: [
        '11112222m567p19s',
        '33334444p123s89m',
        '4689m2689p2469s3z',
        '3578m5789p3578s4z',
      ],
      draws: ['5z', '6z'],
      rinshan: ['7z', '7z', '7z', '7z'],
    });
    applyAction(state, 0, { type: 'ankan', kind: 0 });
    applyAction(state, 0, { type: 'ankan', kind: 1 });
    tsumogiri(state, 0);
    passAll(state);
    applyAction(state, 1, { type: 'ankan', kind: 11 });
    applyAction(state, 1, { type: 'ankan', kind: 12 });
    expect(state.totalKans).toBe(4);
    tsumogiri(state, 1);
    passAll(state);
    expect(state.result?.type === 'abortive' && state.result.reason).toBe('suukaikan');
    expect(state.wall.doraRevealed).toBe(5);
  });
});
