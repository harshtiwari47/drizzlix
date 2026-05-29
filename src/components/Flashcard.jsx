import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { Network, Eye, Volume2, VolumeX } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import './Flashcard.css';

function normalizeEscapedText(text = '') {
  return String(text)
    .replace(/\\r\\n/g, '\n')
    // Negative lookahead: don't replace \n / \t when followed by a letter —
    // that means it's a LaTeX command (\nabla, \newline, \nu, \text, \tau …)
    // not a JSON-escaped whitespace character.
    .replace(/\\n(?![a-zA-Z])/g, '\n')
    .replace(/\\t(?![a-zA-Z])/g, '  ');
}

function markdownToReadableText(markdown = '') {
  return markdown
    .replace(/```([\s\S]*?)```/g, ' Code block: $1 ')
    .replace(/`([^`]+)`/g, ' $1 ')
    .replace(/^\s*#+\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, ' - ')
    .replace(/^\s*\d+\.\s+/gm, ' - ')
    .replace(/\*\*\s*Pros\s*:?\s*\*\*/gi, ' Pros: ')
    .replace(/\*\*\s*Cons\s*:?\s*\*\*/gi, ' Cons: ')
    .replace(/\bPros\s*:/gi, ' Pros: ')
    .replace(/\bCons\s*:/gi, ' Cons: ')
    .replace(/\$\$([\s\S]+?)\$\$/g, ' Formula: $1 ')
    .replace(/\$([^$]+)\$/g, ' Formula: $1 ')
    .replace(/[|]/g, ' ')
    .replace(/[\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildHintPreview(markdown = '', maxChars = 180, maxLines = 3) {
  const normalized = String(markdown).replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const limitedLines = normalized
    .split('\n')
    .filter(line => line.trim().length > 0)
    .slice(0, maxLines)
    .join('\n');

  if (limitedLines.length <= maxChars) return limitedLines;
  return `${limitedLines.slice(0, maxChars).trim()}...`;
}

const Flashcard = React.memo(function Flashcard({
  frontContent,
  backContent,
  frontFontSize = "1.8rem",
  backFontSize = "1.05rem",
  speechRate = 1,
  showHint = false,
  hintText = '',
  readAloudTrigger = 0
}) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingFace, setSpeakingFace] = useState(null);
  const utteranceRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const speakingFaceRef = useRef(null);
  const normalizedFrontContent = useMemo(() => normalizeEscapedText(frontContent || ''), [frontContent]);
  const normalizedBackContent = useMemo(() => normalizeEscapedText(backContent || ''), [backContent]);
  const normalizedHintText = useMemo(() => normalizeEscapedText(hintText || ''), [hintText]);
  const hintPreview = useMemo(() => buildHintPreview(normalizedHintText), [normalizedHintText]);

  // 3D Parallax Tracking
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs to eliminate jitter and make it feel "heavy"
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Rotate between degrees based on mouse position
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["8deg", "-8deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-8deg", "8deg"]);

  const handleMouseMove = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Normalized mouse position relative to center of the card
    const mouseX = (e.clientX - rect.left) / width - 0.5;
    const mouseY = (e.clientY - rect.top) / height - 0.5;

    x.set(mouseX);
    y.set(mouseY);
  }, [x, y]);

  const handleMouseLeave = useCallback(() => {
    // Return to rigid state smoothly
    x.set(0);
    y.set(0);
  }, [x, y]);

  const flipCard = useCallback(() => {
    setIsFlipped(prev => !prev);
  }, []);

  const handleContainerClick = useCallback((e) => {
    // Do not flip while the user is selecting text.
    if (window.getSelection && String(window.getSelection()).trim().length > 0) return;
    flipCard();
  }, [flipCard]);

  const handleMarkdownWheel = useCallback((e) => {
    // Force wheel/touchpad delta into this panel so parent containers do not swallow it.
    const panel = e.currentTarget;
    if (panel.scrollHeight <= panel.clientHeight) return;
    e.stopPropagation();
    if (e.cancelable) {
      e.preventDefault();
    }
    panel.scrollTop += e.deltaY;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    isSpeakingRef.current = false;
    speakingFaceRef.current = null;
    setIsSpeaking(false);
    setSpeakingFace(null);
  }, []);

  const startSpeaking = useCallback((face, content) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof window.SpeechSynthesisUtterance === 'undefined') {
      return;
    }

    window.speechSynthesis.cancel();

    const text = markdownToReadableText(content);
    if (!text) return;

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = speechRate;
    utterance.pitch = 1;
    utterance.lang = 'en-US';
    utterance.onend = () => {
      isSpeakingRef.current = false;
      speakingFaceRef.current = null;
      setIsSpeaking(false);
      setSpeakingFace(null);
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      speakingFaceRef.current = null;
      setIsSpeaking(false);
      setSpeakingFace(null);
      utteranceRef.current = null;
    };

    utteranceRef.current = utterance;
    isSpeakingRef.current = true;
    speakingFaceRef.current = face;
    setIsSpeaking(true);
    setSpeakingFace(face);
    window.speechSynthesis.speak(utterance);
  }, [speechRate]);

  const handleReadAloud = useCallback((face, content, e) => {
    if (e?.preventDefault) e.preventDefault();
    if (e?.stopPropagation) e.stopPropagation();

    if (isSpeakingRef.current && speakingFaceRef.current === face) {
      stopSpeaking();
      return;
    }

    startSpeaking(face, content);
  }, [startSpeaking, stopSpeaking]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (document.activeElement.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        flipCard();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [flipCard]);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, [stopSpeaking]);

  useEffect(() => {
    if (!readAloudTrigger) return;
    const activeFace = isFlipped ? 'back' : 'front';
    const content = isFlipped ? normalizedBackContent : normalizedFrontContent;
    if (isSpeakingRef.current) {
      stopSpeaking();
    } else {
      startSpeaking(activeFace, content);
    }
  }, [readAloudTrigger, isFlipped, normalizedBackContent, normalizedFrontContent, startSpeaking, stopSpeaking]);

  return (
    <div className="flashcard-container" onClick={handleContainerClick}>
      {/* Structural envelope handles the subtle 3D hover tracking */}
      <motion.div
        className="flashcard-tilt-wrapper"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d"
        }}
      >
        {/* Core payload handles the explicit 180deg flip */}
        <motion.div
          className="flashcard-inner"
          initial={false}
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: "spring", stiffness: 220, damping: 25 }}
        >
          <div className="flashcard-face flashcard-front">
            <div className="flashcard-card-header">
              <Network size={14} />
            </div>
            <button
              type="button"
              className="tts-button"
              title={isSpeaking && speakingFace === 'front' ? 'Stop reading' : 'Read front text'}
              onClick={(e) => handleReadAloud('front', frontContent, e)}
            >
              {isSpeaking && speakingFace === 'front' ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <div className="flashcard-content">
              <div className="markdown-answer" onWheel={handleMarkdownWheel} tabIndex={0}>
                <MarkdownRenderer
                  fontSize={frontFontSize}
                  className="card-text card-front-title"
                >
                  {normalizedFrontContent}
                </MarkdownRenderer>
                {showHint && hintPreview && (
                  <div className="card-hint-box">
                    <p className="card-hint-title">Hint</p>
                    <div className="card-hint-text markdown-hint">
                      <MarkdownRenderer>{hintPreview}</MarkdownRenderer>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flashcard-hint">
              <Eye size={14} />
            </div>
          </div>

          <div className="flashcard-face flashcard-back">
            <div className="flashcard-card-header">
              <Network size={14} />
            </div>
            <button
              type="button"
              className="tts-button"
              title={isSpeaking && speakingFace === 'back' ? 'Stop reading' : 'Read answer text'}
              onClick={(e) => handleReadAloud('back', backContent, e)}
            >
              {isSpeaking && speakingFace === 'back' ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <div className="flashcard-content">
              <div className="markdown-answer" onWheel={handleMarkdownWheel} tabIndex={0}>
                <MarkdownRenderer
                  fontSize={backFontSize}
                  className="card-text card-back-answer"
                >
                  {normalizedBackContent}
                </MarkdownRenderer>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
});

export default Flashcard;

