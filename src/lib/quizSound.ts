// Web Audio API 기반 퀴즈 효과음 — 외부 파일 없이 동적 생성
let ctx: AudioContext | null = null;

const getCtx = (): AudioContext => {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

const playNote = (
  frequency: number,
  startTime: number,
  duration: number,
  volume = 0.3,
  type: OscillatorType = 'sine'
) => {
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
};

// 1위 — 화려한 팡파레
export const playVictoryFanfare = () => {
  const c = getCtx();
  const t = c.currentTime;
  const notes = [
    [523, 0.0, 0.15],
    [659, 0.15, 0.15],
    [784, 0.3, 0.15],
    [1047, 0.45, 0.35],
    [880, 0.8, 0.15],
    [1047, 0.95, 0.5],
  ] as const;
  notes.forEach(([freq, offset, dur]) => playNote(freq, t + offset, dur, 0.35, 'triangle'));
  // 화음 추가
  notes.forEach(([freq, offset, dur]) => playNote(freq * 1.5, t + offset, dur, 0.1, 'sine'));
};

// 2·3위 — 짧은 축하음
export const playRankFanfare = (rank: 2 | 3) => {
  const c = getCtx();
  const t = c.currentTime;
  const notes =
    rank === 2
      ? [[523, 0.0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.3]] as const
      : [[440, 0.0, 0.1], [523, 0.1, 0.1], [659, 0.2, 0.25]] as const;
  notes.forEach(([freq, offset, dur]) => playNote(freq, t + offset, dur, 0.25, 'triangle'));
};

// 퀴즈 완료 (4위 이하) — 가벼운 완료음
export const playCompleteSound = () => {
  const c = getCtx();
  const t = c.currentTime;
  playNote(440, t, 0.1, 0.2, 'sine');
  playNote(523, t + 0.1, 0.15, 0.2, 'sine');
};
