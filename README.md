# Edge Browser Page Content Reader Extension

一个Edge浏览器扩展，可以读取当前页面的内容。

## 功能特性

- 读取页面标题和URL
- 提取页面元标签（meta tags）
- 获取页面中的所有链接
- 获取页面中的所有图片
- 显示页面文本内容预览

## 文件结构

```
/data/ie_plugin/
├── manifest.json      # 扩展配置文件
├── content.js         # 内容脚本，读取页面内容
├── popup.html         # 弹出界面
├── popup.js           # 弹出界面脚本
├── icon16.png         # 16x16 图标（需要添加）
├── icon48.png         # 48x48 图标（需要添加）
└── icon128.png        # 128x128 图标（需要添加）
```

## 安装步骤

### 1. 添加图标文件

在安装之前，您需要添加图标文件。您可以使用以下任一方法：

**方法A：使用在线工具创建图标**
- 访问 https://www.favicon-generator.org/ 或类似的图标生成网站
- 创建一个简单的图标
- 下载并重命名为 `icon16.png`、`icon48.png`、`icon128.png`
- 将这些文件放在 `/data/ie_plugin/` 目录下

**方法B：使用现有图标**
- 如果您有现成的图标，将其复制到项目目录并重命名

**方法C：临时移除图标引用**
- 如果只是测试，可以编辑 `manifest.json`，删除 `icons` 和 `action.default_icon` 部分

### 2. 在Edge浏览器中加载扩展

1. 打开Edge浏览器
2. 在地址栏输入：`edge://extensions/`
3. 打开右上角的"开发人员模式"开关
4. 点击"加载已解压的扩展"
5. 选择 `/data/ie_plugin/` 目录
6. 扩展将加载到浏览器中

## 使用方法

1. 打开任意网页
2. 点击浏览器工具栏中的扩展图标（Page Content Reader）
3. 在弹出窗口中点击"Read Page Content"按钮
4. 页面内容将显示在弹出窗口中

## 功能说明

扩展可以读取以下信息：

- **基本信息**：页面标题和URL
- **Meta标签**：页面的元数据（如description、keywords等）
- **链接**：页面中的所有超链接
- **图片**：页面中的所有图片及其alt文本
- **文本内容**：页面的主要文本内容（显示前500个字符）

## 开发说明

### manifest.json
- 使用Manifest V3规范
- 权限：activeTab、scripting
- 内容脚本：在所有URL上运行

### content.js
- 在页面加载时注入
- 监听来自popup的消息
- 提取页面内容并发送回popup

### popup.js
- 处理用户点击事件
- 与content脚本通信
- 显示页面内容

## 注意事项

- 扩展需要刷新页面后才能正常工作
- 某些网站可能会阻止内容脚本运行
- 对于复杂的单页应用（SPA），可能需要手动刷新页面

## 故障排除

**问题：点击按钮后显示错误**
- 解决方案：刷新当前页面，然后再次尝试

**问题：扩展图标不显示**
- 解决方案：确保已添加icon16.png、icon48.png、icon128.png文件

**问题：无法读取某些页面内容**
- 解决方案：某些网站可能有安全限制，这是正常行为

## 许可证

MIT License