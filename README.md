# 笃行 · 本地优先的 AI 待办桌面应用

> 一个本地优先、可离线使用的桌面待办应用：用自然语言建任务、AI 自动分类 / 定优先级 / 排程推荐，并内置知识库问答、每日简报、目标路线图与 AI 记忆库。所有数据存在你本机，断网也能用。

「笃行」取「知行合一、踏实执行」之意——它不追求花哨，而是做一个你每天真的愿意打开用的效率工具。

<p align="center">
  <img src="assets/social-preview.png" alt="笃行 · 本地优先的 AI 待办桌面应用" width="100%">
</p>

---

## 功能特性

- **自然语言建任务**：一句话即可创建待办，自动识别标题、分类、优先级、截止时间、重复规则（如「每周一 9 点交周报」）。
- **智能分类与排程**：调用 LLM 做结构化解析；无 Key / 离线时自动降级到本地关键词规则，断网照样可用。
- **执行顺序推荐**：按「优先级 + 紧急度」加权排序，告诉你今天先做什么。
- **任务拆解**：把大任务一键拆成可执行的子步骤（subtask）。
- **每日简报**：统计逾期 / 今日截止 / 未来 7 天 / 已完成的维度，AI 写一段鼓励且可执行的中文摘要（可定时系统通知推送）。
- **知识库问答**：记录笔记，基于笔记内容向 AI 提问，回答附带来源出处，不编造。
- **目标路线图**：把长期目标拆成阶段 / 里程碑 / 任务，加权计算进度，阶段全完成自动收尾。
- **AI 记忆库**：创建任务 / 笔记时自动提炼要点（事实 / 偏好 / 项目 / 人物 / 规则），可选向量语义检索。
- **日历拖拽**：在月历上直接拖动改期。
- **四象限视图**：按「重要 / 紧急」自动归类。
- **完成庆祝**：勾掉任务时的轻量正反馈动画。
- **系统托盘 + 全局快捷键**：`Ctrl/Cmd + Shift + T` 随时唤起，关闭窗口最小化到托盘。
- **深浅主题**：右上角一键切换，记忆偏好。
- **数据导出**：任务导出 JSON / CSV（CSV 带 BOM 防 Excel 乱码）、全量备份与导入、笔记导出 Markdown。

---

## 技术栈

