# 语音访谈移动端原型 — 项目文档

## 一、项目概览

| 项目属性 | 内容 |
|---|---|
| **项目名称** | voice-interview-mobile-browser |
| **项目类型** | 移动端 Web 原型（单页应用） |
| **技术栈** | React 18 + Vite + Motion + Supabase |
| **动画库** | Motion (Framer Motion v12) |
| **目标平台** | 移动浏览器（Android/iOS Safari） |
| **核心功能** | 语音录制访谈问卷：管理员设计问卷 → 参与者语音答题 → 结果收集展示 |

---

## 二、技术架构

```
┌─────────────────────────────────────────────────┐
│                    浏览器 (SPA)                  │
│                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────┐  │
│  │   Builder   │  │ Participant │  │ Results  │  │
│  │   问卷编辑   │  │   语音答题   │  │  结果查看 │  │
│  └──────┬──────┘  └──────┬──────┘  └────┬─────┘  │
│         │                │              │       │
│         └────────────────┼──────────────┘       │
│                          │                       │
│                   localStorage                   │
│                   Supabase                       │
└─────────────────────────────────────────────────┘
```

### 依赖分析

| 依赖包 | 版本 | 用途 |
|---|---|---|
| `react` | ^18.3.1 | UI 框架 |
| `react-dom` | ^18.3.1 | React DOM 渲染 |
| `@supabase/supabase-js` | ^2.101.1 | 云端数据库 & 实时存储 |
| `motion` | ^12.38.0 | 动画库（Apple 风格微动效） |
| `vite` | ^8.0.0 | 构建工具（开发服务器 + 生产打包） |

> **注意**：Vite 内置 JSX 转换，无需额外安装 `@vitejs/plugin-react`。

---

## 三、目录结构

```
voice-interview-site/
├── index.html              # HTML 入口（含移动端视口 & iOS 安全区域 & SVG 图标）
├── package.json            # 项目配置 & 依赖声明
├── package-lock.json       # 依赖版本锁定（自动生成）
└── src/
    ├── main.jsx            # React 应用启动入口
    ├── App.jsx             # 核心业务逻辑 + UI 组件
    ├── AnimatedSection.jsx # Motion 动画组件库
    ├── supabase.js         # Supabase 客户端初始化
    └── styles.css          # 全局样式（Apple 风格设计系统）
```

### 文件规模一览

| 文件 | 行数 | 说明 |
|---|---|---|
| `src/App.jsx` | ~950 行 | 核心组件 + UI 组件 |
| `src/styles.css` | ~450 行 | Apple 风格设计系统 |
| `src/AnimatedSection.jsx` | ~120 行 | Motion 动画组件库 |
| `src/supabase.js` | ~5 行 | 仅初始化客户端 |
| `src/main.jsx` | ~7 行 | 仅启动应用 |

---

## 四、核心组件解析

### 4.1 顶层常量和工具函数

| 函数/常量 | 作用 | 备注 |
|---|---|---|
| `uid()` | 生成 8 位随机十六进制 ID | 用于唯一标识每条提交记录 |
| `defaultSurvey` | 默认访谈配置对象 | 内置 2 页演示问卷（热身 + 正式问题） |
| `getStored(key, fallback)` | 从 localStorage 读取 JSON | 读取失败时返回默认值 |
| `usePersistentState(key, initialValue)` | 自定义 Hook，state ↔ localStorage 同步 | 实现数据持久化 |
| `formatSeconds(value)` | 秒数 → `M:SS` 格式 | 用于录音时长显示 |
| `blobToBase64(blob)` | 将音频 Blob 转为 Base64 data URL | 用于存储和传输录音 |
| `downloadJson(filename, data)` | 触发浏览器下载 JSON 文件 | 用于导出访谈数据 |

### 4.2 `SectionCard` 组件

通用卡片容器，统一页面区块样式。

**Props：**

| Prop | 类型 | 说明 |
|---|---|---|
| `title` | string | 卡片标题 |
| `subtitle` | string | 卡片副标题（可选） |
| `children` | ReactNode | 卡片内容 |
| `compact` | boolean | 是否紧凑模式 |

### 4.3 `Field` 组件

