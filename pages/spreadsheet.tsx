import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'

type SheetData = Record<string, any[][]>;

const ITEMS_PER_PAGE = 100;

// 文字列の表示幅を概算する関数
const getTextDisplayLength = (text: string) => {
  let len = 0;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ( (code >= 0x3000 && code <= 0xffff) || (code >= 0xff00 && code <= 0xff60) ) {
      len += 2;
    } else {
      len += 1;
    }
  }
  return len;
};

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
  
  const [activeTab, setActiveTab] = React.useState(sheetNames[0] || '');
  const [globalSearchQuery, setGlobalSearchQuery] = React.useState('');
  const [columnFilters, setColumnFilters] = React.useState<Record<number, string>>({});
  
  const [sortConfig, setSortConfig] = React.useState<{ colIndex: number, direction: 'asc' | 'desc' } | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showFilter, setShowFilter] = React.useState(false);

  const rawData = sheets[activeTab] || [];
  const header = rawData[0] || [];
  const bodyRows = rawData.slice(1);

  // ★列幅の計算ロジック（修正版）★
  const columnWidths = React.useMemo(() => {
    // 初期幅を 60px に縮小（余白削減）
    const widths: number[] = new Array(header.length).fill(60);

    [header, ...bodyRows].forEach(row => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;
        if (colIndex >= widths.length) return;

        const str = String(cell);
        const lines = str.split(/[\r\n]+/);
        let maxLineLength = 0;
        
        // 最も長い行を探す
        for (const line of lines) {
           const len = getTextDisplayLength(line);
           if (len > maxLineLength) maxLineLength = len;
        }
        
        // 幅計算: 係数を 10px に戻し、余白も削減
        const estimatedWidth = (maxLineLength * 10) + 20;

        // 最大幅を 300px に制限（これ以上は強制的に折り返し）
        // ※これで「無駄に広すぎる列」を防ぎます
        const currentWidth = widths[colIndex] || 60;
        if (estimatedWidth > currentWidth) {
          widths[colIndex] = Math.min(estimatedWidth, 300);
        }
      });
    });
    return widths;
  }, [header, bodyRows]);

  // 1. 空白行削除
  const cleanRows = React.useMemo(() => {
    return bodyRows.filter(row => {
      return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });
  }, [bodyRows]);

  // 2. フィルタリング
  const filteredRows = React.useMemo(() => {
    return cleanRows.filter(row => {
      if (globalSearchQuery) {
        const lowerQuery = globalSearchQuery.toLowerCase();
        const matchGlobal = row.some((cell: any) => String(cell ?? '').toLowerCase().includes(lowerQuery));
        if (!matchGlobal) return false;
      }
      for (const [colIndexStr, filterValue] of Object.entries(columnFilters)) {
        if (!filterValue) continue;
        const colIndex = Number(colIndexStr);
        const cellValue = String(row[colIndex] ?? '').toLowerCase();
        const searchStr = String(filterValue).toLowerCase();
        if (!cellValue.includes(searchStr)) {
          return false;
        }
      }
      return true;
    });
  }, [cleanRows, globalSearchQuery, columnFilters]);

  // 3. 並べ替え
  const sortedRows = React.useMemo(() => {
    const currentSort = sortConfig;
    if (!currentSort) return filteredRows;

    const { colIndex, direction } = currentSort;

    if (colIndex === -1) {
      if (direction === 'desc') {
        return [...filteredRows].reverse();
      }
      return filteredRows;
    }

    return [...filteredRows].sort((a, b) => {
      const cellA = a[colIndex];
      const cellB = b[colIndex];
      
      const numA = Number(cellA);
      const numB = Number(cellB);

      if (!isNaN(numA) && !isNaN(numB) && cellA !== '' && cellB !== '') {
        return direction === 'asc' ? numA - numB : numB - numA;
      } else {
        const strA = String(cellA ?? '');
        const strB = String(cellB ?? '');
        return direction === 'asc' 
          ? strA.localeCompare(strB, 'ja')
          : strB.localeCompare(strA, 'ja');
      }
    });
  }, [filteredRows, sortConfig]);

  // 4. ページネーション
  const totalItems = sortedRows.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const currentRows = sortedRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // --- イベントハンドラ ---
  const handleTabChange = (name: string) => {
    setActiveTab(name);
    setColumnFilters({}); 
    setSortConfig(null);
    setCurrentPage(1);
    setShowFilter(false);
  };

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handleColumnFilterChange = (colIndex: number, value: string) => {
    setColumnFilters(prev => ({ ...prev, [colIndex]: value }));
    setCurrentPage(1);
  };

  const handleSort = (colIndex: number) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.colIndex === colIndex && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ colIndex, direction });
  };

  const resetSort = () => setSortConfig(null);
  const reverseDefaultSort = () => setSortConfig({ colIndex: -1, direction: 'desc' });
  const toggleFilter = () => setShowFilter(prev => !prev);
  const goToPage = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- 固定列のためのスタイルヘルパー ---
  const getStickyStyle = (colIndex: number, bgColor: string, isHeader = false): React.CSSProperties => {
    if (colIndex !== 0) return {};
    return {
      position: 'sticky',
      left: 0,
      zIndex: isHeader ? 3 : 2, // ヘッダーはより上に
      backgroundColor: bgColor, // 透けないように背景色を指定
      boxShadow: '2px 0 5px -2px rgba(0,0,0,0.2)', // 境界線に影をつける
      borderRight: '1px solid #ddd'
    };
  };

  return (
    <>
      <PageHead site={config.site} title="データ一覧" description="スプレッドシートデータ" />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '100%', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px', maxWidth: '1200px', marginInline: 'auto' }}>データ一覧</h1>
        
        {/* タブ */}
        <div style={{ maxWidth: '1200px', margin: '0 auto 20px', display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '5px' }}>
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

        {/* コントロール */}
        <div style={{ maxWidth: '1200px', margin: '0 auto 15px', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="全体から検索..."
            value={globalSearchQuery}
            onChange={handleGlobalSearch}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: '10px',
              fontSize: '16px',
              border: '1px solid #ccc',
              borderRadius: '5px'
            }}
          />
          <button onClick={toggleFilter} style={controlBtnStyle(showFilter)}><span>🔍</span> 絞り込み</button>
          {sortConfig ? (
            <button onClick={resetSort} style={resetBtnStyle}>× 標準に戻す</button>
          ) : (
            <button onClick={reverseDefaultSort} style={controlBtnStyle(false)}>⇅ 逆順にする</button>
          )}
        </div>

        <div style={{ maxWidth: '1200px', margin: '0 auto 10px', fontSize: '14px', color: '#666' }}>
          {totalItems === 0 ? '該当なし' : 
            `全 ${totalItems} 件中 ${startIndex + 1} - ${Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} 件を表示`
          }
        </div>

        {/* テーブル */}
        <div style={{ 
          overflowX: 'auto', 
          border: '1px solid #eee', 
          borderRadius: '8px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          maxHeight: '80vh' // 縦スクロールも可能に
        }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9f9f9' }}>
                {header.map((col: any, i: number) => (
                  <th 
                    key={i} 
                    onClick={() => handleSort(i)}
                    style={{ 
                      padding: '0',
                      borderBottom: '1px solid #ddd',
                      borderRight: '1px solid #eee',
                      color: '#333',
                      cursor: 'pointer',
                      userSelect: 'none',
                      top: 0, // ヘッダー縦固定用
                      position: i === 0 ? 'sticky' : undefined, // 1列目ならsticky
                      zIndex: i === 0 ? 3 : 1, // 1列目は最前面
                      ...getStickyStyle(i, sortConfig?.colIndex === i ? '#eef' : '#f9f9f9', true)
                    }}
                  >
                    <div style={{ 
                      padding: '12px 10px',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      gap: '5px',
                      minWidth: `${columnWidths[i]}px`,
                      maxWidth: '300px' // ★最大幅を300pxに制限
                    }}>
                      {col}
                      <span style={{ fontSize: '10px', color: '#888' }}>
                        {sortConfig?.colIndex === i ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
              
              {showFilter && (
                <tr style={{ background: '#fcfcfc' }}>
                  {header.map((_: any, i: number) => (
                    <td key={i} style={{ 
                      padding: '5px', 
                      borderBottom: '2px solid #ddd',
                      borderRight: '1px solid #eee',
                      ...getStickyStyle(i, '#fcfcfc', true) // フィルター行も固定
                    }}>
                      <input
                        type="text"
                        placeholder="絞り込み..."
                        value={columnFilters[i] || ''}
                        onChange={(e) => handleColumnFilterChange(i, e.target.value)}
                        style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                      />
                    </td>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {currentRows.length > 0 ? currentRows.map((row: any[], rowIndex: number) => {
                const bgColor = rowIndex % 2 === 0 ? '#fff' : '#fcfcfc';
                return (
                  <tr key={rowIndex} style={{ backgroundColor: bgColor }}>
                    {row.map((cell: any, cellIndex: number) => (
                      <td key={cellIndex} style={{ 
                        padding: '0',
                        borderBottom: '1px solid #f0f0f0',
                        borderRight: '1px solid #f5f5f5',
                        verticalAlign: 'top',
                        ...getStickyStyle(cellIndex, bgColor) // 1列目データ固定
                      }}>
                        <div style={{
                          padding: '10px 12px',
                          whiteSpace: 'pre-wrap', 
                          wordBreak: 'break-word',
                          lineHeight: '1.6',
                          minWidth: `${columnWidths[cellIndex]}px`,
                          maxWidth: '300px' // ★データも300pxで折り返し
                        }}>
                          {cell}
                        </div>
                      </td>
                    ))}
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={header.length} style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
                    データが見つかりませんでした
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ページネーション */}
        {totalPages > 1 && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => goToPage(1)} disabled={currentPage === 1} style={paginationButtonStyle(currentPage === 1)}>« 最初</button>
            <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} style={paginationButtonStyle(currentPage === 1)}>‹ 前</button>
            <span style={{ padding: '6px 12px', fontWeight: 'bold', display: 'flex', alignItems: 'center' }}>{currentPage} / {totalPages}</span>
            <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} style={paginationButtonStyle(currentPage === totalPages)}>次 ›</button>
            <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} style={paginationButtonStyle(currentPage === totalPages)}>最後 »</button>
          </div>
        )}
      </main>
      <Footer />
    </>
  )
}

// スタイル定義
const controlBtnStyle = (active: boolean): React.CSSProperties => ({
  padding: '10px 15px',
  backgroundColor: active ? '#ddd' : '#f0f0f0',
  color: '#333',
  border: '1px solid #ccc',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  whiteSpace: 'nowrap',
  display: 'flex',
  alignItems: 'center',
  gap: '5px'
});

const resetBtnStyle: React.CSSProperties = {
  padding: '10px 15px',
  backgroundColor: '#f44336',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontWeight: 'bold',
  whiteSpace: 'nowrap'
};

const paginationButtonStyle = (disabled: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  cursor: disabled ? 'not-allowed' : 'pointer',
  borderRadius: '4px',
  border: '1px solid #ccc',
  background: '#fff',
  opacity: disabled ? 0.5 : 1
});