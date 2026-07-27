/**
 * 제호 — 수막새 문양이 달린 나무 현판에 「청기와」.
 *
 * 로비 좌상단과 첫 화면이 **같은 그림 한 장**을 쓴다. 화면마다 따로 그리면
 * 또 따로 놀기 시작한다 (현판 4장에서 이미 겪었다).
 *
 * 원화에는 글자가 없다 — 글씨판만 비워 두고 나온다. 서체가 바뀌어도 원화를
 * 다시 뽑을 일이 없고, 판 크기만 주면 글자가 알아서 따라 커진다.
 */

/** 원화(417×137)에서 잰 글씨판 위치 — 왼쪽 37%는 수막새가 차지한다 */
const FACE = { left: '37%', right: '7%', top: '20%', bottom: '24%' };

/**
 * 글자 크기는 판 너비에 비례시킨다. 글씨판이 판 너비의 56%이고 「청기와」가
 * 자간까지 3.7em쯤이므로 13.5%면 좌우로 여유가 남는다.
 *
 * `calc(width * 0.135)` 로 하면 안 된다 — 넘겨받은 width 에 `%` 가 섞여 있으면
 * (`min(260px,72%)` 처럼) 글자 크기에서의 `%` 는 **부모 글자 크기**를 뜻해서
 * 1.5px 짜리 글자가 나온다. 실제로 첫 화면에서 제호가 통째로 사라졌다.
 * 컨테이너 기준 단위(cqw)를 쓰면 width 를 어떻게 적었든 판 너비를 따라간다.
 */
const TEXT_SIZE = '13.5cqw';

export function Wordmark({
  width,
  className = '',
  as: Tag = 'span',
}: {
  /** CSS 길이 — px·vw·clamp() 무엇이든. 비율과 높이는 이미지가 정한다 */
  width: string;
  className?: string;
  as?: 'span' | 'h1' | 'h2';
}) {
  return (
    <Tag
      className={`relative block ${className}`}
      style={{
        width,
        containerType: 'inline-size',
        filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.55))',
      }}
    >
      <img src="/art/logo-wordmark.webp" alt="" aria-hidden="true" className="block h-auto w-full" />
      <span className="absolute grid place-items-center" style={FACE}>
        <span
          aria-hidden="true"
          className="font-black leading-none tracking-[0.22em] text-ink"
          style={{
            fontFamily: 'var(--font-serif-kr)',
            fontSize: TEXT_SIZE,
            // 자간이 마지막 글자 뒤에도 붙어 오른쪽으로 밀린다 — 그만큼 되돌린다
            marginRight: '-0.22em',
          }}
        >
          청기와
        </span>
      </span>
      <span className="sr-only">청기와</span>
    </Tag>
  );
}
