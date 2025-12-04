import * as React from 'react'
import * as fs from 'fs'
import * as path from 'path'
import { PageHead } from '@/components/PageHead'
import { Footer } from '@/components/Footer'
import { NotionPageHeader } from '@/components/NotionPageHeader'
import * as config from '@/lib/config'
import { TableVirtuoso, type TableComponents } from 'react-virtuoso'
import { useMedia, useClickAway } from 'react-use'

type SheetData = Record<string, any[][]>;

const ITEMS_PER_PAGE = 100;
const MAX_COLUMN_WIDTH = 200;
const MAX_SELECT_ITEMS = 30;
const EMPTY_KEY = '$$EMPTY$$';

// 文字列の表示幅を概算
const getTextDisplayLength = (text: string) => {
  let len = 0;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if ( (code >= 0x3000 && code <= 0xffff) || (code >= 0xff00 && code <= 0xff60) ) {
      len += 2; // 全角
    } else {
      len += 1; // 半角
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

  // パディングを詰める (8px 10px -> 8px 4px)
  const cellStyle: React.CSSProperties = {
    padding: '8px 4px',
    minWidth: `${width}px`,
    maxWidth: `${MAX_COLUMN_WIDTH}px`,
    cursor: hasMultiLines ? 'pointer' : 'default',
    position: 'relative',
    backgroundColor: isExpanded ? '#fff9e6' : 'transparent',
    transition: 'background-color 0.2s'
  };

  if (!hasMultiLines) {
    return (
      <div style={{
        ...cellStyle,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        lineHeight: '1.4',
      }}>
        {str}
      </div>
    );
  }

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      title="クリックして展開/折りたたみ"
      style={cellStyle}
    >
      {isExpanded ? (
        <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
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
          gap: '4px' // 隙間も詰める
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

// 複数選択フィルターコンポーネント
const FilterMultiSelect = ({ options, value, onChange }: { options: string[], value: string[] | undefined, onChange: (val: string[] | undefined) => void }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 200 });

  const selectedSet = new Set(value ?? options);
  const isAllSelected = value === undefined || value.length === options.length;

  useClickAway(menuRef, (e) => {
    if (ref.current && ref.current.contains(e.target as Node)) return;
    setIsOpen(false);
  });

  const toggleOpen = () => {
    if (!isOpen && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      let left = rect.left;
      if (left + 250 > window.innerWidth) {
          left = window.innerWidth - 260;
      }
      setCoords({
        top: rect.bottom,
        left: left,
        width: Math.max(rect.width, 200)
      });
    }
    setIsOpen(!isOpen);
  };

  const handleCheck = (option: string) => {
    const newSet = new Set(selectedSet);
    if (newSet.has(option)) {
      newSet.delete(option);
    } else {
      newSet.add(option);
    }
    
    if (newSet.size === options.length) {
      onChange(undefined);
    } else {
      onChange(Array.from(newSet));
    }
  };

  const handleSelectAll = () => onChange(undefined);
  const handleClear = () => onChange([]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={toggleOpen}
        style={{
          width: '100%',
          padding: '6px 4px', // パディング調整
          fontSize: '12px',
          border: '1px solid #ddd',
          borderRadius: '4px',
          boxSizing: 'border-box',
          backgroundColor: '#fff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: isAllSelected ? '#555' : '#3B82F6',
          fontWeight: isAllSelected ? 'normal' : 'bold'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isAllSelected ? 'すべて' : `${selectedSet.size}件`}
        </span>
        <span style={{ fontSize: '10px' }}>▼</span>
      </div>

      {isOpen && (
        <div 
          ref={menuRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width: 250,
            maxHeight: 300,
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 99999,
            padding: '8px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', borderBottom: '1px solid #eee', paddingBottom: '4px' }}>
            <button onClick={handleSelectAll} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', border: 'none', background: 'none', color: '#3B82F6' }}>全選択</button>
            <button onClick={handleClear} style={{ fontSize: '11px', padding: '2px 6px', cursor: 'pointer', border: 'none', background: 'none', color: '#EF4444' }}>解除</button>
          </div>
          {options.map(option => (
            <label key={option} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', padding: '2px 0' }}>
              <input 
                type="checkbox" 
                checked={selectedSet.has(option)} 
                onChange={() => handleCheck(option)}
              />
              {option === EMPTY_KEY ? <span style={{color: '#999'}}>(空白)</span> : option}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};


// --- Context ---
interface SpreadsheetContextType {
  header: any[];
  columnWidths: number[];
  sortConfig: { colIndex: number, direction: 'asc' | 'desc' } | null;
  showFilter: boolean;
  columnFilters: Record<number, string | string[]>;
  uniqueValuesMap: Record<number, string[]>;
  handleSort: (i: number) => void;
  handleColumnFilterChange: (i: number, val: string | string[] | undefined) => void;
  getStickyStyle: (colIndex: number, bgColor: string, rowType: 'header' | 'filter' | 'data') => React.CSSProperties;
}

const SpreadsheetContext = React.createContext<SpreadsheetContextType | null>(null);

// --- Header Content ---
const SpreadsheetHeaderContent = () => {
  const ctx = React.useContext(SpreadsheetContext);
  if (!ctx) return null;

  const { header, columnWidths, sortConfig, showFilter, columnFilters, uniqueValuesMap, handleSort, handleColumnFilterChange, getStickyStyle } = ctx;

  return (
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
              // ★修正: パディングを減らしてタイトにする
              padding: '8px 4px',
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              gap: '4px',
              width: `${columnWidths[i]}px`,
              maxWidth: `${MAX_COLUMN_WIDTH}px`,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: '1.3', 
              textAlign: 'left'
            }}>
              {col}
              <span style={{ fontSize: '10px', color: '#888', flexShrink: 0 }}>
                {sortConfig?.colIndex === i ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '⇅'}
              </span>
            </div>
          </th>
        ))}
      </tr>
      {showFilter && (
        <tr style={{ background: '#fcfcfc' }}>
          {header.map((_: any, i: number) => {
            const uniqueValues = uniqueValuesMap[i] || [];
            const isSelectMode = uniqueValues.length <= MAX_SELECT_ITEMS && uniqueValues.length > 0;

            return (
              <td key={i} style={{ 
                padding: '5px', 
                ...getStickyStyle(i, '#fcfcfc', 'filter')
              }}>
                {isSelectMode ? (
                  <FilterMultiSelect 
                    options={uniqueValues}
                    value={columnFilters[i] as string[] | undefined}
                    onChange={(val) => handleColumnFilterChange(i, val)}
                  />
                ) : (
                  <input
                    type="text"
                    placeholder="絞り込み..."
                    value={(columnFilters[i] as string) || ''}
                    onChange={(e) => handleColumnFilterChange(i, e.target.value)}
                    style={{ width: '100%', padding: '6px', fontSize: '12px', border: '1px solid #ddd', borderRadius: '4px', boxSizing: 'border-box' }}
                  />
                )}
              </td>
            );
          })}
        </tr>
      )}
    </>
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
  const [columnFilters, setColumnFilters] = React.useState<Record<number, string | string[]>>({});
  
  const [sortConfig, setSortConfig] = React.useState<{ colIndex: number, direction: 'asc' | 'desc' } | null>(null);
  const [showFilter, setShowFilter] = React.useState(false);

  const isMobile = useMedia('(max-width: 768px)', false);

  const rawData = sheets[activeTab] || [];
  const header = rawData[0] || [];
  const bodyRows = rawData.slice(1);

  // ★列幅の計算ロジック（再修正：初期値0、余白削減）★
  const columnWidths = React.useMemo(() => {
    // 初期値を0にする（余分な幅を持たせない）
    const widths: number[] = new Array(header.length).fill(0);

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
        
        // ★修正: 係数を8、余白を26まで削る
        const estimatedWidth = (getTextDisplayLength(firstLine) * 8) + 26;

        const currentWidth = widths[colIndex] || 0;
        if (estimatedWidth > currentWidth) {
          widths[colIndex] = Math.min(estimatedWidth, MAX_COLUMN_WIDTH);
        }
      });
    });
    return widths;
  }, [header, bodyRows]);

  // 1. ユニーク値の抽出
  const uniqueValuesMap = React.useMemo(() => {
    const map: Record<number, string[]> = {};
    if (bodyRows.length === 0) return map;

    header.forEach((_, colIndex) => {
      const values = new Set<string>();
      bodyRows.forEach(row => {
        const cell = row[colIndex];
        if (cell === null || cell === undefined || String(cell).trim() === '') {
          values.add(EMPTY_KEY);
        } else {
          values.add(String(cell));
        }
      });
      map[colIndex] = Array.from(values).sort((a, b) => {
        if (a === EMPTY_KEY) return -1;
        if (b === EMPTY_KEY) return 1;
        return a.localeCompare(b, 'ja');
      });
    });
    return map;
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
        if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) continue;
        
        const colIndex = Number(colIndexStr);
        const rawCellValue = String(row[colIndex] ?? '');
        const cellValue = (rawCellValue.trim() === '') ? EMPTY_KEY : rawCellValue;
        
        if (Array.isArray(filterValue)) {
          if (!filterValue.includes(cellValue)) {
            return false;
          }
        } else {
          if (!rawCellValue.toLowerCase().includes(filterValue.toLowerCase())) {
            return false;
          }
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

  const handleColumnFilterChange = (colIndex: number, value: string | string[] | undefined) => {
    setColumnFilters(prev => {
        if (value === undefined) {
            const next = { ...prev };
            delete next[colIndex];
            return next;
        }
        return { ...prev, [colIndex]: value };
    });
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

  const getStickyStyle = (colIndex: number, bgColor: string, rowType: 'header' | 'filter' | 'data'): React.CSSProperties => {
    const style: React.CSSProperties = {
      backgroundColor: bgColor,
      borderBottom: rowType === 'header' || rowType === 'filter' ? '1px solid #ddd' : '1px solid #f0f0f0',
      borderRight: '1px solid #eee',
      padding: 0,
      verticalAlign: 'top',
      zIndex: 1
    };

    if (colIndex === 0 && !isMobile) {
      style.position = 'sticky';
      style.left = 0;
      style.boxShadow = '2px 0 5px -2px rgba(0,0,0,0.2)';
      style.zIndex = 100;
    }

    if (rowType === 'header') {
      style.position = 'sticky';
      style.top = 0;
    }

    if (rowType === 'header') {
        style.zIndex = (colIndex === 0 && !isMobile) ? 1000 : 900;
    } else if (rowType === 'filter') {
        style.zIndex = (colIndex === 0 && !isMobile) ? 800 : 700;
    } else {
        style.zIndex = (colIndex === 0 && !isMobile) ? 500 : 1;
    }

    return style;
  };

  const contextValue = React.useMemo(() => ({
    header,
    columnWidths,
    sortConfig,
    showFilter,
    columnFilters,
    uniqueValuesMap,
    handleSort,
    handleColumnFilterChange,
    getStickyStyle
  }), [header, columnWidths, sortConfig, showFilter, columnFilters, uniqueValuesMap, isMobile]);

  const fixedHeaderContent = React.useCallback(() => <SpreadsheetHeaderContent />, []);

  const VirtuosoTableComponents: TableComponents<any[]> = React.useMemo(() => ({
    TableHead: React.forwardRef((props, ref) => (
      <thead {...props} ref={ref} style={{ ...props.style, zIndex: 2000, position: 'sticky', top: 0 }} />
    )),
    TableBody: React.forwardRef((props, ref) => (
      <tbody {...props} ref={ref} />
    )),
  }), []);

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
          <SpreadsheetContext.Provider value={contextValue}>
            <TableVirtuoso
              data={sortedRows}
              components={VirtuosoTableComponents}
              fixedHeaderContent={fixedHeaderContent}
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
          </SpreadsheetContext.Provider>
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