/**
 * FlagsList - Displays audit flags as clickable chips with details
 * Per Story 7.7: AC #2, #6 - Shows list of flags, clicking shows description
 */

import React, { useState } from 'react';
import { REASON_CODES, type ReasonCode, isHardFail } from '../../data/reasonCodes';
import styles from './FlagsList.module.css';

interface FlagsListProps {
  /** Array of flag codes (e.g., ['SF01', 'HF03']) */
  flags: string[];
}

export const FlagsList: React.FC<FlagsListProps> = ({ flags }) => {
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null);

  if (flags.length === 0) {
    return (
      <div className={styles.noFlags} data-testid="no-flags">
        No flags - all checks passed
      </div>
    );
  }

  const handleFlagClick = (flag: string) => {
    setSelectedFlag(selectedFlag === flag ? null : flag);
  };

  return (
    <div className={styles.container} data-testid="flags-list">
      <div className={styles.flagsGrid}>
        {flags.map((flag) => {
          const isHard = isHardFail(flag);
          const isSelected = selectedFlag === flag;

          return (
            <button
              key={flag}
              className={`${styles.flag} ${isHard ? styles.hard : styles.soft} ${isSelected ? styles.selected : ''}`}
              onClick={() => handleFlagClick(flag)}
              data-testid={`flag-${flag}`}
              aria-pressed={isSelected}
              aria-label={`${flag}: ${REASON_CODES[flag as ReasonCode]?.name ?? 'Unknown'}`}
            >
              {flag}
            </button>
          );
        })}
      </div>

      {selectedFlag && (
        <div className={styles.flagDetail} data-testid="flag-detail">
          <h4 className={styles.flagCode}>{selectedFlag}</h4>
          <p className={styles.name}>
            {REASON_CODES[selectedFlag as ReasonCode]?.name ?? 'Unknown Flag'}
          </p>
          <p className={styles.description}>
            {REASON_CODES[selectedFlag as ReasonCode]?.description ?? 'No description available'}
          </p>
          <p className={styles.solution}>
            <strong>Solution:</strong>{' '}
            {REASON_CODES[selectedFlag as ReasonCode]?.solution ?? 'No solution available'}
          </p>
        </div>
      )}
    </div>
  );
};

export default FlagsList;
