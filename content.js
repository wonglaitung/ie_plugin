(function() {
    'use strict';

    // Track DOM stability
    let mutationObserver = null;
    let lastMutationTime = 0;
    let mutationCount = 0;
    const STABLE_THRESHOLD = 500; // ms without mutations to consider stable
    const MAX_MUTATIONS = 50; // Max mutations before considering stable

    // Common popup/dialog selectors
    const POPUP_SELECTORS = [
        '[role="dialog"]',
        '[role="modal"]',
        '[role="alertdialog"]',
        '[role="tooltip"]',
        '.modal',
        '.dialog',
        '.popup',
        '.overlay',
        '.dropdown',
        '.popover',
        '.tooltip',
        '.context-menu',
        '.notification',
        '.toast',
        '[class*="modal"]',
        '[class*="dialog"]',
        '[class*="popup"]',
        '[class*="overlay"]',
        '[class*="tooltip"]',
        '[class*="dropdown"]'
    ];

    // Loading indicators
    const LOADING_SELECTORS = [
        '.loading',
        '.spinner',
        '.loader',
        '[class*="loading"]',
        '[class*="spinner"]',
        '[class*="loader"]',
        '[class*="skeleton"]',
        '[data-loading="true"]',
        '[aria-busy="true"]'
    ];

    /**
     * Check if an element is visible
     */
    function isElementVisible(element) {
        if (!element) return false;

        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return false;
        }

        // Check if element is in viewport or has fixed/absolute positioning
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return false;
        }

        return true;
    }

    /**
     * Check if page is still loading dynamic content
     */
    function isPageLoading() {
        // Check if document is still loading
        if (document.readyState !== 'complete') {
            console.warn('[PageInsight-DIAG] ⚠️ 页面未完全加载 - readyState:', document.readyState);
            return true;
        }

        // Check for loading indicators
        const foundIndicators = [];
        for (const selector of LOADING_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isElementVisible(element)) {
                    foundIndicators.push(selector);
                }
            }
        }

        if (foundIndicators.length > 0) {
            console.warn('[PageInsight-DIAG] ⚠️ 检测到加载指示器:', foundIndicators.join(', '));
            return true;
        }

        console.log('[PageInsight-DIAG] ✅ 未检测到加载指示器');
        return false;
    }

    /**
     * Check if DOM is stable (no recent mutations)
     */
    function isDOMStable() {
        const now = Date.now();
        const timeSinceLastMutation = now - lastMutationTime;
        const isStable = timeSinceLastMutation >= STABLE_THRESHOLD;

        if (!isStable) {
            console.warn('[PageInsight-DIAG] ⚠️ DOM 不稳定 - 距离上次变异仅', timeSinceLastMutation + 'ms', '阈值: ' + STABLE_THRESHOLD + 'ms', '变异次数:', mutationCount);
        } else {
            console.log('[PageInsight-DIAG] ✅ DOM 稳定 - 距离上次变异', timeSinceLastMutation + 'ms');
        }

        return isStable;
    }

    /**
     * Check if there are any visible popups/dialogs
     */
    function hasVisiblePopups() {
        const visiblePopups = [];
        for (const selector of POPUP_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isElementVisible(element)) {
                    visiblePopups.push(selector);
                }
            }
        }
        if (visiblePopups.length > 0) {
            console.warn('[PageInsight-DIAG] ⚠️ 检测到可见弹窗/对话框:', visiblePopups.join(', '));
        }
        return visiblePopups.length > 0;
    }

    /**
     * Extract text from element and its children
     */
    function extractText(element) {
        if (!element) return '';
        return element.innerText || element.textContent || '';
    }

    /**
     * Extract content from Shadow DOM
     */
    function extractShadowContent(rootElement) {
        const shadowRoots = [];
        
        function traverse(element) {
            if (element.shadowRoot) {
                shadowRoots.push(element.shadowRoot);
                traverse(element.shadowRoot);
            }
            
            Array.from(element.children).forEach(child => traverse(child));
        }
        
        traverse(rootElement);
        
        return shadowRoots.map(root => ({
            html: root.innerHTML,
            text: extractText(root),
            links: Array.from(root.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            })).filter(link => link.href && link.text),
            images: Array.from(root.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt
            })).filter(img => img.src)
        }));
    }

    /**
     * Extract content from same-origin iframes
     */
    function extractIframeContent() {
        const iframes = Array.from(document.querySelectorAll('iframe'));
        const iframeContents = [];

        console.log('[PageInsight-DIAG] 🔍 检测到', iframes.length, '个 iframe');

        iframes.forEach((iframe, index) => {
            try {
                if (iframe.contentDocument) {
                    const iframeText = extractText(iframe.contentDocument.body);
                    iframeContents.push({
                        src: iframe.src,
                        title: iframe.contentDocument.title,
                        text: iframeText,
                        html: iframe.contentDocument.body.innerHTML
                    });
                    console.log('[PageInsight-DIAG] ✅ iframe #' + (index + 1) + ' (同源):', {
                        src: iframe.src,
                        title: iframe.contentDocument.title,
                        textLength: iframeText.length
                    });
                }
            } catch (e) {
                console.warn('[PageInsight-DIAG] ⚠️ iframe #' + (index + 1) + ' (跨源):', {
                    src: iframe.src,
                    reason: '跨源限制，无法访问内容'
                });
            }
        });

        console.log('[PageInsight-DIAG] 📊 iframe 提取结果:', {
            '总数': iframes.length,
            '同源可访问': iframeContents.length,
            '跨源不可访问': iframes.length - iframeContents.length
        });

        return iframeContents;
    }

    /**
     * Extract popup/dialog content
     */
    function extractPopupContent() {
        const popups = [];

        for (const selector of POPUP_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                if (isElementVisible(element)) {
                    popups.push({
                        selector: selector,
                        text: extractText(element),
                        html: element.innerHTML,
                        id: element.id,
                        class: element.className
                    });
                }
            });
        }

        return popups;
    }

    /**
     * Extract all visible content from the page
     */
    function getPageContent() {
        console.log('[PageInsight-DIAG] ========== 开始提取页面内容 ==========');

        // Use document.documentElement instead of document.body to capture everything
        const rootElement = document.documentElement || document.body;

        // Check if body exists
        if (!document.body) {
            console.error('[PageInsight-DIAG] ❌ 严重问题: document.body 不存在！');
            console.error('[PageInsight-DIAG] ❌ 可能原因: 页面尚未加载完成或使用了特殊框架');
        }

        // Check body content
        const bodyText = extractText(rootElement);
        if (bodyText.length === 0) {
            console.error('[PageInsight-DIAG] ❌ 严重问题: 页面文本内容为空！');
            console.error('[PageInsight-DIAG] ❌ 可能原因: 内容未加载、使用 Shadow DOM 或使用了 iframe');
        } else {
            console.log('[PageInsight-DIAG] ✅ 页面文本长度:', bodyText.length, '字符');
            console.log('[PageInsight-DIAG] 📝 文本预览:', bodyText.substring(0, 150) + '...');
        }

        const content = {
            title: document.title,
            url: window.location.href,
            bodyText: bodyText,
            html: rootElement.innerHTML,
            metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                name: meta.getAttribute('name'),
                content: meta.getAttribute('content'),
                property: meta.getAttribute('property')
            })).filter(meta => meta.name || meta.property),
            links: Array.from(rootElement.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            })).filter(link => link.href && link.text),
            images: Array.from(rootElement.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt
            })).filter(img => img.src),
            forms: Array.from(rootElement.querySelectorAll('form')).map(form => ({
                action: form.action,
                method: form.method,
                inputs: Array.from(form.querySelectorAll('input, textarea, select')).map(input => ({
                    type: input.type,
                    name: input.name,
                    value: input.value,
                    placeholder: input.placeholder
                }))
            })),
            buttons: Array.from(rootElement.querySelectorAll('button')).map(btn => ({
                text: btn.textContent.trim(),
                type: btn.type,
                disabled: btn.disabled
            })),
            // Dynamic content detection
            popups: extractPopupContent(),
            shadowDOM: extractShadowContent(rootElement),
            iframes: extractIframeContent(),
            // Page state
            readyState: document.readyState,
            scrollY: window.scrollY,
            scrollHeight: document.documentElement.scrollHeight,
            viewportHeight: window.innerHeight
        };

        // Log extraction summary with focus on potential issues
        console.log('[PageInsight-DIAG] 📊 提取结果统计:', {
            '链接数': content.links.length,
            '图片数': content.images.length,
            '表单数': content.forms.length,
            '按钮数': content.buttons.length,
            'Shadow DOM 数': content.shadowDOM.length,
            'iframe 数': content.iframes.length,
            '弹窗数': content.popups.length
        });

        if (content.shadowDOM.length > 0) {
            console.warn('[PageInsight-DIAG] ⚠️ 检测到 Shadow DOM，可能影响内容提取');
        }

        if (content.iframes.length > 0) {
            console.warn('[PageInsight-DIAG] ⚠️ 检测到 ' + content.iframes.length + ' 个 iframe');
            console.warn('[PageInsight-DIAG] ⚠️ iframe 内容已提取并包含在结果中');
            console.warn('[PageInsight-DIAG] ⚠️ 注意: 跨源 iframe 的内容无法访问');
        }

        console.log('[PageInsight-DIAG] ========== 内容提取完成 ==========');
        return content;
    }

    /**
     * Set up MutationObserver to track DOM changes
     */
    function setupMutationObserver() {
        if (mutationObserver) {
            mutationObserver.disconnect();
        }

        mutationObserver = new MutationObserver((mutations) => {
            lastMutationTime = Date.now();
            mutationCount += mutations.length;
        });

        mutationObserver.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: false,
            characterData: false
        });
    }

    /**
     * Wait for dynamic content to load with multiple strategies
     */
    function waitForDynamicContent(callback, maxWaitTime = 5000, checkInterval = 200) {
        const startTime = Date.now();
        let lastDOMSnapshot = document.documentElement.innerHTML;
        let checkCount = 0;

        console.log('[PageInsight-DIAG] ========== 开始等待动态内容加载 ==========');
        console.log('[PageInsight-DIAG] ⏱️  配置:', {
            '最大等待时间': maxWaitTime + 'ms',
            '检查间隔': checkInterval + 'ms',
            '初始 readyState': document.readyState
        });

        // Set up mutation observer
        setupMutationObserver();

        function check() {
            const elapsed = Date.now() - startTime;
            checkCount++;

            // Check if we've exceeded max wait time
            if (elapsed >= maxWaitTime) {
                console.error('[PageInsight-DIAG] ❌ 超时！等待动态内容失败');
                console.error('[PageInsight-DIAG] ❌ 超时详情:', {
                    '已等待': elapsed + 'ms',
                    '总检查次数': checkCount,
                    '最终变异次数': mutationCount,
                    '最终 readyState': document.readyState
                });
                console.error('[PageInsight-DIAG] ❌ 可能原因:');
                console.error('[PageInsight-DIAG] ❌   1. 页面持续加载（加载指示器一直存在）');
                console.error('[PageInsight-DIAG] ❌   2. DOM 持续变化（页面一直在更新）');
                console.error('[PageInsight-DIAG] ❌   3. 等待时间设置太短（当前: ' + maxWaitTime + 'ms）');
                mutationObserver.disconnect();
                callback({
                    loaded: false,
                    reason: 'timeout',
                    elapsed: elapsed
                });
                return;
            }

            // Check if page is loading
            if (isPageLoading()) {
                setTimeout(check, checkInterval);
                return;
            }

            // Check if DOM is stable
            if (!isDOMStable()) {
                setTimeout(check, checkInterval);
                return;
            }

            // Check if DOM has changed significantly
            const currentSnapshot = document.documentElement.innerHTML;
            if (currentSnapshot !== lastDOMSnapshot) {
                const diffLength = Math.abs(currentSnapshot.length - lastDOMSnapshot.length);
                console.warn('[PageInsight-DIAG] ⚠️ DOM 内容发生变化，继续等待...');
                console.warn('[PageInsight-DIAG] ⚠️ 变化大小:', diffLength + ' 字符');
                lastDOMSnapshot = currentSnapshot;
                setTimeout(check, checkInterval);
                return;
            }

            // All checks passed
            mutationObserver.disconnect();
            console.log('[PageInsight-DIAG] ✅ 动态内容加载成功！');
            console.log('[PageInsight-DIAG] ✅ 加载详情:', {
                '总耗时': elapsed + 'ms',
                '检查次数': checkCount,
                'DOM 变异次数': mutationCount,
                '最终 readyState': document.readyState
            });
            callback({
                loaded: true,
                reason: 'stable',
                elapsed: elapsed,
                mutations: mutationCount
            });
        }

        // Start checking
        setTimeout(check, 100);
    }

    /**
     * Listen for messages from popup
     */
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getPageContent') {
            const waitTime = request.waitTime || 3000; // Default 3 seconds wait

            console.log('[PageInsight-DIAG] 📨 收到内容提取请求');
            console.log('[PageInsight-DIAG] 📋 页面信息:', {
                'URL': window.location.href,
                '标题': document.title,
                'readyState': document.readyState,
                '等待时间': waitTime + 'ms'
            });

            waitForDynamicContent(function(result) {
                const content = getPageContent();
                content.dynamicContentLoaded = result.loaded;
                content.loadReason = result.reason;
                content.loadTime = result.elapsed;
                content.mutationCount = result.mutations || 0;
                content.hasPopups = hasVisiblePopups();

                if (result.loaded) {
                    console.log('[PageInsight-DIAG] ✅ 内容提取成功，发送响应');
                } else {
                    console.error('[PageInsight-DIAG] ❌ 内容提取失败，发送部分结果');
                }

                sendResponse(content);
            }, waitTime);

            return true; // Keep the message channel open for async response
        }
    });

    // Log that content script is loaded
    console.log('Page Content Reader extension loaded');
})();