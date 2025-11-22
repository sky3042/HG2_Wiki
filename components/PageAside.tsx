// components/PageAside.tsx
import { type Block, type ExtendedRecordMap } from 'notion-types'

// 型定義だけ復活させる（中身は使わない）
type Props = {
  block: Block
  recordMap: ExtendedRecordMap
  isBlogPost: boolean
}

export function PageAside(props: Props) {
  // 何も表示しない
  return null
}