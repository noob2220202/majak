import { memo, type CSSProperties } from 'react';
import { isRedFiveId, kindOfTile, type TileId } from '@cheongiwa/engine';
import { tileFaceArt } from './tileArt';

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
    // 패 뒷면: 쪽빛 바탕 + 금박 수막새 (게임의 아이콘, §4.4).
    // 작게 그릴 때는 문양이 뭉치므로 단순한 고리만 남긴다 (LOD).
    const detailed = width >= 26;
    const petals = [0, 1, 2, 3, 4, 5].map((i) => (i * Math.PI) / 3);
    return (
      <div
        style={{
          ...base,
          background: 'linear-gradient(160deg, #33528f 0%, #243b6b 52%, #1a2b50 100%)',
        }}
        aria-label={ariaLabel ?? '패 뒷면'}
      >
        <svg viewBox="0 0 100 134" width={width} height={height} style={{ display: 'block' }}>
          {detailed && (
            <rect x={6} y={7} width={88} height={120} rx={9} fill="none" stroke="#c8a24b" strokeOpacity={0.25} strokeWidth={2} />
          )}
          <circle
            cx={50}
            cy={67}
            r={detailed ? 30 : 26}
            fill="none"
            stroke="#c8a24b"
            strokeOpacity={detailed ? 0.95 : 0.75}
            strokeWidth={detailed ? 3 : 5}
          />
          {detailed && (
            <>
              <circle cx={50} cy={67} r={22} fill="none" stroke="#c8a24b" strokeOpacity={0.45} strokeWidth={1.2} />
              {petals.map((a, i) => (
                <ellipse
                  key={i}
                  cx={50 + Math.cos(a) * 14}
                  cy={67 + Math.sin(a) * 14}
                  rx={7}
                  ry={4.2}
                  fill="#c8a24b"
                  opacity={0.8}
                  transform={`rotate(${(a * 180) / Math.PI} ${50 + Math.cos(a) * 14} ${67 + Math.sin(a) * 14})`}
                />
              ))}
            </>
          )}
          <circle cx={50} cy={67} r={detailed ? 6 : 8} fill="#e6c87a" />
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
