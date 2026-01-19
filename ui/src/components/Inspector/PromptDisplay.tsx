/**
 * PromptDisplay - Shows the generation prompt with copy and expand
 * Per Story 7.7: AC #4 - Shows exact prompt that generated this frame
 */

import React, { useState, useCallback } from 'react';
import styles from './PromptDisplay.module.css';

interface PromptDisplayProps {
  /** The prompt text to display */
  prompt: string;
  /** Maximum lines to show before truncation (default: 4) */
  maxLines?: number;
}

const TRUNCATE_LENGTH = 200;

export const PromptDisplay: React.FC<PromptDisplayProps> = ({
  prompt,
  maxLines = 4,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const needsTruncation = prompt.length > TRUNCATE_LENGTH;
  const displayText = needsTruncation && !isExpanded
    ? prompt.slice(0, TRUNCATE_LENGTH) + '...'
    : prompt;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = prompt;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [prompt]);

  const toggleExpand = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  if (!prompt || prompt === 'No prompt recorded') {
    return (
      <div className={styles.noPrompt} data-testid="no-prompt">
        No prompt recorded
      </div>
    );
  }

  return (
    <div className={styles.container} data-testid="prompt-display">
      <div className={styles.header}>
        <button
          className={styles.copyButton}
          onClick={handleCopy}
          data-testid="copy-button"
          aria-label="Copy prompt to clipboard"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div
        className={`${styles.promptText} ${isExpanded ? styles.expanded : ''}`}
        data-testid="prompt-text"
        style={{ maxHeight: isExpanded ? 'none' : `${maxLines * 1.5}em` }}
      >
        {displayText}
      </div>
      {needsTruncation && (
        <button
          className={styles.expandButton}
          onClick={toggleExpand}
          data-testid="expand-button"
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
};

export default PromptDisplay;
