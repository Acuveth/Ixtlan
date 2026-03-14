import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useDatabase } from '../../context/DatabaseContext';

export default function Layout() {
  const { ready } = useDatabase();

  if (!ready) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-sm text-slate-500 mb-2">Initializing database...</div>
          <div className="w-32 h-1 bg-slate-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-50">
      <div className="hidden lg:block flex-shrink-0 h-full">
        <Sidebar />
      </div>
      <main className="flex-1 min-w-0 h-full overflow-auto pb-16 lg:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
}
