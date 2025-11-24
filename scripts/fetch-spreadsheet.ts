import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

// ▼▼▼ ここにスプレッドシートの公開URL（CSV）を貼ってください ▼▼▼
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvZfL_0EJO7E2hYvLIwa7NVsuFuz9dwKjoOUNXJalJotuLjs1U6mwY1q35pex8DvGtVW6qc_k8mIMO/pub?output=csv'; 

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'spreadsheet.json');

async function main() {
  console.log('📊 Fetching Google Spreadsheet...');

  try {
    // 1. CSVデータをダウンロード
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const csvText = await response.text();

    // 2. CSVをJSONオブジェクト(配列の配列)に変換
    const records = parse(csvText, {
      skip_empty_lines: true,
    });

    // 3. ファイルに保存
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(records, null, 2));
    console.log(`✅ Spreadsheet saved to ${OUTPUT_FILE} (${records.length} rows)`);

  } catch (error) {
    console.error('❌ Error fetching spreadsheet:', error);
    process.exit(1);
  }
}

main();