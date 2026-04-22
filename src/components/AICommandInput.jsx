import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import './AICommandInput.css';

const MODELS = [
  { id: 'gemini-2.5-flash', name: '2.5 Flash' },
  { id: 'gemini-2.5-pro', name: '2.5 Pro' },
  { id: 'gemini-2.0-flash', name: '2.0 Flash' }
];

const AICommandInput = React.memo(function AICommandInput({ onGenerate, onFocus, onBlur, selectedModel = 'gemini-2.5-flash', onModelChange, prompt, onPromptChange, placeholder = 'Generate 20 cards on molecular biology...', enableSubmitWithoutPrompt = false, isSubmitting = false }) {
  const [localPrompt, setLocalPrompt] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const inputRef = useRef(null);

  const isControlled = typeof prompt === 'string' && typeof onPromptChange === 'function';
  const resolvedPrompt = isControlled ? prompt : localPrompt;

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (resolvedPrompt.trim() || enableSubmitWithoutPrompt) {
      onGenerate(resolvedPrompt);
      if (isControlled) {
        onPromptChange('');
      } else {
        setLocalPrompt('');
      }
      inputRef.current.blur(); // Dismiss focus state explicitly
    }
  }, [isSubmitting, resolvedPrompt, enableSubmitWithoutPrompt, onGenerate, isControlled, onPromptChange]);

  const handlePromptInputChange = useCallback((event) => {
    const nextValue = event.target.value;
    if (isControlled) {
      onPromptChange(nextValue);
      return;
    }
    setLocalPrompt(nextValue);
  }, [isControlled, onPromptChange]);

  const toggleModelDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const handleModelSelect = useCallback((modelId) => {
    if (onModelChange) onModelChange(modelId);
    setIsDropdownOpen(false);
  }, [onModelChange]);

  const currentModelName = useMemo(
    () => MODELS.find((model) => model.id === selectedModel)?.name || 'Model',
    [selectedModel]
  );

  return (
    <form className="command-input-wrapper" onSubmit={handleSubmit} style={{ position: 'relative' }}>
      <Sparkles size={20} className="command-icon" />
      <input 
        ref={inputRef}
        type="text" 
        className="command-input" 
        placeholder={placeholder}
        value={resolvedPrompt}
        onChange={handlePromptInputChange}
        onFocus={onFocus}
        onBlur={onBlur}
      />

      <div className="model-selector-container">
        <button 
          type="button" 
          className="model-selector-btn"
          onClick={toggleModelDropdown}
          title="Select generative model"
        >
          {currentModelName} <ChevronDown size={14} />
        </button>
        
        {isDropdownOpen && (
          <div className="model-dropdown">
            {MODELS.map(m => (
              <div 
                key={m.id} 
                className={`model-option ${m.id === selectedModel ? 'active' : ''}`}
                onClick={() => handleModelSelect(m.id)}
              >
                {m.name}
              </div>
            ))}
          </div>
        )}
      </div>

      <button 
        type="submit" 
        className="command-submit"
        disabled={isSubmitting || (!resolvedPrompt.trim() && !enableSubmitWithoutPrompt)}
      >
        <ArrowRight size={18} />
      </button>
    </form>
  );
});

export default AICommandInput;

