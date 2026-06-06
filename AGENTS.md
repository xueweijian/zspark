# 优秀同行参考项目

- `cc-haha-main` 目录是同行的优秀开源项目，仅用于 AI 的参考与借鉴。**请勿**将其误认为是本项目的主体业务代码目录，也不要在其中添加或修改任何业务代码。
- `CodexMonitor-main` 目录是同行的优秀开源项目，仅用于 AI 的参考与借鉴。**请勿**将其误认为是本项目的主体业务代码目录，也不要在其中添加或修改任何业务代码。

# Rust/codex-rs

在存放 Rust 代码的 `codex-rs` 文件夹中：

- Crate（包）名称需带有 `codex-` 前缀。例如，`core` 文件夹的 Crate 命名为 `codex-core`。
- 使用 `format!` 且可以将变量内联到 `{}` 中时，请务必这样做。
- 在运行此处指令前，请先安装该项目依赖的任何命令（例如 `just`、`rg` 或 `cargo-insta`，如果尚未安装）。
- 绝不要添加或修改任何与 `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` 或 `CODEX_SANDBOX_ENV_VAR` 相关的代码。
  - 您是在一个沙箱中运行，无论何时使用 `shell` 工具，都会设置 `CODEX_SANDBOX_NETWORK_DISABLED=1`。任何使用 `CODEX_SANDBOX_NETWORK_DISABLED_ENV_VAR` 的现有代码在编写时都考虑到了这一点。它通常用于在检测到沙箱限制、明知无法运行测试时提早退出测试。
  - 类似地，当您使用 Seatbelt (`/usr/bin/sandbox-exec`) 派生进程时，子进程上会设置 `CODEX_SANDBOX=seatbelt`。由于在 Seatbelt 下无法自行运行 Seatbelt 的集成测试，因此通常也会检查 `CODEX_SANDBOX=seatbelt` 以便在适当时提早退出测试。
- 始终合并 `if` 语句，参考：https://rust-lang.github.io/rust-clippy/master/index.html#collapsible_if
- 尽可能始终内联 `format!` 参数，参考：https://rust-lang.github.io/rust-clippy/master/index.html#uninlined_format_args
- 尽可能使用方法引用（method reference）代替闭包，参考：https://rust-lang.github.io/rust-clippy/master/index.html#redundant_closure_for_method_calls
- 避免使用布尔（bool）或含义模糊的 `Option` 参数，因为它们会强迫调用者写出难以阅读的代码，例如 `foo(false)` 或 `bar(None)`。推荐使用枚举（enum）、有意义的具名方法、新型（newtype）或其他符合 Rust 惯例的 API 形式，使调用端代码能够自解释。
- 当无法更改 API，而 Rust 中仍需要少量的位置字面量调用时，请遵循 `argument_comment_lint` 约定：
  - 在按位置传递不透明字面量参数（如 `None`、布尔值 and 数值字面量）之前，使用确切的 `/*参数名*/` 注释。
  - 不要为字符串或字符字面量添加此类注释，除非注释确实能增加清晰度；这些字面量是有意豁免该 Lint 检查的。
  - 注释中的参数名必须与被调用函数的签名完全匹配。
  - 您可以运行 `just argument-comment-lint` 在本地运行此 Lint 检查。由于此工具由 Bazel 驱动，第一次运行未预热时可能会较慢，但增量调用应在 15 秒内完成。通常，最好直接更新 PR 并让 CI 负责此项检查（或者在提交 PR 后在后台异步运行它）。请注意，CI 会检查所有三个平台，而本地运行不会。
- 尽可能使 `match` 语句详尽无遗（exhaustive），并避免使用通配符分支（`_` 匹配）。
- 新增的 Trait 应包含文档注释，说明其作用以及预期的实现方式。
- 在 Rust Trait 中不鼓励使用 `#[async_trait]` 和 `#[allow(async_fn_in_trait)]`。
  - 推荐使用原生的 RPITIT 特性方法，并在返回的 Future 上显式声明 `Send` 约束，如 `3c7f013f9735` / `#16630` 所示。
  - 推荐的 Trait 形式：
    `fn foo(&self, ...) -> impl std::future::Future<Output = T> + Send;`
  - 如果实现满足此协定，仍可以使用 `async fn foo(&self, ...) -> T`。
  - 不要使用 `#[allow(async_fn_in_trait)]` 作为规避显式声明 Future 协定的快捷方式。
