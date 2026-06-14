import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, Mail, School, User,
  MessageSquare, Loader2, RefreshCw, Copy, Check, Crown, Users,
  Trash2, BookOpen, GraduationCap, ClipboardList, AlertTriangle,
  BarChart3, FileCheck, Megaphone, Bell, Download, Plus, Send,
  TrendingUp, Zap, Bug, Ticket, Calendar, ToggleLeft, ToggleRight,
  Shuffle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type ActiveTab =
  | 'dashboard' | 'requests' | 'users' | 'classes'
  | 'students' | 'observations' | 'results' | 'suggestions' | 'announcements' | 'bugs' | 'coupons';

type ReqFilter = 'all' | 'pending' | 'approved' | 'rejected';
type ObsFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface Request {
  id: string; name: string; email: string; school_name: string;
  role: string; message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null; created_at: string;
}
interface ClassRow {
  id: string; name: string; subject: string | null;
  teacher_id: string; created_at: string;
  profiles: { full_name: string; email: string } | null;
  _studentCount?: number;
}
interface StudentRow {
  id: string; full_name: string; student_number: number | null;
  class_id: string; created_at: string;
  classes: { name: string; subject: string | null } | null;
}
interface ObservationRow {
  id: string; content: string; activity_name: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string; student_id: string; teacher_id: string;
  students: { full_name: string } | null;
  profiles: { full_name: string } | null;
}
interface ResultRow {
  id: string; student_id: string; week_number: number | null;
  status: string | null; created_at: string;
  teacher_feedback: string | null; rejection_feedback: string | null;
  students: { full_name: string } | null;
}
interface SuggestionRow {
  id: string; student_id: string; content: string;
  student_name: string | null; teacher_reply: string | null;
  replied_at: string | null; created_at: string; class_id: string;
}
interface AnnouncementRow {
  id: string; title: string; content: string; created_at: string;
}
interface CouponRow {
  id: string; code: string; duration_days: number;
  max_uses: number; used_count: number;
  expires_at: string | null; is_active: boolean;
  note: string | null; created_at: string;
}

