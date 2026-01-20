(function() {
    'use strict';

    // Function to check if page is still loading dynamic content
    function isPageLoading() {
        // Check if document is still loading
        if (document.readyState !== 'complete') {
            return true;
        }

        // Check for common loading indicators
        const loadingIndicators = [
            '.loading',
            '.spinner',
            '.loader',
            '[class*="loading"]',
            '[class*="spinner"]',
            '[class*="loader"]'
        ];

        for (const selector of loadingIndicators) {
            const element = document.querySelector(selector);
            if (element && element.offsetParent !== null) {
                return true;
            }
        }

        // Check for skeleton loading patterns
        const skeletons = document.querySelectorAll('[class*="skeleton"]');
        if (skeletons.length > 0) {
            return true;
        }

        return false;
    }

    // Function to wait for dynamic content to load
    function waitForDynamicContent(callback, maxWaitTime = 5000, checkInterval = 200) {
        const startTime = Date.now();

        function check() {
            if (!isPageLoading()) {
                callback(true);
                return;
            }

            const elapsed = Date.now() - startTime;
            if (elapsed >= maxWaitTime) {
                console.log('Page Content Reader: Timeout waiting for dynamic content');
                callback(false);
                return;
            }

            setTimeout(check, checkInterval);
        }

        check();
    }

    // Function to extract page content
    function getPageContent() {
        return {
            title: document.title,
            url: window.location.href,
            bodyText: document.body.innerText,
            html: document.body.innerHTML,
            metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
                name: meta.getAttribute('name'),
                content: meta.getAttribute('content'),
                property: meta.getAttribute('property')
            })).filter(meta => meta.name || meta.property),
            links: Array.from(document.querySelectorAll('a')).map(a => ({
                text: a.textContent.trim(),
                href: a.href
            })).filter(link => link.href && link.text),
            images: Array.from(document.querySelectorAll('img')).map(img => ({
                src: img.src,
                alt: img.alt
            })).filter(img => img.src)
        };
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'getPageContent') {
            // Wait for dynamic content before extracting
            const waitTime = request.waitTime || 3000; // Default 3 seconds wait

            waitForDynamicContent(function(loaded) {
                const content = getPageContent();
                content.dynamicContentLoaded = loaded;
                sendResponse(content);
            }, waitTime);

            return true; // Keep the message channel open for async response
        }
    });

    // Log that content script is loaded
    console.log('Page Content Reader extension loaded');
})();