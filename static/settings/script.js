const defaults = {
  sim_threshold: 0.62,
  resize_scale: 0.5,
  min_cluster_size: 2,
};

const settings = { ...defaults };
let hasChanges = false;

function $(id) {
  return document.getElementById(id);
}

function goToMain() {
  if (window.pywebview) {
    window.pywebview.api.load_view("main");
  }
}

const settingsInputMap = {
  sim_threshold: "sim-threshold-input",
  resize_scale: "resize-scale",
  min_cluster_size: "min-cluster-size",
};


const badgeInfo = {
  sim_threshold: [
    { max: 0.25, label: "Very Loose", className: "badge-green" },
    { max: 0.55, label: "Loose", className: "badge-blue" },
    { max: 0.65, label: "Balanced", className: "badge-green" },
    { max: 0.75, label: "Strict", className: "badge-orange" },
    { max: 1.01, label: "Very Strict", className: "badge-red" },
  ],
  resize_scale: [
    { max: 0.25, label: "Fastest", className: "badge-red" },
    { max: 0.45, label: "Fast", className: "badge-orange" },
    { max: 0.65, label: "Balanced", className: "badge-green" },
    { max: 0.85, label: "High Quality", className: "badge-blue" },
    { max: 1.01, label: "Max Quality", className: "badge-purple" },
  ],
  min_cluster_size: [
    { max: 2, label: "Include All", className: "badge-green" },
    { max: 8, label: "Exclude Rare", className: "badge-blue" },
    { max: 20, label: "Frequent Only", className: "badge-red" },
  ],
};

function updateBadge(setting, value) {
  const badgeId = {
    sim_threshold: "sim-threshold-badge",
    resize_scale: "resize-scale-badge",
    min_cluster_size: "min-cluster-badge",
  }[setting];

  const badgeEl = document.getElementById(badgeId);
  if (!badgeEl) return;

  const match = badgeInfo[setting].find(i => value <= i.max);
  if (match) {
    badgeEl.textContent = match.label;
    badgeEl.className = "badge " + match.className;
  }
}

function markChanged() {
  hasChanges = true;
  $("unsaved-warning").style.display = "block";
}

function syncInputs(key, value) {
  settings[key] = value;
  markChanged();
  updateBadge(key, value);
}

function resetDefaults() {
  try {
    applySettingsToUI(defaults);
    showToast("✅ Settings reset to defaults.", "success");
  } catch (err) {
    console.error("Failed to reset settings:", err);
    showToast("❌ Could not reset settings.", "error");
  }
}

async function saveSettings() {
  try {
    for (const [key, inputId] of Object.entries(settingsInputMap)) {
      const input = document.getElementById(inputId);
      if (input) {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
          settings[key] = val;
        }
      }
    }

    const result = await window.pywebview.api.save_settings(settings);
    hasChanges = false;
    $("unsaved-warning").style.display = "none";

    if (result.success) {
      showToast("✅ " + result.message, "success");
    } else {
      showToast("❌ " + result.message, "error");
    }
  } catch (err) {
    showToast("❌ Failed to save settings: " + err.message, "error");
  }
}


function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  document.body.appendChild(toast);

  // Force reflow to allow transition
  void toast.offsetWidth;
  toast.classList.add("show");

  // Hide after 2.5s, then remove after fade-out
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 400); // Match the transition duration
  }, 2500);
}



// Custom slider initialization
function initCustomSliders() {
  document.querySelectorAll(".custom-slider").forEach(slider => {
    const track = slider.querySelector(".slider-track");
    const range = slider.querySelector(".slider-range");
    const thumb = slider.querySelector(".slider-thumb");
    const input = slider.parentElement.querySelector("input[type='number']");
    const setting = slider.dataset.setting;
    const min = parseFloat(slider.dataset.min);
    const max = parseFloat(slider.dataset.max);
    const step = parseFloat(slider.dataset.step);

    function clamp(val) {
      return Math.min(max, Math.max(min, val));
    }

    function valueToPercent(val) {
      return ((val - min) / (max - min)) * 100;
    }

    function percentToValue(pct) {
      return Math.round((min + pct * (max - min)) / step) * step;
    }

    function updateUI(val) {
      const pct = valueToPercent(val);
      range.style.width = pct + "%";
      thumb.style.left = pct + "%";
      input.value = step < 1 ? val.toFixed(2) : val.toFixed(0);
    }

    function applyValue(val) {
      val = clamp(val);
      updateUI(val);
      syncInputs(setting, val);
    }

    input.addEventListener("input", e => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) applyValue(val);
    });

    track.addEventListener("click", e => {
      const rect = track.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      applyValue(percentToValue(pct));
    });

    let dragging = false;
    thumb.addEventListener("mousedown", e => {
      dragging = true;
      e.preventDefault();
    });
    document.addEventListener("mouseup", () => dragging = false);
    document.addEventListener("mousemove", e => {
      if (!dragging) return;
      const rect = track.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.min(1, Math.max(0, pct));
      applyValue(percentToValue(pct));
    });

    thumb.addEventListener("keydown", e => {
      let val = parseFloat(input.value) || min;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
        e.preventDefault();
        applyValue(val - step);
      } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
        e.preventDefault();
        applyValue(val + step);
      }
    });

    const initialValue = settings[setting];
    if (initialValue !== undefined) {
      applyValue(initialValue);
    }
  });
}

function applySettingsToUI(settingsObj) {
  for (const [key, val] of Object.entries(settingsObj)) {
    settings[key] = val;

    const inputId = settingsInputMap[key];
    if (!inputId) continue;

    const input = document.getElementById(inputId);
    if (input) {
      input.value = val;
    }

    const slider = document.querySelector(`.custom-slider[data-setting="${key}"]`);
    if (slider) {
      const range = slider.querySelector(".slider-range");
      const thumb = slider.querySelector(".slider-thumb");
      const min = parseFloat(slider.dataset.min);
      const max = parseFloat(slider.dataset.max);
      const pct = ((val - min) / (max - min)) * 100;
      range.style.width = pct + "%";
      thumb.style.left = pct + "%";
    }

    updateBadge(key, val);
  }

  $("unsaved-warning").style.display = "none";
  hasChanges = false;
}


function updateSliderVisuals() {
  document.querySelectorAll(".custom-slider").forEach(slider => {
    const setting = slider.dataset.setting;
    const input = slider.parentElement.querySelector("input[type='number']");
    const val = parseFloat(input.value);
    if (!isNaN(val)) {
      updateBadge(setting, val); // updates badge
      // re-position slider thumb & range
      const track = slider.querySelector(".slider-track");
      const range = slider.querySelector(".slider-range");
      const thumb = slider.querySelector(".slider-thumb");
      const min = parseFloat(slider.dataset.min);
      const max = parseFloat(slider.dataset.max);
      const pct = ((val - min) / (max - min)) * 100;
      range.style.width = pct + "%";
      thumb.style.left = pct + "%";
    }
  });
}

window.addEventListener('pywebviewready', async () => {
  try {
    const res = await window.pywebview.api.load_settings();
    if (res.success && res.settings) {
      applySettingsToUI(res.settings);
      Object.entries(res.settings).forEach(([key, val]) => {
        settings[key] = val; // update internal settings object
      });
    } else {
      showToast("⚠️ Failed to load settings", "error");
    }
  } catch (err) {
    console.error("Error loading settings:", err);
    showToast("⚠️ Error loading settings", "error");
  }

  initCustomSliders();
  Object.entries(settings).forEach(([key, val]) => updateBadge(key, val));
});
