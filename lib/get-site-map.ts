import * as fs from 'fs';
import * as path from 'path';
import { getPageProperty } from 'notion-utils'
import type * as types from './types'
import * as config from './config'
import { includeNotionIdInUrls } from './config'
import { getCanonicalPageId } from './get-canonical-page-id'

const uuid = !!includeNotionIdInUrls

export async function getSiteMap(): Promise<types.SiteMap> {
  const dataDir = path.join(process.cwd(), 'data');
  const pageMap: types.PageMap = {};

  if (fs.existsSync(dataDir)) {
    const files = fs.readdirSync(dataDir).filter((f: string) => f.endsWith('.json'));
    
    for (const file of files) {
      const pageId = file.replace('.json', '');
      try {
        const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
        // 【修正】 as any as types.ExtendedRecordMap を追加して型エラーを回避
        const recordMap = JSON.parse(content) as any as types.ExtendedRecordMap;
        pageMap[pageId] = recordMap;
      } catch (e) {
        console.warn(`Failed to load ${file} for sitemap`);
      }
    }
  } else {
    console.warn('No local data found. Run `npm run fetch-data` first.');
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
  } as types.SiteMap
}