import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { TimerProvider } from './lib/timerContext';
import MainLayout from './components/layout/MainLayout';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
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
import SuggestionsPage from './pages/SuggestionsPage';
import QuizStudentView from './pages/QuizStudentView';
import ClassBoard from './pages/ClassBoard';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
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
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Remaining Placeholders
const Help = () => <div className="p-10 font-manrope text-2xl font-bold">Help Center (Coming Soon)</div>;

function App() {
  return (
    <AuthProvider>
      <TimerProvider>
      <div className="relative min-h-screen bg-surface overflow-hidden">
        {/* Global Background Glow Effects */}
        <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="fixed top-[20%] right-[-5%] w-[30%] h-[30%] bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
        
        <BrowserRouter>
          <div className="relative z-10">
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/classroom-entry" element={<ClassroomEntry />} />
              <Route path="/student-log" element={<StudentLog />} />
              <Route path="/quiz/:pin" element={<QuizStudentView />} />
              <Route path="/quiz" element={<QuizStudentView />} />
              <Route path="/board/:classId" element={<ProtectedRoute><ClassBoard /></ProtectedRoute>} />
              
              <Route 
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="classroom" element={<Classroom />} />
                <Route path="student-view/:id" element={<StudentView />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="export" element={<Export />} />
                <Route path="archive" element={<Archive />} />
                <Route path="activity-log" element={<ActivityLog />} />
                <Route path="teaching-tools" element={<TeachingTools />} />
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
