# vscode-pb-jump

<a href="https://marketplace.visualstudio.com/items?itemName=xhofe.vscode-pb-jump" target="__blank"><img src="https://img.shields.io/visual-studio-marketplace/v/xhofe.vscode-pb-jump.svg?color=eee&amp;label=VS%20Code%20Marketplace&logo=visual-studio-code" alt="Visual Studio Marketplace Version" /></a>
<a href="https://kermanx.github.io/reactive-vscode/" target="__blank"><img src="https://img.shields.io/badge/made_with-reactive--vscode-%23007ACC?style=flat&labelColor=%23229863"  alt="Made with reactive-vscode" /></a>

支持 proto 文件的方法与 golang 实现的相互跳转的 VSCode 插件。

## 功能特性

- ✅ 支持 proto2 和 proto3
- ✅ 通过 CodeLens 在 proto 方法上方显示跳转按钮
- ✅ 自动查找对应的 Golang 实现
- ✅ 多个实现时显示选择列表
- ✅ 单个实现时直接跳转
- ✅ 可扩展的语言支持接口（预留其他语言扩展）

## 使用方法

1. 打开一个 `.proto` 文件
2. 在服务方法定义的上方会显示 `→ 跳转到实现` 按钮
3. 点击按钮即可跳转到对应的 Golang 实现

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

- `vscode-pb-jump.defaultLanguage`: 默认的目标语言（当前仅支持 `go`）

<!-- configs -->

## Commands

<!-- commands -->

- `vscode-pb-jump.jumpToImplementation`: 跳转到实现（通过 CodeLens 调用）

<!-- commands -->

## License

[MIT](./LICENSE.md) License © 2022 [Andy Hsu](https://github.com/xhofe)
