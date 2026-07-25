import { useMemo } from 'react';
import { kindOfTile, type RuleSettings } from '@cheongiwa/engine';
import type { LocalGame } from '../../store/game';
import { Tile } from '../../tiles/Tile';
import { analyzeWaits, isFuritenLocal } from './handAnalysis';

/** 텐파이 시 대기패 + 예상 점수 + 후리텐 표시 (§5.3). */
export function WaitsStrip({ game, rules }: { game: LocalGame; rules: RuleSettings }) {
  const mySeatView = game.seats[game.mySeat];
  const info = useMemo(() => {
    if (!mySeatView) return null;
    const handKinds = game.myHand.map(kindOfTile);
    const waits = analyzeWaits(
      handKinds,
      mySeatView.melds,
      game.myHand,
      game.round,
      game.mySeat,
      rules,
      mySeatView.riichi?.accepted ?? false,
    );
    if (waits.length === 0) return null;
    const furiten = isFuritenLocal(
      waits.map((w) => w.kind),
      mySeatView.discards.map((d) => d.tileId),
    );
    return { waits, furiten };
  }, [game.myHand, game.round, game.mySeat, mySeatView, rules]);

  if (!info) return null;

  return (
    // 국사무쌍은 대기가 13종이라 좁은 화면에서 넘친다 — 줄바꿈을 허용한다
    <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-lg bg-ink/60 px-3 py-1.5 ring-1 ring-hanji/10">
      <span className="text-xs font-semibold text-dan-green">텐파이</span>
      {info.furiten && (
        <span className="rounded bg-dan-red/30 px-1.5 py-0.5 text-[10px] font-bold text-dan-red">
          후리텐
        </span>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {info.waits.map((w) => (
          <div key={w.kind} className="flex flex-col items-center">
            <Tile kind={w.kind} width={20} dimmed={info.furiten} />
            <span className="text-[10px] tabular-nums text-hanji/60">
              {w.han === null
                ? '역 없음'
                : w.han < 0
                  ? '역만'
                  : w.points !== null
                    ? `${w.points}`
                    : `${w.han}판`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
