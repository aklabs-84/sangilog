import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Sparkles, User as UserIcon, BookOpen, Clock, Activity, FileText, CheckCircle2,
  FolderOpen, AlignLeft, Link2, ImageIcon, File, Upload, ExternalLink, Megaphone, MessageSquare, Loader2,
  Reply, Send
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface StudentDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string | null;
}

const StudentDetailDrawer = ({ isOpen, onClose, studentId }: StudentDetailDrawerProps) => {
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [savingReplyId, setSavingReplyId] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSaveReply = async (suggestionId: string) => {
    if (!replyText.trim()) return;
    setSavingReplyId(suggestionId);
    try {
      const { error } = await supabase
        .from('student_suggestions')
        .update({
          teacher_reply: replyText.trim(),
          replied_at: new Date().toISOString(),
          is_reply_read: false
        })
        .eq('id', suggestionId);
      if (error) throw error;
      setSuggestions(prev => prev.map(s =>
        s.id === suggestionId
          ? { ...s, teacher_reply: replyText.trim(), replied_at: new Date().toISOString(), is_reply_read: false }
          : s
      ));
      setReplyingId(null);
      setReplyText('');
    } catch (err) {
      console.error('Reply save error:', err);
    } finally {
      setSavingReplyId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadResult = (result: any) => {
    const { data } = supabase.storage.from('student-attachments').getPublicUrl(result.storage_path);
    const link = document.createElement('a');
    link.href = data.publicUrl;
    link.download = result.display_name || 'download';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    const fetchStudentDetail = async () => {
      if (!studentId || !isOpen) return;
      setLoading(true);
      try {
        const [studentRes, resultsRes, suggestionsRes] = await Promise.all([
          supabase
            .from('students')
            .select(`*, observations(id, content, activity_name, created_at, is_student_record, status)`)
            .eq('id', studentId)
            .single(),
          supabase
            .from('student_results')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false }),
          supabase
            .from('student_suggestions')
            .select('*')
            .eq('student_id', studentId)
            .order('created_at', { ascending: false })
        ]);

        if (studentRes.error) throw studentRes.error;
        setStudent(studentRes.data);
        if (!resultsRes.error) setResults(resultsRes.data || []);
        if (!suggestionsRes.error) setSuggestions(suggestionsRes.data || []);
      } catch (err) {
        console.error('Error fetching student detail for drawer:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentDetail();
  }, [studentId, isOpen]);

  const handleNavigateToFullPage = () => {
    if (studentId) {
      navigate(`/student-view/${studentId}`);
      onClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000]">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-neutral-900/20 backdrop-blur-sm"
        />
        
        {/* Drawer */}
        <motion.div 
          initial={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0)' }}
          animate={{ x: 0, boxShadow: '-20px 0 40px rgba(0,0,0,0.1)' }}
          exit={{ x: '100%', boxShadow: '-20px 0 40px rgba(0,0,0,0)' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="absolute top-0 right-0 h-full w-full max-w-md bg-surface border-l border-white/40 flex flex-col overflow-hidden text-on-surface"
        >
          {/* Drawer Header */}
          <header className="p-6 border-b border-surface-container-high flex flex-col gap-6 bg-white/50 backdrop-blur-xl shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-[1.25rem] flex items-center justify-center text-primary shadow-inner">
                  <UserIcon size={24} strokeWidth={2} />
                </div>
                <div>
                  {loading ? (
                    <div className="h-6 w-24 bg-surface-container animate-pulse rounded-md mb-2" />
                  ) : (
                    <h2 className="text-2xl font-black tracking-tight">{student?.full_name}</h2>
                  )}
                  {loading ? (
                     <div className="h-4 w-12 bg-surface-container animate-pulse rounded-md" />
                  ) : (
                    <span className="px-2 py-0.5 bg-surface-container-high text-[10px] font-black uppercase text-on-surface-variant/60 rounded border border-neutral-200">
                       {student?.student_number ? `${student.student_number}번` : '정보 없음'}
                    </span>
                  )}
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 -mr-2 text-on-surface-variant/40 hover:text-on-surface hover:bg-surface-container rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleNavigateToFullPage}
                className="flex-1 py-3 bg-on-surface text-surface rounded-xl text-xs font-black hover:bg-primary transition-all shadow-soft active:scale-95 flex items-center justify-center gap-2"
              >
                <BookOpen size={14} /> 전체 기록실 이동
              </button>
            </div>
          </header>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8 bg-surface-container-low/30">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-surface-container/50 animate-pulse rounded-2xl" />
                ))}
              </div>
            ) : (
              <>
                {/* Quick AI Summary Hook */}
                <div className="p-5 layered-card rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border-primary/10 relative overflow-hidden group">
                   <div className="absolute -right-4 -top-4 text-primary/10 group-hover:rotate-12 transition-transform duration-500"><Sparkles size={60} /></div>
                   <div className="relative z-10 flex items-center gap-2 mb-3">
                      <Sparkles size={16} className="text-primary" />
                      <h4 className="text-[11px] font-black uppercase tracking-widest text-primary">AI Quick Insight</h4>
                   </div>
                   <p className="text-sm font-bold text-on-surface-variant leading-relaxed relative z-10 line-clamp-3">
                     {student?.observations?.length > 0 ? 
                       "누적된 관찰 기록을 분석하여 학생의 주요 성장 키워드와 성취도를 시각적으로 시뮬레이션 할 수 있습니다."
                       : "아직 등록된 활동 기록이 없습니다. 새로운 관찰 기록을 추가하여 AI 분석을 시작하세요."}
                   </p>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-secondary/60">
                         <Activity size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Total Activities</span>
                      </div>
                      <span className="text-2xl font-black">{student?.observations?.length || 0}</span>
                   </div>
                   <div className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100 flex flex-col gap-2">
                      <div className="flex items-center gap-2 text-primary/60">
                         <FileText size={14} />
                         <span className="text-[9px] font-black uppercase tracking-widest">Reports</span>
                      </div>
                      <span className="text-2xl font-black">0</span>
                   </div>
                </div>

                {/* Recent Activity Mini List */}
                <div className="space-y-4">
                   <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                      <Clock size={14} /> Recent Activities
                   </h4>
                   {student?.observations?.length > 0 ? (
                     <div className="space-y-3">
                       {student.observations.slice(0, 3).map((obs: any) => (
                         <div key={obs.id} className="p-4 bg-white rounded-2xl shadow-sm border border-neutral-100/50 hover:border-primary/20 transition-colors">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[10px] font-bold text-on-surface-variant/40">
                                {new Date(obs.created_at).toLocaleDateString('ko-KR')}
                              </p>
                              {obs.is_student_record && (
                                obs.status === 'pending' ? (
                                  <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                    <Clock size={9} /> 승인대기
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1 text-[9px] font-black text-secondary bg-secondary/10 px-1.5 py-0.5 rounded-md">
                                    <CheckCircle2 size={9} /> 승인완료
                                  </span>
                                )
                              )}
                            </div>
                            <p className="text-sm font-black text-on-surface/80">{obs.activity_name}</p>
                         </div>
                       ))}
                     </div>
                   ) : (
                     <div className="p-6 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
                        <p className="text-xs font-bold text-neutral-400">최근 활동 기록이 없습니다.</p>
                     </div>
                   )}
                </div>

                {/* 결과 제출 목록 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                      <FolderOpen size={14} /> 결과 제출
                    </h4>
                    <span className="text-[10px] font-black text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-md">
                      {results.length}건
                    </span>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-primary" /></div>
                  ) : results.length === 0 ? (
                    <div className="p-4 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
                      <p className="text-xs font-bold text-neutral-400">제출된 결과물이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {results.map(r => {
                        const typeConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
                          text:  { icon: <AlignLeft size={13} />,  color: 'text-primary bg-primary/10',     label: '텍스트' },
                          link:  { icon: <Link2 size={13} />,      color: 'text-blue-500 bg-blue-50',       label: '링크' },
                          image: { icon: <ImageIcon size={13} />,  color: 'text-emerald-500 bg-emerald-50', label: '이미지' },
                          file:  { icon: <File size={13} />,       color: 'text-amber-500 bg-amber-50',     label: '파일' }
                        };
                        const cfg = typeConfig[r.result_type] || typeConfig.file;
                        const publicUrl = r.storage_path
                          ? supabase.storage.from('student-attachments').getPublicUrl(r.storage_path).data.publicUrl
                          : null;

                        return (
                          <div key={r.id} className="p-3.5 bg-white rounded-xl border border-neutral-100 hover:border-primary/20 transition-colors group">
                            <div className="flex items-start gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color}`}>
                                {cfg.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                  {r.title && <span className="font-black text-xs text-on-surface">{r.title}</span>}
                                  <span className={`text-[8px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                                {r.text_content && (
                                  <p className="text-[11px] font-medium text-on-surface/70 line-clamp-2 leading-relaxed">{r.text_content}</p>
                                )}
                                {r.link_url && (
                                  <a href={r.link_url} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-blue-500 hover:underline flex items-center gap-1 truncate">
                                    <ExternalLink size={10} />{r.link_url}
                                  </a>
                                )}
                                {r.result_type === 'image' && publicUrl && (
                                  <img
                                    src={publicUrl}
                                    alt={r.title || '이미지'}
                                    className="max-h-20 rounded-lg object-cover mt-1.5 cursor-pointer hover:opacity-80"
                                    onClick={() => window.open(publicUrl, '_blank')}
                                  />
                                )}
                                {r.result_type === 'file' && (
                                  <p className="text-[11px] font-bold text-amber-600 flex items-center gap-1 mt-0.5">
                                    <File size={10} />{r.display_name}
                                    {r.file_size ? ` (${formatFileSize(r.file_size)})` : ''}
                                  </p>
                                )}
                              </div>
                              {(r.result_type === 'image' || r.result_type === 'file') && r.storage_path && (
                                <button
                                  onClick={() => handleDownloadResult(r)}
                                  title="다운로드"
                                  className="w-7 h-7 rounded-lg bg-surface-container hover:bg-primary/10 hover:text-primary flex items-center justify-center text-on-surface-variant transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                >
                                  <Upload size={12} className="rotate-180" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 건의사항 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
                      <Megaphone size={14} /> 건의사항
                    </h4>
                    <span className="text-[10px] font-black text-on-surface-variant/50 bg-surface-container px-2 py-0.5 rounded-md">
                      {suggestions.length}건
                    </span>
                  </div>

                  {loading ? (
                    <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin text-primary" /></div>
                  ) : suggestions.length === 0 ? (
                    <div className="p-4 text-center border-2 border-dashed border-neutral-200 rounded-2xl">
                      <p className="text-xs font-bold text-neutral-400">등록된 건의사항이 없습니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {suggestions.map(s => {
                        const isReplying = replyingId === s.id;
                        return (
                          <div key={s.id} className="rounded-xl border border-neutral-100 bg-white overflow-hidden">
                            {/* 학생 건의 내용 */}
                            <div className="flex items-start gap-3 p-3.5">
                              <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center text-rose-400 shrink-0">
                                <MessageSquare size={13} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-medium text-on-surface/80 leading-relaxed">{s.content}</p>
                                <p className="text-[9px] font-bold text-on-surface-variant/40 mt-1 flex items-center gap-1">
                                  <Clock size={9} />
                                  {new Date(s.created_at).toLocaleDateString('ko-KR')}
                                </p>
                              </div>
                            </div>

                            {/* 답변 영역 */}
                            {isReplying ? (
                              <div className="border-t border-neutral-100 bg-primary/[0.02] p-3.5 space-y-2">
                                <textarea
                                  value={replyText}
                                  onChange={e => setReplyText(e.target.value)}
                                  rows={3}
                                  autoFocus
                                  placeholder="학생에게 전달할 답변을 입력하세요..."
                                  className="w-full px-3 py-2 bg-white rounded-xl text-xs font-medium border border-neutral-200 focus:border-primary/40 focus:outline-none resize-none transition-all"
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleSaveReply(s.id)}
                                    disabled={savingReplyId === s.id || !replyText.trim()}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-black hover:bg-primary/80 disabled:opacity-50 transition-all"
                                  >
                                    {savingReplyId === s.id ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                                    답변 저장
                                  </button>
                                  <button
                                    onClick={() => { setReplyingId(null); setReplyText(''); }}
                                    className="px-3 py-1.5 text-neutral-400 rounded-lg text-[10px] font-black hover:bg-neutral-100 transition-all"
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : s.teacher_reply ? (
                              <div className="border-t border-primary/10 bg-primary/[0.03] p-3.5">
                                <div className="flex items-start gap-2">
                                  <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center text-primary shrink-0 mt-0.5">
                                    <Reply size={11} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[9px] font-black text-primary uppercase tracking-wider mb-1">선생님 답변</p>
                                    <p className="text-[11px] font-medium text-on-surface/80 leading-relaxed">{s.teacher_reply}</p>
                                    {s.replied_at && (
                                      <p className="text-[9px] font-bold text-on-surface-variant/30 mt-1 flex items-center gap-1">
                                        <Clock size={9} />
                                        {new Date(s.replied_at).toLocaleDateString('ko-KR')}
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    onClick={() => { setReplyingId(s.id); setReplyText(s.teacher_reply); }}
                                    className="text-[9px] font-black text-primary/50 hover:text-primary transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-primary/10"
                                  >
                                    수정
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="border-t border-neutral-100 px-3.5 py-2.5">
                                <button
                                  onClick={() => { setReplyingId(s.id); setReplyText(''); }}
                                  className="text-[10px] font-black text-primary/60 hover:text-primary flex items-center gap-1.5 transition-colors"
                                >
                                  <Reply size={11} /> 답변 작성
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default StudentDetailDrawer;
