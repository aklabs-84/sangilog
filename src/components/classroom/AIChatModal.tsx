import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Sparkles, User, Trash2, Paperclip, FileText, Image as ImageIcon, FileCheck, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { chatWithClassData, fileToGenerativePart, extractTextFromFiles } from '../../lib/gemini';
import { Database, MessageSquare } from 'lucide-react';

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  className: string;
  students: any[];
}

const AIChatModal = ({ isOpen, onClose, className, students }: AIChatModalProps) => {
  const [messages, setMessages] = useState<{role: 'user' | 'ai', text: string, hasFiles?: boolean}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'extracted'>('chat');
  const [extractedData, setExtractedData] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, selectedFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && selectedFiles.length === 0) || loading) return;

    const userMessage = input.trim() || (selectedFiles.length > 0 ? "첨부한 파일을 분석해줘." : "");
    const filesToUpload = [...selectedFiles];
    
    setInput('');
    setSelectedFiles([]);
    setMessages(prev => [...prev, { role: 'user', text: userMessage, hasFiles: filesToUpload.length > 0 }]);
    setLoading(true);

    try {
      const allObservations = students.flatMap(s => s.all_observations || []);
      const history = messages.map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
      
      // 1. 파일 처리 (Base64 변환)
      const fileParts = await Promise.all(
        filesToUpload.map(f => fileToGenerativePart(f))
      );

      // 2. 텍스트 추출 선행 (필요 시)
      let currentExtracted = extractedData;
      if (filesToUpload.length > 0) {
        setIsExtracting(true);
        const newExtracted = await extractTextFromFiles(fileParts);
        currentExtracted = (currentExtracted ? currentExtracted + "\n\n" : "") + newExtracted;
        setExtractedData(currentExtracted);
        setIsExtracting(false);
      }

      // 3. AI 답변 생성
      const response = await chatWithClassData(className, allObservations, history, userMessage, fileParts, currentExtracted || "");
      setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error) {
      console.error('AI Chat Error:', error);
      setMessages(prev => [...prev, { role: 'ai', text: '죄송합니다. 파일 분석 또는 답변 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' }]);
      setIsExtracting(false);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-on-surface/40 backdrop-blur-xl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="w-full max-w-2xl h-[80vh] glass rounded-[3rem] flex flex-col shadow-2xl border border-white/20 relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-secondary to-primary bg-[length:200%_100%] animate-shimmer" />
        
        {/* Header */}
        <header className="p-8 flex items-center justify-between border-b border-surface-container shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center shadow-inner">
              <Sparkles size={24} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-black font-manrope">AI 에듀 어시스턴트</h3>
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                {className} 전용 고도화 지침 적용 중
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Tab Switcher */}
            <div className="flex bg-surface-container p-1 rounded-2xl border border-white/40 shadow-inner">
              <button 
                onClick={() => setActiveTab('chat')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all ${activeTab === 'chat' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'}`}
              >
                <MessageSquare size={14} /> CHAT
              </button>
              <button 
                onClick={() => setActiveTab('extracted')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 transition-all ${activeTab === 'extracted' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'}`}
              >
                <Database size={14} /> DATA
              </button>
            </div>
            
            <div className="w-px h-8 bg-surface-container mx-2" />

            <button 
              onClick={() => { setMessages([]); setExtractedData(null); }} 
              className="p-3 hover:bg-surface-container rounded-2xl text-on-surface-variant transition-all hover:text-error active:scale-90"
              title="대화 초기화"
            >
              <Trash2 size={20} />
            </button>
            <button onClick={onClose} className="p-3 hover:bg-surface-container rounded-2xl transition-all active:scale-90"><X size={24} /></button>
          </div>
        </header>

        {/* Chat Area / Extracted Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8 bg-surface/30">
          {activeTab === 'chat' ? (
            <>
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center space-y-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                    <Sparkles size={64} className="text-primary relative animate-bounce" />
                  </div>
                  <div className="text-center space-y-4 max-w-sm">
                    <p className="text-2xl font-black text-on-surface">무엇을 도와드릴까요?</p>
                    <div className="p-6 bg-white/50 backdrop-blur-md rounded-3xl border border-white/40 shadow-sm space-y-3">
                      <p className="text-xs font-bold text-on-surface-variant leading-relaxed">
                        "학생들의 활동 기록 이미지를 첨부해 보세요. AI가 교육부 기재요령에 맞춰 분석해 드립니다."
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        <span className="px-3 py-1 bg-primary/5 text-primary text-[10px] font-black rounded-full border border-primary/10">#세특작성</span>
                        <span className="px-3 py-1 bg-secondary/5 text-secondary text-[10px] font-black rounded-full border border-secondary/10">#활동기록분석</span>
                        <span className="px-3 py-1 bg-tertiary/5 text-tertiary text-[10px] font-black rounded-full border border-tertiary/10">#이미지인식</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <AnimatePresence initial={false}>
                {messages.map((m, i) => (
                  <motion.div 
                    key={i} 
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center border-2 ${m.role === 'user' ? 'bg-surface-container-high border-white text-on-surface shadow-md' : 'bg-primary text-white border-primary/20 shadow-lg shadow-primary/20'}`}>
                      {m.role === 'user' ? <User size={22} /> : <Sparkles size={22} />}
                    </div>
                    <div className={`max-w-[85%] p-6 rounded-[2rem] text-sm font-bold leading-relaxed shadow-ambient ${m.role === 'user' ? 'bg-white rounded-tr-none text-on-surface' : 'bg-white border border-surface-container rounded-tl-none'}`}>
                      {m.hasFiles && (
                        <div className="mb-4 flex items-center gap-2 p-3 bg-primary/5 rounded-xl border border-primary/10 text-primary">
                          <FileCheck size={16} />
                          <span className="text-[11px] font-black italic">파일 분석 요청이 포함되었습니다</span>
                        </div>
                      )}
                      <div className="prose prose-sm prose-stone max-w-none prose-headings:font-black prose-p:leading-relaxed">
                        <ReactMarkdown>{m.text}</ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {(loading || isExtracting) && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20"><Loader2 size={22} className="animate-spin" /></div>
                  <div className="p-6 rounded-[2rem] rounded-tl-none bg-white shadow-ambient border border-surface-container flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                    <span className="text-xs font-black text-primary/60 ml-2 italic">
                      {isExtracting ? "파일에서 데이터를 추출하는 중입니다..." : "데이터를 분석하고 있습니다..."}
                    </span>
                  </div>
                </motion.div>
              )}
            </>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
                  <Database size={16} className="text-primary" />
                  Extracted Raw Content
                </h4>
                {extractedData && (
                  <button 
                    onClick={() => setExtractedData(null)}
                    className="text-[10px] font-black text-error hover:underline"
                  >
                    데이터 지우기
                  </button>
                )}
              </div>
              
              {extractedData ? (
                <div className="bg-white/50 backdrop-blur-md p-8 rounded-[2.5rem] border border-white shadow-inner overflow-hidden">
                  <div className="prose prose-sm prose-stone max-w-none prose-p:leading-relaxed prose-p:font-bold">
                    <ReactMarkdown>{extractedData}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                <div className="h-64 flex flex-col items-center justify-center border-4 border-dashed border-surface-container rounded-[3rem] text-on-surface-variant/30 space-y-4">
                  <Database size={48} />
                  <p className="text-sm font-black">아직 추출된 데이터 정보가 없습니다.</p>
                  <p className="text-[11px] font-bold">파일을 업로드하면 AI가 자동으로 텍스트를 읽어옵니다.</p>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* File Preview Area */}
        <AnimatePresence>
          {selectedFiles.length > 0 && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-8 py-4 bg-white/80 backdrop-blur-md border-t border-surface-container flex gap-3 overflow-x-auto custom-scrollbar"
            >
              {selectedFiles.map((file, idx) => (
                <motion.div 
                  key={idx}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3 bg-surface-container px-4 py-2.5 rounded-2xl border border-white shrink-0 shadow-sm transition-all hover:border-primary/30"
                >
                  {file.type.startsWith('image/') ? <ImageIcon size={16} className="text-primary" /> : <FileText size={16} className="text-secondary" />}
                  <span className="text-[11px] font-black max-w-[100px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="p-1 hover:bg-error/10 hover:text-error rounded-full transition-colors">
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="p-8 border-t border-surface-container-high bg-neutral-100/50 backdrop-blur-md shrink-0">
          <form onSubmit={handleSend} className="relative group">
            <input 
              type="file" 
              ref={fileInputRef} 
              multiple 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,.pdf,.xlsx,.xls,.txt"
            />
            <div className="flex items-center gap-3 bg-white rounded-[2rem] border-2 border-transparent focus-within:border-primary/20 shadow-xl transition-all pr-3 pl-3 py-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-on-surface-variant hover:bg-primary/10 hover:text-primary rounded-2xl transition-all active:scale-95"
                title="파일 첨부 (이미지, PDF, 엑셀)"
              >
                <Paperclip size={24} />
              </button>
              <input 
                type="text" 
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="질문을 입력하거나 파일을 첨부하세요..."
                className="flex-1 py-4 bg-transparent text-sm font-black focus:outline-none placeholder:text-neutral-400"
              />
              <button 
                type="submit" 
                disabled={(!input.trim() && selectedFiles.length === 0) || loading}
                className="p-4 bg-primary text-white rounded-[1.5rem] shadow-lg hover:shadow-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale disabled:pointer-events-none"
              >
                <Send size={20} />
              </button>
            </div>
          </form>
          <div className="mt-4 flex items-center justify-between px-4">
             <p className="text-[10px] font-bold text-on-surface-variant/60 flex items-center gap-1.5 uppercase tracking-tighter">
               <span className="w-1 h-1 bg-primary/40 rounded-full" />
               Gemini 3.1 Pro + Flash-Lite 하이브리드 모드 가동 중
             </p>
             <p className="text-[10px] font-bold text-primary/60 italic">2026 Edu-Safe AI Engine v4.2</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AIChatModal;
