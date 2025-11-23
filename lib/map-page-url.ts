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
          pageIdToUrl.set(id.toLowerCase(), url)
        }
      }
    }

    return (pageId = '') => {
      // 1. アンカー(#以降)があれば退避
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

      // 2. 辞書を使って正しいURLを検索（ページの場合）
      const cleanUuid = uuidToId(pageUuid)
      const lookupId = cleanUuid.toLowerCase()

      if (pageIdToUrl.has(lookupId)) {
        return createUrl(`/${pageIdToUrl.get(lookupId)}`, searchParams) + anchor
      }

      // 3. 辞書にない場合、それが「ブロック」かどうか確認する
      const block = recordMap.block[pageUuid]?.value

      if (block) {
        const type = block.type as string
        // ページ自体ではない場合（＝見出しやテキストへのリンク）
        if (type !== 'page' && type !== 'collection_view_page') {
          
          // 親ページまで遡る
          let parent = block
          while (parent && (parent.type as string) !== 'page' && (parent.type as string) !== 'collection_view_page' && parent.parent_id) {
             const parentBlock = recordMap.block[parent.parent_id]?.value
             if (parentBlock) {
               parent = parentBlock
             } else {
               break
             }
          }

          // 親ページが見つかったら、そのURLを取得してアンカーをつける
          if (parent) {
             const parentUuid = parent.id
             let parentUrl = ''
             const parentCleanUuid = uuidToId(parentUuid).toLowerCase()

             // 親ページのURLを辞書から探す
             if (pageIdToUrl.has(parentCleanUuid)) {
               parentUrl = pageIdToUrl.get(parentCleanUuid)!
             } else {
               // 辞書になければ基本生成
               parentUrl = getCanonicalPageId(parentUuid, recordMap, { uuid }) || uuidToId(parentUuid)
             }

             // URL + クエリ + #ブロックID
             const base = createUrl(`/${parentUrl}`, searchParams)
             return `${base}#${uuidToId(pageUuid)}`
          }
        }
      }

      // 4. 通常生成（フォールバック）
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