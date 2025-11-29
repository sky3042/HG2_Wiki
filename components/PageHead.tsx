import Head from 'next/head'
import * as React from 'react'

import * as types from '@/lib/types'
import * as config from '@/lib/config'

export const PageHead = ({
  site,
  title,
  description,
  image,
  url,
  rssFeedUrl
}: types.PageProps & {
  title?: string
  description?: string
  image?: string
  url?: string
  rssFeedUrl?: string
  isBlogPost?: boolean
}) => {
  const rss = rssFeedUrl || `${config.host}/feed`
  
  // SEO用タイトル
  // ★修正点：replaceを削除し、中点（・）のまま表示するように戻しました
  const seoTitle = title || site?.name
  
  // 現在のページのURL（canonical URL）
  const canonicalUrl = url || config.host

  // ▼▼▼ 追加：構造化データ (JSON-LD) ▼▼▼
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': site?.name || 'Home',
        'item': config.host
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': title || 'Page',
        'item': canonicalUrl
      }
    ]
  }
  // ▲▲▲ ここまで ▲▲▲

  return (
    <Head>
      <meta charSet='utf-8' />
      <meta httpEquiv='Content-Type' content='text/html; charset=utf-8' />
      <meta
        name='viewport'
        content='width=device-width, initial-scale=1, shrink-to-fit=no'
      />

      <title>{seoTitle}</title>
      <meta name='theme-color' content='#2f3437' />
      <meta name='msapplication-navbutton-color' content='#2f3437' />
      <meta name='apple-mobile-web-app-status-bar-style' content='black-translucent' />
      <meta name='msapplication-TileColor' content='#2f3437' />
      <meta name='referrer' content='origin-when-cross-origin' />
      <meta name='google-site-verification' content='google-site-verification=...' /> 

      <meta property='og:type' content='website' />
      <meta property='og:site_name' content={site?.name} />
      <meta property='og:title' content={seoTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:image' content={image} />
      
      {url && <meta property='og:url' content={url} />}

      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={seoTitle} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={image} />
      
      {site?.twitter && (
        <meta name='twitter:site' content={`@${site.twitter}`} />
      )}

      <meta name='robots' content='index,follow' />
      <meta name='googlebot' content='index,follow' />

      <link rel='alternate' type='application/rss+xml' href={rss} title={site?.name} />

      {site?.fontFamily && (
        <link
          rel='stylesheet'
          href={`https://fonts.googleapis.com/css?family=${site.fontFamily}`}
        />
      )}

      {/* ▼▼▼ 追加：JSON-LDを埋め込む ▼▼▼ */}
      <script
        type='application/ld+json'
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </Head>
  )
}