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
