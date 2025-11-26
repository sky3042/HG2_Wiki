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
  
  // SEO用タイトル（中黒をハイフンに置換）
  const seoTitle = title ? title.replace(/・/g, '-') : site?.name

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
      
      {/* ▼▼▼ 修正: site?.twitter を使用 ▼▼▼ */}
      {site?.twitter && (
        <meta name='twitter:site' content={`@${site.twitter}`} />
      )}

      <meta name='robots' content='index,follow' />
      <meta name='googlebot' content='index,follow' />

      <link rel='alternate' type='application/rss+xml' href={rss} title={site?.name} />

      {/* ▼▼▼ 修正: site?.fontFamily を使用 ▼▼▼ */}
      {site?.fontFamily && (
        <link
          rel='stylesheet'
          href={`https://fonts.googleapis.com/css?family=${site.fontFamily}`}
        />
      )}
    </Head>
  )
}