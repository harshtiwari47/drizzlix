import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import AICommandInput from '../components/AICommandInput';
import { useDeck } from '../context/DeckContext';
import { generateFlashcards, generateFlashcardsFromFile } from '../services/gemini';
import {
  OVERLAY_EFFECT_KEY,
  OVERLAY_INTENSITY_KEY,
  OVERLAY_SPEED_KEY,
  getDashboardOverlayEffectFromStorage,
  parseDashboardOverlayEffect,
  parseDashboardOverlayIntensity,
  parseDashboardOverlaySpeed,
} from '../services/globalSettings';
import '../App.css';

import chromeBrain from '../assets/chrome_brain.png';
import silverFluid from '../assets/silver_fluid.png';
import silverSphere from '../assets/silver_sphere.png';
import silverCircuit from '../assets/silver_circuit.png';
import obsidianCore from '../assets/obsidian_core.png';
import mercuryWave from '../assets/mercury_wave.png';
import silverHelix from '../assets/silver_helix.png';
import neuralNebula from '../assets/neural_nebula.png';
import silverNucleus from '../assets/silver_nucleus.png';
import obsidianTablet from '../assets/obsidian_tablet.png';
import mercurySplash from '../assets/mercury_splash.png';
import silverGrid from '../assets/silver_grid.png';
import neuralCrystal from '../assets/neural_crystal.png';
import stellarSupernova from '../assets/stellar_supernova.png';
import pulsarMagnetar from '../assets/pulsar_magnetar.png';
import nonEuclidean from '../assets/non_euclidean.png';
import topographicGlobe from '../assets/topographic_globe.png';
import tectonicMantle from '../assets/tectonic_mantle.png';
import molecularLattice from '../assets/molecular_lattice.png';

const DeckGallery = lazy(() => import('../components/DeckGallery'));
const DraftEditor = lazy(() => import('../components/DraftEditor'));
const DashboardOverlayEffects = lazy(() => import('../components/DashboardOverlayEffects'));

