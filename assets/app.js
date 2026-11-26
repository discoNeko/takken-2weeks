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

  // 苦手リスト: S.weak[id] = { n: 日をまたいだ連続正解数, d: 最後に正解した日 }。
  // 解説を読んだ直後の正解では卒業させず、別の日に2回続けて正解したら外す。
  // 旧バージョンの値(1)は n=0 として扱う。
  var GRADUATE = 2;
  function weakEntry(id) {
    var w = S.weak[id];
    return w && typeof w === 'object' ? w : { n: 0, d: '' };
  }
  function markWrong(id) { S.weak[id] = { n: 0, d: '' }; }
  function markRight(id) {
    if (!S.weak[id]) return;
    var w = weakEntry(id), today = iso(new Date());
    if (w.d === today) return; // 同じ日の正解は数えない
    w = { n: w.n + 1, d: today };
    if (w.n >= GRADUATE) delete S.weak[id]; else S.weak[id] = w;
  }

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
      (showDay ? '<a href="#/day/' + q.day + '">Day ' + q.day + '</a>' : '') +
      (view.name === 'review' && S.weak[id] ? '<span>卒業まで ' + (GRADUATE - weakEntry(id).n) + ' 日</span>' : '') + '</div>' +
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
    // ○×の正答率は本試験(四肢択一・個数問題)の得点に換算できないので、合否の目安は出さない
    var msg = rate >= 0.9 ? '基礎の○×は固まっています。次は「四肢演習」と公式の過去問で、本試験形式の得点を確かめましょう。'
      : '○×で9割に届くまでは、苦手リストと講義の読み直しを優先しましょう。';
    return '<div style="flex-basis:100%"><div class="scroll"><table><tbody>' + rows + '</tbody></table></div>' +
      '<p>○×正答率 <b>' + Math.round(rate * 100) + '%</b> — ' + msg + '</p>' +
      '<p class="note-s">○×で8割正解できても、4肢すべてを正しく判定する個数問題では正答率が4割前後まで落ちます(0.8の4乗≒0.41)。この結果を合格可能性の目安にはしないでください。 <a href="#/drill">四肢演習へ →</a></p></div>';
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
    if (correct) markRight(id); else markWrong(id);
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
      '<li>Day 14 と前日は「模試」で○×を総点検し、「四肢演習」で本試験形式に慣れる。</li></ol>' +

      '<h2>14日のあと:過去問で得点力をつける</h2>' +
      '<p>この14日間は全範囲を一周して土台を作る期間です。○×で覚えた知識を本試験の点数にするには、四肢択一の過去問演習が欠かせません。令和8年度の本試験は個数問題10問・組合せ問題5問で、選択肢を1つずつ確実に判定する力が問われました。</p>' +
      '<ol><li><a href="https://www.retio.or.jp/exam/past_ques_ans/other/" target="_blank" rel="noopener">公式の過去問(不動産適正取引推進機構)</a>を1年分ずつ、<b>2時間</b>を計って解く。</li>' +
      '<li>採点したら、間違えた肢だけでなく<b>正解した問題の他の肢</b>も、どこが誤りか言えるか確認する。</li>' +
      '<li>言えなかった論点は該当 Day の講義に戻り、一問一答と四肢演習で固め直す。</li>' +
      '<li>目標は直近の年度で<b>38点</b>以上(合格点は令和7・8年度とも33点)。</li></ol>' +

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
      '<p class="lead">間違えた問題が残ります。<b>日をまたいで' + GRADUATE + '回続けて正解</b>すると外れます(同じ日の2回目以降の正解は数えません。間違えるとやり直し)。</p>' +
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
      '<p class="lead">本試験と同じ科目配分(業法20・権利14・法令8・税その他8)で全問題から出題する○×の総点検です。目安は25分。本試験形式の練習は <a href="#/drill">四肢演習</a> で。</p>' +
      quizHTML(true) +
      '<p><button type="button" class="btn" id="newExam">問題を入れ替えてもう一度</button></p>';
  }

  // ---------- 四肢演習 ----------
  // 既存の○×問題を4つ組み合わせ、本試験の形式(個数・組合せ・正しい/誤っているもの)で出題する。
  var KANA = ['ア', 'イ', 'ウ', 'エ'];
  var KOSU = ['一つ', '二つ', '三つ', '四つ'];
  var PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
  var DRILL_TYPES = [ // w: 出題の重み。本試験より個数・組合せを多めにして慣れさせる
    { key: 'kosu', w: 35, label: '個数問題', stem: '次の記述のうち、正しいものはいくつあるか。' },
    { key: 'kumi', w: 15, label: '組合せ問題', stem: '次の記述のうち、正しいものの組合せはどれか。' },
    { key: 'sei', w: 25, label: '正しいもの', stem: '次の記述のうち、正しいものはどれか。' },
    { key: 'go', w: 25, label: '誤っているもの', stem: '次の記述のうち、誤っているものはどれか。' }
  ];
  var drill = null;

  function pickType() {
    var r = Math.random() * 100, acc = 0;
    for (var i = 0; i < DRILL_TYPES.length; i++) { acc += DRILL_TYPES[i].w; if (r < acc) return DRILL_TYPES[i]; }
    return DRILL_TYPES[0];
  }
  function randInt(n) { return Math.floor(Math.random() * n); }

  // 科目ごとに○/×の山を作り、上から引く。山が尽きたら切り直す(1問の中では同じ肢を使わない)
  function makeDealer(cat) {
    var all = Object.keys(Q).filter(function (id) { return Q[id].cat === cat; });
    var src = { T: all.filter(function (id) { return Q[id].a; }), F: all.filter(function (id) { return !Q[id].a; }) };
    var deck = { T: [], F: [] };
    return function (truth, used) {
      var k = truth ? 'T' : 'F';
      for (var tries = 0; tries < 2; tries++) {
        for (var i = 0; i < deck[k].length; i++) {
          if (used.indexOf(deck[k][i]) === -1) return deck[k].splice(i, 1)[0];
        }
        deck[k] = shuffle(src[k]);
      }
      return null;
    };
  }

  function makeProblem(cat, deal) {
    var type = pickType();
    var nTrue = type.key === 'kosu' ? 1 + randInt(4) : type.key === 'kumi' ? 2 : type.key === 'sei' ? 1 : 3;
    var truths = shuffle([0, 1, 2, 3].map(function (i) { return i < nTrue; }));
    var ids = [];
    for (var i = 0; i < 4; i++) {
      var id = deal(truths[i], ids);
      if (!id) return null;
      ids.push(id);
    }
    var choices, answer;
    if (type.key === 'kosu') {
      choices = KOSU.slice(); answer = nTrue - 1;
    } else if (type.key === 'kumi') {
      var right = [0, 1, 2, 3].filter(function (i) { return truths[i]; });
      var correct = PAIRS.filter(function (p) { return p[0] === right[0] && p[1] === right[1]; })[0];
      var others = shuffle(PAIRS.filter(function (p) { return p !== correct; })).slice(0, 3);
      var four = others.concat([correct]).sort(function (a, b) { return PAIRS.indexOf(a) - PAIRS.indexOf(b); });
      choices = four.map(function (p) { return KANA[p[0]] + '、' + KANA[p[1]]; });
      answer = four.indexOf(correct);
    } else {
      choices = ['1', '2', '3', '4'];
      answer = truths.indexOf(type.key === 'sei');
    }
    return { cat: cat, type: type.key, ids: ids, choices: choices, answer: answer, pick: null, memo: {} };
  }

  function newDrill(cat, size) {
    var plan = []; // 出題する科目の並び
    if (size === 50) {
      EXAM_CATS.forEach(function (c) { for (var i = 0; i < CATS[c].q; i++) plan.push(c); });
    } else {
      for (var i = 0; i < size; i++) plan.push(cat === 'all' ? EXAM_CATS[randInt(EXAM_CATS.length)] : cat);
      if (cat === 'all') plan.sort(function (a, b) { return EXAM_CATS.indexOf(a) - EXAM_CATS.indexOf(b); });
    }
    var dealers = {};
    var probs = plan.map(function (c) {
      if (!dealers[c]) dealers[c] = makeDealer(c);
      return makeProblem(c, dealers[c]);
    }).filter(Boolean);
    drill = { cat: cat, size: size, probs: probs };
  }

  function drillTypeOf(p) { return DRILL_TYPES.filter(function (t) { return t.key === p.type; })[0]; }
  function stmtLabel(p, k) { return p.type === 'sei' || p.type === 'go' ? String(k + 1) : KANA[k]; }

  function drillCard(p, n) {
    var done = p.pick !== null;
    var ok = done && p.pick === p.answer;
    var stmts = p.ids.map(function (id, k) {
      var q = Q[id], m = p.memo[k];
      var memoBtns = '<span class="jm">' +
        '<button type="button" data-memo="' + k + '" data-v="1"' + (m === true ? ' class="picked"' : '') + (done ? ' disabled' : '') + ' aria-label="○と判断">○</button>' +
        '<button type="button" data-memo="' + k + '" data-v="0"' + (m === false ? ' class="picked"' : '') + (done ? ' disabled' : '') + ' aria-label="×と判断">×</button></span>';
      var res = done ? '<div class="st-ex' + (m === undefined ? '' : m === q.a ? ' ok' : ' ng') + '"><b>' + (q.a ? '○ 正しい' : '× 誤り') + '</b>' +
        (m === undefined ? '' : m === q.a ? '(判断どおり)' : '(判断と違う → 苦手リストへ)') +
        ' <a href="#/day/' + q.day + '">Day ' + q.day + '</a><p>' + q.ex + '</p></div>' : '';
      return '<li><div class="st-row"><span class="st-l">' + stmtLabel(p, k) + '</span><span class="st-t">' + q.q + '</span>' + memoBtns + '</div>' + res + '</li>';
    }).join('');
    var choices = p.choices.map(function (c, j) {
      var cls = done && j === p.answer ? ' class="right"' : done && j === p.pick ? ' class="picked"' : '';
      return '<button type="button" data-choice="' + j + '"' + cls + (done ? ' disabled' : '') + '>' + (j + 1) + '. ' + c + '</button>';
    }).join('');
    return '<article class="q dq' + (done ? (ok ? ' ok' : ' ng') : '') + '" data-p="' + (n - 1) + '">' +
      '<div class="q-head"><span class="q-no">問' + n + '</span>' + chip(p.cat) + '<span>' + drillTypeOf(p).label + '</span></div>' +
      '<p class="q-text">' + drillTypeOf(p).stem + '</p>' +
      '<ol class="stmts">' + stmts + '</ol>' +
      '<div class="q-btns choices">' + choices + '</div>' +
      (done ? '<div class="q-ex"><strong>' + (ok ? '正解' : '不正解') + '(正解は ' + (p.answer + 1) + ')</strong></div>' : '') +
      '</article>';
  }

  function drillScoreHTML() {
    var done = 0, ok = 0;
    drill.probs.forEach(function (p) { if (p.pick !== null) { done++; if (p.pick === p.answer) ok++; } });
    var h = '<span>解答 <b>' + done + '/' + drill.probs.length + '</b></span><span>正解 <b>' + ok + '</b></span>';
    if (done) h += '<span>正答率 <b>' + Math.round(ok / done * 100) + '%</b></span>';
    if (done === drill.probs.length) {
      var rows = EXAM_CATS.map(function (c) {
        var ps = drill.probs.filter(function (p) { return p.cat === c; });
        if (!ps.length) return '';
        var k = ps.filter(function (p) { return p.pick === p.answer; }).length;
        return '<tr><th>' + CATS[c].name + '</th><td>' + k + ' / ' + ps.length + '</td></tr>';
      }).join('');
      h += '<div style="flex-basis:100%"><div class="scroll"><table><tbody>' + rows + '</tbody></table></div>' +
        (drill.size === 50 ? '<p><b>' + ok + ' / 50点</b>(令和7・8年度の合格点は33点)。肢は一問一答で見たことがある文なので、本試験より易しめに出ます。38点以上を安定して取れたら、公式の過去問で確かめましょう。</p>'
          : '<p>判断が外れた肢は苦手リストに入っています。</p>') + '</div>';
    }
    return h;
  }

  function viewDrill() {
    view = null;
    var catOpts = '<option value="all">全科目ミックス</option>' + EXAM_CATS.map(function (c) {
      return '<option value="' + c + '"' + (drill && drill.cat === c ? ' selected' : '') + '>' + CATS[c].name + '</option>';
    }).join('');
    var setup = '<div class="tools drill-setup">' +
      '<label>科目 <select id="drillCat">' + catOpts + '</select></label>' +
      '<label>問題数 <select id="drillSize"><option value="10">10問</option><option value="20">20問</option>' +
      '<option value="50"' + (drill && drill.size === 50 ? ' selected' : '') + '>本試験配分 50問(科目指定は無視)</option></select></label>' +
      '<button type="button" class="btn" id="drillStart">' + (drill ? '新しいセットで始める' : '始める') + '</button></div>';
    app.innerHTML = '<h1>四肢演習</h1>' +
      '<p class="lead">一問一答の文を4つ組み合わせ、本試験と同じ形式(個数・組合せ・正しいもの・誤っているもの)で出題します。' +
      '各肢の右の ○ × で自分の判断をメモしてから答えると、判断が外れた肢が苦手リストに入ります。50問なら目安は2時間です。</p>' +
      setup +
      (drill ? '<div class="score" id="score">' + drillScoreHTML() + '</div>' +
        drill.probs.map(function (p, i) { return drillCard(p, i + 1); }).join('') : '');
  }

  function drillMemo(btn) {
    var el = btn.closest('.dq'), p = drill.probs[+el.getAttribute('data-p')];
    if (p.pick !== null) return;
    var k = +btn.getAttribute('data-memo'), v = btn.getAttribute('data-v') === '1';
    if (p.memo[k] === v) delete p.memo[k]; else p.memo[k] = v; // 同じボタンをもう一度押すと取り消し
    el.outerHTML = drillCard(p, +el.getAttribute('data-p') + 1);
  }

  function drillAnswer(btn) {
    var el = btn.closest('.dq'), i = +el.getAttribute('data-p'), p = drill.probs[i];
    if (p.pick !== null) return;
    p.pick = +btn.getAttribute('data-choice');
    p.ids.forEach(function (id, k) {
      var m = p.memo[k];
      if (m === undefined) return;
      if (m === Q[id].a) markRight(id); else markWrong(id);
    });
    save();
    el.outerHTML = drillCard(p, i + 1);
    document.getElementById('score').innerHTML = drillScoreHTML();
    updateNav();
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
    else if (parts[0] === 'drill') { name = 'drill'; viewDrill(); }
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

    var memoBtn = t.closest('[data-memo]');
    if (memoBtn && drill) { drillMemo(memoBtn); return; }
    var choiceBtn = t.closest('[data-choice]');
    if (choiceBtn && drill) { drillAnswer(choiceBtn); return; }
    if (t.id === 'drillStart') {
      newDrill(document.getElementById('drillCat').value, +document.getElementById('drillSize').value);
      viewDrill(); return;
    }

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