interface DashboardStats {
  users: number; classes: number; students: number;
  observations: number; results: number; pendingSuggestions: number;
  pendingRequests: number;
  aiRanking: { full_name: string | null; email: string | null; ai_daily_count: number }[];
}
type DeleteTarget = { table: string; id: string; label: string } | null;

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  pending:  { label: '검토 대기', color: 'bg-amber-100 text-amber-700',    icon: Clock },
  approved: { label: '승인됨',    color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: '거절됨',    color: 'bg-red-100 text-red-600',          icon: XCircle },
};
const PLAN_OPTIONS = [
  { value: 'free',   label: '무료',   color: 'bg-gray-100 text-gray-600' },
  { value: 'basic',  label: 'Basic',  color: 'bg-blue-100 text-blue-700' },
  { value: 'pro',    label: 'Pro',    color: 'bg-amber-100 text-amber-700' },
  { value: 'admin',  label: '관리자', color: 'bg-emerald-100 text-emerald-700' },
];
const PLAN_OPTIONS_ALL = [
  ...PLAN_OPTIONS,
  { value: 'school', label: 'School', color: 'bg-violet-100 text-violet-700' },
];
const OBS_STATUS: Record<string, { label: string; color: string }> = {
  pending:  { label: '대기', color: 'bg-amber-100 text-amber-700' },
  approved: { label: '승인', color: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', color: 'bg-red-100 text-red-600' },
};
const TABS: { id: ActiveTab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard',     label: '현황',      icon: BarChart3 },
  { id: 'requests',      label: '사용 신청',  icon: ShieldCheck },
  { id: 'users',         label: '사용자',     icon: Users },
  { id: 'classes',       label: '학급',       icon: BookOpen },
  { id: 'students',      label: '학생',       icon: GraduationCap },
  { id: 'observations',  label: '활동 기록',  icon: ClipboardList },
  { id: 'results',       label: '결과제출',   icon: FileCheck },
  { id: 'suggestions',   label: '건의사항',   icon: Megaphone },
  { id: 'announcements', label: '공지사항',   icon: Bell },
  { id: 'bugs',          label: '버그신고',   icon: Bug },
  { id: 'coupons',       label: '쿠폰',       icon: Ticket },
];

// ── CSV Helper ─────────────────────────────────────────────────────────────────

const downloadCSV = (data: any[], filename: string) => {
  if (!data.length) { alert('내보낼 데이터가 없습니다.'); return; }
  const headers = Object.keys(data[0]);
  const rows = data.map(row =>
    headers.map(h => {
      const v = row[h] ?? '';
      return typeof v === 'string' && v.includes(',') ? `"${v}"` : String(v);
    }).join(',')
  );
  const csv = '﻿' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color }: {
  label: string; value: number | string; icon: React.ElementType; color: string;
}) => (
  <div className={`rounded-2xl p-5 border ${color} flex items-center gap-4`}>
    <div className="w-10 h-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
      <Icon size={20} />
    </div>
    <div>
      <p className="text-xs font-bold opacity-70 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

const Admin = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // ── 탭 ─────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');

  // ── 대시보드 ───────────────────────────────────────────────────────────────
  const [dashStats, setDashStats]     = useState<DashboardStats | null>(null);
  const [dashLoading, setDashLoading] = useState(false);

  // ── 사용 신청 ──────────────────────────────────────────────────────────────
  const [requests, setRequests]         = useState<Request[]>([]);
  const [reqFilter, setReqFilter]       = useState<ReqFilter>('all');
  const [reqLoading, setReqLoading]     = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteInputs, setNoteInputs]     = useState<Record<string, string>>({});
  const [planSelects, setPlanSelects]   = useState<Record<string, string>>({});
  const [copiedId, setCopiedId]         = useState<string | null>(null);
  const [reqPage, setReqPage]           = useState(1);

  // 승인 진행 상태 오버레이
  const [approvalProgress, setApprovalProgress] = useState<{
    step: 'db' | 'email' | 'done' | 'error'; name: string; email: string; message?: string;
  } | null>(null);

  // ── 사용자 ─────────────────────────────────────────────────────────────────
  const [users, setUsers]               = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);

  // ── 학급 ───────────────────────────────────────────────────────────────────
  const [classes, setClasses]           = useState<ClassRow[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // ── 학생 ───────────────────────────────────────────────────────────────────
  const [students, setStudents]         = useState<StudentRow[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [classFilterId, setClassFilterId] = useState('all');

  // ── 관찰기록 ────────────────────────────────────────────────────────────────
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [obsLoading, setObsLoading]     = useState(false);
  const [obsFilter, setObsFilter]       = useState<ObsFilter>('all');

  // ── 결과제출 ────────────────────────────────────────────────────────────────
  const [results, setResults]           = useState<ResultRow[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [resStatusFilter, setResStatusFilter] = useState('all');

  // ── 건의사항 ────────────────────────────────────────────────────────────────
  const [suggestions, setSuggestions]   = useState<SuggestionRow[]>([]);
  const [sugLoading, setSugLoading]     = useState(false);
  const [sugFilter, setSugFilter]       = useState<'all' | 'pending' | 'replied'>('all');

  // ── 공지사항 ────────────────────────────────────────────────────────────────
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [annLoading, setAnnLoading]       = useState(false);
  const [annTitle, setAnnTitle]           = useState('');
  const [annContent, setAnnContent]       = useState('');
  const [annSaving, setAnnSaving]         = useState(false);

  // ── 사용자 삭제 ─────────────────────────────────────────────────────────────
  const [userDeleteConfirm, setUserDeleteConfirm] = useState<string | null>(null);
  const [userDeleting, setUserDeleting]           = useState<string | null>(null);

  // ── 버그신고 ────────────────────────────────────────────────────────────────
  const [bugs, setBugs]               = useState<any[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);

  // ── 쿠폰 ────────────────────────────────────────────────────────────────────
  const [coupons, setCoupons]             = useState<CouponRow[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponForm, setCouponForm]       = useState({
    code: '', duration_days: 30, max_uses: 0, expires_at: '', note: '',
  });
  const [couponSaving, setCouponSaving]   = useState(false);
  const [couponMsg, setCouponMsg]         = useState<string | null>(null);
  const [betaSetting, setBetaSetting]     = useState<{ userId: string; days: number } | null>(null);
  const [betaLoading, setBetaLoading]     = useState<string | null>(null);
  const [couponSend, setCouponSend]       = useState<{ userId: string; email: string; name: string } | null>(null);
  const [couponSendCode, setCouponSendCode] = useState('');
  const [couponSending, setCouponSending] = useState(false);
  const [couponSendMsg, setCouponSendMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── 공통 삭제 ──────────────────────────────────────────────────────────────
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting]         = useState(false);

  // ── Auth Guard ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authLoading && (!profile || !profile.is_admin)) navigate('/dashboard');
  }, [authLoading, profile, navigate]);

  // ── 탭 전환 시 로드 ────────────────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'dashboard')     fetchDashboard();
    if (activeTab === 'requests')      fetchRequests();
    if (activeTab === 'users')         fetchUsers();
    if (activeTab === 'classes')       fetchClasses();
    if (activeTab === 'students')      fetchStudents();
    if (activeTab === 'observations')  fetchObservations();
    if (activeTab === 'results')       fetchResults();
    if (activeTab === 'suggestions')   fetchSuggestions();
    if (activeTab === 'announcements') fetchAnnouncements();
    if (activeTab === 'bugs')          fetchBugs();
    if (activeTab === 'coupons')       fetchCoupons();
  }, [activeTab]);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchDashboard = async () => {
    setDashLoading(true);
    const [u, cl, st, ob, re, sg, rq] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('observations').select('id', { count: 'exact', head: true }),
      supabase.from('student_results').select('id', { count: 'exact', head: true }),
      supabase.from('student_suggestions').select('id', { count: 'exact', head: true }).is('teacher_reply', null),
      supabase.from('access_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    const { data: aiRanking } = await supabase
      .from('profiles')
      .select('full_name, email, ai_daily_count')
      .order('ai_daily_count', { ascending: false })
      .limit(10);

    setDashStats({
      users:            u.count ?? 0,
      classes:          cl.count ?? 0,
      students:         st.count ?? 0,
      observations:     ob.count ?? 0,
      results:          re.count ?? 0,
      pendingSuggestions: sg.count ?? 0,
      pendingRequests:  rq.count ?? 0,
      aiRanking:        (aiRanking || []).filter(r => (r.ai_daily_count ?? 0) > 0),
    });
    setDashLoading(false);
  };

  const fetchRequests = async () => {
    setReqLoading(true);
    const { data } = await supabase.from('access_requests').select('*').order('created_at', { ascending: false });
    if (data) setRequests(data);
    setReqLoading(false);
  };

  const fetchUsers = async () => {
    setUsersLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, plan, school_name, is_admin, ai_daily_count, ai_daily_date, beta_expires_at')
      .order('full_name', { ascending: true });
    if (error) console.error('[fetchUsers]', error.message);
    if (data) setUsers(data);
    setUsersLoading(false);
  };

  const fetchCoupons = async () => {
    setCouponsLoading(true);
    const { data } = await supabase
      .from('beta_coupons')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCoupons(data);
    setCouponsLoading(false);
  };

  const generateCouponCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setCouponForm(f => ({ ...f, code }));
  };

  const createCoupon = async () => {
    if (!couponForm.code.trim()) { setCouponMsg('코드를 입력하세요.'); return; }
    setCouponSaving(true);
    setCouponMsg(null);
    const { error } = await supabase.from('beta_coupons').insert({
      code:          couponForm.code.trim().toUpperCase(),
      duration_days: couponForm.duration_days,
      max_uses:      couponForm.max_uses,
      expires_at:    couponForm.expires_at || null,
      note:          couponForm.note || null,
      created_by:    profile?.id,
    });
    if (error) {
      setCouponMsg(error.code === '23505' ? '이미 존재하는 코드입니다.' : error.message);
    } else {
      setCouponForm({ code: '', duration_days: 30, max_uses: 0, expires_at: '', note: '' });
      await fetchCoupons();
    }
    setCouponSaving(false);
  };

  const toggleCoupon = async (id: string, isActive: boolean) => {
    await supabase.from('beta_coupons').update({ is_active: !isActive }).eq('id', id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !isActive } : c));
  };

  const deleteCoupon = async (id: string) => {
    await supabase.from('beta_coupons').delete().eq('id', id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  const setBetaForUser = async (userId: string, days: number) => {
    setBetaLoading(userId);
    const { data } = await supabase.rpc('admin_set_beta', { p_user_id: userId, p_days: days });
    if (data?.success) {
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, beta_expires_at: data.expires_at } : u
      ));
      if (days > 0) {
        const expDate = new Date(data.expires_at).toLocaleDateString('ko-KR');
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `🎉 Pro 체험 액세스가 부여되었습니다!`,
          content: `${days}일간 Pro 기능을 모두 사용하실 수 있습니다. (${expDate}까지)`,
          type: 'beta_granted',
          link: '/settings',
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: `Pro 체험이 종료되었습니다`,
          content: `베타 액세스가 관리자에 의해 해제되었습니다.`,
          type: 'beta_revoked',
          link: '/settings',
        });
      }
    }
    setBetaLoading(null);
    setBetaSetting(null);
  };

  const sendCouponEmail = async () => {
    if (!couponSend || !couponSendCode) return;
    setCouponSending(true);
    setCouponSendMsg(null);
    const coupon = coupons.find(c => c.code === couponSendCode);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      const res = await fetch('/api/send-coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          to_email:      couponSend.email,
          to_name:       couponSend.name,
          coupon_code:   couponSendCode,
          duration_days: coupon?.duration_days ?? 30,
        }),
      });
      if (res.ok) {
        setCouponSendMsg({ type: 'ok', text: `${couponSend.email} 로 쿠폰 이메일을 발송했습니다.` });
        setTimeout(() => { setCouponSend(null); setCouponSendMsg(null); setCouponSendCode(''); }, 2500);
      } else {
        const d = await res.json();
        setCouponSendMsg({ type: 'err', text: d.error ?? '발송 실패' });
      }
    } catch {
      setCouponSendMsg({ type: 'err', text: '네트워크 오류' });
    }
    setCouponSending(false);
  };

  const fetchClasses = async () => {
    setClassesLoading(true);
    const { data: classData } = await supabase
      .from('classes').select('id, name, subject, teacher_id, created_at')
      .order('created_at', { ascending: false });
    if (!classData) { setClassesLoading(false); return; }

    const tids = [...new Set(classData.map(c => c.teacher_id))];
    const { data: tData } = await supabase.from('profiles').select('id, full_name, email').in('id', tids);
    const tMap = Object.fromEntries((tData || []).map(t => [t.id, t]));

    const { data: stuData } = await supabase.from('students').select('class_id');
    const cntMap: Record<string, number> = {};
    (stuData || []).forEach(s => { cntMap[s.class_id] = (cntMap[s.class_id] || 0) + 1; });

    setClasses(classData.map(c => ({
      ...c, profiles: tMap[c.teacher_id] ?? null, _studentCount: cntMap[c.id] || 0,
    })));
    setClassesLoading(false);
  };

  const fetchStudents = async () => {
    setStudentsLoading(true);
    const { data: sData } = await supabase.from('students')
      .select('id, full_name, student_number, class_id, created_at')
      .order('student_number', { ascending: true });
    if (!sData) { setStudentsLoading(false); return; }

    const cids = [...new Set(sData.map(s => s.class_id))];
    const { data: cData } = await supabase.from('classes').select('id, name, subject').in('id', cids);
    const cMap = Object.fromEntries((cData || []).map(c => [c.id, c]));
    setStudents(sData.map(s => ({ ...s, classes: cMap[s.class_id] ?? null })));
    setStudentsLoading(false);
  };

  const fetchObservations = async () => {
    setObsLoading(true);
    const { data: obsData } = await supabase.from('observations')
      .select('id, content, activity_name, status, created_at, student_id, teacher_id')
      .order('created_at', { ascending: false });
    if (!obsData) { setObsLoading(false); return; }

    const sids = [...new Set(obsData.map(o => o.student_id))];
    const pids = [...new Set(obsData.map(o => o.teacher_id))];
    const [{ data: sD }, { data: pD }] = await Promise.all([
      supabase.from('students').select('id, full_name').in('id', sids),
      supabase.from('profiles').select('id, full_name').in('id', pids),
    ]);
    const sMap = Object.fromEntries((sD || []).map(s => [s.id, s]));
    const pMap = Object.fromEntries((pD || []).map(p => [p.id, p]));
    setObservations(obsData.map(o => ({
      ...o, students: sMap[o.student_id] ?? null, profiles: pMap[o.teacher_id] ?? null,
    })));
    setObsLoading(false);
  };

  const fetchResults = async () => {
    setResultsLoading(true);
    const { data: rData } = await supabase.from('student_results')
      .select('id, student_id, week_number, status, created_at, teacher_feedback, rejection_feedback')
      .order('created_at', { ascending: false });
    if (!rData) { setResultsLoading(false); return; }

    const sids = [...new Set(rData.map(r => r.student_id))];
    const { data: sD } = await supabase.from('students').select('id, full_name').in('id', sids);
    const sMap = Object.fromEntries((sD || []).map(s => [s.id, s]));
    setResults(rData.map(r => ({ ...r, students: sMap[r.student_id] ?? null })));
    setResultsLoading(false);
  };

  const fetchSuggestions = async () => {
    setSugLoading(true);
    const { data } = await supabase.from('student_suggestions')
      .select('id, student_id, content, student_name, teacher_reply, replied_at, created_at, class_id')
      .order('created_at', { ascending: false });
    if (data) setSuggestions(data);
    setSugLoading(false);
  };

  const fetchAnnouncements = async () => {
    setAnnLoading(true);
    const { data } = await supabase.from('announcements')
      .select('id, title, content, created_at')
      .order('created_at', { ascending: false });
    if (data) setAnnouncements(data);
    setAnnLoading(false);
  };

  const fetchBugs = async () => {
    setBugsLoading(true);
    const { data } = await supabase.from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setBugs(data);
    setBugsLoading(false);
  };

  const deleteUser = async (userId: string) => {
    setUserDeleting(userId);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(`삭제 실패: ${data.error}`);
        return;
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setUserDeleting(null);
      setUserDeleteConfirm(null);
    }
  };

  const updateBugStatus = async (id: string, status: string) => {
    await supabase.from('bug_reports').update({ status }).eq('id', id);
    setBugs(prev => prev.map(b => b.id === id ? { ...b, status } : b));
  };

  // ── Actions ────────────────────────────────────────────────────────────────

  const refresh = () => {
    if (activeTab === 'dashboard')     fetchDashboard();
    if (activeTab === 'requests')      fetchRequests();
    if (activeTab === 'users')         fetchUsers();
    if (activeTab === 'classes')       fetchClasses();
    if (activeTab === 'students')      fetchStudents();
    if (activeTab === 'observations')  fetchObservations();
    if (activeTab === 'results')       fetchResults();
    if (activeTab === 'suggestions')   fetchSuggestions();
    if (activeTab === 'announcements') fetchAnnouncements();
  };

  const deleteRequest = async (id: string) => {
    if (!window.confirm('이 신청 내역을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('access_requests').delete().eq('id', id);
    if (!error) setRequests(prev => prev.filter(r => r.id !== id));
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected', plan?: string) => {
    setActionLoading(id + status);
    const req = requests.find(r => r.id === id);

    if (status === 'approved' && req) {
      setApprovalProgress({ step: 'db', name: req.name, email: req.email });
    }

    const { error } = await supabase.from('access_requests')
      .update({ status, admin_note: noteInputs[id] || null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status, admin_note: noteInputs[id] || null } : r));

      // 프로필 is_approved 동기화
      if (req) {
        const isApproved = status === 'approved';
        await supabase.from('profiles')
          .update({ is_approved: isApproved })
          .eq('email', req.email);
      }

      if (status === 'approved' && req) {
        setApprovalProgress({ step: 'email', name: req.name, email: req.email });
        try {
          const res = await fetch('/api/invite-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: req.email, name: req.name, plan: plan || 'free' }),
          });
          const resData = await res.json();
          if (!res.ok) {
            setApprovalProgress({
              step: 'error', name: req.name, email: req.email,
              message: `이메일 발송 실패: ${resData.error}`,
            });
          } else {
            setApprovalProgress({
              step: 'done', name: req.name, email: req.email,
              message: resData.type === 'reset' ? '(기존 계정 — 비밀번호 재설정 이메일 발송)' : undefined,
            });
            setTimeout(() => setApprovalProgress(null), 4000);
          }
        } catch {
          setApprovalProgress({
            step: 'error', name: req.name, email: req.email,
            message: '네트워크 오류로 이메일 발송 실패. 수동 처리 필요.',
          });
        }
      }
    } else if (error && status === 'approved' && req) {
      setApprovalProgress({ step: 'error', name: req.name, email: req.email, message: 'DB 업데이트 실패' });
    }

    setActionLoading(null);
  };

  const updateUserPlan = async (userId: string, plan: string) => {
    setPlanUpdating(userId);
    const { data, error } = await supabase.rpc('admin_update_plan', {
      p_user_id: userId,
      p_plan: plan,
    });
    if (error) {
      alert(`플랜 변경 실패: ${error.message}`);
    } else if (data?.error) {
      alert(`플랜 변경 실패: ${data.error}`);
    } else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan, is_admin: plan === 'admin' } : u));
    }
    setPlanUpdating(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await supabase.from(deleteTarget.table).delete().eq('id', deleteTarget.id);
    if (deleteTarget.table === 'classes')            setClasses(p => p.filter(r => r.id !== deleteTarget.id));
    if (deleteTarget.table === 'students')           setStudents(p => p.filter(r => r.id !== deleteTarget.id));
    if (deleteTarget.table === 'observations')       setObservations(p => p.filter(r => r.id !== deleteTarget.id));
    if (deleteTarget.table === 'student_results')    setResults(p => p.filter(r => r.id !== deleteTarget.id));
    if (deleteTarget.table === 'student_suggestions') setSuggestions(p => p.filter(r => r.id !== deleteTarget.id));
    if (deleteTarget.table === 'announcements')      setAnnouncements(p => p.filter(r => r.id !== deleteTarget.id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  const createAnnouncement = async () => {
    if (!annTitle.trim() || !annContent.trim()) return;
    setAnnSaving(true);
    const title   = annTitle.trim();
    const content = annContent.trim();

    const { data, error } = await supabase.from('announcements')
      .insert({ title, content })
      .select().single();

    if (!error && data) {
      setAnnouncements(prev => [data, ...prev]);
      setAnnTitle(''); setAnnContent('');

      // Slack 알림 발송 (실패해도 공지 저장은 성공으로 처리)
      fetch('/api/slack-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      }).catch(() => {});
    } else {
      alert('공지사항 저장 실패. announcements 테이블이 생성되어 있는지 확인해주세요.');
    }
    setAnnSaving(false);
  };

  const copyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── CSV Export ─────────────────────────────────────────────────────────────

  const exportObservations = () => downloadCSV(
    observations.map(o => ({
      학생명: o.students?.full_name ?? '미확인',
      교사명: o.profiles?.full_name ?? '미확인',
      활동명: o.activity_name,
      내용: o.content,
      상태: OBS_STATUS[o.status]?.label ?? o.status,
      날짜: new Date(o.created_at).toLocaleDateString('ko-KR'),
    })),
    `활동기록_${new Date().toISOString().slice(0, 10)}.csv`
  );

  const exportResults = () => downloadCSV(
    results.map(r => ({
      학생명: r.students?.full_name ?? '미확인',
      주차: r.week_number ?? '',
      상태: r.status ?? '',
      교사피드백: r.teacher_feedback ?? '',
      날짜: new Date(r.created_at).toLocaleDateString('ko-KR'),
    })),
    `결과제출_${new Date().toISOString().slice(0, 10)}.csv`
  );

  const exportSuggestions = () => downloadCSV(
    suggestions.map(s => ({
      학생명: s.student_name ?? '미확인',
      내용: s.content,
      답변여부: s.teacher_reply ? '답변완료' : '미답변',
      교사답변: s.teacher_reply ?? '',
      날짜: new Date(s.created_at).toLocaleDateString('ko-KR'),
    })),
    `건의사항_${new Date().toISOString().slice(0, 10)}.csv`
  );

  // 필터 변경 시 페이지 초기화
  useEffect(() => { setReqPage(1); }, [reqFilter]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const REQ_PAGE_SIZE = 10;
  const filteredRequests = reqFilter === 'all' ? requests : requests.filter(r => r.status === reqFilter);
  const totalReqPages    = Math.ceil(filteredRequests.length / REQ_PAGE_SIZE);
  const pagedRequests    = filteredRequests.slice((reqPage - 1) * REQ_PAGE_SIZE, reqPage * REQ_PAGE_SIZE);
  const reqCounts = {
    all: requests.length,
    pending:  requests.filter(r => r.status === 'pending').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };
  const classOptions = [{ id: 'all', name: '전체 학급' }, ...classes.map(c => ({ id: c.id, name: c.name }))];
  const filteredStudents = classFilterId === 'all' ? students : students.filter(s => s.class_id === classFilterId);
  const filteredObs  = obsFilter === 'all' ? observations : observations.filter(o => o.status === obsFilter);
  const filteredResults = resStatusFilter === 'all' ? results : results.filter(r => r.status === resStatusFilter);
  const filteredSuggestions = sugFilter === 'all'
    ? suggestions
    : sugFilter === 'pending'
    ? suggestions.filter(s => !s.teacher_reply)
    : suggestions.filter(s => !!s.teacher_reply);

  const resultStatuses = [...new Set(results.map(r => r.status).filter(Boolean))];

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
    <div className="min-h-screen bg-[#FFFBF5] font-pretendard">

      {/* Header */}
      <div className="bg-white border-b border-amber-100">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500 rounded-xl flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-amber-900">관리자 패널</h1>
              <p className="text-xs text-amber-600/60">전체 데이터 관리 · 통계 · 공지</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={refresh} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors">
              <RefreshCw size={14} /> 새로고침
            </button>
            <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors">
              대시보드로
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="max-w-6xl mx-auto px-6 pb-0 flex gap-0.5 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-bold border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id ? 'border-amber-500 text-amber-700' : 'border-transparent text-amber-400 hover:text-amber-600'
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
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
              <button onClick={() => setDeleteTarget(null)} disabled={deleting}
                className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50">
                취소
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} 삭제
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── 대시보드 ── */}
        {activeTab === 'dashboard' && (
          <>
            {dashLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : dashStats ? (
              <div className="space-y-8">
                {/* 통계 카드 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  <StatCard label="전체 사용자" value={dashStats.users} icon={Users} color="bg-blue-50 border-blue-100 text-blue-700" />
                  <StatCard label="전체 학급"   value={dashStats.classes} icon={BookOpen} color="bg-violet-50 border-violet-100 text-violet-700" />
                  <StatCard label="전체 학생"   value={dashStats.students} icon={GraduationCap} color="bg-emerald-50 border-emerald-100 text-emerald-700" />
                  <StatCard label="활동 기록"    value={dashStats.observations} icon={ClipboardList} color="bg-amber-50 border-amber-100 text-amber-700" />
                  <StatCard label="결과제출"     value={dashStats.results} icon={FileCheck} color="bg-cyan-50 border-cyan-100 text-cyan-700" />
                  <StatCard label="미답변 건의"  value={dashStats.pendingSuggestions} icon={Megaphone} color="bg-rose-50 border-rose-100 text-rose-700" />
                  <StatCard label="대기 신청"    value={dashStats.pendingRequests} icon={Clock} color="bg-orange-50 border-orange-100 text-orange-700" />
                </div>

                {/* AI 사용량 랭킹 */}
                <div className="bg-white rounded-2xl border border-amber-100 p-6">
                  <h3 className="text-base font-black text-amber-900 flex items-center gap-2 mb-5">
                    <TrendingUp size={18} className="text-amber-500" />
                    오늘 AI 사용량 랭킹
                  </h3>
                  {dashStats.aiRanking.length === 0 ? (
                    <p className="text-sm text-amber-400 text-center py-6">오늘 AI를 사용한 사용자가 없습니다</p>
                  ) : (
                    <div className="space-y-3">
                      {dashStats.aiRanking.map((u, i) => (
                        <div key={i} className="flex items-center gap-4">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                            i === 0 ? 'bg-amber-400 text-white' : i === 1 ? 'bg-gray-300 text-white' : i === 2 ? 'bg-amber-700 text-white' : 'bg-amber-50 text-amber-600'
                          }`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-amber-900 truncate">{u.full_name || u.email || '이름 없음'}</p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="w-24 h-2 bg-amber-100 rounded-full overflow-hidden">
                              <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min((u.ai_daily_count / (dashStats.aiRanking[0]?.ai_daily_count || 1)) * 100, 100)}%` }} />
                            </div>
                            <span className="text-xs font-black text-amber-700 w-8 text-right">{u.ai_daily_count}</span>
                            <Zap size={11} className="text-amber-400" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}

        {/* ── 사용 신청 ── */}
        {activeTab === 'requests' && (
          <>
            <div className="flex gap-2 mb-6">
              {(['all', 'pending', 'approved', 'rejected'] as ReqFilter[]).map(f => (
                <button key={f} onClick={() => setReqFilter(f)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${reqFilter === f ? 'bg-amber-500 text-white shadow-md' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}>
                  {f === 'all' ? '전체' : STATUS_CFG[f].label}
                  <span className={`ml-2 text-xs ${reqFilter === f ? 'text-amber-100' : 'text-amber-400'}`}>{reqCounts[f]}</span>
                </button>
              ))}
            </div>
            {reqLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : filteredRequests.length === 0 ? (
              <div className="text-center py-20 text-amber-400"><ShieldCheck size={40} className="mx-auto mb-3 opacity-40" /><p className="font-medium">신청 내역이 없습니다</p></div>
            ) : (
              <div className="space-y-4">
                {pagedRequests.map((req, i) => {
                  const sc = STATUS_CFG[req.status]; const StatusIcon = sc.icon;
                  return (
                    <motion.div key={req.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm">
                      <div className="flex flex-col md:flex-row md:items-start gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.color}`}><StatusIcon size={12} />{sc.label}</span>
                            <span className="text-xs text-amber-400">{new Date(req.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                            <button onClick={() => deleteRequest(req.id)} className="ml-auto p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="삭제">
                              <Trash2 size={13} />
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                            <div className="flex items-center gap-2 text-amber-800"><User size={14} className="text-amber-400 shrink-0" /><span className="font-bold">{req.name}</span></div>
                            <div className="flex items-center gap-2 text-amber-800"><School size={14} className="text-amber-400 shrink-0" /><span>{req.school_name}</span></div>
                            <div className="flex items-center gap-2 text-amber-700 col-span-2">
                              <Mail size={14} className="text-amber-400 shrink-0" /><span className="font-mono text-xs">{req.email}</span>
                              <button onClick={() => copyEmail(req.id, req.email)} className="ml-1 p-1 rounded-lg hover:bg-amber-50 text-amber-400 hover:text-amber-600 transition-colors">
                                {copiedId === req.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                              </button>
                            </div>
                          </div>
                          {req.message && <div className="flex gap-2 bg-amber-50 rounded-xl p-3 text-sm text-amber-700"><MessageSquare size={14} className="text-amber-400 shrink-0 mt-0.5" /><p className="leading-relaxed">{req.message}</p></div>}
                          {req.admin_note && <p className="text-xs text-amber-500 italic">메모: {req.admin_note}</p>}
                        </div>
                        {req.status === 'pending' ? (
                          <div className="flex flex-col gap-3 min-w-[200px]">
                            <textarea placeholder="관리자 메모 (선택)" rows={2} value={noteInputs[req.id] || ''}
                              onChange={e => setNoteInputs(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 bg-amber-50" />
                            <select
                              value={planSelects[req.id] || 'free'}
                              onChange={e => setPlanSelects(prev => ({ ...prev, [req.id]: e.target.value }))}
                              className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl focus:outline-none focus:border-amber-400 bg-amber-50 font-bold text-amber-800 cursor-pointer"
                            >
                              <option value="free">Free — 일반 선생님</option>
                              <option value="pro">Pro — 프리미엄</option>
                              <option value="school">School — 열람 전용</option>
                            </select>
                            <div className="flex gap-2">
                              <button onClick={() => updateStatus(req.id, 'approved', planSelects[req.id] || 'free')} disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                                {actionLoading === req.id + 'approved' ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} 승인
                              </button>
                              <button onClick={() => updateStatus(req.id, 'rejected')} disabled={!!actionLoading}
                                className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors">
                                {actionLoading === req.id + 'rejected' ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />} 거절
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => updateStatus(req.id, 'pending' as any)} disabled={!!actionLoading}
                            className="py-2 px-4 text-xs font-bold text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors">
                            대기로 되돌리기
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* 페이징 */}
            {totalReqPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button onClick={() => setReqPage(p => Math.max(1, p - 1))} disabled={reqPage === 1}
                  className="px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  이전
                </button>
                {Array.from({ length: totalReqPages }, (_, i) => i + 1).map(p => (
                  <button key={p} onClick={() => setReqPage(p)}
                    className={`w-9 h-9 text-sm font-bold rounded-xl transition-colors ${reqPage === p ? 'bg-amber-500 text-white shadow-md' : 'text-amber-700 border border-amber-200 hover:bg-amber-50'}`}>
                    {p}
                  </button>
                ))}
                <button onClick={() => setReqPage(p => Math.min(totalReqPages, p + 1))} disabled={reqPage === totalReqPages}
                  className="px-4 py-2 text-sm font-bold text-amber-700 border border-amber-200 rounded-xl hover:bg-amber-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  다음
                </button>
              </div>
            )}
          </>
        )}

        {/* ── 사용자·플랜 ── */}
        {activeTab === 'users' && (
          usersLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
          : <div className="space-y-3">
            {users.map(u => {
              const today = new Date().toISOString().split('T')[0];
              const aiToday = u.ai_daily_date === today ? (u.ai_daily_count ?? 0) : 0;
              const planInfo = PLAN_OPTIONS_ALL.find(p => p.value === u.plan) ?? PLAN_OPTIONS_ALL[0];
              const betaActive = u.beta_expires_at && new Date(u.beta_expires_at) > new Date();
              const betaDaysLeft = betaActive
                ? Math.ceil((new Date(u.beta_expires_at).getTime() - Date.now()) / 86400000)
                : 0;
              const isSettingBeta = betaSetting?.userId === u.id;
              return (
                <div key={u.id} className={`bg-white rounded-2xl border p-5 flex flex-col gap-3 transition-all ${userDeleteConfirm === u.id ? 'border-red-300 bg-red-50/30' : 'border-amber-100'}`}>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-black text-amber-900 text-sm">{u.full_name || '이름 없음'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${planInfo.color}`}>{planInfo.label}</span>
                        {betaActive && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex items-center gap-1">
                            <Ticket size={9} /> BETA D-{betaDaysLeft}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-600/70 font-mono">{u.email}</p>
                      {u.school_name && <p className="text-xs text-amber-500 mt-0.5">{u.school_name}</p>}
                      {u.plan === 'free'  && <p className="text-xs text-gray-400 mt-1">오늘 AI 사용: {aiToday} / 10회</p>}
                      {u.plan === 'basic' && <p className="text-xs text-blue-400 mt-1">오늘 AI 사용: {aiToday} / 30회</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {u.plan === 'admin'  ? <ShieldCheck size={14} className="text-emerald-500 shrink-0" /> :
                       u.plan === 'pro'    ? <Crown size={14} className="text-amber-400 shrink-0" /> :
                       u.plan === 'school' ? <GraduationCap size={14} className="text-violet-500 shrink-0" /> :
                       u.plan === 'basic'  ? <Crown size={14} className="text-blue-400 shrink-0" /> :
                                            <User size={14} className="text-gray-400 shrink-0" />}
                      {u.plan === 'school' ? (
                        <span className="text-xs font-bold px-3 py-2 rounded-xl bg-violet-100 text-violet-600">School (레거시)</span>
                      ) : (
                        <select value={u.plan ?? 'free'} onChange={e => updateUserPlan(u.id, e.target.value)} disabled={planUpdating === u.id}
                          className="text-sm font-bold border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-amber-400 cursor-pointer disabled:opacity-50">
                          {PLAN_OPTIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                        </select>
                      )}
                      {planUpdating === u.id && <Loader2 size={14} className="animate-spin text-amber-400" />}
                      {/* 베타 부여/철수 버튼 */}
                      <button
                        onClick={() => setBetaSetting(isSettingBeta ? null : { userId: u.id, days: 30 })}
                        className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          betaActive
                            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                        title="베타 액세스 관리"
                      >
                        <Ticket size={13} />
                        {betaActive ? `D-${betaDaysLeft}` : '베타'}
                      </button>
                      {/* 쿠폰 이메일 발송 버튼 */}
                      <button
                        onClick={() => {
                          setCouponSend(couponSend?.userId === u.id ? null : { userId: u.id, email: u.email, name: u.full_name || u.email });
                          setCouponSendCode('');
                          setCouponSendMsg(null);
                        }}
                        className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-700 hover:bg-indigo-200 transition-colors"
                        title="쿠폰 이메일 발송"
                      >
                        <Ticket size={13} /> 발송
                      </button>
                      {/* 삭제 버튼 */}
                      <button
                        onClick={() => setUserDeleteConfirm(userDeleteConfirm === u.id ? null : u.id)}
                        className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        title="회원 탈퇴 처리"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* 베타 부여/철수 인라인 패널 */}
                  <AnimatePresence>
                    {isSettingBeta && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 border-t border-blue-100">
                          <p className="text-xs font-bold text-blue-700 mb-2">베타 Pro 액세스 설정</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {[7, 14, 30, 90].map(d => (
                              <button
                                key={d}
                                onClick={() => setBetaSetting({ userId: u.id, days: d })}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                                  betaSetting?.days === d
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                              >
                                {d}일
                              </button>
                            ))}
                            <button
                              onClick={() => setBetaForUser(u.id, betaSetting?.days ?? 30)}
                              disabled={betaLoading === u.id}
                              className="px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                            >
                              {betaLoading === u.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                              부여
                            </button>
                            {betaActive && (
                              <button
                                onClick={() => setBetaForUser(u.id, 0)}
                                disabled={betaLoading === u.id}
                                className="px-4 py-1.5 bg-red-100 hover:bg-red-200 text-red-600 text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors"
                              >
                                <XCircle size={12} /> 철수
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 쿠폰 이메일 발송 인라인 패널 */}
                  <AnimatePresence>
                    {couponSend?.userId === u.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3 border-t border-indigo-100">
                          <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1.5">
                            <Ticket size={12} /> 쿠폰 코드 이메일 발송 → <span className="font-mono">{couponSend.email}</span>
                          </p>
                          {coupons.filter(c => c.is_active).length === 0 ? (
                            <p className="text-xs text-gray-400">활성화된 쿠폰이 없습니다. 쿠폰 탭에서 먼저 생성하세요.</p>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={couponSendCode}
                                onChange={e => setCouponSendCode(e.target.value)}
                                className="px-3 py-2 rounded-xl border border-indigo-200 text-sm font-mono font-bold bg-white focus:outline-none focus:border-indigo-400"
                              >
                                <option value="">쿠폰 선택</option>
                                {coupons.filter(c => c.is_active).map(c => (
                                  <option key={c.id} value={c.code}>
                                    {c.code} ({c.duration_days}일{c.max_uses > 0 ? ` / ${c.used_count}/${c.max_uses}` : ''})
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={sendCouponEmail}
                                disabled={couponSending || !couponSendCode}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50"
                              >
                                {couponSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                이메일 발송
                              </button>
                            </div>
                          )}
                          {couponSendMsg && (
                            <p className={`mt-2 text-xs font-bold px-3 py-1.5 rounded-xl ${
                              couponSendMsg.type === 'ok' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                            }`}>{couponSendMsg.text}</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* 인라인 삭제 확인 */}
                  <AnimatePresence>
                    {userDeleteConfirm === u.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center justify-between gap-3 pt-3 border-t border-red-200">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-red-500 shrink-0" />
                            <p className="text-xs font-bold text-red-700">
                              <span className="font-black">{u.full_name || u.email}</span> 계정을 완전히 삭제합니다.<br />
                              <span className="font-normal text-red-500">auth.users · profiles · 관련 데이터 모두 삭제됩니다. 되돌릴 수 없습니다.</span>
                            </p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => setUserDeleteConfirm(null)}
                              className="px-3 py-1.5 text-xs font-bold text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                              취소
                            </button>
                            <button
                              onClick={() => deleteUser(u.id)}
                              disabled={userDeleting === u.id}
                              className="px-3 py-1.5 text-xs font-black text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl flex items-center gap-1.5 transition-colors"
                            >
                              {userDeleting === u.id
                                ? <Loader2 size={12} className="animate-spin" />
                                : <Trash2 size={12} />}
                              삭제 확인
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 학급 ── */}
        {activeTab === 'classes' && (
          <>
            <p className="text-sm text-amber-700 font-bold mb-5">전체 학급 {classes.length}개</p>
            {classesLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : classes.length === 0 ? <div className="text-center py-20 text-amber-400"><BookOpen size={40} className="mx-auto mb-3 opacity-40" /><p>생성된 학급이 없습니다</p></div>
            : <div className="space-y-3">
              {classes.map((cls, i) => (
                <motion.div key={cls.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-2xl border border-amber-100 p-5 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <BookOpen size={18} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-amber-900 text-sm">{cls.name}</span>
                      {cls.subject && <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full border border-amber-200">{cls.subject}</span>}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-amber-500">
                      <span className="flex items-center gap-1"><User size={11} />{cls.profiles?.full_name ?? '교사 미확인'}</span>
                      <span className="flex items-center gap-1"><Users size={11} />학생 {cls._studentCount}명</span>
                      <span>{new Date(cls.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                  <button onClick={() => setDeleteTarget({ table: 'classes', id: cls.id, label: `학급: ${cls.name}` })}
                    className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 size={16} />
                  </button>
                </motion.div>
              ))}
            </div>}
          </>
        )}

        {/* ── 학생 ── */}
        {activeTab === 'students' && (
          <>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">전체 학생 {students.length}명</p>
              <select value={classFilterId} onChange={e => setClassFilterId(e.target.value)}
                className="text-sm font-bold border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none cursor-pointer">
                {classOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {studentsLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : filteredStudents.length === 0 ? <div className="text-center py-20 text-amber-400"><GraduationCap size={40} className="mx-auto mb-3 opacity-40" /><p>학생이 없습니다</p></div>
            : <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-amber-50 border-b border-amber-100">
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">번호</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">이름</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">학급</th>
                  <th className="px-5 py-3" />
                </tr></thead>
                <tbody>
                  {filteredStudents.map((stu, i) => (
                    <motion.tr key={stu.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-amber-50 last:border-0 hover:bg-amber-50/40 transition-colors">
                      <td className="px-5 py-3 text-amber-500 font-mono text-xs">{stu.student_number ?? '—'}</td>
                      <td className="px-5 py-3 font-bold text-amber-900">{stu.full_name}</td>
                      <td className="px-5 py-3 text-amber-600">{stu.classes?.name ?? '—'}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setDeleteTarget({ table: 'students', id: stu.id, label: `학생: ${stu.full_name}` })}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </>
        )}

        {/* ── 관찰기록 ── */}
        {activeTab === 'observations' && (
          <>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">전체 {observations.length}건</p>
              <div className="flex items-center gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                  <button key={f} onClick={() => setObsFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${obsFilter === f ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}>
                    {f === 'all' ? '전체' : OBS_STATUS[f]?.label}
                  </button>
                ))}
                <button onClick={exportObservations} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold hover:bg-emerald-100 transition-colors">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>
            {obsLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : filteredObs.length === 0 ? <div className="text-center py-20 text-amber-400"><ClipboardList size={40} className="mx-auto mb-3 opacity-40" /><p>활동 기록이 없습니다</p></div>
            : <div className="space-y-3">
              {filteredObs.map((obs, i) => (
                <motion.div key={obs.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-2xl border border-amber-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-amber-900 text-sm">{obs.students?.full_name ?? '미확인'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${OBS_STATUS[obs.status]?.color ?? ''}`}>{OBS_STATUS[obs.status]?.label}</span>
                        <span className="text-[10px] text-amber-400 bg-amber-50 px-2 py-0.5 rounded-full">{obs.activity_name}</span>
                      </div>
                      <p className="text-xs text-amber-600 leading-relaxed line-clamp-2">{obs.content}</p>
                      <p className="text-[11px] text-amber-400">작성: {obs.profiles?.full_name ?? '미확인'} · {new Date(obs.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <button onClick={() => setDeleteTarget({ table: 'observations', id: obs.id, label: `활동 기록: ${obs.students?.full_name ?? '미확인'} — ${obs.activity_name}` })}
                      className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
            </div>}
          </>
        )}

        {/* ── 결과제출 ── */}
        {activeTab === 'results' && (
          <>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">전체 {results.length}건</p>
              <div className="flex items-center gap-2">
                <select value={resStatusFilter} onChange={e => setResStatusFilter(e.target.value)}
                  className="text-sm font-bold border border-amber-200 rounded-xl px-3 py-2 bg-white focus:outline-none cursor-pointer">
                  <option value="all">전체 상태</option>
                  {resultStatuses.map(s => <option key={s!} value={s!}>{s}</option>)}
                </select>
                <button onClick={exportResults} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold hover:bg-emerald-100 transition-colors">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>
            {resultsLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : filteredResults.length === 0 ? <div className="text-center py-20 text-amber-400"><FileCheck size={40} className="mx-auto mb-3 opacity-40" /><p>결과제출이 없습니다</p></div>
            : <div className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr className="bg-amber-50 border-b border-amber-100">
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">학생</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">주차</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">상태</th>
                  <th className="text-left px-5 py-3 text-xs font-black text-amber-700">제출일</th>
                  <th className="px-5 py-3" />
                </tr></thead>
                <tbody>
                  {filteredResults.map((r, i) => (
                    <motion.tr key={r.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="border-b border-amber-50 last:border-0 hover:bg-amber-50/40 transition-colors">
                      <td className="px-5 py-3 font-bold text-amber-900">{r.students?.full_name ?? '미확인'}</td>
                      <td className="px-5 py-3 text-amber-600">{r.week_number ? `${r.week_number}주차` : '—'}</td>
                      <td className="px-5 py-3">
                        <span className="text-[11px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full">{r.status ?? '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-amber-500 text-xs">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setDeleteTarget({ table: 'student_results', id: r.id, label: `결과제출: ${r.students?.full_name ?? '미확인'} ${r.week_number ?? ''}주차` })}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>}
          </>
        )}

        {/* ── 건의사항 ── */}
        {activeTab === 'suggestions' && (
          <>
            <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
              <p className="text-sm text-amber-700 font-bold">전체 {suggestions.length}건</p>
              <div className="flex items-center gap-2">
                {(['all', 'pending', 'replied'] as const).map(f => (
                  <button key={f} onClick={() => setSugFilter(f)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${sugFilter === f ? 'bg-amber-500 text-white' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}`}>
                    {f === 'all' ? '전체' : f === 'pending' ? '미답변' : '답변완료'}
                  </button>
                ))}
                <button onClick={exportSuggestions} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold hover:bg-emerald-100 transition-colors">
                  <Download size={12} /> CSV
                </button>
              </div>
            </div>
            {sugLoading ? <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            : filteredSuggestions.length === 0 ? <div className="text-center py-20 text-amber-400"><Megaphone size={40} className="mx-auto mb-3 opacity-40" /><p>건의사항이 없습니다</p></div>
            : <div className="space-y-3">
              {filteredSuggestions.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-2xl border border-amber-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-amber-900 text-sm">{s.student_name ?? '미확인'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${s.teacher_reply ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                          {s.teacher_reply ? '답변완료' : '미답변'}
                        </span>
                      </div>
                      <p className="text-sm text-amber-800 leading-relaxed">{s.content}</p>
                      {s.teacher_reply && (
                        <div className="flex gap-2 bg-emerald-50 rounded-xl p-3">
                          <Send size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                          <p className="text-xs text-emerald-800 leading-relaxed">{s.teacher_reply}</p>
                        </div>
                      )}
                      <p className="text-[11px] text-amber-400">{new Date(s.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                    <button onClick={() => setDeleteTarget({ table: 'student_suggestions', id: s.id, label: `건의사항: ${s.student_name ?? '미확인'}` })}
                      className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
            </div>}
          </>
        )}

        {/* ── 공지사항 ── */}
        {activeTab === 'announcements' && (
          <>
            {/* 작성 폼 */}
            <div className="bg-white rounded-2xl border border-amber-100 p-6 mb-6">
              <h3 className="text-base font-black text-amber-900 flex items-center gap-2 mb-4">
                <Plus size={18} className="text-amber-500" /> 새 공지사항
              </h3>
              <div className="space-y-3">
                <input type="text" value={annTitle} onChange={e => setAnnTitle(e.target.value)}
                  placeholder="공지 제목"
                  className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm font-bold focus:outline-none focus:border-amber-400" />
                <textarea value={annContent} onChange={e => setAnnContent(e.target.value)}
                  placeholder="공지 내용을 입력하세요..."
                  rows={4}
                  className="w-full px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm resize-none focus:outline-none focus:border-amber-400" />
                <button onClick={createAnnouncement} disabled={annSaving || !annTitle.trim() || !annContent.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                  {annSaving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 공지 발송
                </button>
              </div>
            </div>

            {/* 목록 */}
            <p className="text-sm text-amber-700 font-bold mb-4">등록된 공지사항 {announcements.length}건</p>
            {annLoading ? <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-400" size={28} /></div>
            : announcements.length === 0 ? <div className="text-center py-16 text-amber-400"><Bell size={40} className="mx-auto mb-3 opacity-40" /><p>등록된 공지사항이 없습니다</p></div>
            : <div className="space-y-3">
              {announcements.map((ann, i) => (
                <motion.div key={ann.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="bg-white rounded-2xl border border-amber-100 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-black text-amber-900">{ann.title}</p>
                      <p className="text-sm text-amber-700 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                      <p className="text-[11px] text-amber-400">{new Date(ann.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                    <button onClick={() => setDeleteTarget({ table: 'announcements', id: ann.id, label: `공지: ${ann.title}` })}
                      className="shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={16} /></button>
                  </div>
                </motion.div>
              ))}
            </div>}
          </>
        )}

        {/* ── 버그 신고 탭 ── */}
        {activeTab === 'bugs' && (
          <>
            <div className="flex items-center justify-between mb-6">
              <p className="text-sm text-amber-700 font-bold">총 {bugs.length}건</p>
              <button onClick={fetchBugs} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors">
                <RefreshCw size={13} /> 새로고침
              </button>
            </div>
            {bugsLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : bugs.length === 0 ? (
              <div className="text-center py-20 text-amber-400">
                <Bug size={40} className="mx-auto mb-3 opacity-40" />
                <p>접수된 버그 신고가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bugs.map((bug, i) => (
                  <motion.div key={bug.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-white rounded-2xl border border-amber-100 p-5 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            bug.status === 'open'     ? 'bg-red-100 text-red-600' :
                            bug.status === 'progress' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-emerald-100 text-emerald-700'
                          }`}>
                            {bug.status === 'open' ? '🔴 접수' : bug.status === 'progress' ? '🟡 처리중' : '✅ 완료'}
                          </span>
                          <span className="text-[10px] text-amber-400">{new Date(bug.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="font-black text-amber-900">{bug.title}</p>
                        <p className="text-sm text-amber-700 mt-1 leading-relaxed">{bug.description}</p>
                        {bug.page_url && (
                          <p className="text-[10px] text-amber-400 mt-1.5 font-mono truncate">📍 {bug.page_url}</p>
                        )}
                        <p className="text-[11px] text-amber-500 mt-1">신고자: {bug.user_name || '익명'} {bug.user_email ? `(${bug.user_email})` : ''}</p>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {bug.status !== 'progress' && (
                          <button onClick={() => updateBugStatus(bug.id, 'progress')}
                            className="px-3 py-1.5 text-[10px] font-black bg-amber-100 text-amber-700 rounded-xl hover:bg-amber-200 transition-colors">
                            처리중
                          </button>
                        )}
                        {bug.status !== 'resolved' && (
                          <button onClick={() => updateBugStatus(bug.id, 'resolved')}
                            className="px-3 py-1.5 text-[10px] font-black bg-emerald-100 text-emerald-700 rounded-xl hover:bg-emerald-200 transition-colors">
                            완료
                          </button>
                        )}
                        {bug.status !== 'open' && (
                          <button onClick={() => updateBugStatus(bug.id, 'open')}
                            className="px-3 py-1.5 text-[10px] font-black bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition-colors">
                            재오픈
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 쿠폰 관리 ─────────────────────────────────────────────────────── */}
        {activeTab === 'coupons' && (
          <div className="space-y-6">
            {/* 쿠폰 생성 폼 */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6">
              <h3 className="font-black text-blue-900 mb-4 flex items-center gap-2">
                <Ticket size={16} className="text-blue-600" /> 새 쿠폰 생성
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="코드 (예: BETA2026)"
                    value={couponForm.code}
                    onChange={e => setCouponForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-blue-200 text-sm font-mono font-bold bg-white focus:outline-none focus:border-blue-400 uppercase"
                  />
                  <button
                    onClick={generateCouponCode}
                    title="랜덤 코드 생성"
                    className="p-2.5 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-xl transition-colors"
                  >
                    <Shuffle size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-blue-700 whitespace-nowrap">기간</label>
                  <div className="flex gap-1">
                    {[7, 14, 30, 90].map(d => (
                      <button key={d}
                        onClick={() => setCouponForm(f => ({ ...f, duration_days: d }))}
                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          couponForm.duration_days === d
                            ? 'bg-blue-500 text-white'
                            : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-100'
                        }`}
                      >{d}일</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-blue-700 whitespace-nowrap">최대 사용</label>
                  <input
                    type="number" min={0}
                    value={couponForm.max_uses}
                    onChange={e => setCouponForm(f => ({ ...f, max_uses: Number(e.target.value) }))}
                    className="w-24 px-3 py-2 rounded-xl border border-blue-200 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                  <span className="text-xs text-blue-500">(0 = 무제한)</span>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-blue-700 whitespace-nowrap flex items-center gap-1">
                    <Calendar size={12} /> 만료일
                  </label>
                  <input
                    type="date"
                    value={couponForm.expires_at}
                    onChange={e => setCouponForm(f => ({ ...f, expires_at: e.target.value }))}
                    className="flex-1 px-3 py-2 rounded-xl border border-blue-200 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="메모 (예: 2026 여름 교사 연수 배포용)"
                    value={couponForm.note}
                    onChange={e => setCouponForm(f => ({ ...f, note: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-blue-200 text-sm bg-white focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
              {couponMsg && (
                <p className="mt-2 text-xs font-bold text-red-600 bg-red-50 px-3 py-2 rounded-xl">{couponMsg}</p>
              )}
              <button
                onClick={createCoupon}
                disabled={couponSaving}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-black rounded-xl transition-colors disabled:opacity-50"
              >
                {couponSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                쿠폰 생성
              </button>
            </div>

            {/* 쿠폰 목록 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-amber-700">총 {coupons.length}개 쿠폰</p>
                <button onClick={fetchCoupons} className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-50 transition-colors">
                  <RefreshCw size={13} /> 새로고침
                </button>
              </div>
              {couponsLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-amber-400" size={28} /></div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-16 text-amber-400">
                  <Ticket size={36} className="mx-auto mb-3 opacity-40" />
                  <p className="text-sm">생성된 쿠폰이 없습니다</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {coupons.map(c => {
                    const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                    const isFull = c.max_uses > 0 && c.used_count >= c.max_uses;
                    return (
                      <div key={c.id} className={`bg-white rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${!c.is_active ? 'opacity-50' : ''} ${isExpired || isFull ? 'border-red-200 bg-red-50/20' : 'border-amber-100'}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-mono font-black text-blue-800 text-base tracking-widest">{c.code}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{c.duration_days}일</span>
                            {isExpired && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">만료됨</span>}
                            {isFull && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600">소진됨</span>}
                            {!c.is_active && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">비활성</span>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            <span>사용 {c.used_count} / {c.max_uses === 0 ? '∞' : c.max_uses}</span>
                            {c.expires_at && <span className="flex items-center gap-1"><Calendar size={10} />{new Date(c.expires_at).toLocaleDateString('ko-KR')}</span>}
                            {c.note && <span className="text-gray-400 truncate">{c.note}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => toggleCoupon(c.id, c.is_active)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                              c.is_active
                                ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                          >
                            {c.is_active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            {c.is_active ? '활성' : '비활성'}
                          </button>
                          <button
                            onClick={() => deleteCoupon(c.id)}
                            className="p-1.5 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                            title="쿠폰 삭제"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>

    {/* 승인 진행 오버레이 */}

    <AnimatePresence>
      {approvalProgress && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-8 right-8 z-[200] w-80 rounded-2xl shadow-2xl border border-gray-100 overflow-hidden bg-white"
        >
          {/* 헤더 */}
          <div className={`px-5 py-3.5 flex items-center gap-2.5 ${
            approvalProgress.step === 'error' ? 'bg-red-500' :
            approvalProgress.step === 'done'  ? 'bg-emerald-500' : 'bg-amber-500'
          }`}>
            {approvalProgress.step === 'done' ? (
              <CheckCircle2 size={16} className="text-white" />
            ) : approvalProgress.step === 'error' ? (
              <XCircle size={16} className="text-white" />
            ) : (
              <Loader2 size={16} className="text-white animate-spin" />
            )}
            <p className="text-white font-black text-sm">
              {approvalProgress.step === 'done'  ? '승인 완료!' :
               approvalProgress.step === 'error' ? '오류 발생' : '승인 처리 중...'}
            </p>
          </div>

          {/* 스텝 목록 */}
          <div className="px-5 py-4 space-y-3">
            {/* Step 1: DB */}
            <div className="flex items-center gap-3">
              {approvalProgress.step === 'db' ? (
                <Loader2 size={15} className="text-amber-500 animate-spin shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-bold ${approvalProgress.step === 'db' ? 'text-amber-600' : 'text-emerald-600'}`}>
                  신청 DB 승인
                </p>
              </div>
            </div>

            {/* Step 2: Email */}
            <div className="flex items-center gap-3">
              {approvalProgress.step === 'db' ? (
                <div className="w-[15px] h-[15px] rounded-full border-2 border-gray-200 shrink-0" />
              ) : approvalProgress.step === 'email' ? (
                <Loader2 size={15} className="text-amber-500 animate-spin shrink-0" />
              ) : approvalProgress.step === 'error' ? (
                <XCircle size={15} className="text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
              )}
              <div>
                <p className={`text-xs font-bold ${
                  approvalProgress.step === 'db'    ? 'text-gray-300' :
                  approvalProgress.step === 'email' ? 'text-amber-600' :
                  approvalProgress.step === 'error' ? 'text-red-400' : 'text-emerald-600'
                }`}>
                  {approvalProgress.step === 'email' ? '승인 이메일 발송 중...' : '승인 이메일 발송'}
                </p>
              </div>
            </div>

            {/* 대상자 정보 */}
            <div className="pt-2 border-t border-gray-100 space-y-0.5">
              <p className="text-xs font-black text-gray-700">{approvalProgress.name} 선생님</p>
              <p className="text-[11px] text-gray-400 font-mono">{approvalProgress.email}</p>
              {approvalProgress.message && (
                <p className={`text-[11px] font-bold mt-1 ${
                  approvalProgress.step === 'error' ? 'text-red-500' : 'text-amber-600'
                }`}>{approvalProgress.message}</p>
              )}
            </div>

            {approvalProgress.step === 'error' && (
              <button
                onClick={() => setApprovalProgress(null)}
                className="w-full py-2 text-xs font-bold text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors"
              >
                닫기
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default Admin;
