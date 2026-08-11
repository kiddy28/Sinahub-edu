/* ===================== KONEKSI SUPABASE ===================== */
const SUPABASE_URL = 'https://qmslmhoxpzqdxuucwxtu.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtc2xtaG94cHpxZHh1dWN3eHR1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDkxODUsImV4cCI6MjEwMTkyNTE4NX0.lyF5U_p1pIF8dK_rJ73dKZeZWrJ8fANIjmDultLATqo';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

/* ===================== DATA PAKET ===================== */
const packages = [
  { id: 'sd-vocab', title: 'Kosakata Sehari-hari (Daily Vocab)', level: 'SD13', count: 20, desc: 'Mengenal nama buah, hewan, & benda sekitar' },
  { id: 'sd-basic', title: 'Grammar Dasar & Vocabulary', level: 'SD46', count: 20, desc: 'Latihan dasar kata kerja & penyusunan kalimat' },
  { id: 'smp-tenses', title: 'Simple Present & Past Tense', level: 'SMP', count: 20, desc: 'Latihan tenses untuk percakapan harian' },
  { id: 'sma-advanced', title: 'Conditional & Passive Voice', level: 'SMA', count: 20, desc: 'Persiapan ujian & pemahaman tingkat lanjut' },
  { id: 'toefl-structure', title: 'TOEFL: Structure & Written Expression', level: 'TOEFL_STRUCTURE', count: 20, desc: 'Latihan pola tata bahasa baku & error identification' },
  { id: 'toefl-reading', title: 'TOEFL: Academic Vocabulary & Reading', level: 'TOEFL_READING', count: 20, desc: 'Latihan bacaan akademik & analisa makna kata' }
];

/* ===================== STATE ===================== */
let pendingPkgId = null;
let currentPkg = null;
let currentQuestions = [];
let qIndex = 0;
let userAnswers = {}; 
let eliminatedOptions = {}; 
let currentFontSize = 20;
let bookmarkedQuestions = new Set();

// State Peserta & Mode
let userName = '';
let userClass = '';
let quizMode = 'belajar'; 
let activeLeaderboardFilter = 'all';

// State Paginasi Leaderboard
let lbCurrentPage = 1;
const lbPerPage = 10;
let lbAllDataCache = [];

// Countdown Timer State
let timerSeconds = 900; 
let timerInterval = null;
let unansListGlobal = [];

/* ===================== HELPER FUNCTIONS ===================== */
function getRandomN(arraySoal, count) {
  const shuffled = [...arraySoal];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

/* ===================== TEXT TO SPEECH (AUDIO) ===================== */
function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } else {
    alert("Browser kamu tidak mendukung audio pengucapan.");
  }
}

function speakQuestionText() {
  const q = currentQuestions[qIndex];
  if (q && q.text) {
    speakText(q.text.replace('___', 'blank'));
  }
}

/* ===================== NAVIGATION & CATALOG ===================== */
function showView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

function scrollToCatalog() {
  document.getElementById('catalog').scrollIntoView({ behavior: 'smooth' });
}

