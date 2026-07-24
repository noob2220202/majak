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

/** 낙관 도장 콜 버튼 (§4.3) — 인주색 사각 도장에 한지색 글자 */
export function SealButton({
  label,
  onClick,
  variant = 'seal',
}: {
  label: string;
  onClick: () => void;
  variant?: 'seal' | 'pass';
}): ReactNode {
  const isPass = variant === 'pass';
  return (
    <button
      onClick={onClick}
      className="group relative grid place-items-center"
      style={{ width: 62, height: 62 }}
      aria-label={label}
    >
      <span
        className="grid h-full w-full place-items-center rounded-[10px] font-black tracking-tight shadow-lg transition-transform duration-100 group-hover:scale-105 group-active:scale-95"
        style={{
          background: isPass ? 'rgba(244,237,221,0.14)' : 'linear-gradient(160deg,#c9433a,#a5271f)',
          color: isPass ? 'var(--hanji)' : 'var(--hanji)',
          border: isPass ? '1px solid rgba(244,237,221,0.35)' : '1px solid rgba(255,220,210,0.35)',
          fontSize: label.length > 2 ? 18 : 24,
          fontFamily: 'var(--font-serif-kr)',
        }}
      >
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
