// KVKK Gap Analizi - Ana Uygulama
// Sayfa 1: 96 kritik soru → Sayfa 2: 1296 detay (AI) → Sayfa 3: Raporlama

// ── STATE ────────────────────────────────────────────────
const STATE = {
  cevaplar96: {},      // {q_id: 'evet'|'buyuk'|'kismi'|'hayir'|'kapsam'}
  cevaplar1296: {},    // {indeks: 'evet'|'buyuk'|'kismi'|'hayir'|'kapsam'}
  aiNotes: {},         // {indeks: 'AI yorumu'}
  currentIdx: 0,
  activeFilter: 'all',
  activePage: 'sorular',
  detailFilter: { cat: 'all', cevap: 'all', search: '' }
};

const CATEGORIES = [...new Set(SORULAR_96.map(s => s.anaKat))];
const STORAGE_KEY = 'kvkk_gap_state_v1';
const API_KEY_STORAGE = 'kvkk_anthropic_api_key';

// ── PERSISTENCE ──────────────────────────────────────────
function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      cevaplar96: STATE.cevaplar96,
      cevaplar1296: STATE.cevaplar1296,
      aiNotes: STATE.aiNotes
    }));
  } catch (e) { console.warn('Storage hata:', e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    STATE.cevaplar96 = data.cevaplar96 || {};
    STATE.cevaplar1296 = data.cevaplar1296 || {};
    STATE.aiNotes = data.aiNotes || {};
  } catch (e) { console.warn('Yükleme hata:', e); }
}

// ── HELPERS ──────────────────────────────────────────────
function shortCat(c) { return c.replace(/^\d+\.\d+\.\s*/, ''); }
function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast visible ' + type;
  setTimeout(() => t.classList.remove('visible'), 3000);
}
function critBadge(k) {
  if (k === 3) return `<span class="badge badge-red">🔴 Yüksek</span>`;
  if (k === 2) return `<span class="badge badge-amber">🟡 Orta</span>`;
  return `<span class="badge badge-gray">⚪ Düşük</span>`;
}
function cevapLabel(v) {
  return { evet: 'Tamamen', buyuk: 'Büyük Oranda', kismi: 'Kısmen', hayir: 'Uygulanmıyor', kapsam: 'Kapsam Dışı' }[v] || '—';
}

// ── TABS ─────────────────────────────────────────────────
function switchTab(name) {
  STATE.activePage = name;
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.page === name));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  if (name === 'detay') renderDetayPage();
  if (name === 'rapor') renderReport();
}

// ── PAGE 1: SORULAR ──────────────────────────────────────
function buildSidebar() {
  const sb = document.getElementById('sidebar');
  let h = `<div class="sidebar-title">Kategoriler</div>`;
  h += `<div class="cat-item active" onclick="filterCat('all',this)">
    <div class="cat-label">📋 Tüm Sorular</div>
    <div class="cat-badge">${SORULAR_96.length}</div>
  </div>`;
  CATEGORIES.forEach((c, i) => {
    const count = SORULAR_96.filter(s => s.anaKat === c).length;
    h += `<div class="cat-item" onclick="filterCat('${c.replace(/'/g, "\\'")}',this)" id="cat-${i}" title="${c}">
      <div class="cat-label">${shortCat(c)}</div>
      <div class="cat-badge" id="badge-${i}">${count}</div>
    </div>`;
  });
  sb.innerHTML = h;
}

function filterCat(cat, el) {
  STATE.activeFilter = cat;
  document.querySelectorAll('.cat-item').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  const list = filteredList();
  if (list.length) STATE.currentIdx = SORULAR_96.indexOf(list[0]);
  renderQuestion();
}

function filteredList() {
  return STATE.activeFilter === 'all' ? SORULAR_96 : SORULAR_96.filter(s => s.anaKat === STATE.activeFilter);
}

