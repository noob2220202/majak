/**
 * 효과음 엔진 (PLAN.md §4.6).
 *
 * 외부 샘플 파일 없이 Web Audio API로 합성한다 — 라이선스 문제 없음, 용량 0.
 * 계획서대로 "적합한 국악 샘플이 없으면 타악·신스로 구성"을 따르되,
 * 국악기 음색(북·장구·가야금·대금·태평소)을 신스로 근사한다.
 */

export type SfxName =
  | 'discard'
  | 'draw'
  | 'call'
  | 'riichi'
  | 'win'
  | 'yakuman'
  | 'draw_end'
  | 'tick'
  | 'result';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let volume = 0.6;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = volume;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** 사용자 제스처에서 오디오 컨텍스트를 깨운다 (브라우저 자동재생 정책) */
export function unlockAudio(): void {
  ac();
}

export function setMuted(next: boolean): void {
  muted = next;
}

export function setVolume(next: number): void {
  volume = Math.max(0, Math.min(1, next));
  if (master) master.gain.value = volume;
}

export function getAudioSettings(): { muted: boolean; volume: number } {
  return { muted, volume };
}

// ── 합성 프리미티브 ──────────────────────────────────────────────

/** 노이즈 버퍼 (타격음의 어택 성분) */
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < len; i++) {
    // 결정론적 의사난수 (재생마다 동일한 음색)
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x3fffffff - 1) * (1 - i / len);
  }
  noiseBuf = buf;
  return buf;
}

interface ToneOptions {
  freq: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  /** 종료 주파수 (글리산도) */
  toFreq?: number;
  /** 저역 통과 컷오프 */
  lp?: number;
}

function tone(c: AudioContext, o: ToneOptions): void {
  const t0 = c.currentTime + (o.delay ?? 0);
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.toFreq !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.toFreq), t0 + o.dur);

  const peak = (o.gain ?? 0.3) * volume;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + Math.min(0.02, o.dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);

  let node: AudioNode = osc;
  if (o.lp !== undefined) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    osc.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master as GainNode);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

function hit(
  c: AudioContext,
  opts: { dur: number; gain?: number; hp?: number; lp?: number; delay?: number },
): void {
  const t0 = c.currentTime + (opts.delay ?? 0);
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const g = c.createGain();
  const peak = (opts.gain ?? 0.25) * volume;
  g.gain.setValueAtTime(peak, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);

  let node: AudioNode = src;
  if (opts.hp !== undefined) {
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = opts.hp;
    src.connect(f);
    node = f;
  }
  if (opts.lp !== undefined) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = opts.lp;
    node.connect(f);
    node = f;
  }
  node.connect(g);
  g.connect(master as GainNode);
  src.start(t0);
  src.stop(t0 + opts.dur + 0.05);
}

/** 국악 5음계 (황·태·중·임·남) 근사 — 가야금 글리산도용 */
const PENTATONIC = [261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33, 698.46, 784.0, 880.0];

// ── 효과음 정의 ─────────────────────────────────────────────────

const VOICES: Record<SfxName, (c: AudioContext) => void> = {
  /** 타패 "딱" — 나무 부딪는 소리 */
  discard(c) {
    hit(c, { dur: 0.055, gain: 0.3, hp: 1400, lp: 7000 });
    tone(c, { freq: 880, toFreq: 420, dur: 0.06, type: 'triangle', gain: 0.16 });
  },

  /** 쯔모 — 패를 끌어오는 짧은 슬라이드 */
  draw(c) {
    hit(c, { dur: 0.09, gain: 0.11, hp: 700, lp: 3200 });
  },

  /** 울기 — 북 "둥" */
  call(c) {
    tone(c, { freq: 150, toFreq: 66, dur: 0.42, type: 'sine', gain: 0.42, lp: 700 });
    hit(c, { dur: 0.06, gain: 0.2, lp: 1400 });
  },

  /** 리치 — 대금 짧은 선율 + 북 */
  riichi(c) {
    tone(c, { freq: 523.25, dur: 0.2, type: 'sine', gain: 0.2, lp: 2600 });
    tone(c, { freq: 622.25, dur: 0.22, type: 'sine', gain: 0.2, delay: 0.14, lp: 2600 });
    tone(c, { freq: 783.99, dur: 0.5, type: 'sine', gain: 0.24, delay: 0.3, lp: 3000 });
    tone(c, { freq: 132, toFreq: 62, dur: 0.45, type: 'sine', gain: 0.36, lp: 640 });
  },

  /** 화료 — 가야금 글리산도 (상행) */
  win(c) {
    PENTATONIC.forEach((f, i) => {
      tone(c, { freq: f, dur: 0.5, type: 'triangle', gain: 0.13, delay: i * 0.045, lp: 5200 });
    });
    tone(c, { freq: 150, toFreq: 70, dur: 0.5, type: 'sine', gain: 0.3, lp: 700, delay: 0.02 });
  },

  /** 역만 — 태평소 (거친 배음) + 큰 북 */
  yakuman(c) {
    tone(c, { freq: 392, dur: 1.0, type: 'sawtooth', gain: 0.16, lp: 2400 });
    tone(c, { freq: 587.33, dur: 0.9, type: 'sawtooth', gain: 0.13, lp: 2600, delay: 0.22 });
    tone(c, { freq: 783.99, dur: 1.3, type: 'sawtooth', gain: 0.15, lp: 3000, delay: 0.44 });
    [0, 0.3, 0.6].forEach((d) => {
      tone(c, { freq: 120, toFreq: 55, dur: 0.5, type: 'sine', gain: 0.4, lp: 620, delay: d });
    });
    PENTATONIC.forEach((f, i) => {
      tone(c, { freq: f * 2, dur: 0.5, type: 'triangle', gain: 0.07, delay: 0.5 + i * 0.035, lp: 6000 });
    });
  },

  /** 유국 — 차분한 저음 페이드 */
  draw_end(c) {
    tone(c, { freq: 196, toFreq: 98, dur: 0.9, type: 'sine', gain: 0.22, lp: 900 });
    tone(c, { freq: 294, toFreq: 147, dur: 0.7, type: 'sine', gain: 0.12, lp: 900, delay: 0.06 });
  },

  /** 남은 시간 경고 틱 */
  tick(c) {
    tone(c, { freq: 1250, dur: 0.045, type: 'square', gain: 0.07, lp: 3000 });
  },

  /** 결과 표시 */
  result(c) {
    tone(c, { freq: 523.25, dur: 0.28, type: 'triangle', gain: 0.16, lp: 4000 });
    tone(c, { freq: 659.25, dur: 0.36, type: 'triangle', gain: 0.14, lp: 4000, delay: 0.1 });
  },
};

/** 효과음 재생 (음소거·오디오 미지원 시 무시) */
export function playSfx(name: SfxName): void {
  if (muted) return;
  const c = ac();
  if (!c || !master) return;
  try {
    VOICES[name](c);
  } catch {
    // 오디오 실패는 게임 진행을 막지 않는다
  }
}
