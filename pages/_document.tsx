import * as React from 'react'
import Document, { Head, Html, Main, NextScript } from 'next/document'
import { IconContext } from '@react-icons/all-files'

export default class MyDocument extends Document {
  override render() {
    return (
      <IconContext.Provider value={{ style: { verticalAlign: 'middle' } }}>
        <Html lang='ja'>
          <Head>
            <meta charSet='utf-8' />
            
            {/* 1. 基本のファビコン (ブラウザタブ用) */}
            <link rel='shortcut icon' href='/favicon.ico' />
            
            {/* 2. Google検索結果用 (重要: 192x192のPNGを指定) */}
            <link rel='icon' type='image/png' sizes='192x192' href='/favicon-192x192.png' />
            
            {/* 3. iPhone/iPad用 */}
            <link rel='apple-touch-icon' sizes='180x180' href='/apple-touch-icon.png' />

            {/* 4. Android/PWA用マニフェスト */}
            <link rel='manifest' href='/manifest.json' />
          </Head>

          <body>
            <script
              dangerouslySetInnerHTML={{
                __html: `
/** Inlined version of noflash.js from use-dark-mode */
;(function () {
  var storageKey = 'darkMode'
  var classNameDark = 'dark-mode'
  var classNameLight = 'light-mode'
  function setClassOnDocumentBody(darkMode) {
    document.body.classList.add(darkMode ? classNameDark : classNameLight)
    document.body.classList.remove(darkMode ? classNameLight : classNameDark)
  }
  var preferDarkQuery = '(prefers-color-scheme: dark)'
  var mql = window.matchMedia(preferDarkQuery)
  var supportsColorSchemeQuery = mql.media === preferDarkQuery
  var localStorageTheme = null
  try {
    localStorageTheme = localStorage.getItem(storageKey)
  } catch (err) {}
  var localStorageExists = localStorageTheme !== null
  if (localStorageExists) {
    localStorageTheme = JSON.parse(localStorageTheme)
  }
  if (localStorageExists) {
    setClassOnDocumentBody(localStorageTheme)
  } else if (supportsColorSchemeQuery) {
    setClassOnDocumentBody(mql.matches)
    localStorage.setItem(storageKey, mql.matches)
  } else {
    var isDarkMode = document.body.classList.contains(classNameDark)
    localStorage.setItem(storageKey, JSON.stringify(isDarkMode))
  }
})();
`
              }}
            />
            <Main />
            <NextScript />
          </body>
        </Html>
      </IconContext.Provider>
    )
  }
}