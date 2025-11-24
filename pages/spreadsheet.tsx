import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'

type SheetData = Record<string, any[][]>;

const ITEMS_PER_PAGE = 100;

export async function getStaticProps() {
  try {
    const jsonPath = path.join(process.cwd(), 'data', 'spreadsheet.json')
    if (!fs.existsSync(jsonPath)) {
      return { props: { sheets: {} }, revalidate: 10 }
    }
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'))
    return {
      props: { sheets: data },
      revalidate: 10
    }
  } catch (e) {
    console.error('Failed to load spreadsheet data', e)
    return { props: { sheets: {} } }
  }
}

export default function SpreadsheetPage({ sheets }: { sheets: SheetData }) {
  const sheetNames = Object.keys(sheets);
  
  // --- 状態管理 ---
  const [activeTab, setActiveTab] = React.useState(sheetNames[0] || '');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortConfig, setSortConfig] = React.useState<{ colIndex: number, direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);

  // --- データ処理ロジック ---
  const rawData = sheets[activeTab] || [];
  const header = rawData[0] || [];
  const bodyRows = rawData.slice(1);

  // 1. 検索（全件フィルタリング）
  const filteredRows = React.useMemo(() => {
    if (!searchQuery) return bodyRows;
    const lowerQuery = searchQuery.toLowerCase();
    return bodyRows.filter(row => 
      row.some((cell: any) => String(cell).toLowerCase().includes(lowerQuery))
    );
  }, [bodyRows, searchQuery]);

  // 2. 並べ替え
  const sortedRows = React.useMemo(() => {
    if (!sortConfig) return filteredRows;
    const sorted = [...filteredRows].sort((a, b) => {
      const cellA = a[sortConfig.colIndex];
      const cellB = b[sortConfig.colIndex];
      
      // 数値なら数値比較、それ以外は文字比較
      if (!isNaN(Number(cellA)) && !isNaN(Number(cellB))) {
        return sortConfig.direction === 'asc' ? cellA - cellB : cellB - cellA;
      } else {
        return sortConfig.direction === 'asc' 
          ? String(cellA).localeCompare(String(cellB))
          : String(cellB).localeCompare(String(cellA));
      }
    });
    return sorted;
  }, [filteredRows, sortConfig]);

  // 3. ページネーション（表示分だけ切り出す）
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows = sortedRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // --- イベントハンドラ ---
  
  // タブ変更時
  const handleTabChange = (name: string) => {
    setActiveTab(name);
    setSearchQuery(''); // 検索リセット
    setSortConfig(null); // ソートリセット
    setCurrentPage(1); // ページリセット
  };

  // 検索入力時
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1); // 検索したら1ページ目に戻す
  };

  // ソート実行
  const handleSort = (colIndex: number) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.colIndex === colIndex && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ colIndex, direction });
  };

  // ページ切り替え
  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <PageHead site={config.site} title="データ一覧" description="スプレッドシートデータ" />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px' }}>データ一覧</h1>
        
        {/* --- タブ --- */}
        {sheetNames.length > 0 && (
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
            {sheetNames.map((name) => (
              <button
                key={name}
                onClick={() => handleTabChange(name)}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  backgroundColor: activeTab === name ? '#333' : '#eee',
                  color: activeTab === name ? '#fff' : '#333',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
              >
                {name}
              </button>
            ))}
          </div>
        )}

        {/* --- 検索ボックス --- */}
        <div style={{ marginBottom: '15px' }}>
          <input
            type="text"
            placeholder="全データから検索..."
            value={searchQuery}
            onChange={handleSearch}
            style={{
              width: '100%',
              maxWidth: '400px',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '5px'
            }}
          />
        </div>

        {/* --- 件数表示 --- */}
        <div style={{ marginBottom: '10px', fontSize: '14px', color: '#666' }}>
          {totalItems === 0 ? '見つかりませんでした' : 
            `全 ${totalItems} 件中 ${startIndex + 1} - ${Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} 件を表示`
          }
        </div>

        {/* --- テーブル --- */}
        <div style={{ 
          overflowX: 'auto', 
          border: '1px solid #eee', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)' 
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '600px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9', borderBottom: '2px solid #ddd' }}>
                {header.map((col: any, i: number) => (
                  <th 
                    key={i} 
                    onClick={() => handleSort(i)} // クリックでソート
                    style={{ 
                      padding: '12px 16px', 
                      textAlign: 'left', 
                      fontWeight: '600',
                      whiteSpace: 'nowrap',
                      borderRight: '1px solid #eee',
                      color: '#333',
                      cursor: 'pointer', // クリックできる感を出す
                      userSelect: 'none'
                    }}
                  >
                    {col}
                    {sortConfig?.colIndex === i ? (sortConfig.direction === 'asc' ? ' ▲' : ' ▼') : ' ⇅'}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRows.length > 0 ? currentRows.map((row: any[], rowIndex: number) => (
                <tr key={rowIndex} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  {row.map((cell: any, cellIndex: number) => (
                    <td key={cellIndex} style={{ 
                      padding: '12px 16px',
                      whiteSpace: 'nowrap',
                      borderRight: '1px solid #f5f5f5'
                    }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              )) : (
                <tr>
                  <td colSpan={header.length} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    データがありません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* --- ページネーション --- */}
        {totalPages > 1 && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => goToPage(currentPage - 1)} 
              disabled={currentPage === 1}
              style={{ padding: '8px 16px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1 }}
            >
              前へ
            </button>
            
            <span style={{ padding: '8px 16px', fontWeight: 'bold' }}>
              {currentPage} / {totalPages}
            </span>

            <button 
              onClick={() => goToPage(currentPage + 1)} 
              disabled={currentPage === totalPages}
              style={{ padding: '8px 16px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1 }}
            >
              次へ
            </button>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}