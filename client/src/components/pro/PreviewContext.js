import { createContext, useContext } from 'react';

/**
 * PreviewContext: true while a REAL Pro page is rendered as a locked preview for a free user.
 * Pro components check it and use the example payloads from previewData.js instead of calling
 * the server. A real Pro user never sees `true`, so their pages are untouched.
 */
export const PreviewContext = createContext(false);
export const useIsPreview = () => useContext(PreviewContext);
