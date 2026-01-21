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
            return true;
        }

        // Check for loading indicators
        for (const selector of LOADING_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isElementVisible(element)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Check if DOM is stable (no recent mutations)
     */
    function isDOMStable() {
        const now = Date.now();
        const timeSinceLastMutation = now - lastMutationTime;
        return timeSinceLastMutation >= STABLE_THRESHOLD;
    }

    /**
     * Check if there are any visible popups/dialogs
     */
    function hasVisiblePopups() {
        for (const selector of POPUP_SELECTORS) {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
                if (isElementVisible(element)) {
                    return true;
                }
            }
        }
        return false;
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

        iframes.forEach(iframe => {
            try {
                if (iframe.contentDocument) {
                    iframeContents.push({
                        src: iframe.src,
                        title: iframe.contentDocument.title,
                        text: extractText(iframe.contentDocument.body),
                        html: iframe.contentDocument.body.innerHTML
                    });
                }
            } catch (e) {
                // Cross-origin iframe, skip
            }
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
        // Use document.documentElement instead of document.body to capture everything
        const rootElement = document.documentElement || document.body;

        return {
            title: document.title,
            url: window.location.href,
            bodyText: extractText(rootElement),
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

            // Limit mutation count to prevent infinite tracking
            if (mutationCount > MAX_MUTATIONS) {
                mutationCount = MAX_MUTATIONS;
            }
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

        // Set up mutation observer
        setupMutationObserver();

        function check() {
            const elapsed = Date.now() - startTime;

            // Check if we've exceeded max wait time
            if (elapsed >= maxWaitTime) {
                console.log('Page Content Reader: Timeout waiting for dynamic content');
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
                lastDOMSnapshot = currentSnapshot;
                setTimeout(check, checkInterval);
                return;
            }

            // All checks passed
            mutationObserver.disconnect();
            console.log('Page Content Reader: Dynamic content loaded successfully');
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

            console.log('Page Content Reader: Starting content extraction...');

            waitForDynamicContent(function(result) {
                const content = getPageContent();
                content.dynamicContentLoaded = result.loaded;
                content.loadReason = result.reason;
                content.loadTime = result.elapsed;
                content.mutationCount = result.mutations || 0;
                content.hasPopups = hasVisiblePopups();
                
                console.log('Page Content Reader: Content extracted', {
                    loaded: result.loaded,
                    reason: result.reason,
                    elapsed: result.elapsed,
                    mutations: result.mutations,
                    hasPopups: content.hasPopups,
                    popupsCount: content.popups.length,
                    shadowDOMCount: content.shadowDOM.length,
                    iframeCount: content.iframes.length
                });
                
                sendResponse(content);
            }, waitTime);

            return true; // Keep the message channel open for async response
        }
    });

    // Log that content script is loaded
    console.log('Page Content Reader extension loaded');
})();