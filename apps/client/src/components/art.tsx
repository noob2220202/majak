import { memo, type CSSProperties, type ReactNode } from 'react';

/**
 * 원화 UI 조각 (`public/art/*.webp`) 위에 글자를 얹는 공용 컴포넌트.
 *
 * 원화에는 기와 지붕·구름 장식이 붙어 있어 CSS로 늘리면 문양이 뭉개진다. 그래서
 * 9-slice 대신 **비율을 고정한 배경 이미지 + 안쪽 영역에 콘텐츠 배치** 방식을 쓴다.
 * 안쪽 비율(inset)은 이미지마다 달라 각 컴포넌트가 자기 값을 들고 있다.
 */

interface ArtSurfaceProps {
  src: string;
  /** 이미지 원본 비율 (width / height) */
  ratio: number;
  /** 콘텐츠가 앉는 안쪽 영역 (%) */
  inset: { top: string; bottom: string; left: string; right: string };
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  dim?: boolean;
}

const Surface = memo(function Surface({
  src,
  ratio,
  inset,
  children,
  className = '',
  style,
  dim = false,
}: ArtSurfaceProps) {
  return (
    <span className={`relative block ${className}`} style={{ aspectRatio: ratio, ...style }}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
        style={{ filter: dim ? 'saturate(0.45) brightness(0.7)' : undefined }}
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
        ratio={483 / 110}
        inset={{ top: '14%', bottom: '26%', left: '20%', right: '20%' }}
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
        ratio={301 / 120}
        inset={{ top: '10%', bottom: '34%', left: '12%', right: '12%' }}
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
        ratio={181 / 169}
        inset={{ top: '22%', bottom: '30%', left: '18%', right: '18%' }}
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
      src="/art/plaque-title.webp"
      ratio={602 / 220}
      inset={{ top: '14%', bottom: '30%', left: '12%', right: '12%' }}
      className={className}
      style={{ filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))' }}
    >
      <span
        className="whitespace-nowrap text-[clamp(1.1rem,2.4vw,1.8rem)] font-black tracking-[0.2em] text-hanji"
        style={{ fontFamily: 'var(--font-serif-kr)', textShadow: '0 2px 6px rgba(0,0,0,0.8)' }}
      >
        {children}
      </span>
    </Surface>
  );
}

/** 탭 (선택/비선택 원화가 따로 있다) */
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
        ratio={active ? 228 / 110 : 266 / 110}
        inset={{ top: '18%', bottom: '18%', left: '10%', right: '10%' }}
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
