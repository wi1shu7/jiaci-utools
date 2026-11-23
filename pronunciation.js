const voicesByKey = {
  us_female: /Aria|Jenny|Zira|Google US English|Samantha|Ava/i,
  us_male: /Guy|Christopher|David|Mark|Alex|Tom/i,
  uk_female: /Sonia|Libby|Hazel|Google UK English Female|Kate|Serena/i,
  uk_male: /Ryan|George|Google UK English Male|Daniel|Arthur/i,
};

function playAudio(bytes, signal) {
  return new Promise((resolve) => {
    const audio = new Audio(`data:audio/mpeg;base64,${bytes.toString("base64")}`);
    const finish = (played) => {
      signal.removeEventListener("abort", stop);
      audio.onended = null;
      audio.onerror = null;
      resolve(played);
    };
    const stop = () => {
      audio.pause();
      finish(false);
    };
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    signal.addEventListener("abort", stop, { once: true });
    audio.play().catch(() => finish(false));
  });
}

function speak(text, { accent = "us", voice = "female" }, signal) {
  const synthesis = window.speechSynthesis;
  if (!synthesis) return Promise.resolve(false);
  const utterance = new SpeechSynthesisUtterance(text);
  const lang = accent === "uk" ? "en-GB" : "en-US";
  const voices = synthesis.getVoices().filter((candidate) => /^en(?:[-_]|$)/i.test(candidate.lang));
  const sameAccent = voices.filter((candidate) => candidate.lang.replace("_", "-").toLowerCase() === lang.toLowerCase());
  const prefer = voicesByKey[`${accent}_${voice}`];
  utterance.voice = sameAccent.find((candidate) => prefer?.test(candidate.name)) ?? sameAccent[0] ?? voices[0] ?? null;
  utterance.lang = utterance.voice?.lang ?? lang;
  return new Promise((resolve) => {
    const finish = (played) => {
      signal.removeEventListener("abort", stop);
      utterance.onend = null;
      utterance.onerror = null;
      resolve(played);
    };
    const stop = () => {
      synthesis.cancel();
      finish(false);
    };
    utterance.onend = () => finish(true);
    utterance.onerror = () => finish(false);
    signal.addEventListener("abort", stop, { once: true });
    synthesis.speak(utterance);
  });
}

async function playPronunciation(bytes, text, settings, signal) {
  if (signal.aborted) return false;
  if (bytes && await playAudio(bytes, signal)) return true;
  return signal.aborted ? false : speak(text, settings, signal);
}

module.exports = { playPronunciation };
