import type { Uri } from 'vscode'
import type { LanguageFinder } from '../finder/language-finder'
import { window, workspace } from 'vscode'
import { GolangFinder } from '../finder/golang-finder'
import { ProtoFinder } from '../finder/proto-finder'
import { logger } from '../utils'

/**
 * 语言查找器注册表
 */
const languageFinders = new Map<string, LanguageFinder>()

/**
 * 注册语言查找器
 */
export function registerLanguageFinder(finder: LanguageFinder): void {
  languageFinders.set(finder.language, finder)
}

/**
 * 初始化默认的语言查找器
 */
export function initializeLanguageFinders(): void {
  registerLanguageFinder(new GolangFinder())
}

/**
 * 跳转到实现
 * @param serviceName 服务名称
 * @param methodName 方法名称
 * @param protoUri proto 文件的 URI
 * @param language 目标语言（默认为 'go'）
 */
export async function jumpToImplementation(
  serviceName: string,
  methodName: string,
  protoUri: Uri,
  language: string = 'go',
): Promise<void> {
  try {
    const finder = languageFinders.get(language)
    if (!finder) {
      window.showWarningMessage(
        `不支持的语言: ${language}。当前支持的语言: ${Array.from(languageFinders.keys()).join(', ')}`,
      )
      return
    }

    const locations = await finder.findImplementations(
      serviceName,
      methodName,
      protoUri,
    )

    if (locations.length === 0) {
      window.showInformationMessage(
        `未找到 ${serviceName}.${methodName} 的 ${language} 实现`,
      )
      return
    }

    if (locations.length === 1) {
      // 单个实现，直接跳转
      await window.showTextDocument(locations[0].uri, {
        selection: locations[0].range,
        preview: false,
      })
    }
    else {
      // 多个实现，显示选择列表
      const items = locations.map((loc, index) => {
        const relativePath = workspace.asRelativePath(loc.uri)
        return {
          label: `$(file-code) ${relativePath}`,
          description: `第 ${loc.range.start.line + 1} 行`,
          detail: loc.uri.fsPath,
          location: loc,
          index,
        }
      })

      const selected = await window.showQuickPick(items, {
        placeHolder: `找到 ${locations.length} 个实现，请选择一个`,
        matchOnDescription: true,
        matchOnDetail: true,
      })

      if (selected) {
        await window.showTextDocument(selected.location.uri, {
          selection: selected.location.range,
          preview: false,
        })
      }
    }
  }
  catch (error) {
    logger.error(`Error jumping to implementation: ${error}`)
    window.showErrorMessage(
      `跳转失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

/**
 * Proto 查找器实例
 */
const protoFinder = new ProtoFinder()

/**
 * 跳转到 proto 定义（反向跳转）
 * @param methodName 方法名称
 * @param receiverType 接收者类型（可选）
 * @param goFileUri Golang 文件的 URI
 */
export async function jumpToProto(
  methodName: string,
  receiverType: string | undefined,
  goFileUri: Uri,
): Promise<void> {
  try {
    const locations = await protoFinder.findProtoDefinitions(
      methodName,
      receiverType,
      goFileUri,
    )

    if (locations.length === 0) {
      window.showInformationMessage(
        `未找到方法 ${methodName} 的 proto 定义`,
      )
      return
    }

    if (locations.length === 1) {
      // 单个定义，直接跳转
      await window.showTextDocument(locations[0].uri, {
        selection: locations[0].range,
        preview: false,
      })
    }
    else {
      // 多个定义，显示选择列表
      const items = locations.map((loc, index) => {
        const relativePath = workspace.asRelativePath(loc.uri)
        return {
          label: `$(file-code) ${relativePath}`,
          description: `第 ${loc.range.start.line + 1} 行`,
          detail: loc.uri.fsPath,
          location: loc,
          index,
        }
      })

      const selected = await window.showQuickPick(items, {
        placeHolder: `找到 ${locations.length} 个 proto 定义，请选择一个`,
        matchOnDescription: true,
        matchOnDetail: true,
      })

      if (selected) {
        await window.showTextDocument(selected.location.uri, {
          selection: selected.location.range,
          preview: false,
        })
      }
    }
  }
  catch (error) {
    logger.error(`Error jumping to proto: ${error}`)
    window.showErrorMessage(
      `跳转失败: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}
