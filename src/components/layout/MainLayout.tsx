import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

const MainLayout = () => {
  return (
    <div className="min-h-screen bg-surface selection:bg-primary/20 selection:text-primary">
      <Navbar />
      <main className="pt-24 px-8 pb-12 min-h-screen relative z-0">
        <div className="max-w-[1440px] mx-auto pt-4">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default MainLayout;
