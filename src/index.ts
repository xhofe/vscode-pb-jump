import type { Uri } from 'vscode'
import type { LanguageFinder } from './finder/language-finder'
import { defineExtension, useCommand, useDisposable } from 'reactive-vscode'
import { languages } from 'vscode'
import { GolangCodeLensProvider } from './codelens/golang-codelens'
import { ProtoCodeLensProvider } from './codelens/proto-codelens'
import { initializeLanguageFinders, jumpToImplementation, jumpToProto, registerLanguageFinder } from './commands/jump'

const { activate, deactivate } = defineExtension(() => {
  // 初始化语言查找器
  initializeLanguageFinders()

  // 注册 Proto CodeLens 提供者
  useDisposable(
    languages.registerCodeLensProvider(
      { pattern: '**/*.proto' },
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
    async (serviceName: string, methodName: string, inputType: string, outputType: string, protoUri: Uri) => {
      await jumpToImplementation(serviceName, methodName, inputType, outputType, protoUri)
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
