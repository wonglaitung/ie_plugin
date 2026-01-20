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
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const apiKeyInput = document.getElementById('apiKey');
    const apiUrlInput = document.getElementById('apiUrl');
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
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    function getPageContentWithFallback(tabId, retryCount = 0, waitTime = 3000) {
        chrome.tabs.sendMessage(tabId, {action: 'getPageContent', waitTime: waitTime}, function(response) {
            if (chrome.runtime.lastError) {
                if (retryCount < 2) {
                    injectContentScript(tabId, function(success) {
                        if (success) {
                            setTimeout(() => {
                                getPageContentWithFallback(tabId, retryCount + 1, waitTime);
                            }, 300);
                        } else {
                            readBtn.disabled = false;
                            showError('Could not inject content script. Please check extension permissions.');
                        }
                    });
                } else {
                    readBtn.disabled = false;
                    showError('Could not read page content. Please refresh the page and try again.');
                }
                return;
            }

            readBtn.disabled = false;

            if (response) {
                displayContent(response);
            } else {
                showError('No content received');
            }
        });
    }

    readBtn.addEventListener('click', function() {
        readBtn.disabled = true;
        showLoading();

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                showError('No active tab found');
                readBtn.disabled = false;
                return;
            }

            const activeTab = tabs[0];

            if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
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
            callback(result.qwenApiKey || '');
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

    settingsBtn.addEventListener('click', function() {
        loadApiKey(function(apiKey) {
            loadApiUrl(function(apiUrl) {
                apiKeyInput.value = apiKey;
                apiUrlInput.value = apiUrl;
                settingsModal.classList.add('active');
            });
        });
    });

    cancelSettingsBtn.addEventListener('click', function() {
        settingsModal.classList.remove('active');
    });

    saveSettingsBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const apiUrl = apiUrlInput.value.trim();
        saveApiKey(apiKey);
        saveApiUrl(apiUrl);
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

    function buildPrompt(pageContent, userQuestion) {
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
            role: 'user',
            content: `请基于以下网页内容回答问题：

【网页内容】
${contentText}

【用户问题】
${userQuestion}

请提供准确、简洁的回答。`
        };
    }

    async function callQwenAPI(apiKey, messages, apiUrl) {
        try {
            const defaultUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
            const url = apiUrl || defaultUrl;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'qwen-plus-2025-07-28',
                    messages: messages,
                    max_tokens: 32768,
                    temperature: 0.7,
                    top_p: 0.8
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'API request failed');
            }

            const data = await response.json();
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

            // Add user message
            addMessage(userMessage, 'user');
            chatInput.value = '';

            // Check if page content is available
            if (!pageContent) {
                addMessage('请先在"内容提取"标签页提取页面内容，然后再提问。', 'ai');
                chatInput.disabled = false;
                sendBtn.disabled = false;
                return;
            }

            // Show typing indicator
            showTypingIndicator();

            // Build messages for API
            const messages = [
                {
                    role: 'system',
                    content: '你是一个智能助手，擅长分析网页内容并回答用户问题。请基于提供的网页内容给出准确、简洁的回答。'
                },
                buildPrompt(pageContent, userMessage)
            ];

            // Call API
            loadApiUrl(function(apiUrl) {
                callQwenAPI(apiKey, messages, apiUrl)
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
    }

    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ==================== Initialize ====================
    document.addEventListener('DOMContentLoaded', function() {
        // Auto-read on popup open (optional)
        // readBtn.click();
    });
})();