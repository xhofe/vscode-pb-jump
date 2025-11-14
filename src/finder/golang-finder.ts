import type { Uri } from 'vscode'
import type { LanguageFinder } from './language-finder'
import { Location, Range, workspace } from 'vscode'
import { logger } from '../utils'

/**
 * 文件内容缓存
 */
const fileContentCache = new Map<string, { content: string, timestamp: number }>()
const CACHE_TTL = 60000 // 1分钟缓存

/**
 * Golang 实现查找器
 * 根据 proto 服务和方法名称查找对应的 Go 实现
 */
export class GolangFinder implements LanguageFinder {
  language = 'go'
  private readonly MAX_CONCURRENT_FILES = 20 // 最大并发文件数

  async findImplementations(
    serviceName: string,
    methodName: string,
    inputType: string,
    outputType: string,
    _protoUri: Uri,
  ): Promise<Location[]> {
    const locations: Location[] = []

    try {
      // 从 proto 类型名提取基础类型名（忽略包名）
      // 例如: com.example.AnalyzeReq -> AnalyzeReq
      const inputBaseType = this.getBaseTypeName(inputType)
      const outputBaseType = this.getBaseTypeName(outputType)

      // 转义方法名和类型名用于正则匹配
      const escapedMethodName = this.escapeRegex(methodName)
      const escapedInputType = inputBaseType ? this.escapeRegex(inputBaseType) : ''
      const escapedOutputType = outputBaseType ? this.escapeRegex(outputBaseType) : ''

      // 使用 VS Code 搜索功能进行预过滤
      // 先搜索包含方法名的文件，这样可以大幅减少需要检查的文件数量
      const candidateFiles = await this.findCandidateFiles(methodName, inputBaseType, outputBaseType)

      logger.info(
        `Found ${candidateFiles.length} candidate files (from search) for ${serviceName}.${methodName}`,
      )

      if (candidateFiles.length === 0) {
        return []
      }

      // 构建正则表达式模式
      const patterns = this.buildPatterns(escapedMethodName, escapedInputType, escapedOutputType)

      // 并行处理候选文件，但限制并发数
      // 注意：候选文件已经通过预过滤，包含方法名和 func，所以 searchInFile 中不需要再次检查
      const chunks = this.chunkArray(candidateFiles, this.MAX_CONCURRENT_FILES)

      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(file => this.searchInFile(file, patterns)),
        )

        for (const result of chunkResults) {
          locations.push(...result)
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
   * 使用 VS Code 搜索功能查找候选文件
   * 通过搜索包含方法名和类型名的文件来大幅减少需要检查的文件数量
   */
  private async findCandidateFiles(
    methodName: string,
    inputBaseType?: string,
    outputBaseType?: string,
  ): Promise<Uri[]> {
    try {
      // 先找到所有 .go 文件
      const allGoFiles = await workspace.findFiles(
        '**/*.go',
        '**/vendor/**',
      )

      if (allGoFiles.length === 0) {
        return []
      }

      logger.info(`Pre-filtering ${allGoFiles.length} Go files using text search`)

      // 使用快速文本搜索预过滤文件
      // 构建搜索模式：必须包含方法名，可选包含类型名
      const searchPattern = this.buildSearchPattern(methodName, inputBaseType, outputBaseType)

      // 并行检查文件是否包含关键词
      const chunks = this.chunkArray(allGoFiles, this.MAX_CONCURRENT_FILES)
      const candidateFiles: Uri[] = []

      for (const chunk of chunks) {
        const results = await Promise.all(
          chunk.map(async (file) => {
            try {
              // 快速检查文件内容（使用缓存）
              const content = await this.getFileContent(file)
              // 检查是否包含搜索模式中的所有关键词
              if (this.matchesSearchPattern(content, searchPattern)) {
                return file
              }
              return null
            }
            catch {
              return null
            }
          }),
        )
        for (const result of results) {
          if (result) {
            candidateFiles.push(result)
          }
        }
      }
      return candidateFiles
    }
    catch (error) {
      logger.warn(`Error in findCandidateFiles: ${error}`)
      // 如果搜索失败，返回所有文件（降级策略）
      return await workspace.findFiles('**/*.go', '**/vendor/**')
    }
  }

  /**
   * 构建搜索模式
   */
  private buildSearchPattern(
    methodName: string,
    inputBaseType?: string,
    outputBaseType?: string,
  ): { required: string[], optional: string[] } {
    const required: string[] = [methodName, 'func']
    const optional: string[] = []

    if (inputBaseType) {
      optional.push(inputBaseType)
    }
    if (outputBaseType) {
      optional.push(outputBaseType)
    }

    return { required, optional }
  }

  /**
   * 检查内容是否匹配搜索模式
   * 必须包含所有必需关键词，至少包含一个可选关键词（如果有）
   */
  private matchesSearchPattern(
    content: string,
    pattern: { required: string[], optional: string[] },
  ): boolean {
    // 检查必需关键词
    for (const keyword of pattern.required) {
      if (!content.includes(keyword)) {
        return false
      }
    }
    return true
  }

  /**
   * 在单个文件中搜索
   * 注意：此方法接收的文件已经通过预过滤，包含方法名和 func
   */
  private async searchInFile(
    file: Uri,
    patterns: RegExp[],
  ): Promise<Location[]> {
    const locations: Location[] = []

    try {
      // 打开文档进行精确匹配
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

    return locations
  }

  /**
   * 获取文件内容（带缓存）
   */
  private async getFileContent(file: Uri): Promise<string> {
    const filePath = file.fsPath
    const cached = fileContentCache.get(filePath)
    const now = Date.now()

    if (cached && (now - cached.timestamp) < CACHE_TTL) {
      return cached.content
    }

    const document = await workspace.openTextDocument(file)
    const content = document.getText()

    fileContentCache.set(filePath, { content, timestamp: now })

    // 限制缓存大小，避免内存泄漏
    if (fileContentCache.size > 1000) {
      const firstKey = fileContentCache.keys().next().value
      if (firstKey) {
        fileContentCache.delete(firstKey)
      }
    }

    return content
  }

  /**
   * 构建正则表达式模式
   */
  private buildPatterns(
    escapedMethodName: string,
    escapedInputType: string,
    escapedOutputType: string,
  ): RegExp[] {
    const patterns: RegExp[] = []

    if (escapedInputType && escapedOutputType) {
      // 模式1: 标准 gRPC，resp 在返回值中
      patterns.push(new RegExp(
        `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\)\\s*\\([^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
        'gi',
      ))

      // 模式2: 自定义模式，resp 在参数中
      patterns.push(new RegExp(
        `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\*[\\w.]*\\.?${escapedOutputType}[^)]*\\)`,
        'gi',
      ))
    }
    else if (escapedInputType) {
      patterns.push(new RegExp(
        `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\([^)]*\\*[\\w.]*\\.?${escapedInputType}[^)]*\\)`,
        'gi',
      ))
    }
    else if (escapedOutputType) {
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
      patterns.push(new RegExp(
        `func\\s+\\([^)]+\\)\\s+${escapedMethodName}\\s*\\(`,
        'gi',
      ))
    }

    return patterns
  }

  /**
   * 将数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
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
