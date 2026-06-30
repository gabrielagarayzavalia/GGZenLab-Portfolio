(function () {
  const GITHUB_USER = 'gabrielagarayzavalia';
  const REPO_NAME = 'GGZenLab-Portfolio';
  const REPO_URL = 'https://github.com/' + GITHUB_USER + '/' + REPO_NAME;
  const PAGES_URL = 'https://' + GITHUB_USER + '.github.io/' + REPO_NAME + '/';

  document.querySelectorAll('[data-repo-link]').forEach((el) => {
    el.href = REPO_URL;
  });
  document.querySelectorAll('[data-repo-name]').forEach((el) => {
    el.textContent = GITHUB_USER + '/' + REPO_NAME;
  });

  if (typeof GGZenNav !== 'undefined') {
    GGZenNav.render();
  }

  if (typeof GGZenI18n !== 'undefined') {
    GGZenI18n.initLangSwitcher();
  }

  if (typeof GGZenCopy !== 'undefined') {
    GGZenCopy.init();
  }
})();
