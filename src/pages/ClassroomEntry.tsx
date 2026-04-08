import { motion, AnimatePresence } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';
import { GraduationCap, ArrowRight, Info, HelpCircle, Loader2, User, Search, CheckCircle2, Key } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const ClassroomEntry = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [codes, setCodes] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Step 1: Entry Code, Step 2: Student Selection
  const [step, setStep] = useState(1);
  const [targetClass, setTargetClass] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    const codeParam = searchParams.get('code');
    if (codeParam && codeParam.length === 6) {
      const newCodes = codeParam.toUpperCase().split('');
      setCodes(newCodes);
      // 코드가 있으면 자동으로 검증 시도
      setTimeout(() => handleEntry(newCodes.join('')), 100);
    }
  }, [searchParams]);

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) value = value[0];
    const newCodes = [...codes];
    newCodes[index] = value.toUpperCase();
    setCodes(newCodes);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleEntry = async (forcedCode?: string) => {
    const fullCode = forcedCode || codes.join('');
    if (fullCode.length < 6) return;

    setLoading(true);
    setError('');
    try {
      const { data, error: classError } = await supabase
        .from('classes')
        .select('*')
        .eq('entry_code', fullCode)
        .single();

      if (classError || !data) {
        setError('유효하지 않은 입장 코드입니다. 다시 확인해 주세요.');
        return;
      }

      setTargetClass(data);
      
      const targetClassId = data.linked_class_id || data.id;

      // 해당 학급의 학생 명단 가져오기
      const { data: studentData, error: stuError } = await supabase
        .from('students')
        .select('*')
        .eq('class_id', targetClassId)
        .order('full_name');

      if (stuError) throw stuError;
      
      // 번호를 기준으로 기수 정렬(Numeric Sort) 수행
      const sortedStudents = (studentData || []).sort((a: any, b: any) => {
        const numA = parseInt(a.student_number) || 9999;
        const numB = parseInt(b.student_number) || 9999;
        if (numA !== numB) return numA - numB;
        return a.full_name.localeCompare(b.full_name);
      });
      
      setStudents(sortedStudents);
      setStep(2);
      
    } catch (err: any) {
      setError('서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleStudentSelect = (student: any) => {
    setSelectedStudent(student);
  };

  const handleFinalEnter = () => {
    if (!selectedStudent || !targetClass) return;
    
    // 세션에 정보 저장 (학생용 간이 인증 역할)
    sessionStorage.setItem('student_session', JSON.stringify({
      student_id: selectedStudent.id,
      student_name: selectedStudent.full_name,
      class_id: targetClass.id,
      class_name: targetClass.name,
      subject: targetClass.subject
    }));
    
    navigate('/student-log');
  };

  const filteredStudents = students.filter(s => 
    s.full_name.includes(searchName)
  );

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 -translate-x-1/2" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-3xl translate-y-1/2 translate-x-1/4" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-12 relative z-10">
        <div className="w-14 h-14 bg-primary rounded-[1.25rem] flex items-center justify-center text-white shadow-xl shadow-primary/20 rotate-3">
          <GraduationCap size={32} />
        </div>
        <h1 className="text-4xl font-black font-manrope tracking-tighter">생기로그</h1>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 ? (
          <motion.div 
            key="step1"
            initial={{ opacity: 0, x: -20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="w-full max-w-[520px] glass rounded-[3rem] shadow-ambient p-12 relative z-10 border border-white/20 text-center space-y-10"
          >
            <div className="space-y-3">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary shadow-inner">
                <Key size={32} />
              </div>
              <p className="text-[11px] font-black text-primary uppercase tracking-[0.3em]">Welcome Students</p>
              <h2 className="text-4xl font-black font-manrope">수업 입장하기</h2>
              <p className="text-on-surface-variant font-medium">선생님이 발급한 6자리 참여 코드를 입력하세요.</p>
            </div>

            <div className="space-y-6">
              <div className="flex justify-between gap-2 px-2">
                {codes.map((code, i) => (
                  <div key={i} className="flex-1">
                    <input 
                      ref={el => { inputRefs.current[i] = el; }}
                      type="text" 
                      value={code}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(i, e)}
                      maxLength={1}
                      className="w-full h-20 bg-surface-container rounded-2xl text-center text-3xl font-black text-primary focus:outline-none focus:ring-4 focus:ring-primary/20 focus:bg-white transition-all shadow-inner border border-transparent focus:border-primary/20"
                    />
                  </div>
                ))}
              </div>
              {error && <p className="text-error text-sm font-bold animate-shake">{error}</p>}
            </div>

            <button 
              onClick={() => handleEntry()}
              disabled={loading || codes.join('').length < 6}
              className="w-full btn-gradient py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {loading ? <Loader2 className="animate-spin" /> : (
                <>
                  <span>수업 확인하기</span>
                  <ArrowRight size={24} />
                </>
              )}
            </button>

            <div className="bg-surface-container-low/50 p-6 rounded-3xl flex items-start gap-4 border border-surface-container text-left relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/30 group-hover:bg-primary transition-all" />
              <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-on-surface-variant mt-1 shadow-sm">
                <Info size={20} />
              </div>
              <p className="text-[12px] text-on-surface-variant leading-relaxed font-bold">
                참여 코드는 영문 대문자와 숫자의 조합입니다. <br />
                코드가 정확하지 않으면 담당 선생님께 새 코드를 요청하세요.
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="step2"
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="w-full max-w-[520px] glass rounded-[3rem] shadow-ambient p-12 relative z-10 border border-white/20 space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="px-4 py-1.5 bg-secondary/10 text-secondary text-[10px] font-black rounded-full w-fit mx-auto uppercase tracking-widest mb-2">Class Confirmed</div>
              <h2 className="text-3xl font-black font-manrope">{targetClass?.name}</h2>
              <p className="text-on-surface-variant font-bold">{targetClass?.subject} 수업</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">본인 이름을 선택하세요</h3>
                <span className="text-[11px] text-on-surface-variant font-bold">{students.length}명 대기 중</span>
              </div>
              
              <div className="relative group">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                <input 
                  type="text"
                  placeholder="이름 검색..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-surface-container rounded-2xl text-sm font-bold focus:ring-4 focus:ring-primary/10 transition-all border-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto px-1 custom-scrollbar">
                {filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleStudentSelect(s)}
                    className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left ${
                      selectedStudent?.id === s.id 
                        ? 'border-primary bg-primary/5 shadow-md scale-[1.02]' 
                        : 'border-transparent bg-surface-container-low hover:bg-surface-container'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary shrink-0">
                      {selectedStudent?.id === s.id ? <CheckCircle2 size={24} /> : <User size={20} />}
                    </div>
                    <div className="overflow-hidden">
                      <p className={`font-black text-sm truncate ${selectedStudent?.id === s.id ? 'text-primary' : ''}`}>{s.full_name}</p>
                      <p className="text-[10px] text-on-surface-variant font-bold">{s.student_number || '학번 없음'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                onClick={() => setStep(1)}
                className="flex-1 py-5 bg-surface-container rounded-2xl font-black text-on-surface-variant hover:bg-surface-container-high transition-all"
              >
                뒤로가기
              </button>
              <button 
                onClick={handleFinalEnter}
                disabled={!selectedStudent}
                className="flex-[2] btn-gradient py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
              >
                <span>학습 기록하기</span>
                <ArrowRight size={24} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button className="mt-12 flex items-center gap-2 text-on-surface-variant hover:text-on-surface text-[12px] font-black uppercase tracking-[0.2em] transition-all group">
        <HelpCircle size={18} className="group-hover:rotate-12 transition-transform" />
        입장 코드가 무엇인가요?
      </button>
    </div>
  );
};

export default ClassroomEntry;
