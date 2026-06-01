import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Mail,
  School,
  User,
  MessageSquare,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  Crown,
  Users,
} from 'lucide-react';

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

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

const statusConfig = {
  pending: { label: '검토 대기', color: 'bg-amber-100 text-amber-700', icon: Clock },
  approved: { label: '승인됨', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  rejected: { label: '거절됨', color: 'bg-red-100 text-red-600', icon: XCircle },
};

const PLAN_OPTIONS = [
  { value: 'free', label: '무료', color: 'bg-gray-100 text-gray-600' },
  { value: 'pro', label: 'Pro', color: 'bg-amber-100 text-amber-700' },
  { value: 'school', label: 'School', color: 'bg-violet-100 text-violet-700' },
  { value: 'admin', label: '관리자', color: 'bg-emerald-100 text-emerald-700' },
];

const Admin = () => {
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [requests, setRequests] = useState<Request[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests');
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [planUpdating, setPlanUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && profile && !profile.is_admin) {
      navigate('/dashboard');
    }
  }, [authLoading, profile, navigate]);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('access_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setRequests(data);
    setLoading(false);
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

  useEffect(() => {
    fetchRequests();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') fetchUsers();
  }, [activeTab]);

  const updateUserPlan = async (userId: string, plan: string) => {
    setPlanUpdating(userId);
    const { error } = await supabase
      .from('profiles')
      .update({ plan, is_admin: plan === 'admin' })
      .eq('id', userId);
    if (!error) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, plan, is_admin: plan === 'admin' } : u));
    }
    setPlanUpdating(null);
  };

  const updateStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id + status);
    const { error } = await supabase
      .from('access_requests')
      .update({ status, admin_note: noteInputs[id] || null, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (!error) {
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status, admin_note: noteInputs[id] || null } : r))
      );
    }
    setActionLoading(null);
  };

  const copyEmail = (id: string, email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  const counts = {
    all: requests.length,
    pending: requests.filter((r) => r.status === 'pending').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

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
              <p className="text-xs text-amber-600/60">사용 신청 · 플랜 관리</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => activeTab === 'requests' ? fetchRequests() : fetchUsers()}
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
        {/* 탭 */}
        <div className="max-w-5xl mx-auto px-6 pb-0 flex gap-1">
          {[
            { id: 'requests', label: '사용 신청', icon: ShieldCheck },
            { id: 'users', label: '사용자 · 플랜 관리', icon: Users },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-amber-500 text-amber-700'
                  : 'border-transparent text-amber-400 hover:text-amber-600'
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── 사용자 · 플랜 관리 탭 ── */}
        {activeTab === 'users' && (
          <div>
            {usersLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="animate-spin text-amber-400" size={32} /></div>
            ) : (
              <div className="space-y-3">
                {users.map((u) => {
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
                          onChange={(e) => updateUserPlan(u.id, e.target.value)}
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
          </div>
        )}

        {/* ── 사용 신청 탭 ── */}
        {activeTab === 'requests' && <>
        {/* Filter Tabs */}
        <div className="flex gap-2 mb-8">
          {(['all', 'pending', 'approved', 'rejected'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'
              }`}
            >
              {f === 'all' ? '전체' : statusConfig[f].label}
              <span className={`ml-2 text-xs ${filter === f ? 'text-amber-100' : 'text-amber-400'}`}>
                {counts[f]}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-amber-400" size={32} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-amber-400">
            <ShieldCheck size={40} className="mx-auto mb-3 opacity-40" />
            <p className="font-medium">신청 내역이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((req, i) => {
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
                    {/* Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${sc.color}`}>
                          <StatusIcon size={12} />
                          {sc.label}
                        </span>
                        <span className="text-xs text-amber-400">
                          {new Date(req.created_at).toLocaleDateString('ko-KR', {
                            year: 'numeric', month: 'long', day: 'numeric',
                          })}
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
                            title="이메일 복사"
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
                        <div className="text-xs text-amber-500 italic">
                          메모: {req.admin_note}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    {req.status === 'pending' && (
                      <div className="flex flex-col gap-3 min-w-[200px]">
                        <textarea
                          placeholder="관리자 메모 (선택)"
                          rows={2}
                          value={noteInputs[req.id] || ''}
                          onChange={(e) =>
                            setNoteInputs((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          className="w-full px-3 py-2 text-xs border border-amber-200 rounded-xl resize-none focus:outline-none focus:border-amber-400 bg-amber-50"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStatus(req.id, 'approved')}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {actionLoading === req.id + 'approved' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={12} />
                            )}
                            승인
                          </button>
                          <button
                            onClick={() => updateStatus(req.id, 'rejected')}
                            disabled={!!actionLoading}
                            className="flex-1 py-2.5 bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                          >
                            {actionLoading === req.id + 'rejected' ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <XCircle size={12} />
                            )}
                            거절
                          </button>
                        </div>
                        <p className="text-xs text-amber-400 text-center">
                          승인 후 Supabase에서 초대 이메일을 발송하세요
                        </p>
                      </div>
                    )}

                    {req.status !== 'pending' && (
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
        </>}
      </div>
    </div>
  );
};

export default Admin;
