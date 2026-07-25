import { isDragon, kindOfTile, isYaochuu, countsFromKinds, TILE_KIND_COUNT } from './tiles';
import { shanten, usefulKinds } from './shanten';
import { doraIndicatorKinds } from './wall';
import type { Bot } from './bot';
import type { Seat, TileId, TileKind } from './types';
import { SEATS } from './types';
import {
  reactionOffers,
  seatWindOf,
  turnChoices,
  type ReactionOffer,
  type RoundAction,
  type RoundState,
} from './round';

/**
 * 봇 v2 — 패 효율과 방총 위험을 함께 본다 (PLAN.md §3.5 "고급 AI는 Phase 5").
 *
 * v1 대비 바뀐 점
 * - 우케이레를 **종류 수**가 아니라 **남은 매수**로 센다. 보이는 패(내 손·전원 버림패·
 *   부로·도라표시)를 빼서 실제로 몇 장이 남았는지 계산한다.
 * - 수비를 "2샹텐 이상이면 현물"에서 **위험도 점수 기반 밀기/빼기**로 바꿨다.
 *   현물뿐 아니라 스지·패 종류·남은 매수를 함께 본다.
 * - 텐파이면 웬만하면 민다. 멀면 뺀다. 그 사이는 효율과 위험을 저울질한다.
 *
 * 결정론은 v1과 같다 — 동률은 항상 낮은 kind/id 우선. 난수를 쓰지 않는다.
 */

/** 어느 수패(만·통·삭)의 숫자 (1~9). 자패면 0 */
function numberOf(kind: TileKind): number {
  return kind < 27 ? (kind % 9) + 1 : 0;
}

/** 같은 수패 종류의 다른 숫자 kind */
function sameSuit(kind: TileKind, num: number): TileKind {
  return (Math.floor(kind / 9) * 9 + (num - 1)) as TileKind;
}

/**
 * 지금까지 공개된 패의 종류별 장수.
 * 내 손패·쯔모패, 전원의 버림패·부로, 공개된 도라표시패를 센다.
 * 상대 손패와 패산은 당연히 못 본다 (은닉 정보를 쓰면 봇이 치팅하는 셈이다).
 */
function visibleCounts(state: RoundState, seat: Seat): number[] {
  const counts = new Array<number>(TILE_KIND_COUNT).fill(0);
  const bump = (k: TileKind): void => {
    counts[k] = (counts[k] as number) + 1;
  };

  const me = state.players[seat];
  for (const t of me.hand) bump(kindOfTile(t));
  if (me.drawnTile !== null) bump(kindOfTile(me.drawnTile));

  for (const s of SEATS) {
    const p = state.players[s];
    for (const d of p.discards) bump(kindOfTile(d.tileId));
    for (const m of p.melds) {
      for (const t of m.tiles) {
        // 울어간 패는 버림패에도 남아 있으므로 두 번 세지 않는다
        if (m.type !== 'ankan' && t === m.calledTileId) continue;
        bump(kindOfTile(t));
      }
    }
  }
  for (const k of doraIndicatorKinds(state.wall)) bump(k);

  return counts;
}

/** 유효패가 실제로 몇 장 남았는지 (많을수록 좋다) */
function ukeireTiles(
  counts: readonly number[],
  meldCount: number,
  visible: readonly number[],
): number {
  let total = 0;
  for (const k of usefulKinds(counts, meldCount)) {
    total += Math.max(0, 4 - (visible[k] as number));
  }
  return total;
}

interface Threat {
  seat: Seat;
  /** 그 사람에게 안전한 종류 (현물) */
  genbutsu: Set<TileKind>;
  /** 리치 선언 이후 그 사람이 버린 종류 — 스지 판정에 쓴다 */
  discarded: Set<TileKind>;
}

function threatsOf(state: RoundState, seat: Seat): Threat[] {
  const out: Threat[] = [];
  for (const s of SEATS) {
    if (s === seat) continue;
    const p = state.players[s];
    if (!p.riichi?.accepted) continue;
    const genbutsu = new Set<TileKind>();
    const discarded = new Set<TileKind>();
    for (const d of p.discards) {
      genbutsu.add(kindOfTile(d.tileId));
      discarded.add(kindOfTile(d.tileId));
    }
    // 리치자가 버린 뒤에 내가 통과시킨 패도 그 사람에게는 안전하다(동순 후리텐 아님 주의).
    // 여기서는 보수적으로 본인 버림패만 현물로 본다.
    out.push({ seat: s, genbutsu, discarded });
  }
  return out;
}

