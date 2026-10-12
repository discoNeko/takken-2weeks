(function () {
  'use strict';

  var T = window.TAKKEN;
  var DAYS = T.days.slice().sort(function (a, b) { return a.day - b.day; });
  var CATS = T.cats;
  var EXAM_CATS = Object.keys(CATS).filter(function (c) { return CATS[c].q > 0; });
  var KEY = 'takken2w:v1';
  var app = document.getElementById('app');

  // ---------- utils ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { var p = String(s).split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(parseDate(s)); }
  function diffDays(from, to) { return Math.round((parseDate(to) - parseDate(from)) / 86400000); }
  function addDays(s, n) { var d = parseDate(s); d.setDate(d.getDate() + n); return d; }
  function md(d) { return (d.getMonth() + 1) + '/' + d.getDate() + '(' + '日月火水木金土'[d.getDay()] + ')'; }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function chip(cat) { return '<span class="chip c-' + cat + '">' + CATS[cat].name + '</span>'; }

  // ---------- state ----------
  function defaults() {
    return { examDate: T.examDate, startDate: iso(new Date()), read: {}, ans: {}, weak: {}, theme: '' };
  }
  function load() {
    var d = defaults();
    try {
      var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (raw && typeof raw === 'object') {
        Object.keys(d).forEach(function (k) { if (raw[k] != null) d[k] = raw[k]; });
      }
    } catch (e) { /* 保存領域が使えなくても表示は続ける */ }
    return d;
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 同上 */ }
  }
  var S = load();
  save();

  // ---------- question index ----------
  var Q = {};
  var byDay = {};
  DAYS.forEach(function (d) {
    byDay[d.day] = d;
    d.quiz.forEach(function (q, i) {
      var id = d.day + '-' + i;
      Q[id] = { id: id, day: d.day, cat: q.cat || d.cat, q: q.q, a: q.a, ex: q.ex };
    });
  });

  function dayStat(d) {
    var read = 0, done = 0, ok = 0;
    d.sections.forEach(function (s, i) { if (S.read[d.day + '-' + i]) read++; });
    d.quiz.forEach(function (q, i) {
      var v = S.ans[d.day + '-' + i];
      if (v != null) { done++; if (v) ok++; }
    });
    return {
      read: read, sections: d.sections.length, done: done, ok: ok, total: d.quiz.length,
      complete: read === d.sections.length && done === d.quiz.length
    };
  }
  function weakIds() { return Object.keys(S.weak).filter(function (id) { return Q[id]; }); }

  // ---------- quiz ----------
  // view: 現在表示中の問題リスト。picks[id] は true(○を選択) / false(×を選択)
  var view = null;

  function card(id, n, showDay) {
    var q = Q[id];
    var picked = view.picks[id];
    var answered = picked !== undefined;
    var correct = answered && picked === q.a;
    return '<article class="q' + (answered ? (correct ? ' ok' : ' ng') : '') + '" data-q="' + id + '" data-n="' + n + '">' +
      '<div class="q-head"><span class="q-no">Q' + n + '</span>' + chip(q.cat) +
      (showDay ? '<a href="#/day/' + q.day + '">Day ' + q.day + '</a>' : '') + '</div>' +
      '<p class="q-text">' + q.q + '</p>' +
      '<div class="q-btns">' +
      '<button type="button" data-pick="1"' + (answered ? ' disabled' : '') + (picked === true ? ' class="picked"' : '') + '>○ 正しい</button>' +
      '<button type="button" data-pick="0"' + (answered ? ' disabled' : '') + (picked === false ? ' class="picked"' : '') + '>× 誤り</button>' +
      '</div>' +
      (answered ? '<div class="q-ex"><strong>' + (correct ? '正解' : '不正解') + '(答えは' + (q.a ? '○' : '×') + ')</strong><p>' + q.ex + '</p></div>' : '') +
      '</article>';
  }

  function tally(ids) {
    var done = 0, ok = 0;
    ids.forEach(function (id) {
      var p = view.picks[id];
      if (p !== undefined) { done++; if (p === Q[id].a) ok++; }
    });
    return { done: done, ok: ok, total: ids.length };
  }

  function scoreHTML() {
    var t = tally(view.ids);
    var h = '<span>解答 <b>' + t.done + '/' + t.total + '</b></span><span>正解 <b>' + t.ok + '</b></span>';
    if (t.done) h += '<span>正答率 <b>' + Math.round(t.ok / t.done * 100) + '%</b></span>';
    if (view.name === 'exam' && t.done === t.total) h += examResult();
    return h;
  }

  function examResult() {
    var rows = EXAM_CATS.map(function (c) {
      var ids = view.ids.filter(function (id) { return Q[id].cat === c; });
      var t = tally(ids);
      return '<tr><th>' + CATS[c].name + '</th><td>' + t.ok + ' / ' + t.total + '</td><td>目標 ' +
        Math.round(CATS[c].target / CATS[c].q * 100) + '%</td></tr>';
    }).join('');
    var all = tally(view.ids);
    var rate = all.ok / all.total;
    var msg = rate >= 0.76 ? '合格圏です。間違えた問題だけ潰して本番へ。'
      : rate >= 0.68 ? 'ボーダー付近。苦手リストを空にしてからもう一度。'
        : 'まだ足りません。得点源の宅建業法から復習を。';
    return '<div style="flex-basis:100%"><div class="scroll"><table><tbody>' + rows + '</tbody></table></div>' +
      '<p><b>' + Math.round(rate * 100) + '%</b>(50問換算で約' + Math.round(rate * 50) + '点)— ' + msg + '</p></div>';
  }

  function quizHTML(showDay) {
    return '<div class="score" id="score">' + scoreHTML() + '</div>' +
      view.ids.map(function (id, i) { return card(id, i + 1, showDay); }).join('');
  }

  function answer(cardEl, pick) {
    var id = cardEl.getAttribute('data-q');
    if (view.picks[id] !== undefined) return;
    var correct = pick === Q[id].a;
    view.picks[id] = pick;
    S.ans[id] = correct ? 1 : 0;
    if (correct) delete S.weak[id]; else S.weak[id] = 1;
    save();
    cardEl.outerHTML = card(id, +cardEl.getAttribute('data-n'), view.showDay);
    document.getElementById('score').innerHTML = scoreHTML();
    updateNav();
  }

  // ---------- views ----------
  function viewHome() {
    view = null;
    var today = iso(new Date());
    var left = diffDays(today, S.examDate);
    var dayNo = diffDays(S.startDate, today) + 1;
    var cur = Math.min(Math.max(dayNo, 1), DAYS.length);

    var totalSec = 0, readSec = 0, totalQ = 0, okQ = 0;
    DAYS.forEach(function (d) {
      var s = dayStat(d);
      totalSec += s.sections; readSec += s.read; totalQ += s.total; okQ += s.ok;
    });
    var pct = Math.round((readSec + okQ) / (totalSec + totalQ) * 100);

    var status = dayNo < 1 ? '開始日前です。先取りして Day 1 から始めても構いません。'
      : dayNo > DAYS.length ? '14日分の日程は終了。苦手リストと模試で仕上げましょう。'
        : '今日は <b>Day ' + cur + '</b>:' + esc(byDay[cur].title);

    var cards = DAYS.map(function (d) {
      var s = dayStat(d);
      return '<a class="day' + (d.day === cur && dayNo >= 1 && dayNo <= DAYS.length ? ' today' : '') + '" href="#/day/' + d.day +
        '" style="--cat:var(--' + d.cat + ')">' +
        '<div class="meta"><span class="no">Day ' + d.day + '</span><span>' + md(addDays(S.startDate, d.day - 1)) + ' ・ 約' + d.minutes + '分</span></div>' +
        '<div class="t">' + esc(d.title) + '</div>' +
        '<div class="st">' + chip(d.cat) +
        (s.complete ? '<span class="done">✓ 完了 ' + s.ok + '/' + s.total + '</span>'
          : '<span>読了 ' + s.read + '/' + s.sections + '</span><span>問題 ' + s.done + '/' + s.total + '</span>') +
        '</div></a>';
    }).join('');

    var strat = EXAM_CATS.map(function (c) {
      return '<tr><th>' + chip(c) + '</th><td>' + CATS[c].q + '問</td><td><b>' + CATS[c].target + '点</b></td><td>' + CATS[c].how + '</td></tr>';
    }).join('');
    var sumQ = 0, sumT = 0;
    EXAM_CATS.forEach(function (c) { sumQ += CATS[c].q; sumT += CATS[c].target; });

    app.innerHTML =
      '<section class="hero">' +
      '<div class="count"><div class="n">' + (left >= 0 ? left : 0) + '</div><div class="l">試験まであと(日)</div></div>' +
      '<div><p>' + status + '</p>' +
      '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
      '<p style="font-size:13px;color:var(--muted)">全体の進み ' + pct + '%(読了 ' + readSec + '/' + totalSec + ' ・ 正解 ' + okQ + '/' + totalQ + '問)</p>' +
      '<div class="dates">' +
      '<label>学習開始日 <input type="date" id="startDate" value="' + esc(S.startDate) + '"></label>' +
      '<label>試験日 <input type="date" id="examDate" value="' + esc(S.examDate) + '"></label>' +
      '</div></div></section>' +

      '<h2>14日間の進め方</h2>' +
      '<div class="days">' + cards + '</div>' +

      '<h2>得点戦略:50問中 ' + sumT + '点を取りに行く</h2>' +
      '<div class="scroll"><table><thead><tr><th>科目</th><th>出題数</th><th>目標</th><th>攻め方</th></tr></thead><tbody>' + strat +
      '<tr><th>合計</th><td>' + sumQ + '問</td><td><b>' + sumT + '点</b></td><td>例年の合格点は33〜38点前後。</td></tr></tbody></table></div>' +

      '<h2>1日の回し方</h2>' +
      '<ol><li>その日のページを上から読む(読み終えた節にチェック)。</li>' +
      '<li>すぐ下の一問一答を解く。間違えた問題は自動で「苦手」に入る。</li>' +
      '<li>寝る前に「苦手」を空にする。翌朝は「数字暗記」を数字を隠して5分。</li>' +
      '<li>Day 14 と前日は「模試」を回し、過去問(直近3年分)を時間を計って解く。</li></ol>' +

      '<p style="margin-top:32px"><button type="button" class="btn ghost" id="resetAll">学習記録をすべて消す</button></p>';
  }

  function viewDay(n) {
    var d = byDay[n];
    var picks = {};
    d.quiz.forEach(function (q, i) {
      var id = d.day + '-' + i, v = S.ans[id];
      if (v != null) picks[id] = v ? q.a : !q.a;
    });
    view = { name: 'day', day: n, ids: d.quiz.map(function (q, i) { return d.day + '-' + i; }), picks: picks, showDay: false };

    var secs = d.sections.map(function (s, i) {
      var id = d.day + '-' + i;
      return '<details class="sec" open><summary>' + esc(s.h) + '</summary>' +
        '<div class="body">' + s.html +
        '<label class="rd"><input type="checkbox" data-read="' + id + '"' + (S.read[id] ? ' checked' : '') + '>この節を読んだ</label></div></details>';
    }).join('');

    app.innerHTML =
      '<p class="crumb"><a href="#/">ホーム</a> / Day ' + d.day + '</p>' +
      '<h1>Day ' + d.day + ' ' + esc(d.title) + '</h1>' +
      '<p class="lead">' + chip(d.cat) + ' 目安 ' + d.minutes + '分 ・ ' + esc(d.goal) + '</p>' +
      secs +
      '<h2>一問一答(' + d.quiz.length + '問)</h2>' +
      quizHTML(false) +
      '<p><button type="button" class="btn ghost" id="resetDay">この日の解答をやり直す</button></p>' +
      '<div class="pager">' +
      (byDay[n - 1] ? '<a class="btn ghost" href="#/day/' + (n - 1) + '">← Day ' + (n - 1) + '</a>' : '<span></span>') +
      (byDay[n + 1] ? '<a class="btn" href="#/day/' + (n + 1) + '">Day ' + (n + 1) + ' →</a>' : '<a class="btn" href="#/exam">模試へ →</a>') +
      '</div>';
  }

  function viewReview() {
    view = { name: 'review', ids: shuffle(weakIds()), picks: {}, showDay: true };
    app.innerHTML = '<h1>苦手リスト</h1>' +
      '<p class="lead">間違えた問題だけが残ります。正解すると次に開いたとき消えます。</p>' +
      (view.ids.length ? quizHTML(true) + '<p><a class="btn ghost" href="#/review" id="reloadReview">残りをもう一周</a></p>'
        : '<p class="empty">苦手リストは空です。この調子で次の Day へ。</p>');
  }

  var exam = null; // 模試は画面を行き来しても同じ問題セットを保つ
  function newExam() {
    var ids = [];
    EXAM_CATS.forEach(function (c) {
      var pool = Object.keys(Q).filter(function (id) { return Q[id].cat === c; });
      ids = ids.concat(shuffle(pool).slice(0, CATS[c].q));
    });
    exam = { ids: ids, picks: {} };
  }
  function viewExam() {
    if (!exam) newExam();
    view = { name: 'exam', ids: exam.ids, picks: exam.picks, showDay: true };
    app.innerHTML = '<h1>ランダム模試(' + exam.ids.length + '問)</h1>' +
      '<p class="lead">本試験と同じ科目配分(業法20・権利14・法令8・税その他8)で全問題から出題します。一問一答形式なので、目安は25分。</p>' +
      quizHTML(true) +
      '<p><button type="button" class="btn" id="newExam">問題を入れ替えてもう一度</button></p>';
  }

  function viewNumbers() {
    view = null;
    var groups = Object.keys(CATS).map(function (c) {
      var rows = T.numbers.filter(function (x) { return x.cat === c; });
      if (!rows.length) return '';
      return '<section class="num-g"><h2>' + chip(c) + '</h2><div class="scroll"><table class="nums"><tbody>' + rows.map(function (x) {
        return '<tr data-text="' + esc((x.k + ' ' + x.v + ' ' + (x.note || '')).toLowerCase()) + '"><th>' + esc(x.k) +
          '</th><td><span class="num-v">' + esc(x.v) + '</span></td><td class="note">' + esc(x.note || '') + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
    }).join('');
    app.innerHTML = '<h1>数字暗記シート</h1>' +
      '<p class="lead">宅建は数字の入れ替えで誤りの選択肢が作られます。「数字を隠す」にして、見出しから数字を言えるか確認(タップで表示)。</p>' +
      '<div class="tools"><input type="search" id="numFilter" placeholder="絞り込み(例:2週間、保証金、届出)">' +
      '<button type="button" class="btn ghost" id="numHide">数字を隠す</button></div>' +
      '<div id="numBody">' + groups + '</div>';
  }

  // ---------- routing ----------
  function route() {
    var parts = location.hash.replace(/^#\/?/, '').split('/');
    var name = 'home';
    if (parts[0] === 'day' && byDay[+parts[1]]) { name = 'day'; viewDay(+parts[1]); }
    else if (parts[0] === 'numbers') { name = 'numbers'; viewNumbers(); }
    else if (parts[0] === 'review') { name = 'review'; viewReview(); }
    else if (parts[0] === 'exam') { name = 'exam'; viewExam(); }
    else viewHome();
    app.className = '';
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (a) {
      a.classList.toggle('on', a.getAttribute('data-nav') === name);
    });
    updateNav();
    window.scrollTo(0, 0);
  }

  function updateNav() {
    var n = weakIds().length;
    var el = document.getElementById('weakCount');
    el.hidden = n === 0;
    el.textContent = n;
  }

  // ---------- events ----------
  app.addEventListener('click', function (e) {
    var t = e.target;
    var pickBtn = t.closest('[data-pick]');
    if (pickBtn && view) { answer(pickBtn.closest('.q'), pickBtn.getAttribute('data-pick') === '1'); return; }

    if (t.classList.contains('num-v')) { t.classList.toggle('show'); return; }

    if (t.id === 'resetDay' && view && view.name === 'day') {
      view.ids.forEach(function (id) { delete S.ans[id]; });
      save(); viewDay(view.day); return;
    }
    if (t.id === 'newExam') { newExam(); viewExam(); window.scrollTo(0, 0); return; }
    if (t.id === 'reloadReview') { e.preventDefault(); viewReview(); window.scrollTo(0, 0); return; }
    if (t.id === 'numHide') {
      var hidden = app.classList.toggle('hide-nums');
      t.textContent = hidden ? '数字を表示する' : '数字を隠す';
      Array.prototype.forEach.call(app.querySelectorAll('.num-v.show'), function (el) { el.classList.remove('show'); });
      return;
    }
    if (t.id === 'resetAll') {
      if (window.confirm('読了チェック・解答・苦手リストをすべて消します。よろしいですか?')) {
        var theme = S.theme;
        S = defaults(); S.theme = theme; exam = null;
        save(); route();
      }
    }
  });

  app.addEventListener('change', function (e) {
    var t = e.target;
    var rid = t.getAttribute('data-read');
    if (rid) {
      if (t.checked) S.read[rid] = 1; else delete S.read[rid];
      save(); return;
    }
    if ((t.id === 'startDate' || t.id === 'examDate') && validDate(t.value)) {
      S[t.id] = t.value; save(); viewHome();
    }
  });

  app.addEventListener('input', function (e) {
    if (e.target.id !== 'numFilter') return;
    var kw = e.target.value.trim().toLowerCase();
    Array.prototype.forEach.call(app.querySelectorAll('#numBody tr'), function (tr) {
      tr.hidden = kw !== '' && tr.getAttribute('data-text').indexOf(kw) === -1;
    });
    Array.prototype.forEach.call(app.querySelectorAll('.num-g'), function (g) {
      g.hidden = !g.querySelector('tr:not([hidden])');
    });
  });

  function applyTheme() {
    if (S.theme) document.documentElement.setAttribute('data-theme', S.theme);
    else document.documentElement.removeAttribute('data-theme');
  }
  document.getElementById('themeBtn').addEventListener('click', function () {
    var dark = S.theme ? S.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    S.theme = dark ? 'light' : 'dark';
    save(); applyTheme();
  });

  applyTheme();
  window.addEventListener('hashchange', route);
  route();
})();
