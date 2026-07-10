// popup.js — Popup UI controller

let state = {
  globalEnabled: true,
  activeProfileId: null,
  profiles: [],
};

let activeTab = "requestHeader";

// ── Helpers ──────────────────────────────────────────────────

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function generateRuleId() {
  return Date.now() + Math.floor(Math.random() * 1000);
}

function saveState() {
  chrome.storage.local.set({
    globalEnabled: state.globalEnabled,
    activeProfileId: state.activeProfileId,
    profiles: state.profiles,
  });
}

function getActiveProfile() {
  return state.profiles.find((p) => p.id === state.activeProfileId) || null;
}

// ── Render ────────────────────────────────────────────────────

function renderProfileSelect() {
  const select = document.getElementById("profileSelect");
  select.innerHTML = "";
  for (const profile of state.profiles) {
    const opt = document.createElement("option");
    opt.value = profile.id;
    opt.textContent = profile.name;
    if (profile.id === state.activeProfileId) opt.selected = true;
    select.appendChild(opt);
  }
}

function renderProfileToggle() {
  const toggle = document.getElementById("profileToggle");
  const profile = getActiveProfile();
  toggle.checked = profile ? profile.enabled : false;
  // Style the toggle track to use profile-bar background
  const track = toggle.nextElementSibling;
  track.style.background = profile && profile.enabled ? "" : "rgba(0,0,0,0.18)";
}

function renderRules() {
  const list = document.getElementById("rulesList");
  list.innerHTML = "";
  const profile = getActiveProfile();

  if (!profile) {
    list.innerHTML = '<div class="empty-state">No profile selected.</div>';
    return;
  }

  const filtered = profile.rules.filter((r) => r.type === activeTab);

  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state">No rules yet. Click "+ Add Rule" to create one.</div>';
    return;
  }

  for (const rule of filtered) {
    const row = createRuleRow(rule);
    list.appendChild(row);
  }
}

function createRuleRow(rule) {
  const isRedirect = rule.type === "redirect";
  const templateId = isRedirect ? "redirectRuleTemplate" : "headerRuleTemplate";
  const template = document.getElementById(templateId);
  const clone = template.content.cloneNode(true);
  const row = clone.querySelector(".rule-row");

  row.dataset.id = rule.id;
  if (!rule.enabled) row.classList.add("disabled-rule");

  const toggle = row.querySelector(".rule-toggle");
  toggle.checked = rule.enabled;
  toggle.addEventListener("change", () => {
    updateRule(rule.id, { enabled: toggle.checked });
    row.classList.toggle("disabled-rule", !toggle.checked);
  });

  if (!isRedirect) {
    const actionSel = row.querySelector(".rule-action");
    actionSel.value = rule.action || "set";
    actionSel.addEventListener("change", () => updateRule(rule.id, { action: actionSel.value }));

    const nameInput = row.querySelector(".rule-name");
    nameInput.value = rule.name || "";
    nameInput.addEventListener("change", () => updateRule(rule.id, { name: nameInput.value }));

    const valueInput = row.querySelector(".rule-value");
    valueInput.value = rule.value || "";
    valueInput.addEventListener("change", () => updateRule(rule.id, { value: valueInput.value }));

    // Show/hide value when action is "remove"
    const toggleValueVisibility = () => {
      valueInput.style.display = actionSel.value === "remove" ? "none" : "";
    };
    toggleValueVisibility();
    actionSel.addEventListener("change", toggleValueVisibility);
  }

  const urlInput = row.querySelector(".rule-url");
  urlInput.value = rule.urlFilter || "";
  urlInput.addEventListener("change", () => updateRule(rule.id, { urlFilter: urlInput.value }));

  if (isRedirect) {
    const redirectInput = row.querySelector(".rule-redirect-url");
    redirectInput.value = rule.redirectUrl || "";
    redirectInput.addEventListener("change", () => updateRule(rule.id, { redirectUrl: redirectInput.value }));
  }

  const deleteBtn = row.querySelector(".rule-delete");
  deleteBtn.addEventListener("click", () => deleteRule(rule.id));

  return row;
}

