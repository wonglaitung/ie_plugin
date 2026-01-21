(function() {
    'use strict';

    // Global variables
    let pageContent = null;
    let chatHistory = [];

    // DOM Elements
    const readBtn = document.getElementById('readBtn');
    const resultDiv = document.getElementById('result');
    const tabs = document.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll('.tab-content');
    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const apiKeyInput = document.getElementById('apiKey');
    const apiUrlInput = document.getElementById('apiUrl');
    const modelNameInput = document.getElementById('modelName');
    const saveSettingsBtn = document.getElementById('saveSettings');
    const cancelSettingsBtn = document.getElementById('cancelSettings');

    // ==================== Tab Switching ====================
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;

            // Update tab styles
            tabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Update content visibility
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab + '-tab') {
                    content.classList.add('active');
                }
            });
        });
    });

    // ==================== Content Extraction Functions ====================
    function displayContent(content) {
        pageContent = content;
        let html = '';

        // Basic Info
        html += '<div class="section">';
        html += '<h2>📌 Basic Info</h2>';
        html += '<div class="info-row"><span class="info-label">Title:</span><span class="info-value">' + escapeHtml(content.title) + '</span></div>';
        html += '<div class="info-row"><span class="info-label">URL:</span><span class="info-value">' + escapeHtml(content.url) + '</span></div>';

        // Dynamic content loading status
        if (content.dynamicContentLoaded !== undefined) {
            const status = content.dynamicContentLoaded ? '✅ Dynamic content loaded' : '⚠️ Timeout waiting for dynamic content';
            const statusClass = content.dynamicContentLoaded ? 'success' : 'warning';
            html += '<div class="info-row"><span class="info-label">Status:</span><span class="info-value ' + statusClass + '">' + status + '</span></div>';

            // Add debug info
            html += '<div class="info-row"><span class="info-label">Load Reason:</span><span class="info-value">' + escapeHtml(content.loadReason || 'N/A') + '</span></div>';
            html += '<div class="info-row"><span class="info-label">Load Time:</span><span class="info-value">' + (content.loadTime || 0) + 'ms</span></div>';
            html += '<div class="info-row"><span class="info-label">Mutations:</span><span class="info-value">' + (content.mutationCount || 0) + '</span></div>';
        }

        html += '</div>';

        // Meta Tags
        if (content.metaTags && content.metaTags.length > 0) {
            html += '<div class="section">';
            html += '<h2>🏷️ Meta Tags</h2>';
            content.metaTags.slice(0, 5).forEach(meta => {
                const name = meta.name || meta.property || 'meta';
                html += '<div class="list-item"><strong>' + escapeHtml(name) + ':</strong> ' + escapeHtml(meta.content) + '</div>';
            });
            if (content.metaTags.length > 5) {
                html += '<div class="list-item">... and ' + (content.metaTags.length - 5) + ' more</div>';
            }
            html += '</div>';
        }

        // Links
        if (content.links && content.links.length > 0) {
            html += '<div class="section">';
            html += '<h2>🔗 Links (' + content.links.length + ')</h2>';
            content.links.slice(0, 5).forEach(link => {
                html += '<div class="list-item"><strong>' + escapeHtml(link.text) + '</strong><br>' + escapeHtml(link.href) + '</div>';
            });
            if (content.links.length > 5) {
                html += '<div class="list-item">... and ' + (content.links.length - 5) + ' more</div>';
            }
            html += '</div>';
        }

        // Images
        if (content.images && content.images.length > 0) {
            html += '<div class="section">';
            html += '<h2>🖼️ Images (' + content.images.length + ')</h2>';
            content.images.slice(0, 5).forEach(img => {
                html += '<div class="list-item"><strong>' + escapeHtml(img.alt) + '</strong><br>' + escapeHtml(img.src) + '</div>';
            });
            if (content.images.length > 5) {
                html += '<div class="list-item">... and ' + (content.images.length - 5) + ' more</div>';
            }
            html += '</div>';
        }

        // Body Text Preview
        if (content.bodyText) {
            html += '<div class="section">';
            html += '<h2>📝 Text Content Preview</h2>';
            const preview = content.bodyText.substring(0, 500);
            html += '<div class="info-row" style="white-space: pre-wrap;">' + escapeHtml(preview) + (content.bodyText.length > 500 ? '...' : '') + '</div>';
            html += '</div>';
        }

        resultDiv.innerHTML = html;

        // Update AI chat greeting
        updateAIGreeting();
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showError(message) {
        console.error('[Popup-DIAG] ❌ 显示错误信息:', message);
        resultDiv.innerHTML = '<div class="error">Error: ' + escapeHtml(message) + '</div>';
    }

    function showLoading() {
        resultDiv.innerHTML = '<div class="loading">⏳ Loading page content...<br><small>Waiting for dynamic content (up to 3 seconds)</small></div>';
    }

    function injectContentScript(tabId, callback) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                console.error('[Popup-DIAG] ❌ content.js 注入失败:', chrome.runtime.lastError.message);
                callback(false);
            } else {
                console.log('[Popup-DIAG] ✅ content.js 注入成功');
                callback(true);
            }
        });
    }

    function getPageContentWithFallback(tabId, retryCount = 0, waitTime = 3000) {
        console.log('[Popup-DIAG] ========== 开始获取页面内容 ==========');
        console.log('[Popup-DIAG] 📋 请求参数:', {
            '标签页 ID': tabId,
            '重试次数': retryCount,
            '等待时间': waitTime + 'ms'
        });

        chrome.tabs.sendMessage(tabId, {action: 'getPageContent', waitTime: waitTime}, function(response) {
            if (chrome.runtime.lastError) {
                console.error('[Popup-DIAG] ❌ Chrome 运行时错误:', chrome.runtime.lastError.message);
                console.error('[Popup-DIAG] ❌ 错误详情:', {
                    '重试次数': retryCount,
                    '是否重试': retryCount < 2
                });

                if (retryCount < 2) {
                    console.log('[Popup-DIAG] 🔄 尝试注入 content.js...');
                    injectContentScript(tabId, function(success) {
                        if (success) {
                            console.log('[Popup-DIAG] ✅ 注入成功，300ms 后重试...');
                            setTimeout(() => {
                                getPageContentWithFallback(tabId, retryCount + 1, waitTime);
                            }, 300);
                        } else {
                            console.error('[Popup-DIAG] ❌ 注入失败！');
                            console.error('[Popup-DIAG] ❌ 可能原因: 扩展权限不足或页面不支持脚本注入');
                            readBtn.disabled = false;
                            showError('Could not inject content script. Please check extension permissions.');
                        }
                    });
                } else {
                    console.error('[Popup-DIAG] ❌ 已达到最大重试次数，放弃');
                    console.error('[Popup-DIAG] ❌ 请尝试: 1. 刷新页面 2. 检查扩展权限 3. 查看网页控制台日志');
                    readBtn.disabled = false;
                    showError('Could not read page content. Please refresh the page and try again.');
                }
                return;
            }

            console.log('[Popup-DIAG] ✅ 收到 content script 响应');

            if (!response) {
                console.error('[Popup-DIAG] ❌ 响应为空！');
                readBtn.disabled = false;
                showError('No content received');
                return;
            }

            // Check if content was actually loaded
            if (!response.dynamicContentLoaded) {
                console.error('[Popup-DIAG] ❌ 动态内容加载失败！');
                console.error('[Popup-DIAG] ❌ 失败原因:', response.loadReason);
                console.error('[Popup-DIAG] ❌ 加载时间:', response.loadTime + 'ms');
                console.error('[Popup-DIAG] ❌ DOM 变异次数:', response.mutationCount);
            }

            // Check if body text is empty
            if (!response.bodyText || response.bodyText.length === 0) {
                console.error('[Popup-DIAG] ❌ 提取的文本内容为空！');
                console.error('[Popup-DIAG] ❌ 可能原因: 1. 内容在 Shadow DOM 中 2. 内容在 iframe 中 3. 页面使用特殊框架');
            } else {
                console.log('[Popup-DIAG] ✅ 提取文本长度:', response.bodyText.length, '字符');
            }

            readBtn.disabled = false;
            displayContent(response);
        });
    }

    readBtn.addEventListener('click', function() {
        console.log('[Popup-DIAG] ========== 用户点击读取按钮 ==========');
        readBtn.disabled = true;
        showLoading();

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                console.error('[Popup-DIAG] ❌ 未找到活动标签页');
                showError('No active tab found');
                readBtn.disabled = false;
                return;
            }

            const activeTab = tabs[0];
            console.log('[Popup-DIAG] 📋 活动标签页信息:', {
                'ID': activeTab.id,
                'URL': activeTab.url,
                '标题': activeTab.title,
                '状态': activeTab.status
            });

            if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
                console.error('[Popup-DIAG] ❌ 浏览器内部页面，不支持读取');
                readBtn.disabled = false;
                showError('Cannot read content from this page (browser internal page)');
                return;
            }

            getPageContentWithFallback(activeTab.id);
        });
    });

    // ==================== API Key Management ====================
    function saveApiKey(apiKey) {
        chrome.storage.local.set({qwenApiKey: apiKey}, function() {
            console.log('API Key saved');
        });
    }

    function loadApiKey(callback) {
        chrome.storage.local.get(['qwenApiKey'], function(result) {
            callback(result.qwenApiKey || '12345678');
        });
    }

    function saveApiUrl(apiUrl) {
        chrome.storage.local.set({qwenApiUrl: apiUrl}, function() {
            console.log('API URL saved');
        });
    }

    function loadApiUrl(callback) {
        chrome.storage.local.get(['qwenApiUrl'], function(result) {
            callback(result.qwenApiUrl || '');
        });
    }

    function saveModelName(modelName) {
        chrome.storage.local.set({qwenModelName: modelName}, function() {
            console.log('Model Name saved');
        });
    }

    function loadModelName(callback) {
        chrome.storage.local.get(['qwenModelName'], function(result) {
            callback(result.qwenModelName || '');
        });
    }

    settingsBtn.addEventListener('click', function() {
        loadApiKey(function(apiKey) {
            loadApiUrl(function(apiUrl) {
                loadModelName(function(modelName) {
                    apiKeyInput.value = apiKey;
                    apiUrlInput.value = apiUrl;
                    modelNameInput.value = modelName;
                    settingsModal.classList.add('active');
                });
            });
        });
    });

    cancelSettingsBtn.addEventListener('click', function() {
        settingsModal.classList.remove('active');
    });

    saveSettingsBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const apiUrl = apiUrlInput.value.trim();
        const modelName = modelNameInput.value.trim();
        saveApiKey(apiKey);
        saveApiUrl(apiUrl);
        saveModelName(modelName);
        settingsModal.classList.remove('active');
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            settingsModal.classList.remove('active');
        }
    });

    // ==================== AI Chat Functions ====================
    function updateAIGreeting() {
        if (pageContent) {
            const greeting = document.createElement('div');
            greeting.className = 'message ai';
            greeting.textContent = '✅ 页面内容已提取！现在你可以问我关于这个网页的任何问题了。';
            chatMessages.appendChild(greeting);
            scrollToBottom();
        }
    }

    function addMessage(content, type) {
        const message = document.createElement('div');
        message.className = 'message ' + type;
        message.textContent = content;
        chatMessages.appendChild(message);
        scrollToBottom();

        // Save to chat history (skip system messages and greetings)
        if (type === 'user' || type === 'ai') {
            chatHistory.push({
                role: type === 'user' ? 'user' : 'assistant',
                content: content
            });
        }
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.className = 'message ai';
        indicator.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
        indicator.id = 'typingIndicator';
        chatMessages.appendChild(indicator);
        scrollToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) {
            indicator.remove();
        }
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function buildPrompt(pageContent) {
        let contentText = '';

        // Build content summary
        if (pageContent.title) {
            contentText += `标题: ${pageContent.title}\n\n`;
        }
        if (pageContent.bodyText) {
            contentText += `正文内容:\n${pageContent.bodyText.substring(0, 3000)}\n`;
        }
        if (pageContent.links && pageContent.links.length > 0) {
            contentText += `\n链接 (${pageContent.links.length}个):\n`;
            pageContent.links.slice(0, 10).forEach(link => {
                contentText += `- ${link.text}: ${link.href}\n`;
            });
        }

        return {
            role: 'system',
            content: `【网页内容】\n${contentText}\n请基于以上网页内容回答用户的问题。`
        };
    }

    async function callQwenAPI(apiKey, messages, apiUrl, modelName) {
        try {
            const defaultUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            const defaultModel = 'qwen-plus-2025-07-28';
            const url = apiUrl || defaultUrl;
            const model = modelName || defaultModel;

            console.log('Calling API URL:', url);
            console.log('Using model:', model);
            console.log('Number of messages:', messages.length);
            console.log('Request payload:', {
                model: model,
                messages: messages.map(m => ({ role: m.role, content: m.content.substring(0, 100) + '...' })),
                max_tokens: 32768,
                temperature: 0.7,
                top_p: 0.8
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    max_tokens: 32768,
                    temperature: 0.7,
                    top_p: 0.8
                })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', Object.fromEntries(response.headers.entries()));

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    errorData = { message: response.statusText };
                }
                console.error('API Error Response:', errorData);

                // Provide more specific error messages
                if (response.status === 404) {
                    throw new Error(`API 端点不存在 (404)。请检查：\n1. API URL 是否正确：${url}\n2. 模型名称是否存在：${model}\n3. API 服务是否正常运行`);
                } else if (response.status === 401) {
                    throw new Error('API Key 无效或已过期。请检查 API Key 配置。');
                } else if (response.status === 429) {
                    throw new Error('API 请求频率超限。请稍后再试。');
                } else {
                    throw new Error(errorData.message || errorData.error || `API request failed with status ${response.status}`);
                }
            }

            const data = await response.json();
            console.log('API Response Data:', data);

            // Validate response structure
            if (!data) {
                throw new Error('API returned empty response');
            }

            if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
                console.error('Invalid response structure:', data);
                throw new Error('API returned invalid response format. Expected "choices" array.');
            }

            if (!data.choices[0].message || !data.choices[0].message.content) {
                console.error('Invalid message structure:', data.choices[0]);
                throw new Error('API returned invalid message format. Expected "message.content".');
            }

            return data.choices[0].message.content;
        } catch (error) {
            console.error('Qwen API Error:', error);
            throw error;
        }
    }

    async function sendMessage() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        // Check if API key is configured
        loadApiKey(function(apiKey) {
            if (!apiKey) {
                addMessage('请先在"API 设置"中配置你的 Qwen API Key。', 'ai');
                return;
            }

            // Disable input
            chatInput.disabled = true;
            sendBtn.disabled = true;

            // Check if page content is available
            if (!pageContent) {
                addMessage('请先在"内容提取"标签页提取页面内容，然后再提问。', 'ai');
                chatInput.disabled = false;
                sendBtn.disabled = false;
                return;
            }

            // Add user message to UI and history
            addMessage(userMessage, 'user');
            chatInput.value = '';

            // Show typing indicator
            showTypingIndicator();

            // Build messages for API
            const messages = [
                {
                    role: 'system',
                    content: '你是一个智能助手，擅长分析网页内容并回答用户问题。请基于提供的网页内容和对话历史给出准确、简洁的回答。'
                }
            ];

            // Always add page context
            messages.push(buildPrompt(pageContent));

            // Add conversation history (limit to last 10 messages to avoid token overflow)
            const maxHistoryLength = 10;
            const historyToAdd = chatHistory.slice(-maxHistoryLength);
            messages.push(...historyToAdd);

            // Call API
            loadApiUrl(function(apiUrl) {
                loadModelName(function(modelName) {
                    callQwenAPI(apiKey, messages, apiUrl, modelName)
                        .then(aiResponse => {
                            removeTypingIndicator();
                            addMessage(aiResponse, 'ai');
                            chatInput.disabled = false;
                            sendBtn.disabled = false;
                        })
                        .catch(error => {
                            removeTypingIndicator();
                            addMessage('抱歉，发生了错误：' + error.message, 'ai');
                            chatInput.disabled = false;
                            sendBtn.disabled = false;
                        });
                });
            });
        });
    }

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Clear chat history
    clearBtn.addEventListener('click', function() {
        chatMessages.innerHTML = '';
        addMessage('👋 你好！我可以帮你分析网页内容。请先在"内容提取"标签页提取页面内容，然后在这里输入你的问题。', 'ai');
        chatHistory = [];
    });

    // ==================== Initialize ====================
    document.addEventListener('DOMContentLoaded', function() {
        // Auto-read on popup open (optional)
        // readBtn.click();
    });
})();