/*
 * 고고고고 설정
 * - 아래 두 값을 비워 두면 '체험 모드'로 동작합니다. (기록이 이 브라우저에만 저장)
 * - Supabase 프로젝트를 만든 뒤 값을 채우면, 어느 기기에서 로그인해도 전적이 이어집니다.
 *   Supabase 대시보드 > Project Settings > API Keys 에서 확인할 수 있습니다.
 */
window.GOGO_CONFIG = {
  supabaseUrl: 'https://kpsxnpfsnkbrbcqkzett.supabase.co',      // 예: 'https://abcdefgh.supabase.co'
  supabaseAnonKey: 'sb_publishable_yeR52tHhs3uR1oa_2IlCAg_LUqv8Am0',  // Publishable key (sb_publishable_…) 또는 예전 anon 키. 공개해도 되는 키입니다. Secret/service_role 키는 절대 넣지 마세요
  idDomain: 'gogogogo.game' // 아이디를 내부 이메일로 바꿀 때 쓰는 가짜 도메인 (바꾸지 않아도 됩니다)
};
