import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Mail, School, User,
  MessageSquare, Loader2, RefreshCw, Copy, Check, Crown, Users,
  Trash2, BookOpen, GraduationCap, ClipboardList, AlertTriangle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

type Request = {
  id: string;
  name: string;
  email: string;
  school_name: string;
  role: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
};

type ClassRow = {
  id: string;
  name: string;
  subject: string | null;
  teacher_id: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
  _studentCount?: number;
};

type StudentRow = {
  id: string;
  full_name: string;
  student_number: number | null;
  class_id: string;
  created_at: string;
  classes: { name: string; subject: string | null } | null;
};

type ObsStatus = 'pending' | 'approved' | 'rejected';
type ObservationRow = {
  id: string;
  content: string;
  activity_name: string;
  status: ObsStatus;
  created_at: string;
  student_id: string;
  teacher_id: string;
  students: { full_name: string } | null;
  profiles: { full_name: string } | null;
};

type DeleteTarget = { table: string; id: string; label: string } | null;
type ActiveTab = 'requests' | 'users' | 'classes' | 'students' | 'observations';

// ── Constants ─────────────────────────────────────────────────────────────────

const statusConfig = {
  pending:  { label: '검토 대기', color: 'bg-amber-100 text-amber-700',   icon: Clock },
  approved: { label: '승인됨',   color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: '거절됨',   color: 'bg-red-100 text-red-600',         icon: XCircle },
};

const PLAN_OPTIONS = [
  { value: 'free',   label: '무료',   color: 'bg-gray-100 text-gray-600' },
  { value: 'pro',    label: 'Pro',    color: 'bg-amber-100 text-amber-700' },
  { value: 'school', label: 'School', color: 'bg-violet-100 text-violet-700' },
  { value: 'admin',  label: '관리자', color: 'bg-emerald-100 text-emerald-700' },
];

const OBS_STATUS: Record<ObsStatus, { label: string; color: string }> = {
  pending:  { label: '대기',   color: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인',   color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려',   color: 'bg-red-100 text-red-600' },
};

const TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'requests',     label: '사용 신청',     icon: ShieldCheck },
  { id: 'users',        label: '사용자·플랜',   icon: Users },
  { id: 'classes',      label: '학급 관리',     icon: BookOpen },
  { id: 'students',     label: '학생 관리',     icon: GraduationCap },
  { id: 'observations', label: '관찰기록',       icon: ClipboardList },
];

// ── Main Component ─────────────────────────────────────────────────────────────

