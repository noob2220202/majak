import {
  doraIndicatorKinds,
  reactionOffers,
  turnChoices,
  uraIndicatorKinds,
  type GameState,
  type RoundEvent,
  type RoundState,
  type Seat,
  type TileId,
} from '@cheongiwa/engine';
import type {
  ChoicesView,
  ChoiceTimeout,
  PublicGameEvent,
  RevealedHandView,
  RoundResultView,
  RoundStartView,
  SeatPublicView,
  WinResultView,
} from '@cheongiwa/protocol';

/**
 * 은닉 정보 리댁션 계층 (PLAN.md §3.3 원칙).
 * 타인 손패·패산·왕패·타인 쯔모패는 어떤 뷰에도 싣지 않는다.
 */

export interface SeatMeta {
  nickname: string;
  isBot: boolean;
  connected: boolean;
}

export function buildRoundStart(game: GameState, round: RoundState): RoundStartView {
  return {
    kyoku: game.kyoku,
    roundWind: round.roundWind,
    dealer: round.dealer,
    honba: round.honba,
    pot: round.pot,
    scores: [...round.scores],
    doraIndicators: doraIndicatorKinds(round.wall),
    liveRemaining: round.wall.liveRemaining,
  };
}

/** 엔진 이벤트 → 공개 이벤트 (쯔모패 id 제거). null이면 브로드캐스트하지 않는다. */
export function redactEvent(round: RoundState, event: RoundEvent): PublicGameEvent | null {
  switch (event.type) {
    case 'draw':
      return {
        type: 'draw',
        seat: event.seat,
        rinshan: event.rinshan,
        liveRemaining: round.wall.liveRemaining,
      };
    case 'discard':
      return {
        type: 'discard',
        seat: event.seat,
        tileId: event.tileId,
        riichi: event.riichi,
        tsumogiri: event.tsumogiri,
      };
    case 'call':
      return { type: 'call', seat: event.seat, meld: event.meld };
    case 'riichiAccepted':
      return {
        type: 'riichiAccepted',
        seat: event.seat,
        pot: round.pot,
        score: round.scores[event.seat] as number,
      };
    case 'doraRevealed':
      return { type: 'doraRevealed', indicator: event.indicator };
    case 'kyuushuDeclared':
      return { type: 'kyuushuDeclared', seat: event.seat };
    default:
      // deal·win·end는 별도 페이로드(game.deal / game.roundResult)로 전달
      return null;
  }
}

export function buildChoices(round: RoundState, seat: Seat, timeout: ChoiceTimeout): ChoicesView | null {
  if (round.phase === 'turn' && round.active === seat) {
    const c = turnChoices(round);
    return {
      kind: 'turn',
      discards: [...c.discards],
      riichiDiscards: [...c.riichiDiscards],
      canTsumo: c.canTsumo,
      ankanKinds: [...c.ankanKinds],
      shouminkanTiles: [...c.shouminkanTiles],
      canKyuushu: c.canKyuushu,
      timeout,
    };
  }
  if (round.phase === 'reaction') {
    const offers = reactionOffers(round).get(seat);
    if (!offers) return null;
    const chi = offers.find((o) => o.type === 'chi');
    return {
      kind: 'reaction',
      canRon: offers.some((o) => o.type === 'ron'),
      canPon: offers.some((o) => o.type === 'pon'),
      canDaiminkan: offers.some((o) => o.type === 'daiminkan'),
      chiCombos: chi && chi.type === 'chi' ? chi.combos.map((c) => [c[0], c[1]]) : [],
      timeout,
    };
  }
  return null;
}

export function buildSeatViews(round: RoundState, meta: readonly SeatMeta[]): SeatPublicView[] {
  return ([0, 1, 2, 3] as Seat[]).map((seat) => {
    const p = round.players[seat];
    const m = meta[seat] as SeatMeta;
    return {
      seat,
      nickname: m.nickname,
      isBot: m.isBot,
      connected: m.connected,
      score: round.scores[seat] as number,
      discards: p.discards.map((d) => ({
        tileId: d.tileId,
        riichi: d.riichi,
        calledBy: d.calledBy,
        tsumogiri: d.tsumogiri,
      })),
      melds: p.melds,
      riichi: p.riichi ? { double: p.riichi.double, accepted: p.riichi.accepted } : null,
      handCount: p.hand.length,
      hasDrawn: p.drawnTile !== null,
    };
  });
}

function revealedHand(round: RoundState, seat: Seat, extraTile: TileId | null): RevealedHandView {
  const p = round.players[seat];
  const tiles = [...p.hand];
  if (extraTile !== null && !tiles.includes(extraTile)) tiles.push(extraTile);
  return { seat, tiles, melds: p.melds };
}

export function buildRoundResult(round: RoundState): RoundResultView {
  const result = round.result;
  if (!result) throw new Error('국 결과가 없음');
  const scores = [...round.scores];

  if (result.type === 'win') {
    const wins: WinResultView[] = result.wins.map((w) => {
      const p = round.players[w.seat];
      const riichi = p.riichi?.accepted ?? false;
      return {
        seat: w.seat,
        from: w.from,
        hand: revealedHand(round, w.seat, w.from === null ? p.drawnTile : w.winningTileId),
        winningTile: w.winningTileId,
        wait: w.agari.decomposition.kind === 'standard' ? w.agari.decomposition.wait : null,
        yaku: [...w.agari.yaku],
        yakuman: [...w.agari.yakuman],
        han: w.agari.han,
        fu: w.agari.fu,
        basePoints: w.agari.basePoints,
        limit: w.agari.limit,
        gained: w.gained,
        pao: w.pao,
        uraIndicators:
          riichi && round.rules.uraDora ? uraIndicatorKinds(round.wall) : [],
      };
    });
    return {
      type: 'win',
      wins,
      deltas: [...result.deltas],
      scores,
      dealerRepeats: result.dealerRepeats,
    };
  }

  if (result.type === 'exhaustive') {
    const revealed = ([0, 1, 2, 3] as Seat[])
      .filter((s) => result.tenpai[s])
      .map((s) => revealedHand(round, s, null));
    return {
      type: 'exhaustive',
      tenpai: [...result.tenpai],
      revealed,
      nagashi: [...result.nagashi],
      deltas: [...result.deltas],
      scores,
      dealerRepeats: result.dealerRepeats,
    };
  }

  return {
    type: 'abortive',
    reason: result.reason,
    deltas: [...result.deltas],
    scores,
  };
}
