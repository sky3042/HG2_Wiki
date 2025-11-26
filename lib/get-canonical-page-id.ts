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
    // A. Slugがあれば最優先
    const slug = getPageProperty<string>('Slug', block, recordMap)
    if (slug) {
      return slug
    }

    // B. Slugがない場合、必ず「タイトル-ID」を返す（安全なフォールバック）
    const title = getBlockTitle(block, recordMap)
    if (title) {
      // ▼▼▼ 修正箇所：スペース(\s) または 中黒(・) をハイフンに置換 ▼▼▼
      const cleanTitle = title.trim().replace(/[\s\u30FB]+/g, '-')
      // ▲▲▲
      return `${cleanTitle}-${cleanPageId}`
    }
  }

  return getCanonicalPageIdImpl(pageId, recordMap, { uuid }) || cleanPageId
}