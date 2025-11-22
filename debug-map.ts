// debug-map.ts
import { getSiteMap } from './lib/get-site-map';
import { includeNotionIdInUrls } from './lib/config';

async function main() {
  console.log('--- Debugging Site Map ---');
  console.log(`Config: includeNotionIdInUrls = ${includeNotionIdInUrls}`);
  
  console.log('Loading site map from local data...');
  try {
    const siteMap = await getSiteMap();
    const map = siteMap.canonicalPageMap;
    const keys = Object.keys(map);

    console.log(`Found ${keys.length} pages in the map.`);
    
    if (keys.length === 0) {
      console.error('❌ Error: Site map is empty! JSON data might be missing or invalid.');
    } else {
      console.log('--- Generated URLs (Sample) ---');
      // 最初の20件だけ表示
      keys.slice(0, 20).forEach(url => {
        console.log(`URL: /${url}  ->  ID: ${map[url]}`);
      });
      
      // ユーザーが気にしている "characters" があるかチェック
      if (keys.includes('characters')) {
        console.log('✅ Success: "characters" slug found!');
      } else {
        console.log('⚠️ Warning: "characters" slug NOT found.');
        // 似たようなものがあるか探す
        const similar = keys.find(k => k.includes('characters') || k.includes('登場人物'));
        if (similar) {
          console.log(`   Found this instead: /${similar}`);
        }
      }
    }
  } catch (e) {
    console.error('Error generating site map:', e);
  }
}

main();