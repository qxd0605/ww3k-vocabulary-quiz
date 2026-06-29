const books = window.WORD_DATA || [];
const sessions = new Map();

const elements = {
  tabs: document.querySelector("#book-tabs"),
  mode: document.querySelector("#mode-label"),
  bookTitle: document.querySelector("#book-title"),
  progressText: document.querySelector("#progress-text"),
  progressFill: document.querySelector("#progress-fill"),
  correctCount: document.querySelector("#correct-count"),
  remainingCount: document.querySelector("#remaining-count"),
  quiz: document.querySelector("#quiz-panel"),
  finish: document.querySelector("#finish-panel"),
  finishSummary: document.querySelector("#finish-summary"),
  questionLabel: document.querySelector("#question-label"),
  question: document.querySelector("#question"),
  sound: document.querySelector("#sound-button"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  restart: document.querySelector("#restart-button"),
};

let activeBookId = books[0]?.id;
let advanceTimer = null;
let pronunciationAudio = null;

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

function createSession(book) {
  return {
    queue: shuffle(book.words.map((_, index) => index)),
    position: 0,
    correct: 0,
    wrong: 0,
    current: null,
    locked: false,
  };
}

function getSession(book) {
  if (!sessions.has(book.id)) sessions.set(book.id, createSession(book));
  return sessions.get(book.id);
}

function getActiveBook() {
  return books.find((book) => book.id === activeBookId);
}

function buildTabs() {
  elements.tabs.replaceChildren();
  books.forEach((book) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tab-button";
    button.textContent = book.label;
    button.dataset.bookId = book.id;
    button.setAttribute("role", "tab");
    button.addEventListener("click", () => selectBook(book.id));
    elements.tabs.append(button);
  });
}

function makeQuestion(book, session) {
  const wordIndex = session.queue[session.position];
  const item = book.words[wordIndex];
  const askMeaning = Math.random() < 0.5;
  const answerKey = askMeaning ? "meaning" : "word";
  const correctAnswer = item[answerKey];
  const distractors = shuffle(
    book.words
      .filter((candidate, index) => index !== wordIndex && candidate[answerKey] !== correctAnswer)
      .map((candidate) => candidate[answerKey])
  ).slice(0, 3);

  return {
    item,
    askMeaning,
    correctAnswer,
    options: shuffle([correctAnswer, ...distractors]),
  };
}

function selectBook(bookId) {
  activeBookId = bookId;
  const activeTab = elements.tabs.querySelector(`[data-book-id="${bookId}"]`);
  elements.tabs.querySelectorAll(".tab-button").forEach((button) => {
    const active = button.dataset.bookId === bookId;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  activeTab?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  render();
}

function render() {
  const book = getActiveBook();
  if (!book) return;
  const session = getSession(book);
  const total = book.words.length;
  const completed = session.position;

  elements.bookTitle.textContent = book.label;
  elements.mode.textContent = book.meaningType === "zh" ? "中英双向" : "英文释义";
  elements.correctCount.textContent = session.correct;
  elements.remainingCount.textContent = Math.max(total - completed, 0);
  elements.progressFill.style.width = `${(completed / total) * 100}%`;

  if (completed >= total) {
    elements.progressText.textContent = `${total} / ${total} 题`;
    showFinish(book, session);
    return;
  }

  elements.progressText.textContent = `第 ${completed + 1} / ${total} 题`;
  elements.quiz.hidden = false;
  elements.finish.hidden = true;

  if (!session.current) session.current = makeQuestion(book, session);
  showQuestion(book, session);
}

function showQuestion(book, session) {
  stopPronunciation();
  const current = session.current;
  elements.feedback.textContent = "";
  elements.feedback.className = "feedback";
  elements.options.replaceChildren();

  if (current.askMeaning) {
    elements.questionLabel.textContent = book.meaningType === "zh" ? "请选择正确的中文意思" : "请选择正确的英文释义";
    elements.question.textContent = current.item.word;
    elements.question.classList.remove("meaning-question");
    elements.sound.hidden = false;
  } else {
    elements.questionLabel.textContent = "请选择对应的英文单词";
    elements.question.textContent = current.item.meaning;
    elements.question.classList.add("meaning-question");
    elements.sound.hidden = true;
  }

  current.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.textContent = option;
    button.dataset.answer = option;
    button.setAttribute("aria-label", `选项 ${index + 1}：${option}`);
    button.addEventListener("click", () => answerQuestion(button, option));
    elements.options.append(button);
  });
}

