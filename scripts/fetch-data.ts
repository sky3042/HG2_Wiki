import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { NotionAPI } from 'notion-client';
import { getAllPagesInSpace, getBlockTitle } from 'notion-utils';
import type { ExtendedRecordMap } from 'notion-types';

// 環境変数をロード
dotenv.config();

const notion = new NotionAPI({
  authToken: process.env.NOTION_TOKEN,
  activeUser: process.env.NOTION_ACTIVE_USER,
});

// あなたの本番ルートページID
const ROOT_PAGE_ID = '1ac3b07c81ff80d184a1f564abe7fef3'; 

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log('🚀 Notionデータの増分更新（タイムスタンプ比較）を開始します...');
  
  const updatedPages: string[] = [];
  const newPages: string[] = [];
  const skippedPages: string[] = [];

  // 1. ローカルにあるファイルのリストを確認
  const localFiles = new Set<string>();
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        localFiles.add(file.replace('.json', ''));
      }
    }
  }

  await getAllPagesInSpace(
    ROOT_PAGE_ID,
    undefined,
    async (pageId: string) => {
      const cleanId = pageId.replace(/-/g, '');
      const filePath = path.join(DATA_DIR, `${cleanId}.json`);

      try {
        // Notionから最新データを取得
        const recordMap = await notion.getPage(pageId);

        // ▼▼▼ 修正ロジック（ここへ移動しました） ▼▼▼
        // データを保存する前に、必ず構造をチェックして修正する
        if (recordMap.block) {
          for (const key in recordMap.block) {
            const block = recordMap.block[key];

            // 安全チェック
            if (!block || !block.value) continue;

            // 二重ラップ（value.value）を検知する
            const innerValue = (block.value as any).value;

            if (innerValue) {
              console.log(`⚠️ DETECTED double nesting in block: ${key}`);
              
              // 修正を実行
              block.value = innerValue;
              
              // 修正できたか確認
              if ((block.value as any).id === innerValue.id) {
                 // console.log(`   -> ✅ Fixed successfully.`); // ログが多すぎる場合はコメントアウト
              }
            }
          }
        }
        // ▲▲▲ 修正ロジック終了 ▲▲▲
        
        // ブロック情報の取得（修正後のデータを使う）
        const block = recordMap.block[pageId]?.value;
        const title = block 
          ? (getBlockTitle(block, recordMap) || 'Untitled') 
          : 'Unknown Page';

        // A. 新規ページの場合 -> 保存
        if (!localFiles.has(cleanId)) {
            console.log(`✨ New: "${title}"`);
            fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
            newPages.push(title);
            await sleep(300);
            return recordMap;
        }

        // B. 既存ページの場合 -> タイムスタンプ比較
        if (fs.existsSync(filePath)) {
            // ローカルのデータを読み込んで最終更新日時を取得
            const oldData = fs.readFileSync(filePath, 'utf-8');
            const oldRecordMap = JSON.parse(oldData) as ExtendedRecordMap;
            const oldBlock = oldRecordMap.block[pageId]?.value;
            
            const oldTime = oldBlock?.last_edited_time || 0;
            const newTime = block?.last_edited_time || 0;

            // タイムスタンプが同じなら保存しない（スキップ）
            if (oldTime === newTime) {
                skippedPages.push(title);
                return recordMap; 
            }
        }

        // 変更あり -> 保存
        console.log(`🔄 Updated: "${title}"`);
        fs.writeFileSync(filePath, JSON.stringify(recordMap, null, 2));
        updatedPages.push(title);
        
        await sleep(300); 
        return recordMap;

      } catch (err: any) {
        console.error(`❌ Error fetching ${cleanId}:`, err.message);
        if (localFiles.has(cleanId)) {
            const data = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(data) as ExtendedRecordMap;
        }
        throw err;
      }
    },
    {
      concurrency: 1,
      traverseCollections: true,
    }
  );

  console.log('\n' + '='.repeat(40));
  console.log('🎉 処理完了');
  console.log(`新規: ${newPages.length} / 更新: ${updatedPages.length} / 変化なし: ${skippedPages.length}`);
  
  if (newPages.length > 0) {
    console.log('\n[新規ページ]');
    newPages.forEach(p => console.log(`  + ${p}`));
  }
  if (updatedPages.length > 0) {
    console.log('\n[更新されたページ]');
    updatedPages.forEach(p => console.log(`  * ${p}`));
  }
  console.log('='.repeat(40) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});