/**
 * 방총 위험도 (0=안전, 클수록 위험).
 * 표준적인 통념만 넣는다 — 현물 > 스지·자패 > 19 > 28 > 3~7.
 */
function dangerOf(
  kind: TileKind,
  threats: readonly Threat[],
  visible: readonly number[],
): number {
  if (threats.length === 0) return 0;

  let worst = 0;
  for (const t of threats) {
    if (t.genbutsu.has(kind)) continue; // 현물 — 이 사람에게는 0

    const num = numberOf(kind);
    let risk: number;
    if (num === 0) {
      // 자패: 보이는 장수가 많을수록 안전 (4장 중 3장 보이면 사실상 안전)
      const seen = visible[kind] as number;
      risk = seen >= 3 ? 4 : seen === 2 ? 10 : 20;
    } else if (num === 1 || num === 9) {
      risk = 22;
    } else if (num === 2 || num === 8) {
      risk = 32;
    } else {
      risk = 45;
    }

    // 스지: 3~7은 양쪽, 1~3/7~9는 한쪽만 보면 된다
    if (num >= 1 && num <= 9) {
      const low = num - 3;
      const high = num + 3;
      const lowSuji = low >= 1 && t.discarded.has(sameSuit(kind, low));
      const highSuji = high <= 9 && t.discarded.has(sameSuit(kind, high));
      const needBoth = num >= 4 && num <= 6;
      const sujiOk = needBoth ? lowSuji && highSuji : lowSuji || highSuji;
      if (sujiOk) risk = Math.round(risk * 0.45);
    }

    worst = Math.max(worst, risk);
  }
  return worst;
}

/** 패 하나를 버렸을 때의 평가 결과 */
interface DiscardEval {
  tileId: TileId;
  kind: TileKind;
  shanten: number;
  ukeire: number;
  danger: number;
}

function evaluateDiscards(
  state: RoundState,
  seat: Seat,
  pool: readonly TileId[],
  threats: readonly Threat[],
): DiscardEval[] {
  const p = state.players[seat];
  const melds = p.melds.length;
  const visible = visibleCounts(state, seat);

  const kinds = p.hand.map(kindOfTile);
  if (p.drawnTile !== null) kinds.push(kindOfTile(p.drawnTile));
  const counts = countsFromKinds(kinds);

  // 같은 종류는 결과가 같으므로 종류당 1장만 (id 최솟값) 평가한다
  const byKind = new Map<TileKind, TileId>();
  for (const t of pool) {
    const k = kindOfTile(t);
    const cur = byKind.get(k);
    if (cur === undefined || t < cur) byKind.set(k, t);
  }

  const out: DiscardEval[] = [];
  for (const [k, tileId] of [...byKind.entries()].sort((a, b) => a[0] - b[0])) {
    counts[k] = (counts[k] as number) - 1;
    const s = shanten(counts, melds);
    // 우케이레는 34종에 대해 샹텐을 다시 도는 비싼 계산이라, 가망 있는 손에서만 센다
    const ukeire = s <= 2 ? ukeireTiles(counts, melds, visible) : 0;
    counts[k] = (counts[k] as number) + 1;
    out.push({ tileId, kind: k, shanten: s, ukeire, danger: dangerOf(k, threats, visible) });
  }
  return out;
}

/**
 * 밀지 뺄지 정하고 그에 맞는 패를 고른다.
 *
 * - 위협이 없으면 순수 효율 (샹텐 → 우케이레 → 요구패 정리 → kind)
 * - 텐파이·1샹텐이면 민다. 단 같은 값이면 덜 위험한 쪽
 * - 2샹텐 이상이면 뺀다. 위험도를 먼저 보고, 그 안에서 손을 덜 망치는 쪽
 */
