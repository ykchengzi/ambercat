// ==================== 滚动渐入动画 ====================
function initScrollReveal() {
    var els = document.querySelectorAll('.fade-up:not(.revealed)');
    if (!els.length) return;
    var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function(el, i) {
        el.style.transitionDelay = (i * 60) + 'ms';
        observer.observe(el);
    });
}
