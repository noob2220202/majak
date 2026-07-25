import { memo, type CSSProperties, type ReactNode } from 'react';

/**
 * 원화 UI 조각 (`public/art/*.webp`) 위에 글자를 얹는 공용 컴포넌트.
 *
 * 원화에는 기와 지붕·구름 장식이 붙어 있어 CSS로 늘리면 문양이 뭉개진다. 그래서
 * 9-slice 대신 **이미지를 그대로 두고 안쪽 영역(inset)에 글자만 얹는** 방식을 쓴다.
 * 크기 비율은 이미지가 정하고, inset 만 컴포넌트가 들고 있다.
 */

interface ArtSurfaceProps {
  src: string;
  /** 콘텐츠가 앉는 안쪽 영역 (%) */
  inset: { top: string; bottom: string; left: string; right: string };
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dim?: boolean;
}

/**
 * 비율은 **이미지가 스스로 정한다.**
 * 처음엔 `aspect-ratio`에 원본 비율을 하드코딩했는데, 원화를 갈아끼우자 전부 깨졌다
 * (제목 현판 2.74→2.54, 탭 2.07→1.50). 이미지를 일반 블록으로 두고 글자만 그 위에
 * 절대 배치하면 비율이 자동으로 따라와 다시는 안 깨진다.
 */
const Surface = memo(function Surface({
  src,
  inset,
  children,
  className = '',
  style,
  dim = false,
}: ArtSurfaceProps) {
  return (
    <span className={`relative block ${className}`} style={style}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="block h-auto w-full"
        style={{ filter: dim ? 'saturate(0.5) brightness(0.62)' : undefined }}
      />
      <span
        className="absolute flex items-center justify-center"
        style={{ top: inset.top, bottom: inset.bottom, left: inset.left, right: inset.right }}
      >
        {children}
      </span>
    </span>
  );
});

// ── 버튼 ──────────────────────────────────────────────────────────────

/** 큰 확인 버튼 (홍색 알약형) */
export function ArtCta({
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group block w-full transition active:scale-[0.985] disabled:opacity-40 ${className}`}
    >
      <Surface
        src="/art/btn-cta.webp"
        inset={{ top: '12%', bottom: '30%', left: '18%', right: '18%' }}
        className="w-full transition group-hover:brightness-110"
      >
        <span
          className="whitespace-nowrap text-[clamp(0.85rem,1.6vw,1.15rem)] font-black tracking-[0.15em] text-hanji"
          style={{ fontFamily: 'var(--font-serif-kr)', textShadow: '0 2px 4px rgba(90,10,10,0.8)' }}
        >
          {children}
        </span>
      </Surface>
    </button>
  );
}

/** 선택형 옵션 버튼 — 선택되면 원색, 아니면 채도를 죽인다 */
export function ArtOption({
  children,
  active,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  active: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="group block w-full transition active:scale-[0.985] disabled:opacity-40"
    >
      <Surface
        src="/art/btn-option-off.webp"
        inset={{ top: '12%', bottom: '32%', left: '12%', right: '12%' }}
        dim={!active}
        className="w-full transition group-hover:brightness-110"
      >
        <span
          className={`whitespace-nowrap text-[clamp(0.7rem,1.3vw,0.95rem)] font-bold ${
            active ? 'text-gold-hi' : 'text-hanji/70'
          }`}
        >
          {children}
        </span>
      </Surface>
    </button>
  );
}

/** 뒤로가기·닫기 (육각 목패) */
export function ArtBack({ onClick, label = '뒤로' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="group block w-16 transition active:scale-95"
    >
      <Surface
        src="/art/btn-back.webp"
        inset={{ top: '28%', bottom: '26%', left: '16%', right: '16%' }}
        className="w-full transition group-hover:brightness-110"
      >
        <span className="text-sm font-bold text-ink" style={{ fontFamily: 'var(--font-serif-kr)' }}>
          {label}
        </span>
      </Surface>
    </button>
  );
}

// ── 제목·탭 ───────────────────────────────────────────────────────────

/** 화면 제목 현판 */
export function ArtTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Surface
      // 크림색 판은 세로 4~48% 구간뿐이고 아래 절반은 매듭 술이다
      src="/art/plaque-title.webp"
      inset={{ top: '4%', bottom: '54%', left: '8%', right: '8%' }}
      className={className}
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' }}
    >
      <span
        className="whitespace-nowrap text-[clamp(0.95rem,2vw,1.6rem)] font-black tracking-[0.12em] text-ink"
        style={{ fontFamily: 'var(--font-serif-kr)', textShadow: '0 1px 2px rgba(255,250,235,0.6)' }}
      >
        {children}
      </span>
    </Surface>
  );
}

/**
 * 탭 (선택/비선택 원화가 따로 있다).
 * 비선택 원화가 선택본보다 오히려 화려해 대비가 뒤집히므로, 비선택을 눌러서 죽인다.
 */
export function ArtTab({
  children,
  active,
  onClick,
}: {
  children: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group block w-[clamp(78px,11vw,124px)] transition"
    >
      <Surface
        src={active ? '/art/tab-on.webp' : '/art/tab-off.webp'}
        inset={{ top: '20%', bottom: '22%', left: '10%', right: '10%' }}
        dim={!active}
        className="w-full transition group-hover:brightness-110"
      >
        <span
          className={`whitespace-nowrap text-[clamp(0.65rem,1.1vw,0.85rem)] font-bold ${
            active ? 'text-ink' : 'text-hanji/70'
          }`}
        >
          {children}
        </span>
      </Surface>
    </button>
  );
}

// ── 장식 ──────────────────────────────────────────────────────────────

/** 패널 네 모서리 장식 — 원화 한 장을 미러링해서 네 귀퉁이에 건다 */
export function ArtCorners({ size = 34 }: { size?: number }) {
  const corners = [
    { className: 'left-0 top-0', transform: 'none' },
    { className: 'right-0 top-0', transform: 'scaleX(-1)' },
    { className: 'bottom-0 left-0', transform: 'scaleY(-1)' },
    { className: 'bottom-0 right-0', transform: 'scale(-1)' },
  ];
  return (
    <>
      {corners.map((c) => (
        <img
          key={c.className}
          src="/art/panel-corner.webp"
          alt=""
          aria-hidden="true"
          className={`pointer-events-none absolute ${c.className}`}
          style={{ width: size, transform: c.transform, opacity: 0.9 }}
        />
      ))}
    </>
  );
}

/** 아이콘 버튼 — 원화 아이콘 하나 + 아래 라벨 */
export function ArtIconButton({
  icon,
  label,
  onClick,
  size = 42,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  size?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group flex flex-col items-center gap-0.5 transition active:scale-95"
    >
      <img
        src={`/art/${icon}.webp`}
        alt=""
        aria-hidden="true"
        style={{ height: size }}
        className="w-auto transition group-hover:-translate-y-0.5 group-hover:brightness-110"
      />
      <span
        className="text-[11px] font-semibold text-hanji/85 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
        style={{ fontFamily: 'var(--font-serif-kr)' }}
      >
        {label}
      </span>
    </button>
  );
}