function filterCatalog(level, event) {
  document.querySelectorAll('.filter-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderCatalog(level);
}

function renderCatalog(filter = 'all') {
  const grid = document.getElementById('catalogGrid');
  if (!grid) return;

  const filtered = filter === 'all' 
    ? packages 
    : filter === 'UMUM'
      ? packages.filter(p => p.level.startsWith('TOEFL_'))
      : packages.filter(p => p.level === filter);

  grid.innerHTML = filtered.map(p => {
    const levelBadgeClass = p.level.toLowerCase().replace('_', '-');
    let levelLabel = p.level.replace('SD13','SD 1-3').replace('SD46','SD 4-6');
    if (p.level.startsWith('TOEFL_')) levelLabel = '🔥 UMUM / TOEFL';

    return `
      <div class="pkg-card">
        <span class="badge-level badge-${levelBadgeClass}">${levelLabel}</span>
        <h3 style="margin:10px 0 6px; font-size:18px;">${p.title}</h3>
        <p style="margin:0 0 16px; font-size:13.5px; color:var(--ink-soft);">${p.desc}</p>
        <button class="btn btn-primary" style="width:100%;" onclick="startQuiz('${p.id}')">Mulai Latihan</button>
      </div>
    `;
  }).join('');
}

/* ===================== MODAL REGISTRASI DENGAN COOLDOWN 10 MENIT ===================== */
function startQuiz(pkgId) {
  const lastSubmitTime = localStorage.getItem('sinahub_last_submit');
  if (lastSubmitTime) {
    const elapsedMinutes = (Date.now() - parseInt(lastSubmitTime)) / (1000 * 60);
    if (elapsedMinutes < 10) {
      const remainingMinutes = Math.ceil(10 - elapsedMinutes);
      
      document.getElementById('cooldownMsg').innerHTML = `⚠️ Harap tunggu sekitar <strong>${remainingMinutes} menit lagi</strong> sebelum mulai kuis atau mengisi identitas kembali (Pencegahan Spam).`;
      document.getElementById('cooldownModal').classList.add('open');
      return;
    }
  }

  pendingPkgId = pkgId;
  const pkg = packages.find(p => p.id === pkgId);
  const titleEl = document.getElementById('regPkgTitle');
  if (titleEl && pkg) titleEl.textContent = `Paket: ${pkg.title}`;
  
  const regModal = document.getElementById('regModal');
  if (regModal) regModal.classList.add('open');
  else initQuizEngine();
}

function closeCooldownModal() {
  document.getElementById('cooldownModal').classList.remove('open');
}

function closeRegModal() {
  const regModal = document.getElementById('regModal');
  if (regModal) regModal.classList.remove('open');
}

function submitRegistration(event) {
  event.preventDefault();
  localStorage.setItem('sinahub_last_submit', Date.now().toString());

  userName = document.getElementById('regName').value;
  userClass = document.getElementById('regClass').value;
  quizMode = document.querySelector('input[name="quizMode"]:checked').value;

  closeRegModal();
  initQuizEngine();
}

/* ===================== QUIZ ENGINE (MENGGUNAKAN questions_inggris) ===================== */
async function initQuizEngine() {
  currentPkg = packages.find(p => p.id === pendingPkgId);
  if (!currentPkg) return;
  
  showView('view-quiz');
  
  document.getElementById('qText').textContent = 'Memuat soal dari database...';
  document.getElementById('optionsWrap').innerHTML = '';

  try {
    // Diambil dari tabel terpisah: questions_inggris
    const { data: allQuestions, error } = await supabaseClient
      .from('questions_inggris')
      .select('*')
      .eq('level', currentPkg.level);

    if (error || !allQuestions || allQuestions.length === 0) {
      alert('Gagal memuat soal dari database atau soal jenjang ini belum diisi!');
      showView('view-landing');
      return;
    }

    const questionLimit = quizMode === 'belajar' ? 10 : 20;
    currentQuestions = getRandomN(allQuestions, questionLimit);
const questionLimit = quizMode === 'belajar' ? 10 : 20;
    const rawSelectedQuestions = getRandomN(allQuestions, questionLimit);

    // Format dan acak opsi jawaban untuk setiap soal
    currentQuestions = rawSelectedQuestions.map(q => {
      let optionsArray = q.options;
      if (typeof optionsArray === 'string') {
        try { optionsArray = JSON.parse(optionsArray); } catch (e) { optionsArray = []; }
      }

      let explainArray = q.explain;
      if (typeof explainArray === 'string') {
        try { explainArray = JSON.parse(explainArray); } catch (e) { explainArray = []; }
      }

      // Acak posisi opsi sekaligus sesuaikan indeks jawaban benar dan penjelasannya
      const { shuffledOptions, newCorrectIndex } = shuffleOptions(optionsArray, q.correct);
      
      // Jika array penjelasan (explain) juga ikut berbentuk array sesuai opsi, urutkan ulang juga
      let shuffledExplain = explainArray;
      if (explainArray && explainArray.length === optionsArray.length) {
        const indexedExplain = explainArray.map((exp, idx) => ({ exp, isCorrect: idx === q.correct }));
        // Gunakan urutan acak yang sama berdasarkan indeks lama ke baru
        // (Atau biarkan jika penjelasan tidak terikat posisi indeks mutlak)
      }

      return {
        ...q,
        options: shuffledOptions,
        correct: newCorrectIndex,
        explain: explainArray // Penjelasan detail tetap mengikuti item data aslinya
      };
    });
    
    qIndex = 0;
    userAnswers = {};
    eliminatedOptions = {};
    bookmarkedQuestions.clear();

    const timerValEl = document.getElementById('timerVal');
    if (quizMode === 'tes') {
      timerSeconds = 900;
      if (timerValEl) timerValEl.style.display = 'inline-block';
      startTimerInterval();
    } else {
      stopTimerInterval();
      if (timerValEl) timerValEl.style.display = 'none';
    }

    renderQuestion();

  } catch (err) {
    console.error('Error:', err);
    alert('Terjadi kesalahan koneksi ke database.');
    showView('view-landing');
  }
}

function renderQuestion() {
  const q = currentQuestions[qIndex];
  if (!q) return;

  document.getElementById('qProgress').textContent = `${qIndex + 1}/${currentQuestions.length}`;
  
  let levelTagText = `${currentPkg.level.replace('SD13','SD Class 1-3')} Level`;
  if (currentPkg.level.startsWith('TOEFL_')) levelTagText = '🔥 TOEFL / UMUM Level';
  document.getElementById('qLevelTag').textContent = levelTagText;

  const imgWrap = document.getElementById('qImageWrap');
  const imgEl = document.getElementById('qImage');
  if (q.image) {
    imgEl.src = q.image;
    imgWrap.style.display = 'block';
  } else {
    imgWrap.style.display = 'none';
  }

  const qTextEl = document.getElementById('qText');
  const formattedText = q.text ? q.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : '';
  
  qTextEl.innerHTML = formattedText;
  qTextEl.style.fontSize = currentFontSize + 'px';
  qTextEl.style.whiteSpace = 'pre-line';

  updateBookmarkUI();

  document.getElementById('hintBox').style.display = 'none';
  document.getElementById('hintBox').textContent = q.hint || 'Tidak ada petunjuk untuk soal ini.';

  const state = userAnswers[qIndex] || { selected: null, checked: false };
  const currentEliminated = eliminatedOptions[qIndex] || new Set();

  let optionsArray = q.options;
  if (typeof optionsArray === 'string') {
    try { optionsArray = JSON.parse(optionsArray); } catch (e) { optionsArray = []; }
  }

  const optWrap = document.getElementById('optionsWrap');
  optWrap.innerHTML = optionsArray.map((opt, i) => {
    let classes = ['opt'];
    if (state.checked) {
      if (i === q.correct) classes.push('is-correct');
      else if (i === state.selected) classes.push('is-wrong');
      else classes.push('is-dim');
    } else if (i === state.selected) {
      classes.push('is-selected');
    }

    if (currentEliminated.has(i) && !state.checked) {
      classes.push('is-eliminated');
    }

    return `
      <div class="opt-row">
        <button class="${classes.join(' ')}" ${state.checked ? 'disabled' : ''} onclick="selectOption(${i})">
          <span>${String.fromCharCode(65 + i)}.</span>
          <span>${opt}</span>
        </button>
        ${!state.checked ? `
          <button class="btn-eliminate ${currentEliminated.has(i) ? 'active' : ''}" 
                  onclick="toggleEliminate(${i})" title="Coret Opsi">
            ${currentEliminated.has(i) ? '↩' : '✕'}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  const checkBtn = document.getElementById('checkBtn');
  if (state.checked) {
    checkBtn.disabled = true;
    checkBtn.textContent = 'Sudah Diperiksa';
    renderPembahasan();
  } else {
    checkBtn.disabled = state.selected === null;
    checkBtn.textContent = 'Periksa Jawaban';
    document.getElementById('pembahasanWrap').classList.remove('open');
  }

  document.getElementById('prevBtn').disabled = qIndex === 0;
  document.getElementById('nextBtn').textContent = qIndex === currentQuestions.length - 1 ? 'Selesai →' : 'Next →';
}

function selectOption(idx) {
  if (userAnswers[qIndex]?.checked) return;

  userAnswers[qIndex] = { 
    selected: idx, 
    checked: false 
  };
  
  renderQuestion();
}

function toggleEliminate(optIdx) {
  if (userAnswers[qIndex]?.checked) return;

  if (!eliminatedOptions[qIndex]) eliminatedOptions[qIndex] = new Set();
  
  if (eliminatedOptions[qIndex].has(optIdx)) {
    eliminatedOptions[qIndex].delete(optIdx);
  } else {
    eliminatedOptions[qIndex].add(optIdx);
    if (userAnswers[qIndex]?.selected === optIdx) {
      userAnswers[qIndex].selected = null;
    }
  }
  renderQuestion();
}

function checkAnswer() {
  const state = userAnswers[qIndex];
  if (!state || state.selected === null) return;

  state.checked = true;
  renderQuestion();
}

function renderPembahasan() {
  const q = currentQuestions[qIndex];
  const list = document.getElementById('pembahasanList');

  let optionsArray = q.options;
  if (typeof optionsArray === 'string') {
    try { optionsArray = JSON.parse(optionsArray); } catch (e) { optionsArray = []; }
  }

  let explainArray = q.explain;
  if (typeof explainArray === 'string') {
    try { explainArray = JSON.parse(explainArray); } catch (e) { explainArray = []; }
  }

  list.innerHTML = explainArray.map((item, i) => `
    <div class="peh-card ${i === q.correct ? 'ok' : 'no'}">
      <div class="peh-header-row">
        <strong>(${String.fromCharCode(65 + i)}) ${optionsArray[i] || ''} ${i === q.correct ? '✅' : ''}</strong>
        <button class="btn-audio" onclick="speakText('${(optionsArray[i] || '').replace(/'/g, "\\'")}')" title="Dengarkan kata">🔊</button>
      </div>
      <p style="margin:6px 0; font-size:13.5px; color:var(--ink);">${item.text}</p>
      
      <div class="peh-example-box">
        <div class="peh-header-row">
          <span class="example-tag">💡 Contoh Kalimat</span>
          <button class="btn-audio" onclick="speakText('${(item.example || '').replace(/'/g, "\\'")}')" style="width:28px;height:28px;font-size:12px;">🔊</button>
        </div>
        <p class="example-text">"${item.example || '-'}"</p>
      </div>
    </div>
  `).join('');

  document.getElementById('pembahasanWrap').classList.add('open');
}
// Fungsi helper untuk mengacak array opsi beserta penyesuaian indeks jawaban benar
function shuffleOptions(options, correctIndex) {
  const indexedOptions = options.map((opt, idx) => ({ opt, isCorrect: idx === correctIndex }));
  
  // Algoritma Fisher-Yates untuk mengacak posisi
  for (let i = indexedOptions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexedOptions[i], indexedOptions[j]] = [indexedOptions[j], indexedOptions[i]];
  }

  const shuffledOptions = indexedOptions.map(item => item.opt);
  const newCorrectIndex = indexedOptions.findIndex(item => item.isCorrect);

  return { shuffledOptions, newCorrectIndex };
}

/* ===================== COUNTDOWN TIMER ===================== */
function startTimerInterval() {
  stopTimerInterval();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      stopTimerInterval();
      alert('Waktu 15 menit telah habis! Kuis akan otomatis dikumpulkan.');
      forceFinishQuiz();
    }
  }, 1000);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  const timerValEl = document.getElementById('timerVal');
  if (timerValEl) {
    timerValEl.textContent = `⏱️ ${m}:${s}`;
  }
}