- 编写测试时，相比于逐个比较字段，更推荐直接比较整个对象的相等性。
- 不要将一般性的产品或面向用户的文档添加到 `docs/` 文件夹。Codex 的官方文档存放在其他地方。唯一的例外是应用服务器（app-server）的 API 文档，这在下面的应用服务器指南中有说明。
- 推荐使用私有模块（private modules）并显式导出公共的 Crate API。
- If you change `ConfigToml` or nested config types, run `just write-config-schema` to update `codex-rs/core/config.schema.json`.
- 在处理 MCP 工具调用时，推荐使用 `codex-rs/codex-mcp/src/mcp_connection_manager.rs` 来处理工具和工具调用的修改。旨在最小化修改范围并利用现有的抽象，而不是在多级函数调用之间层层传递代码。
- If you change Rust dependencies (`Cargo.toml` or `Cargo.lock`), run `just bazel-lock-update` from the repo root to refresh `MODULE.bazel.lock`, and include that lockfile update in the same change.
- After dependency changes, run `just bazel-lock-check` from the repo root so lockfile drift is caught locally before CI.
- Bazel does not automatically make source-tree files available to compile-time Rust file access. If you add `include_str!`, `include_bytes!`, `sqlx::migrate!`, or similar build-time file or directory reads, update the crate's `BUILD.bazel` (`compile_data`, `build_script_data`, or test data) or Bazel may fail even when Cargo passes.
- 不要创建仅被引用一次的小型辅助方法。
- 避免大型模块：
  - 推荐添加新模块，而不是继续扩大现有模块。
  - Rust 模块的行数目标应控制在 500 行（LoC）以内，不含测试。
  - 如果文件超过大约 800 行（LoC），除非有强有力的书面理由不这样做，否则请在新的模块中添加新功能，而不要扩展现有文件。
  - 本规则尤其适用于那些已经经常发生无关变更的高频接触文件，例如 `codex-rs/tui/src/app.rs`、`codex-rs/tui/src/bottom_pane/chat_composer.rs`、`codex-rs/tui/src/bottom_pane/footer.rs`、`codex-rs/tui/src/chatwidget.rs`、`codex-rs/tui/src/bottom_pane/mod.rs` 以及类似的中央编排模块。
  - 从大型模块中提取代码时，请将相关的测试以及模块/类型文档移动到新实现处，以使不变性（invariants）紧跟拥有它们的代码。
  - 除非改动极其简单，否则避免在 `codex-rs/tui/src/chatwidget.rs` 中直接添加新的独立方法；推荐使用新的模块/文件，并保持 `chatwidget.rs` 专注于业务编排。
- 在运行 Rust 命令（例如 `just fix` 或 `cargo test`）时，请耐心等待命令完成，切勿尝试使用 PID 强制终止它们。Rust 文件锁可能会使执行变慢，这是预期内的。

在完成 Rust 代码修改后，会自动运行 `just fmt`（在 `codex-rs` 目录中）；无需请求批准即可运行。此外，运行测试：

1. 针对被修改的特定项目运行测试。例如，如果修改了 `codex-rs/tui`，请运行 `cargo test -p codex-tui`。
2. 待其通过后，如果对公共（common）、核心（core）或协议（protocol）进行了任何修改，请使用 `cargo test`（或者如果安装了 `cargo-nextest`，则使用 `just test`）运行完整的测试套件。对于常规本地运行，避免使用 `--all-features`，因为这会扩大构建矩阵并显著增加 `target/` 磁盘占用；仅在需要完整特性覆盖时使用它。项目特定或单个的测试可以无需询问用户直接运行，但运行完整的测试套件前必须先询问用户。

