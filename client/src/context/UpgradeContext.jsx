import { createContext, useCallback, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import UpgradeModal from '../components/UpgradeModal';

export const UpgradeContext = createContext(null);

/**
 * One modal for the whole app. Any page calls openUpgrade(feature, opts) and
 * the same, consistent upgrade experience appears — no per-page modal state.
 * Must sit INSIDE <BrowserRouter> (the modal navigates to /pricing).
 */
export function UpgradeProvider({ children }) {
  const [state, setState] = useState({ open: false, feature: null, opts: {} });

  const openUpgrade  = useCallback((feature, opts = {}) => setState({ open: true, feature, opts }), []);
  const closeUpgrade = useCallback(() => setState((s) => ({ ...s, open: false })), []);

  const value = useMemo(() => ({ openUpgrade, closeUpgrade }), [openUpgrade, closeUpgrade]);

  return (
    <UpgradeContext.Provider value={value}>
      {children}
      <UpgradeModal
        open={state.open}
        onClose={closeUpgrade}
        feature={state.feature}
        trialUsed={state.opts.trialUsed}
        resetsAt={state.opts.resetsAt}
      />
    </UpgradeContext.Provider>
  );
}
UpgradeProvider.propTypes = { children: PropTypes.node };
