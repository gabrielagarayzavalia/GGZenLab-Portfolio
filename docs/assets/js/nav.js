(function (global) {
  const QA_ITEMS = [
    { id: 'api', i18n: 'nav.api', path: 'projects/api-testing/index.html' },
    { id: 'perf', i18n: 'nav.perf', path: 'projects/performance/index.html' },
    { id: 'guides', i18n: 'nav.guides', path: 'guides/index.html' },
    { id: 'backlog', i18n: 'nav.backlog', path: 'backlog/index.html' },
    { id: 'tcm', i18n: 'nav.tcm', path: 'projects/test-case-management/index.html' },
    { id: 'automation', i18n: 'nav.automation', path: 'projects/automation/index.html' },
    { id: 'github', i18n: 'nav.github', external: true }
  ];

  function href(root, path) {
    if (!root) return path;
    return root.replace(/\/?$/, '/') + path;
  }

  function isQaActive(active) {
    return active === 'qa-portfolio' || QA_ITEMS.some(function (item) {
      return item.id === active;
    });
  }

  function renderNav() {
    var nav = document.querySelector('.site-nav');
    if (!nav) return;

    var root = document.body.getAttribute('data-nav-root') || '';
    var active = document.body.getAttribute('data-nav-active') || '';
    var qaActive = isQaActive(active);
    var html = '';

    html += '<a href="' + href(root, 'index.html') + '" class="' + (active === 'home' ? 'active' : '') + '" data-i18n="nav.home">Home</a>';

    html += '<div class="nav-group' + (qaActive ? ' is-active' : '') + '">';
    html += '<a href="' + href(root, 'qa-portfolio/index.html') + '" class="nav-group-label' + (active === 'qa-portfolio' ? ' active' : '') + '" data-i18n="nav.qaPortfolio">QA Portfolio</a>';
    html += '<button type="button" class="nav-group-toggle" aria-expanded="false" aria-label="QA Portfolio menu"><span aria-hidden="true">▾</span></button>';
    html += '<div class="nav-dropdown" role="menu">';
    QA_ITEMS.forEach(function (item) {
      if (item.external) {
        html += '<a href="https://github.com/gabrielagarayzavalia/QA-portfolio" role="menuitem" data-repo-link data-i18n="' + item.i18n + '">GitHub</a>';
        return;
      }
      html += '<a href="' + href(root, item.path) + '" role="menuitem" class="' + (active === item.id ? 'active' : '') + '" data-i18n="' + item.i18n + '">' + item.i18n + '</a>';
    });
    html += '</div></div>';

    html += '<a href="' + href(root, 'misc/index.html') + '" class="' + (active === 'misc' ? 'active' : '') + '" data-i18n="nav.misc">Miscellaneous</a>';

    nav.innerHTML = html;

    var group = nav.querySelector('.nav-group');
    var toggle = nav.querySelector('.nav-group-toggle');
    if (!group || !toggle) return;

    toggle.addEventListener('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var open = group.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    document.addEventListener('click', function (event) {
      if (!group.contains(event.target)) {
        group.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  global.GGZenNav = { render: renderNav };
  renderNav();
})(window);
