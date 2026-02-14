/**
 * Detects if the current device is a mobile phone or tablet.
 * Used primarily to determine if PDFs should be opened in a new tab
 * instead of rendered inside an iframe (mobile browsers don't support
 * full PDF rendering in iframes).
 */
export function isMobileOrTablet(): boolean {
    const ua = navigator.userAgent

    // iOS devices (iPhone, iPad, iPod)
    if (/iPhone|iPad|iPod/.test(ua)) return true

    // iPadOS 13+ reports as "Macintosh" but has touch support
    if (ua.includes('Macintosh') && navigator.maxTouchPoints > 1) return true

    // Android devices
    if (/Android/.test(ua)) return true

    return false
}
