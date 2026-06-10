import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { geminiFlash } from '../../lib/gemini';
import {
  Mic, Square, Loader2, ChevronDown, ChevronUp,
  Check, Users, BarChart3, MessageSquare, AlertCircle,
  Plus, Sparkles, RefreshCw, Zap,
  History, Trash2, Clock, WifiOff, Save, X, KeyRound, Settings,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecordingStatus = 'idle' | 'recording' | 'processing' | 'complete' | 'error';
type ResultTab = 'students' | 'evaluation';
type MainTab = 'record' | 'history';

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

interface PastSessionRow {
  id: string;
  class_name: string | null;
  subject: string | null;
  transcript_text: string;
  analysis_result: AnalysisResult | null;
  duration_seconds: number;
  recorded_at: string;
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

const GROQ_CHUNK_MS   = 10000;
const GROQ_PROMPT_CTX = 224; // 이전 전사의 마지막 N자를 Whisper에 context로 전달
const GROQ_API_URL    = 'https://api.groq.com/openai/v1/audio/transcriptions';

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
  const navigate = useNavigate();

  // ── Data ───────────────────────────────────────────────────────────────────
  const [classes, setClasses]                 = useState<any[]>([]);
  const [students, setStudents]               = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [mainTab, setMainTab] = useState<MainTab>('record');

  // ── 전사 모드 선택 ─────────────────────────────────────────────────────────
  const [selectedMode, setSelectedMode] = useState<'groq' | 'web'>(
    () => localStorage.getItem('groq_api_key') ? 'groq' : 'web'
  );

  // ── Recording state ────────────────────────────────────────────────────────
  const [status, setStatus]           = useState<RecordingStatus>('idle');
  const [transcript, setTranscript]   = useState('');
  const [interimText, setInterimText] = useState('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isChunkProcessing, setIsChunkProcessing] = useState(false);

  // ── Result state ───────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]             = useState<ResultTab>('students');
  const [analysisResult, setAnalysisResult]   = useState<AnalysisResult | null>(null);
  const [showFullTranscript, setShowFullTranscript] = useState(false);
  const [errorMsg, setErrorMsg]               = useState('');
  const [sessionSaved, setSessionSaved]       = useState(false);
  const [backgroundInterrupted, setBackgroundInterrupted] = useState(false);

  // ── History state ─────────────────────────────────────────────────────────
  const [pastSessions, setPastSessions]         = useState<PastSessionRow[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const isRecordingRef   = useRef(false);
  const transcriptRef    = useRef('');
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const elapsedRef       = useRef(0);
  const wasRecordingRef  = useRef(false);
  const wakeLockRef      = useRef<any>(null);

  const recognitionRef    = useRef<any>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const chunkTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopRequestedRef  = useRef(false);
  const chunkBlobsRef     = useRef<Blob[]>([]);

  // ── Mode detection ─────────────────────────────────────────────────────────
  const groqKey           = localStorage.getItem('groq_api_key') || '';
  const useGroqMode       = selectedMode === 'groq' && !!groqKey;
  const groqKeyMissing    = selectedMode === 'groq' && !groqKey;
  const SpeechAPI         = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const isSpeechSupported = !!SpeechAPI;

  // ── Init ──────────────────────────────────────────────────────────────────

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
      stopTimer();
      isRecordingRef.current = false;
      recognitionRef.current?.stop();
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(t => t.stop());
      releaseWakeLock();
    };
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  // ── Background detection (visibilitychange) ────────────────────────────────

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        wasRecordingRef.current = isRecordingRef.current;
      } else {
        // 복귀 시 — 녹음이 실제로 멈춰 있으면 배너 표시
        if (wasRecordingRef.current && !isRecordingRef.current) {
          setBackgroundInterrupted(true);
          wasRecordingRef.current = false;
        }
        // Wake Lock은 visibility 복귀 시 재시도 필요 (iOS/Android가 자동 해제)
        if (isRecordingRef.current) requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  // ── Wake Lock ─────────────────────────────────────────────────────────────

  const requestWakeLock = async () => {
    if (!('wakeLock' in navigator)) return;
    try {
      wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
    } catch {
      // 지원 안 되거나 권한 없음 — silent fail
    }
  };

  const releaseWakeLock = () => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  };

  // ── History ───────────────────────────────────────────────────────────────

  const fetchPastSessions = useCallback(async () => {
    setIsLoadingHistory(true);
    const { data } = await supabase
      .from('class_transcriptions')
      .select('*')
      .eq('teacher_id', user?.id)
      .order('recorded_at', { ascending: false })
      .limit(30);
    setPastSessions(data || []);
    setIsLoadingHistory(false);
  }, [user?.id]);

  useEffect(() => {
    if (mainTab === 'history') fetchPastSessions();
  }, [mainTab, fetchPastSessions]);

  const deleteSession = async (id: string) => {
    if (!window.confirm('이 전사 기록을 삭제하시겠습니까?')) return;
    const { error } = await supabase
      .from('class_transcriptions')
      .delete()
      .eq('id', id)
      .eq('teacher_id', user?.id);
    if (!error) setPastSessions(prev => prev.filter(s => s.id !== id));
  };

  // ── Students ──────────────────────────────────────────────────────────────

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

  // ── Timer ─────────────────────────────────────────────────────────────────

  const startTimer = (keepTime = false) => {
    if (!keepTime) {
      elapsedRef.current = 0;
      setElapsedSeconds(0);
    }
    timerRef.current = setInterval(() => {
      elapsedRef.current++;
      setElapsedSeconds(s => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // ── Web Speech API ─────────────────────────────────────────────────────────

  const startWebSpeech = useCallback((keepTranscript = false) => {
    if (!SpeechAPI) return;

    const createInstance = (): any => {
      const rec = new SpeechAPI();
      rec.continuous     = true;
      rec.interimResults = true;
      rec.lang           = 'ko-KR';

      rec.onresult = (event: any) => {
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

      rec.onend = () => {
        setInterimText('');
        if (isRecordingRef.current) {
          recognitionRef.current = createInstance();
        }
      };

      rec.onerror = (e: any) => {
        if (e.error === 'no-speech') return;
        if (e.error === 'not-allowed') {
          isRecordingRef.current = false;
          stopTimer();
          releaseWakeLock();
          setStatus('error');
          setErrorMsg('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
        }
      };

      rec.start();
      return rec;
    };

    isRecordingRef.current = true;
    if (!keepTranscript) {
      transcriptRef.current = '';
      setTranscript('');
    }
    setInterimText('');
    setStatus('recording');
    recognitionRef.current = createInstance();
    startTimer(keepTranscript);
  }, [SpeechAPI]);

  const stopWebSpeech = useCallback(async () => {
    isRecordingRef.current = false;
    recognitionRef.current?.stop();
    stopTimer();
    releaseWakeLock();
    setInterimText('');
    await finalize();
  }, []);

  // ── Groq Whisper ──────────────────────────────────────────────────────────

  const transcribeChunk = async (blob: Blob): Promise<void> => {
    if (blob.size < 1000) return;
    setIsChunkProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', blob, 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      formData.append('language', 'ko');
      formData.append('response_format', 'text');

      // 이전 전사 끝부분을 prompt로 전달 → Whisper가 맥락을 이어서 전사
      const prevContext = transcriptRef.current.slice(-GROQ_PROMPT_CTX).trim();
      if (prevContext) {
        formData.append('prompt', prevContext);
      }

      const res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${groqKey}` },
        body: formData,
      });

      if (res.ok) {
        const text = (await res.text()).trim();
        if (text) {
          transcriptRef.current += text + ' ';
          setTranscript(transcriptRef.current);
        }
      } else if (res.status === 401) {
        isRecordingRef.current = false;
        stopTimer();
        releaseWakeLock();
        streamRef.current?.getTracks().forEach(t => t.stop());
        setStatus('error');
        setErrorMsg('Groq API Key가 올바르지 않습니다. 설정에서 키를 확인해주세요.');
      }
    } catch {
      // 네트워크 오류 — 해당 청크 건너뜀
    } finally {
      setIsChunkProcessing(false);
    }
  };

  const startNextChunk = (stream: MediaStream) => {
    if (!isRecordingRef.current) return;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/ogg';

    chunkBlobsRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType });

    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunkBlobsRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunkBlobsRef.current, { type: mimeType });
      await transcribeChunk(blob);

      if (stopRequestedRef.current) {
        stopRequestedRef.current = false;
        await finalize();
      } else if (isRecordingRef.current) {
        startNextChunk(stream);
      }
    };

    recorder.start(500);
    mediaRecorderRef.current = recorder;

    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, GROQ_CHUNK_MS);
  };

  const startGroqRecording = async (keepTranscript = false) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current        = stream;
      isRecordingRef.current   = true;
      stopRequestedRef.current = false;
      if (!keepTranscript) {
        transcriptRef.current = '';
        setTranscript('');
      }
      setInterimText('');
      setStatus('recording');
      startTimer(keepTranscript);
      startNextChunk(stream);
    } catch {
      setStatus('error');
      setErrorMsg('마이크 접근 권한이 필요합니다. 브라우저 설정에서 마이크를 허용해주세요.');
    }
  };

  const stopGroqRecording = () => {
    isRecordingRef.current = false;
    if (chunkTimerRef.current) { clearTimeout(chunkTimerRef.current); chunkTimerRef.current = null; }
    stopTimer();
    releaseWakeLock();
    setInterimText('마지막 구간 변환 중...');

    if (mediaRecorderRef.current?.state === 'recording') {
      stopRequestedRef.current = true;
      mediaRecorderRef.current.stop();
    } else {
      streamRef.current?.getTracks().forEach(t => t.stop());
      setInterimText('');
      finalize();
    }
  };

  // ── 공통 종료 ─────────────────────────────────────────────────────────────

  const finalize = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setInterimText('');

    const finalText = transcriptRef.current.trim();
    if (!finalText || finalText.split(' ').length < 5) {
      setStatus('idle');
      return;
    }
    setStatus('processing');
    await analyzeTranscript(finalText);
  };

  // ── 시작 / 중지 / 재개 ────────────────────────────────────────────────────

  const startRecording = () => {
    setBackgroundInterrupted(false);
    setSessionSaved(false);
    requestWakeLock();
    if (useGroqMode) startGroqRecording();
    else startWebSpeech();
  };

  const resumeRecording = () => {
    setBackgroundInterrupted(false);
    requestWakeLock();
    if (useGroqMode) startGroqRecording(true);
    else startWebSpeech(true);
  };

  const stopRecording = () => {
    if (useGroqMode) stopGroqRecording();
    else stopWebSpeech();
  };

  const finalizeCurrent = async () => {
    setBackgroundInterrupted(false);
    const finalText = transcriptRef.current.trim();
    if (finalText && finalText.split(' ').length >= 5) {
      setStatus('processing');
      await analyzeTranscript(finalText);
    } else {
      setStatus('idle');
    }
  };

  // ── Gemini 분석 + 자동 저장 ─────────────────────────────────────────────

  const saveSession = async (transcriptText: string, analysis: AnalysisResult) => {
    const cls = classes.find(c => c.id === selectedClassId);
    const { error } = await supabase.from('class_transcriptions').insert({
      teacher_id:       user?.id,
      class_id:         selectedClassId || null,
      class_name:       cls?.name || null,
      subject:          cls?.subject || null,
      transcript_text:  transcriptText,
      analysis_result:  analysis,
      duration_seconds: elapsedRef.current,
    });
    if (!error) setSessionSaved(true);
  };

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

      const response = await geminiFlash.generateContent(prompt);
      const raw      = response.response.text().trim();
      const jsonStr  = raw
        .replace(/^```json\s*/m, '')
        .replace(/^```\s*/m, '')
        .replace(/\s*```$/m, '')
        .trim();

      const parsed: AnalysisResult = JSON.parse(jsonStr);
      parsed.studentObservations = parsed.studentObservations.map(o => ({ ...o, saved: false }));
      setAnalysisResult(parsed);
      setStatus('complete');
      await saveSession(transcriptText, parsed);
    } catch (err: any) {
      console.error('[ClassTranscription] analysis error:', err);
      setStatus('error');
      const msg: string = err?.message ?? '';
      if (msg === 'AI_LIMIT_EXCEEDED') {
        setErrorMsg('오늘 AI 사용 횟수(10회)를 초과했습니다. 자정 이후에 다시 시도해주세요.');
      } else if (
        msg.includes('429') ||
        msg.toLowerCase().includes('prepayment') ||
        msg.toLowerCase().includes('credits') ||
        msg.toLowerCase().includes('billing')
      ) {
        setErrorMsg('Gemini API 크레딧이 소진되었습니다. Google AI Studio(aistudio.google.com)에서 결제 정보를 확인해주세요.');
      } else if (msg.includes('401') || msg.includes('Invalid') || msg.includes('Unauthorized')) {
        setErrorMsg('인증 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.');
      } else {
        setErrorMsg('AI 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    }
  };

  // ── 관찰기록 저장 ─────────────────────────────────────────────────────────

  const findStudent = (name: string) =>
    students.find(s =>
      s.full_name === name ||
      s.full_name.includes(name) ||
      name.includes(s.full_name)
    );

  const saveObservation = async (obs: StudentObservation) => {
    if (obs.saved) return;

    const student = findStudent(obs.name);
    if (!student) {
      alert(`'${obs.name}' 학생을 명단에서 찾을 수 없습니다.\nAI가 반환한 이름과 등록된 이름이 다를 수 있습니다.`);
      return;
    }

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
    setSessionSaved(false);
    setBackgroundInterrupted(false);
    transcriptRef.current = '';
    elapsedRef.current    = 0;
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const avgScore = (ev: ClassEvaluation) => {
    const sum = EVAL_ITEMS.reduce((acc, { key }) => acc + (ev[key] as number), 0);
    return (sum / EVAL_ITEMS.length).toFixed(1);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });

  const formatTimeOfDay = (iso: string) =>
    new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl">

      {/* 메인 탭 */}
      <div className="flex p-1 bg-surface-container rounded-xl gap-1 w-fit">
        <button
          onClick={() => setMainTab('record')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black transition-all ${
            mainTab === 'record'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <Mic size={15} />
          새 전사
        </button>
        <button
          onClick={() => setMainTab('history')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black transition-all ${
            mainTab === 'history'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          <History size={15} />
          기록 보기
          {pastSessions.length > 0 && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              mainTab === 'history' ? 'bg-white/25' : 'bg-primary/10 text-primary'
            }`}>
              {pastSessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ══════════════ 새 전사 탭 ══════════════ */}
      {mainTab === 'record' && (
        <>
          {/* 백그라운드 중단 배너 */}
          <AnimatePresence>
            {backgroundInterrupted && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3"
              >
                <WifiOff size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-black text-amber-800">다른 앱/브라우저로 이동해 녹음이 중단됐습니다</p>
                  <p className="text-xs text-amber-600 mt-1 leading-relaxed">
                    Android·iPhone·iPad 모두 백그라운드에서는 마이크를 사용할 수 없습니다.<br />
                    지금까지 전사된 내용은 유지됩니다.
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={resumeRecording}
                      className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-xs font-black hover:bg-amber-600 transition-all active:scale-95"
                    >
                      <Mic size={13} />
                      이어서 녹음
                    </button>
                    <button
                      onClick={finalizeCurrent}
                      className="flex items-center gap-1.5 px-4 py-2 bg-surface-container text-on-surface-variant rounded-xl text-xs font-black hover:bg-surface-container-high transition-all active:scale-95"
                    >
                      <Square size={13} />
                      여기서 종료하기
                    </button>
                  </div>
                </div>
                <button onClick={() => setBackgroundInterrupted(false)} className="text-amber-400 hover:text-amber-600 shrink-0 mt-0.5">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 전사 모드 선택 */}
          <div className="flex p-1 bg-surface-container rounded-xl gap-1 w-fit">
            <button
              onClick={() => setSelectedMode('web')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black transition-all ${
                selectedMode === 'web'
                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Mic size={14} />
              기본 전사 (Chrome)
            </button>
            <button
              onClick={() => setSelectedMode('groq')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black transition-all ${
                selectedMode === 'groq'
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/20'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Zap size={14} />
              Groq Whisper — 고품질 AI
            </button>
          </div>

          {/* Groq 모드 선택했지만 API Key 없는 경우 */}
          {groqKeyMissing && (
            <div className="p-4 bg-violet-50 border border-violet-200 rounded-2xl flex items-start gap-3">
              <KeyRound size={18} className="text-violet-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-black text-violet-800">Groq API Key가 등록되지 않았습니다</p>
                <p className="text-xs text-violet-600 mt-1 leading-relaxed">
                  고품질 AI 전사를 사용하려면 설정에서 Groq API Key를 등록해주세요.<br />
                  console.groq.com 에서 무료로 발급받을 수 있습니다.
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white rounded-xl text-xs font-black hover:bg-violet-700 transition-all active:scale-95"
                >
                  <Settings size={13} />
                  설정에서 API Key 등록하기
                </button>
              </div>
            </div>
          )}

          {/* 브라우저 호환 안내 (기본 모드에서 Chrome 아닐 때) */}
          {!isSpeechSupported && !useGroqMode && !groqKeyMissing && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
              <AlertCircle size={18} className="text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-black text-amber-800">Chrome 브라우저 또는 Groq API Key가 필요합니다</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  기본 전사는 Chrome에서만 지원됩니다. 위에서 Groq Whisper 모드를 선택하고 API Key를 등록하면 모든 브라우저에서 가능합니다.
                </p>
              </div>
            </div>
          )}

          {/* 활성 모드 표시 */}
          {useGroqMode && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-100 text-violet-700 rounded-full text-xs font-black border border-violet-200">
                <Zap size={12} />
                Groq Whisper 활성 — 고품질 AI 전사
              </span>
              <span className="text-[11px] text-on-surface-variant/60">10초 단위로 변환됩니다</span>
            </div>
          )}

          {/* 학급 선택 */}
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

          {/* 녹음 패널 */}
          <div className="surface-card p-6 shadow-ambient">

            {status === 'idle' && (
              <div className="flex flex-col items-center gap-6 py-10">
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mic size={40} className="text-primary" />
                </div>
                <div className="text-center space-y-1">
                  <h3 className="text-xl font-black">수업 전사 준비 완료</h3>
                  <p className="text-sm text-on-surface-variant">
                    {useGroqMode
                      ? 'Groq Whisper 모드 — 10초마다 자동으로 고품질 변환합니다'
                      : '시작 버튼을 누르면 마이크가 켜지며 자동으로 전사됩니다'}
                  </p>
                </div>
                <button
                  onClick={startRecording}
                  disabled={groqKeyMissing || (!isSpeechSupported && !useGroqMode) || !selectedClassId || students.length === 0}
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
                    {useGroqMode && isChunkProcessing && (
                      <span className="flex items-center gap-1 text-[11px] text-violet-600 font-bold">
                        <Loader2 size={11} className="animate-spin" />
                        AI 변환 중
                      </span>
                    )}
                  </div>
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm shadow-md active:scale-95 transition-all"
                  >
                    <Square size={15} />
                    수업 종료
                  </button>
                </div>

                <div className="bg-surface-container-low rounded-2xl p-4 border border-surface-container min-h-52 max-h-80 overflow-y-auto text-sm leading-loose font-medium">
                  {transcript ? (
                    <span className="text-on-surface">{transcript}</span>
                  ) : (
                    <span className="text-on-surface-variant/40 italic">
                      {useGroqMode
                        ? '말씀하시면 10초마다 여기에 변환됩니다...'
                        : '말씀하시면 여기에 실시간으로 전사됩니다...'}
                    </span>
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

          {/* 분석 결과 */}
          {status === 'complete' && analysisResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* 자동 저장 완료 표시 */}
              {sessionSaved && (
                <div className="flex items-center gap-2 px-4 py-2.5 bg-green-50 border border-green-100 rounded-2xl">
                  <Save size={14} className="text-green-600" />
                  <span className="text-xs font-black text-green-700">
                    전사 세션이 자동 저장됐습니다. "기록 보기" 탭에서 언제든지 다시 확인할 수 있습니다.
                  </span>
                </div>
              )}

              {/* 결과 탭 바 */}
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

              {/* 학생별 관찰 */}
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
                            {!findStudent(obs.name) && (
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                                명단 불일치
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

              {/* 수업 품질 평가 */}
              {activeTab === 'evaluation' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="surface-card p-6 shadow-ambient space-y-6"
                >
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
                        <ScoreBar key={key} label={label} score={analysisResult.classEvaluation[key] as number} />
                      ))}
                    </div>
                  </div>

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

              {/* 전체 전사본 */}
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
        </>
      )}

      {/* ══════════════ 기록 보기 탭 ══════════════ */}
      {mainTab === 'history' && (
        <div className="space-y-4">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center py-16 gap-3 text-on-surface-variant">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm font-bold">기록 불러오는 중...</span>
            </div>
          ) : pastSessions.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center">
                <History size={32} className="text-on-surface-variant/40" />
              </div>
              <div>
                <p className="font-black text-on-surface-variant">저장된 전사 기록이 없습니다</p>
                <p className="text-xs text-on-surface-variant/60 mt-1">수업 전사를 완료하면 자동으로 여기에 저장됩니다.</p>
              </div>
              <button
                onClick={() => setMainTab('record')}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary/10 text-primary rounded-xl text-sm font-black hover:bg-primary/20 transition-all"
              >
                <Mic size={15} />
                전사 시작하기
              </button>
            </div>
          ) : (
            pastSessions.map((session, i) => {
              const isExpanded  = expandedSessionId === session.id;
              const analysis    = session.analysis_result;
              const avgScoreVal = analysis
                ? (EVAL_ITEMS.reduce((a, { key }) => a + (analysis.classEvaluation[key as keyof ClassEvaluation] as number), 0) / EVAL_ITEMS.length).toFixed(1)
                : null;

              return (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="surface-card shadow-ambient overflow-hidden"
                >
                  {/* 카드 헤더 */}
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-black">{session.class_name || '학급 미지정'}</span>
                          {session.subject && (
                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                              {session.subject}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs text-on-surface-variant font-medium">
                            {formatDate(session.recorded_at)} {formatTimeOfDay(session.recorded_at)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-on-surface-variant/60 font-medium">
                            <Clock size={11} />
                            {formatTime(session.duration_seconds)}
                          </span>
                          {analysis && (
                            <>
                              <span className="text-xs text-on-surface-variant/60 font-medium">
                                학생 {analysis.studentObservations.length}명
                              </span>
                              <span className="text-xs font-black text-primary">
                                ★ {avgScoreVal} / 5.0
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => deleteSession(session.id)}
                          className="p-2 text-on-surface-variant/40 hover:text-red-500 rounded-lg transition-all"
                          title="삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                        <button
                          onClick={() => setExpandedSessionId(isExpanded ? null : session.id)}
                          className="p-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all"
                        >
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </div>
                    </div>

                    {/* 학생 참여 미리보기 (접힌 상태) */}
                    {analysis && !isExpanded && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {analysis.studentObservations.slice(0, 6).map(obs => (
                          <span key={obs.name} className={`text-[10px] font-black px-2 py-0.5 rounded-full ${PARTICIPATION_STYLE[obs.participation]}`}>
                            {obs.name}
                          </span>
                        ))}
                        {analysis.studentObservations.length > 6 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant/60">
                            +{analysis.studentObservations.length - 6}명
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 확장 상세 */}
                  <AnimatePresence>
                    {isExpanded && analysis && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-surface-container"
                      >
                        <div className="p-5 space-y-5">
                          {/* 학생별 관찰 */}
                          <div>
                            <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-3">학생별 관찰</p>
                            <div className="space-y-2">
                              {analysis.studentObservations.map(obs => (
                                <div key={obs.name} className="flex items-start gap-2.5 p-3 bg-surface-container-low rounded-xl">
                                  <span className={`shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full mt-0.5 ${PARTICIPATION_STYLE[obs.participation]}`}>
                                    {obs.participation}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-sm font-black">{obs.name}</span>
                                      {obs.needsAttention && (
                                        <span className="text-[10px] font-black text-red-500">추가 지도 필요</span>
                                      )}
                                    </div>
                                    <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{obs.summary}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 수업 평가 점수 */}
                          <div>
                            <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-3">수업 품질 평가</p>
                            <div className="space-y-2">
                              {EVAL_ITEMS.map(({ key, label }) => (
                                <ScoreBar key={key} label={label} score={analysis.classEvaluation[key as keyof ClassEvaluation] as number} />
                              ))}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                              <div className="p-3 bg-green-50 rounded-xl border border-green-100">
                                <p className="text-[10px] font-black text-green-600 uppercase mb-1">잘된 점</p>
                                <p className="text-xs text-green-800 leading-relaxed">{analysis.classEvaluation.strengths}</p>
                              </div>
                              <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                                <p className="text-[10px] font-black text-amber-600 uppercase mb-1">개선할 점</p>
                                <p className="text-xs text-amber-800 leading-relaxed">{analysis.classEvaluation.improvements}</p>
                              </div>
                            </div>
                          </div>

                          {/* 전사 원문 */}
                          <div>
                            <p className="text-[11px] font-black text-on-surface-variant uppercase tracking-wider mb-2">전사 원문</p>
                            <div className="p-3 bg-surface-container-low rounded-xl text-xs leading-relaxed text-on-surface-variant/80 whitespace-pre-wrap max-h-48 overflow-y-auto">
                              {session.transcript_text}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ClassTranscription;
