import { type ExtendedRecordMap } from 'notion-types'
import {
  getCanonicalPageId as getCanonicalPageIdImpl,
  parsePageId,
  getPageProperty,
  getBlockTitle
} from 'notion-utils'

import { inversePageUrlOverrides } from './config'

export function getCanonicalPageId(
  pageId: string,
  recordMap: ExtendedRecordMap,
  { uuid = true }: { uuid?: boolean } = {}
): string | null {
  const cleanPageId = parsePageId(pageId, { uuid: false })
  if (!cleanPageId) {
    return null
  }

  const override = inversePageUrlOverrides[cleanPageId]
  if (override) {
    return override
  }

  let block = recordMap.block[pageId]?.value
  if (!block) {
    const values = Object.values(recordMap.block)
    if (values.length > 0) {
       block = values[0]?.value
    }
  }

  if (block) {
    // Slugがあればそれを使う
    const slug = getPageProperty<string>('Slug', block, recordMap)
    if (slug) {
      return slug
    }

    // Slugがなければ、必ず「タイトル-ID」を返す（基本動作）
    const title = getBlockTitle(block, recordMap)
    if (title) {
      const cleanTitle = title.trim().replace(/\s+/g, '-')
      return `${cleanTitle}-${cleanPageId}`
    }
  }

  return getCanonicalPageIdImpl(pageId, recordMap, { uuid }) || cleanPageId
}