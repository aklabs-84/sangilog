import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bug, Send, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface BugReportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const BugReportModal = ({ isOpen, onClose }: BugReportModalProps) => {
  const { user, profile } = useAuth();
  const [title, setTitle]       = useState('');
  const [description, setDesc]  = useState('');
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setLoading(true);
    try {
      await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id:    user?.id,
          user_name:  profile?.full_name || '익명',
          user_email: profile?.email || user?.email || '',
          title:      title.trim(),
          description: description.trim(),
          page_url:   window.location.href,
        }),
      });
      setDone(true);
      setTimeout(() => {
        setDone(false);
        setTitle('');
        setDesc('');
        onClose();
      }, 2000);
    } catch {
      alert('신고 전송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-red-50 rounded-xl flex items-center justify-center">
                  <Bug size={16} className="text-red-500" />
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900">버그 신고</p>
                  <p className="text-[10px] text-gray-400">발견한 문제를 알려주세요</p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {done ? (
              <div className="px-6 py-10 text-center space-y-3">
                <div className="w-14 h-14 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto">
                  <Check size={28} className="text-emerald-500" />
                </div>
                <p className="font-black text-gray-900">신고가 접수되었습니다!</p>
                <p className="text-xs text-gray-400">빠르게 확인하고 수정하겠습니다 🙏</p>
              </div>
            ) : (
              <div className="px-6 py-5 space-y-4">
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">제목</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="예: 저장 버튼 클릭 시 오류 발생"
                    className="mt-1.5 w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-200 border border-transparent focus:border-red-200 transition-all"
                    maxLength={80}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">상세 내용</label>
                  <textarea
                    value={description}
                    onChange={e => setDesc(e.target.value)}
                    placeholder="어떤 상황에서 발생했는지 구체적으로 알려주세요."
                    rows={4}
                    className="mt-1.5 w-full px-4 py-3 bg-gray-50 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-red-200 border border-transparent focus:border-red-200 transition-all resize-none"
                    maxLength={500}
                  />
                  <p className="text-right text-[10px] text-gray-300 mt-1">{description.length}/500</p>
                </div>
                <p className="text-[10px] text-gray-400">📍 현재 페이지 URL이 자동으로 포함됩니다</p>
                <button
                  onClick={handleSubmit}
                  disabled={loading || !title.trim() || !description.trim()}
                  className="w-full py-3.5 bg-red-500 hover:bg-red-600 disabled:opacity-40 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {loading ? '전송 중...' : '버그 신고 전송'}
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BugReportModal;