function render() {
  // Global toggle
  const globalToggle = document.getElementById("globalToggle");
  globalToggle.checked = state.globalEnabled;

  renderProfileSelect();
  renderProfileToggle();
  renderRules();
}

// ── Rule operations ───────────────────────────────────────────

function updateRule(ruleId, changes) {
  const profile = getActiveProfile();
  if (!profile) return;
  const rule = profile.rules.find((r) => r.id === ruleId);
  if (!rule) return;
  Object.assign(rule, changes);
  saveState();
}

function deleteRule(ruleId) {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.rules = profile.rules.filter((r) => r.id !== ruleId);
  saveState();
  renderRules();
}

function addRule() {
  const profile = getActiveProfile();
  if (!profile) return;

  const baseRule = {
    id: generateRuleId(),
    enabled: true,
    type: activeTab,
    urlFilter: "",
  };

  if (activeTab === "redirect") {
    baseRule.redirectUrl = "";
  } else {
    baseRule.action = "set";
    baseRule.name = "";
    baseRule.value = "";
  }

  profile.rules.push(baseRule);
  saveState();
  renderRules();
}

// ── Profile operations ────────────────────────────────────────

function createProfile(name) {
  const profile = {
    id: generateId(),
    name: name.trim(),
    enabled: true,
    rules: [],
  };
  state.profiles.push(profile);
  state.activeProfileId = profile.id;
  saveState();
  render();
}

function renameProfile(newName) {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.name = newName.trim();
  saveState();
  renderProfileSelect();
}

function deleteProfile() {
  if (state.profiles.length <= 1) {
    alert("You must have at least one profile.");
    return;
  }
  const idx = state.profiles.findIndex((p) => p.id === state.activeProfileId);
  state.profiles.splice(idx, 1);
  state.activeProfileId = state.profiles[Math.max(0, idx - 1)].id;
  saveState();
  render();
}

// ── Event listeners ───────────────────────────────────────────

document.getElementById("globalToggle").addEventListener("change", (e) => {
  state.globalEnabled = e.target.checked;
  saveState();
});

document.getElementById("profileSelect").addEventListener("change", (e) => {
  state.activeProfileId = e.target.value;
  saveState();
  renderProfileToggle();
  renderRules();
});

document.getElementById("profileToggle").addEventListener("change", (e) => {
  const profile = getActiveProfile();
  if (!profile) return;
  profile.enabled = e.target.checked;
  saveState();
  renderProfileToggle();
});

document.getElementById("newProfileBtn").addEventListener("click", () => {
  const name = prompt("Profile name:", "New Profile");
  if (name && name.trim()) createProfile(name);
});

document.getElementById("renameProfileBtn").addEventListener("click", () => {
  const profile = getActiveProfile();
  if (!profile) return;
  const name = prompt("Rename profile:", profile.name);
  if (name && name.trim()) renameProfile(name);
});

document.getElementById("deleteProfileBtn").addEventListener("click", () => {
  const profile = getActiveProfile();
  if (!profile) return;
  if (confirm(`Delete profile "${profile.name}"?`)) deleteProfile();
});

document.getElementById("addRuleBtn").addEventListener("click", addRule);

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderRules();
  });
});

// ── Bootstrap ─────────────────────────────────────────────────

chrome.storage.local.get(["globalEnabled", "activeProfileId", "profiles"], (data) => {
  state.globalEnabled = data.globalEnabled !== undefined ? data.globalEnabled : true;
  state.profiles = data.profiles || [];
  state.activeProfileId = data.activeProfileId || null;

  // First run: create a default profile
  if (state.profiles.length === 0) {
    const defaultProfile = {
      id: generateId(),
      name: "Default",
      enabled: true,
      rules: [],
    };
    state.profiles.push(defaultProfile);
    state.activeProfileId = defaultProfile.id;
    saveState();
  }

  if (!state.activeProfileId || !state.profiles.find((p) => p.id === state.activeProfileId)) {
    state.activeProfileId = state.profiles[0].id;
    saveState();
  }

  render();
});
