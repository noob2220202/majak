import { describe, expect, it } from 'vitest';
import { basePointsOf, DEFAULT_RULES, ronPoints, tsumoPayments } from '../src';
import { winResult } from './helpers';

const rules = DEFAULT_RULES;

describe('§2.8 검증용 확정값', () => {
  it('자 론 30부 4판 = 7,700 / 친 론 = 11,600', () => {
    // 리치 + 핑후 + 탕야오 + 이페코 = 4판, 멘젠 론 핑후 = 30부
    const r = winResult({ hand: '22334455m567p678s', win: '6s', riichi: true });
    expect(r?.han).toBe(4);
    expect(r?.fu).toBe(30);
    expect(ronPoints(r?.basePoints ?? 0, false)).toBe(7700);
    expect(ronPoints(r?.basePoints ?? 0, true)).toBe(11600);
  });

  it('핑후쯔모 20부 4판 = 1,300 / 2,600', () => {
    // 리치 + 일발 + 멘젠쯔모 + 핑후 = 4판 20부
    const r = winResult({
      hand: '234m456m789p456s22s',
      win: '6s',
      type: 'tsumo',
      riichi: true,
      ippatsu: true,
    });
    expect(r?.han).toBe(4);
    expect(r?.fu).toBe(20);
    const pay = tsumoPayments(r?.basePoints ?? 0, false);
    expect(pay.fromNonDealer).toBe(1300);
    expect(pay.fromDealer).toBe(2600);
  });

  it('치토이 25부 3판 자 론 = 3,200', () => {
    const r = winResult({ hand: '1122m3344p55s66z77z', win: '7z', riichi: true });
    expect(r?.han).toBe(3);
    expect(r?.fu).toBe(25);
    expect(ronPoints(r?.basePoints ?? 0, false)).toBe(3200);
  });

  it('자 론 40부 2판 = 2,600', () => {
    // 산색동순(멘젠 2판), 간짱 대기 → 20+10+2 = 32 → 40부
    const r = winResult({ hand: '234m567m234p234s99s', win: '3s' });
    expect(r?.han).toBe(2);
    expect(r?.fu).toBe(40);
    expect(ronPoints(r?.basePoints ?? 0, false)).toBe(2600);
  });
});

describe('부 계산 특례', () => {
  it('울고 핑후형 론 = 30부 처리', () => {
    // 치 + 전부 슌쯔 + 비역패 머리 + 량면 론: 20부가 되므로 30부로 처리
    const r = winResult({
      hand: '345678p55s678s',
      win: '8s',
      type: 'ron',
      melds: [{ type: 'chi', tiles: '234m' }],
    });
    expect(r?.fu).toBe(30);
  });

  it('울고 핑후형 쯔모 = 22 → 30부 절상', () => {
    const r = winResult({
      hand: '345678p55s678s',
      win: '8s',
      type: 'tsumo',
      melds: [{ type: 'chi', tiles: '234m' }],
    });
    expect(r?.fu).toBe(30);
  });

  it('연풍패 머리 4부 (토글 시 2부)', () => {
    const spec = {
      hand: '111m345p667788s11z',
      win: '8s',
      seat: 'E',
      round: 'E',
    } as const;
    // 20 + 10(멘젠 론) + 8(노두 안커) + 4(연풍 머리) = 42 → 50부
    expect(winResult(spec)?.fu).toBe(50);
    // 2부 옵션: 40 → 40부
    expect(winResult({ ...spec, rules: { renpuuJantouFu: 2 } })?.fu).toBe(40);
  });

  it('안깡·밍깡·요구패 배수', () => {
    // 20 + 2(쯔모) + 32(노두 안깡 9m) + 8(중장 밍깡 5p) + 8(발 안커) + 2(단기) = 72 → 80부
    const r = winResult({
      hand: '345m666z55s',
      win: '5s',
      type: 'tsumo',
      melds: [
        { type: 'ankan', tiles: '9999m' },
        { type: 'daiminkan', tiles: '5555p', from: 1 },
      ],
    });
    expect(r?.fu).toBe(80);
    expect(r?.yaku.some((y) => y.id === 'rinshan')).toBe(false);
  });

  it('샨퐁 론 커쯔는 밍커 취급 (부수도 2)', () => {
    // 888s를 론으로 완성: 안커(8)가 아니라 밍커(2)
    const ron = winResult({ hand: '222m345p678p888s99s', win: '8s', type: 'ron', riichi: true });
    // 20+10(멘젠 론)+4(222m 안커)+2(888s 밍커) = 36 → 40
    expect(ron?.fu).toBe(40);
    const tsumo = winResult({ hand: '222m345p678p888s99s', win: '8s', type: 'tsumo', riichi: true });
    // 20+2(쯔모)+4(222m 안커)+4(888s 쯔모 완성 안커, 중장) = 30
    expect(tsumo?.fu).toBe(30);
  });
});

