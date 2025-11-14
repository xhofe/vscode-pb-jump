import type {
  CancellationToken,
  CodeLensProvider,
  Command,
  TextDocument,
} from 'vscode'
import { CodeLens, Range } from 'vscode'
import { parseProtoFile } from '../parser/proto'
import { logger } from '../utils'

/**
 * Proto 文件的 CodeLens 提供者
 * 在 proto 方法上方显示跳转按钮
 */
export class ProtoCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(
    document: TextDocument,
    _token: CancellationToken,
  ): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = []

    try {
      const services = parseProtoFile(document)

      for (const service of services) {
        for (const method of service.methods) {
          // 在方法定义行的上方创建 CodeLens
          const range = new Range(
            method.line,
            0,
            method.line,
            0,
          )

          const command: Command = {
            title: '$(arrow-right) 跳转到实现',
            command: 'vscode-pb-jump.jumpToImplementation',
            arguments: [
              method.serviceName,
              method.name,
              document.uri,
            ],
            tooltip: `跳转到 ${method.serviceName}.${method.name} 的实现`,
          }

          codeLenses.push(new CodeLens(range, command))
        }
      }

      logger.info(
        `Created ${codeLenses.length} CodeLens(es) for ${document.fileName}`,
      )
    }
    catch (error) {
      logger.error(`Error providing CodeLenses: ${error}`)
    }

    return codeLenses
  }
}
