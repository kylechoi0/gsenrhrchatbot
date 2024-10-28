export const i18n = {
  defaultLocale: 'ko',
  locales: ['en', 'es', 'zh-Hans', 'ja', 'ko'],
} as const

export type Locale = typeof i18n['locales'][number]
