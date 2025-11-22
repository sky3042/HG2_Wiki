import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NotionAPI } from 'notion-client';
import { getAllPagesInSpace } from 'notion-utils';
import type { ExtendedRecordMap } from 'notion-types';

// 環境変数をロード
dotenv.config();

const notion = new NotionAPI({
  authToken: process.env.NOTION_TOKEN,
  activeUser: process.env.NOTION_ACTIVE_USER,
});

// あなたのルートページID
const ROOT_PAGE_ID = '1ac3b07c81ff80d184a1f564abe7fef3'; 

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Notionデータのダウンロードを開始します...');
  
  const existingFiles = new Set(
    fs.readdirSync(DATA_DIR).map((f: string) => f.replace('.json', ''))
  );

  await getAllPagesInSpace(
    ROOT_PAGE_ID,
    undefined,
    async (pageId: string) => {
      const cleanId = pageId.replace(/-/g, '');

      // ローカルにキャッシュがある場合
      if (existingFiles.has(cleanId)) {
        console.log(`⏩ Skipped (Cached): ${cleanId}`);
        const data = fs.readFileSync(path.join(DATA_DIR, `${cleanId}.json`), 'utf-8');
        // 【修正ポイント】ここで型を強制的に指定 (as ExtendedRecordMap)
        return JSON.parse(data) as ExtendedRecordMap;
      }

      // キャッシュがない場合、APIから取得
      try {
        console.log(`📥 Fetching: ${cleanId}`);
        const recordMap = await notion.getPage(pageId);
        
        const filePath = path.join(DATA_DIR, `${cleanId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
        
        await sleep(400); 
        
        return recordMap;
      } catch (err: any) {
        console.error(`❌ Error fetching ${cleanId}:`, err.message);
        throw err;
      }
    },
    {
      concurrency: 1,
      traverseCollections: true,
    }
  );

  console.log(`🎉 完了`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});