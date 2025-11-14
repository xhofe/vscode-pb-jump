import { defineExtension, useDisposable, useCommand } from 'reactive-vscode'
import { languages, Uri } from 'vscode'
import { ProtoCodeLensProvider } from './codelens/proto-codelens'
import { initializeLanguageFinders, jumpToImplementation, registerLanguageFinder } from './commands/jump'
import type { LanguageFinder } from './finder/language-finder'

const { activate, deactivate } = defineExtension(() => {
  // 初始化语言查找器
  initializeLanguageFinders()

  // 注册 CodeLens 提供者
  useDisposable(
    languages.registerCodeLensProvider(
      { language: 'proto' },
      new ProtoCodeLensProvider(),
    ),
  )

  // 注册跳转命令
  useCommand(
    'vscode-pb-jump.jumpToImplementation',
    async (serviceName: string, methodName: string, protoUri: Uri) => {
      await jumpToImplementation(serviceName, methodName, protoUri)
    },
  )

  // 导出注册语言查找器的函数，供未来扩展使用
  return {
    registerLanguageFinder,
  }
})

export { activate, deactivate }
export type { LanguageFinder }
