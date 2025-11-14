import type { TextDocument, Range } from 'vscode'
import { Position, Range as VSCodeRange } from 'vscode'

export interface GolangMethod {
  name: string
  receiverType?: string
  receiverName?: string
  signature: string // 完整的方法签名
  range: Range
  line: number
}

/**
 * 解析 Golang 文件，提取方法实现信息
 */
export function parseGolangFile(document: TextDocument): GolangMethod[] {
  const text = document.getText()
  const methods: GolangMethod[] = []
  const lines = text.split('\n')

  // 匹配 Go 方法定义：
  // 1. func (receiverName receiverType) MethodName(...)
  // 2. func (receiverName *receiverType) MethodName(...)
  // 3. func MethodName(...)
  const methodPattern = /^func\s+(?:\((\w+)\s+(\*?\w+)\)\s+)?(\w+)\s*\(/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    methodPattern.lastIndex = 0
    const match = methodPattern.exec(trimmedLine)

    if (match) {
      const receiverName = match[1] || undefined
      const receiverType = match[2] || undefined
      const methodName = match[3]

      if (methodName) {
        const methodRange = document.getWordRangeAtPosition(
          new Position(i, trimmedLine.indexOf(methodName)),
        ) || new VSCodeRange(i, 0, i, line.length)

        methods.push({
          name: methodName,
          receiverType: receiverType?.replace(/^\*/, ''), // 移除指针符号
          receiverName,
          signature: trimmedLine, // 保存完整的方法签名行
          range: methodRange,
          line: i,
        })
      }
    }
  }

  return methods
}

/**
 * 获取指定位置的方法信息
 */
export function getMethodAtPosition(
  document: TextDocument,
  position: Position,
): GolangMethod | null {
  const methods = parseGolangFile(document)
  for (const method of methods) {
    if (method.range.contains(position)) {
      return method
    }
  }
  return null
}