function renderQuestion() {
  const q = SORULAR_96[STATE.currentIdx];
  const list = filteredList();
  const pos = list.findIndex(s => s === q);
  document.getElementById('q-nav-info').textContent = `Soru ${pos + 1} / ${list.length}`;
  document.getElementById('prev-btn').disabled = pos <= 0;
  document.getElementById('next-btn').disabled = pos >= list.length - 1;
  document.getElementById('q-section-label').textContent = q.altKat;

  const sel = STATE.cevaplar96[q.id] || null;
  const selClass = { evet: 'sel-evet', buyuk: 'sel-buyuk', kismi: 'sel-kismi', hayir: 'sel-hayir', kapsam: 'sel-kapsam' };
  const showOneri = sel === 'hayir' || sel === 'kismi' || sel === 'buyuk';
  const oneriClass = sel === 'hayir' ? 'hayir' : '';
  const oneriTitle = sel === 'hayir' ? '🔴 Öneri (Uygulanmıyor)' :
                     sel === 'buyuk' ? '🟢 Öneri (İyileştirme)' :
                     '🟡 Öneri (Kısmen Uygulanıyor)';

  document.getElementById('q-area').innerHTML = `
    <div class="q-card">
      <div class="q-meta">
        <span class="q-num">${q.tedbirNo} • S${q.id}</span>
        ${critBadge(q.kritiklik)}
        <span class="q-tedbir-label" title="${q.tedbir}">${q.tedbir}</span>
      </div>
      <div class="q-text">${q.soru}</div>
      <div class="answer-row">
        <button class="ans ${sel === 'evet' ? selClass['evet'] : ''}" onclick="answer96('evet',this)">✅ Tamamen</button>
        <button class="ans ${sel === 'buyuk' ? selClass['buyuk'] : ''}" onclick="answer96('buyuk',this)">🟢 Büyük Oranda</button>
        <button class="ans ${sel === 'kismi' ? selClass['kismi'] : ''}" onclick="answer96('kismi',this)">🟡 Kısmen</button>
        <button class="ans ${sel === 'hayir' ? selClass['hayir'] : ''}" onclick="answer96('hayir',this)">❌ Uygulanmıyor</button>
        <button class="ans ${sel === 'kapsam' ? selClass['kapsam'] : ''}" onclick="answer96('kapsam',this)">— Kapsam Dışı</button>
      </div>
      <div class="oneri-box ${oneriClass} ${showOneri ? 'visible' : ''}" id="oneri-box">
        <div class="oneri-title">${oneriTitle}</div>
        <div class="oneri-text">${q.oneri}</div>
      </div>
    </div>`;
}

function answer96(val, btn) {
  const q = SORULAR_96[STATE.currentIdx];
  STATE.cevaplar96[q.id] = val;

  // Otomatik propagate: bu sorunun parent olduğu tüm 1296 sorulara aynı cevabı uygula
  propagateAnswer(q.id, val);

  document.querySelectorAll('.ans').forEach(b => b.className = 'ans');
  btn.className = `ans sel-${val}`;

  const box = document.getElementById('oneri-box');
  if (val === 'hayir' || val === 'kismi' || val === 'buyuk') {
    box.className = `oneri-box visible ${val === 'hayir' ? 'hayir' : ''}`;
    const title = val === 'hayir' ? '🔴 Öneri (Uygulanmıyor)' :
                  val === 'buyuk' ? '🟢 Öneri (İyileştirme)' :
                  '🟡 Öneri (Kısmen Uygulanıyor)';
    box.querySelector('.oneri-title').textContent = title;
  } else {
    box.className = 'oneri-box';
  }

  updateStats();
  updateSidebarBadges();
  saveState();

  if (val === 'evet' || val === 'kapsam') {
    setTimeout(() => navigate(1), 350);
  }
}

function propagateAnswer(parentQId, val) {
  // Aynı parent'a bağlı tüm 1296 soruları aynı cevap ile doldur (eğer manuel düzeltilmediyse)
  SORULAR_1296.forEach(s => {
    if (s.p === parentQId) {
      STATE.cevaplar1296[s.i] = val;
    }
  });
}

