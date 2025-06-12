// 📦 Neaspace Smart Chat Widget (Frontend)
(function () {
  const chatHtml = `
  <div id="chatbox" style="
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 320px;
    max-height: 500px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0,0,0,0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 9999;
    font-family: Arial, sans-serif;">
    <div id="chatlog" style="
      flex: 1;
      padding: 10px;
      overflow-y: auto;
      font-size: 14px;"></div>
    <div id="userinput" style="display: flex; border-top: 1px solid #eee;">
      <input type="text" id="message" placeholder="Scrivi qui..." style="
        flex: 1;
        padding: 10px;
        border: none;
        outline: none;">
      <button onclick="sendMessage()" style="
        padding: 10px 15px;
        border: none;
        background: #222;
        color: #fff;
        cursor: pointer;">➤</button>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', chatHtml);

  window.sendMessage = async function () {
    const input = document.getElementById("message");
    const msg = input.value.trim();
    if (!msg) return;
    logMessage("Tu", msg, 'user');
    input.value = "";
    try {
      const response = await fetch("https://neaspace-chatbot.onrender.com/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg })
      });
      const data = await response.json();
      if (data.status === 'ok') {
        logMessage("Neaspace", data.reply, 'bot');
      } else if (data.status === 'fallback') {
        logMessage("Neaspace", "Francesco vi risponderà al più presto. Per favore inserite la vostra email.", 'bot');
        showFallbackForm(msg);
      } else {
        logMessage("Neaspace", "Si è verificato un errore. Riprova più tardi.", 'bot');
      }
    } catch (error) {
      logMessage("Neaspace", "Errore di connessione.", 'bot');
    }
  }

  function logMessage(sender, text, type) {
    const chatlog = document.getElementById("chatlog");
    const div = document.createElement("div");
    div.className = `chat-msg chat-${type}`;
    div.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatlog.appendChild(div);
    chatlog.scrollTop = chatlog.scrollHeight;
  }

  function showFallbackForm(originalMessage) {
    const div = document.createElement("div");
    div.innerHTML = `
      <div style="margin-top: 10px;">
        <label>Email: <input type="email" id="fallbackEmail"></label><br>
        <label>Booking ID (opzionale): <input type="text" id="fallbackBooking"></label><br>
        <input type="hidden" id="originalMessage" value="${originalMessage}">
        <button onclick="submitFallback()">Invia a Francesco</button>
      </div>`;
    document.getElementById("chatlog").appendChild(div);
  }

  window.submitFallback = async function () {
    const email = document.getElementById("fallbackEmail").value;
    const booking = document.getElementById("fallbackBooking").value;
    const originalMsg = document.getElementById("originalMessage").value;
    await fetch("https://neaspace-chatbot.onrender.com/fallback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: originalMsg,
        email: email,
        bookingId: booking
      })
    });
    logMessage("Neaspace", "Grazie! Francesco riceverà il vostro messaggio.", 'bot');
  }
})();
