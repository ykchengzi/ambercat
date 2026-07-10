function initUserTabLinks() {
    var hrefMap = {
        'panel.php': 'panel'
    };
    document.addEventListener('click', function(e) {
        var link = e.target.closest('a');
        if (!link || link.target || link.hasAttribute('download')) return;
        var url = new URL(link.href, location.href);
        if (url.origin !== location.origin) return;
        var tabKey = hrefMap[url.pathname.split('/').pop()];
        if (url.pathname.split('/').pop() === 'panel.php' && url.searchParams.get('tab')) {
            tabKey = url.searchParams.get('tab');
        }
        if (!tabKey || !document.getElementById('tab-' + tabKey)) return;
        e.preventDefault();
        switchUserTab(tabKey);
    });

    window.addEventListener('popstate', function() {
        var params = new URLSearchParams(window.location.search);
        var tabKey = params.get('tab') || 'panel';
        var target = document.getElementById('tab-' + tabKey);
        if (!target) tabKey = 'panel';
        var realTarget = document.getElementById('tab-' + tabKey);
        if (typeof window.showUserTabPane === 'function') {
            window.showUserTabPane(realTarget);
        } else {
            document.querySelectorAll('.user-tab-pane').forEach(function(pane) {
                if (pane !== realTarget) pane.style.display = 'none';
            });
            realTarget.style.display = 'block';
            realTarget.querySelectorAll('.fade-up').forEach(function(el) {
                el.classList.add('revealed');
                el.style.transitionDelay = '0s';
            });
        }
        document.querySelectorAll('.sidebar-nav .nav-item').forEach(function(item) {
            item.classList.remove('active');
        });
        var nav = document.getElementById('nav-' + tabKey);
        if (nav) nav.classList.add('active');
        var title = document.getElementById('user-page-title');
        if (title && window.userTabLabels && window.userTabLabels[tabKey]) {
            title.textContent = window.userTabLabels[tabKey];
        }
        if (tabKey === 'tickets') {
            loadUserTickets(true);
            startUserTicketsPolling();
        } else {
            stopUserTicketsPolling();
        }
        if (tabKey === 'notifications' && typeof ensureUserNotificationsLoaded === 'function') {
            ensureUserNotificationsLoaded();
        }
        if (tabKey === 'announcements' && typeof ensureUserAnnouncementsLoaded === 'function') {
            ensureUserAnnouncementsLoaded();
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    initUserPageInteractions(document);
    initUserTabLinks();
    startTicketBadgePolling();
    if (isUserTicketsTabVisible()) {
        loadUserTickets(true);
        startUserTicketsPolling();
    }
    if (document.getElementById('tab-notifications') && document.getElementById('tab-notifications').style.display !== 'none'
        && typeof ensureUserNotificationsLoaded === 'function') {
        ensureUserNotificationsLoaded();
    }
    if (document.getElementById('tab-announcements') && document.getElementById('tab-announcements').style.display !== 'none'
        && typeof ensureUserAnnouncementsLoaded === 'function') {
        ensureUserAnnouncementsLoaded();
    }
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            stopUserTicketsPolling();
        } else {
            refreshTicketBadge();
            if (isUserTicketsTabVisible()) {
                loadUserTickets(true);
                startUserTicketsPolling();
            }
        }
    });
});
