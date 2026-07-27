import { useState } from 'react';
import { ArtTab } from '../../components/art';
import { LOBBY_TONE } from '../../components/ui';
import { useGame } from '../../store/game';
import { YAKU_LIST } from './yakuList';

type Tab = 'settings' | 'yaku' | 'log';

/**
 * 대국 우측 기둥 (설정·역 일람·기록).
 *
 * 회색 판에 초록 iOS 스위치라 로비와 전혀 다른 물건처럼 보였다. 판은 로비 현판과
 * 같은 남색+금테, 탭은 저잣거리와 같은 원화 탭, 스위치는 팔레트 안의 금색으로 맞췄다.
 */

/**
 * 구역 사이 금박 실선.
 *
 * `divider` 원화를 써 보려 했는데 720×14 짜리 띠 가운데에만 문양이 있어, 폭에 맞춰
 * 늘리면 그 문양만 커지고 선은 안 그어졌다. 실선은 CSS 로 긋는 게 맞다.
 */
function Divider() {
  return (
    <span
      aria-hidden="true"
      className="my-1.5 block h-px w-full"
      style={{
        background:
          'linear-gradient(90deg, transparent 0%, rgba(200,162,75,0.55) 20%, rgba(200,162,75,0.55) 80%, transparent 100%)',
      }}
    />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p
      className="mt-1 text-[11px] font-bold tracking-[0.2em] text-gold/80"
      style={{ fontFamily: 'var(--font-serif-kr)' }}
    >
      {children}
    </p>
  );
}

function AutoToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
        value
          ? 'bg-gold/15 text-hanji ring-1 ring-gold/40'
          : 'bg-ink/40 text-hanji/70 ring-1 ring-hanji/10 hover:bg-ink/25'
      }`}
    >
      <span>{label}</span>
      <span
        className={`ml-3 inline-block h-5 w-9 rounded-full p-0.5 transition ${
          value ? 'bg-gold' : 'bg-hanji/20'
        }`}
      >
        <span
          className={`block size-4 rounded-full transition ${
            value ? 'translate-x-4 bg-ink' : 'bg-hanji'
          }`}
        />
      </span>
    </button>
  );
}

export function SidePanel() {
  const [tab, setTab] = useState<Tab>('settings');
  const [query, setQuery] = useState('');
  const { auto, setAuto, hints, toggleHints, simplified, toggleSimplified, sound, setSound, game } =
    useGame();

  const tabs: Array<[Tab, string]> = [
    ['settings', '설정'],
    ['yaku', '역 일람'],
    ['log', '기록'],
  ];

  const filtered = query ? YAKU_LIST.filter((y) => y.name.includes(query)) : YAKU_LIST;

  return (
    // 폭은 쓰는 쪽이 정한다 — 데스크톱은 우측 기둥, 좁은 화면은 서랍
    <div className={`flex h-full w-full flex-col rounded-xl ${LOBBY_TONE}`}>
      <div className="flex items-end gap-0.5 px-1.5 pt-1.5">
        {tabs.map(([t, label]) => (
          <div key={t} className="min-w-0 flex-1">
            <ArtTab className="w-full" active={tab === t} onClick={() => setTab(t)}>
              {label}
            </ArtTab>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'settings' && (
          <div className="flex flex-col gap-2">
            <SectionLabel>자동 편의</SectionLabel>
            <AutoToggleRow
              label="자동 화료"
              value={auto.autoWin}
              onChange={(v) => setAuto({ autoWin: v })}
            />
            <AutoToggleRow
              label="울기 스킵"
              value={auto.autoSkipCalls}
              onChange={(v) => setAuto({ autoSkipCalls: v })}
            />
            <AutoToggleRow
              label="자동 쯔모기리"
              value={auto.autoTsumogiri}
              onChange={(v) => setAuto({ autoTsumogiri: v })}
            />

            <Divider />
            <SectionLabel>표시·연출</SectionLabel>
            <AutoToggleRow label="유효패 힌트" value={hints} onChange={() => toggleHints()} />
            <AutoToggleRow
              label="연출 간소화"
              value={simplified}
              onChange={() => toggleSimplified()}
            />
            <p className="text-[11px] leading-relaxed text-hanji/40">
              힌트는 버리면 텐파이가 되는 패를 금색으로 표시합니다. 경기 감각을 원하면 끄세요.
            </p>

            <Divider />
            <SectionLabel>소리</SectionLabel>
            <AutoToggleRow
              label="음소거"
              value={sound.muted}
              onChange={(v) => setSound({ muted: v })}
            />
            <label className="flex items-center gap-2 rounded-lg bg-ink/40 px-3 py-2 text-sm text-hanji/85 ring-1 ring-hanji/10">
              <span className="shrink-0">볼륨</span>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(sound.volume * 100)}
                onChange={(e) => setSound({ volume: Number(e.target.value) / 100 })}
                className="w-full accent-[var(--gold)]"
                aria-label="볼륨"
              />
            </label>
          </div>
        )}

        {tab === 'yaku' && (
          <div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="역 검색"
              className="mb-2 w-full rounded-md bg-white/90 px-2 py-1.5 text-sm text-ink outline-none"
            />
            <ul className="flex flex-col gap-1">
              {filtered.map((y) => (
                <li key={y.name} className="rounded-md bg-ink/40 px-2.5 py-1.5 ring-1 ring-hanji/10">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-hanji">{y.name}</span>
                    <span className="shrink-0 text-xs text-gold-hi">{y.han}</span>
                  </div>
                  {y.note && <p className="mt-0.5 text-[11px] text-hanji/45">{y.note}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === 'log' && (
          <ul className="flex flex-col gap-1 text-xs text-hanji/70">
            {(game?.eventLog ?? []).map((line, i) => (
              <li key={i} className={line.startsWith('──') ? 'mt-1 font-semibold text-gold-hi' : ''}>
                {line}
              </li>
            ))}
            {(game?.eventLog.length ?? 0) === 0 && <li className="text-hanji/40">기록 없음</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
