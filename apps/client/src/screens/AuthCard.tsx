import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { send } from '../net/socket';
import { useGame } from '../store/game';
import { unlockAudio } from '../audio/sfx';
import { Wordmark } from '../components/Wordmark';

/**
 * 첫 화면 (PLAN.md §3.1).
 *
 * 세 갈래다 — 계정 없이 바로 두는 **게스트**, 아이디/비밀번호 **로그인**, **가입**.
 * 게스트로 놀다가 로비에서 가입하면 엽전·전적이 그대로 따라온다 (`AccountPanel`).
 */

const LAST_ID_KEY = 'cheongiwa.loginId';

type Mode = 'guest' | 'login' | 'signup' | 'recover';

const TABS: Array<[Mode, string]> = [
  ['login', '로그인'],
  ['signup', '가입'],
  ['guest', '게스트'],
];

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  maxLength,
  placeholder,
  autoComplete,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  autoComplete?: string;
  onEnter?: () => void;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <label htmlFor={id} className="block text-sm font-semibold text-ink/80">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        maxLength={maxLength}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="mt-1.5 w-full rounded-md border border-giwa/25 bg-white/70 px-3 py-2 text-ink outline-none transition focus:border-dan-blue focus:ring-2 focus:ring-dan-blue/30"
      />
    </div>
  );
}

