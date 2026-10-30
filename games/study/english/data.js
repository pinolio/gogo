/*
 * 영어 단어 퀴즈 자료 — [영어 단어, 뜻, 품사]
 *  - 중학(mid) · 고등(high) 기본 어휘 (교육부 기본 어휘 수준에서 골라 뜻을 짧게)
 *  - 뜻이 겹치는 단어(예: big·large)는 한쪽만 넣음 → 보기에 정답이 두 개 생기지 않게
 *    (시험 스크립트 t_quiz.js 가 뜻·단어 겹침을 자동으로 검사함)
 *  - 품사: n 명사 · v 동사 · a 형용사 · ad 부사 — 보기는 되도록 같은 품사끼리 섞음
 *  - 단어를 더하거나 고치려면 알맞은 목록에 한 줄씩 추가하면 됩니다.
 */
window.GoEnglishWords = {
  mid: [
    ['apple', '사과', 'n'], ['answer', '대답', 'n'], ['bridge', '다리(건너는 것)', 'n'], ['brother', '형제', 'n'], ['building', '건물', 'n'],
    ['chair', '의자', 'n'], ['child', '아이', 'n'], ['city', '도시', 'n'], ['class', '수업', 'n'], ['cloud', '구름', 'n'],
    ['country', '나라', 'n'], ['culture', '문화', 'n'], ['dinner', '저녁 식사', 'n'], ['doctor', '의사', 'n'], ['door', '문', 'n'],
    ['dream', '꿈', 'n'], ['earth', '지구', 'n'], ['example', '예, 보기', 'n'], ['face', '얼굴', 'n'], ['farm', '농장', 'n'],
    ['festival', '축제', 'n'], ['floor', '바닥, 층', 'n'], ['flower', '꽃', 'n'], ['forest', '숲', 'n'], ['friend', '친구', 'n'],
    ['future', '미래', 'n'], ['garden', '정원', 'n'], ['gift', '선물', 'n'], ['health', '건강', 'n'], ['history', '역사', 'n'],
    ['holiday', '휴일', 'n'], ['island', '섬', 'n'], ['kitchen', '부엌', 'n'], ['language', '언어', 'n'], ['library', '도서관', 'n'],
    ['letter', '편지', 'n'], ['market', '시장', 'n'], ['meal', '식사', 'n'], ['memory', '기억', 'n'], ['money', '돈', 'n'],
    ['moon', '달', 'n'], ['mountain', '산', 'n'], ['museum', '박물관', 'n'], ['nature', '자연', 'n'], ['neighbor', '이웃', 'n'],
    ['ocean', '바다, 대양', 'n'], ['parent', '부모', 'n'], ['picture', '그림, 사진', 'n'], ['plant', '식물', 'n'], ['problem', '문제', 'n'],
    ['question', '질문', 'n'], ['river', '강', 'n'], ['rule', '규칙', 'n'], ['season', '계절', 'n'], ['sky', '하늘', 'n'],
    ['song', '노래', 'n'], ['story', '이야기', 'n'], ['street', '거리', 'n'], ['student', '학생', 'n'], ['subject', '과목', 'n'],
    ['teacher', '선생님', 'n'], ['trip', '여행', 'n'], ['village', '마을', 'n'], ['weather', '날씨', 'n'], ['window', '창문', 'n'],
    ['word', '단어', 'n'], ['world', '세계', 'n'], ['animal', '동물', 'n'], ['hospital', '병원', 'n'], ['vegetable', '채소', 'n'],
    ['arrive', '도착하다', 'v'], ['begin', '시작하다', 'v'], ['believe', '믿다', 'v'], ['borrow', '빌리다', 'v'], ['bring', '가져오다', 'v'],
    ['build', '짓다', 'v'], ['buy', '사다', 'v'], ['carry', '나르다', 'v'], ['catch', '잡다', 'v'], ['change', '바꾸다', 'v'],
    ['choose', '고르다', 'v'], ['clean', '청소하다', 'v'], ['climb', '오르다', 'v'], ['close', '닫다', 'v'], ['cook', '요리하다', 'v'],
    ['cry', '울다', 'v'], ['dance', '춤추다', 'v'], ['decide', '결정하다', 'v'], ['draw', '그리다', 'v'], ['drink', '마시다', 'v'],
    ['enjoy', '즐기다', 'v'], ['explain', '설명하다', 'v'], ['fall', '떨어지다', 'v'], ['feel', '느끼다', 'v'], ['find', '찾다', 'v'],
    ['finish', '끝내다', 'v'], ['forget', '잊다', 'v'], ['grow', '자라다', 'v'], ['help', '돕다', 'v'], ['hope', '바라다', 'v'],
    ['hurry', '서두르다', 'v'], ['invite', '초대하다', 'v'], ['join', '함께하다, 가입하다', 'v'], ['laugh', '웃다', 'v'], ['learn', '배우다', 'v'],
    ['listen', '듣다', 'v'], ['lose', '잃다', 'v'], ['meet', '만나다', 'v'], ['move', '움직이다', 'v'], ['open', '열다', 'v'],
    ['practice', '연습하다', 'v'], ['protect', '보호하다', 'v'], ['remember', '기억하다', 'v'], ['send', '보내다', 'v'], ['share', '나누다', 'v'],
    ['sell', '팔다', 'v'], ['sleep', '자다', 'v'], ['travel', '여행하다', 'v'], ['visit', '방문하다', 'v'], ['wait', '기다리다', 'v'],
    ['wash', '씻다', 'v'], ['worry', '걱정하다', 'v'], ['write', '쓰다', 'v'], ['save', '구하다, 저축하다', 'v'], ['throw', '던지다', 'v'],
    ['angry', '화난', 'a'], ['beautiful', '아름다운', 'a'], ['brave', '용감한', 'a'], ['bright', '밝은', 'a'], ['busy', '바쁜', 'a'],
    ['cheap', '값싼', 'a'], ['cold', '추운', 'a'], ['dangerous', '위험한', 'a'], ['dark', '어두운', 'a'], ['different', '다른', 'a'],
    ['difficult', '어려운', 'a'], ['easy', '쉬운', 'a'], ['empty', '비어 있는', 'a'], ['expensive', '비싼', 'a'], ['famous', '유명한', 'a'],
    ['favorite', '가장 좋아하는', 'a'], ['full', '가득 찬', 'a'], ['funny', '웃기는', 'a'], ['heavy', '무거운', 'a'], ['hungry', '배고픈', 'a'],
    ['important', '중요한', 'a'], ['kind', '친절한', 'a'], ['lazy', '게으른', 'a'], ['quiet', '조용한', 'a'], ['strong', '강한', 'a'],
    ['tired', '피곤한', 'a'], ['wise', '현명한', 'a'], ['young', '젊은', 'a'], ['always', '항상', 'ad'], ['early', '일찍', 'ad'],
    ['often', '자주', 'ad'], ['together', '함께', 'ad'], ['never', '결코 ~않다', 'ad'], ['already', '이미', 'ad'], ['finally', '마침내', 'ad']
  ],
  high: [
    ['ability', '능력', 'n'], ['advantage', '이점, 유리함', 'n'], ['ancestor', '조상', 'n'], ['anxiety', '불안', 'n'], ['appetite', '식욕', 'n'],
    ['atmosphere', '분위기, 대기', 'n'], ['attitude', '태도', 'n'], ['audience', '청중, 관객', 'n'], ['behavior', '행동', 'n'], ['benefit', '이익, 혜택', 'n'],
    ['boundary', '경계', 'n'], ['budget', '예산', 'n'], ['career', '직업, 경력', 'n'], ['century', '세기, 100년', 'n'], ['circumstance', '상황, 사정', 'n'],
    ['citizen', '시민', 'n'], ['colleague', '동료', 'n'], ['community', '공동체', 'n'], ['conflict', '갈등', 'n'], ['consequence', '결과', 'n'],
    ['contract', '계약', 'n'], ['crisis', '위기', 'n'], ['curiosity', '호기심', 'n'], ['debate', '토론', 'n'], ['decade', '10년', 'n'],
    ['disaster', '재난', 'n'], ['diversity', '다양성', 'n'], ['emotion', '감정', 'n'], ['environment', '환경', 'n'], ['evidence', '증거', 'n'],
    ['experiment', '실험', 'n'], ['facility', '시설', 'n'], ['failure', '실패', 'n'], ['generation', '세대', 'n'], ['government', '정부', 'n'],
    ['habit', '습관', 'n'], ['harvest', '수확', 'n'], ['identity', '정체성', 'n'], ['income', '소득, 수입', 'n'], ['influence', '영향', 'n'],
    ['instinct', '본능', 'n'], ['knowledge', '지식', 'n'], ['laboratory', '실험실', 'n'], ['majority', '대다수', 'n'],
    ['opportunity', '기회', 'n'], ['opinion', '의견', 'n'], ['phenomenon', '현상', 'n'], ['population', '인구', 'n'], ['poverty', '가난', 'n'],
    ['principle', '원리, 원칙', 'n'], ['purpose', '목적', 'n'], ['quality', '품질', 'n'], ['quantity', '양', 'n'], ['reputation', '평판, 명성', 'n'],
    ['resource', '자원', 'n'], ['responsibility', '책임', 'n'], ['revolution', '혁명', 'n'], ['shortage', '부족', 'n'], ['society', '사회', 'n'],
    ['solution', '해결책', 'n'], ['strategy', '전략', 'n'], ['symptom', '증상', 'n'], ['tradition', '전통', 'n'], ['vehicle', '차량, 탈것', 'n'],
    ['acquire', '얻다, 습득하다', 'v'], ['adapt', '적응하다', 'v'], ['admire', '존경하다, 감탄하다', 'v'], ['analyze', '분석하다', 'v'], ['apologize', '사과하다', 'v'],
    ['approve', '승인하다', 'v'], ['avoid', '피하다', 'v'], ['compare', '비교하다', 'v'], ['complain', '불평하다', 'v'], ['concentrate', '집중하다', 'v'],
    ['confirm', '확인하다', 'v'], ['consider', '고려하다', 'v'], ['consume', '소비하다', 'v'], ['contribute', '기여하다', 'v'], 
    ['create', '창조하다', 'v'], ['deliver', '배달하다', 'v'], ['deny', '부인하다', 'v'], ['depend', '의존하다', 'v'], ['describe', '묘사하다', 'v'],
    ['destroy', '파괴하다', 'v'], ['develop', '발전시키다', 'v'], ['eliminate', '없애다, 제거하다', 'v'], ['emphasize', '강조하다', 'v'], ['encourage', '격려하다', 'v'],
    ['estimate', '추정하다', 'v'], ['examine', '검사하다', 'v'], ['expand', '확장하다', 'v'], ['express', '표현하다', 'v'], ['extend', '연장하다', 'v'],
    ['hesitate', '망설이다', 'v'], ['ignore', '무시하다', 'v'], ['imitate', '모방하다', 'v'], ['improve', '개선하다', 'v'], ['include', '포함하다', 'v'],
    ['indicate', '가리키다', 'v'], ['inform', '알리다', 'v'], ['interrupt', '방해하다, 끼어들다', 'v'], ['investigate', '수사하다', 'v'], ['maintain', '유지하다', 'v'],
    ['observe', '관찰하다', 'v'], ['participate', '참여하다', 'v'], ['persuade', '설득하여 ~하게 하다', 'v'], ['predict', '예측하다', 'v'],
    ['prefer', '더 좋아하다', 'v'], ['prevent', '막다, 예방하다', 'v'], ['produce', '생산하다', 'v'], ['pursue', '추구하다', 'v'], ['recover', '회복하다', 'v'],
    ['reduce', '줄이다', 'v'], ['refuse', '거절하다', 'v'], ['replace', '대체하다', 'v'], ['require', '필요로 하다', 'v'],
    ['respond', '응답하다', 'v'], ['reveal', '드러내다', 'v'], ['satisfy', '만족시키다', 'v'], ['suggest', '제안하다', 'v'], ['survive', '살아남다', 'v'],
    ['absolute', '절대적인', 'a'], ['accurate', '정확한', 'a'], ['ancient', '고대의', 'a'], ['anxious', '불안해하는', 'a'], ['available', '이용할 수 있는', 'a'],
    ['aware', '알고 있는', 'a'], ['capable', '~할 수 있는', 'a'], ['complex', '복잡한', 'a'], ['confident', '자신감 있는', 'a'], ['constant', '끊임없는', 'a'],
    ['curious', '궁금한, 호기심 많은', 'a'], ['efficient', '효율적인', 'a'], ['enormous', '거대한', 'a'], ['essential', '필수적인', 'a'], 
    ['flexible', '유연한', 'a'], ['frequent', '잦은', 'a'], ['generous', '너그러운', 'a'], ['honest', '정직한', 'a'], ['independent', '독립적인', 'a'],
    ['inevitable', '피할 수 없는', 'a'], ['negative', '부정적인', 'a'], ['obvious', '명백한', 'a'], ['positive', '긍정적인', 'a'], ['previous', '이전의', 'a'],
    ['rare', '드문', 'a'], ['relevant', '관련 있는', 'a'], ['reliable', '믿을 수 있는', 'a'], ['sensitive', '민감한', 'a'], ['sufficient', '충분한', 'a'],
    ['temporary', '일시적인', 'a'], ['typical', '전형적인', 'a'], ['valuable', '귀중한', 'a'], ['various', '다양한', 'a'], ['vivid', '생생한', 'a'],
    ['eventually', '결국', 'ad'], ['gradually', '점차', 'ad'], ['immediately', '즉시', 'ad'], ['rarely', '좀처럼 ~않는', 'ad']
  ]
};
