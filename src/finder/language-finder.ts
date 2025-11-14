import type { Location, Uri } from 'vscode'

/**
 * 语言查找器接口
 * 用于查找特定语言的实现代码
 */
export interface LanguageFinder {
  /**
   * 语言标识符（如 'go', 'java', 'python' 等）
   */
  language: string

  /**
   * 查找方法的实现位置
   * @param serviceName 服务名称
   * @param methodName 方法名称
   * @param protoUri proto 文件的 URI
   * @returns 实现位置的数组
   */
  findImplementations: (
    serviceName: string,
    methodName: string,
    protoUri: Uri,
  ) => Promise<Location[]>
}

/**
 * 实现位置信息
 */
export interface ImplementationLocation {
  uri: Uri
  range: {
    start: { line: number, character: number }
    end: { line: number, character: number }
  }
  displayName: string
}
