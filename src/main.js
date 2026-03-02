/**
 * Bob 豆包 TTS 插件
 * 使用火山引擎豆包语音合成大模型 V3 HTTP 单向流式接口
 *
 * API 文档：https://www.volcengine.com/docs/6561/1598757
 * 音色列表：https://www.volcengine.com/docs/6561/1257544
 */

var lang = require('./lang.js');

// V3 HTTP 单向流式接口地址
var API_URL = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';

// 错误码映射
var ERROR_CODES = {
    20000000: '合成成功',
    40402003: '文本长度超过限制',
    45000000: '音色鉴权失败，请检查音色是否已授权',
    55000000: '服务端错误，请稍后重试'
};

// 错误消息映射
var ERROR_MESSAGES = {
    'quota exceeded for types': '用量已用完，请开通正式版或充值',
    'concurrency': '并发超过限制，请稍后重试',
    'Init Engine Instance failed': 'voice_type 或 cluster 配置错误',
    'illegal input text': '无效文本（可能为空、纯标点或语种不匹配）',
    'load grant: requested grant not found': '鉴权失败，请检查 App ID 和 Access Key',
    'access denied': '音色未授权，请在控制台购买该音色'
};

/**
 * 生成 UUID v4
 */
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * 返回支持的语言列表
 * @returns {string[]} Bob 语言代码数组
 */
function supportLanguages() {
    return lang.supportLanguages.map(function (item) {
        return item[0];
    });
}

/**
 * 根据错误码和消息返回友好的中文提示
 * @param {number} code 错误码
 * @param {string} message 原始错误消息
 * @returns {string} 友好的中文提示
 */
function getFriendlyErrorMessage(code, message) {
    // 先检查错误码映射
    if (code && ERROR_CODES[code]) {
        return ERROR_CODES[code];
    }

    if (!message) return '未知错误 (code: ' + code + ')';

    // 再检查消息关键词映射
    var keys = Object.keys(ERROR_MESSAGES);
    for (var i = 0; i < keys.length; i++) {
        if (message.indexOf(keys[i]) !== -1) {
            return ERROR_MESSAGES[keys[i]];
        }
    }
    return message;
}

/**
 * 语音合成主函数
 * @param {Object} query - 包含 text 和 lang 属性
 * @param {Function} completion - 回调函数
 */