function answerQuestion(selectedButton, answer) {
  const book = getActiveBook();
  const session = getSession(book);
  if (session.locked) return;
  session.locked = true;

  const correct = answer === session.current.correctAnswer;
  elements.options.querySelectorAll(".option-button").forEach((button) => {
    button.disabled = true;
    if (button.dataset.answer === session.current.correctAnswer) button.classList.add("correct");
  });

  if (correct) {
    session.correct += 1;
    elements.feedback.textContent = "真棒！";
    elements.feedback.className = "feedback good";
  } else {
    session.wrong += 1;
    selectedButton.classList.add("wrong");
    elements.feedback.textContent = `正确答案：${session.current.correctAnswer}`;
    elements.feedback.className = "feedback bad";
  }

  elements.correctCount.textContent = session.correct;
  const answeredBookId = book.id;
  advanceTimer = setTimeout(() => {
    session.position += 1;
    session.current = null;
    session.locked = false;
    if (activeBookId === answeredBookId) render();
  }, correct ? 750 : 1700);
}

function showFinish(book, session) {
  elements.quiz.hidden = true;
  elements.finish.hidden = false;
  elements.progressFill.style.width = "100%";
  const total = book.words.length;
  const accuracy = Math.round((session.correct / total) * 100);
  elements.finishSummary.textContent = `${book.label} 的 ${total} 个单词都问到了。答对 ${session.correct} 题，答错 ${session.wrong} 题，正确率 ${accuracy}%。`;
}

function restart() {
  const book = getActiveBook();
  sessions.set(book.id, createSession(book));
  render();
}

function stopPronunciation() {
  if (!pronunciationAudio) return;
  pronunciationAudio.pause();
  pronunciationAudio.src = "";
  pronunciationAudio = null;
  elements.sound.classList.remove("playing");
}

function useSystemVoice(word) {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = "en-US";
  utterance.rate = 0.82;
  utterance.onend = () => elements.sound.classList.remove("playing");
  utterance.onerror = () => {
    elements.sound.classList.remove("playing");
    elements.feedback.textContent = "暂时无法播放发音";
    elements.feedback.className = "feedback bad";
  };
  window.speechSynthesis.speak(utterance);
  return true;
}

function speakWord() {
  const book = getActiveBook();
  const session = getSession(book);
  if (!session.current) return;

  const word = session.current.item.word;
  stopPronunciation();
  elements.sound.classList.add("playing");
  pronunciationAudio = new Audio(
    `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
  );
  pronunciationAudio.preload = "auto";
  pronunciationAudio.setAttribute("playsinline", "");
  pronunciationAudio.addEventListener("ended", () => {
    elements.sound.classList.remove("playing");
  }, { once: true });
  pronunciationAudio.addEventListener("error", () => {
    pronunciationAudio = null;
    if (!useSystemVoice(word)) {
      elements.sound.classList.remove("playing");
      elements.feedback.textContent = "暂时无法播放发音";
      elements.feedback.className = "feedback bad";
    }
  }, { once: true });

  const playback = pronunciationAudio.play();
  if (playback && typeof playback.catch === "function") {
    playback.catch(() => {
      pronunciationAudio = null;
      if (!useSystemVoice(word)) {
        elements.sound.classList.remove("playing");
        elements.feedback.textContent = "暂时无法播放发音";
        elements.feedback.className = "feedback bad";
      }
    });
  }
}

elements.sound.addEventListener("click", speakWord);
elements.restart.addEventListener("click", restart);

buildTabs();
selectBook(activeBookId);

