"use strict";

const MODE_LABELS = {
  "zh-en": "Chinese → English",
  "en-zh": "English → Chinese",
  mixed: "Mixed"
};
const PREFERENCE_KEY = "chinese-sentence-flashcards-mode";
const modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
const flashcard = document.getElementById("flashcard");
const promptFace = document.getElementById("prompt-face");
const promptText = document.getElementById("prompt-text");
const answerFace = document.getElementById("answer-face");
const primaryButton = document.getElementById("primary-button");
const previousButton = document.getElementById("previous-button");
const announcement = document.getElementById("announcement");
const progress = document.getElementById("study-progress");
let mode = "mixed";
let queue = [];
let position = 0;
let round = 1;
let revealed = false;

// Storage can be unavailable for local files or in private browsing.
try {
  const savedMode = localStorage.getItem(PREFERENCE_KEY);
  if (Object.hasOwn(MODE_LABELS, savedMode)) mode = savedMode;
} catch {}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function startRound(lastPrompt = null) {
  // A mixed round includes both translations of every original Anki card.
  const directions = mode === "mixed" ? ["zh-en", "en-zh"] : [mode];
  queue = shuffle(SENTENCE_DECK.cards.flatMap(card => directions.map(direction => ({ card, direction }))));
  if (lastPrompt && queue.length > 1 && queue[0].card.id === lastPrompt.card.id && queue[0].direction === lastPrompt.direction) {
    [queue[0], queue[1]] = [queue[1], queue[0]];
  }
  position = 0;
  revealed = false;
  render();
}

function render() {
  const { card, direction } = queue[position];
  const isChinese = direction === "zh-en";
  flashcard.dataset.cardId = card.id;
  flashcard.dataset.direction = direction;
  flashcard.setAttribute("aria-expanded", String(revealed));
  document.getElementById("card-direction").textContent = MODE_LABELS[direction].toUpperCase();
  document.getElementById("sentence-number").textContent = `SENTENCE ${String(card.number).padStart(3, "0")}`;
  promptText.textContent = isChinese ? card.zh : card.en;
  promptText.lang = isChinese ? "zh-Hant" : "en";
  document.getElementById("prompt-note").textContent = isChinese ? "How would you say this in English?" : "How would you say this in Chinese?";
  document.getElementById("solution-chinese").textContent = card.zh;
  document.getElementById("solution-pinyin").textContent = card.pinyin;
  document.getElementById("solution-english").textContent = card.en;
  promptFace.hidden = revealed;
  answerFace.hidden = !revealed;
  document.getElementById("card-hint").textContent = revealed ? "Tap the card to see the prompt again" : "Tap anywhere on the card to reveal";
  primaryButton.textContent = revealed ? "Next card →" : "Reveal answer";
  previousButton.disabled = position === 0;
  document.getElementById("card-count").textContent = `${position + 1} / ${queue.length} prompts · Round ${round}`;
  document.getElementById("deck-summary").textContent = `${SENTENCE_DECK.title} · ${SENTENCE_DECK.cards.length} sentences`;
  progress.max = queue.length;
  progress.value = position + 1;
  modeButtons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.mode === mode)));
  flashcard.setAttribute("aria-label", revealed
    ? `Answer. Characters: ${card.zh} Pinyin: ${card.pinyin} English: ${card.en} Tap to see the prompt again.`
    : `${isChinese ? "Chinese" : "English"} prompt: ${isChinese ? card.zh : card.en} Tap to reveal the answer.`);
}

function toggleAnswer() {
  revealed = !revealed;
  render();
  announcement.textContent = revealed ? "Answer revealed: characters, pinyin, and English." : "Prompt shown.";
}

function nextCard() {
  revealed = false;
  if (position === queue.length - 1) {
    const lastPrompt = queue[position];
    round += 1;
    startRound(lastPrompt);
    announcement.textContent = `Round complete. Starting shuffled round ${round}.`;
  } else {
    position += 1;
    render();
    announcement.textContent = `Card ${position + 1} of ${queue.length}. ${MODE_LABELS[queue[position].direction]}.`;
  }
}

function previousCard() {
  if (position === 0) return;
  position -= 1;
  revealed = false;
  render();
  announcement.textContent = `Card ${position + 1} of ${queue.length}. ${MODE_LABELS[queue[position].direction]}.`;
}

function revealOrNext() {
  if (revealed) nextCard();
  else toggleAnswer();
}

modeButtons.forEach(button => button.addEventListener("click", () => {
  if (mode === button.dataset.mode) return;
  mode = button.dataset.mode;
  try { localStorage.setItem(PREFERENCE_KEY, mode); } catch {}
  round = 1;
  startRound();
  announcement.textContent = `${MODE_LABELS[mode]} mode. ${queue.length} shuffled prompts.`;
}));
flashcard.addEventListener("click", toggleAnswer);
primaryButton.addEventListener("click", revealOrNext);
previousButton.addEventListener("click", previousCard);
document.getElementById("next-button").addEventListener("click", nextCard);
document.getElementById("shuffle-button").addEventListener("click", () => {
  const lastPrompt = queue[position];
  round = 1;
  startRound(lastPrompt);
  announcement.textContent = `Reshuffled. ${queue.length} prompts in ${MODE_LABELS[mode]} mode.`;
});

document.addEventListener("keydown", event => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
  if (event.target.closest("input, textarea, select, [contenteditable='true']")) return;
  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextCard();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    previousCard();
  } else if (event.code === "Space" && !event.target.closest("button, a")) {
    event.preventDefault();
    revealOrNext();
  }
});

startRound();
