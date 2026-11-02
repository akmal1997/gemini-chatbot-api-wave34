const chatForm = document.getElementById('chat-form');
const userInput = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');

// Multi-turn conversation state for the Gemini API
const conversation = [];

// ==========================================
// 1. Dark & Light Mode Support
// ==========================================
function getInitialTheme() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) {
    return savedTheme;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Initialize theme on load
applyTheme(getInitialTheme());

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
  });
}

// ==========================================
// 2. Markdown Parsing & Sanitization
// ==========================================
function parseMarkdownToHtml(markdownText) {
  let html = '';

  // Use marked.js if available
  if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
    html = marked.parse(markdownText);
  } else {
    // Fallback lightweight parser if library is not loaded
    html = markdownText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/\n\n/g, '<p></p>')
      .replace(/\n/g, '<br/>');
  }

  // Sanitize HTML to prevent XSS attacks
  let cleanHtml = typeof DOMPurify !== 'undefined' && typeof DOMPurify.sanitize === 'function'
    ? DOMPurify.sanitize(html)
    : html;

  // Make all links open safely in a new tab
  cleanHtml = cleanHtml.replace(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');

  return cleanHtml;
}

// ==========================================
// 3. Modern Chat DOM Manipulation
// ==========================================
function getCurrentTime() {
  const now = new Date();
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function appendMessage(sender, content, isHtml = false) {
  const messageEl = document.createElement('div');
  messageEl.classList.add('message', sender);

  // Message metadata header (Sender name & timestamp)
  const metaEl = document.createElement('div');
  metaEl.classList.add('message-meta');

  const senderTag = document.createElement('span');
  senderTag.classList.add('sender-tag');
  senderTag.textContent = sender === 'user' ? 'You' : 'Kevin McCallister';

  const timeTag = document.createElement('span');
  timeTag.classList.add('time-tag');
  timeTag.textContent = getCurrentTime();

  metaEl.appendChild(senderTag);
  metaEl.appendChild(timeTag);

  // Message content bubble
  const contentEl = document.createElement('div');
  contentEl.classList.add('message-content');

  if (isHtml) {
    contentEl.innerHTML = content;
  } else {
    contentEl.textContent = content;
  }

  messageEl.appendChild(metaEl);
  messageEl.appendChild(contentEl);

  chatBox.appendChild(messageEl);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Return contentEl so we can update it in-place
  return contentEl;
}

// Creates an animated 3-dot typing indicator bubble
function appendTypingIndicator() {
  const typingHtml = `
    <div class="typing-box">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <span class="typing-label">Kevin McCallister is planning your trip...</span>
    </div>
  `;
  return appendMessage('bot', typingHtml, true);
}

// ==========================================
// 4. Form Submission Flow
// ==========================================
chatForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const message = userInput.value.trim();
  if (!message) return;

  const submitButton = document.getElementById('send-btn');

  // 1. Add user message to UI and history
  appendMessage('user', message, false);
  conversation.push({ role: 'user', text: message });

  // 2. Clear and lock input while waiting
  userInput.value = '';
  userInput.disabled = true;
  if (submitButton) submitButton.disabled = true;

  // 3. Show animated typing indicator
  const botContentElement = appendTypingIndicator();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation }),
    });

    if (!response.ok) {
      throw new Error(`Server returned status: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.result) {
      // 4. Replace typing indicator with parsed Markdown AI response
      botContentElement.innerHTML = parseMarkdownToHtml(data.result);
      conversation.push({ role: 'model', text: data.result });
    } else {
      botContentElement.textContent = 'Sorry, no response received.';
      conversation.pop(); // Keep history in sync
    }
  } catch (error) {
    console.error('Chat error:', error);
    botContentElement.textContent = 'Failed to get response from server. Please try again.';
    conversation.pop(); // Keep history in sync on error
  } finally {
    // 5. Re-enable form controls and refocus
    userInput.disabled = false;
    if (submitButton) submitButton.disabled = false;
    userInput.focus();
    chatBox.scrollTop = chatBox.scrollHeight;
  }
});
