/**
 * game.js — Make a Move!
 * Lógica principal do jogo, organizada em módulos.
 */

/* ─────────────────────────────────────────────────────
   ESTADO GLOBAL
   ───────────────────────────────────────────────────── */
const state = {
  mode:          null,   // 'shuffled' | 'theme'
  selectedTheme: null,
  roundTime:     60,
  currentTeam:   1,
  scores:        { 1: 0, 2: 0 },
  skippedTotal:  { 1: 0, 2: 0 },
  words:         [],
  timeLeft:      60,
  timerInterval: null,
  isRunning:     false,
  isPaused:      false,
  isMuted:       false,
  roundHistory:  { correct: [], skipped: [] },
  WIN_SCORE:     50,
  prevScreen:    null,
};

/* ─────────────────────────────────────────────────────
   MÓDULO: UI
   ───────────────────────────────────────────────────── */
const UI = (() => {
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
    });
    const target = document.getElementById(id);
    if (target) {
      target.classList.add('active');
      state.prevScreen = id;
    }
  }

  function goBack() {
    // Heurística simples de "voltar"
    const flow = {
      'screen-theme': 'screen-welcome',
      'screen-time':  'screen-theme',   // será ajustado por Game.setMode
      'screen-team':  'screen-time',
    };
    const prev = flow[state.prevScreen];
    if (prev) showScreen(prev);
  }

  function updateScoreboard() {
    const s1 = document.getElementById('score1');
    const s2 = document.getElementById('score2');
    if (s1) {
      s1.textContent = state.scores[1];
      s1.classList.add('bump');
      setTimeout(() => s1.classList.remove('bump'), 350);
    }
    if (s2) {
      s2.textContent = state.scores[2];
      s2.classList.add('bump');
      setTimeout(() => s2.classList.remove('bump'), 350);
    }
  }

  function setWord(word) {
    const el = document.getElementById('wordDisplay');
    if (!el) return;
    el.style.animation = 'none';
    void el.offsetWidth; // reflow
    el.style.animation = '';
    el.textContent = word;
  }

  function updateMiniHistory() {
    const correct = document.getElementById('correctCount');
    const skipped = document.getElementById('skippedCount');
    if (correct) correct.textContent = state.roundHistory.correct.length;
    if (skipped) skipped.textContent = state.roundHistory.skipped.length;
  }

  function updateTurnIndicator() {
    const el = document.getElementById('turnIndicator');
    if (!el) return;
    const label = state.currentTeam === 1 ? 'Equipe A' : 'Equipe B';
    const cls   = state.currentTeam === 1 ? 'team-a'   : 'team-b';
    el.textContent = `🎯 Vez da ${label}`;
    el.className = `turn-indicator ${cls}`;
  }

  function updateFloatingTeam() {
    const el = document.getElementById('floatingTeam');
    if (!el) return;
    const gameVisible = document.getElementById('screen-game').classList.contains('active');
    if (gameVisible) {
      el.textContent = state.currentTeam === 1 ? 'A' : 'B';
      el.style.color = state.currentTeam === 1 ? '#3b82f6' : '#ef4444';
      el.style.display = 'block';
    } else {
      el.style.display = 'none';
    }
  }

  function showMuteButton(show) {
    const el = document.getElementById('muteButton');
    if (el) el.style.display = show ? 'flex' : 'none';
  }

  function populateThemeGrid() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;
    grid.innerHTML = '';
    Object.keys(TEMAS).forEach(tema => {
      const btn = document.createElement('button');
      btn.className = 'btn-theme';
      btn.textContent = tema;
      btn.onclick = () => Game.selectTheme(tema);
      grid.appendChild(btn);
    });
  }

  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }

  function buildHistoryScreen() {
    const teamLabel    = document.getElementById('historyTeamLabel');
    const correctList  = document.getElementById('historyCorrectList');
    const skippedList  = document.getElementById('historySkippedList');
    const correctCount = document.getElementById('historyCorrectCount');
    const skippedCount = document.getElementById('historySkippedCount');

    if (!teamLabel || !correctList || !skippedList) return;

    const team = state.currentTeam === 1 ? 'Equipe A' : 'Equipe B';
    teamLabel.textContent = `Resumo da rodada — ${team}`;

    correctCount.textContent = state.roundHistory.correct.length;
    skippedCount.textContent = state.roundHistory.skipped.length;

    correctList.innerHTML = '';
    if (state.roundHistory.correct.length === 0) {
      correctList.innerHTML = '<li class="history-empty">Nenhuma palavra acertada.</li>';
    } else {
      state.roundHistory.correct.forEach(w => {
        const li = document.createElement('li');
        li.textContent = w;
        correctList.appendChild(li);
      });
    }

    skippedList.innerHTML = '';
    if (state.roundHistory.skipped.length === 0) {
      skippedList.innerHTML = '<li class="history-empty">Nenhuma palavra pulada.</li>';
    } else {
      state.roundHistory.skipped.forEach(w => {
        const li = document.createElement('li');
        li.textContent = w;
        skippedList.appendChild(li);
      });
    }
  }

  return {
    showScreen, goBack,
    updateScoreboard, setWord, updateMiniHistory,
    updateTurnIndicator, updateFloatingTeam,
    showMuteButton, populateThemeGrid,
    openModal, closeModal, buildHistoryScreen,
  };
})();

