import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { X, User, Info, MessageSquare, Shield, FileText, LogOut, SlidersHorizontal, TimerReset } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './GlobalMenu.css';

export default function GlobalMenu({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = React.useState(null);
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    setIsInstalled(Boolean(standalone));

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  const isSafari = /^((?!chrome|android).)*safari/i.test(window.navigator.userAgent || '');
  const canShowIosInstall = isIos && isSafari && !isInstalled;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        await deferredPrompt.userChoice;
      } catch {
        // no-op
      }
      setDeferredPrompt(null);
      return;
    }

    if (canShowIosInstall) {
      alert('To install: tap Share in Safari, then choose "Add to Home Screen".');
      return;
    }

    alert('Install option is not available in Drizzlix right now. Try Chrome/Edge on Android or Safari on iOS.');
  };

  const handleLogout = () => {
    logout();
    onClose();
    navigate('/login');
  };

  const menuItems = [
    { icon: <User size={20} />, label: 'Profile', path: '/u/me' },
    { icon: <User size={20} />, label: 'Edit Profile', path: '/profile/edit' },
    { icon: <TimerReset size={20} />, label: 'Pomodoro', path: '/pomodoro' },
    { icon: <SlidersHorizontal size={20} />, label: 'Global Settings', path: '/settings' },
    { icon: <Info size={20} />, label: 'About Drizzlix', path: '/about' },
    { icon: <MessageSquare size={20} />, label: 'Contact Support', path: '/contact' },
    { icon: <Shield size={20} />, label: 'Privacy Policy', path: '/privacy' },
    { icon: <FileText size={20} />, label: 'Terms of Service', path: '/terms' },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <Motion.div 
            className="menu-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <Motion.div 
            className="bottom-drawer"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="drawer-handle" />
            <button className="close-btn" onClick={onClose}><X size={24} /></button>

            <div className="drawer-content">
              {user && (
                <div className="user-profile-header">
                  <img src={user.picture} alt="Drizzlix user profile" className="drawer-avatar" />
                  <div className="user-text">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                  </div>
                </div>
              )}

              <div className="menu-grid">
                {menuItems.map((item, idx) => (
                  <button 
                    key={idx} 
                    className="menu-item-btn"
                    onClick={() => {
                        onClose();
                        if (item.path === '/contact') {
                          window.location.href = 'mailto:support@drizzlix.app';
                        } else {
                          navigate(item.path);
                        }
                    }}
                  >
                    <div className="menu-icon-wrap">{item.icon}</div>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              <button className="menu-item-btn logout-btn" onClick={handleLogout}>
                <div className="menu-icon-wrap"><LogOut size={20} /></div>
                <span>Disconnect Identity</span>
              </button>

              {!isInstalled && (
                <button className="menu-item-btn install-btn" onClick={handleInstallClick}>
                  <div className="menu-icon-wrap install-icon-wrap">
                    <img src="/favicon.svg" alt="Drizzlix logo" className="install-app-logo" />
                  </div>
                  <span>{deferredPrompt ? 'Install Drizzlix' : 'Add Drizzlix to Home Screen'}</span>
                </button>
              )}
            </div>
          </Motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

