/** Código que corre en el browser (Playwright evaluate). Archivo .js plano — sin transform tsx. */

export function collectDomInventoryInBrowser() {
  const count = (sel) => document.querySelectorAll(sel).length;
  const sampleText = (sel, max = 3) => {
    const out = [];
    const nodes = document.querySelectorAll(sel);
    for (let i = 0; i < Math.min(nodes.length, max); i++) {
      const el = nodes[i];
      const text = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 180);
      if (text) out.push(text);
    }
    return out;
  };

  const main = document.querySelector("main");
  const feed =
    document.querySelector(".scaffold-finite-scroll__content") ||
    document.querySelector('[role="feed"]') ||
    document.querySelector(".notifications-index");

  const itemSelectors = [
    "li.nt-card",
    "li.notification-card",
    ".nt-card",
    ".notifications-index__item",
    "main li",
    '[data-test-notification-item]',
    ".scaffold-finite-scroll__content > div > div",
  ];

  const itemCounts = {};
  for (const s of itemSelectors) itemCounts[s] = count(s);

  const timestampSelectors = [
    "time",
    ".notification-card__time-ago",
    ".nt-card__time-ago",
    ".time-badge",
    "span[aria-hidden='true']",
  ];
  const timestampSamples = [];
  for (const s of timestampSelectors) timestampSamples.push(...sampleText(s, 2));

  const viewJobsButtons = [];
  const buttons = document.querySelectorAll("button, a");
  for (const el of buttons) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (/view jobs|ver empleos|ver trabajos|see jobs/i.test(t)) {
      viewJobsButtons.push(t);
      if (viewJobsButtons.length >= 5) break;
    }
  }

  let feedClass = null;
  if (feed && feed.className) feedClass = String(feed.className).slice(0, 120);

  return {
    url: location.href,
    title: document.title,
    mainPresent: Boolean(main),
    feedTag: feed ? feed.tagName : null,
    feedClass,
    itemCounts,
    timestampSamples: Array.from(new Set(timestampSamples)).slice(0, 8),
    viewJobsButtonLabels: viewJobsButtons,
    bodyChildCount: document.body ? document.body.childElementCount : 0,
  };
}

export function extractNotificationItemsInBrowser() {
  let nodes = Array.from(document.querySelectorAll(".nt-card"));
  if (nodes.length < 3) {
    nodes = Array.from(document.querySelectorAll("li.notification-card, .notifications-index__item"));
  }
  if (nodes.length < 3) {
    nodes = Array.from(document.querySelectorAll("main ul > li"));
  }

  return nodes.map((el, index) => {
    const headline =
      el.querySelector(".nt-card__headline") ||
      el.querySelector(".notification-card__message") ||
      el.querySelector(".nt-card__text") ||
      el.querySelector("span[dir='ltr']") ||
      el;
    const text = (headline.textContent || el.textContent || "").replace(/\s+/g, " ").trim();

    const timeEl =
      el.querySelector("time") ||
      el.querySelector(".notification-card__time-ago") ||
      el.querySelector(".nt-card__time-ago") ||
      el.querySelector(".time-badge") ||
      el.querySelector("span.nt-card__time-ago");
    let timestampText = "";
    if (timeEl) {
      timestampText = (timeEl.textContent || timeEl.getAttribute("datetime") || "")
        .replace(/\s+/g, " ")
        .trim();
    }
    if (!timestampText) {
      const m = text.match(/\b(\d+\s*(?:s|m|h|d|w|mo|y)|just now|ahora|hace\s+\d+\s*[hdw])\b/i);
      if (m) timestampText = m[1];
    }

    const link =
      el.querySelector("a[href*='/jobs']") ||
      el.querySelector("a[href*='notification']") ||
      el.querySelector("a[href]");
    const href = link ? link.getAttribute("href") : null;

    let hasViewJobs = false;
    const actionEls = el.querySelectorAll("button, a");
    for (const btn of actionEls) {
      const label = (btn.textContent || "").replace(/\s+/g, " ").trim();
      if (/view jobs|ver empleos|ver trabajos|see jobs/i.test(label)) {
        hasViewJobs = true;
        break;
      }
    }

    return { index, text, timestampText, href, hasViewJobs };
  }).filter((item) => item.text.length > 5);
}

export function scrollNotificationsFeedInBrowser() {
  const feed =
    document.querySelector(".scaffold-finite-scroll__content") ||
    document.querySelector('[role="feed"]') ||
    document.querySelector("main");
  if (feed) feed.scrollTop = feed.scrollHeight;
  window.scrollTo(0, document.body.scrollHeight);
}

export function readJobDetailMetaInBrowser() {
  const titleSels = [
    ".jobs-unified-top-card__job-title",
    ".job-details-jobs-unified-top-card__job-title",
    "h1.t-24",
    "h2.t-24",
    ".job-details-jobs-unified-top-card__job-title a",
  ];
  let title = "";
  for (const s of titleSels) {
    const el = document.querySelector(s);
    if (el && el.textContent && el.textContent.trim()) {
      title = el.textContent;
      break;
    }
  }
  const companySels = [
    ".jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
  ];
  let company = "";
  for (const s of companySels) {
    const el = document.querySelector(s);
    if (el && el.textContent && el.textContent.trim()) {
      company = el.textContent;
      break;
    }
  }
  return { title, company };
}
