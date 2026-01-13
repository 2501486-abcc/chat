const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 3000 });

let waitQueue = [];
let promptGeneration = 0;

function isOpen(ws) {
  return ws && ws.readyState === WebSocket.OPEN;
}

function sendJSON(ws, payload) {
  if (!isOpen(ws)) return;
  ws.send(JSON.stringify(payload));
}

function setStatus(ws, state) {
  sendJSON(ws, { type: "status", state });
}

function pair(a, b) {
  if (!a || !b) return;
  if (!isOpen(a) || !isOpen(b)) return;
  if (a === b) return;

  // Detach any stale links.
  a.partner = null;
  b.partner = null;

  a.partner = b;
  b.partner = a;

  // Clear any pending rematch choices.
  a.rematchChoice = null;
  b.rematchChoice = null;
  a.promptGen = null;
  b.promptGen = null;

  setStatus(a, "connected");
  setStatus(b, "connected");
}

function removeFromQueue(ws) {
  if (!ws) return;
  waitQueue = waitQueue.filter((x) => x !== ws);
}

function cleanupQueue() {
  waitQueue = waitQueue.filter((ws) => isOpen(ws) && !ws.partner);
}

function enqueue(ws) {
  if (!ws) return;
  if (!isOpen(ws)) return;
  if (ws.partner) return;

  cleanupQueue();
  removeFromQueue(ws);
  waitQueue.push(ws);
  setStatus(ws, "waiting");

  maybePromptActiveChats();
  matchFromQueue();
}

function matchFromQueue() {
  cleanupQueue();
  while (waitQueue.length >= 2) {
    const a = waitQueue.shift();
    const b = waitQueue.shift();
    if (!isOpen(a) || !isOpen(b) || a === b) {
      if (isOpen(a) && a !== b) enqueue(a);
      if (isOpen(b) && a !== b) enqueue(b);
      continue;
    }
    pair(a, b);
  }
}

function activePairs() {
  const seen = new Set();
  const pairs = [];
  for (const ws of wss.clients) {
    if (!isOpen(ws)) continue;
    if (!ws.partner || !isOpen(ws.partner)) continue;
    const a = ws;
    const b = ws.partner;
    if (seen.has(a) || seen.has(b)) continue;
    seen.add(a);
    seen.add(b);
    pairs.push([a, b]);
  }
  return pairs;
}

function maybePromptActiveChats() {
  cleanupQueue();
  if (waitQueue.length === 0) return;

  // Only prompt once when queue transitions empty -> non-empty.
  // We detect this by bumping a generation counter when first waiter arrives.
  // If multiple join while still non-empty, we don't re-prompt.
  const shouldBump = waitQueue.length === 1;
  if (shouldBump) promptGeneration += 1;

  const pairs = activePairs();
  if (!pairs.length) return;

  for (const [a, b] of pairs) {
    if (a.promptGen === promptGeneration || b.promptGen === promptGeneration) continue;
    a.promptGen = promptGeneration;
    b.promptGen = promptGeneration;
    a.rematchChoice = null;
    b.rematchChoice = null;

    const payload = { type: "rematch_prompt", waitingCount: waitQueue.length };
    sendJSON(a, payload);
    sendJSON(b, payload);
  }
}

function endConversation(a, b, reasonForA, reasonForB) {
  if (a && a.partner === b) a.partner = null;
  if (b && b.partner === a) b.partner = null;

  if (isOpen(a)) {
    a.rematchChoice = null;
    a.promptGen = null;
    sendJSON(a, { type: "conversation_end", reason: reasonForA });
  }
  if (isOpen(b)) {
    b.rematchChoice = null;
    b.promptGen = null;
    sendJSON(b, { type: "conversation_end", reason: reasonForB });
  }

  if (isOpen(a)) enqueue(a);
  if (isOpen(b)) enqueue(b);
}

function handleRematchChoice(ws, choice) {
  if (!ws || !ws.partner) return;
  const partner = ws.partner;
  if (!isOpen(partner)) return;

  if (choice !== 'keep' && choice !== 'rematch') return;
  ws.rematchChoice = choice;

  // If either chooses rematch, end immediately.
  if (ws.rematchChoice === 'rematch') {
    endConversation(ws, partner, 'you_chose_rematch', 'partner_chose_rematch');
    return;
  }
  if (partner.rematchChoice === 'rematch') {
    endConversation(ws, partner, 'partner_chose_rematch', 'you_chose_rematch');
    return;
  }

  // Both chose keep.
  if (ws.rematchChoice === 'keep' && partner.rematchChoice === 'keep') {
    ws.rematchChoice = null;
    partner.rematchChoice = null;
    sendJSON(ws, { type: 'rematch_result', result: 'stay' });
    sendJSON(partner, { type: 'rematch_result', result: 'stay' });
    return;
  }

  // Otherwise, wait for the other user's decision.
  sendJSON(ws, { type: 'rematch_pending' });
}

wss.on("connection", ws => {
  console.log("🔌 新しい接続");

  // 初期状態：待機
  //statusをフロント側に送る
  ws.send(JSON.stringify({
    type: "status",
    state: "waiting"
  }));

  // マッチング
  if (waitingUser) {
    console.log("🤝 ペア成立");

    ws.partner = waitingUser;
    waitingUser.partner = ws;

    ws.send(JSON.stringify({
      type: "status",
      state: "connected"
    }));

    waitingUser.send(JSON.stringify({
      type: "status",
      state: "connected"
    }));

    waitingUser = null;
  } else {
    console.log("⏳ 待機中のユーザーとして登録");
    waitingUser = ws;
  }

  // メッセージ受信
  ws.on("message", msg => {
    const raw = msg.toString();

    // Client control messages are JSON.
    if (raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.type === 'rematch_choice') {
          handleRematchChoice(ws, String(parsed.choice || ''));
          return;
        }
      } catch (_) {
        // fall through to treat as a normal chat message
      }
    }

    if (ws.partner && isOpen(ws.partner)) {
      ws.partner.send(raw);
    }
  });

  // 切断
  ws.on("close", () => {
    console.log("❌ 接続切断");

    if (waitingUser === ws) {
      waitingUser = null;
    }

    if (ws.partner) {
      ws.partner.partner = null;
      ws.partner.send(JSON.stringify({
        type: "status",
        state: "disconnected"
      }));
    }
  });

  ws.on("error", err => {
    console.error("WebSocket error:", err);
  });
});

// Periodically check if any active chats should be prompted.
setInterval(maybePromptActiveChats, 5000);
