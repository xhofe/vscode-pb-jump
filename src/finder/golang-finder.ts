import type { Uri } from 'vscode'
import type { LanguageFinder } from './language-finder'
import { Location, Range, workspace } from 'vscode'
import { logger } from '../utils'

/**
 * Golang 实现查找器
 * 根据 proto 服务和方法名称查找对应的 Go 实现
 */
export class GolangFinder implements LanguageFinder {
  language = 'go'

  async findImplementations(
    serviceName: string,
    methodName: string,
    inputType: string,
    outputType: string,
    _protoUri: Uri,
  ): Promise<Location[]> {
    const locations: Location[] = []

    try {
      // 查找所有 .go 文件
      const goFiles = await workspace.findFiles(
        '**/*.go',
        '**/vendor/**',
      )

      // 从 proto 类型名提取基础类型名（忽略包名）
      // 例如: com.example.AnalyzeReq -> AnalyzeReq
      const inputBaseType = this.getBaseTypeName(inputType)
      const outputBaseType = this.getBaseTypeName(outputType)

      // 转义方法名和类型名用于正则匹配
      const escapedMethodName = this.escapeRegex(methodName)
      const escapedInputType = inputBaseType ? this.escapeRegex(inputBaseType) : ''
      const escapedOutputType = outputBaseType ? this.escapeRegex(outputBaseType) : ''

      // 构建正则表达式模式
      // 模式1: func (receiver) MethodName(...*任意包名.InputType...) (...*任意包名.OutputType...)
      // 模式2: func (receiver) MethodName(...*任意包名.InputType..., ...*任意包名.OutputType...)
      const patterns: RegExp[] = []

      if (escapedInputType && escapedOutputType) {
        // 模式1: 标准 gRPC，resp 在返回值中
        // func (receiver) MethodName(..., *任意包名.InputType, ...) (*任意包名.OutputType, ...)
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\)\\s*\\([^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
          'gi',
        ))

        // 模式2: 自定义模式，resp 在参数中
        // func (receiver) MethodName(..., *任意包名.InputType, ..., *任意包名.OutputType, ...)
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
          'gi',
        ))
      }
      else if (escapedInputType) {
        // 只有输入类型
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\)`,
          'gi',
        ))
      }
      else if (escapedOutputType) {
        // 只有输出类型
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\)\\s*\\([^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
          'gi',
        ))
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
          'gi',
        ))
      }
      else {
        // 没有类型信息，只匹配方法名
        patterns.push(new RegExp(
          `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\(`,
          'gi',
        ))
      }

      for (const file of goFiles) {
        try {
          const document = await workspace.openTextDocument(file)
          const text = document.getText()

          for (const pattern of patterns) {
            pattern.lastIndex = 0 // 重置正则表达式
            let match: RegExpExecArray | null = pattern.exec(text)

            while (match !== null) {
              const position = document.positionAt(match.index)
              const line = document.lineAt(position.line)
              const range = new Range(
                position.line,
                0,
                position.line,
                line.text.length,
              )

              locations.push(new Location(file, range))
              match = pattern.exec(text)
            }
          }
        }
        catch (error) {
          logger.warn(`Failed to read file ${file.fsPath}: ${error}`)
        }
      }

      // 去重（基于 URI 和行号）
      const uniqueLocations = this.deduplicateLocations(locations)

      logger.info(
        `Found ${uniqueLocations.length} implementation(s) for ${serviceName}.${methodName}`,
      )

      return uniqueLocations
    }
    catch (error) {
      logger.error(`Error finding Go implementations: ${error}`)
      return []
    }
  }

  /**
   * 从 proto 类型名获取基础类型名（移除包名）
   * 例如: com.example.AnalyzeReq -> AnalyzeReq
   */
  private getBaseTypeName(protoType: string): string {
    if (!protoType)
      return ''
    // 移除可能的包名前缀（如果有），只返回最后的类型名
    return protoType.split('.').pop() || protoType
  }

  /**
   * 转义正则表达式特殊字符
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * 去重位置列表
   */
  private deduplicateLocations(locations: Location[]): Location[] {
    const seen = new Set<string>()
    const unique: Location[] = []

    for (const loc of locations) {
      const key = `${loc.uri.toString()}:${loc.range.start.line}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(loc)
      }
    }

    return unique
  }
}