function tts(query, completion) {
    var text = query.text || '';

    // 1. 文本验证
    if (!text.trim()) {
        completion({
            error: {
                type: 'param',
                message: '合成文本不能为空'
            }
        });
        return;
    }

    // 文本长度保护（建议小于 300 字符，UTF-8 编码限制 1024 字节）
    if (text.length > 300) {
        $log.info('文本长度 ' + text.length + ' 字符，超过建议的 300 字符上限，可能影响合成质量');
    }

    // 2. 检查语言支持
    if (!lang.isSupported(query.lang)) {
        completion({
            error: {
                type: 'unsupportLanguage',
                message: '不支持的语言: ' + query.lang
            }
        });
        return;
    }

    // 3. 获取配置
    var appId = $option.appId;
    var accessKey = $option.accessKey;
    var resourceId = $option.resourceId || 'seed-tts-2.0';
    var voiceType = $option.voiceType || 'zh_female_vv_uranus_bigtts';
    var audioFormat = $option.audioFormat || 'mp3';
    var speechRate = parseInt($option.speechRate) || 0;

    // 4. 检查必要配置
    if (!appId) {
        completion({
            error: {
                type: 'secretKey',
                message: '请在插件配置中填入 App ID',
                troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
            }
        });
        return;
    }

    if (!accessKey) {
        completion({
            error: {
                type: 'secretKey',
                message: '请在插件配置中填入 Access Key',
                troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
            }
        });
        return;
    }

    // 语速范围校验
    if (speechRate < -50) speechRate = -50;
    if (speechRate > 100) speechRate = 100;

    // 5. 构建请求体
    var explicitLanguage = lang.getExplicitLanguage(query.lang);
    var requestBody = {
        user: {
            uid: 'bob-plugin-user'
        },
        req_params: {
            text: text,
            speaker: voiceType,
            audio_params: {
                format: audioFormat,
                sample_rate: 24000,
                speech_rate: speechRate
            },
            additions: JSON.stringify({
                explicit_language: explicitLanguage
            })
        }
    };

    // 6. 构建请求头
    var headers = {
        'X-Api-App-Id': appId,
        'X-Api-Access-Key': accessKey,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': generateUUID(),
        'Content-Type': 'application/json'
    };

    $log.info('豆包 TTS 请求: speaker=' + voiceType + ', resourceId=' + resourceId + ', format=' + audioFormat + ', language=' + explicitLanguage);

    // 7. 发送流式请求
    var audioData = null;
    var lastError = null;
    var lineBuffer = '';

    $http.streamRequest({
        method: 'POST',
        url: API_URL,
        header: headers,
        body: requestBody,
        timeout: pluginTimeoutInterval(),
        streamHandler: function (stream) {
            var text = stream.text || '';
            lineBuffer += text;

            // 按换行分割，处理完整的 JSON 行
            var lines = lineBuffer.split('\n');
            lineBuffer = lines.pop(); // 保留未完成的最后一行

            for (var i = 0; i < lines.length; i++) {
                processLine(lines[i]);
            }
        },
        handler: function (resp) {
            // 处理 lineBuffer 中残余数据
            if (lineBuffer.trim()) {
                processLine(lineBuffer);
                lineBuffer = '';
            }

            // 网络错误
            if (resp.error) {
                completion({
                    error: {
                        type: 'api',
                        message: '网络请求失败',
                        addition: resp.error.message || JSON.stringify(resp.error)
                    }
                });
                return;
            }

            // 检查 HTTP 状态码
            if (resp.response && resp.response.statusCode !== 200) {
                completion({
                    error: {
                        type: 'api',
                        message: 'HTTP 错误 ' + resp.response.statusCode,
                        addition: lastError ? JSON.stringify(lastError) : ''
                    }
                });
                return;
            }

            // 检查是否有 API 错误
            if (lastError) {
                var errorMsg = getFriendlyErrorMessage(lastError.code, lastError.message);
                completion({
                    error: {
                        type: 'api',
                        message: errorMsg,
                        addition: '错误码: ' + lastError.code + ', ' + (lastError.message || '')
                    }
                });
                return;
            }

            // 检查是否有音频数据
            if (!audioData || audioData.length === 0) {
                completion({
                    error: {
                        type: 'api',
                        message: '未获取到音频数据',
                        addition: '请检查 App ID、Access Key 和音色配置是否正确'
                    }
                });
                return;
            }

            // 返回合成结果
            $log.info('豆包 TTS 合成成功, 音频大小: ' + audioData.length + ' bytes');
            completion({
                result: {
                    type: 'base64',
                    value: audioData.toBase64(),
                    raw: {}
                }
            });
        }
    });

    /**
     * 处理一行 JSON 数据
     */
    function processLine(line) {
        line = line.trim();
        if (!line) return;

        try {
            var chunk = JSON.parse(line);

            // 正常音频数据
            if (chunk.code === 0 && chunk.data) {
                var chunkBinary = $data.fromBase64(chunk.data);
                if (!audioData) {
                    audioData = $data.fromData(chunkBinary);
                } else {
                    audioData.appendData(chunkBinary);
                }
            }
            // 合成结束
            else if (chunk.code === 20000000) {
                $log.info('豆包 TTS 合成完成');
            }
            // 错误响应
            else if (chunk.code && chunk.code !== 0 && chunk.code !== 20000000) {
                lastError = chunk;
                $log.error('豆包 TTS 错误: code=' + chunk.code + ', message=' + chunk.message);
            }
        } catch (e) {
            $log.info('解析响应行失败: ' + line.substring(0, 200));
        }
    }
}

