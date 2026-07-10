// background.js — Service Worker
// Reads the active profile from storage and applies its rules via declarativeNetRequest.

const MAX_RULES = 1000;

async function getStorage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["activeProfileId", "profiles", "globalEnabled"], resolve);
  });
}

function buildDNRRules(profile) {
  const rules = [];
  let dnrId = 1;

  for (const rule of profile.rules) {
    if (!rule.enabled) continue;

    const rawFilter = rule.urlFilter && rule.urlFilter.trim() !== "" ? rule.urlFilter.trim() : null;
    const condition = rawFilter ? { urlFilter: rawFilter } : { urlFilter: "*" };
    // "*" is not valid in DNR urlFilter — use resourceTypes omission to match all
    if (condition.urlFilter === "*") delete condition.urlFilter;

    if (rule.type === "requestHeader") {
      if (!rule.name || rule.name.trim() === "") continue;
      const headerOp =
        rule.action === "remove"
          ? { operation: "remove", header: rule.name.trim() }
          : { operation: "set", header: rule.name.trim(), value: rule.value || "" };

      rules.push({
        id: dnrId++,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [headerOp],
        },
        condition,
      });
    } else if (rule.type === "responseHeader") {
      if (!rule.name || rule.name.trim() === "") continue;
      const headerOp =
        rule.action === "remove"
          ? { operation: "remove", header: rule.name.trim() }
          : { operation: "set", header: rule.name.trim(), value: rule.value || "" };

      rules.push({
        id: dnrId++,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [headerOp],
        },
        condition,
      });
    } else if (rule.type === "redirect") {
      if (!rule.redirectUrl || rule.redirectUrl.trim() === "") continue;
      rules.push({
        id: dnrId++,
        priority: 1,
        action: {
          type: "redirect",
          redirect: { url: rule.redirectUrl.trim() },
        },
        condition,
      });
    }

    if (dnrId > MAX_RULES) break;
  }

  return rules;
}

async function applyRules() {
  const { activeProfileId, profiles = [], globalEnabled = true } = await getStorage();

  // Remove all existing dynamic rules first
  const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
  const removeIds = existingRules.map((r) => r.id);

  if (!globalEnabled || !activeProfileId) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    updateBadge(0, false);
    return;
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId);
  if (!activeProfile || !activeProfile.enabled) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules: [] });
    updateBadge(0, false);
    return;
  }

  const addRules = buildDNRRules(activeProfile);
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: removeIds, addRules });
    console.log("[ModHeader] Applied rules:", JSON.stringify(addRules, null, 2));
  } catch (err) {
    console.error("[ModHeader] Failed to apply rules:", err, JSON.stringify(addRules, null, 2));
  }

  const activeCount = activeProfile.rules.filter((r) => r.enabled).length;
  updateBadge(activeCount, globalEnabled);
}

function updateBadge(count, globalEnabled) {
  if (!globalEnabled || count === 0) {
    chrome.action.setBadgeText({ text: "" });
    return;
  }
  chrome.action.setBadgeText({ text: String(count) });
  chrome.action.setBadgeBackgroundColor({ color: "#0066CC" });
}

// Listen for storage changes and re-apply rules
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    applyRules();
  }
});

// Apply on startup/install
chrome.runtime.onInstalled.addListener(applyRules);
chrome.runtime.onStartup.addListener(applyRules);
