import { formatStats, runSimulation } from '../src/index';

/**
 * Phase 1 완료 기준 검증용 대규모 시뮬레이션 (PLAN.md §7).
 * 사용: npx tsx scripts/simulate.ts <games> <seedPrefix>
 */
const games = Number(process.argv[2] ?? 100);
const prefix = process.argv[3] ?? 'phase1';

const t0 = Date.now();
const stats = runSimulation({ games, seedPrefix: prefix, checkInvariants: true });
const elapsed = ((Date.now() - t0) / 1000).toFixed(0);

console.log(`[${prefix}] ${games}반장 완료 — ${elapsed}s, 불변식 위반 0, 최대 액션 ${stats.maxActionCount}`);
console.log(formatStats(stats));
