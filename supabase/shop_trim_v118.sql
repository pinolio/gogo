-- gogo?gogo! v118 상점 상의·하의 정리 (선생님 11/11: 상의 10 · 하의 10 + 기본 옷만 남김)
-- 판매 현황 확인 결과: 지우는 40개를 산 사람·입은 사람 없음 → 환불 없음
-- Supabase 대시보드 → SQL Editor → Run (여러 번 실행해도 괜찮음)
delete from public.shop_items where id in (
  't_jersey',
  't_suit',
  't_armor',
  't_blouse',
  't_cardigan',
  't_mint',
  't_denim',
  't_basket',
  'b_basket',
  't_chef',
  'b_chef',
  't_fire',
  't_police',
  't_astro',
  'b_astro',
  't_vest',
  't_idol',
  't_overall',
  't_pirate',
  't_vampire',
  't_dino',
  'b_dino',
  't_panda',
  'b_panda',
  't_santa',
  'b_santa',
  't_hanbok_m',
  't_hanbok_f',
  't_hawaii',
  'b_swim',
  't_raincoat',
  't_pilot',
  't_racing',
  't_teacher',
  't_samurai',
  't_angel',
  't_devil',
  't_elf',
  't_penguin',
  't_snowman'
);

-- 확인: tops 11 · bottoms 11 (기본 티셔츠·청바지 포함) 이면 성공
select (select count(*) from public.shop_items where slot = 'top') as tops,
       (select count(*) from public.shop_items where slot = 'bottom') as bottoms;