function navigate(dir) {
  const list = filteredList();
  const pos = list.findIndex(s => s === SORULAR_96[STATE.currentIdx]);
  const np = pos + dir;
  if (np >= 0 && np < list.length) {
    STATE.currentIdx = SORULAR_96.indexOf(list[np]);
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function updateStats() {
  const ans = Object.keys(STATE.cevaplar96).length;
  const evet = Object.values(STATE.cevaplar96).filter(v => v === 'evet' || v === 'buyuk').length;
  const score = ans > 0 ? Math.round(100 * evet / ans) : null;
  const covered = Object.keys(STATE.cevaplar1296).length;
  document.getElementById('h-answered').textContent = ans;
  document.getElementById('h-score').textContent = score !== null ? score + '%' : '—';
  document.getElementById('h-covered').textContent = covered.toLocaleString('tr-TR');
  document.getElementById('prog').style.width = Math.round(100 * ans / 96) + '%';
  document.getElementById('badge-sorular').textContent = ans + '/96';
  document.getElementById('badge-detay').textContent = covered + '/1296';
}

function updateSidebarBadges() {
  CATEGORIES.forEach((c, i) => {
    const catQ = SORULAR_96.filter(s => s.anaKat === c);
    const done = catQ.filter(s => STATE.cevaplar96[s.id]);
    const el = document.getElementById(`cat-${i}`);
    if (el) {
      if (done.length === catQ.length) el.classList.add('done');
      else el.classList.remove('done');
    }
  });
}

// ── PAGE 2: 1296 DETAY ───────────────────────────────────
function renderDetayPage() {
  const cevapliCount = Object.keys(STATE.cevaplar1296).length;
  document.getElementById('detay-count').textContent = `${cevapliCount.toLocaleString('tr-TR')} / 1.296 soru değerlendirildi`;

  // Filtre seçeneklerini oluştur
  const catSelect = document.getElementById('det-cat-filter');
  if (catSelect.options.length <= 1) {
    CATEGORIES.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = shortCat(c);
      catSelect.appendChild(opt);
    });
  }

  renderDetayList();
}

function renderDetayList() {
  const { cat, cevap, search } = STATE.detailFilter;
  let filtered = SORULAR_1296;
  if (cat !== 'all') filtered = filtered.filter(s => s.ak === cat);
  if (cevap !== 'all') {
    if (cevap === 'bos') filtered = filtered.filter(s => !STATE.cevaplar1296[s.i]);
    else filtered = filtered.filter(s => STATE.cevaplar1296[s.i] === cevap);
  }
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(s => (s.q && s.q.toLowerCase().includes(q)) || (s.ta && s.ta.toLowerCase().includes(q)));
  }

  const total = filtered.length;
  document.getElementById('det-filtered-count').textContent = total.toLocaleString('tr-TR');

  // İlk 100 göster (performans için)
  const sliced = filtered.slice(0, 100);
  let h = '';
  if (!sliced.length) {
    h = `<div style="padding:3rem;text-align:center;color:var(--text2)">Bu filtrelere uygun soru bulunamadı.</div>`;
  } else {
    sliced.forEach(s => {
      const cv = STATE.cevaplar1296[s.i];
      const cvClass = cv ? 'cevap-' + cv : 'cevap-bos';
      const cvLabel = cv ? cevapLabel(cv) : '—';
      h += `<div class="det-row">
        <div class="det-id">#${s.i}</div>
        <div class="det-soru">
          <small>${s.tn} • ${shortCat(s.ak)} → ${shortCat(s.altk)}</small>
          ${s.q}
        </div>
        <div class="det-kritiklik">${critBadge(s.k)}</div>
        <div class="det-cevap ${cvClass}" onclick="cycleCevap1296(${s.i})" title="Cevabı değiştirmek için tıklayın">${cvLabel}</div>
      </div>`;
    });
    if (filtered.length > 100) {
      h += `<div style="padding:1rem;text-align:center;color:var(--text2);font-size:12px">İlk 100 soru gösteriliyor. Daha fazla filtreleyin.</div>`;
    }
  }
  document.getElementById('det-list').innerHTML = h;
}

