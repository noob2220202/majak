import { describe, expect, it } from 'vitest';
import { hanOf, winResult, yakuIds } from './helpers';

describe('상황역', () => {
  const base = { hand: '22334455m567p678s', win: '6s' } as const;

  it('리치·일발·멘젠쯔모', () => {
    const r = winResult({ ...base, type: 'tsumo', riichi: true, ippatsu: true });
    expect(yakuIds(r)).toEqual(
      expect.arrayContaining(['riichi', 'ippatsu', 'menzenTsumo', 'pinfu', 'tanyao', 'iipeiko']),
    );
  });

  it('더블리치는 리치를 대체하고 2판', () => {
    const r = winResult({ ...base, doubleRiichi: true });
    expect(yakuIds(r)).toContain('doubleRiichi');
    expect(yakuIds(r)).not.toContain('riichi');
    expect(hanOf(r, 'doubleRiichi')).toBe(2);
  });

  it('해저모월은 쯔모, 하저로어는 론에서만', () => {
    expect(yakuIds(winResult({ ...base, type: 'tsumo', haitei: true }))).toContain('haitei');
    expect(yakuIds(winResult({ ...base, type: 'ron', haitei: true }))).not.toContain('haitei');
    expect(yakuIds(winResult({ ...base, type: 'ron', houtei: true }))).toContain('houtei');
    expect(yakuIds(winResult({ ...base, type: 'tsumo', houtei: true }))).not.toContain('houtei');
  });

  it('영상개화·창깡', () => {
    expect(yakuIds(winResult({ ...base, type: 'tsumo', rinshan: true }))).toContain('rinshan');
    expect(yakuIds(winResult({ ...base, type: 'ron', chankan: true }))).toContain('chankan');
  });

  it('오픈 손은 멘젠쯔모 없음', () => {
    const r = winResult({
      hand: '345678p55s678s',
      win: '8s',
      type: 'tsumo',
      melds: [{ type: 'chi', tiles: '234m' }],
    });
    expect(yakuIds(r)).not.toContain('menzenTsumo');
  });
});

describe('핑후', () => {
  it('성립: 전부 슌쯔 + 비역패 머리 + 량면', () => {
    const r = winResult({ hand: '234m456m789p456s22s', win: '6s', type: 'tsumo' });
    expect(yakuIds(r)).toContain('pinfu');
    expect(r?.fu).toBe(20);
  });

  it('불성립: 간짱 대기', () => {
    const r = winResult({ hand: '234m567m234p234s99s', win: '3s' });
    expect(yakuIds(r)).not.toContain('pinfu');
  });

  it('불성립: 역패 머리 (자풍)', () => {
    // 남가 좌석(기본) + 남 머리
    const r = winResult({ hand: '234m456m789p456s22z', win: '6s' });
    expect(yakuIds(r)).not.toContain('pinfu');
  });
});

describe('탕야오·쿠이탕', () => {
  it('멘젠 탕야오', () => {
    expect(yakuIds(winResult({ hand: '22334455m567p678s', win: '6s' }))).toContain('tanyao');
  });

  it('쿠이탕 ON: 오픈 탕야오 인정', () => {
    const r = winResult({
      hand: '345678p55s678s',
      win: '8s',
      melds: [{ type: 'chi', tiles: '234m' }],
    });
    expect(yakuIds(r)).toContain('tanyao');
    expect(hanOf(r, 'tanyao')).toBe(1);
  });

  it('쿠이탕 OFF: 오픈 탕야오뿐이면 화료 불가(null)', () => {
    const r = winResult({
      hand: '345678p55s678s',
      win: '8s',
      melds: [{ type: 'chi', tiles: '234m' }],
      rules: { kuitan: false },
    });
    expect(r).toBeNull();
  });

  it('불성립: 요구패 포함', () => {
    expect(yakuIds(winResult({ hand: '234m456m789p456s22s', win: '6s' }))).not.toContain('tanyao');
  });
});

describe('이페코·량페코', () => {
  it('이페코 성립 (멘젠)', () => {
    expect(yakuIds(winResult({ hand: '111m345p667788s11z', win: '8s' }))).toContain('iipeiko');
  });

  it('량페코는 치토이보다 우선 채택 (고점법)', () => {
    const r = winResult({ hand: '334455m334455p22s', win: '5p' });
    expect(yakuIds(r)).toContain('ryanpeiko');
    expect(yakuIds(r)).not.toContain('chiitoi');
    expect(hanOf(r, 'ryanpeiko')).toBe(3);
  });

  it('오픈이면 이페코 없음', () => {
    const r = winResult({
      hand: '345p667788s11z',
      win: '8s',
      melds: [{ type: 'pon', tiles: '111z', from: 1 }],
    });
    expect(yakuIds(r)).not.toContain('iipeiko');
  });
});

