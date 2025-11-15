# vscode-pb-jump

<a href="https://marketplace.visualstudio.com/items?itemName=xhofe.vscode-pb-jump" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/xhofe.vscode-pb-jump.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

支持 proto 文件的方法与 golang 实现的相互跳转的 VSCode 插件。

## 功能特性

- ✅ 支持 proto2 和 proto3
- ✅ 双向跳转：proto ↔ golang
- ✅ 通过 CodeLens 在方法上方显示跳转按钮
- ✅ 自动查找对应的实现/定义
- ✅ 多个匹配时显示选择列表
- ✅ 单个匹配时直接跳转
- ✅ 可扩展的语言支持接口（预留其他语言扩展）

## 使用方法

### 从 Proto 跳转到 Golang 实现

1. 打开一个 `.proto` 文件
2. 在服务方法定义的上方会显示 `→ 跳转到实现` 按钮
3. 点击按钮即可跳转到对应的 Golang 实现

### 从 Golang 实现跳转到 Proto 定义

1. 打开一个 `.go` 文件
2. 在 gRPC 方法实现的上方会显示 `← 跳转到 proto` 按钮
3. 点击按钮即可跳转到对应的 proto 方法定义

## 工作原理

插件会：
1. 解析 proto 文件，提取服务和方法信息
2. 在工作区中搜索对应的 Golang 实现文件
3. 匹配常见的 gRPC 服务实现模式：
   - `func (s *ServiceServer) MethodName(...)`
   - `func (s *Service) MethodName(...)`
   - `func MethodName(...)`

## Configurations

<!-- configs -->

| Key                              | Description                          | Type     | Default |
| -------------------------------- | ------------------------------------ | -------- | ------- |
| `vscode-pb-jump.defaultLanguage` | %config.defaultLanguage.description% | `string` | `"go"`  |

<!-- configs -->

## Commands

<!-- commands -->

| Command                               | Title                                                    |
| ------------------------------------- | -------------------------------------------------------- |
| `vscode-pb-jump.jumpToImplementation` | %command.category%: %command.jumpToImplementation.title% |
| `vscode-pb-jump.jumpToProto`          | %command.category%: %command.jumpToProto.title%          |

<!-- commands -->

## License

[MIT](./LICENSE.md) License © 2022 [Andy Hsu](https://github.com/xhofe)
