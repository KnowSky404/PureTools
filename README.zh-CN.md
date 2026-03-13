# PureTools

中文 | [English](README.md)

PureTools 是一个轻量、隐私优先、纯前端的开发者工具集网站。所有处理都在浏览器本地完成，无任何后端依赖。

## 亮点

- 纯前端，无后端依赖
- 隐私优先：数据不出本地
- 支持深色/浅色模式（默认跟随系统）
- 工具搜索 + 分类分组导航

## 工具列表

- UUID 生成器（RFC 4122 v4）：生成、校验、历史记录、复制
- JSON 格式化：格式化、压缩、校验、转义/反转义、语法高亮、行号、复制
- SQL 格式化：格式化/压缩、基础校验（字符串/括号）、行号、复制
- 正则工具：校验、测试、高亮匹配、模板生成
- CRON 工具：5 字段表达式校验与生成
- Base64 工具：编码/解码、URL Safe 模式
- URL 编码：编码/解码（Component / Full URL）
- JWT 解码：Header/Payload 解析、时间字段提示
- Hash 工具：SHA-1/256/384/512（Web Crypto）
- 时间戳工具：时间戳 <-> 本地时间，秒/毫秒，本地/UTC 输出、复制
- GitHub CDN：GitHub/raw 链接转换为 Raw + jsDelivr，支持复制

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
- `bun run check`: 类型检查与同步
- `bun run lint`: Lint + 类型检查
- `bun run lint:fix`: 自动修复 Lint
- `bun run format`: 格式化代码
- `bun run cf:dev`: Wrangler 本地调试
- `bun run cf:deploy`: 部署到 Cloudflare Workers

## 说明

- 所有工具均在浏览器本地运行，不会上传任何数据。
