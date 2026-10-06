// hooks/useUpgrade.js
import { useContext } from 'react';
import { UpgradeContext } from '../context/UpgradeContext';

/**
 * const { openUpgrade } = useUpgrade();
 * openUpgrade('mode_full', { trialUsed: true });
 * openUpgrade('dailyInterviewLimit', { resetsAt });
 */
const useUpgrade = () => {
  const ctx = useContext(UpgradeContext);
  if (!ctx) throw new Error('useUpgrade must be used inside <UpgradeProvider>');
  return ctx;
};
export default useUpgrade;
