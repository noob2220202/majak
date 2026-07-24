import { useState } from 'react';
import { useGame } from '../../store/game';
import { YAKU_LIST } from './yakuList';

type Tab = 'settings' | 'yaku' | 'log';

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
      className="flex w-full items-center justify-between rounded-lg bg-hanji/5 px-3 py-2 text-sm text-hanji/85"
    >
      <span>{label}</span>
      <span
        className={`ml-3 inline-block h-5 w-9 rounded-full p-0.5 transition ${value ? 'bg-dan-green' : 'bg-hanji/20'}`}
      >
        <span className={`block size-4 rounded-full bg-hanji transition ${value ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}

export function SidePanel() {
  const [tab, setTab] = useState<Tab>('settings');
  const [query, setQuery] = useState('');
  const { auto, setAuto, hints, toggleHints, game } = useGame();

  const tabs: Array<[Tab, string]> = [
    ['settings', '설정'],
    ['yaku', '역 일람'],
    ['log', '기록'],
  ];

  const filtered = query
    ? YAKU_LIST.filter((y) => y.name.includes(query))
    : YAKU_LIST;

  return (
    <div className="flex h-full w-64 flex-col rounded-xl bg-giwa/80 ring-1 ring-hanji/10">
      <div className="flex border-b border-hanji/10">
        {tabs.map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold transition ${
              tab === t ? 'bg-hanji/10 text-hanji' : 'text-hanji/50 hover:text-hanji/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'settings' && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-hanji/50">자동 편의</p>
            <AutoToggleRow label="자동 화료" value={auto.autoWin} onChange={(v) => setAuto({ autoWin: v })} />
            <AutoToggleRow label="울기 스킵" value={auto.autoSkipCalls} onChange={(v) => setAuto({ autoSkipCalls: v })} />
            <AutoToggleRow label="자동 쯔모기리" value={auto.autoTsumogiri} onChange={(v) => setAuto({ autoTsumogiri: v })} />
            <p className="mt-3 text-xs text-hanji/50">표시</p>
            <AutoToggleRow label="유효패 힌트" value={hints} onChange={() => toggleHints()} />
            <p className="mt-2 text-[11px] leading-relaxed text-hanji/40">
              힌트는 버리면 텐파이가 되는 패를 금색으로 표시합니다. 경기 감각을 원하면 끄세요.
            </p>
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
                <li key={y.name} className="rounded-md bg-hanji/5 px-2.5 py-1.5">
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
