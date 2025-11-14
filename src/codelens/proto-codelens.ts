import type {
  CancellationToken,
  CodeLensProvider,
  Command,
  TextDocument,
} from 'vscode'
import { CodeLens, l10n, Range } from 'vscode'
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
            title: `$(arrow-right) ${l10n.t('Jump to Implementation')}`,
            command: 'vscode-pb-jump.jumpToImplementation',
            arguments: [
              method.serviceName,
              method.name,
              method.inputType,
              method.outputType,
              document.uri,
            ],
            tooltip: l10n.t('Jump to {0}.{1} implementation', method.serviceName, method.name),
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
