import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import GridBackground from '../components/GridBackground';
import GlobalMenu from '../components/GlobalMenu';
import UsernameOnboarding from '../components/UsernameOnboarding';
import '../App.css';

export default function Layout() {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);

  return (
    <div className="app-container app-layout-shell">
      <GridBackground />
      <div className="cinema-sidebar-wrapper">
        <Sidebar onMenuOpen={() => setIsMenuOpen(true)} />
      </div>
      <GlobalMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
      <main className="main-stage">
        <Outlet />
      </main>
      <UsernameOnboarding />
    </div>
  );
}

