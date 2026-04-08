import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  School, 
  Search, 
  X, 
  UserPlus, 
  Copy, 
  QrCode, 
  Link as LinkIcon 
} from 'lucide-react';

interface TeacherInviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  schoolName: string;
  teachers: any[];
  onSendInvite: (receiverId: string) => Promise<void>;
  loading: boolean;
  classId: string;
}

const TeacherInviteModal = ({ 
  isOpen, 
  onClose, 
  schoolName, 
  teachers, 
  onSendInvite, 
  loading, 
  classId 
}: TeacherInviteModalProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  const filteredTeachers = teachers.filter(t => 
    t.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/classroom-entry?link_source=${classId}`;
    navigator.clipboard.writeText(inviteLink);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-md">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="w-full max-w-3xl glass p-12 rounded-[3.5rem] space-y-8 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-secondary" />
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-3xl font-black font-manrope">교과 선생님 연동 초대</h3>
                <p className="text-sm font-bold text-on-surface-variant">소속 학교의 선생님들과 학급 명단을 공유하고 협업하세요.</p>
              </div>
              <button 
                onClick={onClose} 
                className="w-12 h-12 bg-surface-container hover:bg-surface-container-high rounded-2xl flex items-center justify-center transition-all active:rotate-90 duration-300"
              >
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              {/* Method A: Direct Invite (School Directory) */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                    <School size={12} /> {schoolName || '미지정'} 교사 명단
                  </label>
                  <div className="relative group">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/40 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="text" 
                      placeholder="선생님 성함 검색..." 
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 bg-neutral-100 rounded-xl text-xs font-bold outline-none ring-2 ring-transparent focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredTeachers.length > 0 ? (
                    filteredTeachers.map((t) => (
                      <div key={t.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl hover:bg-surface-container transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden bg-white shadow-sm ring-2 ring-surface-container-highest transition-transform group-hover:scale-105">
                            <img 
                              src={t.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.full_name)}&background=random`} 
                              alt={t.full_name} 
                              className="w-full h-full object-cover" 
                            />
                          </div>
                          <span className="text-sm font-bold">{t.full_name} 선생님</span>
                        </div>
                        <button 
                          disabled={loading}
                          onClick={() => onSendInvite(t.id)}
                          className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-tight shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                          <UserPlus size={12} />
                          {loading ? '전송중' : '연동 요청'}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="py-20 text-center opacity-30">
                      <School size={40} className="mx-auto mb-4" />
                      <p className="text-xs font-bold tracking-widest uppercase">명단이 없습니다</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Method B: Share Link (External Messengers) */}
              <div className="space-y-8 pt-0 md:pt-0 border-t md:border-t-0 md:border-l border-surface-container-highest/50 pl-0 md:pl-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-secondary uppercase tracking-widest flex items-center gap-2">
                    <LinkIcon size={12} /> 초대 링크 직직접 전송
                  </label>
                  <p className="text-xs font-bold text-on-surface-variant leading-relaxed">
                    단톡방이나 메신저로 링크를 전달하면 <br />
                    교과 선생님들이 바로 연동할 수 있습니다.
                  </p>
                </div>

                <div className="p-8 bg-surface-container-low rounded-[2.5rem] border-2 border-dashed border-surface-container-highest flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-secondary/10 text-secondary rounded-3xl flex items-center justify-center shadow-inner">
                    <QrCode size={40} strokeWidth={2.5} />
                  </div>
                  <button 
                    onClick={handleCopyLink}
                    className="w-full btn-gradient py-5 rounded-2xl font-black text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <Copy size={18} />
                    {copySuccess ? '복사 완료!' : '초대 링크 복사하기'}
                  </button>
                  <p className="text-[10px] font-bold text-on-surface-variant opacity-40 text-center uppercase tracking-widest">
                    Link expires with class archive
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default TeacherInviteModal;