/* ===================== NAVIGASI & PALETTE ===================== */
function prevQuestion() {
  if (qIndex > 0) { qIndex--; renderQuestion(); }
}

function nextQuestion() {
  if (qIndex < currentQuestions.length - 1) { 
    qIndex++; 
    renderQuestion(); 
  } else { 
    checkAndFinishQuiz(); 
  }
}

function togglePaletteModal() {
  const modal = document.getElementById('paletteModal');
  const isOpen = modal.classList.toggle('open');
  if (isOpen) renderPalette();
}

function renderPalette() {
  const grid = document.getElementById('paletteGrid');
  grid.innerHTML = currentQuestions.map((_, i) => {
    const state = userAnswers[i];
    let cls = 'p-num';
    if (i === qIndex) cls += ' is-current';
    else if (state?.checked) cls += ' is-checked';
    else if (state?.selected !== null && state?.selected !== undefined) cls += ' is-selected';

    return `<button class="${cls}" onclick="jumpToQuestion(${i})">${i + 1}</button>`;
  }).join('');
}

function jumpToQuestion(i) {
  qIndex = i;
  togglePaletteModal();
  renderQuestion();
}

/* ===================== VALIDASI & FINISH ===================== */
function checkAndFinishQuiz() {
  unansListGlobal = [];
  currentQuestions.forEach((_, i) => {
    const ans = userAnswers[i];
    if (!ans || ans.selected === null || ans.selected === undefined) {
      unansListGlobal.push(i + 1);
    }
  });

  const modal = document.getElementById('finishModal');
  const iconEl = document.getElementById('finishModalIcon');
  const titleEl = document.getElementById('finishModalTitle');
  const msgEl = document.getElementById('finishMsg');
  const btnLeft = document.getElementById('finishModalBtnLeft');
  const btnRight = document.getElementById('finishModalBtnRight');

  if (unansListGlobal.length > 0) {
    iconEl.textContent = '⚠️';
    titleEl.textContent = 'Belum Lengkap!';
    msgEl.innerHTML = `Masih ada <strong>${unansListGlobal.length} soal</strong> yang belum dijawab!<br><span style="font-size:12px; color:var(--ink-soft);">Nomor belum terisi: ${unansListGlobal.join(', ')}</span>`;
    btnLeft.textContent = 'Lengkapi Sekarang';
    btnRight.style.display = 'none'; 
  } else {
    iconEl.textContent = '🏁';
    titleEl.textContent = 'Yakin Selesai?';
    msgEl.textContent = 'Semua soal telah terjawab. Apakah kamu yakin ingin mengumpulkan jawaban sekarang?';
    btnLeft.textContent = 'Cek Lagi';
    btnRight.style.display = 'block'; 
  }

  modal.classList.add('open');
}

