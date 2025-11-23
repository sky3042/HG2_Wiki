import { type ExtendedRecordMap } from 'notion-types'
import { parsePageId } from 'notion-utils'

import * as acl from './acl'
import { environment, pageUrlAdditions, pageUrlOverrides, site } from './config'
import { db } from './db'
import { getSiteMap } from './get-site-map' // 追加
import { getPage } from './notion'
import type { PageProps } from './types'

export async function resolveNotionPage(
  domain: string,
  rawPageId?: string
): Promise<PageProps> {
  let pageId: string | undefined
  let recordMap: ExtendedRecordMap

  if (rawPageId && rawPageId !== 'index') {
    pageId = parsePageId(rawPageId)!

    if (!pageId) {
      const override =
        pageUrlOverrides[rawPageId] || pageUrlAdditions[rawPageId]

      if (override) {
        pageId = parsePageId(override)!
      }
    }

    if (pageId) {
      recordMap = await getPage(pageId)
    } else {
      const siteMap = await getSiteMap()
      pageId = siteMap?.canonicalPageMap[rawPageId]

      if (pageId) {
        recordMap = await getPage(pageId)
      } else {
        return {
          error: {
            message: `Not found "${rawPageId}"`,
            statusCode: 404
          }
        }
      }
    }
  } else {
    pageId = site.rootNotionPageId
    recordMap = await getPage(pageId)
  }

  // ★サイトマップを取得してPropsに含める
  const siteMap = await getSiteMap()

  const props: PageProps = {
    site,
    recordMap,
    pageId,
    canonicalPageMap: siteMap?.canonicalPageMap
  }
  return { ...props, ...(await acl.pageAcl(props)) }
}