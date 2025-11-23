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
    // 住所録検索用のインデックス
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

      const cleanUuid = uuidToId(pageUuid)
      const lookupId = cleanUuid.toLowerCase()

      // ★住所録にあれば、そのURL（IDなしかもしれない）を使う
      if (pageIdToUrl.has(lookupId)) {
        return createUrl(`/${pageIdToUrl.get(lookupId)}`, searchParams) + anchor
      }

      // ★住所録になければ、基本ルール（タイトル-ID）を使うので404にはならない
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