在完成对 `codex-rs` 的大型修改前，运行 `just fix -p <项目>`（在 `codex-rs` 目录中）以修复代码中的任何 Linter 问题。推荐使用 `-p` 限制范围以避免缓慢的整个工作区 Clippy 构建；仅在修改了共享 Crate 时，才运行不带 `-p` 的 `just fix`。在运行 `fix` 或 `fmt` 后，无需重新运行测试。

## `codex-core` Crate

随着时间的推移，`codex-core` Crate（定义在 `codex-rs/core/` 中）变得庞大，因为它是最大的 Crate，导致人们往往更容易直接向 `codex-core` 添加新内容，而不是将所需的库代码重构出来，使得您的新代码既不依赖于 `codex-core`，也不增加其体积。

为此：**坚决抵制向 `codex-core` 添加代码！**

尤其是引入新概念/功能/API 时，在向 `codex-core` 添加之前，请先考虑：

- 是否存在除 `codex-core` 之外的、更适合存放新代码的现有 Crate。
- 是否应当为该新功能在 Cargo 工作区中引入一个新的 Crate。根据需要重构现有代码以实现这一点。

同样，在审查代码时，不要犹豫去否决那些会不必要地增加 `codex-core` 体积的 PR。

## TUI 样式约定

参见 `codex-rs/tui/styles.md`。

## TUI 代码约定

- 使用来自 ratatui 的 `Stylize` Trait 的简洁样式辅助方法。
  - 基础 Span：使用 `"text".into()`
  - 样式 Span：使用 `"text".red()`、`"text".green()`、`"text".magenta()`、`"text".dim()` 等。
  - 相比于直接使用 `Span::styled` 和 `Style` 构造样式，更推荐这些方法。
  - 示例：补丁摘要文件行
    - 期望效果：`vec!["  └ ".into(), "M".red(), " ".dim(), "tui/src/app.rs".dim()]`

### TUI 样式设计 (ratatui)

- 优先使用 Stylize 辅助方法：在可能的情况下，使用 `"text".dim()`、`.bold()`、`.cyan()`、`.italic()`、`.underlined()`，而不是手动使用 `Style`。
- 优先选择简单的转换方式：对于 Span 使用 `"text".into()`，对于 Line 使用 `vec![…].into()`；当类型推导不明确时（例如 `Paragraph::new`/`Cell::from`），使用 `Line::from(spans)` 或 `Span::from(text)`。
- 计算得到的样式：如果 Style 是在运行时计算出来的，可以使用 `Span::styled`（也可以接受 `Span::from(text).set_style(style)`）。
- 避免硬编码白色：不要使用 `.white()`；优先使用默认的前景色（不设颜色）。
- 链式调用：为了可读性，可以通过链式调用来组合辅助方法（例如 `url.cyan().underlined()`）。
- 单个项：优先使用 `"text".into()`；只有在上下文的 Target类型不明显，或者使用 `.into()` 会要求额外的类型注解时，才使用 `Line::from(text)` 或 `Span::from(text)`。
- 组装行：当目标类型显而易见且不需要额外的类型注解时，使用 `vec![…].into()` 来构造 Line；否则使用 `Line::from(vec![…])`。
- 避免无谓的改动：如果两种等效写法之间（`Span::styled` ↔ `set_style`，`Line::from` ↔ `.into()`）没有明显的可读性或功能性提升，请不要来回重构；遵循文件局部的编码约定，不要为了迎合 `.into()` 而特意引入类型注解。
- 紧凑性：优先选择在运行 `rustfmt` 后仍能保持在单行的写法；如果 `Line::from(vec![…])` 和 `vec![…].into()` 中只有一种可以避免换行，请选择该种写法。如果两者都会换行，选择换行数较少的那一种。

### 文本折行 (Text wrapping)

- 始终使用 `textwrap::wrap` 来折行纯字符串。
- 如果需要对 ratatui 的 `Line` 进行折行，请使用 `tui/src/wrapping.rs` 中的辅助函数，例如 `word_wrap_lines` / `word_wrap_line`。
- If you need to indent wrapped lines, use the initial_indent / subsequent_indent options from RtOptions if you can, rather than writing custom logic.
- If you have a list of lines and you need to prefix them all with some prefix (optionally different on the first vs subsequent lines), use the `prefix_lines` helper from line_utils.

