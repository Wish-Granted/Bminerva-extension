const BACKEND_URL = "http://10.16.216.26:8000";
const WANTED = ["MRHSession", "ASP.NET_SessionId"];

const usernameInput = document.getElementById("username");
const button = document.getElementById("connect");
const statusEl = document.getElementById("status");

chrome.storage.local.get("username").then(({ username }) => {
  if (username) usernameInput.value = username;
});

function setStatus(message, cls = "") {
  statusEl.textContent = message;
  statusEl.className = cls;
}

button.addEventListener("click", async () => {
  const username = usernameInput.value.trim();
  if (!username) return setStatus("Enter your username first.", "error");

  button.disabled = true;
  setStatus("Connecting...");

  try {
    // cookies the browser would actually send to eMinerva (includes parent-domain cookies)
    const all = await chrome.cookies.getAll({ domain: "eminerva.bne.catholic.edu.au" });

    const cookies = all
      .filter((c) => WANTED.includes(c.name))
      .map((c) => ({ name: c.name, value: c.value, domain: c.domain, path: c.path }));

    if (!cookies.some((c) => c.name === "MRHSession")) {
      return setStatus("Not logged in to eMinerva. Log in (including 2FA) in this browser first.", "error");
    }

    const resp = await fetch(`${BACKEND_URL}/api/auth/extension-handoff`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookies, username }),
    });

    if (resp.status === 401) {
      return setStatus("Your eMinerva session has expired. Log in to eMinerva again, then retry.", "error");
    }
    if (!resp.ok) return setStatus(`Backend error (HTTP ${resp.status}).`, "error");

    const { token } = await resp.json();
    await chrome.storage.local.set({ username });
    await chrome.tabs.create({ url: `${BACKEND_URL}/api/auth/claim?token=${encodeURIComponent(token)}` });
    window.close();
  } catch (err) {
    setStatus("Couldn't reach BMinerva. Is the server running?", "error");
    console.error(err);
  } finally {
    button.disabled = false;
  }
});