describe('역패', () => {
  it('삼원패 + 중복 가산 (연풍 동): 장풍·자풍 각각 1판', () => {
    const r = winResult({
      hand: '111z234m567p888s99s',
      win: '9s',
      type: 'tsumo',
      seat: 'E',
      round: 'E',
    });
    expect(yakuIds(r)).toEqual(expect.arrayContaining(['roundWind', 'seatWind']));
  });

  it('삼원패 백·발 + 쇼산겐', () => {
    const r = winResult({ hand: '555z666z77z123m456p', win: '3m' });
    expect(yakuIds(r)).toEqual(
      expect.arrayContaining(['shousangen', 'yakuhai:5z', 'yakuhai:6z']),
    );
    expect(r?.han).toBe(4);
  });

  it('객풍(다른 풍) 커쯔는 역이 아님', () => {
    // 남가(기본 좌석 S) + 장풍 동: 북 커쯔는 무역
    const r = winResult({ hand: '444z234m567p888s99s', win: '9s', type: 'ron' });
    expect(yakuIds(r ?? null)).not.toContain('roundWind');
    expect(yakuIds(r ?? null)).not.toContain('seatWind');
  });
});

describe('치토이츠', () => {
  it('성립 + 25부', () => {
    const r = winResult({ hand: '1122m3344p55s66z77z', win: '7z', riichi: true });
    expect(yakuIds(r)).toContain('chiitoi');
    expect(r?.fu).toBe(25);
    expect(r?.han).toBe(3); // 치토이 2 + 리치 1
  });

  it('같은 패 4장은 치토이 불성립', () => {
    const r = winResult({ hand: '11112233445566m', win: '6m' });
    expect(yakuIds(r ?? null)).not.toContain('chiitoi');
  });
});

describe('커쯔 계열', () => {
  it('토이토이 + 산안커 (쯔모 완성 안커 포함)', () => {
    const r = winResult({
      hand: '111m222m333s44s',
      win: '3s',
      type: 'tsumo',
      melds: [{ type: 'pon', tiles: '999p', from: 1 }],
    });
    expect(yakuIds(r)).toEqual(expect.arrayContaining(['toitoi', 'sanankou']));
  });

  it('론으로 완성한 커쯔는 안커가 아니다 (산안커 탈락)', () => {
    const r = winResult({
      hand: '111m222m333s44s',
      win: '3s',
      type: 'ron',
      melds: [{ type: 'pon', tiles: '999p', from: 1 }],
    });
    expect(yakuIds(r)).toContain('toitoi');
    expect(yakuIds(r)).not.toContain('sanankou');
  });

  it('혼로두 + 토이토이 + 산안커 (론)', () => {
    const r = winResult({ hand: '111999m111999p11z', win: '9p', type: 'ron' });
    expect(yakuIds(r)).toEqual(expect.arrayContaining(['honroutou', 'toitoi', 'sanankou']));
    expect(yakuIds(r)).not.toContain('suuankou');
  });

  it('산깡즈', () => {
    const r = winResult({
      hand: '234m55p',
      win: '4m',
      melds: [
        { type: 'ankan', tiles: '1111z' },
        { type: 'daiminkan', tiles: '9999p', from: 1 },
        { type: 'shouminkan', tiles: '8888s', from: 2 },
      ],
    });
    expect(yakuIds(r)).toContain('sankantsu');
  });

  it('산색동각', () => {
    const r = winResult({ hand: '222m222p222s567m99s', win: '7m' });
    expect(yakuIds(r)).toContain('sanshokuDoukou');
  });
});

