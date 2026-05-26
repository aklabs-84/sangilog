import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle, XCircle, Trophy, Zap, Users,
  Clock, Wifi, WifiOff, ArrowLeft,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type GameState = 'LOBBY' | 'QUIZ' | 'RESULT' | 'RANKING' | 'FINAL';

interface Session {
  id: string;
  pin_code: string;
  state: GameState;
  current_question_index: number;
  max_timer: number;
  question_started_at: string | null;
  quiz_set_id: string;
}

interface Question {
  id: string;
  order_index: number;
  text: string;
  option_1: string;
  option_2: string;
  option_3: string;
  option_4: string;
  correct_answer: number;
  time_limit: number;
}

interface Participant {
  id: string;
  student_name: string;
  score: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const OPTION_LABELS = ['A', 'B', 'C', 'D'] as const;
const OPTION_BG = [
  'from-red-500 to-rose-600',
  'from-blue-500 to-indigo-600',
  'from-yellow-400 to-amber-500',
  'from-green-500 to-emerald-600',
] as const;
const OPTION_SHADOW = [
  'shadow-red-500/30',
  'shadow-blue-500/30',
  'shadow-yellow-500/30',
  'shadow-green-500/30',
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
const QuizStudentView = () => {
  const { pin } = useParams<{ pin: string }>();
  const navigate = useNavigate();

  // 단계: pin입력 → name입력 → 게임
  type Step = 'enter-pin' | 'enter-name' | 'game';
  const [step, setStep] = useState<Step>(pin ? 'enter-name' : 'enter-pin');
  const [pinInput, setPinInput] = useState(pin ?? '');
  const [nameInput, setNameInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 게임 데이터
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);

  // 퀴즈 진행
  const [myAnswer, setMyAnswer] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<{ isCorrect: boolean; score: number; correctAnswer: number } | null>(null);
  const [timer, setTimer] = useState(20);
  const [isConnected, setIsConnected] = useState(false);

  const prevQuestionIndex = useRef<number>(-1);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── PIN 확인 & 입장 ──────────────────────────────────────────────────────
  const handleVerifyPin = async () => {
    const p = pinInput.trim();
    if (p.length !== 6) { setErrorMsg('6자리 PIN을 입력하세요'); return; }
    setLoading(true);
    setErrorMsg('');
    const { data, error } = await supabase
      .from('quiz_sessions')
      .select('*')
      .eq('pin_code', p)
      .neq('state', 'FINAL')
      .single();
    if (error || !data) {
      setErrorMsg('유효하지 않은 PIN이거나 종료된 퀴즈입니다');
      setLoading(false);
      return;
    }
    setSession(data);
    navigate(`/quiz/${p}`, { replace: true });
    setStep('enter-name');
    setLoading(false);
  };

  const handleJoin = async () => {
    const name = nameInput.trim();
    if (!name) { setErrorMsg('이름을 입력하세요'); return; }
    setLoading(true);
    setErrorMsg('');

    // PIN으로 세션 다시 조회 (URL에서 온 경우)
    let sess = session;
    if (!sess) {
      const { data } = await supabase
        .from('quiz_sessions')
        .select('*')
        .eq('pin_code', pinInput.trim())
        .neq('state', 'FINAL')
        .single();
      if (!data) { setErrorMsg('세션을 찾을 수 없습니다'); setLoading(false); return; }
      sess = data;
      setSession(data);
    }

    // 참가자 등록
    const { data: pData, error: pErr } = await supabase
      .from('quiz_participants')
      .insert({ session_id: sess!.id, student_name: name, score: 0 })
      .select()
      .single();
    if (pErr || !pData) { setErrorMsg('참가 등록에 실패했습니다'); setLoading(false); return; }
    setParticipant(pData);

    // 문제 로드
    const { data: qData } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_set_id', sess!.quiz_set_id)
      .order('order_index', { ascending: true });
    if (qData) setQuestions(qData);

    setStep('game');
    startRealtimeSync(sess!.id, pData.id);
    setLoading(false);
  };

  // ── Realtime 구독 ──────────────────────────────────────────────────────────
  const startRealtimeSync = useCallback((sessionId: string, participantId: string) => {
    if (channelRef.current) supabase.removeChannel(channelRef.current);

    const channel = supabase
      .channel(`quiz-student-${sessionId}-${participantId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_sessions', filter: `id=eq.${sessionId}` },
        (payload) => {
          const updated = payload.new as Session;
          setSession(prev => {
            // 문제가 바뀌면 내 답변 초기화
            if (prev && updated.current_question_index !== prev.current_question_index) {
              setMyAnswer(null);
              setLastResult(null);
            }
            return updated;
          });
          setIsConnected(true);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'quiz_participants', filter: `id=eq.${participantId}` },
        (payload) => {
          setParticipant(prev => prev ? { ...prev, ...payload.new } : payload.new as Participant);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'quiz_participants', filter: `session_id=eq.${sessionId}` },
        () => {
          fetchParticipants(sessionId);
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    channelRef.current = channel;

    // 참가자 목록 초기 로드
    fetchParticipants(sessionId);
  }, []);

  const fetchParticipants = async (sessionId: string) => {
    const { data } = await supabase
      .from('quiz_participants')
      .select('id, student_name, score')
      .eq('session_id', sessionId)
      .order('score', { ascending: false });
    if (data) setAllParticipants(data);
  };

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // 타이머 동기화 (서버 시간 기준)
  useEffect(() => {
    if (!session || session.state !== 'QUIZ' || !session.question_started_at) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    const sync = () => {
      const started = new Date(session.question_started_at!).getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const remaining = Math.max(0, session.max_timer - elapsed);
      setTimer(remaining);
    };

    sync();
    timerIntervalRef.current = setInterval(sync, 250);

    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [session?.state, session?.question_started_at, session?.max_timer]);

  // 문제 인덱스 변경 감지 → 순위 최신화
  useEffect(() => {
    if (!session || !participant) return;
    if (session.current_question_index !== prevQuestionIndex.current) {
      prevQuestionIndex.current = session.current_question_index;
      fetchParticipants(session.id);
    }
  }, [session?.current_question_index]);

  // 랭킹/파이널 → 참가자 최신화
  useEffect(() => {
    if (!session || !participant) return;
    if (session.state === 'RANKING' || session.state === 'FINAL') {
      fetchParticipants(session.id);
    }
  }, [session?.state]);

  // ── 답변 제출 ──────────────────────────────────────────────────────────────
  const handleAnswer = async (optionIdx: number) => {
    if (!session || !participant || myAnswer !== null) return;
    if (session.state !== 'QUIZ') return;

    setMyAnswer(optionIdx);

    const currentQuestion = questions[session.current_question_index];
    if (!currentQuestion) return;

    const started = session.question_started_at
      ? new Date(session.question_started_at).getTime()
      : Date.now();
    const responseTime = (Date.now() - started) / 1000;

    const isCorrect = optionIdx === currentQuestion.correct_answer;
    const BASE = 500;
    const MAX_BONUS = 500;
    const score = isCorrect
      ? BASE + Math.floor((1 - responseTime / currentQuestion.time_limit) * MAX_BONUS)
      : 0;

    setLastResult({ isCorrect, score, correctAnswer: currentQuestion.correct_answer });

    // DB에 답변 저장
    await supabase.from('quiz_answers').insert({
      session_id: session.id,
      participant_id: participant.id,
      question_id: currentQuestion.id,
      selected_option: optionIdx,
      is_correct: isCorrect,
      score,
      response_time: responseTime,
    });

    // 참가자 점수 업데이트
    if (score > 0) {
      await supabase
        .from('quiz_participants')
        .update({ score: participant.score + score })
        .eq('id', participant.id);
    }
  };

  // ── 현재 정보 ──────────────────────────────────────────────────────────────
  const currentQuestion = session ? questions[session.current_question_index] : null;
  const myRank = allParticipants.findIndex(p => p.id === participant?.id) + 1;
  const myCurrentScore = participant?.score ?? 0;

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center p-4">
      {/* 배경 glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-violet-400/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-400/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <AnimatePresence mode="wait">

          {/* ── STEP: PIN 입력 ── */}
          {step === 'enter-pin' && (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="text-6xl">🎮</div>
                <h1 className="text-3xl font-black text-white">퀴즈 참여</h1>
                <p className="text-white/70 text-sm">선생님이 알려준 PIN 코드를 입력하세요</p>
              </div>
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 space-y-4">
                <input
                  value={pinInput}
                  onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={e => { if (e.key === 'Enter') handleVerifyPin(); }}
                  placeholder="PIN 6자리"
                  maxLength={6}
                  className="w-full px-4 py-4 rounded-2xl bg-white/20 text-white placeholder-white/40 text-center text-3xl font-black tracking-widest focus:outline-none focus:ring-2 focus:ring-white/40 border border-white/20"
                />
                {errorMsg && (
                  <p className="text-red-300 text-xs font-bold text-center">{errorMsg}</p>
                )}
                <button
                  onClick={handleVerifyPin}
                  disabled={pinInput.length !== 6 || loading}
                  className="w-full py-4 rounded-2xl bg-white text-violet-600 font-black text-lg hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? '확인 중...' : '입장하기'}
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: 이름 입력 ── */}
          {step === 'enter-name' && (
            <motion.div
              key="name"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <div className="text-6xl">👋</div>
                <h1 className="text-3xl font-black text-white">이름 입력</h1>
                <p className="text-white/70 text-sm">퀴즈에서 사용할 이름을 입력하세요</p>
              </div>
              <div className="bg-white/15 backdrop-blur-md rounded-3xl p-6 border border-white/20 space-y-4">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleJoin(); }}
                  placeholder="이름을 입력하세요"
                  maxLength={20}
                  autoFocus
                  className="w-full px-4 py-4 rounded-2xl bg-white/20 text-white placeholder-white/40 text-center text-xl font-black focus:outline-none focus:ring-2 focus:ring-white/40 border border-white/20"
                />
                {errorMsg && (
                  <p className="text-red-300 text-xs font-bold text-center">{errorMsg}</p>
                )}
                <button
                  onClick={handleJoin}
                  disabled={!nameInput.trim() || loading}
                  className="w-full py-4 rounded-2xl bg-white text-violet-600 font-black text-lg hover:bg-white/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? '참여 중...' : '퀴즈 참여하기!'}
                </button>
                <button
                  onClick={() => { setStep('enter-pin'); setErrorMsg(''); }}
                  className="w-full py-2 text-white/60 text-sm font-bold hover:text-white transition-all flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={14} />
                  PIN 다시 입력
                </button>
              </div>
            </motion.div>
          )}

          {/* ── STEP: GAME ── */}
          {step === 'game' && session && participant && (
            <motion.div
              key="game"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              {/* 상단 정보 바 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
                  <span className="text-white font-black text-sm">{participant.student_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
                    {isConnected
                      ? <Wifi size={12} className="text-green-300" />
                      : <WifiOff size={12} className="text-red-300" />
                    }
                    <span className="text-white/80 text-xs font-bold">
                      {isConnected ? '연결됨' : '재연결 중'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur px-3 py-1.5 rounded-full border border-white/20">
                    <Zap size={12} className="text-yellow-300" />
                    <span className="text-white font-black text-sm">{myCurrentScore.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="wait">

                {/* ── LOBBY ── */}
                {session.state === 'LOBBY' && (
                  <motion.div
                    key="lobby"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="text-center space-y-6"
                  >
                    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 space-y-4">
                      <motion.div
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center mx-auto shadow-xl"
                      >
                        <span className="text-3xl">✅</span>
                      </motion.div>
                      <h2 className="text-2xl font-black text-white">{participant.student_name}님, 환영해요!</h2>
                      <p className="text-white/70 text-sm">선생님이 퀴즈를 시작하면 자동으로 시작됩니다</p>
                      <motion.div
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="flex items-center justify-center gap-2 text-white/60 text-sm"
                      >
                        <Clock size={14} />
                        대기 중...
                      </motion.div>
                    </div>
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
                      <div className="flex items-center gap-2 mb-3">
                        <Users size={14} className="text-white/60" />
                        <span className="text-white/70 text-xs font-bold">참여 중인 학생</span>
                        <span className="text-white text-xs font-black">{allParticipants.length}명</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {allParticipants.slice(0, 12).map(p => (
                          <span
                            key={p.id}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                              p.id === participant.id
                                ? 'bg-white text-violet-600'
                                : 'bg-white/20 text-white'
                            }`}
                          >
                            {p.student_name}
                          </span>
                        ))}
                        {allParticipants.length > 12 && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white/10 text-white/60">
                            +{allParticipants.length - 12}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── QUIZ ── */}
                {session.state === 'QUIZ' && currentQuestion && (
                  <motion.div
                    key={`quiz-${session.current_question_index}`}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    className="space-y-4"
                  >
                    {/* 타이머 */}
                    <div className="flex items-center justify-between">
                      <span className="text-white/70 text-xs font-bold">
                        {session.current_question_index + 1} / {questions.length}번 문제
                      </span>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm ${
                        timer <= 5 ? 'bg-red-500/80 text-white' : 'bg-white/20 text-white'
                      }`}>
                        <Clock size={13} />
                        {timer}초
                      </div>
                    </div>

                    {/* 타이머 바 */}
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-white rounded-full"
                        style={{ width: `${(timer / session.max_timer) * 100}%` }}
                        transition={{ duration: 0.25 }}
                      />
                    </div>

                    {/* 문제 */}
                    <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20">
                      <p className="text-white font-black text-center text-lg leading-relaxed">
                        {currentQuestion.text}
                      </p>
                    </div>

                    {/* 선택지 또는 완료 표시 */}
                    {myAnswer === null ? (
                      <div className="grid grid-cols-2 gap-3">
                        {[currentQuestion.option_1, currentQuestion.option_2, currentQuestion.option_3, currentQuestion.option_4].map((opt, idx) => (
                          <motion.button
                            key={idx}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => handleAnswer(idx)}
                            className={`h-28 rounded-2xl bg-gradient-to-br ${OPTION_BG[idx]} shadow-xl ${OPTION_SHADOW[idx]} flex flex-col items-center justify-center gap-2 transition-all active:brightness-90`}
                          >
                            <span className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center text-white font-black text-lg">
                              {OPTION_LABELS[idx]}
                            </span>
                            <span className="text-white font-bold text-xs text-center px-2 leading-tight">{opt}</span>
                          </motion.button>
                        ))}
                      </div>
                    ) : (
                      <motion.div
                        initial={{ scale: 0.85, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-white/15 backdrop-blur-md rounded-2xl p-8 border border-white/20 text-center space-y-3"
                      >
                        <motion.div
                          animate={{ rotate: [0, -5, 5, -5, 5, 0] }}
                          transition={{ delay: 0.3, duration: 0.5 }}
                          className="text-5xl"
                        >
                          ✅
                        </motion.div>
                        <p className="text-white font-black text-xl">답변 완료!</p>
                        <p className="text-white/60 text-sm">선생님이 결과를 확인하면 표시됩니다</p>
                      </motion.div>
                    )}
                  </motion.div>
                )}

                {/* ── RESULT ── */}
                {session.state === 'RESULT' && currentQuestion && (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    className="space-y-4"
                  >
                    {lastResult ? (
                      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-center space-y-4">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          {lastResult.isCorrect
                            ? <CheckCircle size={80} className="text-green-400 mx-auto" />
                            : <XCircle size={80} className="text-red-400 mx-auto" />
                          }
                        </motion.div>
                        <h2 className={`text-3xl font-black ${lastResult.isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                          {lastResult.isCorrect ? '정답!' : '오답...'}
                        </h2>
                        {lastResult.isCorrect && (
                          <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex items-center justify-center gap-2 bg-white/20 rounded-2xl px-6 py-3"
                          >
                            <Zap size={18} className="text-yellow-300" />
                            <span className="text-white font-black text-xl">+{lastResult.score.toLocaleString()}점</span>
                          </motion.div>
                        )}
                        {!lastResult.isCorrect && (
                          <p className="text-white/70 text-sm">
                            정답: <strong className="text-white">
                              {[currentQuestion.option_1, currentQuestion.option_2, currentQuestion.option_3, currentQuestion.option_4][lastResult.correctAnswer]}
                            </strong>
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-center space-y-3">
                        <div className="text-5xl">⏰</div>
                        <p className="text-white/70 text-sm">시간 초과 또는 미답변</p>
                        <p className="text-white/50 text-xs">정답: <strong className="text-white">
                          {[currentQuestion.option_1, currentQuestion.option_2, currentQuestion.option_3, currentQuestion.option_4][currentQuestion.correct_answer]}
                        </strong></p>
                      </div>
                    )}
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/15 flex items-center justify-between">
                      <span className="text-white/70 text-sm font-bold">현재 점수</span>
                      <span className="text-white font-black text-xl">{myCurrentScore.toLocaleString()}점</span>
                    </div>
                  </motion.div>
                )}

                {/* ── RANKING ── */}
                {session.state === 'RANKING' && (
                  <motion.div
                    key="ranking"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="space-y-4"
                  >
                    {myRank > 0 && (
                      <div className="bg-white/15 backdrop-blur-md rounded-2xl p-5 border border-white/20 text-center">
                        <p className="text-white/70 text-sm font-bold mb-1">나의 현재 순위</p>
                        <p className="text-5xl font-black text-white">{myRank}등</p>
                        <p className="text-white/60 text-sm mt-1">{myCurrentScore.toLocaleString()}점</p>
                      </div>
                    )}
                    <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 space-y-2 max-h-64 overflow-y-auto">
                      {allParticipants.slice(0, 10).map((p, i) => (
                        <motion.div
                          key={p.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                            p.id === participant?.id
                              ? 'bg-white/25 border border-white/40'
                              : 'bg-white/10'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                            i === 0 ? 'bg-amber-400 text-white' :
                            i === 1 ? 'bg-slate-300 text-white' :
                            i === 2 ? 'bg-orange-400 text-white' :
                            'bg-white/20 text-white/70'
                          }`}>
                            {i + 1}
                          </span>
                          <span className="font-bold text-white flex-1 text-sm">{p.student_name}</span>
                          <span className="text-white/80 font-black text-sm">{p.score.toLocaleString()}</span>
                        </motion.div>
                      ))}
                    </div>
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/15 text-center">
                      <motion.p
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                        className="text-white/60 text-sm"
                      >
                        선생님이 다음 문제로 넘어갑니다...
                      </motion.p>
                    </div>
                  </motion.div>
                )}

                {/* ── FINAL ── */}
                {session.state === 'FINAL' && (
                  <motion.div
                    key="final"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="space-y-4"
                  >
                    <div className="bg-white/15 backdrop-blur-md rounded-3xl p-8 border border-white/20 text-center space-y-5">
                      <motion.div
                        animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
                        transition={{ duration: 0.8, delay: 0.3 }}
                        className="text-7xl"
                      >
                        🏆
                      </motion.div>
                      <div>
                        <h2 className="text-3xl font-black text-white">수고했어요!</h2>
                        <p className="text-white/70 text-sm mt-1">{participant.student_name}님의 최종 결과</p>
                      </div>
                      <div className="bg-white/20 rounded-2xl p-5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70 text-sm">최종 점수</span>
                          <span className="text-white font-black text-2xl">{myCurrentScore.toLocaleString()}점</span>
                        </div>
                        {myRank > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="text-white/70 text-sm">최종 순위</span>
                            <span className="text-white font-black text-2xl">
                              {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `${myRank}등`}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 최종 순위 TOP 3 */}
                    <div className="bg-white/10 rounded-2xl p-4 border border-white/15 space-y-2">
                      <h4 className="text-white/70 text-xs font-bold flex items-center gap-1.5">
                        <Trophy size={12} /> 최종 순위
                      </h4>
                      {allParticipants.slice(0, 5).map((p, i) => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${
                            p.id === participant?.id ? 'bg-white/25 border border-white/40' : 'bg-white/10'
                          }`}
                        >
                          <span className="text-lg">{['🥇', '🥈', '🥉', '4️⃣', '5️⃣'][i]}</span>
                          <span className="font-bold text-white flex-1 text-sm">{p.student_name}</span>
                          <span className="text-white/80 font-black text-sm">{p.score.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => navigate('/')}
                      className="w-full py-4 rounded-2xl bg-white text-violet-600 font-black text-lg hover:bg-white/90 transition-all"
                    >
                      홈으로 돌아가기
                    </button>
                  </motion.div>
                )}

              </AnimatePresence>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuizStudentView;
