export type { Tile, TileId, TileKind, Seat } from './types';
export { SEATS, nextSeat } from './types';

export {
  TILE_KIND_COUNT,
  COPIES_PER_KIND,
  TOTAL_TILES,
  RED_FIVE_KINDS,
  YAOCHUU_KINDS,
  HONOR_START,
  EAST,
  SOUTH,
  WEST,
  NORTH,
  HAKU,
  HATSU,
  CHUN,
  kindOfTile,
  suitOf,
  numberOf,
  isHonor,
  isWind,
  isDragon,
  isTerminal,
  isYaochuu,
  isSimple,
  isRedFiveId,
  doraKindFromIndicator,
  buildTileSet,
  tileKindToNotation,
  tileToNotation,
  parseTiles,
  countsFromKinds,
  countsFromNotation,
} from './tiles';
export type { TileSetOptions, ParsedTile } from './tiles';

export type { GameLength, KanDoraReveal, RuleSettings } from './rules';
export {
  DEFAULT_RULES,
  STARTING_POINTS,
  GOAL_POINTS,
  RIICHI_DEPOSIT,
  NOTEN_PENALTY_TOTAL,
} from './rules';

export type { Rng } from './rng';
export { createRng, nextInt, shuffleInPlace } from './rng';

export {
  standardShanten,
  chiitoiShanten,
  kokushiShanten,
  shanten,
  isAgariShape,
  winningKinds,
  isTenpai,
  usefulKinds,
} from './shanten';

export type { Meld } from './meld';
export { isKan, breaksConcealment, meldKind, meldTileKinds } from './meld';

export type {
  HandSet,
  WaitKind,
  StandardDecomposition,
  ChiitoiDecomposition,
  KokushiDecomposition,
  Decomposition,
} from './decompose';
export {
  enumerateStandard,
  enumerateChiitoi,
  enumerateKokushi,
  enumerateDecompositions,
} from './decompose';

export type { WinInput, YakuEntry, YakumanEntry, YakuResult, EvalGroup } from './yaku';
export {
  isMenzen,
  buildGroups,
  allTileCounts,
  evaluateStandard,
  evaluateChiitoi,
  evaluateKokushi,
  evaluateDecomposition,
} from './yaku';

export { calculateFu } from './fu';

export type { LimitName, BasePointsResult, TsumoPayments } from './score';
export { basePointsOf, yakumanBasePoints, ronPoints, tsumoPayments } from './score';

export type { AgariInput, AgariResult } from './agari';
export { evaluateWin, kanCount } from './agari';