describe('슌쯔 계열', () => {
  it('산색동순 멘젠 2판 / 오픈 1판', () => {
    const closed = winResult({ hand: '234m567m234p234s99s', win: '3s' });
    expect(hanOf(closed, 'sanshokuDoujun')).toBe(2);
    const open = winResult({
      hand: '234m234s567m99m',
      win: '4s',
      melds: [{ type: 'chi', tiles: '234p' }],
    });
    expect(hanOf(open, 'sanshokuDoujun')).toBe(1);
  });

  it('일기통관 멘젠 2판 / 오픈 1판', () => {
    const closed = winResult({ hand: '123456789m11z234p', win: '4p' });
    expect(hanOf(closed, 'ittsu')).toBe(2);
    const open = winResult({
      hand: '456789m11z234p',
      win: '4p',
      melds: [{ type: 'chi', tiles: '123m' }],
    });
    expect(hanOf(open, 'ittsu')).toBe(1);
  });

  it('찬타(자패 포함) / 준찬타(노두만)', () => {
    const chanta = winResult({ hand: '123m789p789s111z99s', win: '9s' });
    expect(hanOf(chanta, 'chanta')).toBe(2);
    expect(yakuIds(chanta)).not.toContain('junchan');
    const junchan = winResult({ hand: '123m999m789p789s11s', win: '1s' });
    expect(hanOf(junchan, 'junchan')).toBe(3);
  });

  it('슌쯔 없는 손은 찬타 불성립 (혼로두 계열)', () => {
    const r = winResult({ hand: '111999m111999p11z', win: '9p' });
    expect(yakuIds(r)).not.toContain('chanta');
  });
});

describe('염색', () => {
  it('혼일색 멘젠 3판 / 오픈 2판', () => {
    const closed = winResult({ hand: '123m789m555m111z22z', win: '2z' });
    expect(hanOf(closed, 'honitsu')).toBe(3);
    const open = winResult({
      hand: '123m789m555m22z',
      win: '2m',
      melds: [{ type: 'pon', tiles: '111z', from: 1 }],
    });
    expect(hanOf(open, 'honitsu')).toBe(2);
  });

  it('청일색 멘젠 6판 / 오픈 5판', () => {
    const closed = winResult({ hand: '11223344556677m', win: '7m' });
    expect(hanOf(closed, 'chinitsu')).toBe(6);
    const open = winResult({
      hand: '445566m789m22m',
      win: '6m',
      melds: [{ type: 'chi', tiles: '123m' }],
    });
    expect(hanOf(open, 'chinitsu')).toBe(5);
  });
});

describe('역만', () => {
  it('스안커 (쯔모)', () => {
    const r = winResult({ hand: '111999m111999p11z', win: '9p', type: 'tsumo' });
    expect(yakuIds(r)).toContain('suuankou');
    expect(r?.yakumanPower).toBe(1);
  });

  it('스안커 단기 더블 (론 가능)', () => {
    const r = winResult({ hand: '111m222m333p444p55s', win: '5s', type: 'ron' });
    expect(yakuIds(r)).toContain('suuankouTanki');
    expect(r?.yakumanPower).toBe(2);
  });

  it('더블역만 OFF면 스안커 단기도 1배', () => {
    const r = winResult({
      hand: '111m222m333p444p55s',
      win: '5s',
      rules: { doubleYakuman: false },
    });
    expect(r?.yakumanPower).toBe(1);
  });

  it('대삼원 + 파오 (3번째 삼원 부로)', () => {
    const r = winResult({
      hand: '234m55p',
      win: '4m',
      melds: [
        { type: 'pon', tiles: '555z', from: 1 },
        { type: 'pon', tiles: '666z', from: 2 },
        { type: 'pon', tiles: '777z', from: 0 },
      ],
    });
    expect(yakuIds(r)).toContain('daisangen');
    expect(r?.paoMeldIndex).toBe(2);
  });

  it('삼원 안커가 손안에 있으면 파오 없음', () => {
    const r = winResult({
      hand: '777z234m55p',
      win: '4m',
      melds: [
        { type: 'pon', tiles: '555z', from: 1 },
        { type: 'pon', tiles: '666z', from: 2 },
      ],
    });
    expect(yakuIds(r)).toContain('daisangen');
    expect(r?.paoMeldIndex).toBeNull();
  });

  it('소사희 / 대사희(더블) + 스안커 단기 복합', () => {
    const shou = winResult({ hand: '111z222z333z44z567m', win: '7m' });
    expect(yakuIds(shou)).toContain('shousuushii');

    const dai = winResult({ hand: '111z222z333z444z55m', win: '5m', type: 'tsumo' });
    expect(yakuIds(dai)).toEqual(expect.arrayContaining(['daisuushii', 'suuankouTanki']));
    expect(dai?.yakumanPower).toBe(4); // 더블 + 더블

    const single = winResult({
      hand: '111z222z333z444z55m',
      win: '5m',
      type: 'tsumo',
      rules: { multipleYakuman: false },
    });
    expect(single?.yakumanPower).toBe(2); // 최고 1개만
  });

  it('자일색 (치토이 형태 포함)', () => {
    const r = winResult({ hand: '11223344556677z', win: '7z' });
    expect(yakuIds(r)).toContain('tsuuiisou');
  });

  it('청노두 + 스안커 복합', () => {
    const r = winResult({ hand: '111999m111999p11s', win: '9p', type: 'tsumo' });
    expect(yakuIds(r)).toEqual(expect.arrayContaining(['chinroutou', 'suuankou']));
    expect(r?.yakumanPower).toBe(2);
  });

  it('녹일색', () => {
    const r = winResult({ hand: '223344s666s88s666z', win: '4s' });
    expect(yakuIds(r)).toContain('ryuuiisou');
  });

  it('스깡즈', () => {
    const r = winResult({
      hand: '55p',
      win: '5p',
      melds: [
        { type: 'ankan', tiles: '1111m' },
        { type: 'daiminkan', tiles: '9999p', from: 1 },
        { type: 'shouminkan', tiles: '2222s', from: 2 },
        { type: 'ankan', tiles: '7777z' },
      ],
    });
    expect(yakuIds(r)).toContain('suukantsu');
  });

  it('국사무쌍 13면 더블 / 단일 대기 싱글', () => {
    const thirteen = winResult({ hand: '19m19p19s12345677z', win: '7z' });
    expect(yakuIds(thirteen)).toContain('kokushi13');
    expect(thirteen?.yakumanPower).toBe(2);

    const single = winResult({ hand: '19m19p19s12345677z', win: '1m' });
    expect(yakuIds(single)).toContain('kokushi');
    expect(single?.yakumanPower).toBe(1);
  });

  it('구련보등 / 순정구련보등(더블)', () => {
    const junsei = winResult({ hand: '11123455678999m', win: '5m', type: 'tsumo' });
    expect(yakuIds(junsei)).toContain('junseiChuuren');
    expect(junsei?.yakumanPower).toBe(2);

    const normal = winResult({ hand: '11112345678999m', win: '9m', type: 'tsumo' });
    expect(yakuIds(normal)).toContain('chuuren');
    expect(normal?.yakumanPower).toBe(1);
  });

  it('천화·지화', () => {
    const tenhou = winResult({ hand: '22334455m567p678s', win: '6s', type: 'tsumo', tenhou: true, seat: 'E', round: 'E' });
    expect(yakuIds(tenhou)).toContain('tenhou');
    const chihou = winResult({ hand: '22334455m567p678s', win: '6s', type: 'tsumo', chihou: true });
    expect(yakuIds(chihou)).toContain('chihou');
  });
});

