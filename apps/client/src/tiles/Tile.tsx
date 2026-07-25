import { memo, type CSSProperties } from 'react';
import { isRedFiveId, kindOfTile, type TileId } from '@cheongiwa/engine';
import { tileFaceArt } from './tileArt';
import { tileBackStyle } from '../cosmetics/tileBacks';

export interface TileProps {
  /** 실물 패 id (앞면 표시 시) */
  tileId?: TileId;
  /** 종류 직접 지정 (도라표시패 등) */
  kind?: number;
  red?: boolean;
  faceDown?: boolean;
  /** 패 폭(px). 높이는 4:3 */
  width?: number;
  /** 리치 선언패 등 가로 눕힘 */
  rotated?: boolean;
  dimmed?: boolean;
  glow?: 'gold' | 'green' | 'red' | null;
  selectable?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
  ariaLabel?: string;
  /** 패 뒷면 코스메틱 id (§6.3) */
  backId?: string;
}

const GLOW_SHADOW: Record<string, string> = {
  gold: '0 0 0 2px #e6c87a, 0 0 10px 1px rgba(230,200,122,0.6)',
  green: '0 0 0 2px #3f7e5f',
  red: '0 0 0 2px #c03b2e',
};

/** 마작패 한 장 (CSS 입체감, SVG 도안). 3D 엔진 없이 표현. */
export const Tile = memo(function Tile({
  tileId,
  kind,
  red,
  faceDown = false,
  width = 40,
  rotated = false,
  dimmed = false,
  glow = null,
  selectable = false,
  onClick,
  style,
  ariaLabel,
  backId,
}: TileProps) {
  const height = Math.round((width * 4) / 3);
  const resolvedKind = kind ?? (tileId !== undefined ? kindOfTile(tileId) : 0);
  const resolvedRed = red ?? (tileId !== undefined ? isRedFiveId(tileId) : false);

  const base: CSSProperties = {
    width,
    height,
    borderRadius: Math.max(4, width * 0.14),
    position: 'relative',
    flex: '0 0 auto',
    boxShadow:
      (glow ? GLOW_SHADOW[glow] + ', ' : '') +
      '0 2px 3px rgba(0,0,0,0.35), inset 0 2px 0 rgba(255,255,255,0.55), inset 0 -3px 3px rgba(0,0,0,0.18)',
    transition: 'transform 140ms cubic-bezier(0.2,0.8,0.2,1), box-shadow 140ms',
    transform: rotated ? 'rotate(90deg)' : undefined,
    cursor: selectable ? 'pointer' : 'default',
    opacity: dimmed ? 0.45 : 1,
    ...style,
  };

  if (faceDown) {
    // 패 뒷면: 장착한 코스메틱을 그린다 (§6.3). 작을 때는 단순형 (LOD).
    const back = tileBackStyle(backId);
    return (
      <div style={{ ...base, background: back.background }} aria-label={ariaLabel ?? '패 뒷면'}>
        <svg viewBox="0 0 100 134" width={width} height={height} style={{ display: 'block' }}>
          {back.art(width >= 26)}
        </svg>
      </div>
    );
  }

  return (
    <div
      style={{ ...base, background: 'linear-gradient(165deg, #fbf7ec 0%, #f1e8d3 70%, #e5d9bd 100%)' }}
      onClick={selectable ? onClick : undefined}
      onKeyDown={
        selectable && onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={selectable ? 'button' : 'img'}
      tabIndex={selectable ? 0 : undefined}
      aria-label={ariaLabel}
    >
      <svg viewBox="0 0 100 134" width={width} height={height} style={{ display: 'block' }}>
        {tileFaceArt(resolvedKind, resolvedRed)}
      </svg>
    </div>
  );
});
