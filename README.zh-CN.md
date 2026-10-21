<p align="center">
  <img src="static/brand/puretools-logo.png" alt="PureTools Logo" width="128" height="128">
</p>

<h1 align="center">PureTools</h1>

中文 | [English](README.md)

PureTools 是一个轻量、隐私优先、纯前端的开发者工具集网站。核心处理都在浏览器本地完成，无业务后端依赖；个别工具会只读获取明确标注的公开参考数据。

## 亮点

- 纯前端，无后端依赖
- 隐私优先：数据不出本地
- 支持深色/浅色模式（默认跟随系统）
- 工具搜索 + 分类分组导航

## 工具列表

- UUID 生成器（RFC 4122 v4）：生成、校验、历史记录、复制
- 随机字符串生成器：适合邮箱前缀的预设、批量生成、复制、历史记录
- JSON 格式化：格式化、压缩、校验、转义/反转义、语法高亮、行号、复制
- SQL 格式化：格式化/压缩、基础校验（字符串/括号）、行号、复制
- [Markdown 预览器](docs/markdown-preview.md)：在本地预览 CommonMark 或 Enhanced 模式的 GFM、数学公式、Mermaid 与受限静态 HTML
- 本地翻译：使用 Chrome 端侧模型完成私密翻译，支持语言识别与模型下载进度
- 正则工具：校验、测试、高亮匹配、模板生成
- CRON 工具：5 字段表达式校验与生成
- Base64 工具：编码/解码、URL Safe 模式
- URL 编码：编码/解码（Component / Full URL）
- 二维码生成器：将原始文本生成二维码并下载 PNG
- JWT 解码：Header/Payload 解析、时间字段提示
- Hash 计算与校验：精确 UTF-8 文本与本地文件的 MD5、SHA-1/256/384/512，校验和比对、分块进度与取消
- 时间戳工具：时间戳 <-> 本地时间，秒/毫秒，本地/UTC 输出、复制
- GitHub CDN：GitHub/raw 链接转换为 Raw + jsDelivr，支持复制
- 参考汇率转换：只读获取公开参考汇率，金额换算与缓存均在浏览器本地完成

## 技术栈

- SvelteKit（Svelte 5 Runes）+ Vite
- TypeScript（严格模式）
- Tailwind CSS v4
- Biome（格式化/检查）
- Cloudflare Adapter（部署目标）

## 本地开发

1. 安装依赖：

```sh
bun install
```

2. 启动开发服务器：

```sh
bun run dev
```

## 常用脚本

- `bun run dev`: 启动开发服务器
- `bun run build`: 生产构建
- `bun run preview`: 预览构建产物
- `bun run test`: 运行单元测试与浏览器端到端测试
- `bun run test:unit`: 运行 Bun 单元测试
- `bun run test:e2e`: 运行 Playwright 浏览器测试
- `bun run test:exchange-rate:live`: 检查真实汇率 API、CORS 策略与响应契约
- `bun run check`: 类型检查与同步
- `bun run lint`: Lint + 类型检查
- `bun run lint:fix`: 自动修复 Lint
- `bun run format`: 格式化代码
- `bun run cf:dev`: Wrangler 本地调试
- `bun run cf:deploy`: 部署到 Cloudflare Workers

## 说明

- 所有工具的核心处理均在浏览器本地运行，不会上传用户输入；参考汇率工具仅下载公开汇率表。
- `/hash` 保持 SHA-256 为默认算法。非空文本在 250 ms 防抖后自动计算；空文本与选择/拖入的
  单个文件通过 Calculate 计算。预期校验和忽略首尾空白和十六进制大小写，修改预期值只比较已有结果。
- 哈希工具不会上传或持久化文本、文件及预期校验和。SHA 文本继续使用 Web Crypto（需 HTTPS 或
  localhost）；MD5 文本与全部文件算法复用本地打包、按需加载的 `hash-wasm` 4.12.0（[MIT 许可证](static/licenses/hash-wasm.txt)，零运行时依赖）。
  文件按原始字节在独立 Web Worker 中顺序读取，每块最多 4 MiB；取消、切换输入及离开页面时终止 Worker。
  文件处理需要浏览器支持 Workers、Blob slice/arrayBuffer 和 WebAssembly；缺少能力时显示错误，
  不降级为整文件读取，也不承诺无限文件大小，仍受浏览器、设备资源与处理时间限制。输入仅保留在当前页面内存。
- 哈希一致不能证明来源可信。MD5 存在碰撞风险，不适用于密码存储、安全签名或抗恶意篡改校验；优先选择 SHA-256。
- 本地翻译需要桌面版 Chrome 138 或更高版本，翻译模型由 Chrome 按需下载和管理。
- Playwright 在 Linux x64 上使用项目内置 Chromium；Linux arm64/其他架构、macOS 和 Windows 使用 Playwright 原生浏览器，首次运行前需执行
  `bunx playwright install chromium`。

## 品牌资源

- [生图高清原件](static/brand/puretools-logo-original.png)
- [网站生产版 Logo](static/brand/puretools-logo.png)
- [初始生图提示词](docs/brand/puretools-logo-prompt.txt)
- [精修提示词](docs/brand/puretools-logo-refinement-prompt.txt)

## 许可证

本项目采用 GNU Affero General Public License v3.0 或更高版本授权（`AGPL-3.0-or-later`）。详见 [LICENSE](LICENSE) 文件。
