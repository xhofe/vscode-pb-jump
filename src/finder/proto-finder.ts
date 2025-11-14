import type { Uri } from 'vscode'
import { workspace, Range, Location } from 'vscode'
import { parseProtoFile } from '../parser/proto'
import { logger } from '../utils'

/**
 * Proto 文件查找器
 * 根据 Golang 方法名称查找对应的 proto 定义
 */
export class ProtoFinder {
  /**
   * 查找方法对应的 proto 定义
   * @param methodName 方法名称
   * @param receiverType 接收者类型（可选，用于推断服务名）
   * @param goFileUri Golang 文件的 URI
   * @returns proto 方法定义的位置数组
   */
  async findProtoDefinitions(
    methodName: string,
    receiverType?: string,
    goFileUri?: Uri,
  ): Promise<Location[]> {
    const locations: Location[] = []

    try {
      // 查找所有 .proto 文件
      const protoFiles = await workspace.findFiles(
        '**/*.proto',
        null,
      )

      // 尝试从接收者类型推断服务名
      // 例如：alertPilotSrvImpl -> AlertPilot (移除后缀如 SrvImpl, Server, Service 等)
      let possibleServiceNames: string[] = []
      if (receiverType) {
        // 移除常见的后缀
        const cleaned = receiverType
          .replace(/SrvImpl$/, '')
          .replace(/Server$/, '')
          .replace(/Service$/, '')
          .replace(/Impl$/, '')

        // 转换为可能的服务名格式（首字母大写）
        if (cleaned.length > 0) {
          possibleServiceNames.push(
            cleaned.charAt(0).toUpperCase() + cleaned.slice(1),
          )
        }
        // 也尝试原始名称
        possibleServiceNames.push(receiverType)
      }

      for (const protoFile of protoFiles) {
        try {
          const document = await workspace.openTextDocument(protoFile)
          const services = parseProtoFile(document)

          for (const service of services) {
            for (const method of service.methods) {
              // 精确匹配方法名
              if (method.name === methodName) {
                // 如果提供了接收者类型，尝试匹配服务名
                if (receiverType && possibleServiceNames.length > 0) {
                  // 检查服务名是否与可能的服务名匹配（忽略大小写）
                  const serviceNameLower = service.name.toLowerCase()
                  const matches = possibleServiceNames.some(
                    name => serviceNameLower.includes(name.toLowerCase())
                        || name.toLowerCase().includes(serviceNameLower),
                  )

                  if (!matches) {
                    // 如果不匹配，仍然添加但标记为可能不准确
                    // 我们仍然添加它，因为方法名匹配
                  }
                }

                locations.push(new Location(protoFile, method.range))
              }
            }
          }
        }
        catch (error) {
          logger.warn(`Failed to read proto file ${protoFile.fsPath}: ${error}`)
        }
      }

      logger.info(
        `Found ${locations.length} proto definition(s) for method ${methodName}`,
      )

      return locations
    }
    catch (error) {
      logger.error(`Error finding proto definitions: ${error}`)
      return []
    }
  }
}

