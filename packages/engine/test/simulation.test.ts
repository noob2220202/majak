import { describe, expect, it } from 'vitest';
import { formatStats, gameFingerprint, runSimulation } from '../src';

describe('봇 자동 대국 시뮬레이션 (§8.1 불변식)', () => {
  it('30반장: 크래시 0, 점수 합 100,000 보존, 패 총량 136 보존', () => {
    const stats = runSimulation({ games: 30, seedPrefix: 'ci', checkInvariants: true });
    expect(stats.games).toBe(30);
    expect(stats.rounds).toBeGreaterThan(30 * 4);
    expect(stats.wins).toBeGreaterThan(0);
    expect(stats.riichiDeclared).toBeGreaterThan(0);
    expect(stats.exhaustive).toBeGreaterThan(0);
    // 화료가 유국보다 많아야 정상적인 분포
    expect(stats.wins).toBeGreaterThan(stats.exhaustive);
  }, 120000);

  it('결정론: 같은 시드 → 같은 대국', () => {
    const a = gameFingerprint('deterministic-check');
    const b = gameFingerprint('deterministic-check');
    const c = gameFingerprint('different-seed');
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  }, 60000);

  it('야쿠 분포가 상식적: 리치·역패·쯔모가 상위권', () => {
    const stats = runSimulation({ games: 40, seedPrefix: 'dist', checkInvariants: false });
    const top = [...stats.yakuCounts.entries()].sort((x, y) => y[1] - x[1]).map(([id]) => id);
    expect(top.slice(0, 6)).toEqual(
      expect.arrayContaining(['riichi', 'menzenTsumo']),
    );
    expect(stats.yakuCounts.get('riichi') ?? 0).toBeGreaterThan(0);
  }, 120000);
});

// 수동 실행 전용 (Phase 1 완료 기준: 10,000반장):
//   SIM_GAMES=10000 pnpm --filter @cheongiwa/engine test -- simulation
const manualGames = Number(process.env.SIM_GAMES ?? 0);
describe.runIf(manualGames > 0)('수동 대규모 시뮬레이션', () => {
  it(`${manualGames}반장 불변식`, () => {
    const stats = runSimulation({
      games: manualGames,
      seedPrefix: 'phase1',
      checkInvariants: true,
    });

    console.log(formatStats(stats));
    expect(stats.games).toBe(manualGames);
  }, 0);
});
