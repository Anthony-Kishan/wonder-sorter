let selectedFolder = null;
let processing = false;

function adjustScroll() {
  const list = document.getElementById("results-list");
  list.scrollTop = list.scrollHeight;
  // console.log("Adjusted scroll.");
}

function goToSettings() {
  // console.log("Navigating to Settings view...");
  if (window.pywebview) {
    window.pywebview.api.load_view("settings");
  } else {
    console.warn("pywebview not available.");
  }
}

function goToAbout() {
  // console.log("Navigating to About view...");
  if (window.pywebview) {
    window.pywebview.api.load_view("about");
  } else {
    console.warn("pywebview not available.");
  }
}

async function fetchSettingsFromBackend() {
  // console.log("Fetching settings from backend...");
  try {
    const res = await window.pywebview.api.load_settings();
    // console.log("Settings response:", res);
    if (res.success && res.settings) {
      return res.settings;
    } else {
      throw new Error("Failed to load settings");
    }
  } catch (e) {
    console.error("Error loading settings from backend:", e);
    return {
      sim_threshold: 0.62,
      resize_scale: 0.5,
      min_cluster_size: 2
    };
  }
}

document.getElementById("select-folder").onclick = async () => {
  // console.log("Select folder button clicked.");
  const path = await window.pywebview.api.choose_folder();
  // console.log("Folder selected:", path);
  if (path) {
    selectedFolder = path[0];
    // console.log("Using folder:", selectedFolder);
    document.getElementById("folder-label").innerText = selectedFolder;
    document.getElementById("selected-path").innerText = `Selected: ${selectedFolder}`;
    document.getElementById("selected-path").hidden = false;
    document.getElementById("start-btn").disabled = false;
  } else {
    console.warn("No folder selected.");
  }
};

document.getElementById("start-btn").onclick = async () => {
  if (!selectedFolder || processing) {
    console.warn("Start button clicked but either folder is not selected or already processing.");
    return;
  }

  processing = true;
  // console.log("Start button clicked.");
  // console.log("Selected folder:", selectedFolder);
  // console.log("Processing state:", processing);

  const startBtn = document.getElementById("start-btn");
  startBtn.disabled = true;
  startBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-small white-color spin">
    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
  </svg> <span>Processing...</span>`;

  document.getElementById("cancel-btn").style.display = 'block';
  document.getElementById("progress-section").style.display = 'block';

  const ghostButtons = document.getElementsByClassName("ghost-button");
  // console.log("Disabling ghost buttons...");
  for (let i = 0; i < ghostButtons.length; i++) {
    ghostButtons[i].disabled = true;
  }

  clearResults();

  try {
    const settings = await fetchSettingsFromBackend();
    // console.log("Starting sorting with settings:", settings);
    await window.pywebview.api.start_sorting(selectedFolder, settings);
    // console.log("start_sorting call completed.");
  } catch (e) {
    // console.log("Failed to start sorting:", e);
    processing = false;
    resetStartButton();
  }
};

document.getElementById("cancel-btn").onclick = async () => {
  // console.log("Cancel button clicked.");
  await window.pywebview.api.cancel_sorting();
  // console.log("Cancel request sent to backend.");
  document.getElementById("cancel-btn").hidden = true;
  document.getElementById("start-btn").disabled = false;

  const ghostButtons = document.getElementsByClassName("ghost-button");
  for (let i = 0; i < ghostButtons.length; i++) {
    ghostButtons[i].disabled = false;
  }

  resetStartButton();
  processing = false;
  // console.log("Cancelled processing.");
};

document.getElementById("reset-cache").onclick = async () => {
  // console.log("Reset cache button clicked.");
  await window.pywebview.api.clear_cache();
  // console.log("Cache cleared.");
  resetUI();
};

function updateLog(entry, statusType, personId = null) {
  // console.log("updateLog called with:", entry, statusType, personId);
  const list = document.getElementById("results-list");
  const el = document.createElement("div");
  el.className = "result-item";

  const left = document.createElement("div");
  left.className = "result-left";
  const icon = document.createElement("img");
  icon.classList.add("status-icon");
  const file = document.createElement("span");
  const badge = document.createElement("span");
  badge.className = "result-badge";

  file.innerText = entry;

  switch (statusType) {
    case "success":
      icon.src = "icons/User.svg";
      icon.classList.remove("spin");
      badge.classList.add("badge-person");
      badge.innerText = personId;
      break;
    case "no_face":
      icon.src = "icons/UserX.svg";
      icon.classList.remove("spin");
      badge.classList.add("badge-noface");
      badge.innerText = "No face detected";
      break;
    case "group_photo":
      icon.src = "icons/UsersGroup.svg";
      icon.classList.remove("spin");
      badge.classList.add("badge-group");
      badge.innerText = "Group photo detected";
      break;
    case "read_error":
    case "error":
      icon.src = "icons/XCircle.svg";
      icon.classList.remove("spin");
      badge.classList.add("badge-error");
      badge.innerText = "Error";
      break;
    case "cancelled":
      icon.src = "icons/XCircle.svg";
      icon.classList.remove("spin");
      badge.classList.add("badge-error");
      badge.innerText = "Cancelled";
      break;
    case "done":
      // console.log("Log update done signal received.");
      return;
    default:
      icon.src = "icons/Loader2.svg";
      icon.classList.add("spin");
      badge.classList.add("badge-processing");
      badge.innerText = "Processing...";
  }

  left.append(icon, file);
  el.append(left, badge);
  list.appendChild(el);
  adjustScroll();

  document.getElementById("file-count").innerText = `${list.children.length} files`;
  if (list.children.length > 0) {
    document.getElementById("results-card").style.display = 'block';
  }
}

function updateProgress(pct) {
  // console.log("Progress updated:", pct + "%");
  document.getElementById("progress-fill").style.width = pct + "%";
  document.getElementById("progress-percent").innerText = pct + "%";
}

async function onFinish() {
  // console.log("onFinish called.");
  processing = false;
  document.getElementById("cancel-btn").style.display = 'none';
  document.getElementById("start-btn").disabled = false;
  resetStartButton();

  const ghostButtons = document.getElementsByClassName("ghost-button");
  for (let i = 0; i < ghostButtons.length; i++) {
    ghostButtons[i].disabled = false;
  }

  try {
    await window.pywebview.api.open_output_folder();
    // console.log("Opened output folder.");
  } catch (err) {
    console.error("Failed to open output folder:", err);
  }
}

function clearResults() {
  // console.log("Clearing results list.");
  document.getElementById("results-list").innerHTML = "";
  document.getElementById("file-count").innerText = "0 files";
  document.getElementById("results-card").style.display = 'none';
}

function resetUI() {
  // console.log("Resetting UI...");
  selectedFolder = null;
  document.getElementById("folder-label").innerText = "Select Images Folder";
  document.getElementById("selected-path").hidden = true;
  document.getElementById("start-btn").disabled = true;
  document.getElementById("cancel-btn").style.display = 'none';
  document.getElementById("progress-section").style.display = 'none';

  const ghostButtons = document.getElementsByClassName("ghost-button");
  for (let i = 0; i < ghostButtons.length; i++) {
    ghostButtons[i].disabled = false;
  }

  clearResults();
  resetStartButton();
}

function resetStartButton() {
  // console.log("Resetting Start button UI.");
  const btn = document.getElementById("start-btn");
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-small white-color"><polygon points="6,3 20,12 6,21" /></svg> <span>Start Sorting</span>`;
}
