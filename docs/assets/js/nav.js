(function (global) {
  const QA_ITEMS = [
    { id: 'qa', i18n: 'nav.qaOverview', path: 'qa/index.html' },
    { id: 'api', i18n: 'nav.api', path: 'projects/api-testing/index.html' },
    { id: 'perf', i18n: 'nav.perf', path: 'projects/performance/index.html' },
    { id: 'labs', i18n: 'nav.labs', path: 'qa/labs/index.html' },
    { id: 'guides', i18n: 'nav.guides', path: 'guides/index.html' },
    { id: 'backlog', i18n: 'nav.backlog', path: 'backlog/index.html' },
    { id: 'tcm', i18n: 'nav.tcm', path: 'projects/test-case-management/index.html' },
    { id: 'automation', i18n: 'nav.automation', path: 'projects/automation/index.html' }
  ];

  const PO_ITEMS = [
    { id: 'po', i18n: 'nav.poOverview', path: 'product-owner/index.html' },
    { id: 'job-hunter', i18n: 'nav.jobHunter', path: 'product-owner/job-hunter.html' }
  ];

  function href(root, path) {
    if (!root) return path;
    return root.replace(/\/?$/, '/') + path;
  }

  function isQaActive(active) {
    return active === 'qa' || active === 'qa-portfolio' || QA_ITEMS.some(function (item) {
      return item.id === active;
    });
  }

  function isPoActive(active) {
    return active === 'po' || active === 'job-hunter' || PO_ITEMS.some(function (item) {
      return item.id === active;
    });
  }

  function renderNavGroup(root, active, groupClass, labelPath, labelI18n, labelActive, items, isActiveFn) {
    var groupActive = isActiveFn(active);
    var html = '<div class="nav-group' + (groupActive ? ' is-active' : '') + '">';
    html += '<a href="' + href(root, labelPath) + '" class="nav-group-label' + (active === labelActive ? ' active' : '') + '" data-i18n="' + labelI18n + '">' + labelI18n + '</a>';
    html += '<button type="button" class="nav-group-toggle" aria-expanded="false" aria-label="Menu"><span aria-hidden="true">▾</span></button>';
    html += '<div class="nav-dropdown" role="menu">';
    items.forEach(function (item) {
      html += '<a href="' + href(root, item.path) + '" role="menuitem" class="' + (active === item.id ? 'active' : '') + '" data-i18n="' + item.i18n + '">' + item.i18n + '</a>';
    });
    html += '</div></div>';
    return html;
  }

  function bindNavGroups(nav) {
    nav.querySelectorAll('.nav-group').forEach(function (group) {
      var toggle = group.querySelector('.nav-group-toggle');
      if (!toggle) return;
      toggle.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        nav.querySelectorAll('.nav-group.open').forEach(function (g) {
          if (g !== group) {
            g.classList.remove('open');
            var t = g.querySelector('.nav-group-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          }
        });
        var open = group.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });

    document.addEventListener('click', function (event) {
      if (!nav.contains(event.target)) {
        nav.querySelectorAll('.nav-group.open').forEach(function (group) {
          group.classList.remove('open');
          var toggle = group.querySelector('.nav-group-toggle');
          if (toggle) toggle.setAttribute('aria-expanded', 'false');
        });
      }
    });
  }

  function renderNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;

    var root = document.body.getAttribute('data-nav-root') || '';
    var active = document.body.getAttribute('data-nav-active') || '';
    var html = '';

    html += '<a href="' + href(root, 'index.html') + '" class="' + (active === 'home' ? 'active' : '') + '" data-i18n="nav.home">Home</a>';

    html += renderNavGroup(root, active, 'qa', 'qa/index.html', 'nav.qa', 'qa', QA_ITEMS, isQaActive);
    html += renderNavGroup(root, active, 'po', 'product-owner/index.html', 'nav.po', 'po', PO_ITEMS, isPoActive);

    html += '<a href="' + href(root, 'misc/index.html') + '" class="' + (active === 'misc' ? 'active' : '') + '" data-i18n="nav.misc">Miscellaneous</a>';
    html += '<a href="https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio" data-repo-link data-i18n="nav.github">GitHub</a>';

    nav.innerHTML = html;
    bindNavGroups(nav);
  }

  global.GGZenNav = { render: renderNav };
  renderNav();
})(window);
