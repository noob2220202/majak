export { PROTOCOL_VERSION } from './version';
export { RuleSettingsSchema, resolveRules, DEFAULT_RULES } from './rules';
export type { RuleSettings } from './rules';

export {
  AuthHelloSchema,
  RoomCodeSchema,
  RoomReadySchema,
  GameActionSchema,
  AutoSettingsSchema,
  FillAcceptSchema,
  CLIENT_EVENTS,
} from './actions';
export type {
  AuthHello,
  RoomCode,
  GameActionPayload,
  AutoSettings,
  ClientEventName,
} from './actions';

export type {
  ServerHello,
  PlayerStats,
  AuthWelcome,
  RoomMemberView,
  RoomStateView,
  QueueStateView,
  GameStartView,
  RoundStartView,
  DealView,
  DrawView,
  PublicGameEvent,
  ChoiceTimeout,
  ChoicesView,
  RevealedHandView,
  WinResultView,
  RoundResultView,
  GameEndView,
  SeatPublicView,
  GameSnapshotView,
  ServerErrorView,
  ServerEventName,
} from './views';
export { SERVER_EVENTS } from './views';

export {
  SHOP_SLOTS,
  RANK_TIERS,
  ShopBuySchema,
  ShopEquipSchema,
} from './economy';
export type {
  ShopSlot,
  ShopItem,
  WalletView,
  LedgerEntryView,
  RewardLineView,
  RewardsView,
  RankTier,
  RankView,
  ShopBuy,
  ShopEquip,
  SeatProfileView,
} from './economy';