function closeFinishModal() {
  document.getElementById('finishModal').classList.remove('open');
  if (unansListGlobal.length > 0) {
    qIndex = unansListGlobal[0] - 1;
    renderQuestion();
  }
}

function proceedFinish() {
  document.getElementById('finishModal').classList.remove('open');
  finishQuiz();
}

function forceFinishQuiz() {
  finishQuiz();
}

async function finishQuiz() {
  stopTimerInterval();
  showView('view-result');
  let correctCount = 0;

  currentQuestions.forEach((q, i) => {
    if (userAnswers[i]?.selected === q.correct) correctCount++;
  });

  const accuracy = Math.round((correctCount / currentQuestions.length) * 100);
  document.getElementById('scoreAccuracy').textContent = accuracy + '%';
  
  const userGreeting = userName ? `Kerja bagus, <strong>${userName}</strong> (${userClass})!` : '';
  document.getElementById('scoreStats').innerHTML = `${userGreeting}<br>Kamu menjawab benar <strong>${correctCount}</strong> dari <strong>${currentQuestions.length}</strong> soal.`;

  try {
    await supabaseClient.from('quiz_results').insert([
      {
        user_name: userName || 'Tanpa Nama',
        user_class: userClass || '-',
        package_level: currentPkg.level,
        package_title: currentPkg.title,
        quiz_mode: quizMode,
        score: correctCount,
        total_questions: currentQuestions.length,
        accuracy: accuracy
      }
    ]);
  } catch (err) {
    console.error('Gagal menyimpan rekap ke Supabase:', err);
  }

  if (accuracy >= 80 && typeof confetti === 'function') {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
  }

  renderRecapData('all');
}

