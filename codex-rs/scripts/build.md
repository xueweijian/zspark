# 在 GitHub Actions 上编译 codex.exe(节省本地编译时间)

## 背景

`codex-rs` 是一个超大型 Cargo workspace,首次 `cargo build --release` 在普通开发机上耗
时很久。本方案把编译放到 GitHub Actions 的 `windows-latest` runner 上完成,产物拉回本
地直接使用,**无需改动任何业务代码**。

桌面端(`desktop/src/main/index.ts` 的 `resolveCodexBinary()`)会优先查找 dev 路径
`codex-rs/target/release/codex.exe`,找到就用它;找不到才用打包内置的二进制。因此只要
把 CI 产物放到该路径,`pnpm dev` 即自动生效。

## 触发 CI 构建

仅手动触发(避免占用额度)。

- 网页:GitHub → Actions → **build-codex-windows** → Run workflow
- 命令行:`gh workflow run build-codex-windows.yml`

预计耗时:首次(无缓存)约 15–25 分钟;有缓存后增量约 1–5 分钟。

## 拉取产物到本地

在仓库根目录执行:

```bash
node scripts/pull-codex.mjs              # 拉最新成功构建
node scripts/pull-codex.mjs --run 12345  # 拉指定 run id
node scripts/pull-codex.mjs --force      # 即使本地已存在也覆盖
```

脚本会自动把 `codex.exe` 放到 `codex-rs/target/release/`,并执行 `--version` 做校验。

### 前置条件(二选一)

1. **推荐**:安装 `gh` 并 `gh auth login`(脚本默认走这条路径,体验最好)。
2. 设置环境变量 `GITHUB_TOKEN`(需 `repo` 与 `actions:read` 权限),脚本会回退到 REST API。

## 与官方 workflow 的区别

| 项 | 官方 `rust-release-windows.yml` | 本方案 `build-codex-windows.yml` |
| --- | --- | --- |
| Runner | OpenAI 私有 runner group(`codex-runners`) | 标准 `windows-latest`(任何 fork 可用) |
| 代码签名 | Azure Trusted Signing | 无(未签名 dev 用) |
| LTO | 主线 fat LTO | 关闭(优先编译速度) |
| 构建范围 | 全部 Windows 二进制 | 仅 `codex.exe` |
| 触发 | 发布流程调用 | 手动触发 |

## 常见问题

- **`pnpm dev` 仍提示找不到 codex**:确认 `codex-rs/target/release/codex.exe` 存在,且
  `pull-codex.mjs` 最后的 `--version` 校验通过。
- **下载报 artifact 已过期**:artifact 默认保留 14 天,重新触发一次 CI 构建即可。
- **Windows SmartScreen 拦截**:未签名二进制首次运行可能被拦截,点击"更多信息 → 仍要运行";
  或对开发者本机,可在 Defender 排除该目录。
