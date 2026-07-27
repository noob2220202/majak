import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArtBack } from '../components/art';
import { Button } from '../components/ui';
import { send } from '../net/socket';
import { useGame } from '../store/game';

/**
 * 로비 계정 창 (PLAN.md §3.1).
 *
 * 게스트면 **승격**(가입)과 로그인을, 계정이면 비밀번호 변경과 로그아웃을 다룬다.
 * 가입 직후 받은 복구 코드는 여기서 딱 한 번 보여 준다 — 서버는 해시만 갖고 있어
 * 다시 꺼내 줄 방법이 없다.
 */

function Row({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  autoComplete,
  maxLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  maxLength?: number;
}) {
  return (
    <label htmlFor={id} className="mt-3 block first:mt-0">
      <span className="block text-xs font-semibold text-hanji/70">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md bg-white/90 px-3 py-2 text-sm text-ink outline-none"
      />
    </label>
  );
}

/** 가입·재설정 직후 딱 한 번 보이는 복구 코드 */
function RecoveryCode({ code }: { code: string }) {
  const clear = useGame((s) => s.clearRecoveryCode);
  const [copied, setCopied] = useState(false);

  return (
    <div className="rounded-xl bg-gold/12 p-4 ring-1 ring-gold/40">
      <p className="flex items-center gap-2 text-sm font-bold text-gold-hi">
        <img src="/art/icon-recovery-key.webp" alt="" aria-hidden="true" className="h-5 w-auto" />
        복구 코드
      </p>
      <p className="mt-1 text-xs leading-relaxed text-hanji/70">
        비밀번호를 잊었을 때 계정을 되찾는 <b className="text-hanji">유일한 수단</b>입니다.
        지금 적어 두세요 — 이 창을 닫으면 다시 볼 수 없습니다.
      </p>
      {/* 코드가 줄바꿈되면 옮겨 적다 틀리기 쉬워, 한 줄로 두고 좁으면 가로로 밀어 본다 */}
      <p className="mt-3 overflow-x-auto rounded-lg bg-ink/60 px-3 py-2 text-center">
        <span className="select-all whitespace-nowrap text-base font-black tracking-[0.1em] text-gold-hi">
          {code}
        </span>
      </p>
      <div className="mt-3 flex gap-2">
        <Button
          className="flex-1"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true));
          }}
        >
          {copied ? '복사됨' : '복사'}
        </Button>
        <Button variant="ghost" className="flex-1" onClick={clear}>
          적어 뒀습니다
        </Button>
      </div>
    </div>
  );
}

