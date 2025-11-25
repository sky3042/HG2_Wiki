// lib/gacha-logic.ts

// --- Types ---
export interface GachaItem {
  label: string;
  probability: string;
  count: number;
}

export interface CalculationSettings {
  targetsByLabel: Record<string, number>;
  targetCopiesRequired: number;
  maxPulls: number;
  curveStep: number;
}

export interface GraphData {
  pullCount: number;
  probabilities: number[];
}

interface DrawItem {
  prob: number;
  isGuarantee: boolean;
  targetName: string | null;
}

export interface ErrorInfo {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  suggestions?: string[];
  details?: string;
}

// --- CSV Parser ---
export function parseCSVData(csvText: string): GachaItem[] {
  const lines = csvText.trim().split('\n');
  const data: GachaItem[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    
    const columns = line.split(',');
    if (columns.length < 3) continue;
    
    const label = columns[0]?.trim();
    const probability = columns[1]?.trim();
    const countStr = columns[2]?.trim();
    const count = countStr ? parseInt(countStr, 10) : NaN;
    
    if (label && probability && !isNaN(count)) {
      data.push({ label, probability, count });
    }
  }
  return data;
}

export function formatCSVData(data: GachaItem[]): string {
  const header = 'ラベル,確率,個数';
  const rows = data.map(item => `${item.label},${item.probability},${item.count}`);
  return [header, ...rows].join('\n');
}

// --- Calculator ---
export class GachaCalculator {
  private drawList: DrawItem[] = [];
  private pityTargets: string[] = [];
  private targetNames: string[] = [];
  private targetMap: Record<string, number> = {};
  private guaranteeDrawList: DrawItem[] = [];
  private targetCopies: number = 1;

  prepareData(data: GachaItem[], settings: CalculationSettings) {
    const parsedData = data.map(item => ({
      ...item,
      parsedProb: parseFloat(item.probability.replace('%', '')) / 100,
      groupProb: 0
    }));
    
    parsedData.forEach(item => {
      item.groupProb = item.parsedProb * item.count;
    });

    const totalProb = parsedData.reduce((sum, item) => sum + item.groupProb, 0);
    if (totalProb <= 0) throw new Error('有効な確率の合計が0以下です。');

    this.targetCopies = settings.targetCopiesRequired;
    this.targetNames = [];
    
    for (const [label, num] of Object.entries(settings.targetsByLabel)) {
      // 型安全のため、numが数値であることを確認
      const count = Number(num);
      for (let i = 0; i < count; i++) {
        this.targetNames.push(`${label}-target-${i + 1}`);
      }
    }

    this.targetMap = {};
    this.targetNames.forEach((name, index) => {
      this.targetMap[name] = index;
    });

    this.drawList = [];
    const guaranteeLabels = new Set(['★5武器', '★5服装', '★5勲章', '追加枠', 'ピックアップ', 'Wピックアップ']);

    // Add target items
    for (const [label, num] of Object.entries(settings.targetsByLabel)) {
      const labelData = parsedData.find(item => item.label === label);
      if (!labelData) throw new Error(`ターゲットラベル '${label}' が見つかりません。`);
      
      const itemProb = labelData.parsedProb;
      const isGuarantee = guaranteeLabels.has(label);
      const count = Number(num);

      for (let i = 0; i < count; i++) {
        const targetName = `${label}-target-${i + 1}`;
        this.drawList.push({
          prob: itemProb / totalProb,
          isGuarantee,
          targetName
        });
      }
    }

    // Add non-target items
    for (const item of parsedData) {
      const numTargets = settings.targetsByLabel[item.label] || 0;
      const remainingCount = item.count - numTargets;
      
      if (remainingCount > 0) {
        const groupProb = item.parsedProb * remainingCount;
        const isGuarantee = guaranteeLabels.has(item.label);
        
        this.drawList.push({
          prob: groupProb / totalProb,
          isGuarantee,
          targetName: null
        });
      }
    }

    // Setup pity targets
    const pityLabels = new Set(['追加枠', 'ピックアップ', 'Wピックアップ']);
    this.pityTargets = this.targetNames.filter(name => {
      const label = name.split('-target-')[0];
      return label && pityLabels.has(label);
    });

    // Setup guarantee distribution
    const guaranteeOptions = this.drawList.filter(item => item.isGuarantee);
    const guaranteeTotal = guaranteeOptions.reduce((sum, item) => sum + item.prob, 0);
    if (guaranteeTotal > 0) {
      this.guaranteeDrawList = guaranteeOptions.map(opt => ({
        ...opt,
        prob: opt.prob / guaranteeTotal
      }));
    } else {
      this.guaranteeDrawList = [];
    }
  }

