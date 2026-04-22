import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import './Login.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [errorMessage, setErrorMessage] = React.useState('');
  const [isAuthenticating, setIsAuthenticating] = React.useState(false);

  const handleSuccess = async (credentialResponse) => {
    try {
      setErrorMessage('');
      setIsAuthenticating(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential })
      });

      const rawResponse = await res.text();
      let data = {};
      try {
        data = rawResponse ? JSON.parse(rawResponse) : {};
      } catch {
        throw new Error('Server returned a non-JSON response during login.');
      }

      if (!res.ok) {
        throw new Error(data?.msg || `Login failed with status ${res.status}.`);
      }

      if (data.token) {
        login(data.token, data.user);
        navigate('/');
      } else {
        throw new Error('Login response did not include a token.');
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(err?.message || 'Authentication failed. Please try again.');
      setIsAuthenticating(false);
    }
  };

  const handleError = () => {
    setIsAuthenticating(false);
    setErrorMessage('Google sign-in was cancelled or blocked. Please retry.');
  };

  return (
    <section className="login-shell" aria-label="Sign in page">
      <div className="login-atmosphere" aria-hidden="true" />

      <motion.div
        className="login-panel"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="login-badge" aria-hidden="true">
          <img src="/favicon.svg" alt="" className="login-logo-mark" />
        </div>

        <div className="login-heading-group">
          <h1 className="login-brand">Drizzlix</h1>
          <p className="login-subtitle">
            Synchronize your cognitive models to continue learning with your decks, notes, and progress signals.
          </p>
        </div>

        <div className="login-action-group">
          <p className="login-action-label">Continue with your Google identity</p>
          <div className="login-google-wrap">
            <GoogleLogin
              onSuccess={handleSuccess}
              onError={handleError}
              theme="filled_black"
              text="continue_with"
              shape="pill"
            />
          </div>
          {isAuthenticating && <p className="login-status">Verifying credentials...</p>}
        </div>

        {errorMessage && (
          <p className="login-error" role="alert">
            {errorMessage}
          </p>
        )}
      </motion.div>
    </section>
  );
}