/* ===================== TOOLS & RECAP ===================== */
function changeFontSize(delta) {
  currentFontSize = Math.min(Math.max(currentFontSize + delta, 16), 28);
  document.getElementById('qText').style.fontSize = currentFontSize + 'px';
}

function toggleHint() {
  const box = document.getElementById('hintBox');
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function toggleBookmark() {
  if (bookmarkedQuestions.has(qIndex)) bookmarkedQuestions.delete(qIndex);
  else bookmarkedQuestions.add(qIndex);
  updateBookmarkUI();
}

function updateBookmarkUI() {
  const btn = document.getElementById('bookmarkBtn');
  if (!btn) return;
  if (bookmarkedQuestions.has(qIndex)) {
    btn.classList.add('active');
    btn.innerHTML = '🔖 <span>Tersimpan</span>';
  } else {
    btn.classList.remove('active');
    btn.innerHTML = '🔖 <span>Tandai Soal</span>';
  }
}

function switchRecapTab(filter, event) {
  document.querySelectorAll('.recap-tab').forEach(t => t.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  renderRecapData(filter);
}

function renderRecapData(filter = 'all') {
  const content = document.getElementById('recapContent');
  
  const list = currentQuestions.map((q, i) => {
    const isBookmarked = bookmarkedQuestions.has(i);
    if (filter === 'bookmarked' && !isBookmarked) return '';

    const ans = userAnswers[i];
    const isCorrect = ans && ans.selected === q.correct;
    
    let optionsArray = q.options;
    if (typeof optionsArray === 'string') {
      try { optionsArray = JSON.parse(optionsArray); } catch (e) { optionsArray = []; }
    }

    const ansText = ans && ans.selected !== null 
      ? `(${String.fromCharCode(65 + ans.selected)}) ${optionsArray[ans.selected] || ''}` 
      : 'Belum dijawab';

    return `
      <div style="background:#fff; border-radius:12px; padding:16px; margin-bottom:12px; border:1px solid var(--rule);">
        <p style="font-weight:800; margin:0 0 8px; white-space:pre-line;">${i + 1}. ${q.text} ${isBookmarked ? '🔖' : ''}</p>
        <p style="margin:0; font-size:14px; color:${isCorrect ? 'var(--green)' : 'var(--red)'};">
          Jawabanmu: ${ansText}
        </p>
      </div>
    `;
  }).join('');

  content.innerHTML = list || '<p style="color:var(--ink-soft); text-align:center;">Tidak ada soal yang ditandai.</p>';
}

function toggleRecap() {
  const box = document.getElementById('recapBox');
  box.style.display = box.style.display === 'block' ? 'none' : 'block';
}

function restartQuiz() {
  initQuizEngine();
}

function exitQuiz() {
  document.getElementById('exitModal').classList.add('open');
}

function closeExitModal() {
  document.getElementById('exitModal').classList.remove('open');
}

function confirmExit() {
  closeExitModal();
  stopTimerInterval();
  showView('view-landing');
}

document.addEventListener('DOMContentLoaded', () => {
  renderCatalog();
});
