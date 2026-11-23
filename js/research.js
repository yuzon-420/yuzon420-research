// 研究支援設定與受控三層提示。這裡不呼叫生成式 AI，確保提示可重現。

const SETTINGS_KEY = "pyquest-research-settings-v1";
const DEFAULTS = Object.freeze({
  supportMode: "personalized",
  pretest: 62,
  cpses: 3.4,
  vark: "R/K",
});

let sessionHints = {};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setSupportMode(mode) {
  const supportMode = mode === "generic" ? "generic" : "personalized";
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getSettings(), supportMode }));
  return supportMode;
}

export function resetHintSession(levelId) {
  sessionHints = { ...sessionHints, [levelId]: 0 };
}

export function currentHintLevel(levelId) {
  return sessionHints[levelId] || 0;
}

export function nextHint(level, result, attempts = 0) {
  const hintLevel = Math.min(3, currentHintLevel(level.id) + 1);
  sessionHints = { ...sessionHints, [level.id]: hintLevel };
  const mode = getSettings().supportMode;
  const errorType = classifyError(result);
  const failed = (result?.results || []).filter((item) => !item.passed);
  const personalizedPrefix =
    mode === "personalized" && errorType !== "尚未執行"
      ? `依你目前的「${errorType}」與第 ${Math.max(1, attempts)} 次嘗試調整：`
      : "";

  const bodies = [
    level.lesson?.concept || level.hint || `先回想「${level.topic}」的核心概念。`,
    failed.length
      ? `先檢查這個測試：${failed[0].name}。提示：${failed[0].message || "比對任務目標與目前輸出。"}`
      : `逐項對照任務目標，特別檢查「${stripHtml(level.instructions?.[0] || level.topic)}」。`,
    `保留你目前的程式，依序確認：輸入資料 → ${level.topic} 的處理步驟 → 輸出結果。只補上缺少的結構，不要整段重寫。`,
  ];

  return {
    level: hintLevel,
    title: ["概念提示", "方向提示", "具體引導"][hintLevel - 1],
    body: `${personalizedPrefix}${bodies[hintLevel - 1]}`,
    mode,
    errorType,
  };
}

export function classifyError(result) {
  const raw = String(result?.error || "");
  if (!result) return "尚未執行";
  if (/SyntaxError|縮排|IndentationError/i.test(raw)) return "語法或縮排錯誤";
  if (/NameError|未定義/i.test(raw)) return "變數未定義";
  if (/TypeError|型態/i.test(raw)) return "資料型態錯誤";
  if (result.results?.some((item) => !item.passed)) return "測試條件未通過";
  return "沒有錯誤";
}

function stripHtml(value) {
  const box = document.createElement("div");
  box.innerHTML = String(value);
  return box.textContent || "";
}
