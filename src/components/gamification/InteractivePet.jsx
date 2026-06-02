import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import { getPetStatus } from '../../utils/gamification';
import './InteractivePet.css';

const STATES = ['idle', 'walking_left', 'walking_right', 'sleeping'];

export default function InteractivePet() {
  const { user, stats } = useAuth();
  const [petState, setPetState] = useState('idle');
  const [positionX, setPositionX] = useState(10); // Percentage 0-100
  const [showMessage, setShowMessage] = useState(false);
  const [message, setMessage] = useState('');

  // Pet logic loop
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      // Randomly change state
      const newState = STATES[Math.floor(Math.random() * STATES.length)];
      setPetState(newState);

      if (newState === 'walking_right') {
        setPositionX(prev => Math.min(prev + 20, 90));
      } else if (newState === 'walking_left') {
        setPositionX(prev => Math.max(prev - 20, 0));
      } else if (newState === 'idle') {
        // Occasional chatter
        if (Math.random() > 0.7) {
          setMessage('Meow!');
          setShowMessage(true);
          setTimeout(() => setShowMessage(false), 3000);
        }
      } else if (newState === 'sleeping') {
        setMessage('Zzz...');
        setShowMessage(true);
        setTimeout(() => setShowMessage(false), 4000);
      }
    }, 5000); // State changes every 5 seconds

    return () => clearInterval(interval);
  }, [user]);

  if (!user || !stats) return null;

  const petStatus = getPetStatus(stats.xp || 0);
  // Default to cat sprite for now
  const petSrc = '/pixel_cat.png';

  const isFlipped = petState === 'walking_left';
  const isSleeping = petState === 'sleeping';
  
  // Base animations depending on state
  let animateProps = { y: 0 };
  let transitionProps = { duration: 0.5 };
  
  if (petState.startsWith('walking')) {
    animateProps = { y: [0, -15, 0] };
    transitionProps = { duration: 0.4, repeat: Infinity };
  } else if (isSleeping) {
    animateProps = { scaleY: [1, 0.9, 1] };
    transitionProps = { duration: 2, repeat: Infinity };
  } else {
    // idle
    animateProps = { scaleY: [1, 1.05, 1] };
    transitionProps = { duration: 2, repeat: Infinity };
  }

  return (
    <div 
      className="interactive-pet-container" 
      style={{ left: `${positionX}%` }}
    >
      <AnimatePresence>
        {showMessage && (
          <motion.div 
            className="pet-chat-bubble"
            initial={{ opacity: 0, y: 10, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.img 
        src={petSrc}
        alt="Your Companion"
        className={`interactive-pet ${isFlipped ? 'flipped' : ''} ${isSleeping ? 'sleeping' : ''}`}
        animate={animateProps}
        transition={transitionProps}
      />
    </div>
  );
}
