const dialog = document.createElement("dialog");
dialog.className = "party-code-dialog";
dialog.setAttribute("aria-labelledby", "party-code-title");
dialog.innerHTML = `
  <form method="dialog" class="party-code-shell">
    <header class="party-code-header">
      <div><p>PRIVATE MATCH</p><h2 id="party-code-title">Join a lobby</h2></div>
      <button type="button" class="party-code-close" aria-label="Close">&times;</button>
    </header>
    <label class="party-code-label" for="party-code-input">ONE-DIGIT CODE</label>
    <div class="party-code-entry">
      <input id="party-code-input" inputmode="numeric" autocomplete="one-time-code" maxlength="1" pattern="[0-9]" aria-label="One-digit lobby code">
      <button type="button" class="party-code-submit">JOIN</button>
    </div>
    <p class="party-code-message" role="status" aria-live="polite"></p>
    <div class="party-code-list-header"><h3>OPEN LOBBIES</h3><button type="button" class="party-code-refresh" aria-label="Refresh lobbies" title="Refresh lobbies">↻</button></div>
    <div class="party-code-rooms" aria-live="polite"></div>
  </form>
`;

const style = document.createElement("style");
style.textContent = `
  .party-code-dialog{width:min(440px,calc(100vw - 28px));max-height:min(80vh,680px);padding:0;border:1px solid #3b6c83;border-radius:12px;background:#081d2b;color:#eff8fc;box-shadow:0 24px 80px #0009}
  .party-code-dialog::backdrop{background:#020a10bb;backdrop-filter:blur(4px)}
  .party-code-shell{padding:24px;overflow:auto}
  .party-code-header,.party-code-list-header,.party-code-entry{display:flex;align-items:center;justify-content:space-between;gap:12px}
  .party-code-header{margin-bottom:22px}
  .party-code-header p,.party-code-list-header h3,.party-code-label{margin:0;color:#8fb4c5;font-size:11px;font-weight:800;letter-spacing:.1em}
  .party-code-header h2{margin:5px 0 0;font-size:24px}
  .party-code-close,.party-code-refresh{display:grid;place-items:center;width:36px;height:36px;padding:0;border:1px solid #31566b;border-radius:7px;background:#102b3c;color:#eff8fc;font-size:22px;cursor:pointer}
  .party-code-label{display:block;margin-bottom:8px}
  .party-code-entry input{width:72px;height:48px;border:1px solid #41677a;border-radius:7px;background:#061521;color:#fff;text-align:center;font-size:22px}
  .party-code-submit,.party-code-room button{min-height:40px;padding:0 16px;border:0;border-radius:7px;background:#d6ed58;color:#14251e;font-weight:800;cursor:pointer}
  .party-code-entry .party-code-submit{flex:1}
  .party-code-message{min-height:20px;margin:9px 0 19px;color:#ffba76;font-size:13px}
  .party-code-list-header{border-top:1px solid #254052;padding-top:16px}
  .party-code-list-header h3{color:#d8e8ef}
  .party-code-rooms{display:grid;gap:8px;max-height:250px;overflow:auto;margin-top:12px}
  .party-code-room{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #244253;border-radius:7px;background:#0d2635}
  .party-code-room strong{font-size:20px;letter-spacing:.08em}
  .party-code-room button{min-height:34px;padding:0 14px}
  .party-code-empty{margin:0;padding:16px 0;color:#9eb4bf;font-size:13px}
  @media(max-width:480px){.party-code-shell{padding:18px}.party-code-header h2{font-size:21px}}
`;

const codeInput = dialog.querySelector("#party-code-input");
const message = dialog.querySelector(".party-code-message");
const roomsElement = dialog.querySelector(".party-code-rooms");
const joinButton = dialog.querySelector(".party-code-submit");
let loadingRooms = false;

function join(code) {
  if (!/^\d$/.test(code)) {
    message.textContent = "Enter a single digit from 0 to 9.";
    codeInput.focus();
    return;
  }
  dialog.close();
  window.dispatchEvent(new CustomEvent("turball:join-party-code", { detail: code }));
}

async function loadRooms() {
  if (loadingRooms) return;
  loadingRooms = true;
  roomsElement.innerHTML = '<p class="party-code-empty">Loading open lobbies…</p>';
  dialog.querySelector(".party-code-refresh").disabled = true;
  try {
    const response = await fetch("/api/party-codes", { credentials: "same-origin", cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Unable to load lobbies.");
    const servers = Array.isArray(data.servers) ? data.servers.filter(code => /^\d$/.test(code)).sort() : [];
    roomsElement.replaceChildren();
    if (!servers.length) {
      roomsElement.innerHTML = '<p class="party-code-empty">No open lobbies right now.</p>';
      return;
    }
    for (const code of servers) {
      const row = document.createElement("div");
      row.className = "party-code-room";
      const label = document.createElement("strong");
      label.textContent = `LOBBY ${code}`;
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "JOIN";
      button.addEventListener("click", () => join(code));
      row.append(label, button);
      roomsElement.append(row);
    }
  } catch (error) {
    roomsElement.innerHTML = '<p class="party-code-empty">Could not load open lobbies.</p>';
    message.textContent = error.message || "Unable to load lobbies.";
  } finally {
    loadingRooms = false;
    dialog.querySelector(".party-code-refresh").disabled = false;
  }
}

codeInput.addEventListener("input", () => {
  codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 1);
  message.textContent = "";
});
joinButton.addEventListener("click", () => join(codeInput.value.trim()));
codeInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    join(codeInput.value.trim());
  }
});
dialog.querySelector(".party-code-close").addEventListener("click", () => dialog.close());
dialog.querySelector(".party-code-refresh").addEventListener("click", loadRooms);
dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});
window.addEventListener("turball:show-party-code-dialog", () => {
  message.textContent = "";
  codeInput.value = "";
  dialog.showModal();
  void loadRooms();
  codeInput.focus();
});

document.head.append(style);
document.body.append(dialog);