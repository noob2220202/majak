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

export function Panel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <div className={`rounded-xl bg-giwa/80 p-4 ring-1 ring-hanji/10 backdrop-blur ${className}`}>
      {children}
    </div>
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

export function ConnectionBadge({ status }: { status: string }): ReactNode {
  const dot =
    status === 'connected'
      ? 'bg-dan-green'
      : status === 'connecting'
        ? 'bg-gold animate-pulse'
        : 'bg-dan-red';
  const label =
    status === 'connected' ? '서버 연결됨' : status === 'connecting' ? '연결 중' : '연결 끊김';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-hanji/60">
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
