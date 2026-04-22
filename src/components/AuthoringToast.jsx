import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './AuthoringToast.css';

const MOTION_EASE_OUT = [0.23, 1, 0.32, 1];

export default function AuthoringToast({ toast, reduceMotion = false }) {
  const initial = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 };
  const exit = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 };
  const transition = reduceMotion
    ? { duration: 0.1 }
    : { duration: 0.2, ease: MOTION_EASE_OUT };

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          className={`authoring-toast${toast.type === 'error' ? ' is-error' : ''}`}
          role="status"
          aria-live="polite"
          initial={initial}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={exit}
          transition={transition}
        >
          {toast.msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
