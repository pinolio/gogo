/*
 * gogo?gogo! — 비속어 모자이크 (GoFilter)
 *  - GoFilter.html(text)  : 안전한 HTML. 비속어 부분은 <span class="mosaic"> 로 가려짐
 *  - GoFilter.has(text)   : 비속어가 들어 있으면 true
 *  - 띄어쓰기·특수문자·숫자를 끼워 넣어 피하는 경우(시.발, 씨 1 발)도 찾습니다.
 *  - 원문은 그대로 저장되고, 화면에서만 가려집니다. (관리자 화면에서는 원문 확인 가능)
 *  - 단어 추가: 아래 WORDS 목록에 넣으면 됩니다. (자음만 쓰는 줄임말은 JAMO 목록)
 */
(function () {
  'use strict';
  // 글자 사이에 공백·기호가 끼어도 찾는 단어들
  const WORDS = [
    '시발', '씨발', '씨빨', '시빨', '씨바', '씨팔', '시팔', '씨벌', '시벌', '쓰발', '쓰벌', '씌발', '싀발', '십발', '십팔', '씹', '십새', '십쌔',
    '병신', '븅신', '빙신', '병쉰', '비융신', '등신',
    '좆', '좃', '존나', '졸라', '존내', '좆나', '조까', '좆까',
    '개새', '개색', '개세끼', '개쉐', '개섀', '개시키', '새끼', '쌔끼', '새키', '색기', '쉐끼', '섀끼',
    '미친놈', '미친년', '미친새', '미친개', '미쳤냐', '또라이', '돌아이',
    '지랄', '염병', '옘병', '썅', '쌍놈', '쌍년', '상놈', '잡놈', '잡년', '걸레년',
    '닥쳐', '닥치', '꺼져', '엠창', '느금', '니애미', '니어미', '니미', '애미', '에미', '애비', '느그', '니엄마',
    '호로새', '호로자', '후레자', '엿먹', '대가리', '빡대', '찐따', '장애인새', '한남충', '김치녀', '메갈', '일베',
    '섹스', '야동', '딸딸', '후장', '보짓', '자짓',
    'fuck', 'fuk', 'fck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'porn', 'sex', 'nigg', 'motherf', 'wtf', 'stfu'
  ];
  // 자음만으로 쓰는 욕 (이 글자들이 이어질 때만)
  const JAMO = ['ㅅㅂ', 'ㅆㅂ', 'ㅂㅅ', 'ㅄ', 'ㅈㄹ', 'ㅁㅊ', 'ㅈㄴ', 'ㄱㅅㄲ', 'ㅅㄲ', 'ㄲㅈ', 'ㅗ', 'ㅈ같', 'ㅆ발', 'ㅅ발', 'ㅂ신'];
  // '18'은 다른 말(18점 등)에 많이 쓰여서 뒤에 욕이 붙을 때만
  const EXTRA = [/1\s*8\s*(놈|년|새|색|아|련)/gi, /개\s*같/g, /존\s*[1l]\s*나/g];

  const isLetter = ch => /[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]/.test(ch);
  const norm = ch => ch.toLowerCase();

  // 원문 → (글자만 모은 문자열, 각 글자의 원래 위치)
  function strip(text) {
    let s = '', map = [];
    for (let i = 0; i < text.length; i++) { const ch = text[i]; if (isLetter(ch)) { s += norm(ch); map.push(i); } }
    return { s, map };
  }

  function ranges(text) {
    text = String(text || '');
    const out = [], { s, map } = strip(text);
    const add = (a, b) => { if (a < b) out.push([a, b]); };
    WORDS.concat(JAMO).forEach(w => {
      let i = s.indexOf(w);
      while (i >= 0) { add(map[i], map[i + w.length - 1] + 1); i = s.indexOf(w, i + 1); }
    });
    EXTRA.forEach(re => { re.lastIndex = 0; let m; while ((m = re.exec(text))) { add(m.index, m.index + m[0].length); if (!m[0].length) re.lastIndex++; } });
    // 겹치는 구간 합치기
    out.sort((a, b) => a[0] - b[0]);
    const merged = [];
    out.forEach(r => { const last = merged[merged.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else merged.push(r.slice()); });
    return merged;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  window.GoFilter = {
    WORDS, JAMO,
    has: text => ranges(text).length > 0,
    ranges,
    // reveal=true 이면 가린 부분을 빨간 밑줄로 표시하고 원문을 보여 줌 (관리자용)
    html(text, reveal) {
      text = String(text || '');
      const rs = ranges(text);
      if (!rs.length) return esc(text);
      let html = '', at = 0;
      rs.forEach(([a, b]) => {
        html += esc(text.slice(at, a));
        const bad = text.slice(a, b);
        html += reveal ? `<mark class="bad-word">${esc(bad)}</mark>` : `<span class="mosaic" title="가려진 말">${'■'.repeat(Array.from(bad).length)}</span>`;
        at = b;
      });
      return html + esc(text.slice(at));
    }
  };
})();
