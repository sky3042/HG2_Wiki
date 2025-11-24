import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'
import { TableVirtuoso, type TableComponents } from 'react-virtuoso'

type SheetData = Record<string, any[][]>;

const ITEMS_PER_PAGE = 100;

// 文字列の表示幅を概算
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

// セルコンポーネント
const DataCell = ({ content, width }: { content: any, width: number }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);
  
  const str = String(content ?? '');
  const lines = str.split(/[\r\n]+/);
  const hasMultiLines = lines.length > 1;
  const firstLine = lines[0] || '';

  if (!hasMultiLines) {
    return (
      <div style={{
        padding: '10px 12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: '1.6',
        width: `${width}px`,
        maxWidth: '200px'
      }}>
        {str}
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      title="クリックして展開/折りたたみ"
      style={{
        padding: '10px 12px',
        width: `${width}px`,
        maxWidth: '200px',
        cursor: 'pointer',
        position: 'relative',
        backgroundColor: isExpanded ? '#fff9e6' : 'transparent',
        transition: 'background-color 0.2s'
      }}
    >
      {isExpanded ? (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6' }}>
          {str}
          <div style={{ color: '#aaa', fontSize: '10px', marginTop: '4px', textAlign: 'center' }}>
            ▲ 閉じる
          </div>
        </div>
      ) : (
        <div style={{ 
          whiteSpace: 'nowrap', 
          overflow: 'hidden', 
          textOverflow: 'ellipsis',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px'
        }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {firstLine}
          </span>
          <span style={{ fontSize: '10px', color: '#888', flexShrink: 0 }}>
            ▼
          </span>
        </div>
      )}
    </div>
  );
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
  const [showFilter, setShowFilter] = React.useState(false);

  const rawData = sheets[activeTab] || [];
  const header = rawData[0] || [];
  const bodyRows = rawData.slice(1);

  // 列幅計算
  const columnWidths = React.useMemo(() => {
    const widths: number[] = new Array(header.length).fill(60);

    [header, ...bodyRows].forEach(row => {
      row.forEach((cell, colIndex) => {
        if (!cell) return;
        if (colIndex >= widths.length) return;

        const str = String(cell);
        let firstLine = str.split(/[\r\n]+/)[0] ?? '';

        if (firstLine.length > 40) {
            const spaceSplit = firstLine.split(/[\s\u3000]/);
            if (spaceSplit.length > 1 && spaceSplit[0]!.length > 0) {
                firstLine = spaceSplit[0]!;
            }
        }
        
        const estimatedWidth = (getTextDisplayLength(firstLine) * 10) + 20;

        const currentWidth = widths[colIndex] || 60;
        if (estimatedWidth > currentWidth) {
          widths[colIndex] = Math.min(estimatedWidth, 200);
        }
      });
    });
    return widths;
  }, [header, bodyRows]);

  const cleanRows = React.useMemo(() => {
    return bodyRows.filter(row => {
      return row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
    });
  }, [bodyRows]);

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

  const handleTabChange = (name: string) => {
    setActiveTab(name);
    setColumnFilters({}); 
    setSortConfig(null);
    setShowFilter(false);
  };

  const handleGlobalSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setGlobalSearchQuery(e.target.value);
  };

  const handleColumnFilterChange = (colIndex: number, value: string) => {
    setColumnFilters(prev => ({ ...prev, [colIndex]: value }));
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

  // --- 固定列・固定ヘッダーのためのスタイル ---
  const getStickyStyle = (colIndex: number, bgColor: string, rowType: 'header' | 'filter' | 'data'): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: bgColor,
      borderBottom: rowType === 'header' || rowType === 'filter' ? '1px solid #ddd' : '1px solid #f0f0f0',
      borderRight: '1px solid #eee',
      padding: 0,
      verticalAlign: 'top',
      zIndex: 1
    };

    // 1. 横方向の固定 (1列目)
    if (colIndex === 0) {
      style.position = 'sticky';
      style.left = 0;
      style.boxShadow = '2px 0 5px -2px rgba(0,0,0,0.2)';
      style.zIndex = 100;
    }

    // 2. 縦方向の固定 (ヘッダー行)
    if (rowType === 'header') {
      style.position = 'sticky';
      style.top = 0;
    }

    // 3. Z-Index の階層構造
    if (rowType === 'header') {
        style.zIndex = colIndex === 0 ? 1000 : 900;
    } else if (rowType === 'filter') {
        style.zIndex = colIndex === 0 ? 800 : 700;
    } else {
        // data
        style.zIndex = colIndex === 0 ? 500 : 1;
    }

    return style;
  };

  // ★ TableVirtuosoのコンポーネントカスタマイズ (型定義を追加して修正) ★
  const VirtuosoTableComponents: TableComponents<any[]> = {
    TableHead: React.forwardRef((props, ref) => (
      <thead {...props} ref={ref} style={{ ...props.style, zIndex: 2000, position: 'sticky', top: 0 }} />
    )),
    TableBody: React.forwardRef((props, ref) => (
      <tbody {...props} ref={ref} />
    )),
  };
  VirtuosoTableComponents.TableHead!.displayName = 'TableHead';
  VirtuosoTableComponents.TableBody!.displayName = 'TableBody';

  return (
    <>
      <PageHead site={config.site} title="データ一覧" description="スプレッドシートデータ" />
      <NotionPageHeader block={null} />

      <main style={{ maxWidth: '100%', margin: '0 auto', padding: '20px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '20px', maxWidth: '1200px', marginInline: 'auto' }}>データ一覧</h1>
        
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
          {sortedRows.length === 0 ? '該当なし' : `全 ${sortedRows.length} 件を表示`}
        </div>

        <div style={{ height: '80vh', border: '1px solid #eee', borderRadius: '8px' }}>
          <TableVirtuoso
            data={sortedRows}
            components={VirtuosoTableComponents}
            fixedHeaderContent={() => (
              <>
                <tr style={{ background: '#f9f9f9' }}>
                  {header.map((col: any, i: number) => (
                    <th 
                      key={i} 
                      onClick={() => handleSort(i)}
                      style={{ 
                        padding: '0',
                        color: '#333',
                        cursor: 'pointer',
                        userSelect: 'none',
                        ...getStickyStyle(i, sortConfig?.colIndex === i ? '#eef' : '#f9f9f9', 'header')
                      }}
                    >
                      <div style={{ 
                        padding: '12px 10px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between', 
                        gap: '5px',
                        width: `${columnWidths[i]}px`,
                        maxWidth: '200px'
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
                        ...getStickyStyle(i, '#fcfcfc', 'filter')
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
              </>
            )}
            itemContent={(index, row: any[]) => (
              <>
                {row.map((cell: any, cellIndex: number) => (
                  <td key={cellIndex} style={{ 
                    padding: '0',
                    verticalAlign: 'top',
                    ...getStickyStyle(cellIndex, index % 2 === 0 ? '#fff' : '#fcfcfc', 'data')
                  }}>
                    <DataCell content={cell} width={columnWidths[cellIndex] || 60} />
                  </td>
                ))}
              </>
            )}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}

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