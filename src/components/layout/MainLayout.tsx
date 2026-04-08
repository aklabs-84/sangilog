import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleSidebar = () => setIsCollapsed(!isCollapsed);

  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 selection:text-primary">
      <Sidebar isCollapsed={isCollapsed} toggleSidebar={toggleSidebar} />
      <Navbar isCollapsed={isCollapsed} />
      <main className={`transition-all duration-300 ${isCollapsed ? 'ml-[80px]' : 'ml-[260px]'} pt-20 px-8 pb-12 min-h-screen relative z-0`}>
        <div className="max-w-[1440px] mx-auto pt-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
