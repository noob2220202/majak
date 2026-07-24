import { describe, expect, it } from 'vitest';
import {
  buildTileSet,
  kindOfTile,
  RED_FIVE_KINDS,
  TILE_KIND_COUNT,
  tileKindToNotation,
  tileToNotation,
  TOTAL_TILES,
} from '../src';

describe('buildTileSet', () => {
  it('총 136장, id는 0..135 고유값이다', () => {
    const tiles = buildTileSet();
    expect(tiles).toHaveLength(TOTAL_TILES);
    expect(new Set(tiles.map((t) => t.id)).size).toBe(136);
    expect(tiles.every((t) => t.id >= 0 && t.id < 136)).toBe(true);
  });

  it('모든 종류가 정확히 4장씩이다', () => {
    const tiles = buildTileSet();
    const countByKind = new Map<number, number>();
    for (const t of tiles) {
      countByKind.set(t.kind, (countByKind.get(t.kind) ?? 0) + 1);
    }
    expect(countByKind.size).toBe(TILE_KIND_COUNT);
    for (const count of countByKind.values()) {
      expect(count).toBe(4);
    }
  });

  it('적도라 ON: 적5는 정확히 3장 — 5만·5통·5삭 각 1장', () => {
    const reds = buildTileSet({ redFives: true }).filter((t) => t.red);
    expect(reds).toHaveLength(3);
    expect(reds.map((t) => t.kind)).toEqual([...RED_FIVE_KINDS]);
    expect(reds.map(tileToNotation)).toEqual(['0m', '0p', '0s']);
  });

  it('적도라 OFF: 적5가 없다', () => {
    const tiles = buildTileSet({ redFives: false });
    expect(tiles.some((t) => t.red)).toBe(false);
  });

  it('id에서 종류를 복원할 수 있다', () => {
    const tiles = buildTileSet();
    expect(tiles.every((t) => kindOfTile(t.id) === t.kind)).toBe(true);
  });
});

describe('tileKindToNotation', () => {
  it('mpsz 표기 경계값', () => {
    expect(tileKindToNotation(0)).toBe('1m');
    expect(tileKindToNotation(8)).toBe('9m');
    expect(tileKindToNotation(9)).toBe('1p');
    expect(tileKindToNotation(17)).toBe('9p');
    expect(tileKindToNotation(18)).toBe('1s');
    expect(tileKindToNotation(26)).toBe('9s');
    expect(tileKindToNotation(27)).toBe('1z');
    expect(tileKindToNotation(33)).toBe('7z');
  });

  it('적5는 0 표기를 쓴다', () => {
    expect(tileKindToNotation(13, true)).toBe('0p');
  });

  it('범위 밖 종류는 거부한다', () => {
    expect(() => tileKindToNotation(-1)).toThrow(RangeError);
    expect(() => tileKindToNotation(34)).toThrow(RangeError);
    expect(() => tileKindToNotation(1.5)).toThrow(RangeError);
  });
});
