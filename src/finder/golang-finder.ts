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
    _protoUri: Uri,
  ): Promise<Location[]> {
    const locations: Location[] = []

    try {
      // 查找所有 .go 文件
      const goFiles = await workspace.findFiles(
        '**/*.go',
        '**/vendor/**',
      )

      // 常见的 Go gRPC 实现模式：
      // 1. func (s *ServiceServer) MethodName(...) ...
      // 2. func (s *Service) MethodName(...) ...
      // 3. func (e serviceImpl) MethodName(...) ... (值接收者，接收者名称和类型不固定)
      // 4. func (e *serviceImpl) MethodName(...) ... (指针接收者，接收者名称和类型不固定)
      // 5. func MethodName(...) ... (如果方法名足够唯一)
      const patterns = [
        // 标准 gRPC 服务实现模式（指针接收者，服务名匹配）
        new RegExp(
          `func\\s+\\([^)]*\\*\\s*${this.escapeRegex(serviceName)}[^)]*\\)\\s+${this.escapeRegex(methodName)}\\s*\\(`,
          'g',
        ),
        // // 值接收者模式，接收者类型包含服务名
        // new RegExp(
        //   `func\\s+\\([^)]*\\s+\\w*${this.escapeRegex(serviceName)}\\w*[^)]*\\)\\s+${this.escapeRegex(methodName)}\\s*\\(`,
        //   'g',
        // ),
        // // 指针接收者模式，接收者类型包含服务名
        // new RegExp(
        //   `func\\s+\\([^)]*\\*\\s*\\w*${this.escapeRegex(serviceName)}\\w*[^)]*\\)\\s+${this.escapeRegex(methodName)}\\s*\\(`,
        //   'g',
        // ),
        // 通用的值接收者模式（任意接收者名称和类型）
        new RegExp(
          `func\\s+\\(\\w+\\s+\\w+\\)\\s+${this.escapeRegex(methodName)}\\s*\\(`,
          'g',
        ),
        // 通用的指针接收者模式（任意接收者名称和类型）
        new RegExp(
          `func\\s+\\(\\w+\\s+\\*\\w+\\)\\s+${this.escapeRegex(methodName)}\\s*\\(`,
          'g',
        ),
      ]

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