export function AuthCard() {
  const connection = useGame((s) => s.connection);
  const error = useGame((s) => s.error);
  const dismissError = useGame((s) => s.dismissError);

  const lastLoginId = localStorage.getItem(LAST_ID_KEY) ?? '';
  const [mode, setMode] = useState<Mode>(lastLoginId ? 'login' : 'guest');
  const [nickname, setNickname] = useState(() => localStorage.getItem('cheongiwa.nick') ?? '');
  const [loginId, setLoginId] = useState(lastLoginId);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  // 탭을 옮기면 앞 화면의 오류를 지운다
  useEffect(() => {
    setLocalError(null);
    dismissError();
  }, [mode, dismissError]);

  const busy = connection !== 'connected';
  const message = localError ?? error?.message ?? null;

  const submit = (): void => {
    unlockAudio(); // 사용자 제스처에서 오디오 활성화 (§4.6)
    setLocalError(null);
    dismissError();

    if (mode === 'guest') {
      const nick = nickname.trim();
      if (!nick) return setLocalError('닉네임을 입력하세요');
      return send.authHello({ nickname: nick });
    }

    const id = loginId.trim().toLowerCase();
    if (mode === 'login') {
      if (!id || !password) return setLocalError('아이디와 비밀번호를 입력하세요');
      localStorage.setItem(LAST_ID_KEY, id);
      return send.authLogIn({ loginId: id, password });
    }

    if (mode === 'signup') {
      const nick = nickname.trim();
      if (!id || !password || !nick) return setLocalError('빈 칸을 채워 주세요');
      if (password !== passwordAgain) return setLocalError('비밀번호가 서로 다릅니다');
      localStorage.setItem(LAST_ID_KEY, id);
      return send.authSignUp({ loginId: id, password, nickname: nick });
    }

    // recover
    if (!id || !recoveryCode || !password) return setLocalError('빈 칸을 채워 주세요');
    if (password !== passwordAgain) return setLocalError('비밀번호가 서로 다릅니다');
    return send.authRecover({ loginId: id, recoveryCode, password });
  };

  const cta =
    mode === 'guest'
      ? '입장'
      : mode === 'login'
        ? '로그인'
        : mode === 'signup'
          ? '가입하고 시작'
          : '비밀번호 재설정';

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
      className="tex-hanji relative w-full max-w-sm rounded-xl bg-hanji p-6 text-ink shadow-2xl ring-1 ring-gold/30 sm:p-8"
    >
      {/* 제호는 로비 좌상단과 같은 현판 원화를 쓴다 — 첫 화면과 로비가 이어져 보이게 */}
      <div className="flex justify-center">
        <Wordmark width="min(260px,72%)" />
      </div>
      <p className="mt-2 text-center text-sm text-ink/60">한국 전통 온라인 리치마작</p>

      <div className="mt-6 flex rounded-lg bg-giwa/10 p-1">
        {TABS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m || (m === 'login' && mode === 'recover')}
            className={`flex-1 rounded-md py-1.5 text-sm font-semibold transition ${
              mode === m || (m === 'login' && mode === 'recover')
                ? 'bg-giwa text-hanji'
                : 'text-ink/55 hover:text-ink/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {mode === 'guest' && (
          <Field
            id="nickname"
            label="닉네임"
            value={nickname}
            onChange={setNickname}
            maxLength={12}
            placeholder="대국에서 쓸 이름"
            onEnter={submit}
          />
        )}

        {mode !== 'guest' && (
          <Field
            id="loginId"
            label="아이디"
            value={loginId}
            onChange={(v) => setLoginId(v.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
            maxLength={16}
            autoComplete="username"
            placeholder="영문 소문자로 시작하는 4~16자"
            onEnter={submit}
          />
        )}

        {mode === 'recover' && (
          <Field
            id="recoveryCode"
            label="복구 코드"
            value={recoveryCode}
            onChange={setRecoveryCode}
            maxLength={32}
            placeholder="가입할 때 받은 코드"
            onEnter={submit}
          />
        )}

        {mode === 'signup' && (
          <Field
            id="nickname"
            label="닉네임"
            value={nickname}
            onChange={setNickname}
            maxLength={12}
            placeholder="대국에서 쓸 이름"
            onEnter={submit}
          />
        )}

        {mode !== 'guest' && (
          <Field
            id="password"
            label={mode === 'login' ? '비밀번호' : '새 비밀번호'}
            type="password"
            value={password}
            onChange={setPassword}
            maxLength={128}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? '' : '8자 이상'}
            onEnter={submit}
          />
        )}

        {(mode === 'signup' || mode === 'recover') && (
          <Field
            id="passwordAgain"
            label="비밀번호 확인"
            type="password"
            value={passwordAgain}
            onChange={setPasswordAgain}
            maxLength={128}
            autoComplete="new-password"
            onEnter={submit}
          />
        )}
      </div>

      {message && (
        <p role="alert" className="mt-3 rounded-md bg-dan-red/15 px-3 py-2 text-sm text-dan-red">
          {message}
        </p>
      )}

      <button
        onClick={submit}
        disabled={busy}
        className="mt-5 w-full rounded-md bg-giwa py-2.5 font-semibold text-hanji transition hover:brightness-110 disabled:opacity-40"
      >
        {cta}
      </button>

      {mode === 'login' && (
        <button
          type="button"
          onClick={() => setMode('recover')}
          className="mt-3 w-full text-center text-xs text-ink/45 underline-offset-2 hover:underline"
        >
          비밀번호를 잊었나요? 복구 코드로 재설정
        </button>
      )}
      {mode === 'recover' && (
        <button
          type="button"
          onClick={() => setMode('login')}
          className="mt-3 w-full text-center text-xs text-ink/45 underline-offset-2 hover:underline"
        >
          로그인으로 돌아가기
        </button>
      )}
      {mode === 'guest' && (
        <p className="mt-3 text-center text-xs text-ink/45">
          계정 없이 바로 둡니다. 기록은 이 브라우저에만 남고, 나중에 로비에서 계정을 만들면
          엽전·전적이 그대로 따라옵니다.
        </p>
      )}
      {mode === 'signup' && (
        <p className="mt-3 text-center text-xs text-ink/45">
          가입하면 복구 코드를 한 번 보여 드립니다 — 비밀번호를 잊었을 때 쓰는 유일한 수단이니
          꼭 적어 두세요.
        </p>
      )}
    </motion.section>
  );
}
