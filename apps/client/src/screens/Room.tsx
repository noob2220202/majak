import { useState } from 'react';
import type { RuleSettings } from '@cheongiwa/engine';
import type { RoomMemberView } from '@cheongiwa/protocol';
import { Button, Panel } from '../components/ui';
import { send } from '../net/socket';
import { useGame } from '../store/game';
import { Scene } from './Scene';
import { ArtBack, ArtCta, ArtOption, ArtTitle } from '../components/art';
import { DancheongBorder, Yeopjeon } from '../motifs/Motifs';

const WIND_SEAT = ['동', '남', '서', '북'];

function SeatCard({ member }: { member: RoomMemberView | undefined }) {
  if (!member) {
    return (
      <div className="grid h-28 place-items-center rounded-xl border border-dashed border-hanji/20 text-hanji/40">
        빈자리
      </div>
    );
  }
  return (
    <div
      className={`tex-hanji relative grid h-28 place-items-center overflow-hidden rounded-xl p-3 text-center ring-1 ${
        member.ready ? 'bg-dan-green/20 ring-dan-green/45' : 'bg-hanji/10 ring-hanji/15'
      }`}
    >
      <div>
        <p className="flex items-center justify-center gap-1.5 font-semibold text-hanji">
          {member.isHost && <Yeopjeon size={13} />}
          {member.nickname}
        </p>
        <p className="mt-1 text-xs text-hanji/55">
          {member.isBot ? '봇' : member.connected ? '접속 중' : '연결 끊김'}
          {member.ready ? ' · 준비 완료' : ''}
        </p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="flex items-center justify-between rounded-lg bg-hanji/5 px-3 py-2 text-sm text-hanji/85 disabled:opacity-70"
    >
      <span>{label}</span>
      <span
        className={`ml-3 inline-block h-5 w-9 rounded-full p-0.5 transition ${
          value ? 'bg-dan-green' : 'bg-hanji/20'
        }`}
      >
        <span
          className={`block size-4 rounded-full bg-hanji transition ${value ? 'translate-x-4' : ''}`}
        />
      </span>
    </button>
  );
}

function RulesPanel({ rules, isHost }: { rules: RuleSettings; isHost: boolean }) {
  const patch = (next: Partial<RuleSettings>): void => {
    send.roomSetRules({ ...rules, ...next });
  };
  return (
    <Panel className="tex-changho relative overflow-hidden">
      <div className="absolute inset-x-0 top-0">
        <DancheongBorder height={4} />
      </div>
      <h3 className="mb-3 pt-2 font-semibold text-hanji">룰 설정</h3>
      <div className="mb-3 flex gap-2">
        {(['hanchan', 'tonpuu'] as const).map((g) => (
          <div key={g} className="flex-1">
            <ArtOption
              active={rules.gameLength === g}
              disabled={!isHost}
              onClick={() => patch({ gameLength: g })}
            >
              {g === 'hanchan' ? '반장전' : '동풍전'}
            </ArtOption>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Toggle label="적도라" value={rules.redFives} disabled={!isHost} onChange={(v) => patch({ redFives: v })} />
        <Toggle label="우라도라" value={rules.uraDora} disabled={!isHost} onChange={(v) => patch({ uraDora: v })} />
        <Toggle label="쿠이탕" value={rules.kuitan} disabled={!isHost} onChange={(v) => patch({ kuitan: v })} />
        <Toggle label="나가시만관" value={rules.nagashiMangan} disabled={!isHost} onChange={(v) => patch({ nagashiMangan: v })} />
        <Toggle label="토비 종료" value={rules.tobi} disabled={!isHost} onChange={(v) => patch({ tobi: v })} />
        <Toggle label="서입" value={rules.westEntry} disabled={!isHost} onChange={(v) => patch({ westEntry: v })} />
        <Toggle label="아가리야메" value={rules.agariYame} disabled={!isHost} onChange={(v) => patch({ agariYame: v })} />
        <Toggle label="카조에역만" value={rules.kazoeYakuman} disabled={!isHost} onChange={(v) => patch({ kazoeYakuman: v })} />
      </div>
      <p className="mt-3 text-xs text-hanji/45">
        우마 {rules.uma.join(' / ')} · 시작 25,000점{isHost ? '' : ' · 방장만 변경 가능'}
      </p>
    </Panel>
  );
}

export function Room() {
  const room = useGame((s) => s.room);
  const myNick = useGame((s) => s.nickname);
  const simplified = useGame((s) => s.simplified);
  const [copied, setCopied] = useState(false);
  if (!room) return null;

  const myMember = room.members.find((m) => !m.isBot && m.nickname === myNick);
  const isHost = myMember?.isHost ?? false;
  const humansReady = room.members.filter((m) => !m.isBot).every((m) => m.ready);

  const copyCode = (): void => {
    navigator.clipboard?.writeText(room.code).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
  };

  return (
    <Scene id="room" simplified={simplified}>
      <div className="mx-auto max-w-3xl px-4 pb-10 pt-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <ArtTitle className="mb-1 w-[clamp(140px,18vw,200px)]">
              {room.practice ? '연습 방' : '친선 방'}
            </ArtTitle>
            <button
              onClick={copyCode}
              className="flex items-center gap-2 text-3xl font-black tracking-[0.3em] text-hanji"
              style={{ fontFamily: 'var(--font-serif-kr)' }}
            >
              {room.code}
              <span className="rounded bg-hanji/15 px-2 py-1 text-xs font-normal tracking-normal text-hanji/70">
                {copied ? '복사됨' : '코드 복사'}
              </span>
            </button>
          </div>
          <ArtBack label="나가기" onClick={() => send.roomLeave()} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <SeatCard key={i} member={room.members[i]} />
          ))}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <RulesPanel rules={room.rules} isHost={isHost} />
          <div className="flex flex-col gap-3">
            {isHost ? (
              <>
                <Button
                  variant="ghost"
                  disabled={room.members.length >= 4}
                  onClick={() => send.roomAddBot()}
                >
                  봇 추가 ({room.members.filter((m) => m.isBot).length}명)
                </Button>
                <ArtCta disabled={!humansReady} onClick={() => send.roomStart()}>
                  대국 시작
                </ArtCta>
                {room.members.length < 4 && (
                  <p className="text-center text-xs text-hanji/50">빈자리는 봇으로 채웁니다</p>
                )}
                {!humansReady && (
                  <p className="text-center text-xs text-hanji/50">
                    참가자 전원의 준비를 기다리는 중
                  </p>
                )}
              </>
            ) : (
              <Button
                className="py-3 text-lg"
                variant={myMember?.ready ? 'subtle' : 'primary'}
                onClick={() => send.roomReady(!myMember?.ready)}
              >
                {myMember?.ready ? '준비 취소' : '준비 완료'}
              </Button>
            )}
            <p className="text-center text-xs text-hanji/45">
              좌석({WIND_SEAT.join('·')})은 대국 시작 시 무작위 배정됩니다
            </p>
          </div>
        </div>
      </div>
    </Scene>
  );
}
