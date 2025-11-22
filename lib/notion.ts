import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  type ExtendedRecordMap,
  type SearchParams,
  type SearchResults
} from 'notion-types'
import { mergeRecordMaps } from 'notion-utils'
import pMap from 'p-map'
import pMemoize from 'p-memoize'

import {
  isPreviewImageSupportEnabled,
  navigationLinks,
  navigationStyle
} from './config'
import { getTweetsMap } from './get-tweets'
import { notion } from './notion-api'
import { getPreviewImageMap } from './preview-images'

async function fetchPageData(pageId: string): Promise<ExtendedRecordMap> {
  const cleanId = pageId.replaceAll('-', '')
  
  const cachePath = path.join(process.cwd(), 'data', `${cleanId}.json`)

  if (fs.existsSync(cachePath)) {
    try {
      const fileContent = fs.readFileSync(cachePath, 'utf8')
      const recordMap = JSON.parse(fileContent) as ExtendedRecordMap
      return recordMap
    } catch (err) {
      console.warn(`Error reading local cache for ${cleanId}, falling back to API.`, err)
    }
  }

  console.warn(`Cache miss: Fetching from API for ${pageId}`)
  return notion.getPage(pageId)
}

const getNavigationLinkPages = pMemoize(
  async (): Promise<ExtendedRecordMap[]> => {
    const navigationLinkPageIds = (navigationLinks || [])
      .map((link) => link?.pageId)
      .filter(Boolean)

    if (navigationStyle !== 'default' && navigationLinkPageIds.length) {
      return pMap(
        navigationLinkPageIds,
        async (navigationLinkPageId) =>
          fetchPageData(navigationLinkPageId as string),
        {
          concurrency: 4
        }
      )
    }

    return []
  }
)

export async function getPage(pageId: string): Promise<ExtendedRecordMap> {
  let recordMap = await fetchPageData(pageId)

  if (navigationStyle !== 'default') {
    const navigationLinkRecordMaps = await getNavigationLinkPages()

    if (navigationLinkRecordMaps?.length) {
      recordMap = navigationLinkRecordMaps.reduce(
        (map, navigationLinkRecordMap) =>
          mergeRecordMaps(map, navigationLinkRecordMap),
        recordMap
      )
    }
  }

  if (isPreviewImageSupportEnabled) {
    const previewImageMap = await getPreviewImageMap(recordMap)
    ;(recordMap as any).preview_images = previewImageMap
  }

  await getTweetsMap(recordMap)

  return recordMap
}

export async function search(params: SearchParams): Promise<SearchResults> {
  return notion.search(params)
}