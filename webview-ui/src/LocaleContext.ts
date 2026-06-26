import { createContext } from 'react';

import { type Locale,t, translateStatus } from './i18n.js';

export const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: Parameters<typeof t>[0]) => string;
  translateStatus: (status: string) => string;
}>({
  locale: 'en',
  setLocale: () => undefined,
  t: (key) => t(key, 'en'),
  translateStatus: (s) => translateStatus(s, 'en'),
});
