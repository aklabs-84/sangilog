import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { geminiPro } from '../../lib/gemini';
import {
  Mic, Square, Loader2, ChevronDown, ChevronUp,
  Check, Users, BarChart3, MessageSquare, AlertCircle,
  Plus, Sparkles, RefreshCw, BookOpen,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'complete' | 'error';
type ResultTab = 'students' | 'evaluation';

interface StudentObservation {
  name: string;
  participation: '적극적' | '보통' | '소극적';
  mentions: string[];
  summary: string;
  needsAttention: boolean;
  saved?: boolean;
}

interface ClassEvaluation {
  structure: number;
  clarity: number;
  engagement: number;
  feedback: number;
  timeManagement: number;
  strengths: string;
  improvements: string;
  nextClassTip: string;
}

interface AnalysisResult {
  studentObservations: StudentObservation[];
  notMentioned: string[];
  classEvaluation: ClassEvaluation;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EVAL_ITEMS: { key: keyof ClassEvaluation; label: string }[] = [
  { key: 'structure',      label: '수업 구성' },
  { key: 'clarity',        label: '설명 명확성' },
  { key: 'engagement',     label: '학생 참여 유도' },
  { key: 'feedback',       label: '피드백 품질' },
  { key: 'timeManagement', label: '시간 관리' },
];

const PARTICIPATION_STYLE: Record<string, string> = {
  '적극적': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  '보통':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '소극적': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
};

// ── Score Bar ─────────────────────────────────────────────────────────────────

const ScoreBar = ({ label, score }: { label: string; score: number }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-on-surface-variant">{label}</span>
      <span className="text-xs font-black text-primary">{score} / 5</span>
    </div>
    <div className="h-2 bg-surface-container rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(score / 5) * 100}%` }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
        className={`h-full rounded-full ${
          score >= 4 ? 'bg-primary' : score >= 3 ? 'bg-amber-400' : 'bg-red-400'
        }`}
      />
    </div>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────

const ClassTranscription = () => {
  const { user } = useAuth();

  const [classes, setClasses]               = useState<any[]>([]);
  const [students, setStudents]             = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [status, setStatus]                 = useState<RecordingStatus>('idle');
  const [transcript, setTranscript]         = useState('');
  const [interimText, setInterimText]       = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeTab, setActiveTab]           = useState<ResultTab>('students');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [errorMsg, setErrorMsg]             = useState('');

  const recognitionRef   = useRef<any>(null);
  const isRecordingRef   = useRef(false);
  const transcriptRef    = useRef('');
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const SpeechAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechAPI;

  // ── Data Fetching ───────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id);
      if (data && data.length > 0) {
        setClasses(data);
        setSelectedClassId(data[0].id);
        await fetchStudents(data[0].id, data[0]);
      }
    })();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        isRecordingRef.current = false;
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Auto-scroll live transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const fetchStudents = async (classId: string, cls?: any) => {
    const targetId = cls?.linked_class_id || classId;
    const { data } = await supabase
      .from('students')
      .select('id, full_name, student_number')
      .eq('class_id', targetId)
      .order('student_number', { ascending: true });
    setStudents(data || []);
  };

  const handleClassChange = async (id: string) => {
    setSelectedClassId(id);
    const cls = classes.find(c => c.id === id);
    await fetchStudents(id, cls);
    resetAll();
  };

  // ── Timer ───────────────────────────────────────────────────────────────────

  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Speech Recognition ──────────────────────────────────────────────────────

  const startRecording = useCallback(() => {
    if (!SpeechAPI) return;

    const recognition = new SpeechAPI();
    recognition.continuous     = true;
    recognition.interimResults = true;
    recognition.lang           = 'ko-KR';

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          transcriptRef.current += text + ' ';
          setTranscript(transcriptRef.current);
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    // Auto-restart on unexpected stop (e.g., silence timeout)
    recognition.onend = () => {
      setInterimText('');
      if (isRecordingRef.current) {
        try { recognition.start(); } catch { /* already started */ }
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error === 'no-speech') return; // normal pause, onend handles restart
      if (e.error === 'not-allowed') {
        isRecordingRef.current = false;
        stopTimer();
        setStatus('error');
        setErrorMsg('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    transcriptRef.current  = '';
    setTranscript('');
    setInterimText('');
    setStatus('recording');
    recognition.start();
    startTimer();
  }, [SpeechAPI]);

  const stopRecording = useCallback(async () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    stopTimer();
    setInterimText('');

    const finalText = transcriptRef.current.trim();
    if (!finalText || finalText.split(' ').length < 5) {
      setStatus('idle');
      return;
    }
    setStatus('processing');
    await analyzeTranscript(finalText);
  }, []); // analyzeTranscript uses refs + state at call time

  // ── Gemini Analysis ─────────────────────────────────────────────────────────

  const analyzeTranscript = async (transcriptText: string) => {
    try {
      const cls          = classes.find(c => c.id === selectedClassId);
      const studentNames = students.map(s => s.full_name).join(', ');

      const prompt = `
당신은 수업 분석 전문가입니다. 아래 수업 전사본을 분석하여 JSON 형식으로만 응답하세요.

[수업 정보]
학급: ${cls?.name ?? '미지정'} / 과목: ${cls?.subject ?? '미지정'}
학생 명단: ${studentNames || '(명단 없음)'}

[전사본]
${transcriptText}

━━━━━━━━━━━━━━━━━━━━━━

[Part 1 — 학생별 관찰]
학생 명단에 있는 각 학생에 대해 분석하세요:
- 이름이 언급된 횟수와 맥락 (칭찬 / 피드백 / 질문 / 지적 등)
- 참여 수준: 적극적(3회 이상 언급 또는 질문) / 보통(1~2회) / 소극적(언급 없음)
- 오늘 수업의 한 줄 관찰 요약 (구체적으로)
- 추가 지도 필요 여부 (오답·이해 부족·집중력 저하 등)
- 명단에 없거나 전혀 언급되지 않은 학생은 notMentioned 배열에 포함

[Part 2 — 수업 품질 평가]
전사본 내용만을 근거로 다음 5개 항목을 5점 만점으로 평가하세요:
1. structure(수업 구성): 도입→전개→마무리 흐름
2. clarity(설명 명확성): 핵심 개념을 이해하기 쉽게 전달했는가
3. engagement(학생 참여 유도): 질문·활동으로 반응을 이끌어냈는가
4. feedback(피드백 품질): 오답·발언에 구체적으로 반응했는가
5. timeManagement(시간 관리): 중요 내용에 적절한 시간을 배분했는가

다음도 포함하세요:
- strengths: 오늘 수업에서 가장 잘된 점 (2~3문장)
- improvements: 개선하면 더 좋을 점 (2~3문장)
- nextClassTip: 다음 수업에서 신경 쓸 것 한 가지 제안 (1문장)

━━━━━━━━━━━━━━━━━━━━━━

아래 JSON 형식으로만 응답하세요. 마크다운이나 다른 텍스트 없이 JSON만 출력하세요:

{
  "studentObservations": [
    {
      "name": "학생이름",
      "participation": "적극적|보통|소극적",
      "mentions": ["언급 내용 1", "언급 내용 2"],
      "summary": "한 줄 관찰 요약",
      "needsAttention": false
    }
  ],
  "notMentioned": ["언급되지 않은 학생 이름"],
  "classEvaluation": {
    "structure": 4,
    "clarity": 4,
    "engagement": 3,
    "feedback": 4,
    "timeManagement": 3,
    "strengths": "잘된 점 설명",
    "improvements": "개선할 점 설명",
    "nextClassTip": "다음 수업 제안"
  }
}`;

      const response = await geminiPro.generateContent(prompt);
      const raw      = response.response.text().trim();

      // Strip markdown code blocks if present
      const jsonStr = raw
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim();

      const parsed: AnalysisResult = JSON.parse(jsonStr);
      parsed.studentObservations = parsed.studentObservations.map(o => ({ ...o, saved: false }));

      setAnalysisResult(parsed);
      setStatus('complete');
    } catch (err) {
      console.error('[ClassTranscription] analysis error:', err);
      setStatus('error');
      setErrorMsg('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    }
  };

  // ── Save Observation ────────────────────────────────────────────────────────

  const saveObservation = async (obs: StudentObservation) => {
    const student = students.find(s => s.full_name === obs.name);
    if (!student || obs.saved) return;

    const content = [
      obs.summary,
      obs.mentions.length > 0 ? `\n[수업 중 언급] ${obs.mentions.join(' / ')}` : '',
    ].filter(Boolean).join('');

    try {
      const { error } = await supabase.from('observations').insert({
        student_id:    student.id,
        teacher_id:    user?.id,
        activity_name: '수업 전사 기록',
        content,
        status: 'pending',
      });
      if (error) throw error;

      setAnalysisResult(prev => prev ? {
        ...prev,
        studentObservations: prev.studentObservations.map(o =>
          o.name === obs.name ? { ...o, saved: true } : o
        ),
      } : prev);
    } catch (err) {
      console.error(err);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const saveAllObservations = async () => {
    if (!analysisResult) return;
    for (const obs of analysisResult.studentObservations) {
      if (!obs.saved) await saveObservation(obs);
    }
  };

  const resetAll = () => {
    setTranscript('');
    setInterimText('');
    setAnalysisResult(null);
    setElapsedSeconds(0);
    setStatus('idle');
    setErrorMsg('');
    transcriptRef.current = '';
  };

  // ── Average Score ───────────────────────────────────────────────────────────

  const avgScore = (ev: ClassEvaluation) => {
    const sum = EVAL_ITEMS.reduce((acc, { key }) => acc + (ev[key] as number), 0);
    return (sum / EVAL_ITEMS.length).toFixed(1);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Browser compatibility notice */}
      {!isSpeechSupported && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-black text-amber-800">Chrome 브라우저가 필요합니다</p>
            <p className="text-xs text-amber-600 mt-0.5">
              수업 전사 기능은 Google Chrome에서만 지원됩니다. Chrome으로 접속 후 사용해주세요.
            </p>
          </div>
        </div>
      )}

      {/* ── Class Selector (idle/error only) ── */}
      {(status === 'idle' || status === 'error') && (
        <div className="surface-card p-6 shadow-ambient space-y-4">
          <h3 className="text-base font-black flex items-center gap-2">
            <Users size={18} className="text-primary" />
            수업 설정
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">학급 선택</label>
              <select
                value={selectedClassId}
                onChange={e => handleClassChange(e.target.value)}
                className="w-full px-4 py-3 bg-surface-container rounded-xl text-sm font-bold appearance-none outline-none focus:ring-2 focus:ring-primary/20"
              >
                {classes.length === 0
                  ? <option>학급 없음</option>
                  : classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name} — {c.subject}</option>
                  ))
                }
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">등록 학생</label>
              <div className="px-4 py-3 bg-surface-container rounded-xl text-sm font-black text-primary">
                {students.length}명
              </div>
            </div>
          </div>

          {students.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {students.map(s => (
                <span key={s.id} className="px-2.5 py-1 bg-primary/8 text-primary text-[11px] font-bold rounded-lg border border-primary/15">
                  {s.full_name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recording Panel ── */}
      <div className="surface-card p-6 shadow-ambient">

        {/* Idle */}
        {status === 'idle' && (
          <div className="flex flex-col items-center gap-6 py-10">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <Mic size={40} className="text-primary" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-xl font-black">수업 전사 준비 완료</h3>
              <p className="text-sm text-on-surface-variant">
                시작 버튼을 누르면 마이크가 켜지며 자동으로 전사됩니다
              </p>
              <p className="text-[11px] text-on-surface-variant/50">
                수업 중 말하는 모든 내용이 실시간으로 텍스트로 변환됩니다
              </p>
            </div>
            <button
              onClick={startRecording}
              disabled={!isSpeechSupported || !selectedClassId || students.length === 0}
              className="btn-gradient px-10 py-4 rounded-2xl font-black text-base flex items-center gap-3 shadow-xl active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Mic size={20} />
              수업 시작 — 전사 시작
            </button>
            {students.length === 0 && (
              <p className="text-xs text-on-surface-variant/60">학생이 등록된 학급을 선택해주세요.</p>
            )}
          </div>
        )}

        {/* Recording */}
        {status === 'recording' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-sm font-black text-red-500">녹음 중</span>
                <span className="font-mono text-sm font-black text-on-surface-variant tabular-nums">
                  {formatTime(elapsedSeconds)}
                </span>
              </div>
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all"
              >
                <Square size={15} />
                수업 종료
              </button>
            </div>

            {/* Live transcript */}
            <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container min-h-52 max-h-80 overflow-y-auto text-sm leading-loose font-medium">
              {transcript ? (
                <span className="text-on-surface">{transcript}</span>
              ) : (
                <span className="text-on-surface-variant/40 italic">말씀하시면 여기에 실시간으로 전사됩니다...</span>
              )}
              {interimText && (
                <span className="text-on-surface-variant/50 italic"> {interimText}</span>
              )}
              <div ref={transcriptEndRef} />
            </div>

            <p className="text-[11px] text-on-surface-variant/50 text-center">
              수업이 끝나면 "수업 종료"를 눌러주세요. AI가 학생별 관찰 기록과 수업 평가를 자동 생성합니다.
            </p>
          </div>
        )}

        {/* Processing */}
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-5 py-14">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles size={36} className="text-primary animate-pulse" />
            </div>
            <div className="text-center">
              <p className="text-lg font-black">AI가 수업 내용을 분석하는 중...</p>
              <p className="text-sm text-on-surface-variant mt-1">
                학생별 관찰 기록과 수업 품질 평가를 생성하고 있습니다
              </p>
            </div>
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <AlertCircle size={40} className="text-red-400" />
            <p className="font-black text-red-500">{errorMsg}</p>
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-5 py-2.5 bg-surface-container rounded-xl font-bold text-sm hover:bg-surface-container-high transition-all"
            >
              <RefreshCw size={15} />
              다시 시도
            </button>
          </div>
        )}
      </div>

      {/* ── Results ── */}
      {status === 'complete' && analysisResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Result tab bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex p-1 bg-surface-container rounded-xl gap-1">
              <button
                onClick={() => setActiveTab('students')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                  activeTab === 'students'
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <Users size={15} />
                학생별 관찰
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  activeTab === 'students' ? 'bg-white/25' : 'bg-primary/10 text-primary'
                }`}>
                  {analysisResult.studentObservations.length}명
                </span>
              </button>
              <button
                onClick={() => setActiveTab('evaluation')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                  activeTab === 'evaluation'
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <BarChart3 size={15} />
                수업 품질 평가
              </button>
            </div>

            {activeTab === 'students' && (
              <button
                onClick={saveAllObservations}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-black hover:bg-primary/20 transition-all"
              >
                <Plus size={13} />
                전체 관찰기록 추가
              </button>
            )}
          </div>

          {/* Tab: Students */}
          {activeTab === 'students' && (
            <div className="space-y-3">
              {analysisResult.studentObservations.map((obs, i) => (
                <motion.div
                  key={obs.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="surface-card p-5 shadow-ambient"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-base">{obs.name}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PARTICIPATION_STYLE[obs.participation]}`}>
                          {obs.participation}
                        </span>
                        {obs.needsAttention && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                            추가 지도 필요
                          </span>
                        )}
                      </div>

                      <p className="text-sm text-on-surface-variant leading-relaxed">{obs.summary}</p>

                      {obs.mentions.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                          {obs.mentions.map((m, j) => (
                            <span key={j} className="text-[11px] px-2 py-1 bg-surface-container rounded-lg text-on-surface-variant">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => saveObservation(obs)}
                      disabled={obs.saved}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black transition-all ${
                        obs.saved
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-primary/10 text-primary hover:bg-primary hover:text-white active:scale-95'
                      }`}
                    >
                      {obs.saved ? <Check size={13} /> : <Plus size={13} />}
                      {obs.saved ? '저장됨' : '기록 추가'}
                    </button>
                  </div>
                </motion.div>
              ))}

              {/* Not mentioned */}
              {analysisResult.notMentioned.length > 0 && (
                <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container">
                  <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2">
                    오늘 수업에서 언급되지 않은 학생
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.notMentioned.map(name => (
                      <span key={name} className="text-xs px-3 py-1 bg-surface-container rounded-lg text-on-surface-variant/60 font-bold">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Class Evaluation */}
          {activeTab === 'evaluation' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="surface-card p-6 shadow-ambient space-y-6"
            >
              {/* Score bars */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-black flex items-center gap-2">
                    <BarChart3 size={18} className="text-primary" />
                    항목별 평가
                  </h3>
                  <div className="text-right">
                    <p className="text-[10px] text-on-surface-variant uppercase font-bold">종합 점수</p>
                    <p className="text-2xl font-black text-primary leading-none">
                      {avgScore(analysisResult.classEvaluation)}
                      <span className="text-sm font-bold text-on-surface-variant"> / 5.0</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-1">
                  {EVAL_ITEMS.map(({ key, label }) => (
                    <ScoreBar
                      key={key}
                      label={label}
                      score={analysisResult.classEvaluation[key] as number}
                    />
                  ))}
                </div>
              </div>

              {/* Qualitative feedback */}
              <div className="space-y-3 pt-2 border-t border-surface-container">
                <div className="p-4 bg-green-50 rounded-2xl border border-green-100">
                  <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1.5">잘된 점</p>
                  <p className="text-sm text-green-800 leading-relaxed">{analysisResult.classEvaluation.strengths}</p>
                </div>
                <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1.5">개선할 점</p>
                  <p className="text-sm text-amber-800 leading-relaxed">{analysisResult.classEvaluation.improvements}</p>
                </div>
                <div className="p-4 bg-primary/5 rounded-2xl border border-primary/15">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1.5">다음 수업 제안</p>
                  <p className="text-sm text-on-surface leading-relaxed">{analysisResult.classEvaluation.nextClassTip}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Full transcript collapsible */}
          <div className="surface-card shadow-ambient overflow-hidden">
            <button
              onClick={() => setShowFullTranscript(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-surface-container-low transition-all"
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-primary" />
                <span className="text-sm font-black">전체 전사본 보기</span>
                <span className="text-[10px] text-on-surface-variant/60 font-medium">
                  ({transcript.trim().split(/\s+/).length.toLocaleString()}단어)
                </span>
              </div>
              {showFullTranscript ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            <AnimatePresence>
              {showFullTranscript && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5">
                    <div className="p-4 bg-surface-container-low rounded-xl text-sm leading-relaxed text-on-surface-variant font-medium whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {transcript}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* New session button */}
          <div className="flex justify-center pt-2">
            <button
              onClick={resetAll}
              className="flex items-center gap-2 px-6 py-3 bg-surface-container hover:bg-surface-container-high rounded-xl text-sm font-bold text-on-surface-variant transition-all active:scale-95"
            >
              <RefreshCw size={15} />
              새 수업 시작하기
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ClassTranscription;