/* ─────────────────────────────────────────────────────
   MÓDULO: AUDIO
   ───────────────────────────────────────────────────── */
const Audio = (() => {
  let alarmEl, startEl;

  function init() {
    alarmEl = document.getElementById('alarmSound');
    startEl = document.getElementById('startSound');
  }

  function play(name) {
    if (state.isMuted) return;
    const el = name === 'alarm' ? alarmEl : startEl;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }

  function stop(name) {
    const el = name === 'alarm' ? alarmEl : startEl;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }

  function stopAll() {
    stop('alarm');
    stop('start');
  }

  function toggleMute() {
    state.isMuted = !state.isMuted;
    if (alarmEl) alarmEl.muted = state.isMuted;
    if (startEl) startEl.muted = state.isMuted;

    const btn = document.getElementById('muteButton');
    if (btn) btn.textContent = state.isMuted ? '🔇' : '🔊';

    if (state.isMuted) {
      stopAll();
    } else {
      // Se alarme deveria estar tocando, retoma
      if (state.timeLeft <= 10 && state.timeLeft > 0 && state.isRunning && !state.isPaused) {
        if (alarmEl && alarmEl.paused) alarmEl.play().catch(() => {});
      }
    }
  }

  return { init, play, stop, stopAll, toggleMute };
})();

/* ─────────────────────────────────────────────────────
   MÓDULO: TIMER
   ───────────────────────────────────────────────────── */
const Timer = (() => {
  function start() {
    state.timeLeft = state.roundTime;
    state.isRunning = true;
    state.isPaused  = false;
    updateDisplay();
    Audio.play('start');
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(tick, 1000);
  }

  function tick() {
    if (state.isPaused) return;
    state.timeLeft--;
    updateDisplay();

    // Alarme nos últimos 10s
    if (state.timeLeft <= 10 && state.timeLeft > 0) {
      if (!state.isMuted) {
        const el = document.getElementById('alarmSound');
        if (el && el.paused) el.play().catch(() => {});
      }
    } else if (state.timeLeft > 10) {
      Audio.stop('alarm');
    }

    if (state.timeLeft <= 0) {
      clearInterval(state.timerInterval);
      state.isRunning = false;
      Audio.stopAll();
      Game.endRound();
    }
  }

  function updateDisplay() {
    const textEl = document.getElementById('timerText');
    const barEl  = document.getElementById('timerBarFill');
    if (!textEl || !barEl) return;

    textEl.textContent = `${state.timeLeft}s`;

    const pct = (state.timeLeft / state.roundTime) * 100;
    barEl.style.width = `${pct}%`;

    // Classes de urgência
    if (state.timeLeft <= 10) {
      textEl.className = 'timer-text danger';
      barEl.className  = 'timer-bar-fill danger';
    } else if (state.timeLeft <= 20) {
      textEl.className = 'timer-text warning';
      barEl.className  = 'timer-bar-fill warning';
    } else {
      textEl.className = 'timer-text';
      barEl.className  = 'timer-bar-fill';
    }
  }

  function pause() {
    state.isPaused = true;
    Audio.stopAll();
    const btn = document.getElementById('btnPause');
    if (btn) {
      btn.textContent = '▶️ Continuar';
      btn.classList.add('paused');
    }
  }

  function resume() {
    state.isPaused = false;
    Audio.play('start');
    const btn = document.getElementById('btnPause');
    if (btn) {
      btn.textContent = '⏸️ Pausar';
      btn.classList.remove('paused');
    }
    // Retoma alarme se necessário
    if (state.timeLeft <= 10) {
      const el = document.getElementById('alarmSound');
      if (el && !state.isMuted) el.play().catch(() => {});
    }
  }

  function stop() {
    clearInterval(state.timerInterval);
    state.isRunning = false;
    state.isPaused  = false;
    Audio.stopAll();
  }

  function reset() {
    stop();
    state.timeLeft = state.roundTime;
    const textEl = document.getElementById('timerText');
    const barEl  = document.getElementById('timerBarFill');
    if (textEl) { textEl.textContent = `${state.roundTime}s`; textEl.className = 'timer-text'; }
    if (barEl)  { barEl.style.width = '100%'; barEl.className = 'timer-bar-fill'; }
  }

  return { start, pause, resume, stop, reset, updateDisplay };
})();

