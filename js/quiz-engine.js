/* ===================== QUIZ ENGINE MODULE ===================== */
let currentPkg = null;
let currentQuestions = [];
let qIndex = 0;
let userAnswers = {}; 
let eliminatedOptions = {}; 
let currentFontSize = 20;
let bookmarkedQuestions = new Set();

let userName = '';
let userClass = '';
let quizMode = 'belajar'; 

let timerSeconds = 900; 
let timerInterval = null;
let unansListGlobal = [];

function getRandomN(arraySoal, count) {
  const shuffled = [...arraySoal];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

function speakQuestionText() {
  const q = currentQuestions[qIndex];
  if (q && q.text && typeof speakText === 'function') {
    speakText(q.text.replace('___', 'blank'));
  }
}

async function initQuizEngine(packageData, pName, pClass, pMode) {
  currentPkg = packageData;
  userName = pName;
  userClass = pClass;
  quizMode = pMode;

  const qTextEl = document.getElementById('qText');
  if (qTextEl) qTextEl.textContent = 'Memuat soal dari database...';

  try {
    const { data: allQuestions, error } = await supabaseClient
      .from('questions')
      .select('*')
      .eq('level', currentPkg.level);

    if (error || !allQuestions || allQuestions.length === 0) {
      alert('Gagal memuat soal dari database atau soal jenjang ini belum tersedia!');
      location.href = 'index.html';
      return;
    }

    const questionLimit = quizMode === 'belajar' ? 10 : 20;
    const rawSelectedQuestions = getRandomN(allQuestions, questionLimit);
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
    location.href = 'index.html';
  }
}

function renderQuestion() {
  const q = currentQuestions[qIndex];
  if (!q) return;

  const progressEl = document.getElementById('qProgress');
  if (progressEl) progressEl.textContent = `${qIndex + 1}/${currentQuestions.length}`;
  
  const levelTagEl = document.getElementById('qLevelTag');
  if (levelTagEl) levelTagEl.textContent = `${currentPkg.level} Level`;

  const imgWrap = document.getElementById('qImageWrap');
  const imgEl = document.getElementById('qImage');
  if (imgWrap && imgEl) {
    if (q.image) {
      imgEl.src = q.image;
      imgWrap.style.display = 'block';
    } else {
      imgWrap.style.display = 'none';
    }
  }

  const qTextEl = document.getElementById('qText');
  if (qTextEl) {
    const formattedText = q.text ? q.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') : '';
    qTextEl.innerHTML = formattedText;
    qTextEl.style.fontSize = currentFontSize + 'px';
    qTextEl.style.whiteSpace = 'pre-line';
  }

  updateBookmarkUI();

  const hintBox = document.getElementById('hintBox');
  if (hintBox) {
    hintBox.style.display = 'none';
    hintBox.textContent = q.hint || 'Tidak ada petunjuk untuk soal ini.';
  }

  const state = userAnswers[qIndex] || { selected: null, checked: false };
  const currentEliminated = eliminatedOptions[qIndex] || new Set();

  let optionsArray = q.options;
  if (typeof optionsArray === 'string') {
    try { optionsArray = JSON.parse(optionsArray); } catch (e) { optionsArray = []; }
  }

  const optWrap = document.getElementById('optionsWrap');
  if (optWrap) {
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
  }

  const checkBtn = document.getElementById('checkBtn');
  if (checkBtn) {
    if (state.checked) {
      checkBtn.disabled = true;
      checkBtn.textContent = 'Sudah Diperiksa';
      renderPembahasan();
    } else {
      checkBtn.disabled = state.selected === null;
      checkBtn.textContent = 'Periksa Jawaban';
      const pembWrap = document.getElementById('pembahasanWrap');
      if (pembWrap) pembWrap.classList.remove('open');
    }
  }

  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  if (prevBtn) prevBtn.disabled = qIndex === 0;
  if (nextBtn) nextBtn.textContent = qIndex === currentQuestions.length - 1 ? 'Selesai →' : 'Next →';
}

function selectOption(idx) {
  if (userAnswers[qIndex]?.checked) return;
  userAnswers[qIndex] = { selected: idx, checked: false };
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
  if (!list) return;

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

  const pembWrap = document.getElementById('pembahasanWrap');
  if (pembWrap) pembWrap.classList.add('open');
}

function startTimerInterval() {
  stopTimerInterval();
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    timerSeconds--;
    updateTimerDisplay();

    if (timerSeconds <= 0) {
      stopTimerInterval();
      alert('Waktu 15 menit telah habis! Kuis akan otomatis dikumpulkan.');
      finishQuiz();
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
  if (timerValEl) timerValEl.textContent = `⏱️ ${m}:${s}`;
}

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
  if (!modal) return;
  const isOpen = modal.classList.toggle('open');
  if (isOpen) renderPalette();
}

function renderPalette() {
  const grid = document.getElementById('paletteGrid');
  if (!grid) return;
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

function checkAndFinishQuiz() {
  unansListGlobal = [];
  currentQuestions.forEach((_, i) => {
    const ans = userAnswers[i];
    if (!ans || ans.selected === null || ans.selected === undefined) {
      unansListGlobal.push(i + 1);
    }
  });

  const modal = document.getElementById('finishModal');
  if (!modal) { finishQuiz(); return; }

  const iconEl = document.getElementById('finishModalIcon');
  const titleEl = document.getElementById('finishModalTitle');
  const msgEl = document.getElementById('finishMsg');
  const btnLeft = document.getElementById('finishModalBtnLeft');
  const btnRight = document.getElementById('finishModalBtnRight');

  if (unansListGlobal.length > 0) {
    if (iconEl) iconEl.textContent = '⚠️';
    if (titleEl) titleEl.textContent = 'Belum Lengkap!';
    if (msgEl) msgEl.innerHTML = `Masih ada <strong>${unansListGlobal.length} soal</strong> yang belum dijawab!<br><span style="font-size:12px; color:var(--ink-soft);">Nomor belum terisi: ${unansListGlobal.join(', ')}</span>`;
    if (btnLeft) btnLeft.textContent = 'Lengkapi Sekarang';
    if (btnRight) btnRight.style.display = 'none'; 
  } else {
    if (iconEl) iconEl.textContent = '🏁';
    if (titleEl) titleEl.textContent = 'Yakin Selesai?';
    if (msgEl) msgEl.textContent = 'Semua soal telah terjawab. Apakah kamu yakin ingin mengumpulkan jawaban sekarang?';
    if (btnLeft) btnLeft.textContent = 'Cek Lagi';
    if (btnRight) btnRight.style.display = 'block'; 
  }

  modal.classList.add('open');
}

function closeFinishModal() {
  const modal = document.getElementById('finishModal');
  if (modal) modal.classList.remove('open');
  
  if (unansListGlobal.length > 0) {
    qIndex = unansListGlobal[0] - 1;
    renderQuestion();
  }
}

async function finishQuiz() {
  stopTimerInterval();
  
  // Sembunyikan bagian kuis, tampilkan hasil
  const quizBody = document.getElementById('quizBodyContainer'); // atau view-result
  if (document.getElementById('view-quiz') && document.getElementById('view-result')) {
    document.getElementById('view-quiz').classList.remove('active');
    document.getElementById('view-result').classList.add('active');
  }

  let correctCount = 0;
  currentQuestions.forEach((q, i) => {
    if (userAnswers[i]?.selected === q.correct) correctCount++;
  });

  const accuracy = Math.round((correctCount / currentQuestions.length) * 100);
  const accEl = document.getElementById('scoreAccuracy');
  const statsEl = document.getElementById('scoreStats');
  
  if (accEl) accEl.textContent = accuracy + '%';
  if (statsEl) {
    const userGreeting = userName ? `Kerja bagus, <strong>${userName}</strong> (${userClass})!` : '';
    statsEl.innerHTML = `${userGreeting}<br>Kamu menjawab benar <strong>${correctCount}</strong> dari <strong>${currentQuestions.length}</strong> soal.`;
  }

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

function changeFontSize(delta) {
  currentFontSize = Math.min(Math.max(currentFontSize + delta, 16), 28);
  const qTextEl = document.getElementById('qText');
  if (qTextEl) qTextEl.style.fontSize = currentFontSize + 'px';
}

function toggleHint() {
  const box = document.getElementById('hintBox');
  if (box) box.style.display = box.style.display === 'block' ? 'none' : 'block';
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
  if (!content) return;
  
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
  if (box) box.style.display = box.style.display === 'block' ? 'none' : 'block';
}
