/**
 * counter.js — Make a Move!
 * Contador de acessos persistido em localStorage.
 */

const Counter = (() => {
  const STORAGE_KEY = 'makeAmoveVisits';

  function init() {
    const current = get();
    const newCount = current + 1;
    localStorage.setItem(STORAGE_KEY, newCount);
    return newCount;
  }

  function get() {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
  }

  function display() {
    const count = get();
    const el = document.getElementById('accessCount');
    if (el) {
      el.textContent = count.toLocaleString('pt-BR');
    }
  }

  return { init, get, display };
})();
