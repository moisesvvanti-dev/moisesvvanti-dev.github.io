// ============================================
// PS4 WebKit Exploit - Control Script
// ============================================

let timerId = null;
const label = document.getElementById('autoJbLabel');
const checkbox = document.getElementById('autoJbInput');
const jeilbrekBtn = document.getElementById('jeilbrek');
const UAElement = document.getElementById("UA");
const statusDot = document.getElementById("statusDot");
const consoleEl = document.getElementById("console");
const clearBtn = document.getElementById("clearConsole");

const storedAutoJb = localStorage.getItem("autoJb");
let autoJbValue = storedAutoJb !== null ? storedAutoJb === "true" : true;

// Choose kernel exploit
var exploitChain = localStorage.getItem("exploitChain") || "lapse";
const netctrlRadio = document.getElementById("netctrl-exploit");
const lapseRadio = document.getElementById("lapse-exploit");
const kexForm = document.getElementById('kernel-options');

// Show user agent / firmware info
const ua = navigator.userAgent;
const fwMatch = ua.match(/PlayStation 4.*?([\d.]+)/);
if (fwMatch) {
  UAElement.textContent = "FW: " + fwMatch[1];
  document.getElementById("fwVersion").textContent = fwMatch[1];
} else {
  UAElement.textContent = "FW: " + ua.substring(0, 60);
  document.getElementById("fwVersion").textContent = "Detected";
}

// Update status dot
statusDot.classList.add("active");

// Console logging
function logToConsole(msg, type) {
  if (!consoleEl) return;
  
  const timestamp = new Date().toLocaleTimeString();
  let prefix = "";
  let cls = "output";
  
  switch (type) {
    case "error": prefix = "[ERROR]"; cls = "error"; break;
    case "warn": prefix = "[WARN]"; cls = "warn"; break;
    case "info": prefix = "[INFO]"; cls = "info"; break;
    case "success": prefix = "[OK]"; cls = "success"; break;
    case "cmd": prefix = "$"; cls = "cmd"; break;
    default: prefix = "[*]"; cls = "output"; break;
  }
  
  const line = document.createElement("div");
  line.innerHTML = `<span class="prompt">${prefix}</span> <span class="${cls}">${msg}</span>`;
  consoleEl.appendChild(line);
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

// Clear console
clearBtn.addEventListener("click", function() {
  consoleEl.innerHTML = `<span class="prompt">$</span> <span class="cmd">system.clear</span>
<span class="output">Console cleared.</span>
<span class="prompt">$</span> <span class="output cursor-blink">_</span>`;
});

// Override the logger in misc.js
window.logger = {
  debug: function(msg) { logToConsole(msg, "debug"); },
  info: function(msg) { logToConsole(msg, "info"); },
  warn: function(msg) { logToConsole(msg, "warn"); },
  error: function(msg) { logToConsole(msg, "error"); },
  success: function(msg) { logToConsole(msg, "success"); }
};

// Kernel exploit selection
kexForm.addEventListener("change", function(event) {
  localStorage.setItem("exploitChain", event.target.value);
  exploitChain = event.target.value;
  logToConsole("Kernel exploit: " + event.target.value, "info");
});

// Jailbreak execution
jeilbrekBtn.addEventListener("click", function(e) {
  jeilbrekBtn.disabled = true;
  jeilbrekBtn.textContent = "EXECUTING...";
  statusDot.classList.remove("active");
  statusDot.style.background = "var(--accent-yellow)";
  stopInterval();
  logToConsole("Jailbreak sequence initiated", "cmd");
  
  // Call the exploit
  if (typeof doJb === "function") {
    doJb().catch(function(err) {
      logToConsole("Error: " + err.message, "error");
      jeilbrekBtn.disabled = false;
      jeilbrekBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg><span>RETRY JAILBREAK</span>`;
    });
  } else {
    logToConsole("Exploit not loaded yet!", "error");
    jeilbrekBtn.disabled = false;
  }
});

// Auto JB toggle
checkbox.addEventListener('change', function() {
  localStorage.setItem("autoJb", checkbox.checked);
  if (checkbox.checked == true && jeilbrekBtn.disabled == false) {
    jailbreakCountdown();
    return;
  }
  stopInterval();
});

function stopInterval() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  label.textContent = "Auto Jailbreak";
}

function jailbreakCountdown() {
  stopInterval();
  
  let countdown = 5;
  label.textContent = "Auto in: " + countdown;
  timerId = setInterval(function() {
    countdown--;
    label.textContent = "Auto in: " + countdown;
    
    if (countdown < 0) {
      jeilbrekBtn.disabled = true;
      clearInterval(timerId);
      timerId = null;
      label.textContent = "Executing";
      logToConsole("Auto jailbreak triggered", "cmd");
      if (typeof doJb === "function") {
        doJb().catch(function(err) {
          logToConsole("Error: " + err.message, "error");
          jeilbrekBtn.disabled = false;
          jeilbrekBtn.innerHTML = `<svg class="btn-icon" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clip-rule="evenodd"/></svg><span>RETRY JAILBREAK</span>`;
        });
      }
    }
  }, 1000);
}

// DOM Ready
document.addEventListener("DOMContentLoaded", function() {
  // Choose exploit chain
  if (exploitChain == "netctrl") {
    netctrlRadio.checked = true;
  } else {
    lapseRadio.checked = true;
  }
  
  // Apply autojb
  checkbox.checked = autoJbValue;
  logToConsole("PS4 WebKit Exploit loaded", "success");
  logToConsole("Firmware: " + (fwMatch ? fwMatch[1] : "unknown"), "info");
  logToConsole("Kernel: " + exploitChain, "info");
  logToConsole("Scanner: Dynamic offsets enabled", "info");
  logToConsole("Ready. Awaiting execution...", "output");
  
  if (autoJbValue) jailbreakCountdown();
  
  // Remove the blinking cursor initial
  setTimeout(function() {
    const cursor = consoleEl.querySelector(".cursor-blink");
    if (cursor) cursor.remove();
  }, 500);
});
