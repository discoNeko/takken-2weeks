// 各 data/*.js はこの TAKKEN に days / numbers を追加していく。
// file:// で直接開けるよう、JSON の fetch ではなく script 読み込みにしている。
window.TAKKEN = {
  examDate: '2026-10-18', // 令和8年度 宅地建物取引士資格試験
  cats: {
    gyoho: { name: '宅建業法', q: 20, target: 18, how: '最大の得点源。数字と「誰が・誰に・いつ」を覚えれば満点が狙える。最優先。' },
    kenri: { name: '権利関係', q: 14, target: 8, how: '深追い禁止。借地借家法・相続・区分所有法・不動産登記法など定番だけ確実に。' },
    horei: { name: '法令上の制限', q: 8, target: 6, how: '暗記科目。面積・日数・許可権者の表を丸ごと覚える。' },
    zei: { name: '税・その他', q: 8, target: 6, how: '税は頻出論点に絞る。免除科目5問は常識と暗記で4点。' },
    sogo: { name: '総復習', q: 0, target: 0, how: '' }
  },
  days: [],
  numbers: []
};