## 测试

### 快照测试 (Snapshot tests)

此仓库（特别是在 `codex-rs/tui` 中）使用快照测试（通过 `insta`）来验证渲染的输出。

**要求：** 任何影响用户可见 UI 的变更（包括添加新 UI）必须包含相应的 `insta` 快照覆盖（如果尚不存在，则添加新的快照测试；或者更新现有的快照）。在 PR 中审查并接受快照更新，以便 UI 影响易于审查，并让未来的 Diff 保持可视化。

当 UI 或文本输出发生有意变更时，请按如下步骤更新快照：

- 运行测试以生成所有更新后的快照：
  - `cargo test -p codex-tui`
- 检查处于挂起状态的快照：
  - `cargo insta pending-snapshots -p codex-tui`
- 直接在仓库中阅读生成的 `*.snap.new` 文件来审查变更，或预览特定文件：
  - `cargo insta show -p codex-tui path/to/file.snap.new`
- **仅当**您打算接受该 Crate 中的所有新快照时，才运行：
  - `cargo insta accept -p codex-tui`

如果您未安装该工具：

- `cargo install --locked cargo-insta`

### 测试断言 (Test assertions)

- 测试应当使用 `pretty_assertions::assert_eq` 来获得更清晰的 Diff 对比。如果在测试模块顶部尚未导入，请进行导入。
- 尽可能优先使用深度相等比较（deep equals）。对整个对象执行 `assert_eq!()`，而不是逐个对比字段。
- 避免在测试中修改进程的环境变量；优先传递自上方派生的环境标志或依赖项。

### 在测试中生成工作区二进制文件 (Cargo 与 Bazel 对比)

- 当测试需要生成第一方二进制文件时，相比于 `assert_cmd::Command::cargo_bin(...)` 或 `escargot`，更推荐使用 `codex_utils_cargo_bin::cargo_bin("...")`。
  - 在 Bazel 下，二进制文件和资源可能存放在 runfiles 路径下；使用 `codex_utils_cargo_bin::cargo_bin` 可以解析在 `chdir` 后仍保持稳定的绝对路径。
- 在 Bazel 下定位 Fixture（测试固件）文件或测试资源时，避免使用 `env!("CARGO_MANIFEST_DIR")`。推荐使用 `codex_utils_cargo_bin::find_resource!`，以便路径在 Cargo 和 Bazel 的 runfiles 下都能正确解析。

### 集成测试 (核心)

- 在编写端到端的 Codex 测试时，推荐使用 `core_test_support::responses` 中的实用工具。

- 所有 `mount_sse*` 辅助函数都会返回一个 `ResponseMock`；请保留它，以便对发送给 `/responses` 的 POST 请求体进行断言。
- 当测试只应发出一次 POST 请求时，使用 `ResponseMock::single_request()`；或者使用 `ResponseMock::requests()` 审查捕获到的每一个 `ResponsesRequest`。
- `ResponsesRequest` 提供了许多辅助函数（`body_json`、`input`、`function_call_output`、`custom_tool_call_output`、`call_output`、`header`、`path`、`query_param`），以便断言可以针对结构化的 Payload，而不是手动翻找 JSON。
- 使用提供的 `ev_*` 构造器和 `sse(...)` 来构建 SSE 载荷。
- 相比于 `wait_for_event_with_timeout`，更推荐 `wait_for_event`。
- 相比于 `mount_sse_once_match` 或 `mount_sse_sequence`，更推荐 `mount_sse_once`。

- 典型模式：

  ```rust
  let mock = responses::mount_sse_once(&server, responses::sse(vec![
      responses::ev_response_created("resp-1"),
      responses::ev_function_call(call_id, "shell", &serde_json::to_string(&args)?),
      responses::ev_completed("resp-1"),
  ])).await;

  codex.submit(Op::UserTurn { ... }).await?;

  // 如有需要，断言请求体
  let request = mock.single_request();
  // 使用 request.function_call_output(call_id) 或 request.json_body() 或其他辅助函数进行断言。
  ```

## 应用服务器 API 开发最佳实践