export default function Dashboard() {
  const MAX_UPLOAD_MB = 20;
  const LAST_DRAFT_STORAGE_KEY = 'aiFlashcards:lastAIDraftDeck';
  const GENERATION_STATE_STORAGE_KEY = 'aiFlashcards:dashboardGenerationState';
  const GENERATION_STATE_MAX_AGE_MS = 15 * 60 * 1000;

  const [isGenerating, setIsGenerating] = useState(false);
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const [generationPhase, setGenerationPhase] = useState('');
  const [commandPrompt, setCommandPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [dashboardOverlayEffect, setDashboardOverlayEffect] = useState(() =>
    getDashboardOverlayEffectFromStorage()
  );
  const [dashboardOverlayIntensity, setDashboardOverlayIntensity] = useState(() =>
    parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY))
  );
  const [dashboardOverlaySpeed, setDashboardOverlaySpeed] = useState(() =>
    parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY))
  );
  const [draftDeck, setDraftDeck] = useState(null);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadError, setUploadError] = useState('');
  const [popupCard, setPopupCard] = useState(null);
  const [resumeRequest, setResumeRequest] = useState(null);
  const fileInputRef = useRef(null);
  const activeGenerationRef = useRef({ id: 0, cancelled: false, mode: 'text' });
  const handleGenerateRef = useRef(null);
  const navigate = useNavigate();
  const { addDeck } = useDeck();

  const handlePromptFocus = useCallback(() => {
    setIsPromptFocused(true);
  }, []);

  const handlePromptBlur = useCallback(() => {
    setIsPromptFocused(false);
  }, []);

  const clearGenerationSnapshot = () => {
    try {
      localStorage.removeItem(GENERATION_STATE_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear generation state snapshot.', error);
    }
  };

  const saveGenerationSnapshot = (snapshot) => {
    try {
      localStorage.setItem(GENERATION_STATE_STORAGE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.warn('Failed to persist generation state snapshot.', error);
    }
  };

  const clearLastDraftSnapshot = () => {
    try {
      localStorage.removeItem(LAST_DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear AI draft snapshot.', error);
    }
  };

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LAST_DRAFT_STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (!parsed || !Array.isArray(parsed.cards) || parsed.cards.length === 0) return;
      setDraftDeck(parsed);
    } catch (error) {
      console.warn('Failed to restore last AI draft.', error);
    }
  }, [GENERATION_STATE_MAX_AGE_MS]);

  useEffect(() => {
    const syncOverlayEffect = () => {
      setDashboardOverlayEffect(getDashboardOverlayEffectFromStorage());
      setDashboardOverlayIntensity(parseDashboardOverlayIntensity(localStorage.getItem(OVERLAY_INTENSITY_KEY)));
      setDashboardOverlaySpeed(parseDashboardOverlaySpeed(localStorage.getItem(OVERLAY_SPEED_KEY)));
    };

    const handleStorage = (event) => {
      if (!event.key || event.key.startsWith('settings.dashboardOverlay')) {
        syncOverlayEffect();
      }
    };

    const handleSettingsUpdated = (event) => {
      if (event?.detail?.key === OVERLAY_EFFECT_KEY) {
        setDashboardOverlayEffect(parseDashboardOverlayEffect(event.detail.value));
      }
      if (event?.detail?.key === OVERLAY_INTENSITY_KEY) {
        setDashboardOverlayIntensity(parseDashboardOverlayIntensity(event.detail.value));
      }
      if (event?.detail?.key === OVERLAY_SPEED_KEY) {
        setDashboardOverlaySpeed(parseDashboardOverlaySpeed(event.detail.value));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('app-settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app-settings-updated', handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    if (!draftDeck) return;
    try {
      localStorage.setItem(LAST_DRAFT_STORAGE_KEY, JSON.stringify(draftDeck));
    } catch (error) {
      console.warn('Failed to persist AI draft.', error);
    }
  }, [draftDeck]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(GENERATION_STATE_STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);
      const startedAt = Number(parsed?.startedAt || 0);
      const tooOld = !startedAt || (Date.now() - startedAt > GENERATION_STATE_MAX_AGE_MS);

      if (tooOld || !parsed?.isGenerating) {
        clearGenerationSnapshot();
        return;
      }

      const savedPrompt = String(parsed?.prompt || '');
      const savedModel = String(parsed?.model || 'gemini-2.5-flash');
      const savedMode = String(parsed?.mode || 'text');

      setCommandPrompt(savedPrompt);
      setSelectedModel(savedModel);

      if (savedMode === 'text' && savedPrompt.trim()) {
        setResumeRequest({ prompt: savedPrompt, modelName: savedModel });
        return;
      }

      const fileName = parsed?.fileName ? ` (${parsed.fileName})` : '';
      setPopupCard({
        variant: 'warning',
        title: 'Generation Session Restored',
        body: `Your previous file generation${fileName} was interrupted. Please reselect the file and retry.`
      });
      clearGenerationSnapshot();
    } catch (error) {
      console.warn('Failed to restore generation state snapshot.', error);
      clearGenerationSnapshot();
    }
  }, [GENERATION_STATE_MAX_AGE_MS]);

  const retryableErrorCodes = new Set(['TIMEOUT', 'NETWORK_ERROR', 'MODEL_UNAVAILABLE']);

  const isRetryableError = (error) => retryableErrorCodes.has(String(error?.code || ''));

  const getPopupIcon = (variant) => {
    if (variant === 'warning') return <AlertTriangle size={16} />;
    if (variant === 'success') return <CheckCircle2 size={16} />;
    return <AlertCircle size={16} />;
  };

  const getPhaseLabel = (phase) => {
    if (phase === 'Uploading') return 'Uploading file...';
    if (phase === 'Parsing') return 'Parsing content...';
    if (phase === 'Generating') return 'Generating flashcards...';
    return 'Synthesizing Knowledge Vectors...';
  };

  const getAiSuggestedDeckTitle = (generatedCards, fallback = 'AI Deck') => {
    if (!Array.isArray(generatedCards) || generatedCards.length === 0) return fallback;

    const firstFront = String(generatedCards.find(c => String(c?.front || '').trim())?.front || '')
      .replace(/\*\*/g, '')
      .replace(/`/g, '')
      .replace(/^[-*\d.\s]+/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!firstFront) return fallback;
    return firstFront.length > 45 ? `${firstFront.slice(0, 45).trim()}...` : firstFront;
  };

  const buildDeckFromCards = (sourceTitle, generatedCards, sourceLabel = null, generationPrompt = '') => {
    const images = [
      chromeBrain, silverFluid, silverSphere, silverCircuit, obsidianCore,
      mercuryWave, silverHelix, neuralNebula, silverNucleus, obsidianTablet,
      mercurySplash, silverGrid, neuralCrystal, stellarSupernova, pulsarMagnetar,
      nonEuclidean, topographicGlobe, tectonicMantle, molecularLattice
    ];

    const aiTitle = getAiSuggestedDeckTitle(generatedCards, sourceTitle || 'AI Deck');

    return {
      id: Date.now().toString(),
      title: aiTitle,
      generationPrompt: String(generationPrompt || '').trim(),
      thumbnail: images[Math.floor(Math.random() * images.length)],
      labels: [
        'AI Synthesized',
        selectedModel.includes('2.5') ? 'Gemini 2.5' : 'Gemini 2.0',
        ...(sourceLabel ? [sourceLabel] : [])
      ],
      isPublic: false,
      isDiscoverable: false,
      discoverMetadata: {
        topic: '',
        level: '',
        language: ''
      },
      cards: generatedCards.map((c, i) => ({
        ...c,
        id: Date.now().toString() + i,
        lastOpened: null,
        nextReview: null,
        interval: 0,
        repetition: 0,
        easeFactor: 2.5
      }))
    };
  };

  const showGenerationDialog = (error, context = {}) => {
    const code = String(error?.code || '');
    const message = String(error?.message || 'Unknown generation error.');
    const isProd = Boolean(import.meta.env.PROD);

    if (message.toLowerCase().includes('cancelled')) {
      return;
    }

    const friendlyByCode = {
      INVALID_KEY: {
        variant: 'error',
        title: 'Gemini API Key Issue',
        body: 'AI configuration is invalid. Please update your API key and permissions.'
      },
      FILE_TOO_LARGE: {
        variant: 'warning',
        title: 'File Too Large',
        body: 'The uploaded file exceeds the size limit. Compress it or upload a smaller file.'
      },
      TIMEOUT: {
        variant: 'warning',
        title: 'Request Timeout',
        body: 'The request took too long. Retry, or shorten your prompt/instructions.'
      },
      MALFORMED_OUTPUT: {
        variant: 'warning',
        title: 'Malformed AI Output',
        body: 'The AI returned an invalid response format. Retry or switch model.'
      },
      MODEL_UNAVAILABLE: {
        variant: 'warning',
        title: 'Model Unavailable',
        body: 'Selected model is currently unavailable. Choose another model and retry.'
      },
      NETWORK_ERROR: {
        variant: 'warning',
        title: 'Network Error',
        body: 'Could not reach AI service. Check connectivity and retry.'
      },
      QUOTA_EXCEEDED: {
        variant: 'warning',
        title: 'Usage Limit Reached',
        body: 'AI generation limit reached for now. Please try again later.'
      }
    };

    if (friendlyByCode[code]) {
      const canRetry = isRetryableError(error);
      setPopupCard({
        ...friendlyByCode[code],
        canRetry,
        retryPrompt: context.retryPrompt || '',
        retryMode: context.retryMode || 'text'
      });
      return;
    }

    setPopupCard({
      title: 'Generation Error',
      body: isProd
        ? 'Unable to generate right now. Please retry in a moment.'
        : message,
      variant: 'error'
    });
  };

  const handleRetryFromPopup = () => {
    if (!popupCard?.canRetry) return;
    const retryPrompt = popupCard.retryPrompt || '';

    if (popupCard.retryMode === 'file' && !uploadFile) {
      setPopupCard({
        title: 'Retry Not Available',
        body: 'Please reselect your file and retry.',
        variant: 'warning'
      });
      return;
    }

    setPopupCard(null);
    handleGenerate(retryPrompt);
  };

  const handleGenerate = async (prompt, modelOverride = null) => {
    const trimmedPrompt = String(prompt || '').trim();
    const mode = uploadFile ? 'file' : 'text';
    const modelName = modelOverride || selectedModel;
    const requestId = Date.now();
    const isCancelled = () => {
      const active = activeGenerationRef.current;
      return active.id !== requestId || active.cancelled;
    };

    activeGenerationRef.current = { id: requestId, cancelled: false, mode };
    setIsGenerating(true);
    setGenerationPhase(mode === 'file' ? 'Uploading' : 'Generating');
    saveGenerationSnapshot({
      isGenerating: true,
      phase: mode === 'file' ? 'Uploading' : 'Generating',
      prompt: trimmedPrompt,
      model: modelName,
      mode,
      fileName: uploadFile?.name || '',
      startedAt: Date.now()
    });

    if (uploadFile) {
      const sourceFile = uploadFile;
      let shouldKeepUploadForRetry = false;

      try {
        const generatedCards = await generateFlashcardsFromFile(sourceFile, trimmedPrompt, modelName, {
          onPhaseChange: (phase) => {
            if (!isCancelled()) {
              setGenerationPhase(phase);
              saveGenerationSnapshot({
                isGenerating: true,
                phase,
                prompt: trimmedPrompt,
                model: modelName,
                mode,
                fileName: sourceFile?.name || '',
                startedAt: Date.now()
              });
            }
          },
          shouldCancel: isCancelled
        });

        if (isCancelled()) return;

        const deckTitle = sourceFile.name || 'Uploaded source';
        const sourceLabel = sourceFile.type === 'application/pdf' ? 'PDF Source' : 'Image Source';
        const newDeck = buildDeckFromCards(deckTitle, generatedCards, sourceLabel, trimmedPrompt);

        setDraftDeck(newDeck);
        setCommandPrompt('');
      } catch (error) {
        if (!isCancelled()) {
          console.error(error);
          shouldKeepUploadForRetry = isRetryableError(error);
          showGenerationDialog(error, { retryPrompt: trimmedPrompt, retryMode: 'file' });
        }
      } finally {
        if (activeGenerationRef.current.id === requestId) {
          if (!shouldKeepUploadForRetry) {
            resetUploadSelection();
          }
          setIsGenerating(false);
          setGenerationPhase('');
          clearGenerationSnapshot();
        }
      }

      return;
    }

    if (!trimmedPrompt) {
      return;
    }

    try {
      const generatedCards = await generateFlashcards(trimmedPrompt, modelName, {
        onPhaseChange: (phase) => {
          if (!isCancelled()) {
            setGenerationPhase(phase);
            saveGenerationSnapshot({
              isGenerating: true,
              phase,
              prompt: trimmedPrompt,
              model: modelName,
              mode,
              startedAt: Date.now()
            });
          }
        },
        shouldCancel: isCancelled
      });
      if (isCancelled()) return;
      const newDeck = buildDeckFromCards(trimmedPrompt, generatedCards, null, trimmedPrompt);

      setDraftDeck(newDeck);
      setCommandPrompt('');
    } catch (error) {
      if (!isCancelled()) {
        console.error(error);
        showGenerationDialog(error, { retryPrompt: trimmedPrompt, retryMode: 'text' });
      }
    } finally {
      if (activeGenerationRef.current.id === requestId) {
        setIsGenerating(false);
        setGenerationPhase('');
        clearGenerationSnapshot();
      }
    }
  };

  handleGenerateRef.current = handleGenerate;

  useEffect(() => {
    if (!resumeRequest || isGenerating) return;
    const next = resumeRequest;
    setResumeRequest(null);
    setPopupCard({
      variant: 'success',
      title: 'Resuming Generation',
      body: 'Restored your previous generation request.'
    });
    handleGenerateRef.current?.(next.prompt, next.modelName);
  }, [resumeRequest, isGenerating]);

  const handleCancelGeneration = () => {
    if (!isGenerating) return;
    activeGenerationRef.current = {
      id: Date.now(),
      cancelled: true,
      mode: activeGenerationRef.current.mode
    };
    setIsGenerating(false);
    setGenerationPhase('');
    clearGenerationSnapshot();
  };

  const resetUploadSelection = () => {
    setUploadFile(null);
    setUploadError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const trySetUploadFile = (candidate) => {
    if (!candidate) return;

    const isPdf = candidate.type === 'application/pdf';
    const isImage = candidate.type.startsWith('image/');
    if (!isPdf && !isImage) {
      setUploadError('Unsupported file type. Please upload one PDF or image.');
      setUploadFile(null);
      return;
    }

    const maxBytes = MAX_UPLOAD_MB * 1024 * 1024;
    if (candidate.size > maxBytes) {
      setUploadError(`File too large. Max size is ${MAX_UPLOAD_MB}MB.`);
      setUploadFile(null);
      return;
    }

    setUploadError('');
    setUploadFile(candidate);
  };

  const handleSaveDraft = (finalDeck) => {
    if (finalDeck.cards.length === 0) {
      setPopupCard({ title: 'Empty Deck', body: 'Cannot initialize an empty deck. Please keep at least one card.', variant: 'warning' });
      return;
    }

    addDeck(finalDeck);

    setDraftDeck(null);
    navigate(`/study/${finalDeck.id}`);
  };

  const handleDiscardDraft = () => {
    setDraftDeck(null);
    clearLastDraftSnapshot();
  };

  return (
    <>
      <Suspense fallback={null}>
        <DashboardOverlayEffects
          effect={dashboardOverlayEffect}
          intensity={dashboardOverlayIntensity}
          speed={dashboardOverlaySpeed}
        />
      </Suspense>
      <div className={`cinematic-backdrop ${isPromptFocused ? 'active' : ''}`}></div>
      
      <header className="stage-header">
        <div className="dashboard-command-stack">
          <AICommandInput
            onGenerate={handleGenerate}
            onFocus={handlePromptFocus}
            onBlur={handlePromptBlur}
            selectedModel={selectedModel}
            onModelChange={setSelectedModel}
            prompt={commandPrompt}
            onPromptChange={setCommandPrompt}
            enableSubmitWithoutPrompt={Boolean(uploadFile)}
            isSubmitting={isGenerating}
            placeholder={uploadFile
              ? 'Optional file instructions (e.g., focus on formulas, key definitions, exam style)'
              : 'Generate 20 cards on molecular biology...'}
          />

          <div className="dashboard-upload-panel">
            <div className="dashboard-upload-header">
              <span>Generate from PDF/image</span>
              <small>1 file only</small>
            </div>

            <div className="dashboard-upload-controls">
              <input
                ref={fileInputRef}
                type="file"
                className="dashboard-file-input"
                accept=".pdf,image/*"
                onChange={(e) => {
                  const selected = e.target.files?.[0] || null;
                  trySetUploadFile(selected);
                }}
              />

              <button
                type="button"
                className="dashboard-file-trigger"
                disabled={isGenerating}
                onClick={() => fileInputRef.current?.click()}
              >
                Choose File
              </button>
            </div>

            {uploadFile && (
              <div className="dashboard-upload-selected-row">
                <div className="dashboard-upload-selected" title={uploadFile.name}>
                  {uploadFile.name}
                </div>
                <button
                  type="button"
                  className="dashboard-upload-clear"
                  disabled={isGenerating}
                  onClick={resetUploadSelection}
                >
                  Unselect
                </button>
              </div>
            )}

            {uploadError && <div className="dashboard-upload-error">{uploadError}</div>}

          </div>
        </div>
      </header>

      <section className={`study-area ${isPromptFocused ? 'cinema-dim-target cinema-dim-active' : ''}`}>
        {isGenerating ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
            <Motion.div 
              className="skeleton-loader"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ padding: '0' }}
            >
              <div aria-live="polite" className="visually-hidden">Building semantic nodes...</div>
              <div className="pulse-card"></div>
            </Motion.div>
            <Motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.5 }}
              style={{ color: 'var(--primary)', fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
               <span className="spinner" style={{ width: '16px', height: '16px', border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></span>
               {getPhaseLabel(generationPhase)}
            </Motion.div>
            {isGenerating && (
              <button
                type="button"
                className="dashboard-generation-cancel"
                onClick={handleCancelGeneration}
              >
                Cancel
              </button>
            )}
          </div>
        ) : draftDeck ? (
          <Suspense fallback={<div style={{ minHeight: '220px' }} />}>
            <DraftEditor 
              draftDeck={draftDeck} 
              setDraftDeck={setDraftDeck} 
              onSave={handleSaveDraft} 
              onDiscard={handleDiscardDraft} 
            />
          </Suspense>
        ) : (
          <Motion.div 
            className="empty-state-hero"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Suspense fallback={<div style={{ minHeight: '180px' }} />}>
              <DeckGallery />
            </Suspense>
          </Motion.div>
        )}
      </section>

      <AnimatePresence>
        {popupCard && (
          <Motion.div
            className={`dashboard-popup-card ${popupCard.variant || 'error'}`}
            initial={{ opacity: 0, y: 18, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.96 }}
          >
            <div className="dashboard-popup-title-row">
              <span className="dashboard-popup-icon">{getPopupIcon(popupCard.variant || 'error')}</span>
              <div className="dashboard-popup-title">{popupCard.title}</div>
            </div>
            <div className="dashboard-popup-body">{popupCard.body}</div>
            <div className="dashboard-popup-actions">
              {popupCard.canRetry && (
                <button
                  type="button"
                  className="dashboard-popup-retry"
                  onClick={handleRetryFromPopup}
                >
                  <RefreshCw size={13} /> Retry
                </button>
              )}
              <button
                type="button"
                className="dashboard-popup-close"
                onClick={() => setPopupCard(null)}
              >
                Okay
              </button>
            </div>
          </Motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