describe('점수표 (기본점과 절삭)', () => {
  const b = (han: number, fu: number) => basePointsOf(han, fu, rules);

  it('일반 구간', () => {
    expect(b(1, 30)).toEqual({ basePoints: 240, limit: null });
    expect(b(2, 30)).toEqual({ basePoints: 480, limit: null });
    expect(b(3, 30)).toEqual({ basePoints: 960, limit: null });
    expect(b(4, 30)).toEqual({ basePoints: 1920, limit: null });
    expect(b(1, 40)).toEqual({ basePoints: 320, limit: null });
    expect(b(2, 25)).toEqual({ basePoints: 400, limit: null });
    expect(b(3, 25)).toEqual({ basePoints: 800, limit: null });
    expect(b(2, 70)).toEqual({ basePoints: 1120, limit: null });
    expect(b(3, 60)).toEqual({ basePoints: 1920, limit: null });
  });

  it('기본점 2,000 초과는 만관 절삭', () => {
    expect(b(4, 40)).toEqual({ basePoints: 2000, limit: '만관' }); // 2560 → 절삭
    expect(b(3, 70)).toEqual({ basePoints: 2000, limit: '만관' }); // 2240 → 절삭
    expect(b(5, 30)).toEqual({ basePoints: 2000, limit: '만관' });
  });

  it('하네만·배만·삼배만·카조에 역만', () => {
    expect(b(6, 30)).toEqual({ basePoints: 3000, limit: '하네만' });
    expect(b(7, 70)).toEqual({ basePoints: 3000, limit: '하네만' });
    expect(b(8, 20)).toEqual({ basePoints: 4000, limit: '배만' });
    expect(b(10, 70)).toEqual({ basePoints: 4000, limit: '배만' });
    expect(b(11, 20)).toEqual({ basePoints: 6000, limit: '삼배만' });
    expect(b(12, 70)).toEqual({ basePoints: 6000, limit: '삼배만' });
    expect(b(13, 20)).toEqual({ basePoints: 8000, limit: '역만' });
    expect(b(26, 20)).toEqual({ basePoints: 8000, limit: '역만' });
  });

  it('키리아게 만관 토글', () => {
    const kiriage = { ...rules, kiriageMangan: true };
    expect(basePointsOf(4, 30, kiriage)).toEqual({ basePoints: 2000, limit: '만관' });
    expect(basePointsOf(3, 60, kiriage)).toEqual({ basePoints: 2000, limit: '만관' });
    expect(basePointsOf(3, 50, kiriage).limit).toBeNull();
    expect(basePointsOf(4, 30, rules).basePoints).toBe(1920); // 기본 OFF
  });

  it('카조에 OFF면 삼배만 상한', () => {
    const noKazoe = { ...rules, kazoeYakuman: false };
    expect(basePointsOf(13, 30, noKazoe)).toEqual({ basePoints: 6000, limit: '삼배만' });
  });
});

describe('지불 계산', () => {
  it('론: 자 ×4 / 친 ×6, 100점 절상', () => {
    expect(ronPoints(240, false)).toBe(1000);
    expect(ronPoints(240, true)).toBe(1500);
    expect(ronPoints(960, false)).toBe(3900);
    expect(ronPoints(960, true)).toBe(5800);
    expect(ronPoints(2000, false)).toBe(8000);
    expect(ronPoints(2000, true)).toBe(12000);
    expect(ronPoints(8000, false)).toBe(32000);
    expect(ronPoints(8000, true)).toBe(48000);
  });

  it('쯔모: 자 화료 (친 2배 + 자 1배) / 친 화료 (전원 2배)', () => {
    expect(tsumoPayments(960, false)).toEqual({ fromDealer: 2000, fromNonDealer: 1000 });
    expect(tsumoPayments(960, true)).toEqual({ fromDealer: 0, fromNonDealer: 2000 });
    expect(tsumoPayments(2000, false)).toEqual({ fromDealer: 4000, fromNonDealer: 2000 });
    expect(tsumoPayments(2000, true)).toEqual({ fromDealer: 0, fromNonDealer: 4000 });
    // 하네만 자 쯔모 3,000/6,000
    expect(tsumoPayments(3000, false)).toEqual({ fromDealer: 6000, fromNonDealer: 3000 });
  });

  it('역만 지불: 32,000 / 48,000, 더블 64,000', () => {
    expect(ronPoints(16000, false)).toBe(64000);
    expect(tsumoPayments(8000, false)).toEqual({ fromDealer: 16000, fromNonDealer: 8000 });
  });
});
