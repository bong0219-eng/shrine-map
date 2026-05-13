/* app.js — 가톨릭길동무 핵심 로직
   지도, 마커, 탭, 경로, 인포카드, 지역검색
   이벤트 바인딩 (bindEvents) 포함 */

'use strict';

// --- [Fix 1] Reliable Back Button Logic ---
// We push a history state when leaving the cover so the back button has something to pop.
function hideCoverAndRun(callback) {
  try{
    document.querySelectorAll('.module-view.open,#prayer-view.open,#diocese-view.open,#missa-view.open').forEach(function(v){v.classList.remove('open');});
    var pd=document.getElementById('prayer-detail'); if(pd) pd.classList.remove('show');
    if(typeof closeAllTabs==='function') closeAllTabs();
    if(typeof closeInfoCard==='function') closeInfoCard();
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  window._noAutoNearby = false;
  var cv = document.getElementById('cover');
  if (cv) cv.style.display = 'none';
  document.documentElement.classList.add('app-active');
  // RAF로 커버 숨김 후 다음 프레임에 콜백 실행 → 버벅거림 방지
  if (callback) requestAnimationFrame(function(){ setTimeout(callback, 0); });
}


function markExternalReturnStabilize(kind){
  // V20-19: 외부 사이트 이동은 브라우저 기본 동작에 맡긴다.
  // 이전 버전 호환을 위해 함수명만 유지하고, 이동 상태는 저장하지 않는다.
}

function oaiClearExternalNavigationState(){
  // 이전 버전에서 남았을 수 있는 외부 이동 보호막/클래스만 조용히 제거한다.
  try{
    var html = document.documentElement;
    html.classList.remove('oai-navigating-out','oai-external-return-prepaint','oai-external-return-stabilize','oai-missa-return-stabilize');
    sessionStorage.removeItem('oai_external_return_stabilize');
    sessionStorage.removeItem('oai_external_nav_started_at');
    sessionStorage.removeItem('oai_external_nav_pagehide');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{
    var v = document.getElementById('oai-nav-veil');
    if(v && v.parentNode) v.parentNode.removeChild(v);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function oaiSmoothNavigate(url, kind){
  // V20-19: 호환용 함수. 보호막/지연/전역 가로채기 없이 즉시 이동한다.
  if(!url) return;
  try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ oaiClearExternalNavigationState(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ location.href = url; }catch(e){ try{ location.assign(url); }catch(_){ } }
}

function applyExternalReturnStabilize(){
  // V20-19: 복귀 시 화면을 재계산하지 않고, 예전 이동중 잔여 상태만 제거한다.
  try{ oaiClearExternalNavigationState(); }catch(e){ console.warn("[가톨릭길동무]", e); }
}
window.addEventListener('pageshow', applyExternalReturnStabilize, true);

/* ── 뒤로가기 핸들러는 principle-back-controller-20260424 에서 통합 관리 ── */

/* OAI removed old pull-to-refresh handler: unified final handler below */


function openMissa(){
  const today=new Date();
  const yyyy=today.getFullYear();
  const mm=String(today.getMonth()+1).padStart(2,'0');
  const dd=String(today.getDate()).padStart(2,'0');
  const url='https://missa.cbck.or.kr/DailyMissa/'+yyyy+mm+dd;
  try{ localStorage.setItem('oai_last_missa_url', url); }catch(e){ console.warn("[가톨릭길동무]", e); }
  /* 외부 브라우저로 이동 — 화면 전환 페이드 후 location.href 방식 유지 */
  location.href = url;
}

function _setMassQuickReturn(on){
  try{
    window.__MASS_QUICK_RETURN__ = !!on;
    if(on) sessionStorage.setItem('oai_mass_quick_return','1');
    else { sessionStorage.removeItem('oai_mass_quick_return'); window.__MASS_QUICK_FROM_PRAYER__ = false; }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _shouldMassQuickReturn(){
  try{ return window.__MASS_QUICK_RETURN__ === true || window.__MASS_QUICK_FROM_PRAYER__ === true || sessionStorage.getItem('oai_mass_quick_return') === '1'; }
  catch(e){ console.warn("[가톨릭길동무]", e); return window.__MASS_QUICK_RETURN__ === true || window.__MASS_QUICK_FROM_PRAYER__ === true; }
}
function _isPageReloadNavigation(){
  try{
    var nav = performance.getEntriesByType && performance.getEntriesByType('navigation');
    if(nav && nav[0] && nav[0].type === 'reload') return true;
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ return performance.navigation && performance.navigation.type === 1; }
  catch(e){ return false; }
}
function _clearMassQuickReturnForReload(){
  try{
    window.__MASS_QUICK_RETURN__ = false;
    window.__MASS_QUICK_FROM_PRAYER__ = false;
    sessionStorage.removeItem('oai_mass_quick_return');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
if(_isPageReloadNavigation()) _clearMassQuickReturnForReload();
function _returnToMassQuickMenu(){
  if(typeof goToCover==='function') goToCover();
  window.__MASS_QUICK_RETURN__ = true;
  window.__MASS_QUICK_FROM_PRAYER__ = true;
  setTimeout(function(){ openMassQuickMenu({keepReturn:true}); }, 30);
}
function openMassQuickMenu(opts){
  const modal=document.getElementById('mass-quick-modal');
  if(!modal) return;
  if(!(opts && opts.keepReturn)) _setMassQuickReturn(false);
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
}
function closeMassQuickMenu(){
  const modal=document.getElementById('mass-quick-modal');
  _setMassQuickReturn(false);
  if(!modal) return;
  modal.classList.remove('show');
  modal.setAttribute('aria-hidden','true');
}
function openCatholicHymn(){
  const url='https://maria.catholic.or.kr/mobile/sungga/sungga.asp';
  try{ localStorage.setItem('oai_last_hymn_url', url); }catch(e){ console.warn("[가톨릭길동무]", e); }
  location.href = url;
}
window.addEventListener('pageshow', function(){
  try{ if(_isPageReloadNavigation()){ _clearMassQuickReturnForReload(); return; } }catch(e){ console.warn("[가톨릭길동무]", e); }
  if(_shouldMassQuickReturn()) setTimeout(function(){ openMassQuickMenu({keepReturn:true}); }, 80);
});
try{ window._shouldMassQuickReturn=_shouldMassQuickReturn; window._clearMassQuickReturnForReload=_clearMassQuickReturnForReload; window._returnToMassQuickMenu=_returnToMassQuickMenu; window._closePrayerAndReturn=_closePrayerAndReturn; window.openMassQuickMenu=openMassQuickMenu; window.closeMassQuickMenu=closeMassQuickMenu; }catch(e){ console.warn('[가톨릭길동무]', e); }

// 안정형 새로고침: 캐시/서비스워커를 지우지 않고 현재 화면만 다시 불러온다.
// 즐겨찾기/localStorage는 물론, Service Worker와 Cache Storage도 건드리지 않는다.
function refreshAppFilesOnly(){
  var msg = '앱 화면을 안정형으로 다시 불러올까요?\n캐시와 설치 상태는 삭제하지 않습니다.';
  if(!window.confirm(msg)) return;
  var btn = document.getElementById('cover-update-btn');
  try{
    if(btn){
      btn.disabled = true;
      btn.textContent = '새로고침 중';
    }
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // V20-19: 새로고침 전에는 레이아웃/스크롤/모달 DOM을 건드리지 않고,
    // 복귀 상태값만 정리한다. 화면 흔들림은 주로 reload 직전 DOM 조작에서 발생했다.
    sessionStorage.setItem('oai_soft_refresh_requested', String(Date.now ? Date.now() : new Date().getTime()));
    try{ _clearMassQuickReturnForReload(); }catch(_e){}
  }catch(e){
    console.warn('[가톨릭길동무]', e);
  }
  try{
    location.reload();
  }catch(e){
    location.href = location.href.split('#')[0];
  }
}
window.refreshAppFilesOnly = refreshAppFilesOnly;

// 관리용 완전 정리 함수: 일반 새로고침 버튼에서는 호출하지 않는다.
// 캐시가 심하게 꼬였을 때만 콘솔/별도 호출로 사용한다.
async function clearAppFilesCacheCompletely(){
  var msg = '앱 파일 캐시와 서비스워커를 완전히 삭제할까요?\n일반 새로고침보다 강한 정리입니다.';
  if(!window.confirm(msg)) return;
  try{
    if(window.caches && caches.keys){
      var keys = await caches.keys();
      await Promise.all(keys.map(function(k){ return caches.delete(k); }));
    }
    if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
      var regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(function(r){ return r.unregister(); }));
    }
  }catch(e){
    console.warn('[가톨릭길동무]', e);
  }
  try{
    var url = new URL(location.href);
    url.searchParams.set('refresh', String(Date.now ? Date.now() : new Date().getTime()));
    location.replace(url.toString());
  }catch(e){
    location.reload();
  }
}
window.clearAppFilesCacheCompletely = clearAppFilesCacheCompletely;

function syncCoverUpdateVersionState(){
  try{
    var btn = document.getElementById('cover-update-btn');
    var box = document.getElementById('cover-update-box');
    var marker = document.getElementById('oai-build-marker');
    if(!btn || !box) return;
    var target = btn.getAttribute('data-target-version') || 'V20-19';
    var current = '';
    if(window.APP_VERSION) current = String(window.APP_VERSION).trim();
    if(!current && marker) current = String(marker.textContent || '').trim();
    if(!current) current = target;
    var mismatch = current !== target;
    btn.textContent = mismatch ? (target + ' 업데이트 필요') : (target + ' 새로고침');
    box.classList.toggle('update-needed', mismatch);
    if(marker) marker.textContent = current;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
window.syncCoverUpdateVersionState = syncCoverUpdateVersionState;
document.addEventListener('DOMContentLoaded', function(){
  syncCoverUpdateVersionState();
  setTimeout(syncCoverUpdateVersionState, 250);
  setTimeout(syncCoverUpdateVersionState, 900);
}, true);
window.addEventListener('load', syncCoverUpdateVersionState, true);

// V20-19: 커버 전용 주요 기능 안내. 별도 파일 없이 작은 자동 안내 + 자세한 카드형 팝업을 제공한다.
(function(){
  'use strict';
  var HIDE_DAYS = 7;
  var MAX_LATER_COUNT = 3;
  var KEY_COUNT = 'catholicGuideLaterCount';
  var KEY_HIDE_UNTIL = 'catholicGuideHideUntil';
  var KEY_DISABLED = 'catholicGuideAutoDisabled';
  var SOFT_REFRESH_KEY = 'oai_soft_refresh_requested';

  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function hasRecentSoftRefreshRequest(){
    try{
      var raw = sessionStorage.getItem(SOFT_REFRESH_KEY);
      var t = parseInt(raw || '0', 10) || 0;
      return !!t && (now() - t) < 120000;
    }catch(e){ return false; }
  }
  function clearSoftRefreshRequest(){
    try{ sessionStorage.removeItem(SOFT_REFRESH_KEY); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function getInt(key){
    try{ return parseInt(localStorage.getItem(key) || '0', 10) || 0; }catch(e){ return 0; }
  }
  function setVal(key, value){ try{ localStorage.setItem(key, String(value)); }catch(e){ console.warn('[가톨릭길동무]', e); } }
  function isCoverVisible(){
    try{
      var cover=document.getElementById('cover');
      return !!cover && !document.documentElement.classList.contains('app-active') && cover.style.display !== 'none';
    }catch(e){ return false; }
  }
  function resetGuideScroll(id){
    try{
      var root=document.getElementById(id);
      if(!root) return;
      root.scrollTop=0;
      root.querySelectorAll('.guide-panel,.guide-card-list').forEach(function(el){ el.scrollTop=0; });
      var panel=root.querySelector('.guide-panel');
      if(panel) panel.scrollIntoView({block:'center', inline:'nearest'});
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function showModal(id){
    var el=document.getElementById(id);
    if(!el) return;
    resetGuideScroll(id);
    el.classList.add('show');
    el.setAttribute('aria-hidden','false');
    setTimeout(function(){ resetGuideScroll(id); }, 0);
    try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(e){}
  }
  function hideModal(id){
    var el=document.getElementById(id);
    if(!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden','true');
  }
  function openGuideManual(){
    hideModal('guide-intro-modal');
    showModal('guide-manual-modal');
    // 주요 기능을 확인한 사용자는 일주일간 자동 안내를 다시 띄우지 않는다.
    setVal(KEY_HIDE_UNTIL, now() + HIDE_DAYS*24*60*60*1000);
  }
  function closeGuideManual(){ hideModal('guide-manual-modal'); }
  function closeIntroLater(){
    hideModal('guide-intro-modal');
    var count = getInt(KEY_COUNT) + 1;
    setVal(KEY_COUNT, count);
    if(count >= MAX_LATER_COUNT){
      setVal(KEY_DISABLED, '1');
    }else{
      setVal(KEY_HIDE_UNTIL, now() + HIDE_DAYS*24*60*60*1000);
    }
  }
  function shouldShowIntro(forceRefresh){
    if(forceRefresh) return isCoverVisible();
    try{
      if(localStorage.getItem(KEY_DISABLED) === '1') return false;
      if(getInt(KEY_COUNT) >= MAX_LATER_COUNT){ setVal(KEY_DISABLED, '1'); return false; }
      var hideUntil = parseInt(localStorage.getItem(KEY_HIDE_UNTIL) || '0', 10) || 0;
      if(hideUntil && now() < hideUntil) return false;
    }catch(e){ return false; }
    return isCoverVisible();
  }
  function maybeShowIntro(){
    var forceRefresh = hasRecentSoftRefreshRequest();
    if(forceRefresh){
      // V20-19: 안정형 새로고침 뒤에는 어떤 커버 팝업도 자동으로 다시 띄우지 않는다.
      try{ if(typeof closeMassQuickMenu === 'function') closeMassQuickMenu(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      try{ hideModal('guide-intro-modal'); hideModal('guide-manual-modal'); }catch(e){ console.warn('[가톨릭길동무]', e); }
      try{ var ios=document.getElementById('ios-safari-guide-modal'); if(ios){ ios.classList.remove('show'); ios.setAttribute('aria-hidden','true'); } }catch(e){ console.warn('[가톨릭길동무]', e); }
      clearSoftRefreshRequest();
      return;
    }
    if(shouldShowIntro(false)) showModal('guide-intro-modal');
  }
  function bindGuide(){
    var btn=document.getElementById('cover-guide-btn');
    if(btn) btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openGuideManual(); });
    var detail=document.getElementById('guide-open-detail-btn');
    if(detail) detail.addEventListener('click', function(e){ e.preventDefault(); openGuideManual(); });
    var later=document.getElementById('guide-later-btn');
    if(later) later.addEventListener('click', function(e){ e.preventDefault(); closeIntroLater(); });
    var ok=document.getElementById('guide-ok-btn');
    if(ok) ok.addEventListener('click', function(e){ e.preventDefault(); closeGuideManual(); });
    document.querySelectorAll('[data-guide-close]').forEach(function(el){
      el.addEventListener('click', function(e){
        e.preventDefault();
        var target=el.getAttribute('data-guide-close');
        if(target==='intro') closeIntroLater();
        else if(target==='manual') closeGuideManual();
      });
    });
    document.addEventListener('keydown', function(e){
      if(e.key !== 'Escape') return;
      hideModal('guide-intro-modal');
      hideModal('guide-manual-modal');
    });
    setTimeout(maybeShowIntro, 650);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bindGuide, {once:true});
  else bindGuide();
  window.openGuideManual = openGuideManual;
  window.resetGuideManualScroll = function(){ resetGuideScroll('guide-manual-modal'); };
})();

function closeMissa(){
  const view=$('missa-view');
  if(view) view.classList.remove('open');
  if(_shouldMassQuickReturn()) _returnToMassQuickMenu();
  else if(typeof goToCover==='function') goToCover();
}
function missaLoaded(){
  // 매일미사 외부 iframe 제거: 남겨둔 호환용 빈 함수
}

function openPrayerBook(opts){
  if(opts && opts.fromMassQuick){ window.__MASS_QUICK_RETURN__ = true; window.__MASS_QUICK_FROM_PRAYER__ = true; try{ sessionStorage.setItem('oai_mass_quick_return','1'); }catch(e){ console.warn("[가톨릭길동무]", e); } }
  const view=$('prayer-view');
  if(!view) return;
  const cv=$('cover');
  if(cv){ cv.style.opacity='0'; cv.style.display='none'; }
  document.documentElement.classList.add('app-active');
  view.classList.add('open');
  if(typeof oaiEnterView==='function') oaiEnterView(view);
  setTimeout(function(){
    if(typeof window.initPrayerView==='function') try{window.initPrayerView();}catch(e){ console.warn("[가톨릭길동무]", e); }
    if(!(opts&&opts.restore) && typeof showPrayerListOnly==='function') try{showPrayerListOnly();}catch(e){ console.warn("[가톨릭길동무]", e); }
    var list=document.getElementById('prayer-list-view'); if(list) list.scrollTop=0;
    var tabs=document.getElementById('prayer-tabs'); if(tabs) tabs.scrollLeft=0;
  }, 50);
}
function closePrayerView(){
  const view=$('prayer-view');
  const detail=$('prayer-detail');
  if(detail) detail.classList.remove('show');
  if(view) view.classList.remove('open');
}
function _closePrayerAndReturn(){
  closePrayerView();
  if(_shouldMassQuickReturn()) _returnToMassQuickMenu();
  else if(typeof goToCover==='function') goToCover();
}




// V20-19: iPhone 카카오톡 인앱 브라우저에서만 Safari 설치 안내 배너를 표시한다.
(function(){
  'use strict';
  function ua(){ return (navigator.userAgent || '').toLowerCase(); }
  function isIOS(){
    var u = ua();
    return /iphone|ipad|ipod/.test(u) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isKakao(){ return ua().indexOf('kakaotalk') > -1; }
  function isStandalone(){
    try{ if(window.navigator.standalone === true) return true; }catch(e){ console.warn('[가톨릭길동무]', e); }
    try{ return window.matchMedia && window.matchMedia('(display-mode: standalone)').matches; }catch(e){ console.warn('[가톨릭길동무]', e); }
    return false;
  }
  function shouldShow(){
    return isIOS() && isKakao() && !isStandalone();
  }
  function showModal(){
    var m = document.getElementById('ios-safari-guide-modal');
    if(!m) return;
    m.classList.add('show');
    m.setAttribute('aria-hidden','false');
    try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function hideModal(){
    var m = document.getElementById('ios-safari-guide-modal');
    if(!m) return;
    m.classList.remove('show');
    m.setAttribute('aria-hidden','true');
  }
  function init(){
    var banner = document.getElementById('ios-kakao-safari-banner');
    if(!banner) return;
    if(shouldShow()){
      document.documentElement.classList.add('ios-kakao-inapp');
      banner.hidden = false;
      banner.setAttribute('aria-hidden','false');
    }else{
      document.documentElement.classList.remove('ios-kakao-inapp');
      banner.hidden = true;
      banner.setAttribute('aria-hidden','true');
    }
    var btn = document.getElementById('ios-kakao-safari-help');
    if(btn && !btn.__iosSafariBound){
      btn.__iosSafariBound = true;
      btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); showModal(); }, true);
    }
    var closeBannerBtn = document.getElementById('ios-kakao-safari-close');
    if(closeBannerBtn && !closeBannerBtn.__iosSafariBannerCloseBound){
      closeBannerBtn.__iosSafariBannerCloseBound = true;
      closeBannerBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        banner.hidden = true;
        banner.setAttribute('aria-hidden','true');
      }, true);
    }
    document.querySelectorAll('[data-ios-safari-close]').forEach(function(el){
      if(el.__iosSafariCloseBound) return;
      el.__iosSafariCloseBound = true;
      el.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); hideModal(); }, true);
    });
  }
  document.addEventListener('DOMContentLoaded', init, true);
  window.addEventListener('pageshow', init, true);
})();

function openDioceseView(opts){
  var view=document.getElementById('diocese-view');
  var frame=document.getElementById('diocese-frame');
  var loading=document.getElementById('diocese-loading');
  if(!view||!frame) return;
  var restore = !!(opts && opts.restore);
  var needsLoad = (!frame.src || frame.src==='about:blank' || !frame._loaded);
  view.classList.add('open');
  if(typeof oaiEnterView==='function') oaiEnterView(view);
  if(loading) loading.style.display = needsLoad ? 'flex' : 'none';
  if(needsLoad){
    frame.onload=function(){
      if(loading) loading.style.display='none'; frame._loaded=true;
      try{ frame.contentWindow && frame.contentWindow.dioApplySharedFont && frame.contentWindow.dioApplySharedFont(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(!restore) try{ frame.contentWindow && frame.contentWindow.resetDioceseFirstPage && frame.contentWindow.resetDioceseFirstPage(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(typeof dioceseLoaded==='function') dioceseLoaded();
    };
    frame.src='diocese.html?v=V20-19';
  }else if(!restore){
    try{ frame.contentWindow && frame.contentWindow.resetDioceseFirstPage && frame.contentWindow.resetDioceseFirstPage(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}
function closeDioceseView(){
  var view=document.getElementById('diocese-view');
  /* 흰 화면 방지: 커버를 먼저 복원한 뒤 관구·교구 레이어만 닫는다. */
  if(typeof goToCover==='function') goToCover();
  if(view) view.classList.remove('open');
  /* iframe src를 about:blank로 비우면 닫는 순간 흰 화면이 보이고 재진입도 느려져 유지한다. */
}
function dioceseLoaded(){
  var loading=document.getElementById('diocese-loading');
  if(loading) loading.style.display='none';
}
const CORE_RETURN_KEY='catholic_core_return_v1';
function saveCoreReturnState(extra){
  // 지도 중심/레벨 저장
  let mapCenter = null, mapLevel = null;
  try{
    if(_map && window.kakao && kakao.maps){
      const c = _map.getCenter();
      mapCenter = {lat: c.getLat(), lng: c.getLng()};
      mapLevel = _map.getLevel();
    }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  const state={
    mode:_mode||'shrine',
    activeTab: _activeTab||'',
    filterDio:_filterDio||'all',
    listSrch:_listSrch||'',
    infoIdx:(_curInfoItem&&Number.isInteger(_curInfoItem.idx))?_curInfoItem.idx:-1,
    fromRegion:!!_curFromRegion,
    mapCenter: mapCenter,
    mapLevel: mapLevel
  };
  try{ sessionStorage.setItem(CORE_RETURN_KEY, JSON.stringify(Object.assign(state, extra||{}))); }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function normalizeCatholicExternalUrl(url){
  url = String(url || '').trim();
  if(!url) return '';

  // 기존 데이터에 남아 있는 1~8/PB/PR/P2 같은 단축 URL을 여기서 먼저 풀어준다.
  // 데이터 파일은 전체 URL이 원칙이지만, 남은 단축값 때문에 잘못 열리는 문제를 방지한다.
  try{
    if(typeof _decUrl === 'function') url = _decUrl(url);
  }catch(e){ console.warn("[가톨릭길동무]", e); }

  // 흔한 오타 보정: http//example.com, https//example.com
  url = url.replace(/^hthttp:\/\//i, 'http://').replace(/^hthttps:\/\//i, 'https://').replace(/^http\/\//i, 'http://').replace(/^https\/\//i, 'https://');
  if(url.indexOf('//') === 0) url = 'https:' + url;
  if(!/^https?:\/\//i.test(url)) url = 'https://' + url.replace(/^\/+/, '');

  try{
    var u = new URL(url);
    // 경로 내 이중 슬래시 제거: cathms.kr//E_2/... → cathms.kr/E_2/...
    u.pathname = u.pathname.replace(/\/\/+/g, '/');
    var host = u.hostname.toLowerCase();
    // 의정부교구는 www 유무에 따라 모바일 크롬 인증서 동작이 달라질 수 있어
    // 관구교구에서 열리는 주소 형태를 보존한다.
    if(host === 'wjcatholic.or.kr') u.hostname = 'www.wjcatholic.or.kr';
    if(u.hostname.toLowerCase() === 'www.wjcatholic.or.kr') u.protocol = 'http:';
    if(host === 'www.cathms.kr') u.hostname = 'cathms.kr';
    if(u.hostname.toLowerCase() === 'cathms.kr') u.protocol = 'https:';
    if(u.hostname.toLowerCase() === 'www.caincheon.or.kr') u.protocol = 'http:';
    return u.toString();
  }catch(e){ return url; }
}
function openCoreExternalUrl(url, extra){
  url = normalizeCatholicExternalUrl(url);
  if(!url) return;
  saveCoreReturnState(extra);
  // location.href 방식: PWA/모바일에서 팝업 차단 우회, 뒤로가기로 복귀 가능
  location.href = url;
}

function clearRouteNoFocus(){
  // 외부링크 복귀용: 경로 상태만 조용히 제거하고, 도착지로 이동/노란마커 복원은 하지 않는다.
  try{
    if(_mode==='shrine'){
      if(_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
      if(_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
    }
    _rS=null; _rE=null; _routeMode=false;
    if(typeof _setRouteLabel==='function'){ _setRouteLabel('start',''); _setRouteLabel('end',''); }
    var rs=document.getElementById('rs-result'); if(rs) rs.style.display='none';
    var hint=document.getElementById('rs-hint'); if(hint) hint.style.display='block';
    var sBtn=document.getElementById('rs-search-btn'); if(sBtn) sBtn.style.display='none';
    if(_polyline){ _polyline.setMap(null); _polyline=null; }
    if(typeof _clearRouteTmpMarkers==='function') _clearRouteTmpMarkers();
    if(typeof _showJukrimgulParkingMkr==='function') _showJukrimgulParkingMkr(false);
    var guide=document.getElementById('route-guide'); if(guide) guide.classList.remove('on');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function restoreCoreReturnState(){
  let raw=null;
  try{ raw=sessionStorage.getItem(CORE_RETURN_KEY); }catch(e){ console.warn("[가톨릭길동무]", e); }
  if(!raw) return false;
  let state=null;
  try{ state=JSON.parse(raw); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ sessionStorage.removeItem(CORE_RETURN_KEY); }catch(e){ console.warn("[가톨릭길동무]", e); }
  if(!state||!state.mode) return false;

  _mode=state.mode;
  _filterDio=state.filterDio||'all';
  _listSrch=state.listSrch||'';
  _screen='map';
  document.documentElement.classList.add('app-active');
  document.documentElement.classList.toggle('parish-mode',_mode==='parish');
  document.documentElement.classList.toggle('retreat-mode',_mode==='retreat');
  const cover=$('cover'); if(cover) cover.style.display='none';
  document.documentElement.classList.add('oai-returning');
  closeAllTabs();
  closeInfoCard();
  clearRouteNoFocus();
  window._noAutoNearby = true;
  // 외부링크 복귀 시 이미 살아있는 지도는 다시 초기화하지 않는다.
  const mapEl=$('map');
  const needMapLoad = (!_map || !mapEl || !mapEl.children || !mapEl.children.length);
  if(needMapLoad){
    _resetMapState();
    _mapInited=true;
    _loadMap();
  }
  const restoreDelay = needMapLoad ? 650 : 30;
  // V20-19: 외부사이트 복귀 시 지도 중심을 두 단계로 움직이지 않는다.
  // 인포카드가 있었던 경우에는 처음부터 인포카드 기준 중심으로 복원한다.
  setTimeout(()=>{
    _restoreMapMarkers();
    if(Number.isInteger(state.infoIdx) && state.infoIdx>=0){
      try{
        const _item = _getCurrentItems()[state.infoIdx];
        if(_item){
          _curFromRegion = !!state.fromRegion;
          if(_mode==='shrine') _selectShrineMarker(state.infoIdx);
          else if(_mode==='parish') _selectParishMarker(_item);
          else _selectRetreatMarker(_item);
          const ic=$('info-card');
          if(ic){ ic.classList.add('no-anim'); }
          _showInfoCard(_item, state.infoIdx);
          _focusMarkerAboveInfoCard(_item);
          requestAnimationFrame(()=>{ if(ic) ic.classList.remove('no-anim'); });
        }
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    } else {
      // 인포카드가 없는 복귀도 같은 시각 기준을 유지하기 위해 저장된 중심만 한 번 복원한다.
      if(state.mapCenter && _map){
        try{
          _map.setCenter(new _LL(state.mapCenter.lat, state.mapCenter.lng));
          if(state.mapLevel) _map.setLevel(state.mapLevel);
        }catch(e){ console.warn("[가톨릭길동무]", e); }
      }
      if(state.activeTab){
        setTimeout(()=>{ try{ openTab(state.activeTab); }catch(e){ console.warn("[가톨릭길동무]", e); } },120);
      }
    }
    setTimeout(()=>{ document.documentElement.classList.remove('oai-returning'); }, 520);
  },restoreDelay);
  return true;
}
window.addEventListener('pageshow', function(e){
  // 기도문에서 복귀 → 커버로
  try{
    if(sessionStorage.getItem('_prayerReturn')==='1'){
      sessionStorage.removeItem('_prayerReturn');
      // 커버 표시, 앱 비활성화
      document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
      const cv=document.getElementById('cover');
      if(cv){ cv.style.display=''; cv.style.opacity='1'; }
      return;
    }
  }catch(ex){ console.warn("[가톨릭길동무]", ex); }
  // sessionStorage 플래그 확인 → _noAutoNearby 세팅
  try{
    if(sessionStorage.getItem('_noAutoNearby_flag')==='1'){
      window._noAutoNearby = true;
      sessionStorage.removeItem('_noAutoNearby_flag');
    }
  }catch(ex){ console.warn("[가톨릭길동무]", ex); }
  setTimeout(()=>{
    if(restoreCoreReturnState()) return;
    if(_screen==='map' && (!_map || !$('map')?.children.length)){
      const reopenTab=_activeTab||'';
      _resetMapState();
      _mapInited=true;
      window._noAutoNearby = true;
      _loadMap();
      setTimeout(()=>{ if(reopenTab) openTab(reopenTab); },700);
    }
  },0);
});
// 뒤로가기로 매일미사 닫기 - 메인 popstate에서 처리

// ════════════════════════════════════════════════
// 📌 DATA 수정 가이드
// ════════════════════════════════════════════════
// 【성지 데이터 - SHRINES 배열】
//  각 항목 형식:
//  {name:"이름", diocese:"교구코드", addr:"주소", tel:"전화(없으면 생략)",
//   type:"A|B|C", kw:"카카오내비검색어", lat:위도, lng:경도,
//   seq:"cbck.or.kr seq번호(없으면 생략)", hp:"홈페이지(없으면 생략)",
//   note:"특이사항(없으면 생략)"}
//
//  type 코드: A=성지, B=순례지, C=순교 사적지
//  diocese 코드: SE=서울대교구, SW=수원, DG=대구대교구, DJ=대전,
//   GJ=광주대교구, IC=인천, BS=부산, JJ=전주, UJ=의정부,
//   CJ=청주, MS=마산, CC=춘천, WJ=원주, AD=안동, JE=제주, ML=군종
//
// 【성당 데이터 - _PA_RAW 배열】 【피정의 집 - _RT_RAW 배열】
//  각 항목 형식: ['이름','교구코드','주소','전화','hp단축','url단축',위도,경도]
//  (빈 필드는 ''로 표기, tel 없으면 '' 유지)
//  hp 단축: 1=http://cafe.daum.net/ 2=https://cafe.daum.net/
//   3=http://cafe.naver.com/ 4=https://cafe.naver.com/
//   5=http://www. 6=https://www. 7=http:// 8=https://
//  url 단축: PB=aos.catholic.or.kr, PR=cbck.or.kr/Directory/Retreat/
//   P1=casuwon, P2=daegu-archdiocese, P3=djcatholic, P4=gjcatholic
//   P5=caincheon, P6=catholicbusan, P7=jcatholic, P8=ucatholic
//   P9=cdcj, PA=cathms, PC=diocesejeju, PD=gunjong, PE=sd.uca.or.kr
//
// 【항목 추가】SHRINES/PA_RAW 배열 끝에 콤마 후 새 항목 추가
// 【항목 수정】해당 항목 직접 편집
// 【항목 삭제】해당 항목 줄 전체 삭제 (앞뒤 콤마 주의)
// ════════════════════════════════════════════════
const SHRINES = [{"name":"광희문 성지","diocese":"SE","addr":"서울시 중구 퇴계로 348","type":"A","kw":"광희문성지","lat":37.564384,"lng":127.0104358,"seq":"20190003"},{"name":"노고산 성지","diocese":"SE","addr":"서울시 마포구 백범로 35 서강대학교 삼성 가브리엘관 앞","tel":"02-705-8161","type":"A","kw":"노고산성지","lat":37.5518176,"lng":126.9386415,"seq":"20190116"},{"name":"당고개(용산) 순교 성지","diocese":"SE","addr":"서울시 용산구 청파로 139-26","tel":"02-711-0933","type":"A","kw":"당고개(용산)순교성지","lat":37.5356524,"lng":126.9670119,"seq":"20190004","hp":"7danggogae.org"},{"name":"명동 주교좌성당","diocese":"SE","addr":"서울시 중구 명동길 74","tel":"02-774-1784","type":"A","kw":"명동주교좌성당","lat":37.5631845,"lng":126.9873561,"seq":"20190001","hp":"7mdsd.or.kr"},{"name":"삼성산 성지","diocese":"SE","addr":"서울 관악구 호암로 454-16","tel":"02-875-2271","type":"A","kw":"삼성산성지","lat":37.4568481,"lng":126.929111,"seq":"20190005","hp":"8ssssd.or.kr"},{"name":"새남터 순교 성지","diocese":"SE","addr":"서울시 용산구 이촌로 80-8","tel":"02-716-1791","type":"A","kw":"새남터순교성지","lat":37.524974,"lng":126.9568397,"seq":"20190006","hp":"8saenamteo.or.kr"},{"name":"서소문 밖 네거리 순교 성지","diocese":"SE","addr":"서울시 중구 칠패로 5","tel":"02-3147-2401","type":"A","kw":"서소문밖네거리순교성지","lat":37.5605682,"lng":126.9688673,"seq":"20190007","hp":"8seosomun.org"},{"name":"절두산 순교 성지","diocese":"SE","addr":"서울시 마포구 토정로 6","tel":"02-3142-4434","type":"A","kw":"절두산순교성지","lat":37.5441295,"lng":126.9118468,"seq":"20190010","hp":"5jeoldusan.or.kr"},{"name":"가톨릭 대학교 성신 교정","diocese":"SE","addr":"서울시 종로구 창경궁로 296-12","tel":"02-740-9714","type":"B","kw":"가톨릭대학교성신교정","lat":37.5863362,"lng":127.0045786,"seq":"20190002","hp":"8songsin.catholic.ac.kr"},{"name":"가회동 성당","diocese":"SE","addr":"서울시 종로구 북촌로 57","tel":"02-763-1570","type":"B","kw":"가회동성당","lat":37.5820573,"lng":126.9845667,"seq":"20190113","hp":"8gahoe.or.kr"},{"name":"용산 성심 신학교","diocese":"SE","addr":"서울시 용산구 원효로 19길 49","type":"B","kw":"용산성심신학교","lat":37.534238,"lng":126.9541755,"seq":"20190008"},{"name":"용산 성직자 묘지","diocese":"SE","addr":"서울시 용산구 효창원로 15길 37","tel":"02-719-3301","type":"B","kw":"용산성직자묘지","lat":37.5369938,"lng":126.9532596,"seq":"20190117","hp":"6yongsanch.or.kr"},{"name":"종로 성당","diocese":"SE","addr":"서울시 종로구 동순라길 8","tel":"02-765-6101","type":"B","kw":"종로성당","lat":37.571232,"lng":126.9966629,"seq":"20190122","hp":"8jongnocc.or.kr"},{"name":"중림동 약현 성당","diocese":"SE","addr":"서울시 중구 청파로 447-1","tel":"02-362-1891","type":"B","kw":"중림동약현성당","lat":37.5591082,"lng":126.9674792,"seq":"20190124","hp":"7yakhyeon.or.kr"},{"name":"한국 순교자 103위 시성 터","diocese":"SE","addr":"서울시 영등포구 여의공원로 68 여의도공원","type":"B","kw":"한국순교자103위시성터","lat":37.5267037,"lng":126.9241837,"seq":"20190125"},{"name":"한국 천주교 순교자 124위 시복 터","diocese":"SE","addr":"서울시 종로구 세종로 광화문 광장 북측","type":"B","kw":"한국천주교순교자124위시복터","lat":37.574877,"lng":126.9768704,"seq":"20190126"},{"name":"경기 감영 터","diocese":"SE","addr":"서울시 종로구 새문안로 9 적십자 병원 정문 옆","type":"C","kw":"경기감영터","lat":37.5663439,"lng":126.9665977,"seq":"20190114"},{"name":"김범우의 집터","diocese":"SE","addr":"서울시 중구 을지로 66 KEB 하나금융그룹 본점 앞","type":"C","kw":"김범우의집터","lat":37.5655656,"lng":126.9849187,"seq":"20190115"},{"name":"우포도청 터","diocese":"SE","addr":"서울시 종로구 종로 6 광화문 우체국 앞 화단","type":"C","kw":"우포도청터","lat":37.5698406,"lng":126.9780979,"seq":"20190118"},{"name":"의금부 터","diocese":"SE","addr":"서울시 종로구 종로 47 SC 제일은행 본점 앞","type":"C","kw":"의금부터","lat":37.5703837,"lng":126.9823641,"seq":"20190119"},{"name":"이벽의 집터 (한국 천주교회 창립 터)","diocese":"SE","addr":"서울시 종로구 청계천로 105 두레시닝 빌딩 앞","type":"C","kw":"이벽의집터(한국천주교회창립터)","lat":37.5684204,"lng":126.9893825,"seq":"20190120"},{"name":"전옥서 터","diocese":"SE","addr":"서울시 종로구 종로 1가 종각역 6번 출구 화단","type":"C","kw":"전옥서터","lat":37.5699783,"lng":126.982466,"seq":"20190121"},{"name":"좌포도청 터","diocese":"SE","addr":"서울시 종로구 돈화문로 28 종로3가 치안센터 옆","type":"C","kw":"좌포도청터","lat":37.5710957,"lng":126.9922822,"seq":"20190123"},{"name":"형조 터","diocese":"SE","addr":"서울시 종로구 세종대로 175 세종문화회관 앞 바닥 돌","type":"C","kw":"형조터","lat":37.572819,"lng":126.9765405,"seq":"20190127"},{"name":"왜고개 성지","diocese":"ML","addr":"서울시 용산구 한강대로 40길 46","type":"A","kw":"왜고개성지","lat":37.5294718,"lng":126.9716576,"seq":"20190009"},{"name":"갑곶 순교 성지","diocese":"IC","addr":"인천시 강화군 강화읍 해안동로 1366번길 35","tel":"032-933-1525","type":"A","kw":"갑곶순교성지","lat":37.7340214,"lng":126.5170201,"seq":"20190034","hp":"7gabgot.com"},{"name":"제물진두 순교 성지","diocese":"IC","addr":"인천시 중구 제물량로 240","tel":"032-764-4191","type":"A","kw":"제물진두순교성지","lat":37.4735513,"lng":126.6185482,"seq":"20190147"},{"name":"진무영 순교 성지","diocese":"IC","addr":"인천시 강화군 강화읍 북문길 41 강화성당 내","tel":"032-933-2282","type":"A","kw":"진무영순교성지","lat":37.7502015,"lng":126.4848284,"seq":"20190035"},{"name":"답동 주교좌성당","diocese":"IC","addr":"인천광역시 중구 우현로 50번길 2","tel":"032-762-7613","type":"B","kw":"답동주교좌성당","lat":37.4710916,"lng":126.6298992,"seq":"20190143","hp":"7dapdong.or.kr"},{"name":"성모 순례지 (성모당)","diocese":"IC","addr":"인천시 동구 박문로 1 인천교구청","tel":"032-765-6961","type":"B","kw":"성모순례지(성모당)","lat":37.4709191,"lng":126.6513809,"seq":"20190144","hp":"7caincheon.or.kr"},{"name":"성체 순례 성지","diocese":"IC","addr":"경기도 김포시 북변로 29-12","tel":"070-7391-7214","type":"B","kw":"성체순례성지","lat":37.6297324,"lng":126.7087309,"seq":"20190145"},{"name":"일만 위 순교자 현양 동산","diocese":"IC","addr":"인천시 강화군 내가면 고비고개로 741번길 107","tel":"032-932-6354","type":"B","kw":"일만위순교자현양동산","lat":37.7115208,"lng":126.4135273,"seq":"20190037","hp":"8ilmanwe.or.kr"},{"name":"이승훈 베드로 묘 (반주골)","diocese":"IC","addr":"인천시 남동구 장수동 산 132-1","type":"C","kw":"이승훈베드로묘(반주골)","lat":37.4553517,"lng":126.7437152,"seq":"20190036"},{"name":"구산 성지","diocese":"SW","addr":"경기도 하남시 미사강변북로 99","tel":"031-792-8540","type":"A","kw":"구산성지","lat":37.5726119,"lng":127.1893031,"seq":"20190038","hp":"7gusansungji.or.kr"},{"name":"남양 성모 성지","diocese":"SW","addr":"경기도 화성시 남양읍 남양성지로 112","tel":"031-356-5880","type":"A","kw":"남양성모성지","lat":37.205037,"lng":126.8167578,"seq":"20190039","hp":"8namyangmaria.org"},{"name":"남한산성 순교 성지","diocese":"SW","addr":"경기도 광주시 중부면 남한산성로 763-58","tel":"031-749-8522","type":"A","kw":"남한산성순교성지","lat":37.4771869,"lng":127.1859215,"seq":"20190040","hp":"7xn--9x2bw6bwxlb2h4rb5hg0in6a.org"},{"name":"단내 성가정 성지","diocese":"SW","addr":"경기도 이천시 호법면 이섭대천로155번길 38-13","tel":"031-633-9531","type":"A","kw":"단내성가정성지","lat":37.2195441,"lng":127.3944689,"seq":"20190041","hp":"7dannae.or.kr"},{"name":"미리내 성지","diocese":"SW","addr":"경기도 안성시 양성면 미리내성지로 420","tel":"031-674-1256","type":"A","kw":"미리내성지","lat":37.1417554,"lng":127.2593075,"seq":"20190042","hp":"7mirinai.or.kr"},{"name":"수리산 성지","diocese":"SW","addr":"경기도 안양시 만안구 병목안로 408","tel":"031-449-2842","type":"A","kw":"수리산성지","lat":37.3702373,"lng":126.9054091,"seq":"20190044","hp":"7surisan.kr"},{"name":"수원 성지 (수원 화성, 북수동 성당)","diocese":"SW","addr":"경기도 수원시 팔달구 정조로 842","tel":"031-246-8844~5","type":"A","kw":"수원성지(수원화성,북수동성당)","lat":37.2830224,"lng":127.0172134,"seq":"20190178","hp":"7suwons.net"},{"name":"양근 성지","diocese":"SW","addr":"경기도 양평군 양평읍 물안개공원길 37","tel":"031-775-3357","type":"A","kw":"양근성지","lat":37.5000168,"lng":127.4750429,"seq":"20190046","hp":"2yanggeun-hl"},{"name":"어농 성지","diocese":"SW","addr":"경기도 이천시 모가면 어농로 62번길 148","tel":"031-636-4061","type":"A","kw":"어농성지","lat":37.1902928,"lng":127.4296405,"seq":"20190047","hp":"7onong.or.kr"},{"name":"죽산 순교 성지","diocese":"SW","addr":"경기도 안성시 일죽면 장암로 276-44","tel":"031-676-6701","type":"A","kw":"죽산순교성지","lat":37.0758996,"lng":127.4497445,"seq":"20190050","hp":"8org.catholic.or.kr/juksan"},{"name":"천진암 성지","diocese":"SW","addr":"경기도 광주시 퇴촌면 천진암로 1203","tel":"031-764-5994","type":"A","kw":"천진암성지","lat":37.4243398,"lng":127.3837213,"seq":"20190051","hp":"8chonjinamsacred.modoo.at"},{"name":"손골 성지","diocese":"SW","addr":"경기도 용인시 수지구 동천로 437번길 67","tel":"031-263-1242","type":"C","kw":"손골성지","lat":37.3443923,"lng":127.0523832,"seq":"20190043"},{"name":"요당리 성지","diocese":"SW","addr":"경기도 화성시 양감면 요당길 155","tel":"031-353-9725","type":"C","kw":"요당리성지","lat":37.0683158,"lng":126.9303603,"seq":"20190048","hp":"7yodangshrine.kr"},{"name":"은이·골배마실 성지","diocese":"SW","addr":"경기도 용인시 처인구 양지면 은이로 182","tel":"031-338-1702","type":"C","kw":"은이·골배마실성지","lat":37.2155069,"lng":127.2778168,"seq":"20190049","hp":"5euni.kr"},{"name":"의정부 주교좌성당","diocese":"UJ","addr":"경기도 의정부시 신흥로 265번길 27","tel":"031-836-1980","type":"B","kw":"의정부주교좌성당","lat":37.7394418,"lng":127.0412639,"seq":"20190153","hp":"8ujbhome.or.kr"},{"name":"행주 성당","diocese":"UJ","addr":"경기도 고양시 덕양구 행주산성로 144번길 50","tel":"031-974-1728","type":"B","kw":"행주성당","lat":37.6022354,"lng":126.8168163,"seq":"20190157","hp":"2hjsd1909"},{"name":"갈곡리 성당","diocese":"UJ","addr":"경기도 파주시 법원읍 화합로 466번길 25","tel":"031-959-1208","type":"C","kw":"갈곡리성당","lat":37.846067,"lng":126.915147,"seq":"20190154","hp":"8sd.uca.or.kr/galgokri"},{"name":"마재 성가정 성지","diocese":"UJ","addr":"경기도 남양주시 조안면 다산로 698-44","tel":"031-576-5412","type":"C","kw":"마재성가정성지","lat":37.5215943,"lng":127.2960586,"seq":"20190056","hp":"7majaesungji.or.kr"},{"name":"성 남종삼 요한과 가족 묘소","diocese":"UJ","addr":"경기도 양주시 장흥면 울대리 산 22-2","type":"C","kw":"성남종삼요한과가족묘소","lat":37.7376578,"lng":126.9954393,"seq":"20190057"},{"name":"신암리 성당","diocese":"UJ","addr":"경기도 양주시 남면 감악산로 489번길 27-32","tel":"031-862-3455","type":"C","kw":"신암리성당","lat":37.9039569,"lng":126.9599577,"seq":"20190155","hp":"8sd.uca.or.kr/sinamri"},{"name":"양주 순교 성지","diocese":"UJ","addr":"경기도 양주시 부흥로 1399번길 62","tel":"031-841-1866","type":"C","kw":"양주순교성지","lat":37.7857867,"lng":127.0323088,"seq":"20190058","hp":"8sd.uca.or.kr/yangju1866"},{"name":"참회와 속죄의 성당","diocese":"UJ","addr":"경기도 파주시 탄현면 성동로 111","tel":"031-941-3159","type":"C","kw":"참회와속죄의성당","lat":37.7808354,"lng":126.6948815,"seq":"20190156","hp":"8sd.uca.or.kr/chamsok"},{"name":"황사영 알렉시오 순교자 묘","diocese":"UJ","addr":"경기도 양주시 장흥면 부곡리 116-2","type":"C","kw":"황사영알렉시오순교자묘","lat":37.7418848,"lng":126.9768662,"seq":"20190059","hp":"8sd.uca.or.kr/hsy1801"},{"name":"죽림동 순교 성지 (교구 순교자 묘역)","diocese":"CC","addr":"강원도 춘천시 약사고개길 21","type":"A","kw":"죽림동순교성지(교구순교자묘역)","lat":37.8766178,"lng":127.726556,"seq":"20190011"},{"name":"강릉 대도호부 관아","diocese":"CC","addr":"강원도 강릉시 임영로 131번길","type":"B","kw":"강릉대도호부관아","lat":37.7525948,"lng":128.8919443,"seq":"20190012"},{"name":"겟세마니 피정의 집","diocese":"CC","addr":"강원도 인제군 남면 빙어마을길 196","tel":"033-461-4243","type":"B","kw":"겟세마니피정의집","lat":37.9987355,"lng":128.0970261,"seq":"20190128"},{"name":"곰실 공소","diocese":"CC","addr":"강원도 춘천시 동내면 동내로 220","type":"B","kw":"곰실공소","lat":37.8483902,"lng":127.7751025,"seq":"20190013"},{"name":"금광리 공소","diocese":"CC","addr":"강원도 강릉시 구정면 금평로 514","type":"B","kw":"금광리공소","lat":37.6987039,"lng":128.9147892,"seq":"20190014"},{"name":"임당동 성당 (순교자 심능석 스테파노, 이유일 안토니오)","diocese":"CC","addr":"강원도 강릉시 임영로 148","tel":"033-642-0700","type":"B","kw":"임당동성당(순교자심능석스테파노,이유일안토니오)","lat":37.7544909,"lng":128.892291,"seq":"20190133"},{"name":"춘천교구 주교관과 교육원","diocese":"CC","addr":"강원도 춘천시 공지로 300","type":"B","kw":"춘천교구주교관과교육원","lat":37.8683289,"lng":127.7330026,"seq":"20190134"},{"name":"행정 공소 (옹기 마을 신앙촌)","diocese":"CC","addr":"강원도 강릉시 연곡면 행정 2길 14","tel":"033-662-5264","type":"B","kw":"행정공소(옹기마을신앙촌)","lat":37.853944,"lng":128.789007,"seq":"20190136"},{"name":"홍천 성당","diocese":"CC","addr":"강원도 홍천읍 마지기로 54","tel":"033-433-1026","type":"B","kw":"홍천성당","lat":37.6950074,"lng":127.8881368,"seq":"20190137"},{"name":"광암 이벽 요한 세례자 진묘 터와 생가 터","diocese":"CC","addr":"경기도 포천시 일동면 화동로 1079번길 7","type":"C","kw":"광암이벽요한세례자진묘터와생가터","lat":37.9595698,"lng":127.3176235,"seq":"20190129"},{"name":"묵호 성당 (순교자 라 파트리치오 신부)","diocese":"CC","addr":"강원도 동해시 발한로 161","tel":"033-535-8455","type":"C","kw":"묵호성당(순교자라파트리치오신부)","lat":37.5467023,"lng":129.1039089,"seq":"20190130"},{"name":"소양로 성당 (순교자 고 안토니오 신부)","diocese":"CC","addr":"강원도 춘천시 모수물길 22번길 26","tel":"033-255-2117","type":"C","kw":"소양로성당(순교자고안토니오신부)","lat":37.8877388,"lng":127.7283159,"seq":"20190131"},{"name":"순교자 라 파트리치오 신부 순교 터","diocese":"CC","addr":"강원도 강릉시 옥계면 낙풍리 산 16-2","type":"C","kw":"순교자라파트리치오신부순교터","lat":37.6348228,"lng":129.0222968,"seq":"20190132"},{"name":"양양 성지 (순교자 이광재 티모테오 신부)","diocese":"CC","addr":"강원도 양양군 양양읍 군청길 17","tel":"033-671-8911","type":"C","kw":"양양성지(순교자이광재티모테오신부)","lat":38.0765697,"lng":128.6207123,"seq":"20190015"},{"name":"포천 순교 성지 (복자 홍인 레오 순교 터)","diocese":"CC","addr":"경기도 포천시 군내면 호국로 1564","type":"C","kw":"포천순교성지(복자홍인레오순교터)","lat":37.8929612,"lng":127.2035129,"seq":"20190135"},{"name":"배론 성지","diocese":"WJ","addr":"충북 제천시 봉양읍 배론성지길 296","tel":"043-651-4527","type":"A","kw":"배론성지","lat":37.1606823,"lng":128.0824487,"seq":"20190053","hp":"8baeron.or.kr"},{"name":"대안리 공소","diocese":"WJ","addr":"강원도 원주시 흥업면 승안동길 216","type":"B","kw":"대안리공소","lat":37.3081008,"lng":127.8803845,"seq":"20190151"},{"name":"용소막 성당","diocese":"WJ","addr":"강원도 원주시 신림면 구학산로 1857","tel":"033-763-2343","type":"B","kw":"용소막성당","lat":37.2124263,"lng":128.0878671,"seq":"20190054"},{"name":"원동 주교좌성당","diocese":"WJ","addr":"강원도 원주시 원일로 27","tel":"033-765-3350","type":"B","kw":"원동주교좌성당","lat":37.3454471,"lng":127.9527623,"seq":"20190149","hp":"7wjwd.or.kr"},{"name":"강원 감영","diocese":"WJ","addr":"강원도 원주시 원일로 85","tel":"033-737-4767","type":"C","kw":"강원감영","lat":37.3479725,"lng":127.9504152,"seq":"20190150"},{"name":"성 남종삼 요한·남상교 아우구스티노 유택지 (묘재)","diocese":"WJ","addr":"충북 제천시 봉양읍 제원로 10길 15-7","type":"C","kw":"성남종삼요한·남상교아우구스티노유택지(묘재)","lat":37.1867154,"lng":128.1003273,"seq":"20190052"},{"name":"성내동 성당","diocese":"WJ","addr":"강원 삼척시 성당길 34-84","tel":"033-574-2273","type":"C","kw":"성내동성당","lat":37.4439479,"lng":129.1617947,"seq":"20190152","hp":"2soungnea"},{"name":"풍수원 성당","diocese":"WJ","addr":"강원도 횡성군 서원면 경강로 유현 1길 30","tel":"033-342-0035","type":"C","kw":"풍수원성당","lat":37.5291829,"lng":127.8186777,"seq":"20190055"},{"name":"갈매못 순교 성지","diocese":"DJ","addr":"충남 보령시 오천면 오천해안로 610","tel":"041-932-1311","type":"A","kw":"갈매못순교성지","lat":36.4282272,"lng":126.5079992,"seq":"20190016","hp":"7galmaemot.or.kr"},{"name":"공세리 성당","diocese":"DJ","addr":"충남 아산시 인주면 공세리성당길 10","tel":"041-533-8181","type":"A","kw":"공세리성당","lat":36.883406,"lng":126.9140749,"seq":"20190017","hp":"8gongseri.or.kr"},{"name":"대흥 봉수산 순교 성지","diocese":"DJ","addr":"충남 예산군 대흥면 의좋은형제길 25-14","tel":"041-333-0202","type":"A","kw":"대흥봉수산순교성지","lat":36.6055367,"lng":126.7891682,"seq":"20190138","hp":"2bongsusan1801"},{"name":"성거산 성지","diocese":"DJ","addr":"충남 천안시 서북구 입장면 위례산길 394","tel":"041-584-7199","type":"A","kw":"성거산성지","lat":36.876784,"lng":127.2392189,"seq":"20190022","hp":"7sgm.or.kr"},{"name":"솔뫼 성지","diocese":"DJ","addr":"충남 당진시 우강면 솔뫼로 132","tel":"041-362-5021","type":"A","kw":"솔뫼성지","lat":36.820326,"lng":126.7861293,"seq":"20190023","hp":"7solmoe.or.kr"},{"name":"청양 다락골 성지","diocese":"DJ","addr":"충남 청양군 화성면 다락골길 78-6","tel":"041-943-8123","type":"A","kw":"청양다락골성지","lat":36.4433817,"lng":126.6925596,"seq":"20190019","hp":"7daracgol.or.kr"},{"name":"해미 순교 성지","diocese":"DJ","addr":"충남 서산시 해미면 성지 1로 13","tel":"010-9655-3183","type":"A","kw":"해미순교성지","lat":36.7128708,"lng":126.5377497,"seq":"20190031","hp":"7haemi.or.kr"},{"name":"홍주 순교 성지","diocese":"DJ","addr":"충남 홍성군 홍성읍 아문길 37-1","tel":"041-633-2402","type":"A","kw":"홍주순교성지","lat":36.6024651,"lng":126.6617887,"seq":"20190032","hp":"7hongjushrine.com"},{"name":"황새 바위 순교 성지","diocese":"DJ","addr":"충남 공주시 왕릉로 118","tel":"041-854-6321~2","type":"A","kw":"황새바위순교성지","lat":36.4638528,"lng":127.1200856,"seq":"20190033","hp":"7hwangsae.or.kr"},{"name":"남방제","diocese":"DJ","addr":"충남 아산시 신창면 서부북로 763-42","type":"C","kw":"남방제","lat":36.7985161,"lng":126.9458441,"seq":"20190018","hp":"2nambangjaeshrime"},{"name":"도앙골 성지","diocese":"DJ","addr":"충남 부여군 내산면 금지로 302","tel":"041-836-9625","type":"C","kw":"도앙골성지","lat":36.2623409,"lng":126.733972,"seq":"20190139","hp":"2southnaepo"},{"name":"배나드리","diocese":"DJ","addr":"충남 예산군 삽교읍 용동리 270-23","type":"C","kw":"배나드리","lat":36.7111892,"lng":126.7228567,"seq":"20190020"},{"name":"산막골·작은재","diocese":"DJ","addr":"충남 서천군 판교면 금덕길 81번길 119","type":"C","kw":"산막골·작은재","lat":36.1602039,"lng":126.7096868,"seq":"20190021"},{"name":"삽티 성지","diocese":"DJ","addr":"충남 부여군 홍산면 삽티로 489-6","tel":"041-836-9625","type":"C","kw":"삽티성지","lat":36.2562513,"lng":126.7450128,"seq":"20190140","hp":"2southnaepo"},{"name":"서짓골 성지","diocese":"DJ","addr":"충남 보령시 미산면 평라리 438-3","tel":"041-836-9625","type":"C","kw":"서짓골성지","lat":36.2329872,"lng":126.6574291,"seq":"20190141","hp":"2southnaepo"},{"name":"수리치골 성모 성지","diocese":"DJ","addr":"충남 공주시 신풍면 용수봉갑길 544","tel":"041-841-1750","type":"C","kw":"수리치골성모성지","lat":36.5169787,"lng":126.897108,"seq":"20190024","hp":"8surichigol.tistory.com"},{"name":"신리 성지","diocese":"DJ","addr":"충남 당진시 합덕읍 평야 6로 135","tel":"041-363-1359","type":"C","kw":"신리성지","lat":36.7626628,"lng":126.7710859,"seq":"20190025","hp":"8sinri.or.kr"},{"name":"여사울 성지","diocese":"DJ","addr":"충남 예산군 신암면 신종여사울길 22","tel":"041-332-7860","type":"C","kw":"여사울성지","lat":36.7566971,"lng":126.8238638,"seq":"20190026"},{"name":"원머리","diocese":"DJ","addr":"충남 당진시 신평면 한정리 231-1","type":"C","kw":"원머리","lat":36.8994725,"lng":126.7912234,"seq":"20190027","hp":"7sinpyeongcatholic.or.kr"},{"name":"지석리","diocese":"DJ","addr":"충남 부여군 충화면 지석리 368-1","type":"C","kw":"지석리","lat":36.18691,"lng":126.8024736,"seq":"20190028"},{"name":"진산 성지","diocese":"DJ","addr":"충남 금산군 진산면 실학로 207","tel":"041-752-6249","type":"C","kw":"진산성지","lat":36.1803912,"lng":127.3532312,"seq":"20190029"},{"name":"합덕 성당","diocese":"DJ","addr":"충남 당진시 합덕읍 합덕성당 2길 22","tel":"041-363-1061","type":"C","kw":"합덕성당","lat":36.7928293,"lng":126.7855189,"seq":"20190030"},{"name":"황무실 성지","diocese":"DJ","addr":"충남 당진시 합덕읍 석우리 1013","type":"C","kw":"황무실성지","lat":36.7825647,"lng":126.7378243,"seq":"20190142"},{"name":"배티 성지","diocese":"CJ","addr":"충북 진천군 백곡면 배티로 663-13","tel":"043-533-5710","type":"A","kw":"배티성지","lat":36.9265955,"lng":127.3279897,"seq":"20190076","hp":"7baeti.org"},{"name":"서운동 순교 성지 성당 (청주 읍성 순교 성지)","diocese":"CJ","addr":"충북 청주시 상당구 대성로 41","tel":"043-252-6984","type":"A","kw":"서운동순교성지성당(청주읍성순교성지)","lat":36.6289585,"lng":127.4927404,"seq":"20190169"},{"name":"연풍 순교 성지","diocese":"CJ","addr":"충북 괴산군 연풍면 중앙로 홍문 2길 14","tel":"043-833-5064","type":"A","kw":"연풍순교성지","lat":36.7624765,"lng":127.9944499,"seq":"20190077"},{"name":"감곡 매괴 성모 순례지 성당","diocese":"CJ","addr":"충북 음성군 감곡면 성당길 10","tel":"043-881-2808","type":"B","kw":"감곡매괴성모순례지성당","lat":37.1218316,"lng":127.641004,"seq":"20190075","hp":"8maegoe.com"},{"name":"멍에목 성지","diocese":"CJ","addr":"충북 보은군 속리산면 구병길 4-11","tel":"043-543-0691","type":"C","kw":"멍에목성지","lat":36.4798126,"lng":127.8712847,"seq":"20190168"},{"name":"관덕정 순교 기념관","diocese":"DG","addr":"대구시 중구 관덕정길 11","tel":"053-254-0151","type":"A","kw":"관덕정순교기념관","lat":35.8651495,"lng":128.5911097,"seq":"20190061","hp":"7daegusaint.org"},{"name":"복자 성당","diocese":"DG","addr":"대구시 동구 송라동 22","tel":"053-745-3850","type":"A","kw":"복자성당","lat":35.8687689,"lng":128.6210036,"seq":"20190062","hp":"2bokjabondang"},{"name":"신나무골 성지","diocese":"DG","addr":"경북 칠곡군 지천면 칠곡대로 2189-24","tel":"054-974-3217","type":"A","kw":"신나무골성지","lat":35.9670646,"lng":128.4616278,"seq":"20190064","hp":"7sinnamugol.or.kr"},{"name":"한티 순교성지","diocese":"DG","addr":"경북 칠곡군 동명면 한티로 1길 69","tel":"054-975-5151","type":"A","kw":"한티순교성지","lat":36.0166765,"lng":128.6302548,"seq":"20190066","hp":"8hanti.or.kr"},{"name":"가실 성당","diocese":"DG","addr":"경북 칠곡군 왜관읍 가실 1길 1","tel":"054-976-1102","type":"B","kw":"가실성당","lat":35.9366327,"lng":128.4053497,"seq":"20190158"},{"name":"계산 주교좌성당","diocese":"DG","addr":"대구시 중구 서성로 10","tel":"053-254-2300","type":"B","kw":"계산주교좌성당","lat":35.8679579,"lng":128.5878135,"seq":"20190060","hp":"7gyesancathedral.kr"},{"name":"구룡 공소","diocese":"DG","addr":"경북 청도군 운문면 구룡마을길 361-5","type":"B","kw":"구룡공소","lat":35.8309993,"lng":128.9665543,"seq":"20190161"},{"name":"김수환 추기경 사랑과 나눔 공원","diocese":"DG","addr":"경북 군위군 군위읍 군위금성로 270","tel":"054-383-1922","type":"B","kw":"김수환추기경사랑과나눔공원","lat":36.2323715,"lng":128.5996354,"seq":"20190162","hp":"7cardinalkim-park.org"},{"name":"김천 황금 성당","diocese":"DG","addr":"경북 김천시 학사대길 64","tel":"054-433-3880","type":"B","kw":"김천황금성당","lat":36.1161005,"lng":128.1220904,"seq":"20190163","hp":"2kimchonhounggumdong"},{"name":"새방골 성당","diocese":"DG","addr":"대구시 서구 새방로 27길 9","tel":"053-553-2979","type":"B","kw":"새방골성당","lat":35.8678101,"lng":128.5283494,"seq":"20190165"},{"name":"성 유스티노 신학교","diocese":"DG","addr":"대구시 중구 명륜로 12길 47","tel":"053-660-5100","type":"B","kw":"성유스티노신학교","lat":35.8622168,"lng":128.5877388,"seq":"20190166"},{"name":"성모당","diocese":"DG","addr":"대구시 중구 남산로 4길 112","tel":"053-250-3055","type":"B","kw":"성모당","lat":35.8608921,"lng":128.5862379,"seq":"20190063"},{"name":"성직자 묘지","diocese":"DG","addr":"대구시 중구 남산로 4길 112","type":"B","kw":"성직자묘지","lat":35.8600808,"lng":128.5881656,"seq":"20190167"},{"name":"경상 감영과 옥 터 (대안 성당)","diocese":"DG","addr":"대구시 중구 서성로 16길 77","tel":"053-252-6249","type":"C","kw":"경상감영과옥터(대안성당)","lat":35.8736634,"lng":128.5919399,"seq":"20190159","hp":"2DAEAN"},{"name":"경주 관아와 옥 터 (성건 성당)","diocese":"DG","addr":"경북 경주시 북문로 55번길 24","tel":"054-749-8900","type":"C","kw":"경주관아와옥터(성건성당)","lat":35.8524087,"lng":129.2087775,"seq":"20190160","hp":"2gjsgsd"},{"name":"비산(날뫼) 성당","diocese":"DG","addr":"대구시 서구 북비산로 67길 31","tel":"053-564-1004","type":"C","kw":"비산(날뫼)성당","lat":35.8836119,"lng":128.5705902,"seq":"20190164","hp":"2bisanseongdang"},{"name":"진목정 성지","diocese":"DG","addr":"경북 경주시 산내면 수의길 192","tel":"054-751-6488","type":"C","kw":"진목정성지","lat":35.7530509,"lng":129.076072,"seq":"20190065","hp":"7jinmokjeong.or.kr"},{"name":"김범우 순교자 성지","diocese":"BS","addr":"경남 밀양시 사기점길 50-100","tel":"055-356-7030","type":"A","kw":"김범우순교자성지","lat":35.4380097,"lng":128.8349376,"seq":"20190067"},{"name":"수영 장대 순교 성지","diocese":"BS","addr":"부산시 수영구 광일로 29번길 51","type":"A","kw":"수영장대순교성지","lat":35.159271,"lng":129.1073882,"seq":"20190070","hp":"7jangdae.catb.kr"},{"name":"오륜대 순교자 성지","diocese":"BS","addr":"부산시 금정구 오륜대로 106-1","tel":"051-515-0030","type":"A","kw":"오륜대순교자성지","lat":35.2458957,"lng":129.1014246,"seq":"20190072","hp":"7oryundae.com"},{"name":"울산 병영 순교 성지","diocese":"BS","addr":"울산시 중구 외솔큰길 241","type":"A","kw":"울산병영순교성지","lat":35.5710937,"lng":129.3505039,"seq":"20190068"},{"name":"살티 공소 (김영제와 김 아가타 묘)","diocese":"BS","addr":"울산시 울주군 상북면 덕현살티길 11","type":"B","kw":"살티공소(김영제와김아가타묘)","lat":35.6110877,"lng":129.0408998,"seq":"20190069"},{"name":"언양 성당","diocese":"BS","addr":"울산시 울주군 언양읍 구교동 1길 11","tel":"052-262-5312~3","type":"B","kw":"언양성당","lat":35.5697945,"lng":129.1148376,"seq":"20190071","hp":"7eonyang.pbcbs.co.kr"},{"name":"조씨 형제 순교자 묘","diocese":"BS","addr":"부산시 강서구 생곡길 26번길 9-19","type":"C","kw":"조씨형제순교자묘","lat":35.12948,"lng":128.881103,"seq":"20190074"},{"name":"죽림굴","diocese":"BS","addr":"울산시 울주군 상북면 억새벌길 220-78","type":"C","kw":"죽림굴","lat":35.5472687,"lng":129.0328261,"seq":"20190073"},{"name":"대산 성당 (복자 구한선 타대오 성지)","diocese":"MS","addr":"경남 함안군 대산면 대산중앙로 183","tel":"055-582-8041","type":"A","kw":"대산성당(복자구한선타대오성지)","lat":35.3502429,"lng":128.4293961,"seq":"20190170","hp":"2daesanseungji"},{"name":"명례 성지","diocese":"MS","addr":"경남 밀양시 하남읍 명례안길 44-3","tel":"055-391-1205","type":"A","kw":"명례성지","lat":35.3506943,"lng":128.7655585,"seq":"20190078","hp":"2myungrye"},{"name":"복자 윤봉문 요셉 성지","diocese":"MS","addr":"경남 거제시 일운면 지세포 3길 69-22","type":"A","kw":"복자윤봉문요셉성지","lat":34.8240221,"lng":128.6959189,"seq":"20190082","hp":"2yoonbongmoon"},{"name":"순교자의 딸 유섬이 묘","diocese":"MS","addr":"경남 거제시 거제면 내간리 산 53-2","type":"B","kw":"순교자의딸유섬이묘","lat":34.8497488,"lng":128.5545167,"seq":"20190171"},{"name":"복자 박대식 빅토리노 묘","diocese":"MS","addr":"경남 김해시 진례면 청천리 산 30","type":"C","kw":"복자박대식빅토리노묘","lat":35.2710402,"lng":128.7410215,"seq":"20190080"},{"name":"복자 정찬문 안토니오 묘","diocese":"MS","addr":"경남 진주시 사봉면 동부로 1751번길 46-6","type":"C","kw":"복자정찬문안토니오묘","lat":35.1836603,"lng":128.2636597,"seq":"20190083"},{"name":"마원 성지 (복자 박상근 마티아 묘)","diocese":"AD","addr":"경북 문경시 문경읍 마원리 599-1","type":"A","kw":"마원성지(복자박상근마티아묘)","lat":36.7234581,"lng":128.1011751,"seq":"20190084"},{"name":"신앙 고백비 (옥산 성당)","diocese":"AD","addr":"경북 상주시 청리면 삼괴 2길 361","type":"B","kw":"신앙고백비(옥산성당)","lat":36.3669874,"lng":128.1178507,"seq":"20190085"},{"name":"우곡 성지","diocese":"AD","addr":"경북 봉화군 봉성면 시거리길 397","tel":"054-673-4152","type":"B","kw":"우곡성지","lat":36.9454661,"lng":128.829311,"seq":"20190087"},{"name":"홍유한 고택지 (휴천동 성당)","diocese":"AD","addr":"경북 영주시 단산면 구구로 239-6","type":"B","kw":"홍유한고택지(휴천동성당)","lat":36.9074753,"lng":128.624761,"seq":"20190089"},{"name":"상주 옥 터 (남성동 성당)","diocese":"AD","addr":"경북 상주시 남문 2길 89-15","type":"C","kw":"상주옥터(남성동성당)","lat":36.4139408,"lng":128.1641219,"seq":"20190172"},{"name":"여우목 성지","diocese":"AD","addr":"경북 문경시 문경읍 중평리 96","type":"C","kw":"여우목성지","lat":36.8000582,"lng":128.211271,"seq":"20190086"},{"name":"진안리 성지","diocese":"AD","addr":"경북 문경시 문경읍 진안리 92-4","type":"C","kw":"진안리성지","lat":36.7362065,"lng":128.0915948,"seq":"20190088"},{"name":"가톨릭 목포 성지","diocese":"GJ","addr":"전남 목포시 노송길 35(산정동)","tel":"061-279-4650","type":"C","kw":"가톨릭목포성지","lat":34.799555,"lng":126.3859755,"seq":"20190173","hp":"8mpcatholic.or.kr"},{"name":"곡성 옥 터 (곡성 성당)","diocese":"GJ","addr":"전남 곡성군 곡성읍 읍내 11길 20","tel":"061-362-1004","type":"C","kw":"곡성옥터(곡성성당)","lat":35.2823659,"lng":127.2929553,"seq":"20190093","hp":"7gscatholic.co.kr"},{"name":"나주 순교자 기념 성당","diocese":"GJ","addr":"전남 나주시 박정길 3","tel":"061-334-2123","type":"C","kw":"나주순교자기념성당","lat":35.036939,"lng":126.7152134,"seq":"20190092"},{"name":"영광 순교자 기념 성당","diocese":"GJ","addr":"전남 영광군 영광읍 중앙로 2길 40","tel":"061-351-2276","type":"C","kw":"영광순교자기념성당","lat":35.2723324,"lng":126.5141575,"seq":"20190174"},{"name":"여산 하늘의 문 성당 (백지사 터, 숲정이, 배다리)","diocese":"JJ","addr":"전북 익산시 여산면 영전길 14","tel":"063-838-8761","type":"A","kw":"여산하늘의문성당(백지사터,숲정이,배다리)","lat":36.060148,"lng":127.0851322,"seq":"20190098","hp":"2yeosan-holyland"},{"name":"전동 순교 성지","diocese":"JJ","addr":"전북 전주시 완산구 태조로 51","tel":"063-284-3222","type":"A","kw":"전동순교성지","lat":35.8133288,"lng":127.1492215,"seq":"20190099","hp":"7jeondong.or.kr"},{"name":"천호 성지","diocese":"JJ","addr":"전북 완주군 비봉면 천호성지길 124","tel":"063-263-1004~5","type":"A","kw":"천호성지","lat":36.03811673,"lng":127.1310071,"seq":"20190100","hp":"8cheonhos.org"},{"name":"치명자산 성지","diocese":"JJ","addr":"전북 전주시 완산구 바람쐬는길 92","tel":"063-285-5755","type":"A","kw":"치명자산성지","lat":35.8072383,"lng":127.1642218,"seq":"20190103","hp":"8shalom-house.com"},{"name":"고창 개갑 장터 순교 성지","diocese":"JJ","addr":"전라북도 고창군 공음면 선운대로 91","tel":"063-563-9846","type":"C","kw":"고창개갑장터순교성지","lat":35.386096,"lng":126.5042664,"seq":"20190175","hp":"8gaegabjangteo.or.kr"},{"name":"김제 순교 성지","diocese":"JJ","addr":"전북 김제시 신풍길 253-16","type":"C","kw":"김제순교성지","lat":35.7983671,"lng":126.8893173,"seq":"20190176"},{"name":"나바위 성지","diocese":"JJ","addr":"전북 익산시 망성면 나바위 1길 146","tel":"063-861-9210","type":"C","kw":"나바위성지","lat":36.1382598,"lng":126.9994356,"seq":"20190094","hp":"7nabawi.kr"},{"name":"서천교, 초록 바위","diocese":"JJ","addr":"전북 전주시 완산구 서완산동 1가 231-4","type":"C","kw":"서천교,초록바위","lat":35.8123936,"lng":127.1407806,"seq":"20190102"},{"name":"전주 숲정이 성지","diocese":"JJ","addr":"전북 전주시 덕진구 공북로 19","tel":"063-255-2677~8","type":"C","kw":"전주숲정이성지","lat":35.8254746,"lng":127.1335485,"seq":"20190097"},{"name":"전주 옥 터","diocese":"JJ","addr":"전북 전주시 완산구 현무 1길 20","type":"C","kw":"전주옥터","lat":35.8213498,"lng":127.1493826,"seq":"20190177"},{"name":"초남이 성지","diocese":"JJ","addr":"전북 완주군 이서면 초남신기길 122-1","tel":"063-214-5004","type":"C","kw":"초남이성지","lat":35.8551259,"lng":127.0225887,"seq":"20190101","hp":"2chonamri"},{"name":"용수 성지 (성 김대건 신부 제주 표착 기념 성당)","diocese":"JE","addr":"제주도 제주시 한경면 용수 1길 108","tel":"064-772-1252","type":"A","kw":"용수성지(성김대건신부제주표착기념성당)","lat":33.3228638,"lng":126.1677309,"seq":"20190109"},{"name":"관덕정 순교 터","diocese":"JE","addr":"제주도 제주시 관덕로 19","type":"B","kw":"관덕정순교터","lat":33.5133492,"lng":126.5214571,"seq":"20190105"},{"name":"대정 성지 (정난주 마리아 묘)","diocese":"JE","addr":"제주도 서귀포시 대정읍 동일리 10","type":"B","kw":"대정성지(정난주마리아묘)","lat":33.2543447,"lng":126.2611487,"seq":"20190106"},{"name":"새미 은총의 동산","diocese":"JE","addr":"제주도 제주시 한림읍 새미소길 15","type":"B","kw":"새미은총의동산","lat":33.3480029,"lng":126.3237484,"seq":"20190108"},{"name":"황경한 묘","diocese":"JE","addr":"제주도 제주시 추자면 신양리 산 20-1","type":"B","kw":"황경한묘","lat":33.9490667,"lng":126.3400848,"seq":"20190110"},{"name":"황사평 성지","diocese":"JE","addr":"제주도 제주시 기와 5길 117-22","type":"B","kw":"황사평성지","lat":33.4904757,"lng":126.5598768,"seq":"20190111"},{"name":"김기량 순교 현양비","diocese":"JE","addr":"제주도 제주시 조천읍 함덕리 940-2","type":"C","kw":"김기량순교현양비","lat":33.5369498,"lng":126.6709805,"seq":"20190107"}];

const _DIO={'SE':'서울대교구','SW':'수원교구','DG':'대구대교구','DJ':'대전교구','GJ':'광주대교구','IC':'인천교구','BS':'부산교구','JJ':'전주교구','UJ':'의정부교구','CJ':'청주교구','MS':'마산교구','CC':'춘천교구','WJ':'원주교구','AD':'안동교구','JE':'제주교구','ML':'군종교구'};
const _URL_T={'1':'http://cafe.daum.net/','2':'https://cafe.daum.net/','3':'http://cafe.naver.com/','4':'https://cafe.naver.com/','5':'http://www.','6':'https://www.','7':'http://','8':'https://','P1':'https://www.casuwon.or.kr','P2':'https://www.daegu-archdiocese.or.kr','P3':'https://www.djcatholic.or.kr','P4':'https://www.gjcatholic.or.kr','P5':'http://www.caincheon.or.kr','P6':'https://www.catholicbusan.or.kr','P7':'https://www.jcatholic.or.kr','P8':'http://www.ucatholic.or.kr','P9':'https://www.cdcj.or.kr','PA':'https://cathms.kr','PB':'https://aos.catholic.or.kr','PC':'https://www.diocesejeju.or.kr','PD':'https://www.gunjong.or.kr','PE':'https://sd.uca.or.kr','PR':'https://www.cbck.or.kr/Directory/Retreat/'};
function _decUrl(u){if(!u)return '';const t=_URL_T[u.slice(0,2)];if(t)return t+u.slice(2);const t1=_URL_T[u[0]];return t1?t1+u.slice(1):u;}
function _unpack(raw){return raw.map((r,i)=>({_idx:i,name:r[0],diocese:_DIO[r[1]]||r[1],addr:r[2],tel:r[3]||'',hp:_decUrl(r[4]||''),url:_decUrl(r[5]||''),lat:r[6],lng:r[7]}));}

const PARISHES=(function(raw){
 return raw.map(r=>{
  const h=r[4]||'';
  const u=r[5]||'';
  return{name:r[0],diocese:_DIO[r[1]]||r[1],addr:r[2],
     tel:r[3]||'',hp:h&&_URL_T[h[0]]?_URL_T[h[0]]+h.slice(1):h,
     url:u&&_URL_T[u.slice(0,2)]?_URL_T[u.slice(0,2)]+u.slice(2):(u&&_URL_T[u[0]]?_URL_T[u[0]]+u.slice(1):u),
     lat:r[6],lng:r[7]};
 });
})(_PA_RAW);

// ─── 피정의 집 데이터 [190개] ───
const _RT_RAW = [["골롬반 선교 센터","SE","서울 성북구 동소문로 93-14","02-926-1217","7columban.or.kr/missioncenter","PR201003891",37.5930873,127.0153654],["꼰벤뚜알 프란치스코 피정의 집","SE","서울 용산구 한남대로 90","02-793-2070","7ofmconv.or.kr/page/18","PR201003893",37.5366245,127.0060646],["노틀담 교육관","SE","서울 종로구 북촌로 54","02-763-2274","1ndvlwjd","PR201003894",37.5814502,126.9854227],["로가떼의 샘","SE","서울 동작구 사당로2다길 95","02-584-6367","7fdzkorea.org","PR201008739",37.4890658,126.9634638],["마리스타 교육관","SE","서울 마포구 토정로2길 37","02-333-6227","7facebook.com/maristakorea","PR201003895",37.5445204,126.914123],["바오로 교육관","SE","서울 중구 명동길 74-2","02-752-7894","7spcseoul.or.kr/sub5/sub5_01.php","PR201003900",37.5624314,126.9885118],["복자 사랑 피정의집","SE","서울 성북구 성북로24길 3","02-762-2067","7brotherhood.or.kr","PR201003912",37.5947082,126.995371],["살레시오 교육관","SE","서울 영등포구 여의대방로 65","02-828-3522","7ibosco.net","PR201003897",37.496846,126.9132865],["삼성산 피정의 집","SE","서울 관악구 호암로 454-16","02-874-6346","7sscr.or.kr","PR201003898",37.4568734,126.9291471],["상지 피정의 집","SE","서울 성북구 아리랑로16길 52","010-7509-3547","7benedictsangji.com","PR201007519",37.5994392,127.0158989],["서울 마리아니스트 영성 센터","SE","서울 양천구 목동중앙본로30가길 20","02-2648-7934","1marianist-fmi","PR201008740",37.5447956,126.871811],["서울 수도원 피정의 집","SE","서울 중구 장충단로4길 14","02-2273-6394","7osb.or.kr","PR201003902",37.5609677,127.0068724],["서울 영성의 집","SE","서울 종로구 사직로7길 14","02-737-7764","7carmis.org","PR201003909",37.5752959,126.9655545],["성 앵베르 센터","SE","서울 은평구 연서로46길 35","02-2280-1784","","PR201008358",37.6344136,126.9357266],["성 토마스 영성센터","SE","서울 강북구 삼양로139나길 16-8","010-5075-3513","2Dominicanis","PR201008791",37.6492679,127.0115401],["성가소비녀회 교육관","SE","서울 성북구 길음로9길 46","010-2796-4724","7holyfamily.or.kr/sub2/page06.html","PR201007229",37.605706,127.0190486],["성령 쇄신 봉사 회관","SE","서울 관악구 조원중앙로2길 62","02-867-7900","8crks.or.kr/","PR201008742",37.4811935,126.9082214],["성북동 기도의 집","SE","서울 성북구 성북로 80","02-747-8507","1cciph","PR201007056",37.5935262,127.0000272],["씨튼 영성 센터","SE","서울 성북구 성북로9길 5","02-744-9825","7setonsc.com","PR201003903",37.5904988,127.0035327],["안토니오 피정의 집","SE","서울 종로구 평창11길 74","02-3217-4141","7band.us/@antonioretreat","PR201008743",37.611645,126.9668651],["여정 성서 교육관 (교육관)","SE","서울 서초구 남부순환로 2124","02-525-7869","2blblelife-caritas","PR201003892",37.4751084,126.9843717],["예수수도회 영성센터","SE","서울 구로구 경인로2길 11","010-6890-7223","7maryward.or.kr/pages/retreat.php","PR201006297",37.4906435,126.8277895],["예수회 센터","SE","서울 마포구 서강대길 19","02-3276-7733","7center.jesuit.kr","PR201003906",37.5496832,126.9404437],["우이동 명상의 집","SE","서울 강북구 삼양로179길 283","02-990-1004","7passionists.or.kr","PR201002368",37.6738833,127.0029426],["전진상 영성센터","SE","서울 중구 명동10길 35-4","02-726-0700","7jjscen.or.kr","PR201003910",37.5621636,126.9860739],["프란치스코 교육회관","SE","서울 중구 정동길 9","02-6364-2200","5fec.or.kr","PR201003911",37.5674513,126.9701582],["햇살사목센터","SE","서울 종로구 혜화로2길 20","02-744-0840","5hatsal.or.kr/main/index.php","PR201008796",37.586967,127.0008378],["가르멜수도회피정의집","IC","인천 계양구 계양산로35번길 12-62","032-542-2625","7carmel.kr","PR201003929",37.5461813,126.7144065],["가정동기도의집","IC","인천 서구 서달로221번길 8-4","032-572-5486","7solph.or.kr/page/?pid=pijung","PR201003933",37.5183945,126.6806294],["갑곶순교성지50주년기념영성센터","IC","인천 강화군 강화읍 해안동로1366번길 35","032-933-1528","7gabgot.com","PR201007144",37.7340214,126.5170201],["꽃동네 교황프란치스코센터(피정의 집)","IC","인천 강화군 양사면 덕하로114번길 71","032-932-2229","","PR201008129",37.7963744,126.4257585],["꾸르실료 태암 레오관","IC","인천 중구 우현로50번길 2","032-766-5961","2decolores120","PR201009114",37.4709503,126.6308269],["노틀담생태영성의집","IC","인천 강화군 불은면 고능로272번길 37-1","032-937-7821","1ecosfarm","PR201007875",37.6891043,126.4899677],["마리아니스트 영성 센터","IC","인천 강화군 양사면 전망대로 1446","032-933-6726","1m-nist","PR201006871",37.794485,126.410959],["바다의별피정의집","IC","인천 옹진군 덕적면 덕적남로606번길 15-23","032-831-2806","","PR201008156",37.2239891,126.1190889],["복자심조이바르바라피정의집","IC","인천 동구 박문로 1","032-765-6942","","PR201007925",37.4700165,126.652086],["성 아우구스띠노 수도회 열림터","IC","인천 중구 참외전로72번길 11","032-761-0768","7osakorea.or.kr","PR201003937",37.4779198,126.6282895],["성바오로피정의집","IC","경기 시흥시 범안로336번길 46","031-311-0074","7spcseoul.or.kr","PR201003936",37.4544825,126.8090906],["성안드레아피정의 집","IC","인천 남동구 백범로247번길 29","032-465-0835","7brotherhood.or.kr","PR201003938",37.4597084,126.7227042],["소사 성 분도 은혜의집","IC","경기 부천시 원미구 소사로320번길 35","032-348-1910","","PR201006096",37.4861354,126.7964267],["예수 성심 전교 수도회 강화 피정의 집","IC","인천 강화군 불은면 불은남로225번길 85","032-937-6955","8koreamsc.com/gangwha/","PR201003932",37.6720526,126.5009342],["예수의성모피정의집","IC","인천 강화군 내가면 황청포구로443번길 62-21","032-934-1646","5jmaria.or.kr/intro.php","PR201006097",37.712478,126.3629173],["일만위 순교자 피정의 집","IC","인천 강화군 내가면 고비고개로741번길 107","032-721-8741","8ilmanwestay.or.kr/","PR201008883",37.713149,126.4148414],["가톨릭교육문화회관","SW","경기 의왕시 원골로 48","031-457-6220","","PR201004455",37.3608204,126.9698113],["갓등이피정의집","SW","경기 화성시 효행구 봉담읍 독정길 34","031-298-8564","7facebook.com/249478465074886","PR201003954",37.1957045,126.9368979],["고초골피정의집","SW","경기 용인시 처인구 원삼면 고초골로 15","031-337-0470","1Gochogol","PR201003940",37.153745,127.2809656],["기천리베네딕도교육원","SW","경기 화성시 팔탄면 건달산로 208","031-354-2160","","PR201007443",37.190766,126.910037],["까리따스 거단길 피정의집","SW","경기 양평군 양동면 거단길 38-40","010-9588-9968","7sw.icaritas.or.kr/L/20650011","PR201007325",37.3953098,127.7112734],["루하 피정의 집","SW","경기 양평군 단월면 석산로 1482","010-7165-0166","8peacepentecost.com/layout/res/home.php?go=main&","PR201009115",37.6430447,127.6123395],["마리아 영성의 집","SW","경기 화성시 효행구 봉담읍 최루백로 136-5","031-227-8221","5mariahouse.kr/","PR201008869",37.2100721,126.9554966],["마리아폴리센터","SW","경기 의왕시 원골로 64","031-456-7423","7focolare.or.kr","PR201004469",37.3613074,126.9716081],["말씀의집","SW","경기 수원시 장안구 경수대로 1196-45","031-254-8950","7hwsj.jesuit.kr","PR201003943",37.3187676,126.993953],["몬띠피정의집","SW","경기 수원시 장안구 장안로458번길 138","031-207-4982","7mariasons.or.kr","PR201003944",37.3239417,126.9758328],["미리내 묵상의 집","SW","경기 안성시 양성면 미리내성지로 414","010-4762-9372","1mirinaeTrinity","PR201003939",37.1398006,127.2603082],["미리내 성지 순례자의 집","SW","경기 안성시 양성면 미리내성지로 420","031-674-1256","5mirinai.or.kr/","PR201003945",37.1484281,127.2591356],["사랑과평화의집","SW","경기 여주시 금사면 안산길 47-63","031-882-7376","","PR201007255",37.365784,127.477269],["새감영성의집","SW","경기 용인시 처인구 포곡읍 백옥대로1832번길 67","070-4047-3871","1inbosaegam","PR201007469",37.2911235,127.2410883],["성가소비녀회 내림의 집 (기도의 집, 피정의 집)","SW","경기 양평군 서종면 풀무길 59","031-772-6497","5holyfamily.or.kr/","PR201008943",37.6083107,127.3942343],["성모교육원","SW","경기 용인시 수지구 고기로163번길 17","031-263-4222","","PR201004474",37.3483631,127.085021],["성심교육관","SW","경기 용인시 수지구 고기로45번길 40-11","031-262-7600","1sungsimedu","PR201003946",37.3408251,127.0922666],["수원교구 죽산 영성관","SW","경기 안성시 일죽면 종배길 81","031-8057-0177","","PR201005739",37.076539,127.4503241],["수지성모의 집","SW","경기 용인시 수지구 고기로163번길 10","031- 282-5110","","PR201008712",37.3491564,127.0844215],["스승예수피정의집","SW","경기 여주시 강천면 원양1로 816","031-886-1101","7pddm.or.kr/","PR201003948",37.3461444,127.7502401],["아론의집 (피정센터)","SW","경기 의왕시 원골로 66","031-452-4071","7lazarus.or.kr","PR201003949",37.3620683,126.9736533],["아씨시 피정의 집","SW","경기 화성시 만세구 팔탄면 윗사내길24번길 42-14","031-353-8684","7sfma.or.kr","PR201003941",37.1799628,126.9160735],["안산가톨릭회관","SW","경기 안산시 상록구 충장로 224","031-365-4770","","PR201008423",37.3015026,126.8603864],["여주피정의집","SW","경기 여주시 강천면 원양1로 804","031-886-4108","","PR201003951",37.3439845,127.7509736],["영보의 집","SW","경기 과천시 문원청계길 56","02-502-3166","7smyoungbo.or.kr","PR201003952",37.4239313,127.0115867],["영보피정의집","SW","경기 용인시 처인구 이동읍 이원로 512","031-322-7668","","PR201003953",37.1640209,127.238054],["예수 그리스도 피정의 집","SW","경기 이천시 장호원읍 설장로 786","031-643-4552","1Jesucristo","PR201008431",37.1288214,127.5972875],["오자남생활학습관","SW","경기 수원시 장안구 경수대로1220번길 10","031-246-2930","2svincent","PR201007254",37.3199385,126.988797],["재속 프란치스코 광주지구 교육회관","SW","경기 광주시 고불로211번길 29","061-392-1403","","PR201007042",37.3948947,127.2120536],["프란치스코 기도의 집","SW","경기 양평군 서종면 중미산로 136","031-771-6133","7ofmconv.or.kr","PR201003955",37.6001805,127.3673398],["마리아니스트 센터","UJ","경기 고양시 덕양구 호수로 76-13","031-926-3091","3marianistcenter","PR201007319",37.6238048,126.8076151],["문산 예수마음 피정의 집 공동체","UJ","경기 파주시 파주읍 바리골길 260-129","031-953-6932","7jesus-prayer.or.kr","PR201007988",37.8510009,126.8290965],["민족화해센터","UJ","경기 파주시 탄현면 성동로 111","031-941-2766","7pu2046.kr","PR201007238",37.7810396,126.6951043],["성 베네딕도회 요셉 수도원","UJ","경기 남양주시 불암산로 105-75","031-527-8115","7benedict.kr","PR201008807",37.6551601,127.1019921],["양주 올리베따노 성 베네딕도 수도원","UJ","경기 양주시 광적면 현석로413번길 202-64","031-877-1986","3monteoliveto","PR201008806",37.8349927,126.9440297],["예수 마음 배움터(피정·교육)","UJ","경기 파주시 한빛로 21","031-946-2337","7jesumaum.org","PR201003958",37.71091,126.7544644],["착한 의견의 성모 피정의 집(개인·소규모 단체 피정)","UJ","경기 연천군 왕징면 왕산로 722","031-834-1262","5osakorea.or.kr","PR201003959",38.069829,126.9593113],["한마음 청소년 수련원","UJ","경기 양주시 버들로 147-142","031-840-0018","5hanmaum84.com/","PR201003960",37.7716729,127.0053289],["도미니코 피정의 집","WJ","강원 횡성군 횡성읍 광학로 605-23","033-343-0201","5dominicoretreat.org/","PR201003956",37.4921817,127.9691373],["성지배론 두메꽃 피정의 집(개인)","WJ","충북 제천시 봉양읍 배론성지5길 43","043-651-7523","","PR201006115",37.1574255,128.0840035],["성필립보생태마을","WJ","강원 평창군 평창읍 평창강로 896-21","033-333-8066","8ecocatholic.co.kr/skin_mw2/","PR201003947",37.3286708,128.3737717],["용소막 성당 피정의집","WJ","강원 원주시 신림면 구학산로 1857","033-763-2343","http://www.wjcatholic.or.kr/shrine/view?ca=%EC%9A%A9%EC%86%8C%EB%A7%89","PR201006117",37.2124263,128.0878671],["은총의 성모 마리아 기도학교","WJ","충북 제천시 봉양읍 배론성지길 296","043-651-4563","7baeron.or.kr","PR201007990",37.1595187,128.0838753],["겟세마니 피정의 집","CC","강원 인제군 남면 빙어마을길 196","033-461-4243","2Gethsemani","PR201003915",37.9987355,128.0970261],["계성 푸른 누리 수련원","CC","경기 가평군 가평읍 가화로 512","031-582-2533","7spcprunnuri.or.kr","PR201003914",37.8574957,127.515572],["까리따스 피정의 집","CC","강원 고성군 토성면 버리깨길 42","033-638-4004","2caritasretreat","PR201003917",38.2301644,128.583931],["다물 피정의 집","CC","강원 인제군 남면 김부대왕로 208","033-461-7819","2injedamul","PR201003918",37.9368685,128.0829188],["라베르나 기도의 집","CC","강원 평창군 용평면 신약수로 80-66","010-6419-2694","2sfmalaverna","PR201006123",37.6570435,128.4982894],["마리아의 전교자 프란치스코회 기도의집","CC","강원 홍천군 남면 물구비길 107","033-432-1097","7fmmkor.org/pages/story/WX/index?entrId=fmmkor&last=Y","PR201006120",37.6104497,127.7853968],["만레사 영성의 집","CC","강원 홍천군 서석면 북바치길 134","010-8025-3132","2manresa","PR201007734",37.6729119,128.1587474],["모곡 피정의 집","CC","강원 홍천군 서면 설밀길 25","033-434-0695","","PR201006119",37.6746344,127.6043107],["봉평 성심못자리","CC","강원 평창군 봉평면 후군동길 231-23","010-8654-8071","8koreamsc.com/bongpyeong/","PR201008341",37.6085015,128.3959861],["선교사의 집(피정의 집)","CC","강원 춘천시 남면 큰성골길 32-155","033-263-1004","","PR201008591",37.768041,127.59443],["예수 마음 보금자리(기도의 집)","CC","강원 홍천군 남면 오지울길 53","033-432-6367","6fdzkorea.org/","PR201003920",37.5920851,127.8632028],["오상영성원 (피정의 집)","CC","강원 양양군 손양면 상촌로 518-224","033-673-0035","2fivewounds","PR201007745",38.0290034,128.6237453],["자비로우신 예수님의 기도의 집","CC","강원 홍천군 남면 물구비길 160","033-432-4121","","PR201007746",37.6128826,127.7880545],["피정의집 작은 샘터","CC","경기 가평군 상면 청군로 235","010-5409-1014","6facebook.com/maristakorea","PR201008798",37.7550521,127.4095729],["대덕구청소년어울림센터","DJ","대전 대덕구 쌍청당로 25","042-626-7728","5dd1318.com/youth","PR201007426",36.364266,127.4341515],["대천해수욕장성당","DJ","충남 보령시 해수욕장3길 57","041-934-7758","7yonaresort.com","PR201007425",36.3043309,126.5206483],["대철회관 (청소년교육원)","DJ","대전 동구 동서대로1678번길 61","042-623-7520","7daecheol.or.kr","PR201003922",36.3461604,127.4369139],["법동청소년문화센터","DJ","대전 대덕구 계족로663번길 36","042-628-1555","5dd1318.com/house","PR201007427",36.3707558,127.4267661],["성거산 기도의 집","DJ","충남 천안시 서북구 성거읍 천흥4길 189-71","041-622-4207","1ofmsg","PR201003923",36.867496,127.2265472],["성모성심의 집 (피정집)","DJ","충남 공주시 신풍면 용수봉갑길 503","010-3469-1750","","PR201008947",36.5150443,126.8975091],["씨튼 영성의 집","DJ","충남 논산시 상월면 상월로 796","041-733-2992","7setoncent.or.kr","PR201003927",36.3293849,127.184026],["예수마음 피정의집 (공세리성당)","DJ","충남 아산시 인주면 공세리성당길 10","041-533-8181","7gongseri.or.kr","PR201003928",36.883406,126.9140749],["예수수도회 교육센터","DJ","대전 중구 대흥로 62","042-254-6530","1cjmw","PR201008318",36.3215321,127.4190586],["정하상교육회관","DJ","세종 전의면 가톨릭대학로 30","044-863-5690","5paulhasang.or.kr/","PR201004381",36.6541981,127.1932825],["합덕성가정순례자의집 (합덕성당)","DJ","충남 당진시 합덕읍 합덕성당2길 16","041-363-1064","","PR201007424",36.7928293,126.7855189],["가톨릭여성교육관","DG","대구 중구 남산로4길 112 교육원 나동 2층","053-254-6115","","PR201003962",35.8598377,128.5878818],["갈평피정의집","DG","경북 포항시 남구 오천읍 기림로 1634","054-292-2354","7handmaids.or.kr/?page_id=3082","PR201003961",35.9073943,129.4020123],["김수환 추기경 사랑과 나눔 공원","DG","대구 군위군 군위읍 군위금성로 270","054-383-1922","5cardinalkim-park.org/exp?menu=one","P2/page/shrine.html?srl=retreat&process=retreat",36.232474,128.599801],["꾸르실료교육관","DG","대구 중구 남산로4길 112","053-253-6984","","PR201003963",35.8598868,128.5878429],["대구광역시 청소년수련원","DG","대구 달서구 앞산순환로 180","053-656-6655","6dgyouth.net/main/index.do","PR201003964",35.8201987,128.5534865],["무학연수원","DG","경북 성주군 금수강산면 성주로 684","054-932-0620","7dcyfmuhak.com","PR201003965",35.9280526,128.106973],["바틀로교육센터","DG","대구 수성구 파동로32길 124","053-783-9817","7happysister.net","PR201006296",35.8226652,128.6138647],["베네딕도 영성관","DG","대구 북구 사수로 363-36","010-7103-3425","7orabsc.com","PR201003967",35.8997218,128.5175338],["성가정 피정의 집","DG","경북 경산시 와촌면 강학길 65","010-8850-9689","","PR201008745",35.954883,128.772183],["성모솔숲마을","DG","경북 청도군 각북면 송내길 166","054-373-3955","7성모솔숲마을.kr","PR201007936",35.7274559,128.5683316],["신나무골 성지","DG","경북 칠곡군 지천면 칠곡대로 2189-22","054-974-3217","7sinnamugol.or.kr/","P2/page/shrine.html?srl=retreat&process=retreat",35.967034,128.462034],["압량대학생센터(AD센터)","DG","경북 경산시 압량읍 대학로 360-1","053-818-5885","4amnyang","PR201008890",35.8403993,128.7599651],["연화리 피정의집","DG","경북 칠곡군 지천면 칠곡대로 2143","054-973-4835","7yeonhwari.or.kr","PR201003971",35.9660702,128.4544695],["오도리 평화자리","DG","경북 포항시 북구 흥해읍 해안로 1766-11","054-275-0610","8m.blog.naver.com/PostList.naver?blogId=odpeace&tab=1","",36.160033,129.398373],["왜관 성 베네딕도 문화영성센터","DG","경북 칠곡군 왜관읍 관문로 61","054-971-0722","7osb.or.kr","PR201003970",35.9887873,128.4015474],["월막피정의집 (대구성령쇄신봉사회관)","DG","경북 고령군 쌍림면 월막길 120","054-954-3091","","PR201003973",35.7151819,128.2300532],["진목정성지","DG","경북 경주시 산내면 수의길 192","054-751-6488","5jinmokjeong.or.kr/p201","P2/page/shrine.html?srl=retreat&process=retreat",35.753215,129.076056],["천부성당 영성센터","DG","경북 울릉군 북면 천부2길 16","010-4097-0090","6soulstay.at/","P2/page/shrine.html?srl=retreat&process=retreat",37.540179,130.87453],["평화 계곡","DG","경북 성주군 초전면 소성길 330","010-9808-3210","","PR201008746",36.0397299,128.239755],["프란치스카눔","DG","대구 달서구 진천로16길 59","070-4266-0047","7facebook.com/Fcanum","PR201008494",35.8163693,128.5265838],["한티 피정의 집","DG","경북 칠곡군 동명면 한티로1길 69","054-975-5151","5hanti.or.kr","PR201003976",36.0167401,128.6302128],["효령하늘집 (개인피정)","DG","대구 군위군 효령면 경북대로 2115-18","054-382-0091","2hyoskyhouse","PR201008747",36.1121028,128.5683317],["농은 수련원","AD","경북 예천군 지보면 지풍로 983-41","054-652-0591","7nongeun.kr","PR201004001",36.5444529,128.4566995],["문경 엠마오 기쁨 피정의집","AD","경북 문경시 문경읍 요성지곡길 266-11","054-571-1091","1cdan705","PR201008263",36.7585456,128.1157195],["문경성요셉치유마을","AD","경북 문경시 가은읍 은성로 796-13","054-572-1121","7ecocatholic.co.kr","PR201008352",36.6340139,128.0635887],["양업 명상 센터(마원, 진안리 성지)","AD","경북 문경시 문경읍 새재로 600","010-9944-0145","","PR201008675",36.7371692,128.0907632],["울진 베네딕도 교육관","AD","경북 울진군 울진읍 연지2길 29-20","010-5348-3431","","PR201007688",37.0012278,129.4071934],["홍유한 피정집(우곡성지)","AD","경북 봉화군 봉성면 시거리길 397","054-673-4152","7ugokseongji.modoo.at","PR201004002",36.9454661,128.829311],["가톨릭 청소년센터(교육관)","CJ","충북 청주시 상당구 중앙로61번길 16","043-220-1700","7cjcyc.or.kr","PR201006944",36.6431552,127.4873962],["꽃동네 사랑의 연수원(피정 및 연수)","CJ","충북 음성군 음성읍 꽃동네길 138","043-879-0400","7kkotlove.or.kr","PR201003989",36.9309875,127.5820199],["꽃동네 사랑의 영성원(피정의 집)","CJ","충북 음성군 음성읍 꽃동네길 201-111","043-879-8500","","PR201003990",36.941364,127.5886681],["보은 메리워드 영성의집(피정의 집)","CJ","충북 보은군 보은읍 교사삼산길 58-13","043-542-6995","7maryward.or.kr/pages/retreat3.php","PR201007157",36.4854016,127.714052],["성령회관","CJ","충북 청주시 청원구 북이면 청암로 461","043-213-9103","","PR201006730",36.7175744,127.5733341],["양업 영성관(피정의 집)","CJ","충북 진천군 백곡면 배티로 663-13","043-533-5710","6baeti.org/","PR201003992",36.9277026,127.3245095],["엠마우스 피정의 집","CJ","충북 청주시 서원구 현도면 시목외천로 404-35","043-260-1638","7preciousblood.or.kr","PR201003993",36.5257287,127.418449],["옥천 메리워드 영신 수련원(피정의 집)","CJ","충북 옥천군 옥천읍 수북1길 9-32","043-733-3228","7maryward.or.kr/pages/retreat2.php","PR201003991",36.3151091,127.6088305],["청주교구 연수원(교육·피정의 집)","CJ","충북 청주시 청원구 공항로22번길 12","043-215-2606","","PR201003994",36.6590728,127.4887045],["가톨릭문화원","MS","경남 창원시 마산합포구 오동북16길 27","055-249-7010","","PR201008988",35.2083087,128.577323],["감물생태학습관","MS","경남 밀양시 단장면 감물1길 19","055-356-0026","7gammul.catb.kr","PR201007250",35.4595916,128.8774189],["고성 성심의 집","MS","경남 고성군 동해면 용정3길 112","055-673-5463","2gomscsisters","PR201003997",35.0225529,128.4877812],["마리아 마을(피정의 집)","MS","경남 고성군 대가면 송계1길 163-43","","7olivetano.com","PR201003996",35.0412648,128.2740328],["마산 가르멜 수도원 피정의 집","MS","경남 창원시 마산합포구 진동면 해양관광로 235","055-271-1708","7carmel.kr","PR201003995",35.1056407,128.504306],["마산가톨릭교육관","MS","경남 창원시 마산합포구 구산면 이순신로 115-758","055-221-1891","7cecom.or.kr","PR201004815",35.0862988,128.6074597],["맑은 하늘 피정의 집","MS","경남 밀양시 단장면 상봉1길 17-13","055-356-4540","","PR201003978",35.4715747,128.8561282],["산청 프란치스코 교육회관","MS","경남 산청군 산청읍 산청대로1381번길 17","055-973-3788","7sungsim1.or.kr","PR201006301",35.3818692,127.9074467],["살레시오 평생교육원 젊음의 집","MS","경남 창원시 의창구 의안로66번길 33","055-255-8295","","PR201003999",35.2677137,128.6274399],["성혈 영성의 집/쉼자리","MS","경남 창원시 마산합포구 구산면 옥계로 11","010-8025-9759","8blog.naver.com/kasc1977","PR201003998",35.1005026,128.5927015],["영성생활의 집","MS","경남 창녕군 장마면 월명길 28-28","055-521-3812","","PR201008686",35.4959952,128.4756199],["의령 성심의 집","MS","경남 의령군 칠곡면 의령대로 780-71","","","PR201008916",35.347568,128.17957],["진동 요셉의 집","MS","경남 창원시 마산합포구 진동면 광암1길 112","055-271-1024","2jin-dong","PR201007941",35.1088316,128.500197],["피정의 집","MS","경남 창원시 마산합포구 구산면 석곡로 378","055-222-3801","7trappistkr.org","PR201004000",35.1128951,128.5779297],["로사리오의 집","BS","부산 기장군 정관읍 예림길 73-13","051-728-3190","","PR201007247",35.3309767,129.2038558],["마리아 피정 센터","BS","부산 남구 장고개로16번길 13","051-634-0228","7sihm.or.kr","PR201003977",35.1264546,129.0727013],["부산 성 분도 은혜의집","BS","부산 수영구 수영로 501","051-753-5744","","PR201003985",35.1508187,129.1108786],["부산 살레시오영성의집","BS","부산 수영구 수영로427번길 60","051-622-2431","3pumsale","PR201003225",35.1454031,129.1064073],["성 분도 명상의 집","BS","부산 금정구 오륜대로 145-16","051-582-4573","7blog.naver.com/bundobusan","PR201003979",35.2497109,129.1060974],["영성의 집","BS","경남 양산시 어실로 695","055-382-9465","7yscath.catb.kr","PR201003982",35.4111241,128.9937514],["오순절 평화의 마을 피정의 집","BS","경남 밀양시 삼랑진읍 삼랑진로 453","055-352-4241","5osunjel.org","PR201003983",35.4017201,128.8139738],["예수 성심 전교 수녀회 (성심 영성 센터)","BS","부산 금정구 금샘로18번길 79-16","051-581-3114","7blog.naver.com/sh_center","PR201007783",35.2313357,129.0781651],["정하상 바오로 영성관","BS","경남 양산시 명곡로 244","055-383-3101","7bspaul.catb.kr","PR201003986",35.3410118,129.0564194],["푸른 나무(청소년 교육관)","BS","부산 수영구 남천서로32번길 21","051-629-8740","7puna.kr","PR201003987",35.1450172,129.1060024],["글라렛 영성의 집","GJ","전남 나주시 남평읍 지석로 252-37","061-331-1213","7retreatcmf.creatorlink.net","PR201004004",35.0299256,126.8525275],["대건센터","GJ","전남 담양군 담양읍 죽향문화로 178","061-381-7004","7johnofgod.or.kr","PR201004883",35.3214357,126.9742483],["명상의 집","GJ","광주 북구 우치로 599","062-571-5004","http//passionists.or.kr/","PR201007815",35.2185332,126.9011212],["사랑과 자비의 집","GJ","전남 장성군 북이면 백양로 33","061-394-8004","","PR201007816",35.427926,126.8094492],["살레시오 영성의 집","GJ","광주 서구 전평길 40","062-373-8712","","PR201004007",35.1180827,126.8490602],["성모승천봉헌자수녀회 피정의 집","GJ","광주 서구 운천로31번길 26","062-371-0172","","PR201007842",35.1360394,126.8554943],["순천 예수회 영성센터","GJ","전남 순천시 낙안면 금산길 189","061-811-2101","7favre.jesuit.kr","PR201004009",34.9336151,127.3668788],["아기사슴성당 교육관","GJ","전남 고흥군 도양읍 소록선창길 55","061-844-0528","","PR201004901",34.518641,127.1331176],["예수의 까리따스 수녀회 교육관","GJ","광주 남구 입하2안길 20-22","062-672-9780","7gj.icaritas.or.kr","PR201004005",35.1067952,126.8720536],["이사벨레떼 영성원","GJ","광주 광산구 삼도송계길 51","062-369-0295","7mercedarias.kr/retreat/isabellete/","PR201007817",35.1092711,126.6787954],["피아골피정집","GJ","전남 구례군 토지면 피아골로 732","061-782-5004","","PR201004010",35.2518337,127.5922063],["한국레지오마리애 기념관","GJ","전남 목포시 노송길 35-2","061-279-4650","","PR201004891",34.7995259,126.385214],["화순 성 베네딕도 피정의 집","GJ","전남 화순군 춘양면 학포로 1385","061-373-3001","7hsosb.or.kr","PR201005912",34.9507902,126.9681748],["흑산 정약전 피정·연수센터","GJ","전남 신안군 흑산면 흑산일주로 180-20","061-375-9998","","PR201008863",34.6836449,125.4307555],["흑산문화관광호텔·피정집","GJ","전남 신안군 흑산면 흑산일주로 180-19","061-246-0090","7흑산비치호텔.kr","PR201008680",34.6846698,125.432231],["전주 치명자산성지 평화의 전당","JJ","전북 전주시 완산구 바람쐬는길 120","063-285-5755","7shalom-house.com/","PR201008565",35.8032068,127.1676653],["천호성지 피정의집","JJ","전북 완주군 비봉면 천호성지길 124","063-263-1004","7cheonhos.org","PR201004014",36.0381167,127.1310071],["토마스 쉼터","JJ","전북 완주군 비봉면 천호성지길 29-7","063-263-1004","","PR201006039",36.0309981,127.1291812],["해월리 윤호요셉의 집","JJ","전북 완주군 소양면 다리안길 77-9","063-244-4101","","PR201009159",35.8889912,127.2576321],["가톨릭 청년머뭄터 ᄒᆞᆫ숨","JE","제주 서귀포시 배낭골로 4","010-3220-1605","","PR201009032",33.2928937,126.5941457],["면형의 집 피정 센터","JE","제주 서귀포시 지장샘로 19","064-762-6009","8blog.naver.com/jejumhuj","PR201004015",33.2661989,126.5593566],["성이시돌 젊음의 집(청소년수련원)","JE","제주 제주시 한림읍 금악동2길 25","064-796-7711","6youthhome.co.kr","PR201004017",33.3434339,126.3251244],["성이시돌 피정의 집","JE","제주 제주시 한림읍 산록남로 53","064-796-4181","6isidore.or.kr/","PR201004016",33.3458535,126.3217584]];

const RETREATS=_unpack(_RT_RAW);
function _getCurrentItems(){return _mode==='shrine'?SHRINES:(_mode==='retreat'?RETREATS:PARISHES);}
function _getModeTypeText(){return _mode==='shrine'?'성지':(_mode==='retreat'?'피정의 집':'성당');}
function _getModeTypeLabel(item){return _mode==='shrine'?item.type:(_mode==='retreat'?'🏔 피정의 집':'⛪ 성당');}
const _RETREAT_DIO_COLORS={'SE':'#c0392b','IC':'#c0392b','SW':'#c0392b','UJ':'#c0392b','CC':'#1565c0','WJ':'#1565c0','DJ':'#c0392b','CJ':'#1565c0','DG':'#1b7a3e','AD':'#1b7a3e','BS':'#1565c0','MS':'#1b7a3e','GJ':'#1b7a3e','JJ':'#1b7a3e','JE':'#1b7a3e','ML':'#c0392b'};
function _getRetreatColor(item){const codeMap={'서울대교구':'SE','인천교구':'IC','수원교구':'SW','의정부교구':'UJ','춘천교구':'CC','원주교구':'WJ','대전교구':'DJ','청주교구':'CJ','대구대교구':'DG','안동교구':'AD','부산교구':'BS','마산교구':'MS','광주대교구':'GJ','전주교구':'JJ','제주교구':'JE','군종교구':'ML'};const code=codeMap[item.diocese]||'SE';return _RETREAT_DIO_COLORS[code]||'#c0392b';}
function _getModeMarkerColor(item){return _mode==='shrine'?(TC[item.type]||'#555'):(_mode==='retreat'?_getRetreatColor(item):'#8b5e3c');}
function _getRouteGuideTarget(){return _mode==='shrine'?'성지':(_mode==='retreat'?'피정의 집':'성당');}

// ─── API 키: config.js 에서 로드 ─────────────────────────────────────
// config.js 가 없거나 키가 비어있으면 콘솔에 경고가 표시됩니다.
// 배포 전 Kakao Developers 콘솔에서 플랫폼 > 웹 도메인을 반드시 등록하세요.
const REST  = (window.APP_CONFIG && window.APP_CONFIG.KAKAO_REST_KEY) || '';
const JSKEY = (window.APP_CONFIG && window.APP_CONFIG.KAKAO_JS_KEY)  || '';
(function(){
  if(!REST || !JSKEY){
    console.warn(
      '[가톨릭길동무] config.js 가 로드되지 않았거나 API 키가 비어 있습니다.\n' +
      '  config.sample.js 를 복사해 config.js 를 만들고 키를 입력하세요.'
    );
  }
})();
const TC    = {'성지':'#c0392b','순례지':'#1565c0','순교 사적지':'#1b7a3e'};
const _DIOS=[['all','전체'],['서울대교구','서울'],['인천교구','인천'],['수원교구','수원'],['의정부교구','의정부'],['춘천교구','춘천'],['원주교구','원주'],['대전교구','대전'],['청주교구','청주'],['대구대교구','대구'],['안동교구','안동'],['부산교구','부산'],['마산교구','마산'],['광주대교구','광주'],['전주교구','전주'],['제주교구','제주']];

const _SU='https://www.cbck.or.kr/Catholic/Shrine/Read?seq=';
// SHRINES hp 필드 URL 디코딩
SHRINES.forEach(s=>{
  if(s.hp&&_URL_T[s.hp.slice(0,2)]) s.hp=_URL_T[s.hp.slice(0,2)]+s.hp.slice(2);
  else if(s.hp&&_URL_T[s.hp[0]]) s.hp=_URL_T[s.hp[0]]+s.hp.slice(1);
});
const _NAV='https://apis-navi.kakaomobility.com/v1/directions';
const _AH={headers:{Authorization:'KakaoAK '+REST}};
const _ACH={headers:{Authorization:'KakaoAK '+REST,'Content-Type':'application/json'}};

/* ── Mobility API 동시 호출 제한 + 결과 캐시 ──────────────────────
   - 동시 최대 5개 fetch (카카오 무료 쿼터 보호)
   - 동일 origin→destination 결과는 세션 동안 재사용
   ─────────────────────────────────────────────────────────────── */
const _navCache = new Map();
const _NAV_CONCURRENCY = 5;
let _navActive = 0;
const _navQueue = [];

function _navFetch(origin, dest) {
  const key = `${origin}→${dest}`;
  if (_navCache.has(key)) return Promise.resolve(_navCache.get(key));
  return new Promise((resolve) => {
    function run() {
      _navActive++;
      fetch(`${_NAV}?origin=${origin}&destination=${dest}&priority=RECOMMEND`, _AH)
        .then(r => r.json())
        .then(data => {
          const route = data.routes?.[0];
          const val = (route && route.result_code === 0)
            ? { km: route.summary.distance / 1000, dur: route.summary.duration }
            : null;
          if (val) _navCache.set(key, val);
          resolve(val);
        })
        .catch(() => resolve(null))
        .finally(() => {
          _navActive--;
          if (_navQueue.length) _navQueue.shift()();
        });
    }
    if (_navActive < _NAV_CONCURRENCY) run();
    else _navQueue.push(run);
  });
}
const $=id=>document.getElementById(id);
const $$=s=>document.querySelectorAll(s);
const _GEO=navigator.geolocation;
const _GO1={enableHighAccuracy:true,timeout:10000};
const _GO2={enableHighAccuracy:false,timeout:3000,maximumAge:300000};
const _EC=encodeURIComponent;
const _NS='xmlns="http://www.w3.org/2000/svg"';
const _svgUrl=s=>'data:image/svg+xml;charset=utf-8,'+_EC(s);
const _isMob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const _TY={'A':'성지','B':'순례지','C':'순교 사적지'};
SHRINES.forEach(s=>{if(_DIO[s.diocese])s.diocese=_DIO[s.diocese];if(_TY[s.type])s.type=_TY[s.type];});
// ─── 앱 전역 상태 객체 ──────────────────────────────────────────────────────
// 이전에 window 곳곳에 흩어져 있던 수십 개의 전역 변수를 하나의 객체로 통합합니다.
// 기존 코드와의 호환성을 유지하기 위해 아래 "레거시 프록시" 블록에서
// 각 변수를 AppState의 프로퍼티와 연결합니다.
const AppState = {
  // ── 지도 인스턴스 및 마커 ──
  map:              null,   // Kakao 지도 인스턴스
  markers:          [],     // 성지/성당 마커 배열
  retreatMarkers:   [],     // 피정의 집 마커 배열
  myMkr:            null,   // 내 위치 마커
  myLat:            null,   // 내 위치 위도
  myLng:            null,   // 내 위치 경도
  jukrimgulParkMkr: null,   // 죽림굴 주차장 마커
  startTmpMkr:      null,   // 출발지 임시 마커
  endTmpMkr:        null,   // 도착지 임시 마커
  paSelMkr:         null,   // parish/retreat 선택 마커
  selIdx:           -1,     // 현재 선택된 shrine 마커 인덱스
  polyline:         null,   // 경로 폴리라인

  // ── 화면/모드 ──
  mode:       'shrine',  // 'shrine' | 'parish' | 'retreat'
  screen:     'cover',   // 'cover' | 'map'
  activeTab:  null,      // 현재 열린 탭 이름

  // ── 필터/검색 ──
  filterDio:  'all',     // 교구 필터
  listSrch:   '',        // 목록 검색어

  // ── 지역 검색 ──
  regionLat:       null,
  regionLng:       null,
  regionName:      '',
  regionPlaceName: '',
  regionCache:     [],   // 지역검색 결과 캐시

  // ── 내주변 ──
  nearbyCache: [],       // 내주변 결과 캐시
  nearbyParishMarkers: [], // 성당 첫 진입/내주변 10곳 전용 마커

  // ── 길찾기 ──
  routeMode:        false,
  rS:               null,  // 출발지 {lat, lng, name, idx}
  rE:               null,  // 도착지
  routeRegionStart: null,  // 지역검색에서 길찾기 시작 시 출발지 보존

  // ── 검색 모달 ──
  smRole: 'start',
  smDio:  'all',

  // ── 인포카드 ──
  curInfoItem:   null,   // 현재 열린 인포카드 아이템
  curFromRegion: false,  // 인포카드가 지역검색에서 열렸는지

  // ── 기타 플래그 ──
  kakaoLaunching: false,
  mapInited:      false,
  dp:             null,  // PWA install prompt (BeforeInstallPromptEvent)

  // ── 종료 확인 ──
  exitReady: false,
  exitTimer: null,

  // ── 성당/교구 지도 ──
  dioMkrs:            {},   // code → [Marker, ...]
  dioOverlays:        {},   // code → CustomOverlay
  activeDio:          null, // 현재 마커 펼쳐진 교구 코드
  parishSysInited:    false,
  parishIdleListener: null, // 뷰포트 필터링용 idle 이벤트 리스너
  parishDioUserZoomTouched: false, // 사용자가 성당 교구 지도에서 직접 확대/축소했는지
  parishDioProgrammaticMoveUntil: 0, // 앱이 조정한 줌 변경을 사용자 조작으로 오인하지 않기 위한 보호 시간

  // ── 검색 디바운스 ──
  smPlaceDebounce: null,
  smTab: 'cat',  // 'cat' | 'place'
};

// ─── 레거시 호환 프록시 ──────────────────────────────────────────────────────
// 기존 함수들이 `_map`, `_mode` 등 변수명을 직접 참조하므로,
// AppState 프로퍼티와 동기화되는 getter/setter를 window에 정의합니다.
// 이 블록 하나만 수정하면 이름 변경이 전파됩니다.
(function installStateProxy() {
  const map = [
    ['_map',              'map'],
    ['_markers',          'markers'],
    ['_retreatMarkers',   'retreatMarkers'],
    ['_myMkr',            'myMkr'],
    ['_myLat',            'myLat'],
    ['_myLng',            'myLng'],
    ['_jukrimgulParkMkr', 'jukrimgulParkMkr'],
    ['_startTmpMkr',      'startTmpMkr'],
    ['_endTmpMkr',        'endTmpMkr'],
    ['_paSelMkr',         'paSelMkr'],
    ['_selIdx',           'selIdx'],
    ['_polyline',         'polyline'],
    ['_mode',             'mode'],
    ['_screen',           'screen'],
    ['_activeTab',        'activeTab'],
    ['_filterDio',        'filterDio'],
    ['_listSrch',         'listSrch'],
    ['_regionLat',        'regionLat'],
    ['_regionLng',        'regionLng'],
    ['_regionName',       'regionName'],
    ['_regionPlaceName',  'regionPlaceName'],
    ['_regionCache',      'regionCache'],
    ['_nearbyCache',      'nearbyCache'],
    ['_routeMode',        'routeMode'],
    ['_rS',               'rS'],
    ['_rE',               'rE'],
    ['_routeRegionStart', 'routeRegionStart'],
    ['_smRole',           'smRole'],
    ['_smDio',            'smDio'],
    ['_curInfoItem',      'curInfoItem'],
    ['_curFromRegion',    'curFromRegion'],
    ['_kakaoLaunching',   'kakaoLaunching'],
    ['_mapInited',        'mapInited'],
    ['_dp',               'dp'],
    ['_exitReady',        'exitReady'],
    ['_exitTimer',        'exitTimer'],
    ['_dioMkrs',             'dioMkrs'],
    ['_dioOverlays',         'dioOverlays'],
    ['_activeDio',           'activeDio'],
    ['_parishSysInited',     'parishSysInited'],
    ['_parishIdleListener',  'parishIdleListener'],
    ['_parishDioUserZoomTouched', 'parishDioUserZoomTouched'],
    ['_parishDioProgrammaticMoveUntil', 'parishDioProgrammaticMoveUntil'],
    ['_smPlaceDebounce',  'smPlaceDebounce'],
    ['_smTab',            'smTab'],
  ];
  map.forEach(function([legacyName, stateKey]) {
    Object.defineProperty(window, legacyName, {
      get: function() { return AppState[stateKey]; },
      set: function(v) { AppState[stateKey] = v; },
      configurable: true,
      enumerable: false,
    });
  });
})();

// ─── 상수: 죽림굴 ────────────────────────────────────────────────────────────
const JUKRIMGUL_IDX = (() => { try{ return SHRINES.findIndex(s=>s.name==='죽림굴'); }catch(e){return -1;} })();
const JUKRIMGUL_PARKING = {lat:35.550726, lng:129.014589, name:'죽림굴주차장', kw:'죽림굴주차장'};
(function(){
  if(!window.visualViewport) return;
  let _kbOpen=false;
  window.visualViewport.addEventListener('resize',()=>{
  const ratio = window.visualViewport.height / window.innerHeight;
  const isKb = ratio < 0.75;
  if(isKb===_kbOpen) return;
  _kbOpen=isKb;
  if(isKb){
   document.documentElement.classList.add('kb-open');
  } else {
   document.documentElement.classList.remove('kb-open');
  }
  });
})();
(function(){
  function measureSA(){
  const b=document.createElement('div');
  b.style.cssText='position:fixed;bottom:0;left:0;width:1px;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;';
  document.body.appendChild(b);
  const sb=b.offsetHeight||0;
  document.body.removeChild(b);
  if(sb>0) document.documentElement.style.setProperty('--sb',sb+'px');
  }
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',measureSA):measureSA();
  window.addEventListener('resize',measureSA);
})();
(function(){
  const c=$('cv-stars');
  if(!c) return;
  for(let i=0;i<22;i++){
  const s=document.createElement('span');
  s.className='cv-star';
  const sz=Math.random()*4+2;
  s.style.cssText=`width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;animation-delay:${(Math.random()*3).toFixed(1)}s;animation-duration:${(2+Math.random()*3).toFixed(1)}s;`;
  c.appendChild(s);
  }
})();
(function(){
  if(window.navigator.standalone===true||window.matchMedia('(display-mode:standalone)').matches) return;
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)){
  return;
  }
  window.addEventListener('beforeinstallprompt',e=>{
  e.preventDefault();
  _dp=e;
  const w=$('cv-install-wrap');
  if(w) w.style.display='block';
  });
  window.addEventListener('appinstalled',()=>{
  _dp=null;
  const w=$('cv-install-wrap');
  if(w) w.style.display='none';
  });
})();

function triggerPwaInstall(){
  if(_dp){ _dp.prompt(); _dp.userChoice.then(()=>{_dp=null;}); }
}
(function(){
  // history 초기화는 principle-back-controller-20260424 에서 단독 관리
  window._appExiting = false;
  window._historyEnterMap = function(){};
})();


function _showBackToast(){
  if(_exitReady){
    _exitReady=false;
    clearTimeout(_exitTimer);
    doExit();
    return true; // 두 번째 뒤로가기: popstate 트랩을 다시 심지 않도록 알림
  }
  _exitReady=true;
  const old=$('_bt');
  if(old) old.remove();
  const t=document.createElement('div');
  t.id='_bt';
  t.textContent='한 번 더 누르면 앱을 종료합니다';
  t.style.cssText='position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+32px);left:50%;transform:translateX(-50%);background:rgba(14,21,53,.92);color:#fff;padding:10px 22px;border-radius:22px;font-size:13px;font-weight:600;z-index:99999;white-space:nowrap;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.3);';
  document.body.appendChild(t);
  _exitTimer=setTimeout(()=>{_exitReady=false;if(t.parentNode)t.remove();},2500);
  return false; // 첫 번째 뒤로가기: 토스트만 표시
}

function attemptAppExit(){
  window._appExiting = true;
  // 토스트 즉시 제거
  const bt=$('_bt'); if(bt) bt.remove();
  try{ sessionStorage.removeItem('catholic_core_return_v1'); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ sessionStorage.removeItem('catholic_integrated_return_v2'); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ sessionStorage.removeItem('oai_force_cover_after_reload'); }catch(e){ console.warn("[가톨릭길동무]", e); }

  // Cordova/WebView 계열에서는 네이티브 종료를 우선 시도한다.
  try{ if(navigator.app && typeof navigator.app.exitApp === 'function'){ navigator.app.exitApp(); return; } }catch(e){ console.warn("[가톨릭길동무]", e); }

  // 중요: 여기서 history.back()을 호출하면 외부사이트 방문 기록으로 되돌아갈 수 있다.
  // 따라서 종료 시도는 window.close까지만 하고, 히스토리 트랩은 다시 심지 않는다.
  try{ window.open('', '_self'); window.close(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ document.documentElement.classList.add('app-exiting'); }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function closeExitDlg(){
  _exitReady=false;
  clearTimeout(_exitTimer);
  const bt=$('_bt'); if(bt) bt.remove();
  $('exit-dlg').classList.remove('open');
}
function doExit(){
  closeExitDlg();
  attemptAppExit();
}


function oaiEnterView(el){
  if(!el) return;
  try{
    var root=document.documentElement;
    if(root.classList.contains('oai-returning')) return;
    el.classList.remove('oai-enter-ready','oai-enter-show');
    el.classList.add('oai-enter-ready');
    requestAnimationFrame(function(){
      el.classList.add('oai-enter-show');
      setTimeout(function(){
        try{ el.classList.remove('oai-enter-ready','oai-enter-show'); }catch(e){ console.warn("[가톨릭길동무]", e); }
      }, 280);
    });
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}


function oaiShowCategoryEntryVeil(mode){
  try{
    var veil=document.getElementById('oai-category-entry-veil');
    if(!veil) return;
    veil.className = mode || 'shrine';
    document.documentElement.classList.add('oai-category-entering');
    clearTimeout(window.__oaiCategoryVeilTimer);
    window.__oaiCategoryVeilTimer=setTimeout(oaiHideCategoryEntryVeil, 700);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function oaiHideCategoryEntryVeil(){
  try{
    clearTimeout(window.__oaiCategoryVeilTimer);
    var root=document.documentElement;
    var veil=document.getElementById('oai-category-entry-veil');
    if(veil){ veil.style.opacity='0'; }
    setTimeout(function(){
      try{
        root.classList.remove('oai-category-entering');
        if(veil){ veil.style.opacity=''; veil.className=''; }
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    }, 230);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function startApp(mode){
  _mode=mode;
  _filterDio='all';
  _listSrch='';
  window._noAutoNearby = false;  // 직접 진입 시 nearby 열기 허용
  _regionLat=null; _regionLng=null; _regionCache=[];
  _regionName=''; _regionPlaceName='';
  _nearbyCache=[];
  _curFromRegion=false;
  _curInfoItem=null;
  closeAllTabs();
  closeInfoCard();
  resetRoute();
  const _ls=$('list-srch-inp'); if(_ls) _ls.value='';
  const _lsx=$('list-srch-x'); if(_lsx) _lsx.style.display='none';
  $$('.filter-btn').forEach((b,i)=>b.classList.toggle('active',i===0));
  $$('.sm-fb').forEach((b,i)=>b.classList.toggle('on',i===0));

 if(!$('list-filter-bar').children.length){
  const fb=$('list-filter-bar'),sm=$('sm-filter-bar');
  _DIOS.forEach(([v,l],i)=>{
   fb.innerHTML+=`<button class="filter-btn${i?'':' active'}" onclick="setDioFilter('${v}',this)">${l}</button>`;
   sm.innerHTML+=`<button class="sm-fb${i?'':' on'}" onclick="setSmDio('${v}',this)">${l}</button>`;
  });
 }  _screen='map';
  try{ if(window._historyEnterMap) window._historyEnterMap(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  $('cover').style.display='none';
  document.documentElement.classList.add('app-active');
  document.documentElement.classList.toggle('parish-mode',mode==='parish');
  document.documentElement.classList.toggle('retreat-mode',mode==='retreat');
  if(mode==='shrine' || mode==='parish' || mode==='retreat'){
    try{ oaiShowCategoryEntryVeil(mode); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  if(typeof oaiEnterView==='function') oaiEnterView(document.getElementById('app'));
  const _setTxt=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  const listLbl = mode==='parish' ? '성당찾기' : (mode==='retreat' ? '피정의집 찾기' : '성지찾기');
  _setTxt('tab-nearby-lbl', '내주변');
  _setTxt('tab-list-lbl', listLbl);
  $('legend').style.display = mode==='shrine'?'block':'none';

  // 표지→카테고리 진입 시 항상 지도 완전 리셋 (마커 잔류 방지)
  _resetMapState();
  _mapInited=true;
  // RAF로 지연: UI가 먼저 업데이트된 후 무거운 지도 로딩 시작 → 버벅거림 방지
  requestAnimationFrame(function(){ setTimeout(_loadMap, 0); });
}

function _resetMapState(){
  // 지도 인스턴스 제거
  if(_map){ try{_map=null;}catch(e){ console.warn("[가톨릭길동무]", e); } }
  // 마커 배열 초기화
  _markers=[];
  _retreatMarkers=[];
  _dioMkrs={};
  _dioOverlays={};
  _activeDio=null;
  _parishSysInited=false;
  _parishDioUserZoomTouched=false;
  _parishDioProgrammaticMoveUntil=0;
  try{ if(AppState) AppState.nearbyParishDioCode=null; }catch(e){ console.warn('[가톨릭길동무]',e); }
  if(_parishIdleListener){ try{kakao.maps.event.removeListener(_parishIdleListener);}catch(e){ console.warn('[가톨릭길동무]',e); } _parishIdleListener=null; }
  _paSelMkr=null;
  try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); }
  _myMkr=null;
  _myLat=null; _myLng=null;
  // 지도 DOM 초기화
  const mapEl=$('map');
  if(mapEl) mapEl.innerHTML='';
  _mapInited=false;
}
function goToCover(){
  closeTab(_activeTab);
  closeInfoCard();
  resetRoute();
  // 모든 마커 지도에서 제거
  _markers.forEach(m=>{if(m)try{m.marker.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }});
  _retreatMarkers.forEach(o=>{try{o.marker.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }});
  Object.values(_dioMkrs).forEach(arr=>arr.forEach(mk=>{try{mk.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }}));
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _paSelMkr=null;}
  try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); }
  if(_myMkr){try{_myMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _myMkr=null;}
  _screen='cover';
  document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
  const _coverEl=$('cover');
  if(_coverEl){
    _coverEl.style.display='';
    _coverEl.style.opacity='';
    _coverEl.style.pointerEvents='';
    _coverEl.scrollTop=0;
  }
}

function _loadMap(){
  const wrap=$('map');
  wrap.innerHTML='<div class="map-loading"><div class="map-loading-icon">✝</div><div class="map-loading-txt">지도를 불러오는 중...</div></div>';
  // kakao SDK가 이미 로드된 경우 바로 초기화 (카테고리 재진입 시)
  if(window.kakao&&window.kakao.maps){
    try{kakao.maps.load(_onMapReady);}catch(e){_mapError(e.message);}
    return;
  }
  const sc=document.createElement('script');
  sc.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JSKEY}&autoload=false`;
  const timer=setTimeout(()=>_mapError('카카오내비 로딩 시간 초과'),20000);
  sc.onload=()=>{clearTimeout(timer);try{kakao.maps.load(_onMapReady);}catch(e){_mapError(e.message);}};
  sc.onerror=()=>{clearTimeout(timer);_mapError(`도메인 등록 필요: ${location.hostname}`);};
  document.head.appendChild(sc);
}

function _mapError(msg){
  const m=$('map');
  m.innerHTML=`<div class="map-loading"><div style="font-size:40px;margin-bottom:16px">🗺️</div><div style="font-size:15px;font-weight:700;color:var(--gold);margin-bottom:12px">지도를 불러올 수 없습니다</div><div style="font-size:12px;color:rgba(255,255,255,.7);line-height:1.8;max-width:280px;word-break:keep-all">${msg}</div></div>`;
  _markers=new Array(SHRINES.length).fill(null);
  renderList();
  openTab('nearby');
  if(typeof oaiHideCategoryEntryVeil==='function') setTimeout(oaiHideCategoryEntryVeil, 260);
}

function _onMapReady(){
 const KM=kakao.maps;window._LL=KM.LatLng;window._MM=KM.Marker;window._MI=KM.MarkerImage;window._SZ=KM.Size;window._PT=KM.Point;window._LB=KM.LatLngBounds;window._PL=KM.Polyline;window._EL=KM.event.addListener;
  _map=new kakao.maps.Map($('map'),{
  center:new _LL(36.2,127.9),level:8
  });
  // 지도 확대/축소 버튼은 map-wrap 안의 커스텀 컨트롤로 사용한다.
  // 카테고리 종료 X와 겹치지 않도록 기본 카카오 줌 컨트롤은 추가하지 않는다.
  kakao.maps.event.addListener(_map,'click',()=>{
  closeInfoCard();
  document.activeElement?.blur();
  });
  // 성지 모드일 때만 성지 마커 빌드 (parish/retreat에서는 절대 빌드 안 함)
  if(_mode==='shrine'){
    _buildShrineMarkers();
  } else {
    // 성지 마커 배열은 비워둠 (잔류 방지)
    _markers=new Array(SHRINES.length).fill(null);
  }
  renderList();
  _autoLocate();
  if(_mode==='parish') { _buildParishDioSystem(); }
  else if(_mode==='retreat') _buildRetreatMarkers();
  // _noAutoNearby 플래그: 복귀 시 내주변 탭 자동 열기 방지
  if(!window._noAutoNearby) openTab('nearby');
  window._noAutoNearby = false;
  if(typeof oaiHideCategoryEntryVeil==='function') setTimeout(oaiHideCategoryEntryVeil, 260);
}

function _modeTargetLabel(){
  return _mode==='parish'?'성당':(_mode==='retreat'?'피정의 집':'성지');
}
function _updateSheetPanelTitles(){
  const noun=_modeTargetLabel();
  const near=$('nearby-sheet-title');
  const list=$('list-sheet-title');
  const region=$('region-sheet-title');
  if(near) near.textContent='내 주변 '+noun+' 10곳';
  if(list) list.textContent=noun+' 찾기';
  if(region) region.textContent='지역검색';
}
function closeSheetPanelOnly(name){
  if(!name) return;
  _blurAll && _blurAll();
  _closeSheetOnly(name);
  if(_activeTab===name) _activeTab=null;
  _updateTabBtns(null);
}

function closeRouteSheetByX(){
  _blurAll && _blurAll();
  try{ resetRoute(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  _routeMode=false;
  _closeSheetOnly('route');
  if(_activeTab==='route') _activeTab=null;
  _updateTabBtns(null);
  try{ _exitRouteMode(); }catch(e){ console.warn('[가톨릭길동무]', e); }
}

function closeCategoryToCoverFromMap(){
  _blurAll && _blurAll();
  if(typeof goToCover === 'function') goToCover();
}

function zoomCategoryMap(delta){
  if(!_map || typeof _map.getLevel !== 'function' || typeof _map.setLevel !== 'function') return;
  try{
    const cur = _map.getLevel();
    const next = Math.max(1, Math.min(14, cur + delta));
    if(next !== cur) _map.setLevel(next);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}


function openTab(name){
  if(_activeTab===name) return;
  _updateSheetPanelTitles();
  const prevName = _activeTab;
  const dir = window._swipeDir || null;

  // ── 기존 탭 퇴장 (스와이프 방향 반대로 빠짐) ──
  if(prevName && dir){
    const prevSheet = $('sheet-'+prevName);
    if(prevSheet && prevSheet.classList.contains('open')){
      // 새 탭이 오른쪽에서 → 기존 탭은 왼쪽으로 / 왼쪽에서 → 기존 탭은 오른쪽으로
      prevSheet.classList.add(dir === 'right' ? 'exit-left' : 'exit-right');
      setTimeout(()=>{
        prevSheet.style.transition = 'none'; // 아래로 내려가는 버그 방지
        prevSheet.classList.remove('open','exit-left','exit-right');
        void prevSheet.offsetHeight; // reflow
        prevSheet.style.transition = '';
      }, 280);
    } else {
      _closeSheetOnly(prevName);
    }
  } else {
    _closeSheetOnly(prevName);
  }

  // 새 시트(내주변/찾기/지역검색/길찾기)를 열 때는 기존 인포카드를 먼저 정리한다.
  // 단순 z-index 보정이 아니라 상태 전환 순서에서 겹침을 없애며, 지도 중심은 흔들리지 않게 유지한다.
  closeInfoCard({keepMap:true});
  _curFromRegion=false;
  if(name!=='route') resetRoute();
  _exitRouteMode();
  if(!(_mode==='parish' && name==='nearby')) _restoreMapMarkers();
  else { try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); } }
  _resetTabWork(name);
  _activeTab=name;

  // ── 새 탭 진입 (스와이프 방향에서 들어옴) ──
  const sheet=$('sheet-'+name);
  if(sheet && dir){
    sheet.classList.add('from-'+dir);
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        sheet.classList.remove('from-right','from-left');
        sheet.classList.add('open');
      });
    });
  } else {
    if(sheet){ sheet.style.display=''; sheet.classList.add('open'); }
  }

  _updateTabBtns(name);
  if(name==='nearby')     _loadNearby();
  else if(name==='list')  renderList();
  else if(name==='region'){ /* 사용자가 직접 탭할 때만 포커스 */ }
  else if(name==='route') _enterRouteMode();
  setTimeout(()=>_scrollSheetTop(name), 30);
}

function closeTab(name){
  if(!name) return;
  // 길찾기 탭: 경로 삭제 후 도착 노랑마커와 인포카드 복원
  let _routeDest = null;
  let _routeRegionStartKeep = null;
  if(name === 'route' && _rE && _rE.lat){
    _routeDest = Object.assign({}, _rE);
    if(_routeRegionStart && _routeRegionStart.lat) _routeRegionStartKeep = Object.assign({}, _routeRegionStart);
  }
  _closeSheetOnly(name);
  if(_activeTab===name) _activeTab=null;
  _updateTabBtns(null);
  if(name==='route'){
    try{ resetRoute(); }catch(e){ console.warn("[가톨릭길동무]", e); }
    _routeMode=false;
    if(_routeDest){
      const items = _getCurrentItems();
      const idx = (typeof _routeDest.idx==='number' && _routeDest.idx>=0)
        ? _routeDest.idx
        : items.findIndex(p=>Number(p.lat)===Number(_routeDest.lat) && Number(p.lng)===Number(_routeDest.lng));
      if(idx>=0){
        const item=items[idx];
        if(item) setTimeout(()=>{
          try{
            if(_mode==='shrine') _selectShrineMarker(idx);
            else if(_mode==='parish') _selectParishMarker(item);
            else _selectRetreatMarker(item);
            if(_routeRegionStartKeep && _routeRegionStartKeep.lat){
              _routeRegionStart = Object.assign({}, _routeRegionStartKeep);
              _regionLat = _routeRegionStartKeep.lat;
              _regionLng = _routeRegionStartKeep.lng;
              _regionPlaceName = _routeRegionStartKeep.placeName || _routeRegionStartKeep.name || _regionPlaceName;
              _regionName = _routeRegionStartKeep.placeName || _routeRegionStartKeep.name || _regionName;
              _curFromRegion = true;
            }
            _showInfoCard(item,idx);
            _focusMarkerAboveInfoCard(item);
          }catch(e){ console.warn("[가톨릭길동무]", e); }
        }, 90);
      }
    }
  } else {
    _restoreMapMarkers();
  }
}

function _closeSheetOnly(name){
  if(!name) return;
  $('sheet-'+name)?.classList.remove('open');
}

function closeAllTabs(){
  ['nearby','list','region','route'].forEach(n=>_closeSheetOnly(n));
  _activeTab=null;
  _updateTabBtns(null);
}

function _scrollSheetTop(name){
  const sheet=$('sheet-'+name);
  if(sheet) sheet.scrollTop=0;
  const body = name==='nearby' ? $('nearby-body') : name==='list' ? $('list-body') : name==='region' ? $('region-body') : name==='route' ? $('sheet-route') : null;
  if(body) body.scrollTop=0;
}

function _resetTabWork(name){
  document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
  if(name!=='route'){
    _listSrch='';
    const lsi=$('list-srch-inp'); if(lsi) lsi.value='';
    const lsx=$('list-srch-x'); if(lsx) lsx.style.display='none';
    _filterDio='all';
    $$('.filter-btn').forEach((b,i)=>b.classList.toggle('active', i===0 || b.textContent.trim()==='전체'));
    _regionLat=null;_regionLng=null;_regionCache=[];
    _routeRegionStart=null;
    const ri=$('region-inp'); if(ri) ri.value='';
    const rb=$('region-body');
    if(rb) rb.innerHTML='<div class="empty-msg">🏞 여행지나 숙박 지역을 검색하면<br>근처 성지/성당 목록이 나타납니다</div>';
  }
  _scrollSheetTop(name);
}

function toggleTab(name){
  if(_activeTab===name){
    // 같은 탭을 다시 눌러 목록을 다시 올릴 때도 인포카드는 남기지 않는다.
    closeInfoCard({keepMap:true});
    _resetTabWork(name);
    if(name==='nearby') _loadNearby();
    else if(name==='list') renderList();
    else if(name==='region'){
      _regionLat=null;_regionLng=null;_regionCache=[];
      const ri=$('region-inp'); if(ri) ri.value='';
      const rb=$('region-body');
      if(rb) rb.innerHTML='<div class="empty-msg">🏞 여행지나 숙박 지역을 검색하면<br>근처 성지/성당 목록이 나타납니다</div>';
    }
    else if(name==='route'){ resetRoute({fresh:true}); _enterRouteMode(); }
    setTimeout(()=>_scrollSheetTop(name),30);
    return;
  }
  if(name==='route') resetRoute({fresh:true});
  openTab(name);
}

function _updateTabBtns(active){
  let activeBtn = null;
  $$('.tab-btn').forEach(b=>{
    const on = b.dataset.tab===active;
    b.classList.toggle('active', on);
    if(on) activeBtn = b;
  });
  if(activeBtn){
    try{ activeBtn.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'}); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}

function _getInfoCardCenterTargetY(mapH){
  // V20-19: 성지·성당·피정 지도 중심은 항상 인포카드가 올라왔을 때의 기준으로 통일한다.
  // 실제 인포카드가 아직 없거나 목록 시트만 떠 있어도 같은 시각 중심을 사용해 덜컹거림을 줄인다.
  return Math.round((mapH || 700) * 0.34);
}
function _setMapCenterByInfoCardStandard(pos){
  if(!_map || !pos) return false;
  try{
    const mapEl = $('map-wrap') || $('map');
    const mapH = (mapEl && (mapEl.clientHeight || mapEl.offsetHeight)) || window.innerHeight || 700;
    const proj = _map.getProjection && _map.getProjection();
    if(proj && proj.containerPointFromCoords && proj.coordsFromContainerPoint){
      const p = proj.containerPointFromCoords(pos);
      const centerY = Math.round(mapH / 2);
      const targetY = _getInfoCardCenterTargetY(mapH);
      const point = (window.kakao && kakao.maps && kakao.maps.Point)
        ? new kakao.maps.Point(p.x, p.y + (centerY - targetY))
        : {x:p.x, y:p.y + (centerY - targetY)};
      const newCenter = proj.coordsFromContainerPoint(point);
      if(newCenter){ _map.setCenter(newCenter); return true; }
    }
    _map.setCenter(pos);
    return true;
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  return false;
}
function _biasCurrentMapCenterToInfoCardStandard(){
  if(!_map || typeof _map.getCenter!=='function') return false;
  try{ return _setMapCenterByInfoCardStandard(_map.getCenter()); }
  catch(e){ console.warn("[가톨릭길동무]", e); }
  return false;
}
function _setBoundsByInfoCardStandard(bounds, top, right, bottom, left){
  if(!_map || !bounds) return false;
  try{
    _map.setBounds(bounds, top, right, bottom, left);
    _biasCurrentMapCenterToInfoCardStandard();
    return true;
  }catch(e1){
    try{
      _map.setBounds(bounds);
      _biasCurrentMapCenterToInfoCardStandard();
      return true;
    }catch(e2){ console.warn("[가톨릭길동무]", e2); }
  }
  return false;
}
function _focusMarkerAboveInfoCard(item){
  if(!_map || !item || !item.lat || !item.lng) return;
  try{
    if(_mode==='parish' && !_routeMode){
      if(typeof _focusParishPointAround==='function' && _focusParishPointAround(item.lat,item.lng,{level:6,aboveInfoCard:true})) return;
    }
    _setMapCenterByInfoCardStandard(new _LL(item.lat,item.lng));
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function selectItem(idx, opts={}){
  const items = _getCurrentItems();
  const item  = items[idx];
  if(!item) return;
  const fromSearchList = !!(_listSrch && _listSrch.trim());
  _curFromRegion = !!(opts.fromRegion && _regionLat);
  closeAllTabs();
  if(_mode==='shrine'){
  if(opts.fromRegion || fromSearchList){
   _restoreAllCategoryMarkersForSelection();
  } else if(opts.fromNearby && _nearbyCache.length>0){
   _showItemsOnMap(_nearbyCache);
  } else {
   _restoreMapMarkers();
  }
  _selectShrineMarker(idx);
  } else if(_mode==='parish') {
  _selectParishMarker(item);
  } else {
  if(opts.fromRegion || fromSearchList) _restoreAllCategoryMarkersForSelection();
  _selectRetreatMarker(item);
  }
  _showInfoCard(item, idx);
  _focusMarkerAboveInfoCard(item);
}

function _fitInfoCardButtons(){
  try{
    const btns=document.querySelectorAll('#info-card .ic-link-btn,#info-card .ic-route-btn,#info-card .ic-tel-btn,#info-card .btn-kakao-nav');
    btns.forEach(btn=>{
      btn.style.fontSize='16px';
      btn.style.letterSpacing='-.04em';
      btn.style.whiteSpace='nowrap';
      let size=16;
      while(size>11 && btn.scrollWidth>btn.clientWidth){
        size-=0.5;
        btn.style.fontSize=size+'px';
      }
    });
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function _showInfoCard(item, idx){
  _curInfoItem = {item, idx};

  $('ic-name').textContent = item.name;
  $('ic-sub').textContent  = item.diocese;
  $('ic-type').textContent = _mode==='shrine' ? item.type : (_mode==='retreat' ? '피정의 집' : '성당');
  $('ic-addr').textContent = item.addr;
  let noteEl=$('ic-note');
  if(!noteEl){
  noteEl=document.createElement('div');
  noteEl.id='ic-note';
  noteEl.style.cssText='margin:6px 14px 0;padding:8px 10px;background:#fff8e1;border-left:3px solid #f39c12;border-radius:6px;font-size:12px;color:#7a4f00;line-height:1.55;display:none;';
  $('ic-addr').closest('.ic-addr-row').insertAdjacentElement('afterend', noteEl);
  }
  if(item.note){noteEl.textContent=item.note;noteEl.style.display='block';}
  else noteEl.style.display='none';
  const telBtn=$('ic-tel-link');
  const routeBtn=document.querySelector('.ic-route-btn');
  if(item.tel){
  $('ic-tel').textContent=item.tel;
  telBtn.href='tel:'+item.tel.replace(/[^0-9+]/g,'');
  _show(telBtn);
  } else {
  _hide(telBtn);
  }
  const distCol=$('ic-dist-col');
  const distEl=$('ic-dist');
  distCol.classList.remove('ready');
  distEl.textContent='—';           // 미리 공간 확보(레이아웃 고정)
  if(_myLat && item.lat){
  const _snap=item;
  (async()=>{
   try{
    const res=await fetch(
     `https://apis-navi.kakaomobility.com/v1/directions?origin=${_myLng},${_myLat}&destination=${_snap.lng},${_snap.lat}&priority=RECOMMEND`,
     _AH);
    if(!res.ok) throw new Error('fail');
    const data=await res.json();
    const route=data.routes?.[0];
    if(route&&route.result_code===0){
     const km=(route.summary.distance/1000).toFixed(1);
     if(_curInfoItem&&_curInfoItem.item===_snap){
      distEl.textContent=km+' km';
      distCol.classList.add('ready');
     }
    }
   }catch(e){ console.warn("[가톨릭길동무]", e); }
  })();
  }
  const hp=$('ic-hp');
  if(item.hp){
    hp.href=normalizeCatholicExternalUrl(item.hp);
    hp.removeAttribute('onclick');
    hp.onclick = null;
    hp.target = '_self';
    _show(hp);
  }
  else _hide(hp);
  const guide=$('ic-guide');
  if(_mode==='shrine'){
    if(item.seq){ guide.onclick=()=>openCoreExternalUrl(_SU+item.seq,{infoIdx:idx}); guide.textContent='✝ 성지 상세페이지'; _show(guide);}
    else _hide(guide);
  } else {
    if(item.url){ guide.onclick=()=>openCoreExternalUrl(item.url,{infoIdx:idx}); guide.textContent=(_mode==='retreat'?'🏔 피정의 집 상세페이지':'⛪ 성당 상세페이지'); _show(guide);}
    else _hide(guide);
  }
  const linksRow=$('ic-links-row');
  if(linksRow) (item.hp||(item.seq&&_mode==='shrine')||item.url)?_show(linksRow):_hide(linksRow);

  $('info-card').classList.add('open');
  setTimeout(_fitInfoCardButtons, 0);
  setTimeout(_fitInfoCardButtons, 80);
}

function closeInfoCard(opts){
  opts = opts || {};
  const wasItem = _curInfoItem; // 닫기 전에 저장
  const card = $('info-card');
  if(card) card.classList.remove('open');
  _curInfoItem=null;
  _curFromRegion=false;
  if(_mode==='shrine') _clearShrineMarkerSel();
  else {
    if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }  _paSelMkr=null;}
  }
  // V20-19: 시트 전환으로 닫을 때는 지도 중심을 다시 움직이지 않는다.
  // 사용자가 X/지도 터치로 인포카드만 닫을 때는 기존 V20-19 기준 중심을 유지한다.
  if(!opts.keepMap && wasItem && wasItem.item && wasItem.item.lat && _map){
    try{ _focusMarkerAboveInfoCard(wasItem.item); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}

function openInAppRoute(){
  if(!_curInfoItem) return;
  const {item, idx}=_curInfoItem;
  if(!item.lat||!item.lng) return;

  function doRoute(spLat, spLng, spName){
  closeInfoCard();
  openTab('route');
  _rS={idx:-1, name:spName, lat:spLat, lng:spLng};
  _rE={idx, name:item.name, lat:item.lat, lng:item.lng};
  _setRouteLabel('start', spName);
  _setRouteLabel('end', item.name);
  if(_mode==='shrine'){
   if(idx>=0&&_markers[idx]){ _markers[idx].marker.setImage(_mkrImgRoute('#0000ff','도')); _setRouteMarkerZ(idx,'end'); }
   if(_rS.idx>=0&&_markers[_rS.idx]){ _markers[_rS.idx].marker.setImage(_mkrImgRoute('#ff0000','출')); _setRouteMarkerZ(_rS.idx,'start'); }
  }
  _refreshRouteTmpMarkers();
  _enterRouteMode();
  _calcRoute();
  }
  if(_curFromRegion && _regionLat){
  const placeName = _regionPlaceName || _regionName || '검색지';
  const name=`📍 ${placeName}`;
  _routeRegionStart={lat:_regionLat,lng:_regionLng,name:name,placeName:placeName};
  doRoute(_regionLat, _regionLng, name);
  return;
  }
  _routeRegionStart=null;
  if(_myLat){
  doRoute(_myLat, _myLng, '📍 현위치');
  } else {
  _GEO.getCurrentPosition(
   p=>{ _setMyLoc(p.coords.latitude, p.coords.longitude); doRoute(p.coords.latitude, p.coords.longitude, '📍 현위치'); },
   ()=>alert('위치를 가져올 수 없습니다.'),
   {enableHighAccuracy:true, timeout:10000}
  );
  }
}

function openKakaoNav(){
  if(!_curInfoItem) return;
  const {item,idx}=_curInfoItem;
  const isJuk = _mode==='shrine' && idx === JUKRIMGUL_IDX && JUKRIMGUL_IDX >= 0;
  const navItem = isJuk ? {...item, lat:JUKRIMGUL_PARKING.lat, lng:JUKRIMGUL_PARKING.lng, kw:JUKRIMGUL_PARKING.kw, name:JUKRIMGUL_PARKING.name} : item;
  const ep=_EC(navItem.kw||navItem.name);
  function launch(spLat,spLng){
  const w=spLat?`https://map.kakao.com/link/from/${_EC('현재위치')},${spLat},${spLng}/to/${ep},${navItem.lat},${navItem.lng}`:
         `https://map.kakao.com/link/to/${ep},${navItem.lat},${navItem.lng}`;
  const a=spLat?`kakaomap://route?sp=${spLat},${spLng}&ep=${navItem.lat},${navItem.lng}&by=CAR`:
         `kakaomap://route?ep=${navItem.lat},${navItem.lng}&by=CAR`;
  _kakaoLaunch(w,a);
  }
  if(_myLat) launch(_myLat,_myLng);
  else if(_GEO){
  _GEO.getCurrentPosition(p=>launch(p.coords.latitude,p.coords.longitude),
   ()=>launch(null,null),{enableHighAccuracy:true,timeout:8000,maximumAge:60000});
  } else launch(null,null);
}

function _mkrImgRetreat(color,big){
  const w=big?40:28,h=big?52:36;
  const svg=big?
  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C8.954 0 0 8.954 0 20c0 14.21 20 32 20 32S40 34.21 40 20C40 8.954 31.046 0 20 0z" fill="${color}"/><circle cx="20" cy="20" r="9" fill="white" opacity="0.95"/><text x="20" y="25" text-anchor="middle" font-size="14" fill="${color}" font-family="serif" font-weight="bold">✦</text></svg>`:
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.941 14 22 14 22S28 23.941 28 14C28 6.268 21.732 0 14 0z" fill="${color}" opacity="0.9"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/><text x="14" y="18" text-anchor="middle" font-size="10" fill="${color}" font-family="serif" font-weight="bold">✦</text></svg>`;
  return new _MI(_svgUrl(svg),new _SZ(w,h),{offset:new _PT(w/2,h)});
}
function _mkrImg(color,big){
  const w=big?40:28,h=big?52:36;
  const svg=big?
  `<svg ${_NS} width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C8.954 0 0 8.954 0 20c0 14.21 20 32 20 32S40 34.21 40 20C40 8.954 31.046 0 20 0z" fill="${color}"/><circle cx="20" cy="20" r="9" fill="white" opacity="0.95"/><text x="20" y="25" text-anchor="middle" font-size="13" fill="${color}" font-family="serif" font-weight="bold">✝</text></svg>`:
  `<svg ${_NS} width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.941 14 22 14 22S28 23.941 28 14C28 6.268 21.732 0 14 0z" fill="${color}" opacity="0.9"/><circle cx="14" cy="14" r="6" fill="white" opacity="0.9"/><text x="14" y="18" text-anchor="middle" font-size="9" fill="${color}" font-family="serif" font-weight="bold">✝</text></svg>`;
  return new _MI(_svgUrl(svg),new _SZ(w,h),{offset:new _PT(w/2,h)});
}

function _mkrImgRoute(color,label){
  // 출=빨간색, 도=녹색 (무조건 고정)
  const c=label==='출' ? '#FF0000' : (label==='도' ? '#005BFF' : (color||'#005BFF'));
  const svg=`<svg ${_NS} width='36' height='46' viewBox='0 0 36 46'><ellipse cx='18' cy='43' rx='8' ry='3' fill='rgba(0,0,0,0.25)'/><path d='M18 2C9 2 2 9 2 18C2 28 18 42 18 42C18 42 34 28 34 18C34 9 27 2 18 2Z' fill='${c}' stroke='white' stroke-width='2.5'/><circle cx='18' cy='18' r='10' fill='white' opacity='0.9'/><text x='18' y='23' font-size='13' font-weight='900' fill='${c}' text-anchor='middle' font-family='Arial,sans-serif'>${label}</text></svg>`;
  return new _MI(_svgUrl(svg),new _SZ(36,46),{offset:new _PT(18,44)});
}


function _setRouteMarkerZ(idx, role){
  try{
    if(idx>=0 && _markers && _markers[idx] && _markers[idx].marker){
      _markers[idx].marker.setZIndex(role==='start'?340:330);
    }
    if(idx>=0 && _retreatMarkers){
      const r=_retreatMarkers.find(o=>o && o.index===idx);
      if(r && r.marker) r.marker.setZIndex(role==='start'?340:330);
    }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function _clearRouteTmpMarkers(){
  if(_startTmpMkr){ _startTmpMkr.setMap(null); _startTmpMkr=null; }
  if(_endTmpMkr){ _endTmpMkr.setMap(null); _endTmpMkr=null; }
}
function _routeEndMarkerColor(){
  if(_mode==='shrine' && _rE && _rE.idx>=0 && _markers[_rE.idx] && _markers[_rE.idx].shrine){
    return _typeColor(_markers[_rE.idx].shrine.type);
  }
  return '#0000ff';
}
function _refreshRouteTmpMarkers(){
  if(!_map) return;
  _clearRouteTmpMarkers();
  const needStart = !!(_rS && (_mode!=='shrine' || _rS.idx<0 || !_markers[_rS.idx]));
  const needEnd = !!(_rE && (_mode!=='shrine' || _rE.idx<0 || !_markers[_rE.idx]));
  if(needStart){
    _startTmpMkr = new _MM({
      position:new _LL(_rS.lat,_rS.lng),
      image:_mkrImgRoute('#ff0000','출'),
      zIndex:340
    });
    _startTmpMkr.setMap(_map);
  }
  if(needEnd){
    _endTmpMkr = new _MM({
      position:new _LL(_rE.lat,_rE.lng),
      image:_mkrImgRoute(_routeEndMarkerColor(),'도'),
      zIndex:320
    });
    _endTmpMkr.setMap(_map);
  }
}

function _typeColor(t){return t==='성지'?'#c0392b':t==='순례지'?'#1565c0':'#1b7a3e';}

function _buildShrineMarkers(){
  _markers=new Array(SHRINES.length).fill(null);
  const BATCH=30;
  let idx=0;
  function next(){
  const end=Math.min(idx+BATCH,SHRINES.length);
  for(let i=idx;i<end;i++){
   const s=SHRINES[i];
   if(!s.lat||!s.lng||s.lat<33||s.lat>38||s.lng<124||s.lng>132) continue;
   const mk=new _MM({
    position:new _LL(s.lat,s.lng),
    image:_mkrImg(_typeColor(s.type),false),title:s.name
   });
   mk.setMap(_map);
   (function(index){
    kakao.maps.event.addListener(mk,'click',()=>{
     if(_routeMode) _selectRouteItem(index);
     else selectItem(index);
    });
   })(i);
   _markers[i]={marker:mk,shrine:s,index:i};
  }
  idx=end;
  if(idx<SHRINES.length) requestAnimationFrame(next);
  }
  requestAnimationFrame(next);
}

function _clearShrineMarkers(){
  _markers.forEach(m=>{if(m)m.marker.setMap(null);});
}

function _restoreMapMarkers(){
  if(_mode==='parish'){
    try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); }
    /* 성당 카테고리는 내주변 기준 교구만 유지한다.
       내주변 목록을 뒤로가기로 닫아도 전국 교구 라벨 화면으로 되돌리지 않는다. */
    const keepCode = (AppState && AppState.nearbyParishDioCode) || _activeDio || null;
    document.querySelectorAll('.dio-label').forEach(e=>{e.style.transform='';e.style.display='none';});
    _hideDioOverlays();
    if(keepCode){
      if(_activeDio && _activeDio!==keepCode){
        try{ _hideParishDioMkrs(_activeDio); }catch(e){ console.warn('[가톨릭길동무]',e); }
      }
      _activeDio=keepCode;
      _showParishDioMkrs(keepCode);
      return;
    }
    try{ _showCurrentParishDioIfIdle(); }catch(e){ console.warn('[가톨릭길동무]',e); }
    return;
  }
  if(_mode==='retreat'){
    _restoreRetreatMarkers();
    return;
  }
  _markers.forEach(m=>{
  if(!m) return;
  const s=m.shrine;
  const ok=(_filterDio==='all'||s.diocese===_filterDio)&&
      (!_listSrch||s.name.includes(_listSrch)||s.diocese.includes(_listSrch)||s.addr.includes(_listSrch));
  m.marker.setMap(ok?_map:null);
  });
}

function _restoreAllCategoryMarkersForSelection(){
  if(!_map) return;
  if(_mode==='shrine'){
    _markers.forEach(m=>{
      if(!m||!m.marker) return;
      try{
        m.marker.setMap(_map);
        m.marker.setImage(_mkrImg(_typeColor(m.shrine.type),false));
        m.marker.setZIndex(1);
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    });
    _selIdx=-1;
    return;
  }
  if(_mode==='retreat'){
    if(!_retreatMarkers.length) _buildRetreatMarkers();
    _retreatMarkers.forEach(o=>{
      if(!o||!o.marker) return;
      try{
        o.marker.setMap(_map);
        o.marker.setImage(_mkrImgRetreat('#2e7d32',false));
        o.marker.setZIndex(45);
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    });
    if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _paSelMkr=null;}
  }
}

function _selectShrineMarker(idx){
  if(_selIdx>=0&&_markers[_selIdx]){
  _markers[_selIdx].marker.setImage(_mkrImg(_typeColor(_markers[_selIdx].shrine.type),false));
  _markers[_selIdx].marker.setZIndex(1);
  }
  if(idx>=0&&_markers[idx]){
  _markers[idx].marker.setImage(_mkrImg('#FFE500',true));
  _markers[idx].marker.setZIndex(10);
  }
  _selIdx=idx;
}

function _clearShrineMarkerSel(){
  if(_selIdx>=0&&_markers[_selIdx]){
  _markers[_selIdx].marker.setImage(_mkrImg(_typeColor(_markers[_selIdx].shrine.type),false));
  _markers[_selIdx].marker.setZIndex(1);
  }
  _selIdx=-1;
}


function _clearParishNearbyMarkers(){
  try{
    const arr=(AppState && AppState.nearbyParishMarkers) || [];
    arr.forEach(function(mk){ try{ mk.setMap(null); }catch(e){ console.warn('[가톨릭길동무]',e); } });
    if(AppState) AppState.nearbyParishMarkers=[];
  }catch(e){ console.warn('[가톨릭길동무]',e); }
}

function _fitParishNearbyBounds(items, lat, lng){
  if(_mode!=='parish' || !_map || !Array.isArray(items) || !items.length || typeof _LB==='undefined' || typeof _LL==='undefined') return false;
  try{
    const bounds=new _LB();
    let count=0;
    if(lat && lng){ bounds.extend(new _LL(lat,lng)); count++; }
    items.forEach(function(p){
      if(!p || !p.lat || !p.lng || p.lat===0 || p.lng===0) return;
      bounds.extend(new _LL(p.lat,p.lng));
      count++;
    });
    if(count>1){
      _markParishDioProgrammaticMove(1500);
      if(typeof _setBoundsByInfoCardStandard==='function') return _setBoundsByInfoCardStandard(bounds, 84, 54, 142, 54);
      _map.setBounds(bounds, 84, 54, 142, 54);
      return true;
    }
    const anchor=items.find(function(p){ return p && p.lat && p.lng && p.lat!==0 && p.lng!==0; });
    if(anchor) return _focusParishPointAround(anchor.lat,anchor.lng,{level:6});
  }catch(e){ console.warn('[가톨릭길동무]',e); }
  return false;
}

function _showParishNearbyMarkersOnMap(items, lat, lng, phase){
  if(_mode!=='parish' || !_map || !Array.isArray(items) || !items.length || typeof _LL==='undefined') return;
  try{
    /* V20-19
       성당 카테고리 첫 진입/내주변 목록에서는 지도에 10개 주변 마커만 올리지 않는다.
       목록은 지금처럼 현재 위치 주변 10곳을 보여주고, 지도에는 그 주변 성당 중
       가장 가까운 성당이 속한 교구의 성당 마커 전체를 표시한다.
       이렇게 하면 "내 주변 목록"은 빠른 선택용, 지도는 해당 교구 전체 탐색용으로 역할이 분리된다. */
    const anchor = items.find(function(p){ return p && p.lat && p.lng && p.lat!==0 && p.lng!==0; });
    const code = anchor ? _parishDioCodeOf(anchor) : '';
    if(!code){
      _clearParishNearbyMarkers();
      return;
    }

    // 예전 주변 10곳 전용 마커가 남아 있으면 먼저 정리한다.
    _clearParishNearbyMarkers();

    // 다른 교구 마커가 열려 있던 상태라면 먼저 닫는다.
    if(_activeDio && _activeDio!==code){
      try{ _hideParishDioMkrs(_activeDio); }catch(e){ console.warn('[가톨릭길동무]',e); }
    }

    // 교구명 라벨은 내주변 목록 아래에서 시야를 복잡하게 만들 수 있어 숨기고,
    // 지도에는 해당 교구의 성당 마커 전체만 표시한다.
    _hideDioOverlays();
    if(_paSelMkr){ try{ _paSelMkr.setMap(null); }catch(e){ console.warn('[가톨릭길동무]',e); } _paSelMkr=null; }
    _activeDio = code;
    _showParishDioMkrs(code);

    // 마커는 해당 교구 전체를 표시하고, 줌/중심은 내 주변 10곳 기준으로 맞춘다.
    // final 거리 재계산 때 같은 교구면 다시 맞추지 않아 덜컹거림을 줄인다.
    const lastCode = AppState ? AppState.nearbyParishDioCode : null;
    if(lastCode!==code || phase==='est'){
      if(AppState) AppState.nearbyParishDioCode = code;
      _fitParishNearbyBounds(items, lat, lng);
    }
  }catch(e){ console.warn('[가톨릭길동무]',e); }
}

function _showItemsOnMap(items){
  _markers.forEach(m=>{if(m)m.marker.setMap(null);});
  const bounds=new _LB();
  items.forEach(s=>{
  const i=SHRINES.indexOf(s);
  if(i>=0&&_markers[i]){
   _markers[i].marker.setMap(_map);
   if(s.lat&&s.lng) bounds.extend(new _LL(s.lat,s.lng));
  }
  });
  if(typeof _setBoundsByInfoCardStandard==='function'){
    _setBoundsByInfoCardStandard(bounds,60,60,60,60);
  }else{
    try{_map.setBounds(bounds,60,60,60,60);}catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}

function _showAllShrinesOnMapWithNearbyBounds(items, lat, lng){
  if(_mode!=='shrine' || !_map) return;
  try{
    _clearShrineMarkerSel();
    // 성지 내주변 화면은 목록은 가까운 10곳만 보여 주되, 지도에는 전체 성지 마커를 유지한다.
    // 줌/중심만 내주변 10곳 기준으로 맞춰서 처음 화면이 너무 넓어지지 않게 한다.
    _markers.forEach(function(m){
      if(!m || !m.marker || !m.shrine) return;
      const s=m.shrine;
      const valid=s.lat&&s.lng&&s.lat>=33&&s.lat<=38&&s.lng>=124&&s.lng<=132;
      m.marker.setMap(valid?_map:null);
      if(valid){
        m.marker.setImage(_mkrImg(_typeColor(s.type),false));
        m.marker.setZIndex(1);
      }
    });

    if(!Array.isArray(items) || !items.length || typeof _LB==='undefined' || typeof _LL==='undefined') return;
    const bounds=new _LB();
    let count=0;
    if(lat && lng){ bounds.extend(new _LL(lat,lng)); count++; }
    items.forEach(function(s){
      if(!s || !s.lat || !s.lng) return;
      bounds.extend(new _LL(s.lat,s.lng));
      count++;
    });
    if(count>1){
      if(typeof _setBoundsByInfoCardStandard==='function') _setBoundsByInfoCardStandard(bounds,60,60,142,60);
      else _map.setBounds(bounds,60,60,142,60);
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _selectParishMarker(p){
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }  _paSelMkr=null;}
  if(!_map||!p.lat||!p.lng) return null;
  // 해당 성당이 속한 교구 마커 활성화
  const dioCode=_parishDioCodeOf(p);
  if(dioCode && _parishSysInited){
    if(_activeDio && _activeDio!==dioCode) _hideParishDioMkrs(_activeDio);
    _activeDio=dioCode;
    _showParishDioMkrs(dioCode);
    document.querySelectorAll('.dio-label').forEach(e=>{e.style.transform='';e.style.display='';});
    const clickedEl=_dioOverlays[dioCode]?.getContent?.();
    if(clickedEl){clickedEl.style.display='none';}
    // 성당 선택의 노란 마커는 교구 전체 bounds로 축소하지 않고, 선택 지점 주변만 보이도록 한다.
    // 실제 중심/확대는 인포카드 표시 후 _focusMarkerAboveInfoCard()에서 한 번만 처리한다.
  }else if(dioCode){
    _ensureParishMarkerZoom();
  }
  _paSelMkr=new _MM({position:new _LL(p.lat,p.lng),image:_mkrImg('#FFE500',true),zIndex:200});
  _paSelMkr.setMap(_map);
  return dioCode;
}

// ── 교구 라벨·마커 시스템 ─────────────────────────────────────────
const _DIO_CFG={
  'SE':{n:'서울대교구',lat:37.565,lng:126.988,c:'#C0392B'},
  'IC':{n:'인천교구',  lat:37.478,lng:126.626,c:'#2471A3'},
  'SW':{n:'수원교구',  lat:37.180,lng:127.018,c:'#7D3C98'},
  'UJ':{n:'의정부교구',lat:37.740,lng:127.058,c:'#CA6F1E'},
  'CC':{n:'춘천교구',  lat:37.875,lng:127.720,c:'#117A65'},
  'WJ':{n:'원주교구',  lat:37.340,lng:127.960,c:'#1E8449'},
  'DJ':{n:'대전교구',  lat:36.352,lng:127.378,c:'#B03A2E'},
  'CJ':{n:'청주교구',  lat:36.630,lng:127.490,c:'#4A235A'},
  'DG':{n:'대구대교구',lat:35.870,lng:128.585,c:'#1A5276'},
  'AD':{n:'안동교구',  lat:36.570,lng:128.725,c:'#9A7D0A'},
  'BS':{n:'부산교구',  lat:35.155,lng:129.065,c:'#6E2F1A'},
  'MS':{n:'마산교구',  lat:35.225,lng:128.580,c:'#6C3483'},
  'GJ':{n:'광주대교구',lat:35.158,lng:126.895,c:'#1A5276'},
  'JJ':{n:'전주교구',  lat:35.820,lng:127.145,c:'#1D6A39'},
  'JE':{n:'제주교구',  lat:33.490,lng:126.530,c:'#B7950B'},

};

const _PARISH_DIO_CODE_MAP={'서울대교구':'SE','인천교구':'IC','수원교구':'SW','의정부교구':'UJ',
  '춘천교구':'CC','원주교구':'WJ','대전교구':'DJ','청주교구':'CJ','대구대교구':'DG',
  '안동교구':'AD','부산교구':'BS','마산교구':'MS','광주대교구':'GJ','전주교구':'JJ',
  '제주교구':'JE','군종교구':'ML'};
function _parishDioCodeOf(p){
  return p && p.diocese ? (_PARISH_DIO_CODE_MAP[p.diocese] || null) : null;
}

// 교구별 성당 목록 (코드 기준 분류)
const _PA_BY_DIO = (function(){
  const m={};
  PARISHES.forEach(p=>{
    const code=_parishDioCodeOf(p)||'ETC';
    (m[code]||(m[code]=[])).push(p);
  });
  return m;
})();

// _dioOverlays, _dioMkrs, _activeDio, _parishSysInited → AppState (위 통합 참고)

function _dioLabelSize(lvl){
  if(lvl<=4) return 18; if(lvl===5) return 16;
  if(lvl===6) return 15; if(lvl===7) return 14;
  if(lvl===8) return 13; return 12;
}

function _markParishDioProgrammaticMove(ms){
  try{
    _parishDioProgrammaticMoveUntil=(Date.now?Date.now():new Date().getTime())+(ms||1400);
  }catch(e){ console.warn('[가톨릭길동무]',e); }
}

function _parishDioCenter(code){
  if(!_map||typeof _LL==='undefined') return null;
  const parishes=_PA_BY_DIO[code]||[];
  let minLat=Infinity,maxLat=-Infinity,minLng=Infinity,maxLng=-Infinity,count=0;
  parishes.forEach(function(p){
    if(!p||!p.lat||!p.lng||p.lat===0||p.lng===0) return;
    minLat=Math.min(minLat,p.lat); maxLat=Math.max(maxLat,p.lat);
    minLng=Math.min(minLng,p.lng); maxLng=Math.max(maxLng,p.lng);
    count++;
  });
  if(count>0) return new _LL((minLat+maxLat)/2,(minLng+maxLng)/2);
  const cfg=_DIO_CFG[code];
  return cfg ? new _LL(cfg.lat,cfg.lng) : null;
}

function _centerParishDioWithoutZoom(code){
  if(_mode!=='parish'||!_map) return false;
  const center=_parishDioCenter(code);
  if(!center) return false;
  try{
    if(typeof _map.panTo==='function') _map.panTo(center);
    else _map.setCenter(center);
    return true;
  }catch(e){ console.warn('[가톨릭길동무]',e); }
  return false;
}

function _focusParishPointAround(lat, lng, opts){
  opts=opts||{};
  if(_mode!=='parish'||!_map||!lat||!lng||typeof _LL==='undefined') return false;
  const targetLevel = opts.level || 6;
  const pos = new _LL(lat,lng);
  try{
    if(typeof _map.getLevel==='function' && typeof _map.setLevel==='function'){
      const lvl = _map.getLevel();
      // 현재 위치/노란 마커 기준 이동은 교구 전체 bounds로 축소하지 않는다.
      // 화면이 멀리 빠져 있을 때만 주변이 보이도록 확대하고, 이미 더 확대된 상태는 유지한다.
      if(lvl > targetLevel){
        _markParishDioProgrammaticMove(1300);
        _map.setLevel(targetLevel);
      }
    }
    // V20-19: 현재 위치/내 주변/선택 성당 모두 인포카드 기준 중심으로 통일한다.
    if(typeof _setMapCenterByInfoCardStandard==='function'){
      return _setMapCenterByInfoCardStandard(pos);
    }
    _map.setCenter(pos);
    return true;
  }catch(e){ console.warn('[가톨릭길동무]',e); }
  return false;
}

function _buildParishDioSystem(){
  if(_parishSysInited) return;
  _parishSysInited=true;
  const lvl=_map.getLevel();
  Object.entries(_DIO_CFG).forEach(([code,cfg])=>{
    const el=document.createElement('div');
    el.className='dio-label';
    el.dataset.code=code;
    const fs=_dioLabelSize(lvl);
    el.style.cssText=`cursor:pointer;background:rgba(255,255,255,0.92);color:${cfg.c};`+
      `font-size:${fs}px;font-weight:800;padding:4px 9px;border-radius:20px;`+
      `border:2px solid ${cfg.c};white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.18);`+
      `letter-spacing:-.3px;transition:transform .15s;user-select:none;`;
    el.textContent=cfg.n;
    el.addEventListener('click',function(e){
      e.stopPropagation();
      _toggleParishDio(code);
    });
    const ov=new kakao.maps.CustomOverlay({
      position:new _LL(cfg.lat,cfg.lng),
      content:el,
      xAnchor:0.5,yAnchor:0.5,
      zIndex:100
    });
    _dioOverlays[code]=ov;
    // 성당 기본/내주변 화면에서는 전국 교구 라벨을 띄우지 않는다.
    ov.setMap(null);
  });
  // 줌 변경 시 폰트 크기 반응형 업데이트
  kakao.maps.event.addListener(_map,'zoom_changed',function(){
    const lvl2=_map.getLevel();
    const fs2=_dioLabelSize(lvl2);
    document.querySelectorAll('.dio-label').forEach(el2=>{
      el2.style.fontSize=fs2+'px';
    });
    try{
      const now=Date.now?Date.now():new Date().getTime();
      if(_mode==='parish' && now>_parishDioProgrammaticMoveUntil){
        _parishDioUserZoomTouched=true;
      }
    }catch(e){ console.warn('[가톨릭길동무]',e); }
  });
}

function _showDioOverlays(){
  Object.values(_dioOverlays).forEach(ov=>{ try{ov.setMap(_map);}catch(e){ console.warn("[가톨릭길동무]", e); } });
}
function _hideDioOverlays(){
  Object.values(_dioOverlays).forEach(ov=>{ try{ov.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } });
}

function _toggleParishDio(code){
  if(_activeDio===code){
    _hideParishDioMkrs(code);_activeDio=null;
    const el=_dioOverlays[code]?.getContent?.();
    if(el){el.style.transform='';el.style.display='';}
    return;
  }
  if(_activeDio){_hideParishDioMkrs(_activeDio);const pe=_dioOverlays[_activeDio]?.getContent?.();if(pe){pe.style.transform='';pe.style.display='';}}
  document.querySelectorAll('.dio-label').forEach(e=>{e.style.transform='';e.style.display='';});
  _activeDio=code;
  const clickedEl=_dioOverlays[code]?.getContent?.();
  if(clickedEl){clickedEl.style.display='none';}
  _showParishDioMkrs(code);
  _focusParishDio(code,{fromLabel:true});
}

function _focusParishDio(code, opts){
  opts=opts||{};
  // 성당 카테고리의 교구명 클릭은 처음에는 교구 전체 보기로 맞추고,
  // 사용자가 직접 확대/축소한 뒤에는 현재 줌을 유지한 채 교구 중심만 이동한다.
  if(opts.fromLabel && _parishDioUserZoomTouched){
    if(_centerParishDioWithoutZoom(code)) return;
  }
  _fitParishDioBounds(code,{reason:'dio-click'});
}

function _fitParishDioBounds(code, opts){
  opts=opts||{};
  if(_mode!=='parish'||!_map||typeof _LB==='undefined'||typeof _LL==='undefined') return false;
  const parishes=_PA_BY_DIO[code]||[];
  let bounds=null, count=0, only=null;
  try{
    parishes.forEach(function(p){
      if(!p||!p.lat||!p.lng||p.lat===0||p.lng===0) return;
      only=p;
      const pos=new _LL(p.lat,p.lng);
      if(!bounds) bounds=new _LB();
      bounds.extend(pos);
      count++;
    });
    if(count>1 && bounds){
      /* 성당 카테고리의 교구 선택/성당 선택은 해당 교구 성당 전체 범위를 기준으로 맞춘다.
         한 성당의 노란 마커 중심 이동이 bounds를 다시 빼앗지 않도록 이 함수로 기준을 통일한다. */
      _markParishDioProgrammaticMove(1700);
      if(typeof _setBoundsByInfoCardStandard==='function'){
        _setBoundsByInfoCardStandard(bounds, 86, 64, 126, 64);
      }else{
        try{ _map.setBounds(bounds, 86, 64, 126, 64); }
        catch(e1){ _map.setBounds(bounds); }
      }
      setTimeout(function(){
        try{
          if(_mode==='parish' && _activeDio===code && typeof _map.getLevel==='function' && typeof _map.setLevel==='function'){
            var lvl=_map.getLevel();
            // 너무 가까이 확대되어 일부 성당만 보이는 경우만 한 단계 안전하게 물러난다.
            if(lvl<8){ _markParishDioProgrammaticMove(1200); _map.setLevel(8); }
          }
        }catch(e2){ console.warn('[가톨릭길동무]',e2); }
      }, opts.delay || 90);
      return true;
    }
    if(count===1 && only){
      if(typeof _map.setLevel==='function'){ _markParishDioProgrammaticMove(1200); _map.setLevel(8); }
      if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(only.lat,only.lng));
      else _map.setCenter(new _LL(only.lat,only.lng));
      return true;
    }
    const cfg=_DIO_CFG[code];
    if(cfg){
      if(typeof _map.setLevel==='function'){ _markParishDioProgrammaticMove(1200); _map.setLevel(8); }
      if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(cfg.lat,cfg.lng));
      else _map.setCenter(new _LL(cfg.lat,cfg.lng));
      return true;
    }
  }catch(e){ console.warn('[가톨릭길동무]',e); }
  return false;
}

function _ensureParishMarkerZoom(){
  if(_mode!=='parish'||!_map||typeof _map.getLevel!=='function'||typeof _map.setLevel!=='function') return;
  try{
    if(_map.getLevel()>6){ _markParishDioProgrammaticMove(1200); _map.setLevel(6); }
  }catch(e){ console.warn('[가톨릭길동무]',e); }
}
function _showParishDioMkrs(code){
  // 교구를 선택했을 때는 해당 교구 성당 마커가 반드시 보이도록 한다.
  // 지도 줌/중심은 _focusParishDio()의 교구 전체 bounds를 우선한다.
  // 여기서 줌을 강제로 당기면 넓은 교구의 일부 마커만 보일 수 있으므로 건드리지 않는다.
  // ── 마커 객체 최초 1회 생성 (setMap 없이) ──
  if(!_dioMkrs[code]){
    const cfg=_DIO_CFG[code]||{c:'#555'};
    const parishes=_PA_BY_DIO[code]||[];
    _dioMkrs[code]=[];
    parishes.forEach(p=>{
      if(!p.lat||!p.lng||p.lat===0||p.lng===0) return;
      const mk=new _MM({
        position:new _LL(p.lat,p.lng),
        image:_mkrImg(cfg.c,false),
        title:p.name,
        zIndex:50
      });
      kakao.maps.event.addListener(mk,'click',function(){
        const idx=PARISHES.indexOf(p);
        if(_routeMode) _selectRouteItem(idx);
        else selectItem(idx,{fromNearby:false,fromRegion:false});
      });
      // setMap은 _updateParishViewport에서 뷰포트 기준으로 처리
      _dioMkrs[code].push(mk);
    });
  }
  // ── 현재 뷰포트 기준 첫 렌더링 ──
  _updateParishViewport(code);
  // ── 지도 이동/줌 시 뷰포트 재계산 (idle = pan+zoom 완료 후 1회 발화) ──
  if(_parishIdleListener){
    try{kakao.maps.event.removeListener(_parishIdleListener);}catch(e){ console.warn('[가톨릭길동무]',e); }
    _parishIdleListener=null;
  }
  _parishIdleListener=kakao.maps.event.addListener(_map,'idle',function(){
    if(_activeDio===code) _updateParishViewport(code);
  });
}

/* 선택된 교구의 성당 마커를 표시합니다.
   이전에는 현재 뷰포트 안의 성당만 표시해서, 성당 카테고리에서 교구명을 눌러도
   지도 위치/줌에 따라 아무 마커도 보이지 않을 수 있었습니다.
   이제 교구 선택 상태에서는 해당 교구 성당 마커를 전부 지도에 올리고,
   교구 선택 시 _focusParishDio()가 지도를 해당 교구 범위로 맞춥니다. */
function _updateParishViewport(code){
  const mkrs=_dioMkrs[code];
  if(!mkrs||!_map) return;
  mkrs.forEach(mk=>{
    try{ mk.setMap(_map); }catch(e){ console.warn('[가톨릭길동무]',e); }
  });
}

function _hideParishDioMkrs(code){
  (_dioMkrs[code]||[]).forEach(mk=>{ try{mk.setMap(null);}catch(e){ console.warn('[가톨릭길동무]',e); } });
  // idle 리스너도 함께 제거
  if(_parishIdleListener){
    try{kakao.maps.event.removeListener(_parishIdleListener);}catch(e){ console.warn('[가톨릭길동무]',e); }
    _parishIdleListener=null;
  }
}
function _buildRetreatMarkers(){
  if(!_map) return;
  if(!_retreatMarkers.length){
    RETREATS.forEach((p,i)=>{
      if(!p.lat||!p.lng||p.lat===0) return;
      const mk=new _MM({
        position:new _LL(p.lat,p.lng),
        image:_mkrImg('#2e7d32',false),
        title:p.name,
        zIndex:45
      });
      (function(idx){kakao.maps.event.addListener(mk,'click',function(){
        if(_routeMode) _selectRouteItem(idx);
        else selectItem(idx,{fromNearby:false,fromRegion:false});
      });})(i);
      _retreatMarkers.push({marker:mk,item:p,index:i});
    });
  }
  _retreatMarkers.forEach(o=>o.marker.setMap(_map));
}
function _clearRetreatMarkers(){
  _retreatMarkers.forEach(o=>o.marker.setMap(null));
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _paSelMkr=null;}
}
function _restoreRetreatMarkers(){
  _retreatMarkers.forEach(o=>{
    const s=o.item;
    const ok=(_filterDio==='all'||s.diocese===_filterDio)&&(!_listSrch||s.name.includes(_listSrch)||s.diocese.includes(_listSrch)||s.addr.includes(_listSrch));
    o.marker.setMap(ok?_map:null);
  });
}
function _selectRetreatMarker(p){
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _paSelMkr=null;}
  if(!_map||!p.lat||!p.lng) return;
  _paSelMkr=new _MM({position:new _LL(p.lat,p.lng),image:_mkrImgRetreat('#FFE500',true),zIndex:180});
  _paSelMkr.setMap(_map);
}
// ──────────────────────────────────────────────────────────────────

function _clearParishMarkers(){
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }  _paSelMkr=null;}
  // 교구 마커 숨기기
  if(_activeDio){ _hideParishDioMkrs(_activeDio); _activeDio=null; }
  document.querySelectorAll('.dio-label').forEach(e=>e.style.transform='');
  // 교구 라벨도 숨기기 (shrine 모드 전환 시)
  _hideDioOverlays();
}

function _autoLocate(){
  if(!_GEO) return;
  _GEO.getCurrentPosition(p=>{
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  if(_mode==='shrine'){
   _map.setLevel(8);
   if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(p.coords.latitude,p.coords.longitude));
   else _map.setCenter(new _LL(p.coords.latitude,p.coords.longitude));
  } else if(_mode==='parish'){
   _map.setLevel(6);
   if(typeof _focusParishPointAround==='function') _focusParishPointAround(p.coords.latitude,p.coords.longitude,{level:6});
   else _map.setCenter(new _LL(p.coords.latitude,p.coords.longitude));
  } else if(_mode==='retreat'){
   _map.setLevel(9);
   if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(p.coords.latitude,p.coords.longitude));
   else _map.setCenter(new _LL(p.coords.latitude,p.coords.longitude));
  }
  },()=>{},
  _GO2);
  setTimeout(()=>{
  _GEO.getCurrentPosition(p=>{
   _setMyLoc(p.coords.latitude,p.coords.longitude);
  },()=>{},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
  },500);
}

function _nearestDioCode(lat,lng){
  if(!_DIO_CFG) return null;
  let best=null,bestD=Infinity;
  Object.entries(_DIO_CFG).forEach(([code,cfg])=>{
    if(!cfg.lat||!cfg.lng) return;
    const d=Math.pow(lat-cfg.lat,2)+Math.pow(lng-cfg.lng,2);
    if(d<bestD){bestD=d;best=code;}
  });
  return best;
}
function _showCurrentParishDioIfIdle(){
  if(_activeTab==='nearby' || (_nearbyCache && _nearbyCache.length)) return;
  if(_mode!=='parish'||!_map||!_myLat||!_myLng||_paSelMkr||_routeMode||_rS||_rE) return;
  if(!_parishSysInited) return;
  const code=_nearestDioCode(_myLat,_myLng);
  if(!code) return;
  try{
    if(_activeDio && _activeDio!==code) _hideParishDioMkrs(_activeDio);
    _ensureParishMarkerZoom();
    _activeDio=code;
    _showParishDioMkrs(code);
    if(typeof _focusParishPointAround==='function') _focusParishPointAround(_myLat,_myLng,{level:6});
    document.querySelectorAll('.dio-label').forEach(e=>{e.style.transform='';e.style.display='';});
    const clickedEl=_dioOverlays[code]?.getContent?.();
    if(clickedEl){clickedEl.style.display='none';}
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _setMyLoc(lat,lng){
  _myLat=lat;_myLng=lng;
  if(typeof kakao==='undefined'||!_map) return;  // 지도 미로드 시 무시
  if(_myMkr) _myMkr.setMap(null);
  const svg=`<svg ${_NS} width='28' height='28' viewBox='0 0 28 28'><circle cx='14' cy='14' r='12' fill='#1a73e8' opacity='.18'/><circle cx='14' cy='14' r='7' fill='#1a73e8'/><circle cx='14' cy='14' r='3.5' fill='white'/></svg>`;
  _myMkr=new _MM({
  position:new _LL(lat,lng),
  image:new _MI(_svgUrl(svg),
   new _SZ(28,28),{offset:new _PT(14,14)})
  });
  _myMkr.setMap(_map);
  setTimeout(_showCurrentParishDioIfIdle, 80);
}

function goMyLoc(){
  if(!_GEO) return alert('위치 정보를 지원하지 않습니다.');
  _GEO.getCurrentPosition(p=>{
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  _map.setLevel(7);
  if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(p.coords.latitude,p.coords.longitude));
  else _map.setCenter(new _LL(p.coords.latitude,p.coords.longitude));
  },err=>{
  alert(err.code===1?'위치 권한을 허용해 주세요.':'위치를 가져올 수 없습니다.');
  },_GO1);
}

function _loadNearby(){
  const body=$('nearby-body');
  body.innerHTML='<div class="empty-msg">📍 위치를 확인하는 중...</div>';

  if(!_GEO){
  body.innerHTML='<div style="padding:30px;text-align:center;color:#c0392b;font-size:13px">⚠️ 위치 기능을 지원하지 않습니다</div>';
  return;
  }

  const go=(lat,lng)=>{
  _myLat=lat;_myLng=lng;
  if(_mode==='shrine') _loadNearbyShrines(lat,lng);
  else if(_mode==='retreat') _loadNearbyRetreats(lat,lng);
  else _loadNearbyParishes(lat,lng);
  };

  if(_myLat) { go(_myLat,_myLng); return; }

  _GEO.getCurrentPosition(p=>{
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  go(p.coords.latitude,p.coords.longitude);
  },err=>{
  if(err.code===1){
    body.innerHTML=`<div style="padding:28px 20px;text-align:center;">
      <div style="font-size:36px;margin-bottom:12px">📍</div>
      <div style="font-size:14px;font-weight:700;color:#c0392b;margin-bottom:8px">위치 권한이 거부되어 있습니다</div>
      <div style="font-size:12px;color:#888;line-height:1.7;margin-bottom:18px">
        브라우저 주소창 왼쪽의 🔒 아이콘을 탭한 뒤<br>
        <b>위치</b> 권한을 <b>허용</b>으로 변경하고 새로고침하세요.
      </div>
      <button onclick="_loadNearby()" style="background:#0e1535;color:#d4aa6a;border:none;border-radius:20px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">↺ 다시 시도</button>
    </div>`;
  } else {
    body.innerHTML=`<div style="padding:28px 20px;text-align:center;">
      <div style="font-size:36px;margin-bottom:12px">😔</div>
      <div style="font-size:14px;font-weight:700;color:#c0392b;margin-bottom:8px">위치를 가져올 수 없습니다</div>
      <div style="font-size:12px;color:#888;line-height:1.7;margin-bottom:18px">GPS 신호가 약하거나 네트워크 문제일 수 있습니다.<br>잠시 후 다시 시도해보세요.</div>
      <button onclick="_loadNearby()" style="background:#0e1535;color:#d4aa6a;border:none;border-radius:20px;padding:10px 22px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">↺ 다시 시도</button>
    </div>`;
  }
  },{enableHighAccuracy:true,timeout:12000,maximumAge:60000});
}

function _loadNearbyWithDist(lat,lng,items,getIdx,getColor,getLabel){
  const body=$('nearby-body');
  const POOL=items.filter(p=>p.lat&&p.lng);
  const prelim=POOL.map(p=>({p,d:calcDist(lat,lng,p.lat,p.lng)})).sort((a,b)=>a.d-b.d).slice(0,30);

  if(!prelim.length){
    if(body) body.innerHTML='<div class="empty-msg">표시할 장소가 없습니다.</div>';
    return;
  }

  if(body){
    body.innerHTML='<div class="empty-msg">📍 정확한 거리를 계산 중입니다...</div>';
  }

  // 성당 첫 진입/내주변 목록은 정확한 도로거리 계산이 끝난 뒤에 표시한다.
  // 계산 전 직선거리 목록을 먼저 띄우지 않아 목록 순서가 바뀌는 느낌을 없앤다.

  const results=new Array(prelim.length).fill(null);
  let done=0;

  prelim.forEach((x,i)=>{
    _navFetch(`${lng},${lat}`,`${x.p.lng},${x.p.lat}`)
    .then(val=>{ results[i]=val||{km:x.d*1.35,dur:null}; })
    .catch(()=>{ results[i]={km:x.d*1.35,dur:null}; })
    .finally(()=>{
      done++;
      if(done===prelim.length){
        _renderNearbyDone(prelim,results,getIdx,getColor,getLabel,'final');
      }
    });
  });
}
function _renderNearbyDone(prelim,results,getIdx,getColor,getLabel,phase){
  const sorted=prelim.map((x,i)=>({x,r:results[i]||{km:x.d*1.35,dur:null}})).sort((a,b)=>a.r.km-b.r.km).slice(0,10);
  _nearbyCache=sorted.map(o=>o.x.p);
  if(phase==='final'&&_mode==='shrine'&&_map) _showAllShrinesOnMapWithNearbyBounds(_nearbyCache,_myLat,_myLng);
  if(phase==='final'&&_mode==='parish'&&_map) _showParishNearbyMarkersOnMap(_nearbyCache,_myLat,_myLng,phase);
  const body=$('nearby-body');
  if(!body) return;
  const scrollTop=body.scrollTop||0;
  body.innerHTML=sorted.map((o,i)=>{
    const idx=getIdx(o.x.p);
    const c=getColor(o.x.p);
    const lbl=getLabel(o.x.p);
    const km=o.r.km.toFixed(1);
    const isEst=(phase==='est');
    const distTxt=isEst?`~${km}km`:`🚗${km}km`;
    const dur=(!isEst&&o.r.dur)?`<span style="font-size:10px;color:#aaa;font-weight:400;margin-left:3px">${_fmtTime(o.r.dur)}</span>`:'';
    return `<div class="nearby-item" onclick="selectItem(${idx},{fromNearby:true})"><div class="nearby-num" style="background:${c}!important">${i+1}</div><div class="nearby-info"><div class="nearby-name">${o.x.p.name}</div><div class="nearby-addr">${o.x.p.addr.substring(0,26)}${o.x.p.addr.length>26?'…':''}</div></div><div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${lbl}</div><div class="nearby-dist" style="color:${isEst?'#aaa':c}!important">${distTxt}${dur}</div></div></div>`;
  }).join('');
  if(phase==='final') body.scrollTop=scrollTop;
}
function _loadNearbyShrines(lat,lng){
  _loadNearbyWithDist(lat,lng,SHRINES,p=>SHRINES.indexOf(p),p=>TC[p.type]||'#555',p=>p.type);
}
function _loadNearbyParishes(lat,lng){
  _loadNearbyWithDist(lat,lng,PARISHES,p=>PARISHES.indexOf(p),()=>'#8b5e3c',()=>'⛪ 성당');
}
function _loadNearbyRetreats(lat,lng){
  _loadNearbyWithDist(lat,lng,RETREATS,p=>RETREATS.indexOf(p),p=>_getRetreatColor(p),()=>'🏔 피정의 집');
}

function renderList(){
  const body=$('list-body');
  if(!body) return;
  const items = _getCurrentItems();
  const q=_listSrch;
  const groups={};
  items.forEach((s,i)=>{
  if(_mode==='shrine' && (!s.lat||!s.lng||s.lat<33||s.lat>38)) return;
  const matchDio = q?true:(_filterDio==='all'||s.diocese===_filterDio);
  if(!matchDio) return;
  if(q){
    const nq=q.replace(/\s+/g,'');
    const nameNorm=s.name.replace(/\s+/g,'');
    let matchAll=false;
    if(_mode==='parish'){
      /* 성당찾기: 첫 음절부터 이름이 일치하는 성당만 표시 */
      matchAll = nameNorm.startsWith(nq);
    } else {
      const tokens=q.trim().split(/\s+/);
      matchAll=tokens.length>=2
        ?tokens.every(t=>{const nt=t.replace(/\s+/g,'');return nameNorm.includes(nt)||s.diocese.replace(/\s+/g,'').includes(nt)||s.addr.replace(/\s+/g,'').includes(nt);})
        :nameNorm.includes(nq)||s.diocese.replace(/\s+/g,'').includes(nq)||s.addr.replace(/\s+/g,'').includes(nq);
    }
    if(!matchAll) return;
  }
  if(!groups[s.diocese]) groups[s.diocese]=[];
  groups[s.diocese].push({s,i});
  });
  if(Object.keys(groups).length===0){
  body.innerHTML='<div class="empty-msg">검색 결과가 없습니다</div>';
  return;
  }
  /* 검색어 있을 때 이름 시작 일치 우선 정렬 */
  if(q){
    const nq=q.replace(/\s+/g,'');
    Object.keys(groups).forEach(dio=>{
      groups[dio].sort((a,b)=>{
        const an=a.s.name.replace(/\s+/g,''),bn=b.s.name.replace(/\s+/g,'');
        const ae=an===nq,be=bn===nq;
        if(ae&&!be) return -1; if(!ae&&be) return 1;
        const as=an.startsWith(nq),bs=bn.startsWith(nq);
        if(as&&!bs) return -1; if(!as&&bs) return 1;
        return 0;
      });
    });
  }
  body.innerHTML='';
  Object.entries(groups).forEach(([dio,entries])=>{
  const hd=document.createElement('div');
  hd.className='dio-hd';hd.textContent=dio;
  body.appendChild(hd);
  entries.forEach(({s,i})=>{
   const c=_getModeMarkerColor(s);
   const d=document.createElement('div');
   d.className='list-item';
   d.innerHTML=`<div class="li-dot" style="background:${c}"></div>
    <div class="li-info"><div class="li-name">${s.name}</div><div class="li-sub">${s.addr.substring(0,28)}${s.addr.length>28?'…':''}</div></div>
    <span class="li-badge" style="background:${c}18!important;color:${c}!important">${_mode==='shrine'?s.type:(_mode==='retreat'?'피정의 집':'성당')}</span>`;
   d.onclick=()=>selectItem(i);
   body.appendChild(d);
  });
  });
}

function onListSearch(v){
  _listSrch=v.trim();
  $('list-srch-x').style.display=v?'block':'none';
  renderList();
  setTimeout(()=>_scrollSheetTop('list'),0);
}
function clearListSearch(){
  _listSrch='';
  $('list-srch-inp').value='';
  $('list-srch-x').style.display='none';
  renderList();
  setTimeout(()=>_scrollSheetTop('list'),0);
}
function setDioFilter(v,btn){
  _filterDio=v;
  $$('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  _listSrch='';
  const inp=$('list-srch-inp');
  if(inp){inp.value='';$('list-srch-x').style.display='none';}
  renderList();
  setTimeout(()=>_scrollSheetTop('list'),0);
  if(v!=='all'&&DIOCESE_CENTER[v]&&_map){
  const dc=DIOCESE_CENTER[v];
  _map.setLevel(dc.mob||10);
  if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(dc.lat,dc.lng));
  else _map.setCenter(new _LL(dc.lat,dc.lng));
  } else if(v==='all'&&_map){
  _map.setLevel(8);
  if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(36.2,127.9));
  else _map.setCenter(new _LL(36.2,127.9));
  }
}

const DIOCESE_CENTER={
  '서울대교구':{lat:37.53,lng:126.97,mob:10},'인천교구':{lat:37.60,lng:126.55,mob:10},
  '수원교구':{lat:37.20,lng:127.05,mob:10},'의정부교구':{lat:37.85,lng:127.05,mob:10},
  '춘천교구':{lat:37.90,lng:128.00,mob:10},'원주교구':{lat:37.20,lng:128.00,mob:10},
  '대전교구':{lat:36.45,lng:126.80,mob:10},'청주교구':{lat:36.70,lng:127.80,mob:10},
  '대구대교구':{lat:35.90,lng:128.50,mob:10},'안동교구':{lat:36.60,lng:128.50,mob:10},
  '부산교구':{lat:35.50,lng:129.00,mob:10},'마산교구':{lat:35.25,lng:128.30,mob:10},
  '광주대교구':{lat:35.10,lng:126.90,mob:10},'전주교구':{lat:35.75,lng:127.00,mob:10},
  '제주교구':{lat:33.40,lng:126.50,mob:10},
};

function onRegionInp(v){
  // 입력 중 현재 모드에 맞는 안내 표시
  const body=$('region-body');
  if(!v.trim()){
    const mode=_mode==='shrine'?'성지':_mode==='parish'?'성당':'피정의 집';
    body.innerHTML=`<div class="empty-msg">🏞 여행지나 숙박 지역을 입력하면<br>근처 ${mode} 목록이 나타납니다</div>`;
  }
}
function doRegionSearch(){
  const inp=$('region-inp');
  const q=(inp.value||'').trim();
  if(!q) return;
  inp.blur();
  const body=$('region-body');
  body.innerHTML='<div class="empty-msg">🔍 장소 검색 중...</div>';
  fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${_EC(q)}&size=8`,_AH)
  .then(r=>r.json()).then(data=>{
    const docs=data.documents||[];
    if(!docs.length){ _showRegionFallback(q); return; }
    let html='<div style="padding:8px 14px 4px;font-size:11px;font-weight:700;color:#888;background:#f8f9fc;border-bottom:1px solid #eee;">📍 지역을 선택하세요</div>';
    docs.forEach(d=>{
      const nm=d.place_name, ad=d.road_address_name||d.address_name;
      html+=`<div class="region-place-cand" data-lat="${parseFloat(d.y)}" data-lng="${parseFloat(d.x)}" data-name="${nm.replace(/"/g,'&quot;')}" style="padding:11px 14px;border-bottom:1px solid #f0f0f0;cursor:pointer;background:#fff;display:flex;align-items:center;gap:10px;"><div style="font-size:20px">📍</div><div><div style="font-size:14px;font-weight:600;color:#1F2937">${nm}</div><div style="font-size:12px;color:#888;margin-top:2px">${ad}</div></div></div>`;
    });
    body.innerHTML=html;
    body.onclick=function(e){
      const cand=e.target.closest('.region-place-cand');
      if(!cand) return;
      body.onclick=null;
      const clat=parseFloat(cand.dataset.lat),clng=parseFloat(cand.dataset.lng),cname=cand.dataset.name;
      _regionLat=clat;_regionLng=clng;_regionName=cname;_regionPlaceName=cname;
      body.innerHTML='<div class="empty-msg">🚗 자동차 거리 계산 중...</div>';
      _showRegionResults(cname,clat,clng,{place_name:cname,road_address_name:'',address_name:'',category_name:'',place_url:''});
      if(_map){
        if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(clat,clng));
        else _map.setCenter(new _LL(clat,clng));
      }
    };
  }).catch(()=>_showRegionFallback(q));
}

function _showRegionResults(q,lat,lng,doc){
  const items=_getCurrentItems();
  const POOL=items.filter(s=>s.lat&&s.lng);
  const prelim=POOL.map(s=>({s,d:calcDist(lat,lng,s.lat,s.lng)})).sort((a,b)=>a.d-b.d).slice(0,30);
  const placeName=doc.place_name||q;
  const placeAddr=doc.road_address_name||doc.address_name||'';
  const placeCat=doc.category_name?doc.category_name.split(' > ').pop():'';
  const placeUrl=doc.place_url||'';
  const isParish=_mode==='parish',isRetreat=_mode==='retreat';
  const infoCard=`<div class="region-info-card"><div class="ric-hd"><div class="ric-icon">📍</div><div class="ric-name-wrap"><div class="ric-name">${placeName}</div>${placeCat?`<div class="ric-cat">${placeCat}</div>`:''}</div>${placeUrl?`<a class="ric-map-link" href="${placeUrl}" target="_blank">지도 ↗</a>`:''}</div><div class="ric-body">${placeAddr?`<div class="ric-row"><span class="ric-lbl">주소</span><span>${placeAddr}</span></div>`:''}</div></div>`;
  const listHd=`<div class="region-list-hd">${isParish?'⛪ 근처 성당':(isRetreat?'🏔 근처 피정의 집':'✝ 근처 성지')} <span style="font-size:13px;font-weight:500;color:#aaa">· 자동차 거리순 10곳</span></div>`;
  $('region-body').innerHTML=infoCard+listHd+'<div id="rg-loading" style="text-align:center;padding:10px;font-size:12px;color:#888;">🚗 정확한 거리 계산 중입니다…</div><div id="rg-list" style="background:#fff"></div>';
  const results=new Array(prelim.length).fill(null);let done=0;
  prelim.forEach((x,i)=>{
    _navFetch(`${lng},${lat}`,`${x.s.lng},${x.s.lat}`)
    .then(val=>{results[i]=val||{km:x.d*1.35,dur:null};})
    .catch(()=>{results[i]={km:x.d*1.35,dur:null};})
    .finally(()=>{ done++;
      if(done===prelim.length){
        const sorted=prelim.map((x,i)=>({x,r:results[i]||{km:x.d*1.35,dur:null}})).sort((a,b)=>a.r.km-b.r.km).slice(0,10);
        _regionCache=sorted.map(o=>o.x.s);
        if(_mode==='shrine'&&_map) _showItemsOnMap(_regionCache);
        const rgl=$('rg-list');
        const loadEl=$('rg-loading');
        if(loadEl) loadEl.style.display='none';
        if(rgl) rgl.innerHTML=sorted.map((o,i)=>{
          const idx=items.indexOf(o.x.s);const c=_getModeMarkerColor(o.x.s);const lbl=_getModeTypeLabel(o.x.s);
          const km=o.r.km.toFixed(1);const dur=o.r.dur?`<span style="font-size:10px;color:#aaa;font-weight:400;margin-left:3px">${_fmtTime(o.r.dur)}</span>`:'';
          return `<div class="region-item" onclick="selectItem(${idx},{fromRegion:true})"><div class="nearby-num" style="background:${c}!important;width:28px;height:28px;font-size:12px">${i+1}</div><div class="nearby-info"><div class="nearby-name">${o.x.s.name}</div><div class="nearby-addr">${o.x.s.addr.substring(0,26)}${o.x.s.addr.length>26?'…':''}</div></div><div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${lbl}</div><div class="nearby-dist" style="color:${c}!important">🚗${km}km${dur}</div></div></div>`;
        }).join('');
      }
    });
  });
}

function _showRegionFallback(q){
  _regionPlaceName=q;
  const items=_getCurrentItems();
  var _matched_all=items.filter(function(s){return s.addr.includes(q)||s.name.includes(q)||(s.diocese&&s.diocese.includes(q));});
  /* 이름 정확 일치 → 이름 시작 일치 → 이름 포함 → 주소 포함 순으로 정렬 */
  _matched_all.sort(function(a,b){
    var an=a.name,bn=b.name;
    var ae=an===q,be=bn===q;
    if(ae&&!be) return -1; if(!ae&&be) return 1;
    var as=an.startsWith(q),bs=bn.startsWith(q);
    if(as&&!bs) return -1; if(!as&&bs) return 1;
    return 0;
  });
  const matched=_matched_all.slice(0,10);
  if(!matched.length){
  $('region-body').innerHTML='<div class="empty-msg">검색 결과가 없습니다</div>';
  return;
  }
  _regionCache=matched;
  if(_mode==='shrine'&&_map) _showItemsOnMap(_regionCache);
  const items2=_getCurrentItems();
  const list=matched.map((s,i)=>{
  const idx=items2.indexOf(s);
  const c=_getModeMarkerColor(s);
  return `<div class="region-item" onclick="selectItem(${idx},{fromRegion:true})">
   <div class="nearby-num" style="background:${c}!important;width:26px;height:26px;font-size:12px">${i+1}</div>
   <div class="nearby-info"><div class="nearby-name">${s.name}</div><div class="nearby-addr">${s.addr.substring(0,26)}…</div></div>
   <div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${_mode==='shrine'?s.type:(_mode==='retreat'?'피정의 집':'성당')}</div></div>
  </div>`;
  }).join('');
  $('region-body').innerHTML=
  `<div style="padding:10px 16px 8px;font-size:12px;font-weight:700;color:#1565c0;background:#fff;border-bottom:1px solid #eee">검색결과 ${matched.length}곳</div>${list}`;
}

function _ensureCurrentLocationStart(){
  if(_rS&&_rS.lat&&_rS.lng) return;
  if(_routeRegionStart&&_routeRegionStart.lat&&_routeRegionStart.lng){
    _rS={idx:-1,name:_routeRegionStart.name||'📍 검색지',lat:_routeRegionStart.lat,lng:_routeRegionStart.lng,isRegionStart:true};
    _setRouteLabel('start',_rS.name);
    _refreshRouteTmpMarkers();
    _updateSearchBtn();
    return;
  }
  if(_myLat&&_myLng){
    _rS={idx:-1,name:'📍 현위치',lat:_myLat,lng:_myLng};
    _setRouteLabel('start','📍 현위치');
    _refreshRouteTmpMarkers();
    _updateSearchBtn();
    return;
  }
  if(!_GEO) return;
  _GEO.getCurrentPosition(p=>{
    _setMyLoc(p.coords.latitude,p.coords.longitude);
    if(!_rS){
      _rS={idx:-1,name:'📍 현위치',lat:p.coords.latitude,lng:p.coords.longitude};
      _setRouteLabel('start','📍 현위치');
      _refreshRouteTmpMarkers();
      _updateSearchBtn();
      if(!_rE){
        $('route-guide').textContent=`도착 ${_getRouteGuideTarget()}를 탭하세요`;
        $('route-guide').classList.add('on');
      }
    }
  },()=>{},_GO1);
}

function _enterRouteMode(){
  _routeMode=true;
  const rs=$('sheet-route');
  if(rs){ rs.style.display=''; rs.classList.add('open'); }
  _ensureCurrentLocationStart();
  $('route-guide').textContent=_rS?`도착 ${_getRouteGuideTarget()}를 탭하세요`:`출발지를 탭하거나 지도에서 ${_getRouteGuideTarget()}를 선택하세요`;
  $('route-guide').classList.add('on');
}

function _exitRouteMode(){
  _routeMode=false;
  $('route-guide').classList.remove('on');
}

function setMyLocAsStart(){
  _routeRegionStart=null;
  if(!_GEO) return alert('위치 정보를 지원하지 않습니다.');
  _GEO.getCurrentPosition(p=>{
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  _clearRouteTmpMarkers();
  if(_mode==='shrine'&&_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
  _rS={idx:-1,name:'📍 현위치',lat:p.coords.latitude,lng:p.coords.longitude};
  _setRouteLabel('start','📍 현위치');
  _refreshRouteTmpMarkers();
  if(_rE) _updateSearchBtn();
  else {
   $('route-guide').textContent=`도착 ${_getRouteGuideTarget()}를 탭하세요`;
   $('route-guide').classList.add('on');
  }
  },()=>alert('위치를 가져올 수 없습니다.'),_GO1);
}

function _setRouteLabel(role,name){
  const el=$(`rs-${role}-lbl`);
  if(!el) return;
  el.textContent=name||(role==='start'?'출발지를 선택하세요':'도착지를 선택하세요');
  el.className='rs-lbl'+(name?' filled':' empty');
  if(role==='end') $('rs-end-x').style.display=name?'inline':'none';
  _updateSearchBtn();
}

function _updateSearchBtn(){
  const btn=$('rs-search-btn');
  if(!btn) return;
  const filled=!!(_rS&&_rS.lat&&_rS.lng&&_rE&&_rE.lat&&_rE.lng);
  btn.style.display=filled?'flex':'none';
}

function doSearchRoute(){ document.activeElement&&document.activeElement.blur();
  if(_rS&&_rE) _calcRoute();
}

function swapRoute(){
  _clearRouteTmpMarkers();
  const sl=$('rs-start-lbl').textContent;
  const el=$('rs-end-lbl').textContent;
  _setRouteLabel('start',el.includes('선택하세요')?'':el);
  _setRouteLabel('end',sl.includes('선택하세요')?'':sl);
  const tmp=_rS; _rS=_rE; _rE=tmp;
  if(_mode==='shrine'){
   if(_rS&&_rS.idx>=0&&_markers[_rS.idx]){ _markers[_rS.idx].marker.setImage(_mkrImgRoute('#ff0000','출')); _setRouteMarkerZ(_rS.idx,'start'); }
   if(_rE&&_rE.idx>=0&&_markers[_rE.idx]){ _markers[_rE.idx].marker.setImage(_mkrImgRoute(_typeColor(_markers[_rE.idx].shrine.type),'도')); _setRouteMarkerZ(_rE.idx,'end'); }
  }
  _refreshRouteTmpMarkers();
  if(_rS&&_rE) _updateSearchBtn();
}

function clearRoute(role){
  if(role==='end'&&_rE){
  if(_mode==='shrine'&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
  _rE=null;
  _setRouteLabel('end','');
  _hide($('rs-result'));
  if(_polyline){_polyline.setMap(null);_polyline=null;}
  _refreshRouteTmpMarkers();
  _restoreMapMarkers();
  }
}

function resetRoute(opts){
  opts = opts || {};
  const fromButton = !!opts.fromButton;
  const fresh = !!opts.fresh;
  if(fresh) _routeRegionStart=null;
  // 도착지 위치·인덱스와 지역검색 출발지 기억 (리셋 전에 저장)
  const destItem = (!fresh && _rE) ? {lat:_rE.lat, lng:_rE.lng, idx:_rE.idx} : null;
  const regionStart = (!fresh && _routeRegionStart && _routeRegionStart.lat) ? Object.assign({}, _routeRegionStart) : null;

  if(_mode==='shrine'){
    if(_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
    if(_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
  }
  _rS=_rE=null;
  _setRouteLabel('start','');_setRouteLabel('end','');
  _hide($('rs-result'));
  $('rs-hint').style.display='block';
  const sBtn=$('rs-search-btn');
  if(sBtn) sBtn.style.display='none';
  if(_polyline){_polyline.setMap(null);_polyline=null;}
  _clearRouteTmpMarkers();
  _showJukrimgulParkingMkr(false);
  $('route-guide').classList.remove('on');
  if(_mode==='shrine'||_mode==='retreat') _restoreAllCategoryMarkersForSelection();
  else _restoreMapMarkers();

  // 다시선택 버튼: 뒤로가기처럼 지도를 도착지로 돌리되,
  // 일반 장소 인포카드는 열지 않고 길찾기 선택 카드(출발/도착 입력 화면)를 유지한다.
  if(fromButton){
    if(_activeTab!=='route') openTab('route');
    const rs=$('sheet-route');
    if(rs){ rs.style.display=''; rs.classList.add('open'); }
    closeInfoCard();
    if(regionStart){
      _routeRegionStart=Object.assign({}, regionStart);
      _regionLat=regionStart.lat;
      _regionLng=regionStart.lng;
      _regionPlaceName=regionStart.placeName || regionStart.name || _regionPlaceName;
      _regionName=regionStart.placeName || regionStart.name || _regionName;
    }
    _ensureCurrentLocationStart();
    if(destItem && destItem.lat && _map){
      try{
        const _items=_getCurrentItems();
        const _idx=(typeof destItem.idx==='number' && destItem.idx>=0) ? destItem.idx : _items.findIndex(p=>Number(p.lat)===Number(destItem.lat) && Number(p.lng)===Number(destItem.lng));
        if(_idx>=0 && _items[_idx]){
          if(_mode==='shrine') _selectShrineMarker(_idx);
          else if(_mode==='parish') _selectParishMarker(_items[_idx]);
          else _selectRetreatMarker(_items[_idx]);
          _focusMarkerAboveInfoCard(_items[_idx]);
        }
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    }
    return;
  }

  // 도착지(노란 마커 위치)가 있으면 그 위치로 이동 + 노란 마커 표시
  if(destItem && destItem.lat && _map){
    try{
      const _items=_getCurrentItems();
      const _idx=(typeof destItem.idx==='number' && destItem.idx>=0) ? destItem.idx : _items.findIndex(p=>Number(p.lat)===Number(destItem.lat) && Number(p.lng)===Number(destItem.lng));
      const _item=_idx>=0 ? _items[_idx] : null;
      if(_item){
        if(_mode==='shrine') _selectShrineMarker(_idx);
        else if(_mode==='parish') _selectParishMarker(_item);
        else _selectRetreatMarker(_item);
        _showInfoCard(_item, _idx);
        _focusMarkerAboveInfoCard(_item);
      }
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}

function _selectRouteItem(idx){
  const items=_getCurrentItems();
  const s=items[idx];
  if(!s) return;
  if(_rS&&_rE){
  resetRoute();
  }
  if(!_rS){
  _routeRegionStart=null;
  _rS={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute('#ff0000','출')); _setRouteMarkerZ(idx,'start'); }
  _setRouteLabel('start',s.name);
  _refreshRouteTmpMarkers();
  $('route-guide').textContent=`도착 ${_getRouteGuideTarget()}를 탭하세요`;
  $('route-guide').classList.add('on');
  if(!_activeTab) openTab('route');
  } else {
  _rE={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute(_typeColor(s.type),'도')); _setRouteMarkerZ(idx,'end'); }
  _setRouteLabel('end',s.name);
  _refreshRouteTmpMarkers();
  $('route-guide').classList.remove('on');
  _updateSearchBtn();
  }
}

async function _calcRoute(){
  if(!_rS||!_rE) return;
  $('rs-km').textContent='…';
  $('rs-time').textContent='…';
  $('rs-result').style.display='block';
  $('rs-hint').style.display='none';
  const sBtn=$('rs-search-btn');
  if(sBtn) sBtn.style.display='none';
  if(_polyline){_polyline.setMap(null);_polyline=null;}
  const isJuk = _mode==='shrine' && _rE.idx === JUKRIMGUL_IDX && JUKRIMGUL_IDX >= 0;
  const navDest = isJuk ? JUKRIMGUL_PARKING : _rE;
  _showJukrimgulParkingMkr(isJuk);
  const note=$('rs-note');
  if(isJuk){
  note.innerHTML='⚠️ <b>죽림굴주차장</b>까지 경로 안내 · 자동차가 올라가지 못하는 구간이므로 주차장에서 도보로 이동하세요.';
  note.style.display='block';
  } else {
  note.textContent='';note.style.display='none';
  }

  _drawLine(_rS, navDest, null);

  try{
  const res=await fetch(
   `https://apis-navi.kakaomobility.com/v1/directions?origin=${_rS.lng},${_rS.lat}&destination=${navDest.lng},${navDest.lat}&priority=RECOMMEND`,
   _ACH);
  if(!res.ok) throw new Error(res.status);
  const data=await res.json();
  const route=data.routes?.[0];
  if(!route||route.result_code!==0) throw new Error('no route');
  const sum=route.summary;
  $('rs-km').textContent=(sum.distance/1000).toFixed(1);
  $('rs-time').textContent=_fmtTime(sum.duration);
  const path=[];
  for(const sec of route.sections||[])
   for(const road of sec.roads||[]){
    const vx=road.vertexes;
    for(let i=0;i<vx.length-1;i+=2) path.push(new _LL(vx[i+1],vx[i]));
   }
  _drawLine(_rS, navDest, path.length>1?path:null);
  if(!isJuk){ note.textContent='';note.style.display='none'; }
  } catch(e){
  const d=calcDist(_rS.lat,_rS.lng,navDest.lat,navDest.lng)*1.4;
  $('rs-km').textContent=d.toFixed(1);
  $('rs-time').textContent=_fmtTime(d/70*3600);
  if(!isJuk){
   note.textContent='* 직선거리 기반 추정값';note.style.display='block';
  }
  }
}

function _drawLine(s1,s2,path){
  if(_polyline) _polyline.setMap(null);
  _clearRouteTmpMarkers();
  const pts=path||[new _LL(s1.lat,s1.lng),new _LL(s2.lat,s2.lng)];
  _polyline=new _PL({path:pts,
  strokeWeight:path?6:3,strokeColor:path?'#1a73e8':'#b8965a',
  strokeOpacity:path?0.88:0.7,strokeStyle:path?'solid':'dashed'});
  _polyline.setMap(_map);
  _refreshRouteTmpMarkers();

  if(path){
  _markers.forEach((m,i)=>{
   if(!m) return;
   const isRoute=(_rS&&_rS.idx===i)||(_rE&&_rE.idx===i);
   m.marker.setMap(isRoute?_map:null);
  });
  if(_mode==='parish'){
    _hideDioOverlays();
    if(_activeDio) _hideParishDioMkrs(_activeDio);
  } else if(_mode==='retreat'){
    _retreatMarkers.forEach(o=>{
      const isRoute=(_rS&&_rS.idx===o.index)||(_rE&&_rE.idx===o.index);
      o.marker.setMap(isRoute?_map:null);
    });
  }
  const bounds=new _LB();
  pts.forEach(p=>bounds.extend(p));
  if(_startTmpMkr) bounds.extend(new _LL(s1.lat,s1.lng));
  if(_endTmpMkr) bounds.extend(new _LL(s2.lat,s2.lng));
  const tabH=($('tabbar')?.offsetHeight)||54;
  const sheetH=Math.round(window.innerHeight*0.55);
  if(typeof _setBoundsByInfoCardStandard==='function'){
    _setBoundsByInfoCardStandard(bounds,tabH+10,40,sheetH,40);
  }else{
    try{_map.setBounds(bounds,tabH+10,40,sheetH,40);}catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  }
}

function _showJukrimgulParkingMkr(show){
  if(_jukrimgulParkMkr){ _jukrimgulParkMkr.setMap(null); _jukrimgulParkMkr=null; }
  if(!show||!_map) return;
  const svg=`<svg ${_NS} width="34" height="44" viewBox="0 0 34 44">
  <ellipse cx="17" cy="42" rx="6" ry="2.5" fill="rgba(0,0,0,.2)"/>
  <path d="M17 0C9.3 0 3 6.3 3 14c0 9.5 14 28 14 28S31 23.5 31 14C31 6.3 24.7 0 17 0z" fill="#7b2fbe"/>
  <circle cx="17" cy="14" r="9" fill="white" opacity=".9"/>
  <text x="17" y="19" text-anchor="middle" font-size="12" font-weight="900" fill="#7b2fbe" font-family="sans-serif">P</text>
  </svg>`;
  _jukrimgulParkMkr = new _MM({
  position: new _LL(JUKRIMGUL_PARKING.lat, JUKRIMGUL_PARKING.lng),
  image: new kakao.maps.MarkerImage(
   'data:image/svg+xml;charset=utf-8,'+_EC(svg),
   new _SZ(34,44),{offset:new _PT(17,44)}
  ),
  title:'죽림굴주차장', zIndex:15
  });
  _jukrimgulParkMkr.setMap(_map);
  if(JUKRIMGUL_IDX>=0 && _markers[JUKRIMGUL_IDX])
  _markers[JUKRIMGUL_IDX].marker.setMap(_map);
}

function _kakaoLaunch(w,a){
 if(_isMob){
  _kakaoLaunching=true;
  setTimeout(()=>{_kakaoLaunching=false;},3000);
  const f=document.createElement('iframe');
  f.style.cssText='display:none;width:0;height:0;border:0;position:fixed;';
  document.body.appendChild(f);f.src=a;
  const t=setTimeout(()=>{_kakaoLaunching=false;window.open(w,'_blank');},1500);
  window.addEventListener('blur',()=>clearTimeout(t),{once:true});
  setTimeout(()=>{if(document.body.contains(f))document.body.removeChild(f);},2000);
 } else window.open(w,'_blank');
}
function doKakaoRoute(){
  if(!_rS||!_rE) return;
  const isJuk = _rE.idx === JUKRIMGUL_IDX && JUKRIMGUL_IDX >= 0;
  const dest = isJuk ? JUKRIMGUL_PARKING : _rE;
  const sp=_EC(_rS.name),ep=_EC(dest.name||dest.kw);
  const w=`https://map.kakao.com/link/from/${sp},${_rS.lat},${_rS.lng}/to/${ep},${dest.lat},${dest.lng}`;
  const a=`kakaomap://route?sp=${_rS.lat},${_rS.lng}&ep=${dest.lat},${dest.lng}&by=CAR`;
  _kakaoLaunch(w,a);
}

// _smTab, _smPlaceDebounce → AppState (위 통합 참고)

function smSwitchTab(tab){
  _smTab=tab;
  $('sm-tab-cat').classList.toggle('active',tab==='cat');
  $('sm-tab-place').classList.toggle('active',tab==='place');
  const activeSmTab = tab==='cat' ? $('sm-tab-cat') : $('sm-tab-place');
  if(activeSmTab){
    try{ activeSmTab.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'}); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  $('sm-body').style.display=tab==='cat'?'':'none';
  $('sm-body-place').style.display=tab==='place'?'':'none';
  const inp=$('sm-inp');
  if(tab==='place'){
    if(inp&&inp.value.trim()) _searchKakaoPlace(inp.value.trim());
  } else if(tab==='cat'&&inp){ filterModal(inp.value||''); }
}

function onSmInp(v){
  if(_smTab==='cat'){ filterModal(v); return; }
  clearTimeout(_smPlaceDebounce);
  if(!v.trim()){ $('sm-body-place').innerHTML='<div class="sm-place-loading">장소명을 입력하세요</div>'; return; }
  $('sm-body-place').innerHTML='<div class="sm-place-loading">🔍 검색 중...</div>';
  _smPlaceDebounce=setTimeout(()=>_searchKakaoPlace(v.trim()),400);
}

function _searchKakaoPlace(q){
  fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${_EC(q)}&size=10`,_AH)
  .then(r=>r.json()).then(data=>{
    const docs=data.documents||[];
    const body=$('sm-body-place');
    if(!body) return;
    if(!docs.length){ body.innerHTML='<div class="sm-place-loading">검색 결과가 없습니다</div>'; return; }
    const cat=docs[0].category_group_name||'';
    body.innerHTML=docs.map(d=>{
      const icon=d.category_group_code==='MT1'?'🏪':d.category_group_code==='SC4'?'🏫':d.category_group_code==='HP8'?'🏥':d.category_group_code==='PM9'?'💊':d.category_group_code==='OL7'?'⛽':'📍';
      const lat=parseFloat(d.y),lng=parseFloat(d.x),nm=d.place_name,ad=d.road_address_name||d.address_name;
      return `<div class="sm-place-item" data-lat="${lat}" data-lng="${lng}" data-name="${nm.replace(/"/g,'&quot;')}" data-addr="${ad.replace(/"/g,'&quot;')}"><div class="sm-place-icon">${icon}</div><div class="sm-place-info"><div class="sm-place-name">${nm}</div><div class="sm-place-addr">${ad}</div></div></div>`;
    }).join('');
  }).catch(()=>{ const b=$('sm-body-place'); if(b) b.innerHTML='<div class="sm-place-loading">검색 실패</div>'; });
}

function selectFromPlaceModal(lat,lng,name,addr){
  closeSearchModal();
  const role=_smRole;
  _clearRouteTmpMarkers();
  const locObj={idx:-1,name:name,lat:lat,lng:lng,isPlace:true};
  if(role==='start'){
    _routeRegionStart=null;
    if(_mode==='shrine'&&_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
    _rS=locObj;
    _setRouteLabel('start',name);
    _refreshRouteTmpMarkers();
    _enterRouteMode();
    if(_rE) _updateSearchBtn();
    else{ $('route-guide').textContent=`도착 ${_getRouteGuideTarget()}를 탭하세요`; $('route-guide').classList.add('on'); }
  } else {
    if(_mode==='shrine'&&_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
    _rE=locObj;
    _setRouteLabel('end',name);
    _refreshRouteTmpMarkers();
    $('route-guide').classList.remove('on');
    if(_rS) _updateSearchBtn();
    else $('route-guide').textContent=`출발 ${_getRouteGuideTarget()}를 탭하세요`;
  }
  if(!_activeTab||_activeTab!=='route') openTab('route');
  if(_map) _map.panTo(new _LL(lat,lng));
}
function openSearchModal(role){
  closeInfoCard({keepMap:true});
  _smRole=role;_smDio='all';
  _smTab='cat';
  // 탭 이름 카테고리별 설정
  const catTab=$('sm-tab-cat');
  if(catTab) catTab.textContent=_mode==='shrine'?'✝ 성지':_mode==='parish'?'⛪ 성당':'🏔 피정의 집';
  if($('sm-tab-cat')) $('sm-tab-cat').classList.add('active');
  if($('sm-tab-place')) $('sm-tab-place').classList.remove('active');
  requestAnimationFrame(function(){
    try{ $('sm-tab-cat')?.scrollIntoView({behavior:'instant', block:'nearest', inline:'center'}); }catch(e){ console.warn("[가톨릭길동무]", e); }
  });
  if($('sm-body')) $('sm-body').style.display='';
  if($('sm-body-place')) {
    $('sm-body-place').style.display='none';
    $('sm-body-place').innerHTML='';
    // 이벤트 위임 (한 번만 등록)
    if(!$('sm-body-place')._hasDelegate){
      $('sm-body-place')._hasDelegate=true;
      $('sm-body-place').addEventListener('click',function(e){
        const item=e.target.closest('.sm-place-item');
        if(!item) return;
        const lat=parseFloat(item.dataset.lat);
        const lng=parseFloat(item.dataset.lng);
        const name=item.dataset.name;
        const addr=item.dataset.addr;
        selectFromPlaceModal(lat,lng,name,addr);
      });
    }
  }
  // 모달 헤더 색상 모드별 적용
  const hd=$('srch-modal')?.querySelector('.sm-hd');
  if(hd){
    hd.style.background=_mode==='parish'?'var(--parish-bg)':_mode==='retreat'?'var(--retreat-bg)':'var(--navy)';
  }
  // 교구필터바 배경도 통일
  const sfb=$('srch-modal')?.querySelector('.sm-filter');
  if(sfb){
    sfb.style.background=_mode==='parish'?'var(--parish-bg)':_mode==='retreat'?'var(--retreat-bg)':'var(--navy2)';
  }
  $$('.sm-fb').forEach(b=>b.classList.remove('on'));
  document.querySelector('.sm-fb')?.classList.add('on');
  const noun=_getRouteGuideTarget();
  $('sm-title').textContent=role==='start'?`🔵 출발 ${noun} 검색`:`🔴 도착 ${noun} 검색`;
  $('sm-inp').value='';
  filterModal('');
  $('srch-modal').classList.add('open');
}

function _blurAll(){ try{document.activeElement&&document.activeElement.blur();}catch(e){ console.warn("[가톨릭길동무]", e); } }
function closeSearchModal(){
  $('srch-modal').classList.remove('open');
}

function setSmDio(v,btn){
  _smDio=v;
  $$('.sm-fb').forEach(b=>b.classList.remove('on'));
  btn?.classList.add('on');
  filterModal($('sm-inp')?.value||'');
}

function filterModal(q){
  const body=$('sm-body');
  const groups={};
  _getCurrentItems().forEach((s,i)=>{
  const matchDio=q?true:(_smDio==='all'||s.diocese===_smDio);
  if(!matchDio) return;
  if(q){
    const nq=q.replace(/\s+/g,'');
    const nameNorm=s.name.replace(/\s+/g,'');
    let matchAll=false;
    if(_mode==='parish'){
      /* 성당찾기: 첫 음절부터 이름이 일치하는 성당만 표시 */
      matchAll = nameNorm.startsWith(nq);
    } else {
      const tokens=q.trim().split(/\s+/);
      matchAll=tokens.length>=2
        ?tokens.every(t=>{const nt=t.replace(/\s+/g,'');return nameNorm.includes(nt)||s.diocese.replace(/\s+/g,'').includes(nt)||s.addr.replace(/\s+/g,'').includes(nt);})
        :nameNorm.includes(nq)||s.diocese.replace(/\s+/g,'').includes(nq)||s.addr.replace(/\s+/g,'').includes(nq);
    }
    if(!matchAll) return;
  }
  if(!s.lat||!s.lng) return;
  if(!groups[s.diocese]) groups[s.diocese]=[];
  groups[s.diocese].push({s,i});
  });
  let html='';
  Object.entries(groups).forEach(([dio,items])=>{
  const c=_smRole==='start'?'#E53935':'#2E7D32';
  html+=`<div class="sm-grp" style="color:${c}">${dio}</div>`;
  items.forEach(({s,i})=>{
   const tc=_mode==='shrine'?(TC[s.type]||'#555'):_getModeMarkerColor(s);
   const badge=_mode==='shrine'?s.type:(_mode==='retreat'?'피정':'성당');
   html+=`<div class="sm-item" onclick="selectFromModal(${i})"><div class="sm-role" style="background:${c}">${_smRole==='start'?'출':'도'}</div><div class="sm-info"><div class="sm-name">${s.name}</div><div class="sm-sub">${s.addr}</div></div><span class="sm-badge" style="color:${tc};background:${tc}18">${badge}</span></div>`;
  });
  });
  body.innerHTML=html||'<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">검색 결과가 없습니다</div>';
}

function selectFromModal(idx){
  const s=_getCurrentItems()[idx];
  if(!s) return;
  closeSearchModal();
  const role=_smRole;
  if(role==='start'){
  _routeRegionStart=null;
  if(_mode==='shrine'&&_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
  _clearRouteTmpMarkers();
  _rS={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute(_typeColor(s.type),'출')); _setRouteMarkerZ(idx,'start'); }
  _setRouteLabel('start',s.name);
  _refreshRouteTmpMarkers();
  _enterRouteMode();
  if(_rE) _updateSearchBtn();
  else {
   $('route-guide').textContent=`도착 ${_getRouteGuideTarget()}를 탭하세요`;
   $('route-guide').classList.add('on');
  }
  } else {
  if(_mode==='shrine'&&_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
  _rE={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute(_typeColor(s.type),'도')); _setRouteMarkerZ(idx,'end'); }
  _setRouteLabel('end',s.name);
  _refreshRouteTmpMarkers();
  $('route-guide').classList.remove('on');
  if(_rS) _updateSearchBtn();
  else $('route-guide').textContent=`출발 ${_getRouteGuideTarget()}를 탭하세요`;
  }
  if(!_activeTab||_activeTab!=='route') openTab('route');
  if(s.lat&&s.lng&&_map) _map.panTo(new _LL(s.lat,s.lng));
}

function _fetchDist(lat,lng,iLat,iLng,distId){
 _navFetch(`${lng},${lat}`,`${iLng},${iLat}`)
 .then(val=>{
  if(!val) return;
  const km=val.km.toFixed(1);
  const el=$(distId);if(el)el.innerHTML=`🚗${km}km<span style="font-size:10px;color:#aaa;font-weight:400;margin-left:3px">${_fmtTime(val.dur)}</span>`;
 }).catch(()=>{});
}
function _nearbyHtml(idx,i,name,addr,c,tLabel,distId,estKm){
 return `<div class="nearby-item" onclick="selectItem(${idx},{fromNearby:true})"><div class="nearby-num" style="background:${c}!important">${i+1}</div><div class="nearby-info"><div class="nearby-name">${name}</div><div class="nearby-addr">${addr.substring(0,26)}${addr.length>26?'…':''}</div></div><div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${tLabel}</div><div class="nearby-dist" id="${distId}" style="color:${c}!important">🚗${estKm}km</div></div></div>`;
}
function _regionHtml(idx,i,name,addr,c,tLabel,distId,estKm){
 return `<div class="region-item" onclick="selectItem(${idx},{fromRegion:true})"><div class="nearby-num" style="background:${c}!important;width:28px;height:28px;font-size:12px">${i+1}</div><div class="nearby-info"><div class="nearby-name">${name}</div><div class="nearby-addr">${addr.substring(0,26)}${addr.length>26?'…':''}</div></div><div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${tLabel}</div>${distId?`<div class="nearby-dist" id="${distId}" style="color:${c}!important">🚗${estKm}km</div>`:''}</div></div>`;
}
function _show(el,d){if(el)el.style.display=d||'flex';}
function _hide(el){if(el)el.style.display='none';}
function calcDist(a,b,c,d){
  const R=6371,dL=(c-a)*Math.PI/180,dG=(d-b)*Math.PI/180;
  const x=Math.sin(dL/2)**2+Math.cos(a*Math.PI/180)*Math.cos(c*Math.PI/180)*Math.sin(dG/2)**2;
  return R*2*Math.asin(Math.sqrt(x));
}
function _fmtTime(s){
  if(!s||s<60) return '1분 미만';
  const m=Math.round(s/60);
  if(m<60) return m+'분';
  return Math.floor(m/60)+'시간'+(m%60?' '+m%60+'분':'');
}
/* OAI removed legacy cv-pull handler */
// ── 스와이프 탭 이동 (v9-7) ──────────────────────────────────────
(function(){
  const TABS = ['nearby','list','region','route'];
  let _swSt = null;
  const MIN_DX = 55, MAX_DY = 90;

  function _doMainSwipe(dx){
    if(typeof _screen === 'undefined' || _screen !== 'map') return;
    if(document.getElementById('srch-modal')?.classList.contains('open')) return;
    const idx = (typeof _activeTab !== 'undefined' && _activeTab)
      ? TABS.indexOf(_activeTab) : -1;
    const next = dx < 0
      ? (idx < TABS.length - 1 ? TABS[idx + 1] : TABS[0])
      : (idx > 0 ? TABS[idx - 1] : TABS[TABS.length - 1]);
    // 스와이프 방향 저장: 왼쪽 밀기=다음탭(오른쪽에서 들어옴), 오른쪽 밀기=이전탭(왼쪽에서 들어옴)
    window._swipeDir = dx < 0 ? 'right' : 'left';
    if(typeof openTab === 'function') openTab(next);
    window._swipeDir = null;
  }

  document.addEventListener('touchstart', function(e){
    _swSt = {x: e.touches[0].clientX, y: e.touches[0].clientY};
  }, {passive: true});

  document.addEventListener('touchend', function(e){
    if(!_swSt) return;
    const ex = e.changedTouches[0].clientX;
    const ey = e.changedTouches[0].clientY;
    const dx = ex - _swSt.x;
    const dy = Math.abs(ey - _swSt.y);
    _swSt = null;
    if(Math.abs(dx) < MIN_DX || dy > MAX_DY) return;

    const tgt = e.target;

    /* ── 순례길 ── 지도 인포카드·목록 / 제외: trail-map·trail-tabs */
    const tv = document.getElementById('trail-view');
    if(tv?.classList.contains('open')){
      if(tgt.closest('#trail-map') || tgt.closest('.trail-tabs')) return;
      if(typeof trailSetView === 'function')
        trailSetView(dx < 0 ? 'list' : 'map');
      if(typeof window.oaiSwipeAction === 'function') window.oaiSwipeAction(document.getElementById('trail-list') || document.querySelector('#trail-view .trail-panel.on'), dx < 0 ? 'left' : 'right');
      return;
    }

    /* ── 웹사이트 ──
       최종 하단 패치(bindWebSwipe)가 웹사이트 탭 이동을 전담한다.
       여기서도 처리하면 touchend가 두 번 적용되어 한 칸을 건너뛰는 현상이 생긴다. */
    const wv = document.getElementById('web-view');
    if(wv?.classList.contains('open')){
      return;
    }

    /* ── 메인 앱 (성지·성당·피정) ──
       적용: 내주변 리스트, 찾기 리스트, 지역검색, 길찾기, 인포카드
       제외: 검색창(srch-bar), 교구필터탭(filter-bar), 지도(#map), 검색모달 */
    if(tgt.closest('.srch-bar'))   return;
    if(tgt.closest('.filter-bar')) return;
    if(tgt.closest('#map'))        return;
    if(tgt.closest('.sm-body, .sm-body-place')) return;

    const inApp =
      tgt.closest('#nearby-body') ||
      tgt.closest('#list-body')   ||
      tgt.closest('#region-body') ||
      tgt.closest('#sheet-route') ||
      tgt.closest('#info-card');
    if(inApp) _doMainSwipe(dx);

  }, {passive: true});
})();

// ── 관구교구: 커버 버튼에서 직접 새탭 열기 ──

(function(){
  const IDLE_MS = 10 * 60 * 1000; // 10분
  let _idleTimer = null;
  function _resetIdle(){
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(()=>{
      // 앱이 활성 상태일 때만
      if(document.documentElement.classList.contains('app-active')){
        _resetMapState();
        goToCover();
      }
    }, IDLE_MS);
  }
  ['touchstart','touchend','click','keydown','scroll'].forEach(ev=>{
    document.addEventListener(ev, _resetIdle, {passive:true});
  });
  _resetIdle();
})();

// ─── 이벤트 바인딩 ────────────────────────────────────────────────────────────
// index.html 에서 분리된 인라인 onclick/oninput/onkeydown 핸들러를 한 곳에서 관리합니다.
// 모든 바인딩은 DOMContentLoaded 이후 실행되므로 요소가 반드시 존재합니다.
document.addEventListener('DOMContentLoaded', function bindEvents() {
  function on(id, evt, fn, opts) {
    var el = typeof id === 'string' ? document.getElementById(id) : id;
    if (el) el.addEventListener(evt, fn, opts || false);
  }
  function onQ(sel, evt, fn) {
    document.querySelectorAll(sel).forEach(function(el) { el.addEventListener(evt, fn); });
  }

  // ── 매일미사 ──
  on('missa-close', 'click', function() { closeMissa(); });

  // ── 종료 다이얼로그 ──
  on('exit-cancel-btn', 'click', function() { closeExitDlg(); });
  on('exit-ok-btn',     'click', function() { doExit(); });

  // ── 교구 지도 ──
  on('diocese-close-btn', 'click', function() {
    if (typeof closeDioceseView === 'function') closeDioceseView();
  });
  on('diocese-frame', 'load', function() {
    if (typeof dioceseLoaded === 'function') dioceseLoaded();
  });

  // ── 기도문 ──
  on('prayer-close',  'click', function() { _closePrayerAndReturn(); });
  on('prayer-search-inp', 'input', function() { prRenderList(); });
  on('pr-sm-btn-1',   'click', function() { prAdjustFont(-1); });
  on('pr-lg-btn-1',   'click', function() { prAdjustFont(1); });
  on('pr-sm-btn-2',   'click', function() { prAdjustFont(-1); });
  on('pr-lg-btn-2',   'click', function() { prAdjustFont(1); });
  on('pr-detail-star','click', function(e) { prToggleDetailFav(e); });
  on('pr-back-btn',   'click', function() { prCloseDetail(); });

  // ── 커버 글자크기 ──
  on('cover-sm-btn',  'click', function(e) { e.stopPropagation(); prAdjustFont(-1); });
  on('cover-lg-btn',  'click', function(e) { e.stopPropagation(); prAdjustFont(1); });

  // ── 커버 카드 ──
  on('cc-1', 'click', function() { if (typeof openMassQuickMenu === 'function') openMassQuickMenu(); });
  on('cc-2', 'click', function() { hideCoverAndRun(function() { if (typeof startApp === 'function') startApp('parish'); }); });
  on('cc-3', 'click', function() { hideCoverAndRun(function() { if (typeof startApp === 'function') startApp('shrine'); }); });
  on('cc-4', 'click', function() { hideCoverAndRun(function() { if (typeof startApp === 'function') startApp('retreat'); }); });
  on('cc-5', 'click', function() { hideCoverAndRun(function() { if (typeof openTrailView === 'function') openTrailView(); }); });
  on('cc-6', 'click', function() { hideCoverAndRun(function() { if (typeof openWebView === 'function') openWebView(); }); });
  on('cc-7', 'click', function() { hideCoverAndRun(function() { openDioceseView(); }); });

  // ── 미사·기도·성가 빠른 메뉴 ──
  onQ('[data-mass-quick-close]', 'click', function() { closeMassQuickMenu(); });
  on('mass-quick-missa', 'click', function() { _setMassQuickReturn(true); if (typeof openMissa === 'function') openMissa(); });
  on('mass-quick-prayer', 'click', function() { _setMassQuickReturn(true); window.__MASS_QUICK_FROM_PRAYER__ = true; var modal=document.getElementById('mass-quick-modal'); if(modal){ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); } hideCoverAndRun(function() { if (typeof openPrayerBook === 'function') openPrayerBook({fromMassQuick:true}); else alert('기도문 기능이 연결되지 않았습니다.'); }); });
  on('mass-quick-hymn', 'click', function() { _setMassQuickReturn(true); if (typeof openCatholicHymn === 'function') openCatholicHymn(); });

  // ── 커버 기타 ──
  on('cover-update-btn','click', function(e) { e.stopPropagation(); refreshAppFilesOnly(); });
  on('qna-cover-btn',  'click', function() { openQnaView(); });
  on('pwa-install-btn','click', function() { triggerPwaInstall(); });

  // ── 탭바 ──
  on('tab-btn-nearby', 'click', function() { toggleTab('nearby'); });
  on('tab-btn-list',   'click', function() { toggleTab('list'); });
  on('tab-btn-region', 'click', function() { toggleTab('region'); });
  on('tab-btn-route',  'click', function() { toggleTab('route'); });

  // ── 시트 닫기(X): 해당 목록/박스만 숨기고 지도·마커 상태는 유지 ──
  on('nearby-close-btn', 'click', function(e) { e.stopPropagation(); closeSheetPanelOnly('nearby'); });
  on('list-close-btn',   'click', function(e) { e.stopPropagation(); closeSheetPanelOnly('list'); });
  on('region-close-btn', 'click', function(e) { e.stopPropagation(); closeSheetPanelOnly('region'); });
  on('route-close-btn',  'click', function(e) { e.stopPropagation(); closeRouteSheetByX(); });
  on('map-category-close-btn', 'click', function(e) { e.stopPropagation(); closeCategoryToCoverFromMap(); });

  // ── 내 위치 ──
  on('loc-btn', 'click', function() { goMyLoc(); });

  // ── 목록 검색 ──
  on('list-srch-inp', 'input', function() { onListSearch(this.value); });
  on('list-srch-x',   'click', function() { clearListSearch(); });

  // ── 지역 검색 ──
  on('region-inp', 'keydown', function(e) { if (e.key === 'Enter') doRegionSearch(); });
  on('region-inp', 'input',   function() { onRegionInp(this.value); });
  on('region-search-btn', 'click', function() {
    if (document.activeElement) document.activeElement.blur();
    doRegionSearch();
  });

  // ── 길찾기 ──
  on('rs-start-box', 'click', function() { openSearchModal('start'); });
  on('rs-end-box',   'click', function() { openSearchModal('end'); });
  on('rs-myloc-btn', 'click', function(e) { e.stopPropagation(); setMyLocAsStart(); });
  on('rs-end-x',     'click', function(e) { e.stopPropagation(); clearRoute('end'); });
  on('rs-swap-btn',  'click', function() { swapRoute(); });
  on('rs-search-btn','click', function() { doSearchRoute(); });
  on('rs-kakao-btn', 'click', function() { doKakaoRoute(); });
  on('rs-reset-btn', 'click', function() { resetRoute({ fromButton: true }); });

  // ── 인포카드 ──
  on('ic-close-btn', 'click', function() { closeInfoCard(); });
  on('ic-route-btn', 'click', function() { openInAppRoute(); });
  on('ic-guide',     'click', function() { if (typeof openShrineDetail === 'function') openShrineDetail(); });
  on('ic-kakao-nav', 'click', function() { openKakaoNav(); });

  // ── 검색 모달 ──
  on('sm-close-btn', 'click', function() { closeSearchModal(); });
  on('sm-inp', 'input', function() { onSmInp(this.value); });
  on('sm-inp', 'keyup', function(e) { if (e.key === 'Enter') { if (typeof _blurAll === 'function') _blurAll(); } });

  // ── 웹·순례길·Q&A 닫기 ──
  on('web-close-btn', 'click', function() {
    var v = document.getElementById('web-view');
    if (v) v.classList.remove('open');
    if (typeof goToCover === 'function') goToCover();
  });
  on('trail-close-btn', 'click', function() {
    var v = document.getElementById('trail-view');
    if (v) v.classList.remove('open');
    if (typeof goToCover === 'function') goToCover();
  });
  on('qna-close-btn', 'click', function() {
    var v = document.getElementById('qna-view');
    if (v) v.classList.remove('open');
    if (typeof goToCover === 'function') goToCover();
  });

  // ── 순례길 ──
  on('trail-sh-close-btn', 'click', function() { trailCloseSheet(); });
  on('trail-loc-btn',      'click', function() { trailMyLoc(); });
  on('trail-tab-map',  'click', function() { trailSetView('map'); });
  on('trail-tab-list', 'click', function() { trailSetView('list'); });

  // ── Q&A 탭 ──
  on('qna-tab-write',   'click', function() { qnaShowTab('write'); });
  on('qna-tab-answers', 'click', function() { qnaShowTab('answers'); });

  // ── 검색 모달 탭 ──
  on('sm-tab-cat',   'click', function() { smSwitchTab('cat'); });
  on('sm-tab-place', 'click', function() { smSwitchTab('place'); });

  // ── 매일미사 iframe 로드 ──
  on('missa-frame', 'load', function() { if (typeof missaLoaded === 'function') missaLoaded(); });
});
