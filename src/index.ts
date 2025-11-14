import { defineExtension, useDisposable, useCommand } from 'reactive-vscode'
import { languages, Uri } from 'vscode'
import { ProtoCodeLensProvider } from './codelens/proto-codelens'
import { GolangCodeLensProvider } from './codelens/golang-codelens'
import { initializeLanguageFinders, jumpToImplementation, jumpToProto, registerLanguageFinder } from './commands/jump'
import type { LanguageFinder } from './finder/language-finder'

const { activate, deactivate } = defineExtension(() => {
  // 初始化语言查找器
  initializeLanguageFinders()

  // 注册 Proto CodeLens 提供者
  useDisposable(
    languages.registerCodeLensProvider(
      { language: 'proto' },
      new ProtoCodeLensProvider(),
    ),
  )

  // 注册 Golang CodeLens 提供者
  useDisposable(
    languages.registerCodeLensProvider(
      { language: 'go' },
      new GolangCodeLensProvider(),
    ),
  )

  // 注册跳转到实现的命令（proto -> go）
  useCommand(
    'vscode-pb-jump.jumpToImplementation',
    async (serviceName: string, methodName: string, protoUri: Uri) => {
      await jumpToImplementation(serviceName, methodName, protoUri)
    },
  )

  // 注册跳转到 proto 的命令（go -> proto）
  useCommand(
    'vscode-pb-jump.jumpToProto',
    async (methodName: string, receiverType: string | undefined, goFileUri: Uri) => {
      await jumpToProto(methodName, receiverType, goFileUri)
    },
  )

  // 导出注册语言查找器的函数，供未来扩展使用
  return {
    registerLanguageFinder,
  }
})

export { activate, deactivate }
export type { LanguageFinder }
