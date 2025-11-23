import { type ExtendedRecordMap } from 'notion-types'
import { parsePageId, uuidToId } from 'notion-utils'

import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import { type CanonicalPageMap, type Site } from './types'

const uuid = !!includeNotionIdInUrls

export const mapPageUrl =
  (
    site: Site,
    recordMap: ExtendedRecordMap,
    searchParams: URLSearchParams,
    canonicalPageMap?: CanonicalPageMap
  ) => {
    // 高速検索用の「ID逆引き辞典」を作成
    const pageIdToUrl = new Map<string, string>()
    
    if (canonicalPageMap) {
      for (const url of Object.keys(canonicalPageMap)) {
        const id = uuidToId(canonicalPageMap[url]!)
        if (id) {
          // ▼▼▼ 修正: IDを小文字に統一して登録 ▼▼▼
          pageIdToUrl.set(id.toLowerCase(), url)
        }
      }
    }

    return (pageId = '') => {
      let anchor = ''
      let cleanPageIdString = pageId

      if (pageId && pageId.includes('#')) {
        const parts = pageId.split('#')
        cleanPageIdString = parts[0] ?? ''
        if (parts.length > 1) {
          anchor = `#${parts[1]}`
        }
      }

      const pageUuid = parsePageId(cleanPageIdString, { uuid: true })

      if (!pageUuid) {
        return createUrl('/', searchParams)
      }

      if (uuidToId(pageUuid) === site.rootNotionPageId) {
        return createUrl('/', searchParams) + anchor
      }

      // 2. 辞書を使って正しいURLを検索
      const cleanUuid = uuidToId(pageUuid)
      // ▼▼▼ 修正: 検索時も小文字に統一して探す ▼▼▼
      const lookupId = cleanUuid.toLowerCase()

      if (pageIdToUrl.has(lookupId)) {
        return createUrl(`/${pageIdToUrl.get(lookupId)}`, searchParams) + anchor
      }
      // ▲▲▲ ここまで ▲▲▲

      // 3. ブロックリンク対応
      const block = recordMap.block[pageUuid]?.value

      if (block) {
        const type = block.type as string
        if (type !== 'page' && type !== 'collection_view_page') {
          let parent = block
          while (parent && (parent.type as string) !== 'page' && (parent.type as string) !== 'collection_view_page' && parent.parent_id) {
             const parentBlock = recordMap.block[parent.parent_id]?.value
             if (parentBlock) {
               parent = parentBlock
             } else {
               break
             }
          }

          if (parent) {
             const parentUuid = parent.id
             let parentUrl = ''
             const parentCleanUuid = uuidToId(parentUuid).toLowerCase() // ここも小文字化

             if (pageIdToUrl.has(parentCleanUuid)) {
               parentUrl = pageIdToUrl.get(parentCleanUuid)!
             } else {
               parentUrl = getCanonicalPageId(parentUuid, recordMap, { uuid }) || uuidToId(parentUuid)
             }

             const base = createUrl(`/${parentUrl}`, searchParams)
             return `${base}#${uuidToId(pageUuid)}`
          }
        }
      }

      return createUrl(
        `/${getCanonicalPageId(pageUuid, recordMap, { uuid })}`,
        searchParams
      ) + anchor
    }
  }

export const getCanonicalPageUrl =
  (site: Site, recordMap: ExtendedRecordMap) =>
  (pageId = '') => {
    const pageUuid = parsePageId(pageId, { uuid: true })

    if (!pageUuid) {
      return undefined
    }

    if (uuidToId(pageId) === site.rootNotionPageId) {
      return `https://${site.domain}`
    }

    return `https://${site.domain}/${getCanonicalPageId(pageUuid, recordMap, {
      uuid
    })}`
  }

function createUrl(path: string, searchParams: URLSearchParams) {
  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}