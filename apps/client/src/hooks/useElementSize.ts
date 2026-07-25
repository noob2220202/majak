import { useLayoutEffect, useState } from 'react';

/**
 * 요소의 실제 크기(px)를 재서 돌려준다.
 *
 * 대국 화면은 패·마작상을 고정 px로 짜 놓아서 좁은 화면에서 그대로 넘쳤다.
 * 미디어 쿼리로 단계마다 값을 새로 박는 대신, 실제 크기를 재서 비례로 줄인다.
 * 아직 재기 전이면 0이므로 호출부에서 기본값으로 갈음한다.
 *
 * 재는 대상은 **CSS가 크기를 정하는 요소**여야 한다. 잰 값으로 그 요소의 크기를
 * 다시 정하면 되먹임이 생겨 값이 진동한다.
 *
 * ref 는 콜백 ref 다 — 조건부로 붙는 요소도 붙는 순간부터 바로 관측된다.
 */
export function useElementSize<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  width: number;
  height: number;
} {
  const [node, setNode] = useState<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!node) return;
    const measure = (): void => {
      setSize((prev) =>
        prev.width === node.clientWidth && prev.height === node.clientHeight
          ? prev
          : { width: node.clientWidth, height: node.clientHeight },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [node]);

  return { ref: setNode, width: size.width, height: size.height };
}