表单字段包装器，将 Label + 输入控件组合为一个可复用单元。

### 4.4 `VoiceRecorder` 组件 — 核心录音组件

这是功能最复杂的组件，负责语音录制和预览。

**状态：**

| 状态名 | 类型 | 说明 |
|---|---|---|
| `permissionError` | boolean | 麦克风权限被拒绝 |
| `isRecording` | boolean | 是否正在录音 |
| `elapsed` | number | 已录音秒数 |
| `audioUrl` | string | 录音预览的 Object URL |
| `audioBlob` | Blob | 录音原始 Blob 数据 |

**技术实现：**

- 使用 `navigator.mediaDevices.getUserMedia` 获取麦克风流
- 录音格式优先级：`audio/mp4`（iPhone Safari 支持） > `audio/webm`
- 通过 `MediaRecorder` 的 `ondataavailable` 事件收集 Blob 数据
- `setInterval` 每秒更新计时器
- 达到 `maxSeconds` 时自动停止录音
- 录音结束后将 Blob 转为 Base64 data URL 通过 `onSaved` 回调返回

**Props：**

| Prop | 类型 | 说明 |
|---|---|---|
| `question` | string | 当前问题文本 |
| `hint` | string | 录音提示语 |
| `maxSeconds` | number | 最长录音秒数 |
| `onSaved(base64)` | function | 录音保存完成回调 |

### 4.5 `Builder` 组件 — 问卷编辑模式

管理员设计访谈问卷的界面。

**功能模块：**

1. **基础设置**：编辑标题、描述、欢迎语、结束语、是否要求填写姓名
2. **页面管理**：新增 / 删除 / 复制页面，切换当前编辑页面
3. **问题编辑**：编辑每个问题的内容、辅助说明、最短/最长秒数、是否允许跳过
4. **数据统计**：显示 localStorage 中已保存的提交数量

### 4.6 `Participant` 组件 — 答题模式

普通用户参与访谈的完整流程界面。

**流程：**

```
欢迎页 → 输入姓名（如果需要）→ 逐题语音答题 → 提交 → 结束页
```

**关键逻辑：**

- 按顺序展示每道题，调用 `VoiceRecorder` 录音
- 每题录音保存后自动进入下一题
- 全部答完后，同时写入 Supabase（远程）和 localStorage（本地）
- 结束页显示提交成功，提供「查看结果」和「重新开始」选项

### 4.7 `Results` 组件 — 结果查看模式

展示所有提交的访谈结果。

- 从 Supabase 的 `submissions` 表读取数据
- 左侧列表展示所有提交记录（按时间倒序）
- 右侧详情面板展示：参与者姓名、访谈标题、提交时间、每题录音播放器
- 支持在线播放所有录音

### 4.8 根 `App` 组件

路由判断逻辑：

| URL 参数 | 渲染模式 | 说明 |
|---|---|---|
| `?admin` | `Builder` + `Results`（Tab 切换） | 管理端（设计问卷 + 查看结果） |
| 无参数 | `Participant` | 普通用户端（只能答题） |

```jsx
// 模式判断
const params = new URLSearchParams(window.location.search);
const isAdmin = params.has('admin');
const initialTab = params.get('tab'); // 'editor' | 'results'
```

---

## 五、数据管理

### 5.1 localStorage

| Key | 内容 | 说明 |
|---|---|---|
| `voice-mobile-survey` | 访谈问卷结构（JSON） | 由 Builder 编辑，Participant 读取 |
| `voice-mobile-submissions` | 本地提交记录（JSON 数组） | 每条记录包含音频 Base64 数据 |

### 5.2 Supabase 数据库

需要手动在 Supabase 中创建 `submissions` 表：

| 字段名 | 类型 | 说明 |
|---|---|---|
| `id` | uuid | 主键（自动生成） |
| `participant_name` | text | 参与者姓名 |
| `survey_title` | text | 访谈标题 |
| `answers` | jsonb | 每道题的文本回答 |
| `audio_files` | jsonb | 每道题的 Base64 音频数据 |
| `submitted_at` | timestamp | 提交时间（自动填充） |

### 5.3 环境变量