function pickDiscardV2(state: RoundState, seat: Seat, pool: readonly TileId[]): TileId {
  const threats = threatsOf(state, seat);
  const evals = evaluateDiscards(state, seat, pool, threats);
  if (evals.length === 0) return pool[0] as TileId;

  const best = evals.reduce((a, b) => (a.shanten <= b.shanten ? a : b));
  const pushing = threats.length === 0 || best.shanten <= 1;

  const sorted = [...evals].sort((a, b) => {
    if (pushing) {
      // 효율 우선, 동률이면 덜 위험한 쪽
      if (a.shanten !== b.shanten) return a.shanten - b.shanten;
      if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
      if (a.danger !== b.danger) return a.danger - b.danger;
    } else {
      // 안전 우선, 동률이면 손을 덜 망치는 쪽
      if (a.danger !== b.danger) return a.danger - b.danger;
      if (a.shanten !== b.shanten) return a.shanten - b.shanten;
      if (a.ukeire !== b.ukeire) return b.ukeire - a.ukeire;
    }
    // 마지막 동률: 요구패부터 정리하고, 그래도 같으면 낮은 kind (결정론)
    const ay = isYaochuu(a.kind) ? 0 : 1;
    const by = isYaochuu(b.kind) ? 0 : 1;
    if (ay !== by) return ay - by;
    return a.kind - b.kind;
  });

  return (sorted[0] as DiscardEval).tileId;
}

export function createBotV2(): Bot {
  return {
    chooseTurnAction(state, seat): RoundAction {
      const choices = turnChoices(state);
      if (choices.canTsumo) return { type: 'tsumo' };
      if (choices.canKyuushu) return { type: 'kyuushu' };

      if (choices.riichiDiscards.length > 0) {
        return { type: 'discard', tileId: pickDiscardV2(state, seat, choices.riichiDiscards), riichi: true };
      }

      // 안깡: 샹텐을 해치지 않을 때만 (리치 중이면 규칙상 대기 불변이 보장됨)
      for (const kind of choices.ankanKinds) {
        const p = state.players[seat];
        const handKinds = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])].map(kindOfTile);
        const before = shanten(countsFromKinds(handKinds), p.melds.length);
        const after = shanten(
          countsFromKinds(handKinds.filter((k) => k !== kind)),
          p.melds.length + 1,
        );
        if (after <= before) return { type: 'ankan', kind };
      }
      // 가깡은 상대에게 깡도라를 주고 창깡 위험도 있어, 리치자가 있으면 하지 않는다
      if (choices.shouminkanTiles.length > 0 && threatsOf(state, seat).length === 0) {
        return { type: 'shouminkan', tileId: choices.shouminkanTiles[0] as TileId };
      }

      return { type: 'discard', tileId: pickDiscardV2(state, seat, choices.discards) };
    },

    chooseReaction(state, seat): RoundAction {
      const offers = reactionOffers(state).get(seat) ?? [];
      const has = (type: ReactionOffer['type']): ReactionOffer | undefined =>
        offers.find((o) => o.type === type);

      if (has('ron')) return { type: 'ron' };

      const p = state.players[seat];
      const discard = state.lastDiscard;
      const threats = threatsOf(state, seat);
      const melds = p.melds.length;
      const handKinds = p.hand.map(kindOfTile);
      const current = shanten(countsFromKinds(handKinds), melds);

      if (discard && has('pon')) {
        const k = kindOfTile(discard.tileId);
        const isYakuhai = isDragon(k) || k === seatWindOf(state, seat) || k === state.roundWind;
        // 역패는 울어서 역을 확보한다. 위협이 있으면 텐파이가 눈앞일 때만.
        if (isYakuhai && (threats.length === 0 || current <= 1)) return { type: 'pon' };
      }

      const chiOffer = has('chi');
      if (chiOffer && chiOffer.type === 'chi' && melds > 0 && discard && threats.length === 0) {
        // 이미 오픈(역 확보)이고 위협이 없을 때, 샹텐이 실제로 줄어드는 치만
        for (const combo of chiOffer.combos) {
          const remaining = p.hand.filter((t) => t !== combo[0] && t !== combo[1]);
          const after = shanten(countsFromKinds(remaining.map(kindOfTile)), melds + 1);
          if (after < current) return { type: 'chi', tiles: combo };
        }
      }

      return { type: 'pass' };
    },
  };
}
