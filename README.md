# Bob Plugin - 豆包 TTS

使用火山引擎豆包语音合成大模型为 [Bob](https://bobtranslate.com/) 提供语音合成服务。

## 功能特性

- 基于豆包语音合成大模型 V3 HTTP 单向流式接口
- 支持 TTS 1.0 / 2.0 模型
- 丰富的音色选择（通用、多情感、多语种、趣味口音、角色扮演）
- 支持语速调节
- 支持 MP3 / OGG Opus / PCM 多种音频格式

## 安装

### 前置要求

- Bob 版本 >= 1.8.0（需要流式请求支持）
- 火山引擎账号，已开通豆包语音合成服务

### 安装步骤

1. 下载最新的 `doubao-tts.bobplugin` 文件
2. 双击文件，Bob 会自动弹出安装确认
3. 在 Bob 插件设置中配置 App ID 和 Access Key

## 配置

在 Bob 的插件设置中需要填写以下信息：

| 配置项 | 说明 | 获取方式 |
|--------|------|----------|
| App ID | 应用标识 | [火山引擎控制台](https://console.volcengine.com/speech/service/10007) |
| Access Key | Access Token | [火山引擎控制台](https://console.volcengine.com/speech/service/10007) |
| 模型版本 | 资源 ID | 根据音色选择 1.0 或 2.0 |
| 音色 ID | 发音人标识 | [音色列表](https://www.volcengine.com/docs/6561/1257544) |
| 音频格式 | 编码格式 | 默认 MP3 |
| 语速 | -50 到 100 | 0 为默认速度 |

### 获取 App ID 和 Access Key

1. 登录 [火山引擎控制台](https://console.volcengine.com/)
2. 进入「豆包语音」服务
3. 参考 [控制台使用 FAQ](https://www.volcengine.com/docs/6561/196768) 获取 App ID 和 Access Token

### 音色选择

完整音色列表请参考：[豆包大模型音色列表](https://www.volcengine.com/docs/6561/1257544)

**注意**：不同模型版本支持不同的音色：
- `seed-tts-1.0`：适用于 1.0 音色（如 `zh_female_cancan_mars_bigtts`）
- `seed-tts-2.0`：适用于 2.0 音色（如 `zh_female_vv_uranus_bigtts`）

默认音色为 `zh_female_vv_uranus_bigtts`（TTS 2.0 女声）。

## 开发

### 项目结构

```
src/
├── info.json    # 插件元信息和配置项
├── main.js      # 核心 TTS 逻辑
└── lang.js      # 语言映射
```

### 打包

```bash
cd src && zip -r ../doubao-tts.bobplugin . -x ".*"
```

### 调试

在 Bob 的「偏好设置 → 高级 → 日志」中查看插件日志。

## 相关文档

- [Bob 插件开发文档](https://bobtranslate.com/plugin/)
- [豆包语音合成大模型 V3 HTTP 接口](https://www.volcengine.com/docs/6561/1598757)
- [豆包大模型音色列表](https://www.volcengine.com/docs/6561/1257544)
- [火山引擎控制台 FAQ](https://www.volcengine.com/docs/6561/196768)

## 许可证

MIT