项目根目录需要创建 `.env` 文件：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> Supabase 匿名 Key 具有浏览器的可访问权限（RLS 规则需额外配置以允许匿名写入 `submissions` 表）。

---

## 六、样式系统

### 6.1 Apple 风格设计变量（CSS Variables）

```css
/* 色彩系统 - 克制优雅 */
--bg: #ffffff;           /* 页面背景：纯白 */
--surface: #fafafa;       /* 卡片内背景 */
--card: #ffffff;          /* 卡片背景 */
--text: #000000;          /* 主文字：纯黑 */
--text-secondary: #86868b; /* 次要文字 */
--text-tertiary: #a1a1a6; /* 辅助文字 */
--border: #d2d2d7;        /* 边框 */
--border-light: #e5e5ea;  /* 浅色边框 */
--primary: #0071e3;       /* Apple 蓝 */
--primary-hover: #0077ed; /* 主色悬停 */
--secondary: #f5f5f7;     /* 次级背景 */
--danger: #ff3b30;        /* 危险/录音中 */
--success: #34c759;       /* 成功状态 */

/* 阴影 - 轻柔层次 */
--shadow-sm: 0 1px 3px rgba(0,0,0,0.04);
--shadow-card: 0 2px 12px rgba(0,0,0,0.04);
--shadow-elevated: 0 4px 20px rgba(0,0,0,0.06);

/* 圆角 - 适中克制 */
--radius-sm: 10px;
--radius-md: 14px;
--radius-lg: 20px;
--radius-xl: 28px;

/* 间距 - 大留白 */
--space-xs: 8px;
--space-sm: 12px;
--space-md: 20px;
--space-lg: 32px;
--space-xl: 48px;
```

### 6.2 跨平台字体适配

```css
font-family: -apple-system, "SF Pro Text", "PingFang SC",
             "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
```

覆盖了 macOS / iOS / Android / Windows 中文显示。

### 6.3 移动端优化

- **刘海屏适配**：`padding-top: env(safe-area-inset-top)`
- **Home Indicator 适配**：`padding-bottom: env(safe-area-inset-bottom)`
- **触控优化**：`min-height: 46px` 按钮触控区域，`active` 态 `transform: scale(.98)`
- **居中容器**：`max-width: 860px` 居中，避免大屏拉伸

### 6.2 圆角风格

| 元素 | 圆角值 |
|---|---|
| 小元素 | `10px` |
| 按钮/输入框 | `14px` |
| 卡片 | `20-28px` |
| 药丸标签 | `980px` |

### 6.3 移动端优化

- **刘海屏适配**：`padding-top: env(safe-area-inset-top)`
- **Home Indicator 适配**：`padding-bottom: env(safe-area-inset-bottom)`
- **触控优化**：`min-height: 46px` 按钮触控区域，Motion 按压反馈
- **居中容器**：`max-width: 980px` 居中，避免大屏拉伸
- **禁止缩放**：`user-scalable=no` 防止意外缩放

---

## 六、动画系统

### 6.4 Motion 动画原则

项目使用 Motion (Framer Motion v12) 实现 Apple 风格的克制微动效。

**动画哲学**：
- 短：动画时长 0.2-0.5 秒
- 轻：仅使用 opacity + translateY + scale
- 顺：使用 Apple 风格贝塞尔曲线 `[0.25, 0.1, 0.25, 1]`

### 6.5 核心动画组件

| 组件 | 用途 | 主要动画 |
|---|---|---|
| `AnimatedSection` | 通用入场动画 | 淡入 + 上浮 24px |
| `StaggerContainer` | 交错入场容器 | 子元素依次淡入 |
| `FadeIn` | 简单淡入 | opacity 0→1 |
| `ScaleIn` | 缩放入场 | scale 0.95→1 |
| `Pressable` | 按压反馈 | scale 0.98 |

### 6.6 动效示例

```jsx
// 入场上浮动画
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
>
  {children}
</motion.div>

// 页面切换动画
<AnimatePresence mode="wait">
  <motion.div
    key={pageId}
    initial={{ opacity: 0, x: 30 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -30 }}
    transition={{ duration: 0.35 }}
  />
</AnimatePresence>

// 按钮按压反馈
<motion.button whileTap={{ scale: 0.98 }}>
  点击我
</motion.button>
```