这些指南适用于 `codex-rs` 中的应用服务器（app-server）协议工作，尤其是：

- `app-server-protocol/src/protocol/common.rs`
- `app-server-protocol/src/protocol/v2.rs`
- `app-server/README.md`

### 核心规则

- 所有活跃的 API 开发都应当在 app-server v2 中进行。不要向 v1 添加新的 API 表面积。
- 一致地遵循 Payload 命名：
  请求 Payload 使用 `*Params`，响应使用 `*Response`，通知使用 `*Notification`。
- 将 RPC 方法暴露为 `<资源>/<方法>` 并保持 `<资源>` 为单数形式（例如 `thread/read`、`app/list`）。
- 在网络传输上始终通过 `#[serde(rename_all = "camelCase")]` 将字段公开为 camelCase（驼峰命名法），除非标记联合（tagged union）或显式的兼容性要求需要特定的重命名。
- 例外：配置 RPC 的 Payload 预期使用 snake_case（蛇形命名法）以镜像 `config.toml` 中的 Key（参见 `app-server-protocol/src/protocol/v2.rs` 中的配置读/写/列表 API）。
- 始终在 v2 请求/响应/通知类型上设置 `#[ts(export_to = "v2/")]`，以便生成的 TypeScript 文件落入正确的命名空间中。
- 绝不要在 v2 API Payload 字段上使用 `#[serde(skip_serializing_if = "Option::is_none")]`。
  例外：有意不需要参数的客户端->服务器请求可以使用：
  `params: #[ts(type = "undefined")] #[serde(skip_serializing_if = "Option::is_none")] Option<()>`。
- 保持 Rust 和 TS 的网络传输重命名对齐。如果字段或变体使用了 `#[serde(rename = "...")]`，请添加匹配的 `#[ts(rename = "...")]`。
- 对于可辨识联合（discriminated unions），在两个序列化器中都要使用显式标记：
  `#[serde(tag = "type", ...)]` 以及 `#[ts(tag = "type", ...)]`。
- 在 API 边界上推荐使用纯 `String` 类型的 ID（如需，在内部进行 UUID 解析/转换）。
- 时间戳应当是整数 Unix 秒数 (`i64`) 并命名为 `*_at`（例如 `created_at`、`updated_at`、`resets_at`）。
- 对于实验性 API 表面积：
  使用 `#[experimental("method/or/field")]`，在需要字段级门控时派生 `ExperimentalApi`，且仅在方法的某些字段是实验性时在 `common.rs` 中使用 `inspect_params: true`。

### 客户端->服务器请求 Payload (`*Params`)

- 每一个可选字段都必须使用 `#[ts(optional = nullable)]` 进行注解。不要在客户端->服务器请求 Payload (`*Params`) 之外使用 `#[ts(optional = nullable)]`。
- 可选的集合字段（例如 `Vec`、`HashMap`）必须使用 `Option<...>` + `#[ts(optional = nullable)]`。不要使用 `#[serde(default)]` 来为可选集合建模，也不要在 v2 Payload 字段上使用 `skip_serializing_if`。
- 当您希望省略表示布尔字段为 `false` 时，使用 `#[serde(default, skip_serializing_if = "std::ops::Not::not")] pub 字段: bool` 代替 `Option<bool>`。
- 对于新的列表（list）方法，默认实现 Cursor 分页：
  请求字段为 `pub cursor: Option<String>` 和 `pub limit: Option<u32>`，
  响应字段为 `pub data: Vec<...>` 和 `pub next_cursor: Option<String>`。

### 开发工作流

- 当 API 行为发生变更时更新 app-server 文档/示例（至少更新 `app-server/README.md`）。
- 当 API 形状变更时重新生成 Schema 固件（Fixtures）：
  `just write-app-server-schema`
  （且在影响到实验性 API 固件时，运行 `just write-app-server-schema --experimental`）。
- 使用 `cargo test -p codex-app-server-protocol` 进行验证。
- 避免仅为了断言 `common.rs` 中单个请求字段的实验性字段标记而编写样板测试；依赖 Schema 生成/测试和行为覆盖率。