/**
 * 自定义超时时间
 * @returns {number} 超时时间(秒)
 */
function pluginTimeoutInterval() {
    var timeout = parseInt($option.timeout);
    if (isNaN(timeout) || timeout < 30) {
        return 60;
    }
    if (timeout > 300) {
        return 300;
    }
    return timeout;
}

/**
 * 验证配置
 * @param {Function} completion - 回调函数
 */
function pluginValidate(completion) {
    var appId = $option.appId;
    var accessKey = $option.accessKey;

    if (!appId) {
        completion({
            result: false,
            error: {
                type: 'secretKey',
                message: '请填写 App ID',
                troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
            }
        });
        return;
    }

    if (!accessKey) {
        completion({
            result: false,
            error: {
                type: 'secretKey',
                message: '请填写 Access Key',
                troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
            }
        });
        return;
    }

    var resourceId = $option.resourceId || 'seed-tts-2.0';
    var voiceType = $option.voiceType || 'zh_female_vv_uranus_bigtts';

    var headers = {
        'X-Api-App-Id': appId,
        'X-Api-Access-Key': accessKey,
        'X-Api-Resource-Id': resourceId,
        'X-Api-Request-Id': generateUUID(),
        'Content-Type': 'application/json'
    };

    var requestBody = {
        user: {
            uid: 'bob-plugin-validate'
        },
        req_params: {
            text: '你好',
            speaker: voiceType,
            audio_params: {
                format: 'mp3',
                sample_rate: 24000
            }
        }
    };

    var hasAudio = false;
    var lastError = null;
    var lineBuffer = '';

    $http.streamRequest({
        method: 'POST',
        url: API_URL,
        header: headers,
        body: requestBody,
        timeout: 30,
        streamHandler: function (stream) {
            var text = stream.text || '';
            lineBuffer += text;

            var lines = lineBuffer.split('\n');
            lineBuffer = lines.pop();

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (!line) continue;
                try {
                    var chunk = JSON.parse(line);
                    if (chunk.code === 0 && chunk.data) {
                        hasAudio = true;
                    } else if (chunk.code && chunk.code !== 0 && chunk.code !== 20000000) {
                        lastError = chunk;
                    }
                } catch (e) {
                    // skip
                }
            }
        },
        handler: function (resp) {
            // 处理残余数据
            if (lineBuffer.trim()) {
                try {
                    var chunk = JSON.parse(lineBuffer.trim());
                    if (chunk.code === 0 && chunk.data) {
                        hasAudio = true;
                    } else if (chunk.code && chunk.code !== 0 && chunk.code !== 20000000) {
                        lastError = chunk;
                    }
                } catch (e) {
                    // skip
                }
            }

            if (resp.error) {
                var statusCode = resp.response ? resp.response.statusCode : 0;
                completion({
                    result: false,
                    error: {
                        type: 'api',
                        message: '验证失败 - HTTP ' + statusCode,
                        troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
                    }
                });
                return;
            }

            if (lastError) {
                var errorMsg = getFriendlyErrorMessage(lastError.code, lastError.message);
                completion({
                    result: false,
                    error: {
                        type: 'api',
                        message: '验证失败: ' + errorMsg,
                        troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
                    }
                });
                return;
            }

            if (hasAudio) {
                completion({ result: true });
            } else {
                completion({
                    result: false,
                    error: {
                        type: 'api',
                        message: '验证失败: 未收到音频数据',
                        troubleshootingLink: 'https://www.volcengine.com/docs/6561/196768'
                    }
                });
            }
        }
    });
}

exports.supportLanguages = supportLanguages;
exports.tts = tts;
exports.pluginTimeoutInterval = pluginTimeoutInterval;
exports.pluginValidate = pluginValidate;