const Admin = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── 사용 신청 ───────────────────────────────────────────────────────────────
  const [requests, setRequests]         = useState<Request[]>([]);
  const [reqFilter, setReqFilter]       = useState<Filter>('all');
  const [reqLoading, setReqLoading]     = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteInputs, setNoteInputs]     = useState<Record<string, string>>({});
  const [copiedId, setCopiedId]         = useState<string | null>(null);

  // ── 사용자·플랜 ─────────────────────────────────────────────────────────────
  const [users, setUsers]               = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);

  // ── 학급 ────────────────────────────────────────────────────────────────────
  const [classes, setClasses]           = useState<ClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // ── 학생 ────────────────────────────────────────────────────────────────────
  const [students, setStudents]         = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [classFilterId, setClassFilterId] = useState('all');

  // ── 관찰기록 ────────────────────────────────────────────────────────────────
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [obsLoading, setObsLoading]     = useState(false);
  const [obsFilter, setObsFilter]       = useState<'all' | ObsStatus>('all');

  // ── 공통 ────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState<ActiveTab>('requests');
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Auth Guard ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) navigate('/dashboard');
  }, [authLoading, profile, navigate]);

  // ── Tab 전환 시 데이터 로드 ─────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'requests')     fetchRequests();
    if (activeTab === 'users')        fetchUsers();
    if (activeTab === 'classes')      fetchClasses();
    if (activeTab === 'students')     fetchStudents();
    if (activeTab === 'observations') fetchObservations();
  }, [activeTab]);

  // ── Fetch Functions ─────────────────────────────────────────────────────────

  const fetchRequests = async () => {
    setReqLoading(true);
    const { data } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
    setReqLoading(false);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, plan, school_name, is_admin, ai_daily_count, ai_daily_date')
      .order('created_at', { ascending: false });
    if (data) setUsers(data);
    setUsersLoading(false);
  };

  const fetchClasses = async () => {
    setClassesLoading(true);

    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, subject, teacher_id, created_at')
      .order('created_at', { ascending: false });

    if (!classData) { setClassesLoading(false); return; }

    const teacherIds = [...new Set(classData.map(c => c.teacher_id))];
    const { data: teacherData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', teacherIds);
    const teacherMap = Object.fromEntries((teacherData || []).map(t => [t.id, t]));

    const { data: stuData } = await supabase.from('students').select('class_id');
    const countMap: Record<string, number> = {};
    (stuData || []).forEach(s => { countMap[s.class_id] = (countMap[s.class_id] || 0) + 1; });

    setClasses(classData.map(c => ({
      ...c,
      profiles: teacherMap[c.teacher_id] ?? null,
      _studentCount: countMap[c.id] || 0,
    })));
    setClassesLoading(false);
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    const { data: stuData } = await supabase
      .from('students')
      .select('id, full_name, student_number, class_id, created_at')
      .order('student_number', { ascending: true });

    if (!stuData) { setStudentsLoading(false); return; }

    const classIds = [...new Set(stuData.map(s => s.class_id))];
    const { data: classData } = await supabase
      .from('classes')
      .select('id, name, subject')
      .in('id', classIds);
    const classMap = Object.fromEntries((classData || []).map(c => [c.id, c]));

    setStudents(stuData.map(s => ({
      ...s,
      classes: classMap[s.class_id] ?? null,
    })));
    setStudentsLoading(false);
  };

  const fetchObservations = async () => {
    setObsLoading(true);
    const { data: obsData } = await supabase
      .from('observations')
      .select('id, content, activity_name, status, created_at, student_id, teacher_id')
      .order('created_at', { ascending: false });

    if (!obsData) { setObsLoading(false); return; }

    const studentIds = [...new Set(obsData.map(o => o.student_id))];
    const teacherIds = [...new Set(obsData.map(o => o.teacher_id))];

    const [{ data: stuData }, { data: profData }] = await Promise.all([
      supabase.from('students').select('id, full_name').in('id', studentIds),
      supabase.from('profiles').select('id, full_name').in('id', teacherIds),
    ]);
    const stuMap  = Object.fromEntries((stuData  || []).map(s => [s.id, s]));
    const profMap = Object.fromEntries((profData || []).map(p => [p.id, p]));

    setObservations(obsData.map(o => ({
      ...o,
      students: stuMap[o.student_id]  ?? null,
      profiles: profMap[o.teacher_id] ?? null,
    })));
    setObsLoading(false);
  };

  // ── Actions ─────────────────────────────────────────────────────────────────

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id + status);
    const { error } = await supabase
      .from('access_requests')
      .update({ status, admin_note: noteInputs[id] || null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) setRequests(prev => prev.map(r => r.id === id ? { ...r, status, admin_note: noteInputs[id] || null } : r));
    setActionLoading(null);
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    setPlanUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ plan, is_admin: plan === 'admin' })
      .eq('id', userId);
    if (!error) setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan, is_admin: plan === 'admin' } : u));
    setPlanUpdating(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
    if (!error) {
      if (deleteTarget.table === 'classes')      setClasses(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (deleteTarget.table === 'students')     setStudents(prev => prev.filter(r => r.id !== deleteTarget.id));
      if (deleteTarget.table === 'observations') setObservations(prev => prev.filter(r => r.id !== deleteTarget.id));
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const copyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const refresh = () => {
    if (activeTab === 'requests')     fetchRequests();
    if (activeTab === 'users')        fetchUsers();
    if (activeTab === 'classes')      fetchClasses();
    if (activeTab === 'students')     fetchStudents();
    if (activeTab === 'observations') fetchObservations();
  };

  // ── Derived Data ────────────────────────────────────────────────────────────

  const filteredRequests = reqFilter === 'all' ? requests : requests.filter(r => r.status === reqFilter);
  const reqCounts = {
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const classOptions = [{ id: 'all', name: '전체 학급' }, ...classes.map(c => ({ id: c.id, name: c.name }))];
  const filteredStudents = classFilterId === 'all' ? students : students.filter(s => s.class_id === classFilterId);
  const filteredObs = obsFilter === 'all' ? observations : observations.filter(o => o.status === obsFilter);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#FFFBF5] font-pretendard">

      {/* Header */}
      <div className="bg-white border-b border-amber-100">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-black text-amber-900">관리자 패널</h1>
              <p className="text-xs text-amber-600/60">사용 신청 · 플랜 관리 · 전체 데이터 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={refresh}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors"
            >
              <RefreshCw size={14} /> 새로고침
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors"
            >
              대시보드로
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-5xl mx-auto px-6 pb-0 flex gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-amber-400 hover:text-amber-600'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-500" />
              </div>
              <div>
                <p className="font-black text-sm">정말 삭제할까요?</p>
                <p className="text-xs text-gray-500 mt-0.5">이 작업은 되돌릴 수 없습니다</p>
              </div>
            </div>
            <div className="p-3 bg-red-50 rounded-xl mb-5">
              <p className="text-sm font-bold text-red-700">{deleteTarget.label}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                삭제
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── Tab: 사용 신청 ── */}
        {activeTab === 'requests' && (
          <>
            <div className="flex gap-2 mb-6">
              {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setReqFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    reqFilter === f
                      ? 'bg-amber-500 text-white shadow-md'
                      : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                  }`}
                >
                  {f === 'all' ? '전체' : statusConfig[f].label}
                  <span className={`ml-2 text-xs ${reqFilter === f ? 'text-amber-100' : 'text-amber-400'}`}>
                    {reqCounts[f]}
                  </span>
                </button>
              ))}
            </div>

            {reqLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : filteredRequests.length === 0 ? (
              <div className="text-center py-20 text-amber-400">
                <ShieldCheck size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">신청 내역이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRequests.map((req, i) => {
                  const sc = statusConfig[req.status];
                  const StatusIcon = sc.icon;
                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm"
                    >
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.color}`}>
                              <StatusIcon size={12} /> {sc.label}
                            </span>
                            <span className="text-xs text-amber-400">
                              {new Date(req.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex items-center gap-2 text-amber-800">
                              <User size={14} className="text-amber-400 shrink-0" />
                              <span className="font-bold">{req.name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-amber-800">
                              <School size={14} className="text-amber-400 shrink-0" />
                              <span>{req.school_name}</span>
                            </div>
                            <div className="flex items-center gap-2 text-amber-700 col-span-2">
                              <Mail size={14} className="text-amber-400 shrink-0" />
                              <span className="font-mono text-xs">{req.email}</span>
                              <button
                                onClick={() => copyEmail(req.id, req.email)}
                                className="ml-1 p-1 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-600 transition-colors"
                              >
                                {copiedId === req.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-amber-700">
                              <ShieldCheck size={14} className="text-amber-400 shrink-0" />
                              <span className="text-xs">{req.role}</span>
                            </div>
                          </div>
                          {req.message && (
                            <div className="flex gap-2 bg-amber-50 rounded-xl p-3 text-sm text-amber-700">
                              <MessageSquare size={14} className="text-amber-400 shrink-0 mt-0.5" />
                              <p className="leading-relaxed">{req.message}</p>
                            </div>
                          )}
                          {req.admin_note && (
                            <p className="text-xs text-amber-500 italic">메모: {req.admin_note}</p>
                          )}
                        </div>

                        {req.status === 'pending' ? (
                          <div className="flex flex-col gap-3 min-w-[200px]">
                            <textarea
                              placeholder="관리자 메모 (선택)"
                              rows={2}
                              value={noteInputs[req.id] || ''}
                              onChange={e => setNoteInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 bg-amber-50"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => updateStatus(req.id, 'approved')}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                              >
                                {actionLoading === req.id + 'approved'
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <CheckCircle2 size={12} />}
                                승인
                              </button>
                              <button
                                onClick={() => updateStatus(req.id, 'rejected')}
                                disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                              >
                                {actionLoading === req.id + 'rejected'
                                  ? <Loader2 size={12} className="animate-spin" />
                                  : <XCircle size={12} />}
                                거절
                              </button>
                            </div>
                            <p className="text-xs text-amber-400 text-center">
                              승인 후 Supabase에서 초대 이메일을 발송하세요
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 min-w-[140px]">
                            <button
                              onClick={() => updateStatus(req.id, 'pending' as any)}
                              disabled={!!actionLoading}
                              className="py-2 px-4 text-xs font-bold text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors"
                            >
                              대기로 되돌리기
                            </button>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: 사용자·플랜 ── */}
        {activeTab === 'users' && (
          <>
            {usersLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : (
              <div className="space-y-3">
                {users.map(u => {
                  const todayDate = new Date().toISOString().split('T')[0];
                  const aiToday = u.ai_daily_date === todayDate ? (u.ai_daily_count ?? 0) : 0;
                  const planInfo = PLAN_OPTIONS.find(p => p.value === u.plan) ?? PLAN_OPTIONS[0];
                  return (
                    <div key={u.id} className="bg-white rounded-2xl border border-amber-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-black text-amber-900 text-sm">{u.full_name || '이름 없음'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planInfo.color}`}>{planInfo.label}</span>
                        </div>
                        <p className="text-xs text-amber-600/70 font-mono">{u.email}</p>
                        {u.school_name && <p className="text-xs text-amber-500 mt-0.5">{u.school_name}</p>}
                        {u.plan === 'free' && (
                          <p className="text-xs text-gray-400 mt-1">오늘 AI 사용: {aiToday} / 10회</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Crown size={14} className="text-amber-400 shrink-0" />
                        <select
                          value={u.plan ?? 'free'}
                          onChange={e => updateUserPlan(u.id, e.target.value)}
                          disabled={planUpdating === u.id}
                          className="text-sm font-bold border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50"
                        >
                          {PLAN_OPTIONS.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        {planUpdating === u.id && <Loader2 size={14} className="animate-spin text-amber-400" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Tab: 학급 관리 ── */}
        {activeTab === 'classes' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-amber-700 font-bold">전체 학급 {classes.length}개</p>
            </div>
            {classesLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : classes.length === 0 ? (
              <div className="text-center py-20 text-amber-400">
                <BookOpen size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">생성된 학급이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classes.map((cls, i) => (
                  <motion.div
                    key={cls.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-2xl border border-amber-100 p-5 flex items-center gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                      <BookOpen size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-black text-amber-900 text-sm">{cls.name}</span>
                        {cls.subject && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                            {cls.subject}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-amber-500">
                        <span className="flex items-center gap-1">
                          <User size={11} /> {cls.profiles?.full_name ?? '교사 미확인'}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users size={11} /> 학생 {cls._studentCount}명
                        </span>
                        <span>{new Date(cls.created_at).toLocaleDateString('ko-KR')}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget({ table: 'classes', id: cls.id, label: `학급: ${cls.name} (학생 ${cls._studentCount}명 포함)` })}
                      className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="학급 삭제"
                    >
                      <Trash2 size={16} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Tab: 학생 관리 ── */}
        {activeTab === 'students' && (
          <>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">
                전체 학생 {students.length}명
                {classFilterId !== 'all' && ` → 필터: ${filteredStudents.length}명`}
              </p>
              <select
                value={classFilterId}
                onChange={e => setClassFilterId(e.target.value)}
                className="text-sm font-bold border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {classOptions.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {studentsLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-20 text-amber-400">
                <GraduationCap size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">학생이 없습니다</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-amber-50 border-b border-amber-100">
                      <th className="text-left px-5 py-3 text-xs font-black text-amber-700">번호</th>
                      <th className="text-left px-5 py-3 text-xs font-black text-amber-700">이름</th>
                      <th className="text-left px-5 py-3 text-xs font-black text-amber-700">학급</th>
                      <th className="text-left px-5 py-3 text-xs font-black text-amber-700">과목</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStudents.map((stu, i) => (
                      <motion.tr
                        key={stu.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b border-amber-50 last:border-0 hover:bg-amber-50/40 transition-colors"
                      >
                        <td className="px-5 py-3 text-amber-500 font-mono text-xs">
                          {stu.student_number ?? '—'}
                        </td>
                        <td className="px-5 py-3 font-bold text-amber-900">{stu.full_name}</td>
                        <td className="px-5 py-3 text-amber-600">{stu.classes?.name ?? '—'}</td>
                        <td className="px-5 py-3 text-amber-500 text-xs">{stu.classes?.subject ?? '—'}</td>
                        <td className="px-5 py-3 text-right">
                          <button
                            onClick={() => setDeleteTarget({ table: 'students', id: stu.id, label: `학생: ${stu.full_name} (${stu.classes?.name ?? '학급 미상'})` })}
                            className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* ── Tab: 관찰기록 ── */}
        {activeTab === 'observations' && (
          <>
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">
                전체 관찰기록 {observations.length}건
                {obsFilter !== 'all' && ` → 필터: ${filteredObs.length}건`}
              </p>
              <div className="flex gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setObsFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      obsFilter === f
                        ? 'bg-amber-500 text-white'
                        : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
                    }`}
                  >
                    {f === 'all' ? '전체' : OBS_STATUS[f].label}
                  </button>
                ))}
              </div>
            </div>

            {obsLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : filteredObs.length === 0 ? (
              <div className="text-center py-20 text-amber-400">
                <ClipboardList size={40} className="mx-auto mb-3 opacity-40" />
                <p className="font-medium">관찰기록이 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredObs.map((obs, i) => {
                  const sc = OBS_STATUS[obs.status];
                  return (
                    <motion.div
                      key={obs.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="bg-white rounded-2xl border border-amber-100 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black text-amber-900 text-sm">
                              {obs.students?.full_name ?? '학생 미확인'}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sc.color}`}>
                              {sc.label}
                            </span>
                            <span className="text-[10px] text-amber-400 bg-amber-50 px-2 py-0.5 rounded-full">
                              {obs.activity_name}
                            </span>
                          </div>
                          <p className="text-xs text-amber-600 leading-relaxed line-clamp-2">{obs.content}</p>
                          <div className="flex items-center gap-3 text-[11px] text-amber-400">
                            <span>작성: {obs.profiles?.full_name ?? '교사 미확인'}</span>
                            <span>{new Date(obs.created_at).toLocaleDateString('ko-KR')}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => setDeleteTarget({
                            table: 'observations',
                            id: obs.id,
                            label: `관찰기록: ${obs.students?.full_name ?? '학생'} — ${obs.activity_name}`,
                          })}
                          className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
};

export default Admin;