function GuestBody() {
  const wallet = useGame((s) => s.wallet);
  const stats = useGame((s) => s.stats);
  const nickname = useGame((s) => s.nickname);
  const [tab, setTab] = useState<'signup' | 'login'>('signup');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  const hasProgress = (wallet?.balance ?? 0) > 0 || (stats?.games ?? 0) > 0;

  const submit = (): void => {
    setLocal(null);
    const id = loginId.trim().toLowerCase();
    if (!id || !password) return setLocal('아이디와 비밀번호를 입력하세요');
    if (tab === 'login') return send.authLogIn({ loginId: id, password });
    if (password !== again) return setLocal('비밀번호가 서로 다릅니다');
    send.authSignUp({ loginId: id, password, nickname });
  };

  return (
    <>
      <p className="text-sm text-hanji/70">
        지금은 <b className="text-hanji">게스트</b>입니다. 기록이 이 브라우저에만 있어서, 방문
        기록을 지우거나 다른 기기에서 열면 이어서 둘 수 없습니다.
      </p>

      <div className="mt-4 flex rounded-lg bg-ink/40 p-1">
        {(
          [
            ['signup', '계정 만들기'],
            ['login', '기존 계정으로 로그인'],
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setTab(t);
              setLocal(null);
            }}
            aria-pressed={tab === t}
            className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
              tab === t ? 'bg-gold/25 text-gold-hi' : 'text-hanji/55 hover:text-hanji/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-3 rounded-lg bg-ink/40 px-3 py-2 text-xs leading-relaxed text-hanji/60">
        {tab === 'signup' ? (
          <>
            지금 계정을 만들면 <b className="text-gold-hi">엽전·전적·등급·산 치레거리가 그대로</b>{' '}
            따라옵니다.
          </>
        ) : hasProgress ? (
          <>
            로그인하면 그 계정으로 갈아탑니다 —{' '}
            <b className="text-dan-orange">지금 게스트로 모은 기록은 따라오지 않습니다.</b> 이어서
            쓰려면 [계정 만들기]를 고르세요.
          </>
        ) : (
          <>이미 계정이 있다면 로그인해서 이어서 두세요.</>
        )}
      </p>

      <div className="mt-3">
        <Row
          id="acc-loginId"
          label="아이디"
          value={loginId}
          onChange={(v) => setLoginId(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
          maxLength={16}
          autoComplete="username"
          placeholder="영문 소문자로 시작하는 4~16자"
        />
        <Row
          id="acc-password"
          label="비밀번호"
          type="password"
          value={password}
          onChange={setPassword}
          maxLength={128}
          autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          placeholder={tab === 'signup' ? '8자 이상' : ''}
        />
        {tab === 'signup' && (
          <Row
            id="acc-again"
            label="비밀번호 확인"
            type="password"
            value={again}
            onChange={setAgain}
            maxLength={128}
            autoComplete="new-password"
          />
        )}
      </div>

      {local && (
        <p role="alert" className="mt-3 text-sm text-dan-red">
          {local}
        </p>
      )}

      <Button className="mt-4 w-full" onClick={submit}>
        {tab === 'signup' ? '계정 만들기' : '로그인'}
      </Button>
    </>
  );
}

function AccountBody({ loginId }: { loginId: string }) {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [local, setLocal] = useState<string | null>(null);

  const submit = (): void => {
    setLocal(null);
    if (!current || !next) return setLocal('빈 칸을 채워 주세요');
    if (next !== again) return setLocal('새 비밀번호가 서로 다릅니다');
    send.authChangePassword({ current, next });
    setCurrent('');
    setNext('');
    setAgain('');
  };

  return (
    <>
      <div className="rounded-lg bg-ink/40 px-3 py-2.5">
        <p className="text-xs text-hanji/55">아이디</p>
        <p className="text-lg font-bold text-hanji">{loginId}</p>
      </div>

      {!open ? (
        <Button variant="ghost" className="mt-4 w-full" onClick={() => setOpen(true)}>
          비밀번호 변경
        </Button>
      ) : (
        <div className="mt-4 rounded-lg bg-ink/40 p-3">
          <Row
            id="pw-current"
            label="지금 비밀번호"
            type="password"
            value={current}
            onChange={setCurrent}
            maxLength={128}
            autoComplete="current-password"
          />
          <Row
            id="pw-next"
            label="새 비밀번호"
            type="password"
            value={next}
            onChange={setNext}
            maxLength={128}
            autoComplete="new-password"
            placeholder="8자 이상"
          />
          <Row
            id="pw-again"
            label="새 비밀번호 확인"
            type="password"
            value={again}
            onChange={setAgain}
            maxLength={128}
            autoComplete="new-password"
          />
          <p className="mt-2 text-[11px] text-hanji/45">
            바꾸면 다른 기기에 남아 있던 로그인이 전부 끊깁니다.
          </p>
          {local && (
            <p role="alert" className="mt-2 text-sm text-dan-red">
              {local}
            </p>
          )}
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" onClick={submit}>
              바꾸기
            </Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              취소
            </Button>
          </div>
        </div>
      )}

      <Button variant="ghost" className="mt-2 w-full" onClick={() => send.authLogOut()}>
        로그아웃
      </Button>
    </>
  );
}

export function AccountPanel() {
  const open = useGame((s) => s.accountOpen);
  const setOpen = useGame((s) => s.setAccountOpen);
  const account = useGame((s) => s.account);
  const recoveryCode = useGame((s) => s.recoveryCode);
  const error = useGame((s) => s.error);
  const nickname = useGame((s) => s.nickname);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-40 grid place-items-center bg-ink/85 p-4"
          onClick={() => !recoveryCode && setOpen(false)}
          role="dialog"
          aria-label="계정"
        >
          <motion.div
            initial={{ scale: 0.96, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[88vh] w-full max-w-sm flex-col overflow-y-auto rounded-2xl bg-giwa p-5 ring-1 ring-gold/25"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                {/* 호패 — 신원을 다루는 창이라는 표시 */}
                <img
                  src="/art/icon-account.webp"
                  alt=""
                  aria-hidden="true"
                  className="h-11 w-auto shrink-0"
                />
                <div>
                  <h2
                    className="text-xl font-black tracking-widest text-hanji"
                    style={{ fontFamily: 'var(--font-serif-kr)' }}
                  >
                    계정
                  </h2>
                  <p className="mt-0.5 text-xs text-hanji/50">{nickname}</p>
                </div>
              </div>
              {/* 복구 코드를 띄운 동안에는 닫지 못하게 한다 — 닫으면 다시 못 본다 */}
              {!recoveryCode && <ArtBack label="닫기" onClick={() => setOpen(false)} />}
            </div>

            <div className="mt-4">
              {recoveryCode ? (
                <RecoveryCode code={recoveryCode} />
              ) : account ? (
                <AccountBody loginId={account.loginId} />
              ) : (
                <GuestBody />
              )}
            </div>

            {error && !recoveryCode && (
              <p role="alert" className="mt-3 rounded-md bg-dan-red/20 px-3 py-2 text-sm text-hanji">
                {error.message}
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
