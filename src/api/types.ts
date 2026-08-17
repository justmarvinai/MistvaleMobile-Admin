import type { components } from './schema';

/**
 * Admin API DTOs.
 *
 * Every payload shape is an alias onto `schema.d.ts`, which `pnpm sync-api` generates
 * from the game repo's OpenAPI artifact — itself generated from the Zod contracts the
 * server validates with. So there is one definition of each shape, in the game repo, and
 * a server-side change surfaces here as a type error rather than a runtime surprise.
 *
 * The aliases exist so screens import `ChampionDef` rather than
 * `components['schemas']['ChampionDef']`, and so this file stays the single import site
 * if the generator's layout ever changes.
 *
 * Two kinds of thing are still written by hand, deliberately:
 *  - **Runtime value lists.** Pickers need arrays at runtime, and a type cannot produce
 *    one. Each is `satisfies` its generated union, so dropping or renaming a member in
 *    the server contract fails this file's typecheck.
 *  - **Shapes outside the contract.** The envelope generics and `/api/health`, which is a
 *    player-prefix operations endpoint rather than part of the Admin API.
 */

type S = components['schemas'];

// ── Response envelope ───────────────────────────────────────────────────────

export type ApiErrorBody = S['ApiError'];
export type ErrorCode = ApiErrorBody['code'];

export interface ApiSuccess<T> {
  ok: true;
  data: T;
  rev: number;
}

export interface ApiFailure {
  ok: false;
  error: ApiErrorBody;
  rev: number;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** `details` payload the server attaches to VALIDATION failures. */
export interface FieldIssue {
  path: string;
  message: string;
}

// ── Auth ────────────────────────────────────────────────────────────────────

export type AccountSummary = S['AccountSummary'];
export type AccountRank = AccountSummary['rank'];
export type LoginRequest = S['LoginRequest'];
export type SessionEnvelope = S['AdminMeResponse'];

// ── Content registry ────────────────────────────────────────────────────────

export type ContentType = S['ContentTypeCount']['contentType'];
export type ContentState = S['ContentEntry']['state'];

export type ContentListItem = S['ContentEntry'];
export type ContentListResponse = S['ListContentEntriesResponse'];
export type ContentItemResponse = S['GetContentEntryResponse'];
export type ContentTypeCount = S['ContentTypeCount'];
export type ContentOverview = S['ListContentTypesResponse'];

// ── Validation, diff, publish ───────────────────────────────────────────────

export type ContentIssue = S['ContentIssue'];
export type ContentValidationResult = S['ContentValidationResult'];
export type ContentDiffEntry = S['ContentDiffEntry'];
export type ContentDiffField = ContentDiffEntry['fields'][number];
export type DiffRisk = NonNullable<ContentDiffEntry['risk']>;
export type DiffTotals = S['ContentTotals'];
export type ContentDiff = S['ContentDiff'];
export type PublishResult = S['PublishResult'];
export type RevertResult = S['RevertContentResponse'];
export type ContentRevisionSummary = S['ContentRevisionSummary'];
export type RevisionsResponse = S['ListContentRevisionsResponse'];

// ── Dashboard ───────────────────────────────────────────────────────────────

export type AuditEntry = S['AuditEntry'];
export type StatsOverview = S['AdminOverview'];

/**
 * `GET /api/health` — an operations endpoint on the player prefix, not part of the Admin
 * API contract, so it has no generated counterpart. `STATUS.sh` reads the same payload.
 */
export interface HealthReport {
  status: 'healthy' | 'degraded';
  uptimeSeconds: number;
  startedAt: string;
  contentRevision: number;
  nodeVersion: string;
  memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number };
  eventLoop: { meanMs: number; p99Ms: number; maxMs: number };
  database: { ok: boolean; latencyMs: number; pool: Record<string, unknown> };
  activeBattles: number;
}

// ── Player management ───────────────────────────────────────────────────────

export type AdminPlayerSummary = S['AdminPlayerSummary'];
export type AdminPlayerSearch = S['AdminPlayerSearch'];
export type AdminPlayerDetail = S['AdminPlayerDetail'];
export type AdminSession = S['AdminSession'];
export type AdminEconomyEntry = S['AdminEconomyEntry'];
export type AdminAccountState = S['AdminAccountState'];
export type AdminResetPasswordResult = S['AdminResetPasswordResult'];
export type AdminGrantRequest = S['AdminGrantRequest'];
export type AdminGrantResult = S['AdminGrantResult'];
export type AdminResetAccountResult = S['ResetPlayerAccountResponse'];

// ── The Arena's bot ladder ───────────────────────────────────────────────────
export type ArenaBotCensus = S['GetArenaBotCensusResponse'];
export type ArenaBotCensusEntry = ArenaBotCensus['bands'][number];
export type ArenaBand = ArenaBotCensusEntry['band'];
/** Seeding and refreshing answer the same way: what happened, and the ladder now. */
export type ArenaLadderResult = S['SeedArenaBotsResponse'];
export type ArenaLadderReport = ArenaLadderResult['report'];
export type AccountStatus = AdminAccountState['status'];

// ── Content entities ────────────────────────────────────────────────────────

export type FactionDef = S['FactionDef'];
export type StatusDef = S['StatusDef'];
export type AssetDef = S['AssetDef'];
export type ChampionDef = S['ChampionDef'];
export type EnemyDef = S['EnemyDef'];
export type GearSetDef = S['GearSetDef'];
export type GearSlotDef = S['GearSlotDef'];
export type ItemDef = S['ItemDef'];
export type CampaignChapterDef = S['CampaignChapterDef'];
export type StageDef = S['StageDef'];
export type SkillDef = S['SkillDef'];
export type GameConfigEntry = S['GameConfigDef'];
export type GameConfigValue = GameConfigEntry['value'];

