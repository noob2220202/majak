import { useState } from 'react';
import type { RankTier } from '@cheongiwa/protocol';

/**
 * 등급 배지 (§3.2). 겉으로 보이는 등급 표시는 이것 하나뿐이다 — MMR 수치는
 * 어디에도 안 나온다.
 *
 * 원화가 아직 없는 티어는 **글자만** 보여 준다. 이미지를 못 불러오면 조용히 숨기고
 * 표기를 남기므로, 원화가 들어오는 순간 코드 변경 없이 켜진다.
 */

const BADGE_FILE: Record<RankTier, string> = {
  유생: 'badge-tier-yusaeng',
  진사: 'badge-tier-jinsa',
  급제: 'badge-tier-geupje',
  장원: 'badge-tier-jangwon',
};

export function TierBadge({
  tier,
  label,
  size = 20,
  className = '',
  title,
}: {
  tier: RankTier;
  /** "진사 4급" 처럼 서버가 만들어 준 표기 */
  label: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  const [artOk, setArtOk] = useState(true);

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{ fontFamily: 'var(--font-serif-kr)' }}
      title={title}
    >
      {artOk && (
        <img
          src={`/art/${BADGE_FILE[tier]}.webp`}
          alt=""
          aria-hidden="true"
          className="shrink-0 object-contain"
          style={{ width: size, height: size }}
          onError={() => setArtOk(false)}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
