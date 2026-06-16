import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth, isAnonymousUser } from './lib/auth';
import { supabase } from './lib/supabase';
import { TimerProvider } from './lib/timerContext';

// Supabase가 redirect_to 미허용 시 루트(/)로 fallback하는 경우 대응
// 초대·복구 토큰이 해시에 있으면 /set-password로 즉시 리다이렉트
if (
  typeof window !== 'undefined' &&
  window.location.pathname === '/' &&
  window.location.hash.includes('access_token')
) {
  window.history.replaceState({}, '', '/set-password' + window.location.hash);
}
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Landing from './pages/Landing';
import Admin from './pages/Admin';
import Classroom from './pages/Classroom';
import AIAssistant from './pages/AIAssistant';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';
import Export from './pages/Export';
import ClassroomEntry from './pages/ClassroomEntry';
import StudentLog from './pages/StudentLog';
import Archive from './pages/Archive';
import StudentView from './pages/StudentView';
import TeachingTools from './pages/TeachingTools';
import Whiteboard from './pages/tools/Whiteboard';
import StudentBoardViewer from './pages/tools/StudentBoardViewer';
import StudentJoin from './pages/tools/StudentJoin';
import SuggestionsPage from './pages/SuggestionsPage';
import QuizStudentView from './pages/QuizStudentView';
import ClassBoard from './pages/ClassBoard';
import ShareClassView from './pages/ShareClassView';
import SchoolShareView from './pages/SchoolShareView';
import SchoolProjectShareView from './pages/SchoolProjectShareView';
import SetPassword from './pages/SetPassword';
import SurveyStudent from './pages/tools/SurveyStudent';
import Privacy from './pages/Privacy';
import Gallery from './pages/Gallery';

// 선생님 전용 라우트 가드
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, profile } = useAuth();
  const isAnon = !loading && isAnonymousUser(user);

  // 익명 세션이 보호된 경로에 접근하면 즉시 파기 (방어 2중화)
  useEffect(() => {
    if (isAnon) supabase.auth.signOut();
  }, [isAnon]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-on-surface-variant font-manrope">인증 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  // 미로그인 → 선생님 로그인 화면
  if (!user) return <Navigate to="/login" replace />;

  // 익명 유저(학생) → 학생 홈으로 (이중 감지: is_anonymous + app_metadata.provider)
  if (isAnonymousUser(user)) return <Navigate to="/student-log" replace />;

  // 프로필 없음 = 삭제된 계정 → 로그인으로 (auth.tsx에서 signOut 처리, 여기선 리다이렉트 방어)
  if (profile === null) return <Navigate to="/login" replace />;

  // 승인 취소된 계정 차단
  if (profile.is_approved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FFFBF5] px-4">
        <div className="max-w-md w-full text-center space-y-6 p-10 bg-white rounded-3xl shadow-xl border border-amber-100">
          <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto">
            <span className="text-3xl">🔒</span>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-amber-900">접근이 제한되었습니다</h2>
            <p className="text-sm text-amber-700 leading-relaxed">
              계정 승인이 취소되었습니다.<br />
              관리자에게 문의해 주세요.
            </p>
          </div>
          <a
            href="mailto:aklabs84@naver.com?subject=생기로그 계정 문의"
            className="inline-block px-6 py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors"
          >
            관리자에게 문의하기
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// 화이트보드 전용: 익명(학생) + 인증(선생님) 모두 허용, 완전 미로그인만 /wb-join으로
const WhiteboardRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-on-surface-variant font-manrope">인증 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/wb-join" replace />;
  }

  return <>{children}</>;
};

// 루트 경로: 로그인 상태면 /dashboard, 아니면 랜딩
const RootRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-on-surface-variant font-manrope">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 익명 유저(학생)는 미로그인으로 취급 — 선생님만 대시보드로
  if (user && !isAnonymousUser(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Landing />;
};

const Help = () => <div className="p-10 font-manrope text-2xl font-bold">Help Center (Coming Soon)</div>;

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
      <div className="relative min-h-screen bg-surface overflow-hidden">
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed top-[20%] right-[-5%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />

        <BrowserRouter>
          <div className="relative z-10">
            <Routes>
              {/* 공개 라우트 */}
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<Login />} />
              <Route path="/set-password" element={<SetPassword />} />
              <Route path="/classroom-entry" element={<ClassroomEntry />} />
              <Route path="/student-log" element={<StudentLog />} />
              <Route path="/quiz/:pin" element={<QuizStudentView />} />
              <Route path="/quiz" element={<QuizStudentView />} />
              <Route path="/survey/:pin" element={<SurveyStudent />} />
              <Route path="/survey" element={<SurveyStudent />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/sb/:boardId" element={<StudentBoardViewer />} />
              <Route path="/wb-join" element={<StudentJoin />} />
              <Route path="/share/:classId" element={<ShareClassView />} />
              <Route path="/school-share/:schoolId" element={<SchoolShareView />} />
              <Route path="/school-project/:shareToken" element={<SchoolProjectShareView />} />

              {/* 관리자 라우트 */}
              <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />

              {/* 보드 */}
              <Route path="/board/:classId" element={<ProtectedRoute><ClassBoard /></ProtectedRoute>} />

              {/* 화이트보드 (전체 화면, 레이아웃 없음) — 익명(학생)+인증(선생님) 모두 허용 */}
              <Route path="/whiteboard/:boardId" element={<WhiteboardRoute><Whiteboard /></WhiteboardRoute>} />

              {/* 보호된 레이아웃 라우트 (/dashboard 아래) */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
              </Route>

              <Route
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="classroom" element={<Classroom />} />
                <Route path="student-view/:id" element={<StudentView />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="export" element={<Export />} />
                <Route path="archive" element={<Archive />} />
                <Route path="activity-log" element={<ActivityLog />} />
                <Route path="teaching-tools" element={<TeachingTools />} />
                <Route path="gallery" element={<Gallery />} />
                <Route path="suggestions" element={<SuggestionsPage />} />
                <Route path="settings" element={<Settings />} />
                <Route path="help" element={<Help />} />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </BrowserRouter>
      </div>
      </TimerProvider>
    </AuthProvider>
  );
}

export default App;