/* ─────────────────────────────────────────────────────
   MÓDULO: AUTH
   ───────────────────────────────────────────────────── */
const Auth = (() => {
  const PASSWORD = 'leo';
  const SESSION_KEY = 'makeAmoveSenha';

  function check() {
    return sessionStorage.getItem(SESSION_KEY) === 'ok';
  }

  function verify() {
    const input = document.getElementById('passwordInput');
    const val   = input ? input.value.trim() : '';
    if (val === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, 'ok');
      gotoWelcome();
    } else {
      input.style.borderColor = '#ef4444';
      input.value = '';
      input.placeholder = 'Senha incorreta, tente novamente...';
      setTimeout(() => {
        input.style.borderColor = '';
        input.placeholder = 'Digite a senha...';
      }, 2000);
    }
  }

  function gotoWelcome() {
    Counter.init();
    Counter.display();
    UI.showScreen('screen-welcome');
  }

  function init() {
    if (check()) {
      gotoWelcome();
    } else {
      UI.showScreen('screen-password');

      // Permitir Enter no campo de senha
      const input = document.getElementById('passwordInput');
      if (input) {
        input.addEventListener('keypress', e => {
          if (e.key === 'Enter') verify();
        });
        input.focus();
      }
    }
  }

  return { init, verify };
})();

/* ─────────────────────────────────────────────────────
   MÓDULO: GAME
   ───────────────────────────────────────────────────── */
