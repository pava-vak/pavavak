// ============================================================
// PaVa-Vak iOS Install Hint  |  ios-detect.js
// Detects iOS Safari and shows manual install instructions.
// Separated from index.html to keep CSP script-src 'self' clean.
// ============================================================
(function () {
    const isIOS       = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari    = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    const isStandalone = window.navigator.standalone === true;
    if (isIOS && isSafari && !isStandalone) {
        document.getElementById('ios-install-hint').style.display = 'block';
    }
})();
