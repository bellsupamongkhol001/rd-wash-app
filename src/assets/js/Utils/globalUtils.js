export function debounce(fn, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

export function safeGet(id) {
  const el = document.getElementById(id);
  if (!el) console.warn(`⚠️ Element #${id} not found`);
  return el;
}