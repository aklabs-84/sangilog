import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { motion } from 'framer-motion';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Calendar, 
  ArrowRight,
  Database,
  TrendingUp,
  Info,
  Settings2
} from 'lucide-react';
import { useAuth } from '../lib/auth';

const Export = () => {
  const { user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [obsCount, setObsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('classes')
        .select('*')
        .eq('teacher_id', user?.id);
      
      if (data) {
        setClasses(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].id);
          fetchPreviewData(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching classes:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPreviewData = async (classId: string) => {
    try {
      // 1. Fetch Students in Class
      const { data: students } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          student_number,
          observations(count)
        `)
        .eq('class_id', classId)
        .limit(5);

      if (students) {
        setPreviewData(students.map(s => ({
          id: s.student_number || `#ST-000${s.id.slice(0, 1)}`,
          name: s.full_name,
          cat: '최근 활동',
          score: `${s.observations?.[0]?.count || 0}건 기록`,
          trend: 'up'
        })));
      }

      // 2. Fetch total observations for this class
      const { count } = await supabase
        .from('observations')
        .select('*', { count: 'exact', head: true })
        .in('student_id', (await supabase.from('students').select('id').eq('class_id', classId)).data?.map(s => s.id) || []);
      
      setObsCount(count || 0);

    } catch (error) {
      console.error('Error fetching preview data:', error);
    }
  };

  const handleClassChange = (id: string) => {
    setSelectedClassId(id);
    fetchPreviewData(id);
  };
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-10"
    >
      <div className="px-2">
        <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">Workspace Utility</p>
        <h1 className="text-4xl font-extrabold font-manrope mb-4">데이터 내보내기 센터</h1>
        <p className="text-on-surface-variant text-base leading-relaxed max-w-2xl">
          기록된 학생 데이터를 다양한 형식으로 추출할 수 있습니다. 성적, 출석, AI 피드백 초안이 포함된 통합 리포트를 생성하세요.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-10">
        {/* Export Configuration */}
        <div className="col-span-12 lg:col-span-5 space-y-8">
          <div className="surface-card p-10 shadow-ambient border-l-4 border-primary">
            <h2 className="text-xl font-bold mb-8 flex items-center gap-3">
              <Database size={24} className="text-primary" />
              내보내기 매개변수 설정
            </h2>
            
            <div className="space-y-8">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학급 선택</label>
                <div className="relative group">
                  <select 
                    value={selectedClassId}
                    onChange={(e) => handleClassChange(e.target.value)}
                    className="w-full pl-4 pr-10 py-4 bg-surface-container rounded-xl text-sm font-bold appearance-none focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                  >
                    {loading ? (
                      <option>로딩 중...</option>
                    ) : classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - {c.subject}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">학생 범위 선택</label>
                <div className="flex bg-surface-container p-1 rounded-xl">
                  <button className="flex-1 py-3 px-4 bg-primary-container text-primary font-bold text-[13px] rounded-lg shadow-sm">전체 학생</button>
                  <button className="flex-1 py-3 px-4 text-on-surface-variant font-medium text-[13px] hover:text-on-surface transition-all">특정 학생 선택</button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">시작일</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input type="text" value="2023/09/01" readOnly className="w-full pl-11 pr-4 py-4 bg-surface-container rounded-xl text-sm font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider ml-1">종료일</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input type="text" value="2023/12/15" readOnly className="w-full pl-11 pr-4 py-4 bg-surface-container rounded-xl text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="surface-zone p-6 text-center cursor-pointer hover:bg-surface-container-high transition-all border-2 border-transparent hover:border-primary/20 group">
                  <FileText size={40} className="text-on-surface-variant/40 mx-auto mb-4 group-hover:scale-110 group-hover:text-primary transition-all" />
                  <p className="text-sm font-bold">CSV 형식</p>
                  <p className="text-[10px] text-on-surface-variant mt-1">범용 호환성</p>
                </div>
                <div className="surface-zone bg-primary/5 p-6 text-center cursor-pointer border-2 border-primary shadow-sm group">
                  <FileSpreadsheet size={40} className="text-primary mx-auto mb-4 group-hover:scale-110 transition-all" />
                  <p className="text-sm font-bold text-primary">XLSX 파일</p>
                  <p className="text-[10px] text-primary/60 mt-1 uppercase font-black">서식 포함</p>
                </div>
              </div>

              <div className="p-5 bg-surface-container-low rounded-2xl flex items-start gap-3 border border-surface-container">
                <div className="w-8 h-8 rounded-lg bg-surface-container-highest flex items-center justify-center text-primary mt-1">
                  <Info size={16} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black tracking-widest text-on-surface-variant">{obsCount}개의 기록 발견</p>
                  <p className="text-[11px] text-on-surface-variant/60 font-medium">성적, 출결, AI 피드백 초안이 포함되어 있습니다.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        <div className="col-span-12 lg:col-span-7 space-y-6">
          <div className="surface-card p-10 shadow-ambient flex flex-col h-full min-h-[600px]">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-bold font-manrope">데이터 구조 미리보기</h2>
                <p className="text-[11px] text-on-surface-variant font-medium mt-1">현재 설정된 내보내기 구성의 실시간 샘플링</p>
              </div>
              <span className="px-3 py-1 bg-surface-container text-on-surface-variant font-black text-[10px] rounded-lg tracking-widest uppercase">미리보기 모드</span>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="text-on-surface-variant border-b border-surface-container">
                    <th className="py-4 font-bold">학생 ID</th>
                    <th className="py-4 font-bold">학생 성함</th>
                    <th className="py-4 font-bold">카테고리</th>
                    <th className="py-4 font-bold">점수</th>
                    <th className="py-4 font-bold text-right">추이</th>
                  </tr>
                </thead>
                <tbody className="font-medium text-on-surface">
                  {loading ? (
                    [1, 2, 3].map(i => <tr key={i} className="animate-pulse h-12 bg-surface-container/20 border-b border-surface-container" />)
                  ) : previewData.length > 0 ? (
                    previewData.map((row, i) => (
                      <tr key={i} className="border-b border-surface-container/30 hover:bg-surface-container-low transition-colors">
                        <td className="py-5 text-on-surface-variant font-mono">{row.id}</td>
                        <td className="py-5 font-bold">{row.name}</td>
                        <td className="py-5">
                          <span className="px-2 py-1 bg-primary-container/40 text-primary text-[10px] font-black rounded-md">{row.cat}</span>
                        </td>
                        <td className="py-5 font-bold text-primary">{row.score}</td>
                        <td className="py-5 text-right">
                          {row.trend === 'up' && <TrendingUp size={18} className="text-primary ml-auto" />}
                          {row.trend === 'down' && <TrendingUp size={18} className="text-error rotate-90 ml-auto" />}
                          {row.trend === 'equal' && <ArrowRight size={18} className="text-on-surface-variant/40 ml-auto" />}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-20 text-center text-on-surface-variant text-xs">데이터가 없습니다.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-10 pt-6 border-t border-surface-container flex items-center justify-between">
              <div className="flex gap-10">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">선택된 열</p>
                  <p className="text-sm font-black">12개 선택됨</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase">파일 크기</p>
                  <p className="text-sm font-black">~1.4 MB</p>
                </div>
              </div>
              <button className="text-[11px] font-bold text-primary flex items-center gap-1 hover:underline">열 관리 <Settings2 size={12} /></button>
            </div>
          </div>
          
          <button className="w-full btn-gradient py-5 rounded-2xl font-black text-lg flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all">
            <Download size={24} />
            내보내기 실행
            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse ml-2" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default Export;
