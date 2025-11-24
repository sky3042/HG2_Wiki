import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

// ▼▼▼ 設定：末尾を "output=xlsx" にしたURL ▼▼▼
const SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSvZfL_0EJO7E2hYvLIwa7NVsuFuz9dwKjoOUNXJalJotuLjs1U6mwY1q35pex8DvGtVW6qc_k8mIMO/pub?output=xlsx';

const DATA_DIR = path.join(process.cwd(), 'data');
const OUTPUT_FILE = path.join(DATA_DIR, 'spreadsheet.json');

async function main() {
  console.log('📊 Fetching Google Spreadsheet (Smart Wrap Mode)...');

  try {
    const response = await fetch(SPREADSHEET_URL);
    if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();

    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const allData: Record<string, any[][]> = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
      const rows: any[][] = [];

      for (let R = range.s.r; R <= range.e.r; ++R) {
        const row: any[] = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = worksheet[cellAddress];

          let value = '';
          if (cell) {
            const rawValue = String(cell.v || '');
            const formattedValue = cell.w;

            // ★ここが修正のポイント★
            // 1. 生の値に「改行」が含まれていれば、生の値を使う（文章とみなす）
            if (rawValue.includes('\n') || rawValue.includes('\r')) {
              value = rawValue;
            } 
            // 2. そうでなければ、フォーマット済みの値を使う（日付や数値をきれいに）
            else if (formattedValue) {
              value = formattedValue;
            } 
            // 3. どちらもなければ生の値
            else {
              value = rawValue;
            }
          }
          row.push(value);
        }
        rows.push(row);
      }

      if (rows.length > 0) {
        allData[sheetName] = rows;
        console.log(`   - Found sheet: "${sheetName}" (${rows.length} rows)`);
      }
    });

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allData, null, 2));
    console.log(`✅ Saved all sheets to ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('❌ Error fetching spreadsheet:', error);
    process.exit(1);
  }
}

main();