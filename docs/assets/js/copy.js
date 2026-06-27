(function (global) {
  var COPY_ICON =
    '<svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>' +
    '</svg>';
  var DONE_ICON =
    '<svg class="copy-icon copy-icon-done" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path fill="currentColor" d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/>' +
    '</svg>';

  function label(key) {
    if (global.GGZenI18n && typeof global.GGZenI18n.t === 'function') {
      return global.GGZenI18n.t(key);
    }
    return key === 'copy.done' ? 'Copied!' : 'Copy code';
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (err) {
        document.body.removeChild(ta);
        reject(err);
      }
    });
  }

  function resetButton(btn) {
    btn.classList.remove('is-copied');
    btn.innerHTML = COPY_ICON;
    btn.setAttribute('aria-label', label('copy.label'));
    btn.removeAttribute('data-copied');
  }

  function showCopied(btn) {
    btn.classList.add('is-copied');
    btn.innerHTML = DONE_ICON;
    btn.setAttribute('aria-label', label('copy.done'));
    btn.setAttribute('data-copied', 'true');
    window.setTimeout(function () {
      if (btn.isConnected) resetButton(btn);
    }, 1800);
  }

  function enhanceBlock(pre) {
    if (!pre || pre.closest('.code-block-wrap')) return;

    var wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy-btn';
    btn.innerHTML = COPY_ICON;
    btn.setAttribute('aria-label', label('copy.label'));
    btn.setAttribute('title', label('copy.label'));

    btn.addEventListener('click', function () {
      var text = pre.textContent.replace(/\r\n/g, '\n').trimEnd();
      copyText(text)
        .then(function () {
          showCopied(btn);
        })
        .catch(function () {
          btn.setAttribute('aria-label', label('copy.label'));
        });
    });

    wrap.appendChild(btn);
  }

  function init() {
    document.querySelectorAll('pre.code-block').forEach(enhanceBlock);
    if (global.GGZenI18n && typeof global.GGZenI18n.apply === 'function') {
      document.querySelectorAll('.copy-btn:not([data-copied])').forEach(function (btn) {
        btn.setAttribute('aria-label', label('copy.label'));
        btn.setAttribute('title', label('copy.label'));
      });
    }
  }

  global.GGZenCopy = { init: init };
})(window);
