import type {
  CancellationToken,
  CodeLensProvider,
  Command,
  TextDocument,
} from 'vscode'
import { CodeLens, Range, l10n } from 'vscode'
import { parseGolangFile } from '../parser/golang'
import { logger } from '../utils'

/**
 * Golang 文件的 CodeLens 提供者
 * 在 gRPC 方法实现上方显示跳转到 proto 定义的按钮
 */
export class GolangCodeLensProvider implements CodeLensProvider {
  async provideCodeLenses(
    document: TextDocument,
    _token: CancellationToken,
  ): Promise<CodeLens[]> {
    const codeLenses: CodeLens[] = []

    try {
      const methods = parseGolangFile(document)

      for (const method of methods) {
        // 判断是否为 gRPC 方法：
        // 1. 有接收者（通常是服务实现）
        // 2. 方法签名包含 context.Context（gRPC 方法的典型特征）
        // 3. 方法名首字母大写（Go 的导出方法）
        const isGRPCMethod = method.receiverType
          && (method.signature.includes('context.Context')
            || method.signature.includes('*pb.')
            || method.signature.includes('pb.'))
          && method.name[0] === method.name[0].toUpperCase()

        if (isGRPCMethod) {
          // 在方法定义行的上方创建 CodeLens
          const range = new Range(
            method.line,
            0,
            method.line,
            0,
          )

          const command: Command = {
            title: `$(arrow-left) ${l10n.t('Jump to Proto')}`,
            command: 'vscode-pb-jump.jumpToProto',
            arguments: [
              method.name,
              method.receiverType,
              document.uri,
            ],
            tooltip: l10n.t('Jump to {0} proto definition', method.name),
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
