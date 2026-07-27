import type { ReactNode } from 'react';

/**
 * 목패 칩 — 등급·엽전처럼 **짧은 값 하나**가 앉는 자리.
 *
 * 원화(`chip-slot`)를 배경으로 늘려 쓴다. 알약 모양이라 가로로 늘려도 문양이 안 뭉개진다.
 * 로비와 저잣거리가 같은 칩을 쓴다 — 잔액이 화면마다 다른 모양으로 나오면 그것부터
 * 따로 노는 것으로 읽힌다.
 */
export function Chip({
  children,
  title,
  className = '',
}: {
  children: ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-10 shrink-0 items-center justify-center gap-1.5 px-5 text-sm font-bold text-gold-hi ${className}`}
      title={title}
      style={{
        backgroundImage: 'url(/art/chip-slot.webp)',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {children}
    </span>
  );
}