export type BaseStats = ChampionDef['baseStats'];
export type Aura = NonNullable<ChampionDef['aura']>;
export type Element = ChampionDef['element'];
export type Rarity = ChampionDef['rarity'];
export type Role = ChampionDef['role'];
export type Stat = Aura['stat'];
export type StatusEngineType = StatusDef['engineType'];
export type Difficulty = StageDef['difficulty'];

// ── Skill effect DSL ────────────────────────────────────────────────────────

export type SkillSlot = SkillDef['slot'];
export type Targeting = SkillDef['targeting'];
export type SkillUpgrade = SkillDef['upgrades'][number];
export type SkillUpgradeEffect = SkillUpgrade['effect'];
export type AiHints = SkillDef['aiHints'];
export type SkillAnimation = SkillDef['animation'];

export type EffectComponent = SkillDef['components'][number];
export type EffectComponentType = EffectComponent['type'];

/** The damage arm carries every shared field, so it is the one to read them from. */
type DamageComponent = Extract<EffectComponent, { type: 'damage' }>;
export type EffectCondition = NonNullable<DamageComponent['condition']>;
export type EffectConditionType = EffectCondition['type'];
export type ScalingStat = DamageComponent['scale'];
export type EffectTarget = Extract<EffectComponent, { type: 'applyStatus' }>['target'];

// ── Runtime value lists ─────────────────────────────────────────────────────
//
// `satisfies` pins each list to its generated union: remove a member from the server
// contract and this file stops compiling. It does not catch a member *added* server-side,
// which `types.test.ts` covers by counting against the generated union.

export const ELEMENTS = ['ember', 'tide', 'verdant', 'mist'] as const satisfies readonly Element[];

export const RARITIES = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
] as const satisfies readonly Rarity[];

export const ROLES = ['attack', 'defense', 'hp', 'support'] as const satisfies readonly Role[];

export const STATS = [
  'hp',
  'atk',
  'def',
  'spd',
  'critRate',
  'critDmg',
  'res',
  'acc',
] as const satisfies readonly Stat[];

export const ACCOUNT_RANKS = [
  'player',
  'gamemaster',
  'admin',
] as const satisfies readonly AccountRank[];

export const DIFFICULTIES = ['normal', 'hard', 'brutal'] as const satisfies readonly Difficulty[];

export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'VALIDATION',
  'INVALID_CREDENTIALS',
  'ALREADY_EXISTS',
  'NOT_FOUND',
  'INSUFFICIENT_FUNDS',
  'ENERGY_LOW',
  'ROSTER_FULL',
  'COOLDOWN',
  'LOCKED_CONTENT',
  'IDEMPOTENT_REPLAY',
  'RATE_LIMITED',
  'CONTENT_STALE',
  'ACCOUNT_BANNED',
  'PASSWORD_CHANGE_REQUIRED',
  'INTERNAL',
] as const satisfies readonly ErrorCode[];

export const CONTENT_TYPES = [
  'faction',
  'status',
  'skill',
  'asset',
  'champion',
  'enemy',
  'gearSet',
  'gearSlot',
  'gearStat',
  'item',
  'campaignChapter',
  'dungeon',
  'stage',
  'summonPool',
  'shop',
  'mastery',
  'quest',
  'gameConfig',
] as const satisfies readonly ContentType[];

export const STATUS_ENGINE_TYPES = [
  'statModifier',
  'damageOverTime',
  'healOverTime',
  'shield',
  'skipTurn',
  'skipTurnBreakOnDamage',
  'forceTargetA1',
  'blockBuffs',
  'blockDebuffs',
  'counterattack',
  'allyProtection',
  'reflectDamage',
  'lifesteal',
  'healReduction',
  'unkillable',
] as const satisfies readonly StatusEngineType[];

export const SCALING_STATS = [
  'atk',
  'def',
  'maxHp',
  'spd',
] as const satisfies readonly ScalingStat[];

export const EFFECT_TARGETS = [
  'hitTargets',
  'self',
  'allAllies',
  'lowestHpAlly',
  'randomAlly',
  'allEnemies',
] as const satisfies readonly EffectTarget[];

export const EFFECT_CONDITION_TYPES = [
  'targetHasStatus',
  'targetMissingStatus',
  'selfHpBelow',
  'targetHpBelow',
  'alliesDead',
] as const satisfies readonly EffectConditionType[];

export const EFFECT_COMPONENT_TYPES = [
  'damage',
  'applyStatus',
  'heal',
  'shield',
  'turnMeter',
  'cleanse',
  'dispel',
  'extraTurn',
  'cooldown',
] as const satisfies readonly EffectComponentType[];

export const SKILL_UPGRADE_EFFECTS = [
  'damage',
  'chance',
  'cooldown',
  'heal',
  'shield',
] as const satisfies readonly SkillUpgradeEffect[];

export const SKILL_SLOTS = [
  'a1',
  'a2',
  'a3',
  'a4',
  'passive',
] as const satisfies readonly SkillSlot[];

export const AI_PREFER_OPTIONS = [
  'lowestHp',
  'highestAtk',
  'highestTm',
  'random',
  'lowestHpAlly',
] as const satisfies readonly NonNullable<AiHints['prefer']>[];
