import * as fs from 'node:fs'
import * as path from 'node:path'
import { getPageProperty } from 'notion-utils'

import * as config from './config'
import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'
import type * as types from './types'

const uuid = !!includeNotionIdInUrls

export async function getSiteMap(): Promise<types.SiteMap> {
  const dataDir = path.join(process.cwd(), 'data')
  const pageMap: types.PageMap = {}

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f) => f.endsWith('.json'))
    
    for (const file of files) {
      const pageId = file.replace('.json', '')
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf8')
        const recordMap = JSON.parse(content) as unknown as types.ExtendedRecordMap
        pageMap[pageId] = recordMap
      } catch (err) {
        console.warn(`Failed to load ${file} for sitemap`, err)
      }
    }
  } else {
    console.warn('No local data found. Run `npm run fetch-data` first.')
  }

  const canonicalPageMap = Object.keys(pageMap).reduce(
    (map: Record<string, string>, pageId: string) => {
      const recordMap = pageMap[pageId]
      if (!recordMap) return map

      const block = recordMap.block[pageId]?.value
      
      if (
        !(getPageProperty<boolean | null>('Public', block!, recordMap) ?? true)
      ) {
        return map
      }

      const canonicalPageId = getCanonicalPageId(pageId, recordMap, {
        uuid
      })!

      if (map[canonicalPageId]) {
        return map
      } else {
        return {
          ...map,
          [canonicalPageId]: pageId
        }
      }
    },
    {}
  )

  return {
    site: config.site,
    pageMap,
    canonicalPageMap
  }
}