| 层 | 技术 |
| --- | --- |
| 框架 | Electron 31 + [electron-vite](https://github.com/alex8088/electron-vite)（主进程 / 预加载 / 渲染进程一体化构建） |
| 渲染 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS（CSS 变量驱动深浅主题） |
| 状态 | Zustand |
| 存储 | better-sqlite3（本地单文件数据库，离线优先） |
| 导出 | papaparse（CSV） |
| AI | OpenAI 兼容接口（默认 DeepSeek），结构化 JSON 解析；不填 Key 自动降级本地规则 |

---

## 目录结构

```
ai-todo-desktop/
├── assets/                     # 应用图标（icon.png / icon.ico，与侧边栏 logo 同源）
├── scripts/
│   ├── build-icon.cjs          # 用 resvg 渲染品牌 SVG → icon.png / icon.ico
│   ├── electron-stub.cjs       # 单元测试用的 electron 桩
│   └── smoke.ts                # DB 层冒烟测试
├── src/
│   ├── shared/types.ts         # 主/渲染进程共用的类型定义
│   ├── main/                   # 主进程
│   │   ├── index.ts            # 入口：窗口/托盘/快捷键/IPC 路由
│   │   ├── db/                 # SQLite 数据访问层（tasks/notes/goals/memories/settings/briefing）
│   │   └── services/           # AI / 导出 / 通知调度
│   ├── preload/index.ts        # contextBridge 暴露 window.api 白名单
│   └── renderer/               # React 渲染进程
│       ├── src/App.tsx         # 根组件，按 view 切换八大视图
│       ├── src/store/          # Zustand 全局状态
│       ├── src/components/     # 各视图与组件
│       └── src/styles/         # Tailwind 样式
├── electron.vite.config.ts     # electron-vite 构建配置
├── electron-builder.yml        # 打包配置（NSIS 安装包 + 便携版）
└── package.json
```

---

## 安装

要求 **Node.js 18+**（推荐 20+）与 **npm**。

```bash
git clone https://github.com/<your-username>/duxing.git
cd duxing
npm install
```

> **原生模块提示**：`better-sqlite3` 是原生模块。若 `npm install` 后运行报原生模块错误，执行一次
> ```bash
> npx electron-rebuild
> ```
> 重新编译即可。（打包时本项目已通过 `electron-builder.yml` 的 `npmRebuild: false` + 前置 `electron-rebuild -f` 处理。）

---

## 开发

```bash
npm run dev      # 启动 Electron 开发模式（渲染进程热更新）
```

应用窗口默认 1100×720，关闭窗口会最小化到系统托盘而非退出；双击托盘图标或 `Ctrl/Cmd + Shift + T` 唤起。

---

## 打包发布

```bash
npm run build    # 产出 out/ 与渲染产物
npm run dist     # electron-builder 打包（输出到 release/：NSIS 安装包 + 便携版 exe）
```

如需重新生成应用图标：

```bash
node scripts/build-icon.cjs
```

---

## 使用说明

1. **新建任务**：底部输入框直接输入「明天下午 3 点 交周报」并回车；或点「AI 解析」让其自动补全字段。
2. **统一智能输入**：在智能框里可以一句话同时「记笔记 / 建待办 / 提问」，应用自动分辨意图，也支持附带图片（多模态）。
3. **每日简报**：左侧「简报」查看今日概览；在设置里开启定时推送，每天 9 点收到系统通知。
4. **目标路线图**：左侧「目标」新建长期目标，点「AI 规划」自动拆阶段，勾掉阶段进度自动累加。
5. **AI 记忆库**：左侧「记忆」查看由任务/笔记自动提炼的要点，可手动增删与检索。
6. **数据导出**：设置页导出 JSON / CSV / 全量备份，也可把笔记导出为 Markdown。

---

## 接入你自己的 AI

设置页填写（不填则全程本地规则，无需联网）：

- **API Key**：如 DeepSeek 的 `sk-...`
- **Base URL**：OpenAI 兼容地址，默认 `https://api.deepseek.com/v1`
- **模型**：默认 `deepseek-chat`
- 勾选「仅本地模式」时完全不调用 AI，断网可用。

> 接口遵循 OpenAI 兼容协议，可替换为任意兼容服务（如本地 Ollama 的 `/v1`）。
> 语义检索（记忆库）需要模型支持 `/embeddings` 端点，未配置时自动降级为关键词检索。

---

## 数据与安全

- 所有数据（任务、笔记、目标、记忆、设置）以单文件 SQLite 存于系统用户数据目录（`app.getPath('userData')/ai-todo/`），**不上传任何服务器**。
- AI 调用仅在你填写 Key 后发生，且只把待解析文本发给你配置的 Base URL。
- 建议定期用「全量备份」导出 JSON 以防丢失。

---

## 贡献指南

欢迎 Issue 与 PR。开发流程：

1. Fork 本仓库并克隆到本地。
2. 安装依赖：`npm install`。
3. 新建分支：`git checkout -b feat/your-feature`。
4. 本地开发：`npm run dev`，提交前请确保：
   - `npm run build` 通过（类型检查 + 构建）；
   - 新增功能尽量补充必要的代码注释与类型定义（`src/shared/types.ts` 为共用契约）；
   - 若改动数据模型，注意 `src/main/db/index.ts` 中的幂等字段迁移。
5. 提交信息建议使用清晰的前缀：`feat:` / `fix:` / `docs:` / `refactor:` / `chore:`。
6. 推送分支并向 `main` 发起 Pull Request，描述清楚改动动机与验证方式。

代码风格：TypeScript 严格模式、React 函数组件 + Hooks、主/渲染进程严格隔离（渲染进程只能通过 `window.api` 访问主进程能力）。

---

## 许可证

本项目基于 [MIT License](./LICENSE) 开源。

---

## 路线图

- [ ] 习惯学习反馈（根据完成规律主动提醒）
- [ ] 云端同步 / 多端
- [ ] 快捷键自定义
- [ ] WebDAV / 第三方备份