describe('도라', () => {
  it('도라·적도라·우라도라는 역이 아니고 판수만 가산', () => {
    const r = winResult({
      hand: '22334405m567p678s', // 0m = 적5만
      win: '6s',
      riichi: true,
      dora: '1m', // 도라 = 2m (2장 보유)
      ura: '4m', // 우라 = 5m (2장 보유: 5m + 적5m)
    });
    expect(hanOf(r, 'dora')).toBe(2);
    expect(hanOf(r, 'akaDora')).toBe(1);
    expect(hanOf(r, 'uraDora')).toBe(2);
    // 리치1 + 핑후1 + 탕야오1 + 이페코1 + 도라2 + 적1 + 우라2 = 9판
    expect(r?.han).toBe(9);
  });

  it('적도라 룰 OFF면 적5 가산 없음', () => {
    const r = winResult({
      hand: '22334405m567p678s',
      win: '6s',
      rules: { redFives: false },
    });
    expect(hanOf(r, 'akaDora')).toBeUndefined();
  });

  it('역이 없으면 도라만으로 화료 불가', () => {
    const r = winResult({
      hand: '222m456p789p99s',
      win: '9s',
      melds: [{ type: 'chi', tiles: '345m' }],
      dora: '1m',
    });
    expect(r).toBeNull();
  });
});

describe('카조에 역만', () => {
  const spec = {
    hand: '22334455667788m',
    win: '8m',
    type: 'tsumo',
    riichi: true,
    ippatsu: true,
  } as const;

  it('13판 이상 → 역만 지급', () => {
    const r = winResult(spec);
    expect(r?.han).toBeGreaterThanOrEqual(13);
    expect(r?.limit).toBe('역만');
    expect(r?.basePoints).toBe(8000);
  });

  it('OFF면 삼배만 상한', () => {
    const r = winResult({ ...spec, rules: { kazoeYakuman: false } });
    expect(r?.limit).toBe('삼배만');
    expect(r?.basePoints).toBe(6000);
  });
});
