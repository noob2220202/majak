import { isDragon, kindOfTile, isYaochuu, countsFromKinds } from './tiles';
import { shanten, usefulKinds } from './shanten';
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
 * 봇 v1 (PLAN.md §3.5): 규칙을 지키는 무난한 상대.
 * - 화료 가능하면 화료, 리치 가능하면 리치 (대기 수 최대 타패 선택)
 * - 샹텐을 늘리지 않는 타패 중 고립 요구패부터 정리
 * - 리치자가 있고 자신이 2샹텐 이상이면 현물 수비
 * - 울기: 역패 퐁 + (이미 오픈이면) 샹텐이 주는 치, 안깡·가깡
 * 결정론: 동률은 항상 낮은 kind/id 우선.
 */
export interface Bot {
  chooseTurnAction(state: RoundState, seat: Seat): RoundAction;
  chooseReaction(state: RoundState, seat: Seat): RoundAction;
}

function handCountsWithDrawn(state: RoundState, seat: Seat): number[] {
  const p = state.players[seat];
  const kinds = p.hand.map(kindOfTile);
  if (p.drawnTile !== null) kinds.push(kindOfTile(p.drawnTile));
  return countsFromKinds(kinds);
}

function riichiThreats(state: RoundState, seat: Seat): Seat[] {
  return SEATS.filter((s) => s !== seat && state.players[s].riichi?.accepted);
}

function genbutsuKinds(state: RoundState, threats: Seat[]): Set<TileKind> {
  const safe = new Set<TileKind>();
  for (const t of threats) {
    for (const d of state.players[t].discards) safe.add(kindOfTile(d.tileId));
  }
  return safe;
}

/** 타패 평가: [샹텐, 유효패 수(음수로 클수록 좋음), 고립도] 사전식 최소화 */
function pickDiscard(state: RoundState, seat: Seat, pool: readonly TileId[]): TileId {
  const p = state.players[seat];
  const melds = p.melds.length;
  const threats = riichiThreats(state, seat);
  const counts = handCountsWithDrawn(state, seat);
  const currentShanten = shanten(counts, melds);

  // 수비 모드: 리치자가 있고 2샹텐 이상이면 현물 우선
  if (threats.length > 0 && currentShanten >= 2) {
    const safe = genbutsuKinds(state, threats);
    const genbutsu = pool.filter((t) => safe.has(kindOfTile(t)));
    if (genbutsu.length > 0) {
      return genbutsu.sort((a, b) => kindOfTile(a) - kindOfTile(b) || a - b)[0] as TileId;
    }
  }

  // 같은 종류는 결과가 같으므로 종류당 1장만 평가 (id 최솟값)
  const byKind = new Map<TileKind, TileId>();
  for (const t of pool) {
    const k = kindOfTile(t);
    const cur = byKind.get(k);
    if (cur === undefined || t < cur) byKind.set(k, t);
  }

  let best: TileId = pool[0] as TileId;
  let bestKey: [number, number, number, number] = [99, 99, 99, 999];
  for (const [k, tileId] of [...byKind.entries()].sort((a, b) => a[0] - b[0])) {
    counts[k] = (counts[k] as number) - 1;
    const s = shanten(counts, melds);
    // 텐파이 직전에서만 유효패 수 비교 (성능)
    const ukeire = s <= 1 ? -usefulKinds(counts, melds).length : 0;
    counts[k] = (counts[k] as number) + 1;
    const isolation = isYaochuu(k) ? 0 : 1; // 요구패 먼저 정리
    const key: [number, number, number, number] = [s, ukeire, isolation, k];
    if (
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] &&
        (key[1] < bestKey[1] ||
          (key[1] === bestKey[1] &&
            (key[2] < bestKey[2] || (key[2] === bestKey[2] && key[3] < bestKey[3])))))
    ) {
      best = tileId;
      bestKey = key;
    }
  }
  return best;
}

export function createBotV1(): Bot {
  return {
    chooseTurnAction(state, seat): RoundAction {
      const choices = turnChoices(state);
      if (choices.canTsumo) return { type: 'tsumo' };
      if (choices.canKyuushu) return { type: 'kyuushu' };

      // 리치: 대기 수 최대가 되는 선언 타패
      if (choices.riichiDiscards.length > 0) {
        const tile = pickDiscard(state, seat, choices.riichiDiscards);
        return { type: 'discard', tileId: tile, riichi: true };
      }

      // 안깡: 샹텐을 해치지 않으면 (리치 중이면 규칙상 대기 불변 보장됨)
      for (const kind of choices.ankanKinds) {
        const p = state.players[seat];
        const before = shanten(
          countsFromKinds([
            ...p.hand.map(kindOfTile),
            ...(p.drawnTile !== null ? [kindOfTile(p.drawnTile)] : []),
          ]),
          p.melds.length,
        );
        const afterKinds = [...p.hand, ...(p.drawnTile !== null ? [p.drawnTile] : [])]
          .map(kindOfTile)
          .filter((k) => k !== kind);
        const after = shanten(countsFromKinds(afterKinds), p.melds.length + 1);
        if (after <= before) return { type: 'ankan', kind };
      }
      if (choices.shouminkanTiles.length > 0 && riichiThreats(state, seat).length === 0) {
        return { type: 'shouminkan', tileId: choices.shouminkanTiles[0] as TileId };
      }

      const tile = pickDiscard(state, seat, choices.discards);
      return { type: 'discard', tileId: tile };
    },

    chooseReaction(state, seat): RoundAction {
      const offers = reactionOffers(state).get(seat) ?? [];
      const has = (type: ReactionOffer['type']): ReactionOffer | undefined =>
        offers.find((o) => o.type === type);

      if (has('ron')) return { type: 'ron' };

      const p = state.players[seat];
      const discard = state.lastDiscard;
      if (discard && has('pon')) {
        const k = kindOfTile(discard.tileId);
        const isYakuhai =
          isDragon(k) || k === seatWindOf(state, seat) || k === state.roundWind;
        if (isYakuhai && riichiThreats(state, seat).length === 0) {
          return { type: 'pon' };
        }
      }

      const chiOffer = has('chi');
      if (chiOffer && chiOffer.type === 'chi' && p.melds.length > 0 && discard) {
        // 이미 오픈(역패 확보) 상태에서 샹텐이 줄어드는 치만
        const currentKinds = p.hand.map(kindOfTile);
        const current = shanten(countsFromKinds(currentKinds), p.melds.length);
        for (const combo of chiOffer.combos) {
          const remaining = p.hand.filter((t) => t !== combo[0] && t !== combo[1]);
          const after = shanten(countsFromKinds(remaining.map(kindOfTile)), p.melds.length + 1);
        // 치 후 손패는 타패 전 상태(13-3n+1장)가 아니므로 -1장 기준으로 비교
          if (after < current) return { type: 'chi', tiles: combo };
        }
      }

      return { type: 'pass' };
    },
  };
}
