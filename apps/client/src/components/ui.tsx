import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'seal' | 'subtle';

const VARIANT: Record<Variant, string> = {
  primary: 'bg-giwa text-hanji hover:brightness-110 shadow-lg',
  ghost: 'border border-hanji/30 text-hanji hover:bg-hanji/10',
  seal: 'bg-seal text-hanji font-bold hover:brightness-110 shadow-lg',
  subtle: 'bg-hanji/10 text-hanji/80 hover:bg-hanji/20',
};

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }): ReactNode {
  return (
    <button
      className={`rounded-md px-4 py-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANT[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * 판.
 *
 * `lobby` 는 로비 현판·명패와 같은 톤이다 — 남색 판에 금테. 로비에서 현판이 잠깐
 * 물러나고 대신 뜨는 것들(대기 중·코드 입력·보상 내역)이 회색 상자로 나오면
 * 그 순간만 화면이 다른 게임처럼 보인다.
 */
type PanelTone = 'default' | 'lobby';

/** 판 자체가 아니라 다른 요소에 같은 톤만 입히고 싶을 때 (예: 애니메이션 래퍼) */
export const LOBBY_TONE =
  'border-2 border-gold/50 bg-[#1a2030]/95 shadow-[0_8px_20px_rgba(0,0,0,0.5)]';

const PANEL_TONE: Record<PanelTone, string> = {
  default: 'bg-giwa/80 ring-1 ring-hanji/10 backdrop-blur',
  lobby: LOBBY_TONE,
};

export function Panel({
  children,
  className = '',
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  tone?: PanelTone;
}): ReactNode {
  return (
    <div className={`rounded-xl p-4 ${PANEL_TONE[tone]} ${className}`}>{children}</div>
  );
}

/**
 * 낙관 도장 콜 버튼 (§4.3) — 인주색 사각 도장에 한지색 전각 글자.
 * 등장 시 "쾅" 찍히는 모션(scale 1.35→1) + 잉크 번짐. 가장 기억에 남을 인터랙션.
 */
export function SealButton({
  label,
  onClick,
  variant = 'seal',
  delay = 0,
  simplified = false,
}: {
  label: string;
  onClick: () => void;
  variant?: 'seal' | 'pass';
  delay?: number;
  simplified?: boolean;
}): ReactNode {
  const isPass = variant === 'pass';
  return (
    <button
      onClick={onClick}
      className="group relative grid place-items-center"
      style={{ width: 64, height: 64 }}
      aria-label={label}
    >
      <span
        className={`relative grid h-full w-full place-items-center font-black tracking-tight transition-transform duration-100 group-hover:scale-105 group-active:scale-95 ${
          simplified ? '' : 'anim-stamp'
        }`}
        style={{
          animationDelay: simplified ? undefined : `${delay}ms`,
          borderRadius: 9,
          background: isPass
            ? 'rgba(244,237,221,0.1)'
            : 'radial-gradient(circle at 32% 26%, #d1544a 0%, #c03b2e 45%, #98241c 100%)',
          color: 'var(--hanji)',
          border: isPass ? '1px solid rgba(244,237,221,0.3)' : '2px solid rgba(255,214,204,0.4)',
          boxShadow: isPass
            ? 'none'
            : '0 3px 10px rgba(0,0,0,0.45), 0 0 0 3px rgba(192,59,46,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
          fontSize: label.length > 2 ? 19 : 27,
          fontFamily: 'var(--font-serif-kr)',
          textShadow: isPass ? 'none' : '0 1px 2px rgba(0,0,0,0.4)',
        }}
      >
        {!isPass && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              borderRadius: 9,
              background:
                'radial-gradient(circle at 78% 82%, rgba(0,0,0,0.35) 0%, transparent 42%), radial-gradient(circle at 14% 74%, rgba(0,0,0,0.28) 0%, transparent 38%)',
              mixBlendMode: 'multiply',
            }}
          />
        )}
        {label}
      </span>
    </button>
  );
}