---

## 七、项目启动

### 开发环境

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服务器 → http://localhost:5173
```

### 生产构建

```bash
npm run build    # 构建生产产物到 dist/
npm run preview  # 本地预览构建产物
```

### 访问模式

| 访问地址 | 进入模式 |
|---|---|
| `http://localhost:5173` | 参与者答题模式 |
| `http://localhost:5173?admin` | 管理端（编辑 + 结果） |
| `http://localhost:5173?admin&tab=results` | 管理端（直接进入结果页） |

---

## 八、项目特点与不足

### 优点

1. **Apple 风格 UI**：极简设计、大留白、克制动效，参考 Apple/OpenAI 官网
2. **Motion 动画**：流畅的微动效体验，页面切换、卡片入场、按钮按压反馈
3. **移动优先**：完整适配 iOS 安全区域、触控优化、PWA 图标
4. **离线可用**：localStorage 提供本地持久化，不依赖网络
5. **演示数据内置**：开箱即用，无需配置即可预览完整流程

### 不足

1. **无构建配置**：`vite.config.js` 缺失，无自定义构建优化
2. **无测试**：`jest` / `vitest` / `testing-library` 均未配置
3. **无 ESLint/Prettier**：代码风格无工具约束
4. **无 TypeScript**：全部为 JavaScript，无类型检查
5. **无数据库迁移脚本**：Supabase 表需手动创建
6. **无权限管理**：管理端无需密码，任何人可通过 `?admin` 进入
7. **音频无压缩**：Base64 直接存储，空间占用大（建议后续接入 Web Audio API 压缩）

---

## 九、后续优化建议

| 优先级 | 优化项 | 说明 |
|---|---|---|
| 🔴 高 | 添加 Supabase RLS 规则 | 防止未授权用户读写数据 |
| 🔴 高 | 音频压缩 | Web Audio API 压缩录音，减少 Base64 体积 |
| 🔴 高 | 添加管理端密码验证 | 防止公开访问问卷设计器 |
| 🟡 中 | TypeScript 重构 | 提高代码健壮性和可维护性 |
| 🟡 中 | 添加单元测试 | Jest/Vitest + Testing Library |
| 🟡 中 | 添加 ESLint + Prettier | 统一代码风格 |
| 🟡 中 | Vite 构建优化 | 代码分割、CDN 配置、构建分析 |
| 🟢 低 | 多语言支持 | i18next 国际化 |
| 🟢 低 | 添加进度条组件 | 展示答题进度 |

---

## 十、更新日志

### v2.0.0 (2026-04-03) - UI 大改造

**视觉风格全面升级**：

| 改动项 | 旧版 | 新版 |
|---|---|---|
| 背景色 | `#f6f7fb` 淡灰蓝 | `#ffffff` 纯白 |
| 主色调 | `#111827` 深灰黑 | `#0071e3` Apple 蓝 |
| 卡片圆角 | `22px` | `20-28px` |
| 留白 | 较紧凑 | 大留白 (`32-48px`) |
| 边框 | 明显边框 | 轻柔边框 |

**动画系统**：

- 引入 Motion (Framer Motion v12) 动画库
- 新增 `AnimatedSection.jsx` 动画组件库
- 卡片入场：淡入 + 上浮 20-24px
- 页面切换：左右滑动淡入淡出
- 按钮按压：scale 0.98 反馈
- 列表项：交错入场动画
- 开关组件：平滑状态过渡

**新增功能**：

- 答题进度条（step / total）
- 录音状态脉冲动画
- 录音预览折叠动画
- Tab 切换平滑过渡
- 空状态友好提示

**移动端优化**：

- Header 毛玻璃背景 (`backdrop-filter: blur(20px)`)
- SVG 内联图标（无需加载外部资源）
- 禁止页面缩放 (`user-scalable=no`)
- Apple Touch Icon 支持

### v1.0.0 - 初始版本

- 基础问卷编辑功能
- 语音录制与预览
- Supabase 数据存储
- 响应式布局

