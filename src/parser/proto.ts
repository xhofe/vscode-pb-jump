import type { TextDocument } from 'vscode'
import { Position, Range } from 'vscode'

export interface ProtoService {
  name: string
  methods: ProtoMethod[]
  range: Range
}

export interface ProtoMethod {
  name: string
  serviceName: string
  inputType: string
  outputType: string
  range: Range
  line: number
}

/**
 * 解析 proto 文件，提取服务和方法信息
 * 支持 proto2 和 proto3
 */
export function parseProtoFile(document: TextDocument): ProtoService[] {
  const text = document.getText()
  const services: ProtoService[] = []
  const lines = text.split('\n')

  let currentService: ProtoService | null = null
  let braceCount = 0
  let inService = false
  let serviceStartLine = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmedLine = line.trim()

    // 检测服务定义 (支持 proto2 和 proto3)
    // 匹配: service ServiceName { 或 service ServiceName{
    const serviceMatch = trimmedLine.match(/^service\s+(\w+)\s*\{/)
    if (serviceMatch) {
      if (currentService) {
        services.push(currentService)
      }
      const serviceName = serviceMatch[1]
      serviceStartLine = i
      braceCount = 1
      inService = true
      currentService = {
        name: serviceName,
        methods: [],
        range: new Range(
          serviceStartLine,
          0,
          serviceStartLine,
          line.length,
        ),
      }
      continue
    }

    if (inService) {
      // 计算大括号数量
      for (const char of line) {
        if (char === '{')
          braceCount++
        if (char === '}')
          braceCount--
      }

      // 检测 RPC 方法定义
      // 匹配: rpc MethodName(input) returns (output) 或 rpc MethodName (input) returns (output)
      // 支持各种格式，包括流式 RPC
      const rpcMatch = trimmedLine.match(/^rpc\s+(\w+)\s*\([^)]*\)\s+returns\s*\([^)]*\)/)
      if (rpcMatch) {
        const methodName = rpcMatch[1]
        // 提取输入和输出类型
        const inputMatch = trimmedLine.match(/\(([^)]+)\)/)
        const outputMatch = trimmedLine.match(/returns\s*\(([^)]+)\)/)
        const inputType = inputMatch ? inputMatch[1].trim() : ''
        const outputType = outputMatch ? outputMatch[1].trim() : ''

        if (currentService) {
          const methodRange = document.getWordRangeAtPosition(
            new Position(i, trimmedLine.indexOf(methodName)),
          ) || new Range(i, 0, i, line.length)

          currentService.methods.push({
            name: methodName,
            serviceName: currentService.name,
            inputType,
            outputType,
            range: methodRange,
            line: i,
          })
        }
      }

      // 服务定义结束
      if (braceCount === 0 && inService) {
        if (currentService) {
          currentService.range = new Range(
            serviceStartLine,
            0,
            i,
            line.length,
          )
          services.push(currentService)
          currentService = null
        }
        inService = false
      }
    }
  }

  // 处理最后一个服务
  if (currentService) {
    services.push(currentService)
  }

  return services
}

/**
 * 获取指定位置的方法信息
 */
export function getMethodAtPosition(
  document: TextDocument,
  position: Position,
): ProtoMethod | null {
  const services = parseProtoFile(document)
  for (const service of services) {
    for (const method of service.methods) {
      if (method.range.contains(position)) {
        return method
      }
    }
  }
  return null
}