  *runDPSimulation(maxPulls: number): Generator<Map<string, number>, void, unknown> {
    let dp = new Map<string, number>();
    const numTargets = this.targetNames.length;
    const initialCounts = new Array(numTargets).fill(0).join(',');
    dp.set(`${initialCounts},0,0,0`, 1.0);

    for (let i = 0; i < maxPulls; i++) {
      const dpAfterPull = new Map<string, number>();
      for (const [stateKey, prob] of dp.entries()) {
        if (prob === 0) continue;
        const parts = stateKey.split(',');
        const counts = parts.slice(0, numTargets).map(Number);
        
        // 安全なパース処理
        const c10Str = parts[numTargets];
        const f10Str = parts[numTargets + 1];
        const c100Str = parts[numTargets + 2];

        const c10 = c10Str ? parseInt(c10Str) : 0;
        const f10 = f10Str ? parseInt(f10Str) : 0;
        const c100 = c100Str ? parseInt(c100Str) : 0;

        const currentDrawList = (c10 === 9 && f10 === 0) ? this.guaranteeDrawList : this.drawList;
        for (const draw of currentDrawList) {
          let nextCounts = [...counts];
          if (draw.targetName && this.targetMap[draw.targetName] !== undefined) {
            const targetIdx = this.targetMap[draw.targetName];
            // targetIdx の undefined チェック (TypeScript対策)
            if (targetIdx !== undefined) {
                const currentCount = counts[targetIdx];
                if (currentCount !== undefined && currentCount < this.targetCopies) {
                    nextCounts[targetIdx] = currentCount + 1;
                }
            }
          }

          const nextC100 = (c100 + 1) % 100;
          let nextC10, nextF10;
          if (c10 === 9 && f10 === 0) {
            nextC10 = 0;
            nextF10 = 0;
          } else {
            const currentF10 = f10 || (draw.isGuarantee ? 1 : 0);
            nextC10 = (c10 + 1) % 10;
            nextF10 = nextC10 === 0 ? 0 : currentF10;
          }

          const nextStateKey = `${nextCounts.join(',')},${nextC10},${nextF10},${nextC100}`;
          dpAfterPull.set(nextStateKey, (dpAfterPull.get(nextStateKey) || 0) + prob * draw.prob);
        }
      }

      const dpAfterPity = new Map<string, number>();
      for (const [stateKey, prob] of dpAfterPull.entries()) {
        const parts = stateKey.split(',');
        const counts = parts.slice(0, numTargets).map(Number);
        
        const c10Str = parts[numTargets];
        const f10Str = parts[numTargets + 1];
        const c100Str = parts[numTargets + 2];

        const c10 = c10Str ? parseInt(c10Str) : 0;
        const f10 = f10Str ? parseInt(f10Str) : 0;
        const c100 = c100Str ? parseInt(c100Str) : 0;

        if (c100 === 0 && (i + 1) % 100 === 0) {
          const unacquired = this.pityTargets.filter(name => {
            const idx = this.targetMap[name];
            const count = idx !== undefined ? counts[idx] : 0;
            return (count !== undefined ? count : 0) < this.targetCopies;
          });

          if (unacquired.length > 0 && unacquired[0]) {
            const pityCounts = [...counts];
            const pityIdx = this.targetMap[unacquired[0]];
            
            if (pityIdx !== undefined) {
                const currentPityCount = pityCounts[pityIdx];
                if (currentPityCount !== undefined) {
                    pityCounts[pityIdx] = currentPityCount + 1;
                }
            }
            
            const pityStateKey = `${pityCounts.join(',')},${c10},${f10},${c100}`;
            dpAfterPity.set(pityStateKey, (dpAfterPity.get(pityStateKey) || 0) + prob);
          } else {
            dpAfterPity.set(stateKey, (dpAfterPity.get(stateKey) || 0) + prob);
          }
        } else {
          dpAfterPity.set(stateKey, (dpAfterPity.get(stateKey) || 0) + prob);
        }
      }

      dp = dpAfterPity;
      yield dp;
    }
  }

  generateGraphData(maxPulls: number, step: number): GraphData[] {
    const results: GraphData[] = [];
    const numTargets = this.targetNames.length;

    let i = 0;
    for (const dpTable of this.runDPSimulation(maxPulls)) {
      const pullCount = i + 1;
      if (pullCount % step === 0 || pullCount === 1 || pullCount === maxPulls) {
        const probsByCount = new Array(numTargets + 1).fill(0);
        for (const [stateKey, prob] of dpTable.entries()) {
          const parts = stateKey.split(',');
          const counts = parts.slice(0, numTargets).map(Number);
          const achievedCount = counts.filter(c => c >= this.targetCopies).length;
          probsByCount[achievedCount] += prob;
        }
        const cumulativeProbs = new Array(numTargets + 1).fill(0);
        let currentSum = 0;
        for (let k = numTargets; k >= 0; k--) {
          currentSum += probsByCount[k];
          cumulativeProbs[k] = currentSum;
        }
        const probabilities = [];
        for (let n = 1; n <= numTargets; n++) {
          probabilities.push(cumulativeProbs[n]);
        }
        results.push({ pullCount, probabilities });
      }
      i++;
    }
    return results;
  }
}

// --- Error Handler ---
export class GachaErrorHandler {
  static validateCalculationData(data: GachaItem[], settings: CalculationSettings): ErrorInfo | null {
    if (data.length === 0) return { type: 'error', title: 'データなし', message: 'データがありません' };
    if (Object.keys(settings.targetsByLabel).length === 0) return { type: 'error', title: '設定エラー', message: 'ターゲットを設定してください' };
    
    let totalProb = 0;
    data.forEach(item => {
        const p = parseFloat((item.probability || '').replace('%', ''));
        if (!isNaN(p)) totalProb += p * item.count;
    });
    if (totalProb <= 0) return { type: 'error', title: '確率エラー', message: '確率の合計が0以下です' };

    return null;
  }

  static createCalculationError(error: unknown): ErrorInfo {
    return { type: 'error', title: '計算エラー', message: String(error) };
  }
}