import 'server-only'

import { cookies, headers } from 'next/headers'
import Negotiator from 'negotiator'
import { match } from '@formatjs/intl-localematcher'
import type { Locale } from '.'

export const getLocaleOnServer = (): Locale => {
  try {
    const locales: string[] = ['en', 'ko', 'ja', 'zh', 'es', 'vi']
    let languages: string[] = []

    const localeCookie = cookies().get('locale')
    if (localeCookie?.value) {
      languages = [localeCookie.value]
    }
    else {
      const negotiatorHeaders: Record<string, string> = {}
      headers().forEach((value, key) => (negotiatorHeaders[key] = value))
      languages = new Negotiator({ headers: negotiatorHeaders }).languages()
    }

    const matchedLocale = match(languages, locales, 'en') as Locale
    return matchedLocale
  }
  catch (error) {
    return 'en' as Locale
  }
}
