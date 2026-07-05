(function (global) {
  var GITHUB_BLOB = 'https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/blob/main/';

  function statusBadgeClass(status) {
    if (status === 'completed') return 'status-done';
    if (status === 'in_progress') return 'status-progress';
    return 'status-planned';
  }

  function statusI18nKey(status) {
    if (status === 'completed') return 'labs.status.completed';
    if (status === 'in_progress') return 'labs.status.inProgress';
    return 'labs.status.todo';
  }

  function formatDate(value) {
    return value || '—';
  }

  function guideHref(guidePath) {
    if (!guidePath) return null;
    return GITHUB_BLOB + guidePath;
  }

  function sortInstances(catalog, instances) {
    var order = {};
    catalog.labs.forEach(function (lab, index) {
      order[lab.id] = index;
    });
    return instances.slice().sort(function (a, b) {
      var labDiff = (order[a.labId] || 0) - (order[b.labId] || 0);
      if (labDiff !== 0) return labDiff;
      return a.frameworkKey.localeCompare(b.frameworkKey);
    });
  }

  function findLab(catalog, labId) {
    return catalog.labs.find(function (lab) {
      return lab.id === labId;
    });
  }

  function renderRow(instance, lab, lang) {
    var tr = document.createElement('tr');
    if (lab && lab.track === 'job-skills') {
      tr.setAttribute('data-track', 'job-skills');
    }

    var nameCell = document.createElement('td');
    var strong = document.createElement('strong');
    strong.textContent = (lab && lab.title) || instance.labId;
    nameCell.appendChild(strong);
    nameCell.appendChild(document.createElement('br'));
    var idSpan = document.createElement('span');
    idSpan.className = 'muted-inline';
    idSpan.textContent = instance.labId;
    nameCell.appendChild(idSpan);
    if (lab && lab.availability === 'planned') {
      nameCell.appendChild(document.createElement('br'));
      var planned = document.createElement('span');
      planned.className = 'status-badge status-planned';
      planned.setAttribute('data-i18n', 'labs.badge.planned');
      planned.textContent = lang === 'es' ? 'Planificado' : 'Planned';
      nameCell.appendChild(planned);
    }
    tr.appendChild(nameCell);

    var descCell = document.createElement('td');
    descCell.textContent = (lab && lab.descriptionShort) || '';
    tr.appendChild(descCell);

    var fwCell = document.createElement('td');
    fwCell.textContent = instance.frameworkLabel;
    tr.appendChild(fwCell);

    var startCell = document.createElement('td');
    startCell.textContent = formatDate(instance.startedAt);
    tr.appendChild(startCell);

    var endCell = document.createElement('td');
    endCell.textContent = formatDate(instance.completedAt);
    tr.appendChild(endCell);

    var statusCell = document.createElement('td');
    var badge = document.createElement('span');
    badge.className = 'status-badge ' + statusBadgeClass(instance.status);
    badge.setAttribute('data-i18n', statusI18nKey(instance.status));
    badge.textContent = instance.status;
    statusCell.appendChild(badge);
    tr.appendChild(statusCell);

    var countCell = document.createElement('td');
    countCell.textContent = String(instance.attemptCount != null ? instance.attemptCount : 0);
    tr.appendChild(countCell);

    var guideCell = document.createElement('td');
    if (lab && lab.guidePath) {
      var link = document.createElement('a');
      link.href = guideHref(lab.guidePath);
      link.target = '_blank';
      link.rel = 'noopener';
      link.setAttribute('data-i18n', 'labs.col.guide');
      link.textContent = 'Guide';
      guideCell.appendChild(link);
    } else {
      guideCell.textContent = '—';
    }
    tr.appendChild(guideCell);

    return tr;
  }

  function renderTable(catalog, instances) {
    var tbody = document.querySelector('#labs-registry tbody');
    if (!tbody) return;

    var lang = (global.GGZenI18n && global.GGZenI18n.getLang && global.GGZenI18n.getLang()) || 'en';
    tbody.innerHTML = '';
    sortInstances(catalog, instances).forEach(function (instance) {
      var lab = findLab(catalog, instance.labId);
      tbody.appendChild(renderRow(instance, lab, lang));
    });

    if (global.GGZenI18n && global.GGZenI18n.apply) {
      global.GGZenI18n.apply(document);
    }
  }

  function loadRegistry() {
    var tbody = document.querySelector('#labs-registry tbody');
    if (!tbody) return;

    Promise.all([
      fetch('data/catalog.json').then(function (r) {
        if (!r.ok) throw new Error('catalog.json');
        return r.json();
      }),
      fetch('data/instances.json').then(function (r) {
        if (!r.ok) throw new Error('instances.json');
        return r.json();
      })
    ]).then(function (results) {
      renderTable(results[0], results[1].instances || []);
    }).catch(function () {
      tbody.innerHTML = '<tr><td colspan="8" data-i18n="labs.loadError">Could not load registry data.</td></tr>';
      if (global.GGZenI18n && global.GGZenI18n.apply) {
        global.GGZenI18n.apply(document);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadRegistry);
  } else {
    loadRegistry();
  }
})(window);