function cycleCevap1296(idx) {
  const cycle = [null, 'evet', 'buyuk', 'kismi', 'hayir', 'kapsam'];
  const cur = STATE.cevaplar1296[idx];
  const curIdx = cycle.indexOf(cur || null);
  const next = cycle[(curIdx + 1) % cycle.length];
  if (next === null) delete STATE.cevaplar1296[idx];
  else STATE.cevaplar1296[idx] = next;
  saveState();
  renderDetayList();
  updateStats();
}

// ── AI INTEGRATION ──────────────────────────────────────
async function runAIAnalysis() {
  const apiKey = localStorage.getItem(API_KEY_STORAGE);
  if (!apiKey) {
    showAPIKeyModal();
    return;
  }
  if (Object.keys(STATE.cevaplar96).length < 5) {
    toast('En az 5 sorulara cevap vermelisiniz.', 'error');
    return;
  }

  const btn = document.getElementById('ai-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loader"></span> AI Analiz Ediyor...';

  try {
    // 96 cevabı özet halinde hazırla
    const cevapSummary = SORULAR_96
      .filter(s => STATE.cevaplar96[s.id])
      .map(s => `[${s.tedbirNo}] ${s.tedbir}: ${cevapLabel(STATE.cevaplar96[s.id])}`)
      .join('\n');

    // AI'dan yorum al
    const prompt = `Sen bir KVKK ve bilgi güvenliği uzmanısın. Aşağıda kurumun 96 kritik soruya verdiği cevaplar var. Bu cevaplara göre genel bir uyum değerlendirmesi yap ve öncelikli eylem önerileri sun (Türkçe, profesyonel, kısa ve net):

CEVAPLAR:
${cevapSummary}

Cevabını şu formatta ver:
1. Genel Durum Değerlendirmesi (2-3 cümle)
2. En Öncelikli 3 Risk Alanı
3. İlk 30 Günde Atılması Gereken Adımlar (madde madde, maksimum 5 madde)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API hatası (${response.status}): ${err.substring(0, 200)}`);
    }

    const data = await response.json();
    const yorum = data.content.filter(c => c.type === 'text').map(c => c.text).join('\n');

    STATE.aiNotes._genel = yorum;
    saveState();
    document.getElementById('ai-result').innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(6,182,212,0.1));border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:1.25rem;margin-top:1rem">
        <div style="font-size:11px;color:#a78bfa;text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:.75rem">🤖 Claude AI Değerlendirmesi</div>
        <div style="white-space:pre-line;font-size:13px;line-height:1.65;color:var(--text)">${yorum}</div>
      </div>`;
    toast('✅ AI analizi tamamlandı', 'success');
  } catch (err) {
    console.error(err);
    toast('AI hatası: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '🤖 AI ile Detaylı Analiz';
  }
}

function showAPIKeyModal() {
  const modal = document.getElementById('api-modal');
  modal.classList.add('visible');
  document.getElementById('api-key-input').value = localStorage.getItem(API_KEY_STORAGE) || '';
}

function saveAPIKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { toast('API anahtarı boş olamaz', 'error'); return; }
  if (!key.startsWith('sk-ant-')) { toast('Geçersiz Anthropic API anahtarı (sk-ant- ile başlamalı)', 'error'); return; }
  localStorage.setItem(API_KEY_STORAGE, key);
  closeAPIModal();
  toast('✅ API anahtarı kaydedildi', 'success');
}

function closeAPIModal() {
  document.getElementById('api-modal').classList.remove('visible');
}

function clearAPIKey() {
  if (!confirm('API anahtarını silmek istediğinize emin misiniz?')) return;
  localStorage.removeItem(API_KEY_STORAGE);
  document.getElementById('api-key-input').value = '';
  toast('API anahtarı silindi');
}

// ── PAGE 3: RAPOR ───────────────────────────────────────
let pieChart = null, radarChart = null, barChart = null;

function renderReport() {
  // Uyum Kartı verileri (Excel'deki gibi)
  const counts = { evet: 0, buyuk: 0, kismi: 0, hayir: 0, kapsam: 0 };
  Object.values(STATE.cevaplar1296).forEach(v => counts[v] !== undefined && counts[v]++);
  const totalAns = counts.evet + counts.buyuk + counts.kismi + counts.hayir + counts.kapsam;

  // Excel'deki risk hesabı: kritiklik × uygulama_değeri
  // uygulama_değeri: Tamamen=1, Büyük=2, Kısmen=3, Uygulanmıyor=4, Kapsam=0
  const riskDeger = { evet: 1, buyuk: 2, kismi: 3, hayir: 4, kapsam: 0 };

  // Genel uyum skoru (sadece kapsam dışı olmayanlar üzerinden)
  const kapsamIciToplam = counts.evet + counts.buyuk + counts.kismi + counts.hayir;
  const uyumSkoru = kapsamIciToplam > 0 ?
    Math.round(100 * (counts.evet * 1 + counts.buyuk * 0.75 + counts.kismi * 0.4 + counts.hayir * 0) / kapsamIciToplam) : 0;

  // Üst kartlar
  document.getElementById('report-cards').innerHTML = `
    <div class="rcard"><div class="rcard-val" style="color:var(--teal)">${uyumSkoru}%</div><div class="rcard-lbl">Genel Uyum</div><div class="rcard-sub">Ağırlıklı ortalama</div></div>
    <div class="rcard"><div class="rcard-val" style="color:var(--green)">${counts.evet}</div><div class="rcard-lbl">Tamamen</div><div class="rcard-sub">Uygulanıyor</div></div>
    <div class="rcard"><div class="rcard-val" style="color:#34d399">${counts.buyuk}</div><div class="rcard-lbl">Büyük Oranda</div><div class="rcard-sub">Uygulanıyor</div></div>
    <div class="rcard"><div class="rcard-val" style="color:var(--amber)">${counts.kismi}</div><div class="rcard-lbl">Kısmen</div><div class="rcard-sub">Uygulanıyor</div></div>
    <div class="rcard"><div class="rcard-val" style="color:var(--red)">${counts.hayir}</div><div class="rcard-lbl">Uygulanmıyor</div><div class="rcard-sub">Kritik aksiyon</div></div>
    <div class="rcard"><div class="rcard-val" style="color:var(--gray)">${counts.kapsam}</div><div class="rcard-lbl">Kapsam Dışı</div><div class="rcard-sub">Değerlendirme dışı</div></div>`;

  // Uyum Kartı (Excel formatı)
  const totalAll = totalAns;
  document.getElementById('uyum-tbody').innerHTML = `
    <tr class="uyum-row-evet"><td>✅ Tamamen Uygulanıyor</td><td>${counts.evet}</td><td>${totalAll ? Math.round(100*counts.evet/totalAll) : 0}%</td></tr>
    <tr class="uyum-row-buyuk"><td>🟢 Büyük Oranda Uygulanıyor</td><td>${counts.buyuk}</td><td>${totalAll ? Math.round(100*counts.buyuk/totalAll) : 0}%</td></tr>
    <tr class="uyum-row-kismi"><td>🟡 Kısmen Uygulanıyor</td><td>${counts.kismi}</td><td>${totalAll ? Math.round(100*counts.kismi/totalAll) : 0}%</td></tr>
    <tr class="uyum-row-hayir"><td>❌ Uygulanmıyor</td><td>${counts.hayir}</td><td>${totalAll ? Math.round(100*counts.hayir/totalAll) : 0}%</td></tr>
    <tr class="uyum-row-kapsam"><td>— Kapsam Dışı</td><td>${counts.kapsam}</td><td>${totalAll ? Math.round(100*counts.kapsam/totalAll) : 0}%</td></tr>
    <tr><td><strong>Genel Toplam</strong></td><td><strong>${totalAll}</strong></td><td><strong>100%</strong></td></tr>`;

  buildPieChart(counts);
  buildRadarChart();
  buildBarChart();
  buildRiskLists();

  // AI yorumu varsa göster
  if (STATE.aiNotes._genel) {
    document.getElementById('ai-result').innerHTML = `
      <div style="background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(6,182,212,0.1));border:1px solid rgba(139,92,246,0.3);border-radius:10px;padding:1.25rem;margin-top:1rem">
        <div style="font-size:11px;color:#a78bfa;text-transform:uppercase;letter-spacing:.6px;font-weight:600;margin-bottom:.75rem">🤖 Claude AI Değerlendirmesi</div>
        <div style="white-space:pre-line;font-size:13px;line-height:1.65;color:var(--text)">${STATE.aiNotes._genel}</div>
      </div>`;
  }
}

function buildPieChart(counts) {
  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('chart-pie'), {
    type: 'doughnut',
    data: {
      labels: ['Tamamen', 'Büyük Oranda', 'Kısmen', 'Uygulanmıyor', 'Kapsam Dışı'],
      datasets: [{
        data: [counts.evet, counts.buyuk, counts.kismi, counts.hayir, counts.kapsam],
        backgroundColor: ['#10b981', '#34d399', '#f59e0b', '#ef4444', '#64748b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyle: 'rect' } }
      }
    }
  });
}

function getAltKatScore(altKat) {
  // Alt kategoride 1296 sorudan değerlendirilenler üzerinden ağırlıklı skor
  const sorular = SORULAR_1296.filter(s => s.altk === altKat);
  if (!sorular.length) return null;
  let toplam = 0, count = 0;
  sorular.forEach(s => {
    const cv = STATE.cevaplar1296[s.i];
    if (!cv || cv === 'kapsam') return;
    count++;
    if (cv === 'evet') toplam += 100;
    else if (cv === 'buyuk') toplam += 75;
    else if (cv === 'kismi') toplam += 40;
    else if (cv === 'hayir') toplam += 0;
  });
  return count > 0 ? Math.round(toplam / count) : null;
}

function buildRadarChart() {
  // En önemli alt kategoriler (ilk 14, performans için)
  const altKats = [...new Set(SORULAR_1296.map(s => s.altk))].slice(0, 14);
  const labels = altKats.map(a => a.replace(/^\d+\.\d+\.\d+\.\s*/, '').substring(0, 25));
  const data = altKats.map(a => getAltKatScore(a) ?? 0);

  if (radarChart) radarChart.destroy();
  radarChart = new Chart(document.getElementById('chart-radar'), {
    type: 'radar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Uyum Oranı (%)',
        data: data,
        backgroundColor: 'rgba(6,182,212,0.2)',
        borderColor: '#06b6d4',
        borderWidth: 2,
        pointBackgroundColor: '#06b6d4',
        pointBorderColor: '#fff',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { color: '#64748b', backdropColor: 'transparent', font: { size: 9 } },
          grid: { color: 'rgba(255,255,255,0.08)' },
          angleLines: { color: 'rgba(255,255,255,0.08)' },
          pointLabels: { color: '#94a3b8', font: { size: 10 } }
        }
      },
      plugins: { legend: { display: false } }
    }
  });
}

function buildBarChart() {
  // Ana kategori bazlı uyum skoru
  const cats = CATEGORIES;
  const labels = cats.map(c => shortCat(c).substring(0, 30));
  const data = cats.map(cat => {
    const sorular = SORULAR_1296.filter(s => s.ak === cat);
    let toplam = 0, count = 0;
    sorular.forEach(s => {
      const cv = STATE.cevaplar1296[s.i];
      if (!cv || cv === 'kapsam') return;
      count++;
      if (cv === 'evet') toplam += 100;
      else if (cv === 'buyuk') toplam += 75;
      else if (cv === 'kismi') toplam += 40;
    });
    return count > 0 ? Math.round(toplam / count) : 0;
  });
  const colors = data.map(d => d >= 70 ? '#10b981' : d >= 40 ? '#f59e0b' : d > 0 ? '#ef4444' : '#475569');

  document.getElementById('chart-bar-wrap').style.height = (cats.length * 36 + 60) + 'px';
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('chart-bar'), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Uyum (%)',
        data: data,
        backgroundColor: colors,
        borderRadius: 4
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { color: '#94a3b8', callback: v => v + '%' }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { ticks: { color: '#94a3b8', font: { size: 11 } }, grid: { display: false } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` Uyum: %${ctx.raw}` } }
      }
    }
  });
}

function buildRiskLists() {
  // En kritik riskler (1296 üzerinden)
  const hayirlar = SORULAR_1296.filter(s => STATE.cevaplar1296[s.i] === 'hayir')
    .sort((a, b) => b.k - a.k).slice(0, 15);
  let rh = hayirlar.length === 0 ?
    '<p style="color:var(--text2);font-size:13px;padding:.5rem">Uyumsuz tedbir tespit edilmedi.</p>' : '';
  hayirlar.forEach(s => {
    rh += `<div class="risk-item">
      <div class="risk-item-title">${shortCat(s.ak)} → ${s.ta}</div>
      <div class="risk-item-text">${s.q}</div>
    </div>`;
  });
  document.getElementById('risk-list').innerHTML = rh;

  const kismilar = SORULAR_1296.filter(s => STATE.cevaplar1296[s.i] === 'kismi')
    .sort((a, b) => b.k - a.k).slice(0, 15);
  let kh = kismilar.length === 0 ?
    '<p style="color:var(--text2);font-size:13px;padding:.5rem">Kısmen uygulanan tedbir bulunmamaktadır.</p>' : '';
  kismilar.forEach(s => {
    kh += `<div class="kismi-item">
      <div class="kismi-item-title">${shortCat(s.ak)} → ${s.ta}</div>
      <div class="kismi-item-text">${s.q}</div>
    </div>`;
  });
  document.getElementById('kismi-list').innerHTML = kh;
}

// ── RESET ────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Tüm cevaplar silinecek. Emin misiniz?')) return;
  STATE.cevaplar96 = {};
  STATE.cevaplar1296 = {};
  STATE.aiNotes = {};
  STATE.currentIdx = 0;
  localStorage.removeItem(STORAGE_KEY);
  buildSidebar();
  renderQuestion();
  updateStats();
  toast('✅ Tüm veriler sıfırlandı');
}

// ── EXPORT ───────────────────────────────────────────────
function exportJSON() {
  const data = {
    tarih: new Date().toISOString(),
    cevaplar96: STATE.cevaplar96,
    cevaplar1296: STATE.cevaplar1296,
    aiNotes: STATE.aiNotes
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kvkk-gap-analizi-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('✅ Veriler indirildi');
}

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadState();
  buildSidebar();
  renderQuestion();
  updateStats();
  updateSidebarBadges();

  // Filter event listeners
  document.getElementById('det-cat-filter').addEventListener('change', e => {
    STATE.detailFilter.cat = e.target.value;
    renderDetayList();
  });
  document.getElementById('det-cevap-filter').addEventListener('change', e => {
    STATE.detailFilter.cevap = e.target.value;
    renderDetayList();
  });
  document.getElementById('det-search').addEventListener('input', e => {
    STATE.detailFilter.search = e.target.value;
    renderDetayList();
  });
});
