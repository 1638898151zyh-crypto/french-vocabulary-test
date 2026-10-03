# 聊天内交互卡片

两个 skill 共用内置 scripts/inline_card.py，分别调用各自的 scripts/render_test.py --inline。保留原分组、标题、判定和记录规则，不把两个入口合并成同一种检测。

## 选择呈现方式

1. 当前会话确实提供适配当前范围、模式和进度的 MCP App 打开工具时，调用该工具。仅认实际暴露的工具，不编造名字。open_vocabulary_test 只适用于通用 U1 P1＋P2，不能替代课本单Part入口。open_textbook_vocabulary_test 打开全书24个Part的课本界面，由界面恢复当前客户端主进度；不是模型已读取云端主进度。
2. 缺少该打开工具或工具不支持请求范围时，先检查当前宿主的真实HTML可视化能力。在具备 visualize 的 ChatGPT Work/Codex 宿主，默认范围先直接读取内置HTML；其他范围或可信记录需要适配时，再执行下列生成命令。在**本轮最终回复**输出渲染引用。visualize 可能是内容渲染协议而非可调用工具，不能仅因工具列表中没有同名工具就认定不可渲染。可用时读取宿主 visualize 技能，遵循当前协议。
3. 本插件通过根目录 mcp.json 连接既有服务。若首次使用更新后的连接，按宿主提供的连接界面授权；连接确认后重新发现真实工具，必要时新建会话再验证。后续渲染重试不创建应用或插件，不重解析PDF。不要用静态Markdown按钮、Unicode方框、图片、HTML代码块或单纯文件链接冒充可点击卡片。
4. 宿主确实没有交互HTML呈现能力时，说明这一具体限制并提供独立可运行预览；不宣称skill能强制给宿主添加不存在的能力。插件包的 Interactive 描述与生成脚本本身不会注册MCP工具。

## 直接使用内置HTML

两个入口各自内置 assets/interactive-card.html：通用入口为默认U1 P1＋P2的5×10检测；课本入口含全书词库与主进度逻辑，可从U1 P1沿24个Part推进。它们是包含完整数据、样式和事件处理的HTML片段，不需要网络、CDN或现场运行生成脚本。

宿主支持visualize且检测范围/可信进度与默认卡片适配时，直接复制对应文件到本轮新的 /workspace/*.html 路径并呈现；当前浏览器记录由面板按原键恢复。其他范围、替换词库或更近的主进度导出仍使用下方生成命令。不要改写内置HTML里的用户学习记录，也不要把打包时的初始状态说成已读取的用户进度。

## 生成和呈现

路径均相对对应 skill 目录。通用入口：

    python scripts/render_test.py --inline --output /workspace/french-vocabulary-card.html
    python scripts/render_test.py --inline --unit 2 --output /workspace/french-vocabulary-u2-card.html

课本入口：

    python scripts/render_test.py --inline --output /workspace/textbook-vocabulary-card.html
    python scripts/render_test.py --inline --state edito-b1-main-progress.json --output /workspace/textbook-vocabulary-card.html

确认课本过关时仍使用课本skill规定的 --state、--pass、--request-id 参数。重试展示不创建新一轮、不重复推进Part、不改写真实用户记录。浏览器已有记录时由原界面恢复；模型不能直接读取它并声称是云端记录。

--inline 输出自包含HTML片段，包含数据、交互和根节点作用域，不含文档外壳，不调用网络API。默认 U1 通用入口保持原浏览器记录键；课本保持独立主进度键。其他单元或更换词库使用独立范围键，防止覆盖U1历史。CSS和脚本作用域隔离，兼容当前宿主明暗外观。

ChatGPT Work/Codex 当前渲染协议示例（实际路径必须是本轮已生成的绝对路径）：

    visualize{"path":"/workspace/textbook-vocabulary-card.html"}

把引用独立放在最终回复的一行；不要输出HTML源码，不添加下载链接。文件尚未生成、路径不可读或脚本校验失败时先修复，不能发一个不存在的引用。内联卡片属于回复内容，无需作为交付文件另外保存；用户另行要求导出时才走宿主的文件保存流程。

## 验证与记录边界

- 检查词库ID、实际组数、末组数量、中文与音标隐藏、未翻开评分禁用、改选与防重复计数。
- 本地检查与真实聊天内显示分别报告；只有用户或宿主实测才能确认真实显示效果。
- 保留浏览器存储失败提示；不把浏览器进度说成跨设备云同步。不能用测试评分去更新真实学习记录。

## MCP 连接与桌面边界

根目录 mcp.json 使用原云端服务的真实 /mcp 地址和 Streamable HTTP。登录由既有服务与宿主管理，不在包内存储凭据。可用时优先调用实际打开工具，界面通过MCP UI资源关联渲染，不依赖Visualize。工具可发现不等于界面已显示；需要分别验证工具调用和客户端UI。客户端缺少MCP界面支持时，skill不能强制开启。

普通检测保留原云端记录。课本界面保留浏览器主进度及导入导出；不同渲染来源可能有独立存储，首次从Visualize迁移到MCP界面须导入原主进度，不能宣称自动跨设备同步。仅展示默认卡片不得推断用户尚未学习。用户指定较新的导出或当前范围时，继续按可信主进度生成适配卡片。
