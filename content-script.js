// 当页面可见时发送域名信息
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    chrome.runtime.sendMessage({
      type: "pageVisibility",
      domain: window.location.hostname
    });
  }
});

// 初始发送
chrome.runtime.sendMessage({
  type: "pageVisibility",
  domain: window.location.hostname
});