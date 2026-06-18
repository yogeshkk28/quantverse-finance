import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';

export default function Layout() {
  return (
    <div className="min-h-screen bg-dark-900 relative grain-overlay">
      <div className="blob-1" />
      <div className="blob-2" />
      <Navbar />
      <main className="relative z-10 pt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
