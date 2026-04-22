import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { prefetchRoute } from '../services/routePrefetch';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/discover', label: 'Discover' },
  { to: '/decks', label: 'Library' },
  { to: '/create', label: 'Create' },
  { to: '/stats', label: 'Mastery' },
  { to: '/tasks', label: 'Tasks' },
  { to: '/notes', label: 'Notes' },
  { to: '/pomodoro', label: 'Pomodoro' },
];

const navItemClassName = ({ isActive }) => `nav-item ${isActive ? 'active' : ''}`;

const Sidebar = React.memo(function Sidebar({ onMenuOpen }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const navIntentHandlers = React.useMemo(() => {
    const handlers = {};

    for (const item of NAV_ITEMS) {
      const prefetch = () => prefetchRoute(item.to);
      handlers[item.to] = {
        onMouseEnter: prefetch,
        onFocus: prefetch,
        onTouchStart: prefetch,
      };
    }

    return handlers;
  }, []);

  const handleAuthClick = React.useCallback(() => {
    navigate('/login');
  }, [navigate]);

  return (
    <header className="floating-header">
      <div className="logo-text">
        <img
          src="/favicon.svg"
          alt="Drizzlix"
          width="36"
          height="36"
          style={{ filter: 'drop-shadow(0 0 8px rgba(255,255,255,0.3))' }}
        />
        <span className="logo-brand-name">Drizzlix</span>
      </div>

      <nav className="glass-nav">
        {NAV_ITEMS.map((item) => {
          const intentHandlers = navIntentHandlers[item.to];

          return (
          <NavLink
            key={item.to}
            to={item.to}
            className={navItemClassName}
            onMouseEnter={intentHandlers.onMouseEnter}
            onFocus={intentHandlers.onFocus}
            onTouchStart={intentHandlers.onTouchStart}
          >
            {item.label}
          </NavLink>
          );
        })}
      </nav>

      {user ? (
        <div className="user-trigger" onClick={onMenuOpen}>
          <img src={user.picture} alt="Profile" className="user-avatar" />
          <div className="menu-burger">
            <div className="menu-burger-line" />
            <div className="menu-burger-line short" />
          </div>
        </div>
      ) : (
        <div className="auth-btn" onClick={handleAuthClick}>
          Connect Identity
        </div>
      )}
    </header>
  );
});

export default Sidebar;