const Game = (() => {

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── Configuração ────────────────────────────────────

  function setMode(mode) {
    state.mode = mode;
    if (mode === 'shuffled') {
      state.selectedTheme = null;
      UI.showScreen('screen-time');
    } else {
      UI.populateThemeGrid();
      UI.showScreen('screen-theme');
    }
  }

  function selectTheme(tema) {
    state.selectedTheme = tema;

    // Marca o botão selecionado no grid
    document.querySelectorAll('.btn-theme').forEach(btn => {
      btn.classList.toggle('selected', btn.textContent === tema);
    });

    // Avança para seleção de tempo após curto delay (feedback visual)
    setTimeout(() => UI.showScreen('screen-time'), 200);
  }

  function setTime(seconds) {
    state.roundTime = seconds;

    // Atualiza visual dos botões de tempo
    [30, 60, 90].forEach(t => {
      const btn = document.getElementById(`time-${t}`);
      if (btn) btn.classList.toggle('selected', t === seconds);
    });
  }

  // ── Início /Rodadas ──────────────────────────────────

  function startGame(team) {
    state.currentTeam = team;
    state.scores      = { 1: 0, 2: 0 };
    state.skippedTotal = { 1: 0, 2: 0 };
    state.roundHistory = { correct: [], skipped: [] };
    _prepareWords();
    _showConfirm(`🚀 Equipe ${team === 1 ? 'A' : 'B'} começa!`, 'Preparem-se... o cronômetro vai iniciar quando confirmarem.');
  }

  function continueGame() {
    // Atualiza UI
    UI.updateScoreboard();
    UI.updateTurnIndicator();
    UI.updateFloatingTeam();
    UI.showMuteButton(true);
    UI.showScreen('screen-game');

    // Reseta botão de pausa
    const btn = document.getElementById('btnPause');
    if (btn) { btn.textContent = '⏸️ Pausar'; btn.classList.remove('paused'); }

    // Zera mini-histórico
    state.roundHistory = { correct: [], skipped: [] };
    UI.updateMiniHistory();

    nextWord();
    Timer.start();
  }

  function nextWord() {
    if (state.words.length === 0) {
      _refillWords();
    }
    const word = state.words.shift();
    UI.setWord(word || '—');
  }

  function correctGuess() {
    if (!state.isRunning || state.isPaused) return;
    const current = document.getElementById('wordDisplay').textContent;
    state.roundHistory.correct.push(current);
    state.scores[state.currentTeam]++;
    UI.updateScoreboard();
    UI.updateMiniHistory();

    if (_checkWin()) return;
    nextWord();
  }

  function skipWord() {
    if (!state.isRunning || state.isPaused) return;
    const current = document.getElementById('wordDisplay').textContent;
    state.roundHistory.skipped.push(current);

    state.skippedTotal[state.currentTeam]++;
    if (state.skippedTotal[state.currentTeam] % 2 === 0) {
      state.scores[state.currentTeam]--;
      UI.updateScoreboard();
    }

    UI.updateMiniHistory();
    nextWord();
  }

  function togglePause() {
    if (!state.isRunning) return;
    if (state.isPaused) {
      Timer.resume();
    } else {
      Timer.pause();
    }
  }

  // ── Fim de Rodada / Troca ─────────────────────────────

  function endRound() {
    Timer.stop();
    UI.buildHistoryScreen();
    UI.showScreen('screen-history');
    UI.updateFloatingTeam();
  }

  function nextTeamTurn() {
    state.currentTeam = state.currentTeam === 1 ? 2 : 1;
    _prepareWords();
    _showConfirm(
      `🔄 Vez da Equipe ${ state.currentTeam === 1 ? 'A' : 'B' }!`,
      `Placar: A ${state.scores[1]} × ${state.scores[2]} B`
    );
  }

  function confirmReset() {
    Timer.pause();
    UI.openModal('modal-reset');
  }

  function resetGame() {
    Timer.stop();
    Audio.stopAll();
    state.scores      = { 1: 0, 2: 0 };
    state.skippedTotal = { 1: 0, 2: 0 };
    state.currentTeam = 1;
    state.words       = [];
    state.roundHistory = { correct: [], skipped: [] };
    state.isRunning   = false;
    state.isPaused    = false;
    state.mode        = null;
    state.selectedTheme = null;

    UI.closeModal('modal-reset');
    UI.showMuteButton(false);
    UI.updateFloatingTeam();

    // Resetar mute visual
    state.isMuted = false;
    const muteBtn = document.getElementById('muteButton');
    if (muteBtn) muteBtn.textContent = '🔊';

    UI.showScreen('screen-welcome');
  }

  // ── Privados ─────────────────────────────────────────

  function _prepareWords() {
    if (state.mode === 'shuffled') {
      state.words = shuffleArray(Object.values(TEMAS).flat());
    } else {
      state.words = shuffleArray([...TEMAS[state.selectedTheme]]);
    }
  }

  function _refillWords() {
    _prepareWords();
  }

  function _showConfirm(title, message) {
    document.getElementById('confirmTitle').textContent   = title;
    document.getElementById('confirmMessage').textContent = message;
    const icon = document.getElementById('confirmIcon');
    icon.textContent = state.currentTeam === 1 ? '🔵' : '🔴';
    UI.showScreen('screen-confirm');
  }

  function _checkWin() {
    if (state.scores[1] >= state.WIN_SCORE || state.scores[2] >= state.WIN_SCORE) {
      Timer.stop();
      Audio.stopAll();
      const winner = state.scores[1] >= state.WIN_SCORE ? 'A' : 'B';
      document.getElementById('confirmTitle').textContent   = `🏆 Equipe ${winner} venceu!`;
      document.getElementById('confirmMessage').textContent =
        `Placar Final: A ${state.scores[1]} × ${state.scores[2]} B`;
      document.getElementById('confirmIcon').textContent = '🏆';
      // Substitui botão de confirmar por resetar
      const btn = document.getElementById('confirmContinueBtn');
      if (btn) {
        btn.textContent = '🏠 Jogar Novamente';
        btn.onclick = resetGame;
      }
      UI.showScreen('screen-confirm');
      return true;
    }
    return false;
  }

  return {
    setMode, selectTheme, setTime,
    startGame, continueGame, nextWord,
    correctGuess, skipWord, togglePause,
    endRound, nextTeamTurn,
    confirmReset, resetGame,
  };
})();

/* ─────────────────────────────────────────────────────
   INICIALIZAÇÃO
   ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  Audio.init();

  // Seleção de tempo padrão: 60s marcado
  const btn60 = document.getElementById('time-60');
  if (btn60) btn60.classList.add('selected');

  // Auth: verifica sessão ou exibe tela de senha
  Auth.init();

  // Exibir contador (caso já esteja autenticado)
  Counter.display();
});

// Expõe toggleMute para o botão no HTML
function toggleMute() { Audio.toggleMute(); }
