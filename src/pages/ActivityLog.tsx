import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  ChevronDown, 
  Search, 
  Check, 
  Sparkles, 
  X, 
  Save, 
  PlusCircle,
  FileText,
  Bold,
  List,
  Paperclip
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const ActivityLog = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // Form States
  const [activityTitle, setActivityTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('과제물');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const { data: classesData } = await supabase.from('classes').select('*');
      if (classesData) {
        setClasses(classesData);
        if (classesData.length > 0) {
          setSelectedClassId(classesData[0].id);
          fetchStudents(classesData[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      const { data } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          student_number,
          observations(activity_name)
        `)
        .eq('class_id', classId);
      
      if (data) {
        setStudents(data.map(s => ({
          id: s.id,
          name: s.full_name,
          number: s.student_number || '번호 없음',
          lastActivity: s.observations?.[0]?.activity_name || '미기록'
        })));
      }
    } catch (error) {
      console.error('Error fetching students:', error);
    }
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    fetchStudents(id);
    setSelectedStudents([]);
  };

  const toggleStudent = (id: string) => {
    setSelectedStudents(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const handleSave = async (isComplete: boolean = false) => {
    if (selectedStudents.length === 0 || !activityTitle || !content) {
      alert('학생을 선택하고 활동 명칭 및 내용을 입력해 주세요.');
      return;
    }

    setIsSaving(true);
    try {
      // 선택된 모든 학생에 대해 관찰 기록을 저장합니다.
      const observations = selectedStudents.map(studentId => ({
        teacher_id: user?.id, // 로그인된 교사 ID
        student_id: studentId,
        content: content,
        activity_name: activityTitle,
        category: category
      }));

      const { error } = await supabase.from('observations').insert(observations);
      
      if (error) throw error;

      alert('활동 기록이 성공적으로 저장되었습니다.');
      if (isComplete) navigate('/dashboard');
    } catch (error: any) {
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      <div className="px-2">
        <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Activity Logging</p>
        <h1 className="text-2xl md:text-4xl font-extrabold font-manrope mb-4">관찰 기록</h1>
        <p className="text-on-surface-variant text-base max-w-3xl leading-relaxed">
          수업 중 관찰된 학생들의 활동 내용과 성취도를 기록합니다. 기록된 내용은 AI 분석 및 생활기록부 초안 작성에 활용됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-10">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="surface-card p-5 md:p-10 shadow-ambient space-y-6 md:space-y-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Class Selection</label>
                <div className="relative">
                  <select 
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Subject</label>
                <div className="relative">
                  <select className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all">
                    {classes.find(c => c.id === selectedClassId)?.subject ? (
                      <option>{classes.find(c => c.id === selectedClassId)?.subject}</option>
                    ) : (
                      <option>과목 선택</option>
                    )}
                  </select>
                  <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Activity Date</label>
                <div className="relative">
                  <input type="text" value="11/20/2023" className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                  <Calendar size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Category</label>
                <div className="flex gap-2">
                  {['발표', '과제물', '토론', '실험'].map((cat) => (
                    <button 
                      key={cat} 
                      onClick={() => setCategory(cat)}
                      className={`px-5 py-3.5 rounded-xl text-xs font-bold transition-all ${
                        category === cat ? 'bg-primary-container text-primary shadow-sm' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">Activity Title</label>
              <input 
                type="text" 
                value={activityTitle}
                onChange={(e) => setActivityTitle(e.target.value)}
                placeholder="예: 고전 시가 현대적 재해석 프로젝트"
                className="w-full px-6 py-5 bg-surface-container rounded-2xl text-base font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="surface-card p-10 shadow-ambient border-l-4 border-primary/40">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-bold font-manrope flex items-center gap-3">
                <FileText size={22} className="text-primary" />
                Detailed Activity Observations
              </h2>
              <button className="flex items-center gap-2 px-5 py-2.5 bg-primary-container/40 text-primary rounded-xl text-[11px] font-black tracking-tighter hover:bg-primary-container/60 transition-all">
                <Sparkles size={16} />
                AI로 관찰 내용 다듬기
              </button>
            </div>

            <div className="relative">
              <textarea 
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="학생들의 구체적인 활동 모습, 태도, 성취도 등을 입력하세요..."
                className="w-full min-h-[300px] p-8 bg-surface-container-low rounded-3xl text-base leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/10 transition-all resize-none"
              />
              <div className="absolute bottom-6 right-8 flex items-center gap-4 text-on-surface-variant/40">
                <button className="hover:text-primary transition-colors"><Bold size={20} /></button>
                <button className="hover:text-primary transition-colors"><List size={20} /></button>
                <button className="hover:text-primary transition-colors"><Paperclip size={20} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Student Selection Panel */}
        <div className="col-span-12 lg:col-span-4">
          <div className="surface-card p-8 shadow-ambient sticky top-30">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold font-manrope">학생 선택</h3>
              <span className="text-[11px] font-black bg-primary-container text-primary px-2 py-1 rounded-lg">32명 전체</span>
            </div>

            <div className="relative mb-6 group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="이름으로 검색..."
                className="w-full pl-10 pr-4 py-3 bg-surface-container rounded-xl text-[13px] font-medium focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                [1, 2, 3, 4, 5].map(i => <div key={i} className="h-[60px] bg-surface-container rounded-2xl animate-pulse" />)
              ) : students.length > 0 ? (
                students
                  .filter(s => s.name.includes(searchQuery))
                  .map((student) => (
                    <button 
                      key={student.id}
                      onClick={() => toggleStudent(student.id)}
                      className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all border-2 text-left ${
                        selectedStudents.includes(student.id) 
                        ? 'bg-primary-container/10 border-primary shadow-sm' 
                        : 'bg-surface-container-low border-transparent hover:bg-surface-container-high'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                        selectedStudents.includes(student.id) ? 'bg-primary border-primary' : 'border-on-surface-variant/20'
                      }`}>
                        {selectedStudents.includes(student.id) && <Check size={14} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{student.name} ({student.number})</p>
                        <p className="text-[11px] text-on-surface-variant">지난 활동: {student.lastActivity}</p>
                      </div>
                    </button>
                  ))
              ) : (
                <p className="text-center text-xs text-on-surface-variant py-10">학생이 없습니다.</p>
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-surface-container flex items-center justify-between">
              <p className="text-sm font-bold text-on-surface-variant">선택된 학생</p>
              <p className="text-lg font-black text-primary">{selectedStudents.length}명</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Actions */}
      <div className="flex items-center justify-between p-8 pt-10 border-t border-surface-container-high">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-all px-6 py-3 rounded-xl hover:bg-surface-container"
        >
          <X size={18} />
          작성 취소
        </button>
        <div className="flex items-center gap-4">
          <button 
            disabled={isSaving}
            onClick={() => handleSave(false)}
            className="flex items-center gap-2 px-8 py-3.5 bg-primary-container text-primary rounded-xl font-bold text-sm hover:bg-primary-container/80 active:scale-95 transition-all disabled:opacity-50"
          >
            <Save size={18} />
            {isSaving ? '저장 중...' : '임시 저장'}
          </button>
          <button 
            disabled={isSaving}
            onClick={() => handleSave(true)}
            className="flex items-center gap-2 px-10 py-3.5 btn-gradient rounded-xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50"
          >
            <PlusCircle size={18} />
            {isSaving ? '등록 중...' : '활동 등록 완료'}
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ActivityLog;
