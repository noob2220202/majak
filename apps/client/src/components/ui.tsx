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
 * 등장 시 "쾅" 찍히는 모션(scale 1.35→1). 가장 기억에 남을 인터랙션.
 *
 * 도장 면은 원화(`stamp-seal`)다. 그라디언트로 그렸을 때는 그냥 빨간 네모였는데,
 * 원화에는 단청 테두리와 손으로 찍은 듯 고르지 않은 가장자리가 있다.
 * 글자는 CSS 가 얹으므로 론·퐁·치·깡이 전부 이 한 장을 쓴다.
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
          // `background` 단축 속성을 섞으면 안 된다 — React 는 값이 undefined 인 속성에
          // 빈 문자열을 넣는데, 단축 속성에 빈 값이 들어가면 앞서 지정한 background-image
          // 까지 같이 지워진다. 실제로 도장이 통째로 안 보였다. 전부 개별 속성으로 쓴다.
          backgroundImage: isPass ? 'none' : 'url(/art/stamp-seal.webp)',
          backgroundSize: '100% 100%',
          backgroundRepeat: 'no-repeat',
          backgroundColor: isPass ? 'rgba(244,237,221,0.1)' : 'transparent',
          color: 'var(--hanji)',
          border: isPass ? '1px solid rgba(244,237,221,0.3)' : undefined,
          filter: isPass ? undefined : 'drop-shadow(0 3px 10px rgba(0,0,0,0.5))',
          fontSize: label.length > 2 ? 19 : 27,
          fontFamily: 'var(--font-serif-kr)',
          textShadow: isPass ? 'none' : '0 2px 4px rgba(90,10,5,0.75)',
        }}
      >
        {label}
      </span>
    </button>
  );
}
