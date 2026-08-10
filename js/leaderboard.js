
let lbCurrentPage = 1;
const lbPerPage = 10;
let lbAllDataCache = [];

async function fetchLeaderboardData(levelFilter = 'all') {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;
  container.innerHTML = `<p style="text-align:center; color: var(--ink-soft);">Memuat data hasil peserta...</p>`;

  try {
    let query = supabaseClient.from('quiz_results').select('*').order('created_at', { ascending: false });

    if (levelFilter !== 'all') {
      if (levelFilter === 'UMUM') {
        query = query.or('package_level.eq.TOEFL_STRUCTURE,package_level.eq.TOEFL_READING,package_level.eq.UMUM');
      } else {
        query = query.eq('package_level', levelFilter);
      }
    }

    const { data, error } = await query;

    if (error) {
      container.innerHTML = `<p style="text-align:center; color: var(--red);">Gagal mengambil data dari server.</p>`;
      return;
    }

    if (!data || data.length === 0) {
      container.innerHTML = `<p style="text-align:center; color: var(--ink-soft); padding: 20px 0;">Belum ada hasil peserta untuk kategori ini.</p>`;
      return;
    }

    lbAllDataCache = data;
    renderLeaderboardPage();

  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="text-align:center; color: var(--red);">Terjadi kesalahan koneksi.</p>`;
  }
}

function renderLeaderboardPage() {
  const container = document.getElementById('leaderboardContent');
  if (!container) return;

  const totalData = lbAllDataCache.length;
  const totalPages = Math.ceil(totalData / lbPerPage) || 1;
  if (lbCurrentPage > totalPages) lbCurrentPage = totalPages;
  if (lbCurrentPage < 1) lbCurrentPage = 1;

  const startIdx = (lbCurrentPage - 1) * lbPerPage;
  const endIdx = startIdx + lbPerPage;
  const paginatedData = lbAllDataCache.slice(startIdx, endIdx);

  container.innerHTML = `
    <table style="width:100%; border-collapse:collapse; text-align:left; font-size:14px;">
      <thead>
        <tr style="border-bottom:2px solid var(--rule); color:var(--ink-soft);">
          <th style="padding:10px;">Tanggal</th>
          <th style="padding:10px;">Nama</th>
          <th style="padding:10px;">Kelas</th>
          <th style="padding:10px;">Jenjang</th>
          <th style="padding:10px;">Mode</th>
          <th style="padding:10px; text-align:center;">Skor</th>
          <th style="padding:10px; text-align:center;">Nilai</th>
        </tr>
      </thead>
      <tbody>
        ${paginatedData.map(item => {
          const dateStr = new Date(item.created_at).toLocaleDateString('id-ID', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
          });
          
          let badgeText = (item.package_level || '').replace('SD13','SD 1-3').replace('SD46','SD 4-6');
          if ((item.package_level || '').startsWith('TOEFL_') || item.package_level === 'UMUM') badgeText = '🔥 UMUM';

          return `
            <tr style="border-bottom:1px solid var(--rule);">
              <td style="padding:12px 10px; font-size:12px; color:var(--ink-soft);">${dateStr}</td>
              <td style="padding:12px 10px; font-weight:bold;">${item.user_name}</td>
              <td style="padding:12px 10px;">${item.user_class}</td>
              <td style="padding:12px 10px;"><span class="badge-level badge-${(item.package_level || '').toLowerCase().replace('_','-')}">${badgeText}</span></td>
              <td style="padding:12px 10px; text-transform:capitalize;">${item.quiz_mode}</td>
              <td style="padding:12px 10px; text-align:center;">${item.score}/${item.total_questions}</td>
              <td style="padding:12px 10px; text-align:center; font-weight:bold; color:${item.accuracy >= 70 ? 'var(--green)' : 'var(--red)'};">${item.accuracy}%</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 12px; border-top: 1px solid var(--rule); flex-wrap: wrap; gap: 8px;">
      <span style="font-size: 13px; color: var(--ink-soft);">Menampilkan halaman <strong>${lbCurrentPage}</strong> dari <strong>${totalPages}</strong> (Total ${totalData} data)</span>
      <div style="display: flex; gap: 6px;">
        <button class="btn btn-sm btn-ghost" ${lbCurrentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeLeaderboardPage(${lbCurrentPage - 1})">← Prev</button>
        <button class="btn btn-sm btn-ghost" ${lbCurrentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="changeLeaderboardPage(${lbCurrentPage + 1})">Next →</button>
      </div>
    </div>
  `;
}

function changeLeaderboardPage(targetPage) {
  lbCurrentPage = targetPage;
  renderLeaderboardPage();
}

function filterLeaderboard(level, event) {
  lbCurrentPage = 1; 
  document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
  if (event) event.currentTarget.classList.add('active');
  fetchLeaderboardData(level);
}