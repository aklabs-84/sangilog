import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useTheme } from '../hooks/useTheme';
import type { ThemeMode } from '../hooks/useTheme';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Camera, 
  School, 
  Globe, 
  LogOut, 
  Moon, 
  Sun,
  Monitor,
  Info, 
  Check, 
  X, 
  Loader2,
  Upload,
  ExternalLink,
  ChevronUp,
  Copy,
  Edit3,
  Trash2
} from 'lucide-react';

const Settings = () => {
  const { user, profile: authProfile, refreshProfile, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // UI States
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showLangModal, setShowLangModal] = useState(false);
  
  // Edit States
  const [editForm, setEditForm] = useState({
    full_name: '',
    school_name: '',
    school_code: '',
    avatar_url: ''
  });

  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false);
  const [schoolAction, setSchoolAction] = useState<'create' | 'join'>('create');
  const [scInput, setScInput] = useState({ name: '', code: '' });

  useEffect(() => {
    if (authProfile) {
      setProfile(authProfile);
      setEditForm({
        full_name: authProfile.full_name || '',
        school_name: authProfile.school_name || '',
        school_code: authProfile.school_code || '',
        avatar_url: authProfile.avatar_url || ''
      });
      setLoading(false);
    }
  }, [authProfile]);

  // Image Optimization (Canvas API)
  const optimizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400; // Profile image standard size
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio and resize
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Canvas processing failed'));
            },
            'image/jpeg',
            0.8 // 80% Quality
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileSelect = () => {
    if (isEditing) fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    setIsUploading(true);
    try {
      // 1. Optimize image (Resize & Compression)
      const optimizedBlob = await optimizeImage(file);
      const fileExt = 'jpg';
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, optimizedBlob, {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // 4. Update Edit Form
      setEditForm(prev => ({ ...prev, avatar_url: publicUrl }));
      
    } catch (error: any) {
      alert('이미지 업로드 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: editForm.full_name,
          school_name: editForm.school_name,
          school_code: editForm.school_code,
          avatar_url: editForm.avatar_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', user?.id);

      if (error) throw error;
      
      await refreshProfile();
      setIsEditing(false);
      alert('프로필이 성공적으로 업데이트되었습니다.');
    } catch (error: any) {
      alert('저장 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert('학교 코드가 복사되었습니다! ✨');
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleDeleteSchool = async () => {
    const isMember = !profile?.is_school_admin;
    const confirmMsg = isMember 
      ? '소속 학교 정보를 초기화하고 학교 워크스페이스에서 나가시겠습니까?' 
      : '정말 학교 워크스페이스를 삭제하고 소속 정보를 초기화하시겠습니까? (본인 프로필만 초기화됩니다.)';
    
    if (!confirm(confirmMsg)) return;
    
    setIsSaving(true);
    try {
      const updateData = { 
        school_name: null, 
        school_code: null, 
        is_school_admin: false 
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user?.id);

      if (error) throw error;
      
      await supabase.auth.updateUser({ data: updateData });
      await refreshProfile();
      alert('학교 소속이 해제되었습니다.');
    } catch (error: any) {
      alert('삭제 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSchoolAction = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      let updateData = {};
      if (schoolAction === 'create') {
        const code = `SCH-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        updateData = { 
          school_name: scInput.name, 
          school_code: code,
          is_school_admin: true // 최초 생성자가 관리자
        };
      } else {
        const cleanedCode = scInput.code.trim().toUpperCase();
        // 1. 해당 코드를 사용 중인 다른 프로필에서 학교 이름 가져오기
        const { data: schoolsWithName, error: fetchError } = await supabase
          .from('profiles')
          .select('school_name')
          .eq('school_code', cleanedCode)
          .not('school_name', 'is', null) // 이름이 실제 존재하는 데이터만
          .limit(1);
          
        if (fetchError) throw fetchError;
        
        if (!schoolsWithName || schoolsWithName.length === 0) {
          throw new Error('유효하지 않은 학교 코드이거나 가입된 학교 정보를 찾을 수 없습니다.');
        }

        updateData = { 
          school_code: cleanedCode,
          school_name: schoolsWithName[0].school_name,
          is_school_admin: false 
        };
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;
      
      // auth metadata도 업데이트 (대시보드 필터용)
      await supabase.auth.updateUser({
        data: { ...updateData }
      });

      await refreshProfile();
      setIsSchoolModalOpen(false);
      alert(schoolAction === 'create' ? '새 학교 워크스페이스가 생성되었습니다! 코드를 동료들에게 공유하세요.' : '학교 워크스페이스에 성공적으로 참여했습니다.');
    } catch (error: any) {
      alert('처리 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const sections = [
    { 
      id: 'profile', 
      title: '개인 프로필', 
      icon: User, 
      items: [
        { label: '이름', value: profile?.full_name || '미지정', key: 'full_name', isImage: false, readOnly: false },
        { label: '아바타 이미지', value: profile?.avatar_url ? '업로드됨' : '기본 이미지', key: 'avatar_url', isImage: true, readOnly: false },
      ]
    },
    { 
      id: 'workspace', 
      title: '워크스페이스 설정', 
      icon: School, 
      items: [
        { label: '소속 학교', value: profile?.school_name || '미지정', key: 'school_name', isImage: false, readOnly: false },
        { label: '역할', value: profile?.role === 'teacher' ? '교사' : '학생', key: 'role', isImage: false, readOnly: true },
      ]
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-10 pb-20"
    >
      <div className="px-2 flex items-center justify-between">
        <div>
          <p className="text-primary font-bold text-xs uppercase tracking-widest mb-3">System Preferences</p>
          <h1 className="text-2xl md:text-4xl font-extrabold font-manrope mb-4">설정</h1>
          <p className="text-on-surface-variant text-base leading-relaxed">
            계정 정보, 워크스페이스 및 개인화 설정을 관리하세요.
          </p>
        </div>
        <div className="flex gap-3">
          {isEditing ? (
            <>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-3 rounded-xl border border-surface-container-highest font-bold text-sm hover:bg-surface-container transition-all flex items-center gap-2"
              >
                <X size={18} />
                취소
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || isUploading}
                className="px-8 py-3 bg-primary text-white rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                변경사항 저장
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="btn-gradient px-8 py-3.5 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg shadow-primary/10 active:scale-95"
            >
              프로필 수정
            </button>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="surface-card p-5 md:p-10 shadow-ambient flex items-center gap-5 md:gap-10 relative overflow-hidden">
        <div className="relative group cursor-pointer" onClick={handleFileSelect}>
          <div className={`w-32 h-32 rounded-3xl overflow-hidden shadow-lg border-4 border-surface-container-high transition-transform ${isEditing ? 'hover:scale-105' : ''} bg-surface-container flex items-center justify-center relative`}>
            {loading ? (
              <div className="w-full h-full animate-pulse bg-surface-container-highest" />
            ) : (() => {
              const avatarUrl = isEditing ? editForm.avatar_url : profile?.avatar_url;
              const initial = (profile?.full_name || '?').charAt(0).toUpperCase();
              return avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="ProfileLarge"
                  className={`w-full h-full object-cover transition-all ${isUploading ? 'blur-sm opacity-50' : ''}`}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <span className="text-white text-4xl font-black">{initial}</span>
                </div>
              );
            })()}
            
            {isEditing && !isUploading && (
              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                <Camera size={24} className="text-white mb-1" />
                <span className="text-[10px] text-white font-bold tracking-tight">사진 변경</span>
              </div>
            )}

            {isUploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <Loader2 size={24} className="animate-spin text-white" />
              </div>
            )}
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
        </div>

        <div className="flex-1 space-y-2">
          {loading ? (
            <div className="space-y-2">
              <div className="w-48 h-8 bg-surface-container animate-pulse rounded" />
              <div className="w-32 h-4 bg-surface-container animate-pulse rounded" />
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-black font-manrope">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.full_name}
                    onChange={(e) => setEditForm({...editForm, full_name: e.target.value})}
                    className="bg-surface-container-low border-b-2 border-primary px-2 py-1 outline-none w-full max-w-xs font-bold focus:bg-surface-container transition-all"
                    placeholder="이름 입력"
                  />
                ) : (
                  profile?.full_name || '사용자'
                )} 
                {!isEditing && ' 선생님'}
              </h2>
              <p className="text-on-surface-variant font-medium">관리자 계정 • {profile?.role || '교사'}</p>
            </>
          )}
          <div className="flex gap-2 pt-2">
            <span className="px-3 py-1 bg-primary-container text-primary font-bold text-[11px] rounded-lg tracking-widest uppercase shadow-sm shadow-primary/10 transition-all hover:scale-105">PREMIUM PRO</span>
            <span className="px-3 py-1 bg-surface-container-highest text-on-surface-variant font-bold text-[11px] rounded-lg tracking-widest uppercase">ACTIVE</span>
          </div>
        </div>
      </div>

      {/* Settings Sections */}
      <div className="space-y-6">
        {sections.map((section) => (
          <div key={section.id} className="surface-card shadow-ambient overflow-hidden transition-all">
            <div className="px-5 md:px-10 py-4 md:py-6 border-b border-surface-container bg-surface-container-low/30 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-3">
                <section.icon size={22} className="text-primary" />
                {section.title}
              </h3>
              {section.id === 'workspace' && (!profile?.school_code || profile?.school_name === '미지정') && (
                <button 
                  onClick={() => setIsSchoolModalOpen(true)}
                  className="px-4 py-2 bg-primary/10 text-primary rounded-lg text-[10px] font-black hover:bg-primary hover:text-white transition-all shadow-sm"
                >
                  기존 가입자 학교 코드 발급/참여
                </button>
              )}
            </div>
            <div className="divide-y divide-surface-container">
              {section.items.map((item, i) => (
                <div key={i} className="px-5 md:px-10 py-4 md:py-6 flex items-center justify-between hover:bg-surface-container-low/50 transition-colors group">
                  <div className="space-y-1 flex-1">
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{item.label}</p>
                    {isEditing && !item.readOnly ? (
                      item.isImage ? (
                        <button 
                          onClick={handleFileSelect}
                          className="flex items-center gap-2 text-sm font-bold text-primary hover:underline group-hover:translate-x-1 transition-all"
                        >
                          <Upload size={14} />
                          사진 업로드하기
                        </button>
                      ) : (
                        <input 
                          type="text" 
                          value={editForm[item.key as keyof typeof editForm]}
                          onChange={(e) => setEditForm({...editForm, [item.key]: e.target.value})}
                          className="w-full max-w-md bg-surface-container-low border-b border-primary/50 px-2 py-1 outline-none font-semibold focus:border-primary transition-all focus:bg-surface-container"
                        />
                      )
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3">
                          <p className="text-base font-semibold">{item.value}</p>
                          {item.key === 'school_name' && profile?.school_code && (
                            <button
                              onClick={() => copyToClipboard(profile.school_code)}
                              className="px-3 py-1.5 bg-secondary/10 text-secondary border border-secondary/20 rounded-xl text-[10px] font-black tracking-widest uppercase flex items-center gap-2 hover:bg-secondary hover:text-white transition-all shadow-sm"
                              title="코드 복사"
                            >
                              CODE: {profile.school_code}
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                        
                        {item.key === 'school_name' && profile?.school_code && (
                          <div className="flex items-center gap-2">
                            {profile.is_school_admin && (
                              <button 
                                onClick={() => {
                                  setSchoolAction('create');
                                  setScInput({ name: profile.school_name, code: '' });
                                  setIsSchoolModalOpen(true);
                                }}
                                className="p-2 text-slate-400 hover:text-primary transition-all rounded-lg hover:bg-primary/5"
                                title="학교 정보 수정"
                              >
                                <Edit3 size={16} />
                              </button>
                            )}
                            <button 
                              onClick={handleDeleteSchool}
                              className="p-2 text-slate-400 hover:text-error transition-all rounded-lg hover:bg-error/5"
                              title={profile.is_school_admin ? "학교 워크스페이스 삭제" : "소속 학교 나가기"}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between p-5 md:p-10 mt-6 md:mt-10 border-t border-surface-container-high relative flex-wrap gap-4">
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setShowLangModal(true)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-all font-bold text-sm group"
          >
            <Globe size={18} className="group-hover:rotate-12 transition-transform" />
            언어 설정
          </button>
          
          <div className="relative">
            <button 
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className={`flex items-center gap-2 transition-all font-bold text-sm group ${showThemeMenu ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
            >
              {theme === 'dark' ? <Moon size={18} /> : theme === 'light' ? <Sun size={18} /> : <Monitor size={18} />}
              테마 설정
              <ChevronUp size={14} className={`transition-transform ${showThemeMenu ? 'rotate-180' : ''}`} />
            </button>
            
            <AnimatePresence>
              {showThemeMenu && (
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 w-40 glass rounded-2xl shadow-ambient p-2 border border-surface-container-highest z-50 overflow-hidden"
                >
                  <p className="px-3 py-2 text-[10px] font-black text-on-surface-variant uppercase tracking-widest border-b border-surface-container mb-1">Theme Mode</p>
                  {[
                    { id: 'system', label: '시스템 설정', icon: Monitor },
                    { id: 'light', label: '라이트 모드', icon: Sun },
                    { id: 'dark', label: '다크 모드', icon: Moon },
                  ].map((it) => (
                    <button
                      key={it.id}
                      onClick={() => {
                        setTheme(it.id as ThemeMode);
                        setShowThemeMenu(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${theme === it.id ? 'bg-primary text-white shadow-md shadow-primary/20 scale-[1.02]' : 'hover:bg-surface-container-high'}`}
                    >
                      <it.icon size={14} />
                      {it.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button 
            onClick={() => setShowInfoModal(true)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-all font-bold text-sm group"
          >
            <Info size={18} className="group-hover:scale-110 transition-transform" />
            시스템 정보
          </button>
        </div>
        
        <button 
          onClick={signOut}
          className="flex items-center gap-2 text-error font-extrabold text-sm hover:underline underline-offset-4 decoration-2 px-6 py-3 rounded-xl hover:bg-error-container/20 transition-all active:scale-95"
        >
          <LogOut size={18} />
          로그아웃하기
        </button>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isSchoolModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSchoolModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white p-12 rounded-[2.5rem] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-slate-100"
            >
              {/* Decorative corner glow */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
              
              <div className="space-y-10">
                <div className="text-center space-y-3">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                    {schoolAction === 'create' ? '학교 워크스페이스 생성' : '기존 학교 참여'}
                  </h3>
                  <p className="text-[11px] text-slate-400 font-black uppercase tracking-[0.3em]">School Workspace Configuration</p>
                </div>

                <div className="flex bg-slate-50 rounded-2xl p-1.5 border border-slate-100 shadow-inner">
                  {['create', 'join'].map((it) => (
                    <button
                      key={it}
                      onClick={() => setSchoolAction(it as 'create' | 'join')}
                      className={`flex-1 py-3.5 text-xs font-black rounded-xl transition-all uppercase tracking-widest ${schoolAction === it ? 'bg-white shadow-md text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      {it === 'create' ? '새로 만들기' : '코드 입력'}
                    </button>
                  ))}
                </div>

                <div className="space-y-8">
                  {schoolAction === 'create' ? (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">학교 명칭</label>
                      <input 
                        type="text" 
                        value={scInput.name}
                        onChange={(e) => setScInput({...scInput, name: e.target.value})}
                        className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl text-sm font-bold text-slate-900 transition-all outline-none placeholder:text-slate-300 shadow-sm"
                        placeholder="예: 아크 고등학교"
                      />
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">최초 생성 시 6자리의 고유 코드가 발급됩니다.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">학교 코드 (6자리)</label>
                      <input 
                        type="text" 
                        value={scInput.code}
                        onChange={(e) => setScInput({...scInput, code: e.target.value.toUpperCase()})}
                        className="w-full px-6 py-5 bg-slate-50 border-2 border-transparent focus:border-primary/20 focus:bg-white rounded-2xl text-sm font-bold tracking-[0.2em] text-slate-900 transition-all outline-none placeholder:text-slate-300 shadow-sm"
                        placeholder="SCH-ABC"
                      />
                      <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">동료 선생님으로부터 받은 코드를 입력하세요.</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-2">
                  <button 
                    onClick={() => setIsSchoolModalOpen(false)}
                    className="flex-1 py-4 bg-slate-100/50 hover:bg-slate-100 border border-slate-200 rounded-2xl font-black text-slate-500 text-sm transition-all active:scale-95"
                  >
                    취소
                  </button>
                  <button 
                    onClick={handleSchoolAction}
                    disabled={isSaving || (schoolAction === 'create' ? !scInput.name : !scInput.code)}
                    className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                    {schoolAction === 'create' ? '생성 및 발급' : '연동 완료'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {showLangModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLangModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md surface-card shadow-ambient border border-surface-container-highest p-8"
            >
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary">
                  <Globe size={32} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-black">언어 설정</h3>
                  <p className="text-on-surface-variant leading-relaxed">
                    현재 <strong>생기로그(SaenggiLog)</strong>는 한국어(KO) 서비스를 기본으로 제공하고 있습니다. 
                    추후 글로벌 서비스 확장을 통해 더 많은 언어를 지원할 예정입니다.
                  </p>
                </div>
                <button 
                  onClick={() => setShowLangModal(false)}
                  className="w-full py-4 bg-surface-container-high rounded-2xl font-black text-sm hover:bg-surface-container-highest transition-all"
                >
                  확인했습니다
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showInfoModal && (
          <div className="fixed inset-0 flex items-center justify-center z-[100] px-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInfoModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg surface-card shadow-ambient border border-surface-container-highest p-10"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-primary rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-primary/20">
                    <Check size={40} strokeWidth={4} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-3xl font-black">생기로그 SaenggiLog</h2>
                    <p className="text-on-surface-variant font-bold">Version 1.0.0 (Production Build)</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-surface-container rounded-2xl">
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Developer</p>
                    <p className="font-bold">Antigravity AI Team</p>
                  </div>
                  <div className="p-5 bg-surface-container rounded-2xl">
                    <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest mb-1">Platform</p>
                    <p className="font-bold">Aklabs Professional</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    생기로그는 AI 기술을 활용하여 교사의 업무 부담을 줄이고 학생들의 성장을 더 깊이 있게 관찰할 수 있도록 돕는 스마트 교육 솔루션입니다.
                  </p>
                  <a 
                    href="https://litt.ly/aklabs" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-5 bg-primary/5 border border-primary/20 rounded-2xl group hover:bg-primary/10 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
                        <Globe size={20} />
                      </div>
                      <p className="font-black text-primary">아크랩스 공식 홈페이지 방문하기</p>
                    </div>
                    <ExternalLink size={18} className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                  </a>
                </div>

                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="w-full py-4 bg-on-surface text-surface rounded-2xl font-black text-sm hover:opacity-90 transition-all shadow-lg"
                >
                  닫기
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Settings;
