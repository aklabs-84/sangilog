import { useState, useEffect } from 'react';
import { Bell, Settings, Trash2, CheckCircle } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface NavbarProps {
  isCollapsed?: boolean;
}

const Navbar = ({ isCollapsed }: NavbarProps) => {
  const { user, profile } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user) {
      fetchNotifications();
      
      // 실시간 알림 구독
      const subscription = supabase
        .channel('public:notifications')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, () => {
          fetchNotifications();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error && data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.is_read).length);
    }
  };

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (!error) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
  };

  const clearAll = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', user.id);

    if (!error) {
      setNotifications([]);
      setUnreadCount(0);
      setShowNotifications(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return '방금 전';
    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <header className={`h-16 glass fixed top-3 right-4 ${isCollapsed ? 'left-[100px]' : 'left-[280px]'} z-50 px-6 flex items-center justify-between transition-all duration-300 ease-in-out rounded-2xl border border-white/40 shadow-soft`}>
      <div className="flex items-center gap-8">
        <h2 className="text-xl font-black tracking-tightest leading-none gradient-text">생기로그</h2>
        <nav className="flex items-center gap-6">
          {[
            { label: '대시보드', path: '/' },
            { label: '클래스룸', path: '/classroom' },
            { label: 'AI 초안', path: '/ai-assistant' },
            { label: '보고서', path: '/export' },
          ].map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) => `
                text-[13px] font-black transition-all relative py-2 uppercase tracking-[0.1em]
                ${isActive 
                  ? 'text-primary' 
                  : 'text-on-surface-variant/60 hover:text-on-surface'}
              `}
            >
              {({ isActive }) => (
                <>
                  {tab.label}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabGlow"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`w-10 h-10 rounded-xl hover:bg-white hover:shadow-soft transition-all relative flex items-center justify-center ${showNotifications ? 'bg-white text-primary shadow-soft' : 'text-on-surface-variant/40'}`}
          >
            <Bell size={20} className={showNotifications ? 'animate-bounce' : ''} />
            {unreadCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white shadow-sm animate-pulse"></span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-4 w-80 glass rounded-2xl shadow-elevated p-5 z-50 overflow-hidden border border-white/60"
              >
                <div className="flex items-center justify-between mb-4 px-1">
                  <h3 className="font-black text-sm tracking-tightest">최근 시스템 알림</h3>
                  {notifications.length > 0 && (
                    <button 
                      onClick={clearAll}
                      className="text-[10px] text-primary hover:text-secondary flex items-center gap-1.5 font-black uppercase tracking-widest transition-colors"
                    >
                      <Trash2 size={12} />
                      Clear All
                    </button>
                  )}
                </div>
                
                <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1 custom-scrollbar">
                  {notifications.length > 0 ? (
                    notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => markAsRead(n.id)}
                        className={`p-4 rounded-xl transition-all cursor-pointer border ${n.is_read ? 'bg-surface-container/30 border-transparent opacity-60' : 'bg-white border-primary/5 shadow-soft hover:border-primary/20 hover:scale-[1.01]'}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <p className={`text-sm tracking-tight leading-snug ${n.is_read ? 'font-medium' : 'font-black text-on-surface'}`}>
                            {n.title}
                          </p>
                          {!n.is_read && <div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0 shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]" />}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                          <p className="text-[9px] font-black text-primary/40 uppercase tracking-[0.2em]">{formatTime(n.created_at)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center space-y-3">
                      <div className="w-16 h-16 bg-primary/5 rounded-2xl flex items-center justify-center mx-auto opacity-40">
                        <Bell size={32} className="text-primary" />
                      </div>
                      <p className="text-xs font-black text-on-surface-variant/40 uppercase tracking-widest">No notifications</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <NavLink to="/settings" className="w-10 h-10 rounded-xl hover:bg-white hover:shadow-soft transition-all text-on-surface-variant/40 hover:text-primary flex items-center justify-center">
          <Settings size={20} />
        </NavLink>
        
        <NavLink 
          to="/settings" 
          className="flex items-center gap-3 pl-4 border-l border-on-surface/5 ml-1 hover:bg-white hover:shadow-soft transition-all p-2 rounded-xl group active:scale-95 border border-transparent hover:border-white"
        >
          <div className="text-right hidden sm:block">
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] group-hover:text-secondary transition-colors leading-none mb-1">{profile?.role || 'Educator'}</p>
            <p className="text-[13px] font-black group-hover:text-primary transition-colors tracking-tightest">{profile?.full_name || '사용자'}</p>
          </div>
          <div className="w-10 h-10 rounded-xl overflow-hidden cursor-pointer group-hover:ring-2 group-hover:ring-primary/10 transition-all border border-white shadow-soft relative">
            <img 
              src={profile?.avatar_url || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop"} 
              alt="Profile" 
              className="w-full h-full object-cover"
            />
          </div>
        </NavLink>
      </div>
    </header>
  );
};

export default Navbar;
