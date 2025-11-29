import type * as types from 'notion-types'
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp'
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline'
import cs from 'classnames'
import * as React from 'react'
import { Breadcrumbs, Header, Search, useNotionContext } from 'react-notion-x'
import Link from 'next/link'
import { useMedia } from 'react-use' // 追加

import { isSearchEnabled, navigationLinks, navigationStyle } from '@/lib/config'
import * as config from '@/lib/config'
import { useDarkMode } from '@/lib/use-dark-mode'

import styles from './styles.module.css'

function ToggleThemeButton() {
  const [hasMounted, setHasMounted] = React.useState(false)
  const { isDarkMode, toggleDarkMode } = useDarkMode()

  React.useEffect(() => {
    setHasMounted(true)
  }, [])

  const onToggleTheme = React.useCallback(() => {
    toggleDarkMode()
  }, [toggleDarkMode])

  return (
    <div
      className={cs('breadcrumb', 'button', !hasMounted && styles.hidden)}
      onClick={onToggleTheme}
    >
      {hasMounted && isDarkMode ? <IoMoonSharp /> : <IoSunnyOutline />}
    </div>
  )
}

export function NotionPageHeader({
  block
}: {
  block: types.CollectionViewPageBlock | types.PageBlock | null
}) {
  const { components, mapPageUrl } = useNotionContext()
  
  // スマホ判定 (640px以下ならスマホモード)
  const isMobile = useMedia('(max-width: 640px)', false)

  if (navigationStyle === 'default') {
    if (!block) return null
    return <Header block={block} />
  }

  return (
    <header className='notion-header'>
      {/* スマホ用のスタイル調整（文字サイズと余白を詰める） */}
      <style jsx global>{`
        @media (max-width: 640px) {
          .notion-header .notion-nav-header {
            padding: 8px 10px;
            gap: 4px;
          }
          .notion-header .breadcrumb.button {
            padding: 4px 6px !important;
            font-size: 12px !important;
          }
          .notion-header .notion-nav-header-rhs {
            gap: 4px;
          }
          /* アイコンと文字の間隔調整 */
          .notion-header .breadcrumb .icon {
            margin-right: 2px;
          }
        }
      `}</style>

      <div className='notion-nav-header'>
        {block ? (
          <Breadcrumbs block={block} rootOnly={false} />
        ) : (
          <div className='breadcrumbs'>
             <Link href='/' className={cs('breadcrumb', 'button')} style={{ fontWeight: 600 }}>
               {/* スマホなら短いタイトルにする */}
               {isMobile ? 'Top' : config.name}
             </Link>
           </div>
        )}

        <div className='notion-nav-header-rhs breadcrumbs'>
          {navigationLinks
            ?.map((link, index) => {
              if (!link?.pageId && !link?.url) {
                return null
              }

              // ▼▼▼ スマホ用の短縮ラベル ▼▼▼
              let label = link.title
              if (isMobile) {
                if (link.title === '図鑑データ') label = '📊図鑑'
                if (link.title === '祈り計算機') label = '🎰祈り'
              }
              // ▲▲▲

              if (link.pageId) {
                if (components?.PageLink && mapPageUrl) {
                  return (
                    <components.PageLink
                      href={mapPageUrl(link.pageId)}
                      key={index}
                      className={cs(styles.navLink, 'breadcrumb', 'button')}
                    >
                      {label}
                    </components.PageLink>
                  )
                } else {
                   return null
                }
              } else {
                const isInternal = link.url && (link.url.startsWith('/') || link.url.includes('houkai-gakuen-wiki.com'));
                
                if (isInternal) {
                    const href = link.url!.replace('https://houkai-gakuen-wiki.com', '') || '/';
                    return (
                        <Link 
                            href={href} 
                            key={index}
                            className={cs(styles.navLink, 'breadcrumb', 'button')}
                        >
                           {label}
                        </Link>
                    )
                }

                return (
                  <components.Link
                    href={link.url}
                    key={index}
                    className={cs(styles.navLink, 'breadcrumb', 'button')}
                    target='_blank'
                    rel='noopener noreferrer'
                  >
                    {label}
                  </components.Link>
                )
              }
            })
            .filter(Boolean)}

          <ToggleThemeButton />

          {isSearchEnabled && block && <Search block={block} title={null} />}
        </div>
      </div>
    </header>
  )
}