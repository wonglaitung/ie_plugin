(function() {
    'use strict';

    const readBtn = document.getElementById('readBtn');
    const resultDiv = document.getElementById('result');

    // Function to display content
    function displayContent(content) {
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
    }

    // Function to escape HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Function to show error
    function showError(message) {
        resultDiv.innerHTML = '<div class="error">Error: ' + escapeHtml(message) + '</div>';
    }

    // Function to show loading
    function showLoading() {
        resultDiv.innerHTML = '<div class="loading">⏳ Loading page content...<br><small>Waiting for dynamic content (up to 3 seconds)</small></div>';
    }

    // Function to inject content script
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

    // Function to get page content with fallback
    function getPageContentWithFallback(tabId, retryCount = 0, waitTime = 3000) {
        chrome.tabs.sendMessage(tabId, {action: 'getPageContent', waitTime: waitTime}, function(response) {
            if (chrome.runtime.lastError) {
                // Content script not found, try to inject it
                if (retryCount < 2) {
                    injectContentScript(tabId, function(success) {
                        if (success) {
                            // Wait a bit for the script to initialize, then retry
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

    // Event listener for read button
    readBtn.addEventListener('click', function() {
        readBtn.disabled = true;
        showLoading();

        // Query active tab
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                showError('No active tab found');
                readBtn.disabled = false;
                return;
            }

            const activeTab = tabs[0];

            // Check if we can access the tab
            if (activeTab.url.startsWith('chrome://') || activeTab.url.startsWith('edge://') || activeTab.url.startsWith('about:')) {
                readBtn.disabled = false;
                showError('Cannot read content from this page (browser internal page)');
                return;
            }

            // Try to get page content with fallback
            getPageContentWithFallback(activeTab.id);
        });
    });

    // Auto-read when popup opens (optional)
    document.addEventListener('DOMContentLoaded', function() {
        // Uncomment the line below to auto-read on popup open
        // readBtn.click();
    });
})();