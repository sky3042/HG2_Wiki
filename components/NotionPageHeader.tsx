import type * as types from 'notion-types'
import { IoMoonSharp } from '@react-icons/all-files/io5/IoMoonSharp'
import { IoSunnyOutline } from '@react-icons/all-files/io5/IoSunnyOutline'
import cs from 'classnames'
import * as React from 'react'
import { Breadcrumbs, Header, Search, useNotionContext } from 'react-notion-x'
import Link from 'next/link'

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

  if (navigationStyle === 'default') {
    if (!block) return null
    return <Header block={block} />
  }

  return (
    <header className='notion-header'>
      <div className='notion-nav-header'>
        {block ? (
          // ▼▼▼ 修正: rootOnly={false} にして階層を表示する ▼▼▼
          <Breadcrumbs block={block} rootOnly={false} />
        ) : (
          // カスタムページ用: サイトタイトルのみ表示（階層なし）
          <div className='breadcrumbs'>
             <Link href='/' className={cs('breadcrumb', 'button')} style={{ fontWeight: 600 }}>
               {config.name}
             </Link>
           </div>
        )}

        <div className='notion-nav-header-rhs breadcrumbs'>
          {navigationLinks
            ?.map((link, index) => {
              if (!link?.pageId && !link?.url) {
                return null
              }

              if (link.pageId) {
                if (components?.PageLink && mapPageUrl) {
                  return (
                    <components.PageLink
                      href={mapPageUrl(link.pageId)}
                      key={index}
                      className={cs(styles.navLink, 'breadcrumb', 'button')}
                    >
                      {link.title}
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
                           {link.title}
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
                    {link.title}
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