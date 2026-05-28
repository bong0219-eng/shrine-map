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
    window.__OAI_PRAYER_COVER_NEEDS_FIRST_TOAST__ = false;
    sessionStorage.removeItem('oai_prayer_cover_needs_first_toast');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  window._noAutoNearby = false;
  var cv = document.getElementById('cover');
  if (cv) cv.style.display = 'none';
  document.documentElement.classList.add('app-active');
  // RAF로 커버 숨김 후 다음 프레임에 콜백 실행 → 버벅거림 방지
  if (callback) requestAnimationFrame(function(){ setTimeout(callback, 0); });
}


/* ═══════════════════════════════════════════════
   §1. 전역 상수 / 외부복귀 안정화 / 새로고침 베일
   ═══════════════════════════════════════════════ */
var OAI_EXTERNAL_LEAVE_HOLD_MS = 6000;
var OAI_EXTERNAL_LEAVE_HARD_MS = 6500;
var OAI_EXTERNAL_RETURN_MIN_MS = 1200;
var OAI_EXTERNAL_RETURN_MAX_MS = 4000;
var OAI_EXTERNAL_RETURN_STABLE_TICKS = 3;
var OAI_REFRESH_VEIL_MS = 1000; // refresh veil must remain visible for at least 1s
var OAI_REFRESH_CARRY_MS = 3000;
var OAI_REFRESH_PROGRESS_HOLD_MS = 10000;
// 수동 새로고침은 현재 문서 보호막 1회만 사용한다.
// reload 호출 전까지만 짧게 잡아 보호막 장기 잔류와 이중 표시를 줄인다.
var OAI_REFRESH_PRE_NAV_HOLD_MS = 2500;

function markExternalReturnStabilize(kind){
  // 외부 사이트로 나가기 직전부터, 다시 돌아온 직후까지 화면 재배치가 보이지 않게 표시한다.
  // 뒤로가기/history 상태는 건드리지 않고 시각 안정화 상태만 기록한다.
  try{
    var now = Date.now ? Date.now() : new Date().getTime();
    var stamp = String(now);
    sessionStorage.setItem('oai_external_nav_started_at', stamp);
    sessionStorage.setItem('oai_external_nav_kind', kind || 'external');
    sessionStorage.setItem('oai_external_nav_pending', '1');
    sessionStorage.setItem('oai_external_nav_hold_until', String(now + OAI_EXTERNAL_LEAVE_HOLD_MS));
    sessionStorage.setItem('oai_external_nav_force_release_at', String(now + OAI_EXTERNAL_LEAVE_HARD_MS));
    document.documentElement.classList.add('oai-external-leaving');
    if(typeof oaiHoldStabilityVeil === 'function') oaiHoldStabilityVeil('external-leave', OAI_EXTERNAL_LEAVE_HOLD_MS);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function oaiIsRefreshVeilReason(reason){
  return /refresh|reload|background/i.test(String(reason || ''));
}
function oaiRefreshVeilVisibleUntil(){
  try{
    var stored = parseInt(sessionStorage.getItem('oai_refresh_veil_visible_until') || '0', 10) || 0;
    var local = parseInt(window.__oaiRefreshVeilLocalVisibleUntil || '0', 10) || 0;
    return Math.max(stored, local);
  }catch(_e){ return parseInt(window.__oaiRefreshVeilLocalVisibleUntil || '0', 10) || 0; }
}
function oaiReleaseStabilityVeil(){
  try{
    var root = document.documentElement;
    var reason = root.getAttribute('data-oai-stability-reason') || '';
    if(oaiIsRefreshVeilReason(reason)){
      var minUntil = oaiRefreshVeilVisibleUntil();
      var now = Date.now ? Date.now() : new Date().getTime();
      if(minUntil && now < minUntil){
        clearTimeout(window.__oaiStabilityVeilTimer);
        window.__oaiStabilityVeilTimer = setTimeout(oaiReleaseStabilityVeil, Math.max(80, Math.min(900, minUntil - now)));
        return;
      }
    }
    if(reason === 'external-leave'){
      var pending = false, pageHidden = false, forceAt = 0;
      try{
        pending = sessionStorage.getItem('oai_external_nav_pending') === '1';
        pageHidden = sessionStorage.getItem('oai_external_nav_pagehide') === '1' || document.visibilityState === 'hidden';
        forceAt = parseInt(sessionStorage.getItem('oai_external_nav_force_release_at') || '0', 10) || 0;
      }catch(_e){}
      // V3-S: 외부사이트가 실제로 열려 앱이 hidden/pagehide 상태가 된 경우에는
      // 보호창을 현재 문서에서 지우지 않는다. 사용자가 돌아온 뒤 external-return 안정화가 해제한다.
      if(pending && pageHidden){
        clearTimeout(window.__oaiStabilityVeilTimer);
        window.__oaiStabilityVeilTimer = setTimeout(oaiReleaseStabilityVeil, 900);
        return;
      }
      // 외부페이지가 느리게 열리는 동안 앱이 아직 화면에 보이면 보호창을 유지한다.
      // 너무 오래 남는 것을 막기 위해 6초 안전 해제만 둔다.
      if(pending && !pageHidden && forceAt && Date.now && Date.now() < forceAt){
        clearTimeout(window.__oaiStabilityVeilTimer);
        window.__oaiStabilityVeilTimer = setTimeout(oaiReleaseStabilityVeil, Math.min(900, Math.max(120, forceAt - Date.now())));
        return;
      }
      if(pending && !pageHidden && forceAt && Date.now && Date.now() >= forceAt){
        // 외부 앱/사이트 호출이 막혔거나 너무 오래 지연된 경우에는 사용자가 앱을 계속 쓸 수 있게 보호창만 해제한다.
        try{
          sessionStorage.removeItem('oai_external_nav_pending');
          sessionStorage.removeItem('oai_external_nav_hold_until');
          sessionStorage.removeItem('oai_external_nav_force_release_at');
        }catch(_e){}
      }
    }
    clearTimeout(window.__oaiStabilityVeilTimer);
    if(root.classList.contains('oai-stability-veil') && !root.classList.contains('oai-stability-veil-releasing')){
      root.classList.add('oai-stability-veil-releasing');
      setTimeout(function(){
        try{
          root.classList.remove('oai-stability-veil','oai-external-return-freeze','oai-external-leaving','oai-stability-veil-releasing');
          root.removeAttribute('data-oai-stability-reason');
          try{ sessionStorage.removeItem('oai_refresh_veil_visible_until'); window.__oaiRefreshVeilLocalVisibleUntil = 0; }catch(_e){}
        }catch(_e){}
      }, 180);
    }else{
      root.classList.remove('oai-stability-veil','oai-external-return-freeze','oai-external-leaving','oai-stability-veil-releasing');
      root.removeAttribute('data-oai-stability-reason');
      try{ sessionStorage.removeItem('oai_refresh_veil_visible_until'); window.__oaiRefreshVeilLocalVisibleUntil = 0; }catch(_e){}
    }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function oaiHoldStabilityVeil(reason, duration){
  try{
    var root = document.documentElement;
    var d = duration || 420;
    root.classList.remove('oai-stability-veil-releasing');
    root.classList.add('oai-stability-veil');
    root.setAttribute('data-oai-stability-reason', reason || 'stabilize');
    clearTimeout(window.__oaiStabilityVeilTimer);
    window.__oaiStabilityVeilTimer = setTimeout(oaiReleaseStabilityVeil, d);
    // 외부 사이트 복귀/iframe 복원 타이밍이 어긋나도 덮개가 남지 않도록 최대 수명 안전망을 한 번 더 둔다.
    clearTimeout(window.__oaiStabilityVeilHardTimer);
    var hard = (reason === 'external-leave') ? OAI_EXTERNAL_LEAVE_HARD_MS : Math.max(d + 650, 2200);
    window.__oaiStabilityVeilHardTimer = setTimeout(oaiReleaseStabilityVeil, hard);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
window.oaiHoldStabilityVeil = oaiHoldStabilityVeil;
window.oaiReleaseStabilityVeil = oaiReleaseStabilityVeil;

function oaiMarkRefreshHistoryCompact(reason){
  try{
    var now = Date.now ? Date.now() : new Date().getTime();
    sessionStorage.setItem('oai_refresh_history_compact_until', String(now + 10 * 60 * 1000));
    sessionStorage.setItem('oai_refresh_history_compact_reason', reason || 'refresh');
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function oaiPrepareRefreshVeil(reason, duration, carryDuration, showBeforeNavigation, beforeNavigationHold, carryToNextDocument){
  try{
    var d = Math.max(260, duration || OAI_REFRESH_VEIL_MS);
    var carry = Math.max(d + 1200, carryDuration || OAI_REFRESH_CARRY_MS || d);
    var now = Date.now ? Date.now() : new Date().getTime();
    /*
       V3-S: 수동 짧은/긴 새로고침은 OK 직후 현재 문서 보호막을 먼저 보여 주되,
       새 문서 첫 페인트 보호막을 다시 예약하지 않는다.
       두 문서가 각각 1번씩 보호창을 켜서 '두 번 열림'처럼 보이던 흐름을 끊는다.
       자동/백그라운드 reload처럼 현재 문서에서 먼저 보여 줄 수 없는 경우만 carryToNextDocument 기본값(true)을 사용한다.
    */
    var carryToNext = (carryToNextDocument !== false);
    if(carryToNext){
      sessionStorage.setItem('oai_refresh_veil_until', String(now + carry));
      sessionStorage.setItem('oai_refresh_veil_hold_ms', String(d));
      sessionStorage.removeItem('oai_refresh_veil_visible_until');
      sessionStorage.setItem('oai_refresh_veil_reason', reason || 'refresh');
    }else{
      sessionStorage.removeItem('oai_refresh_veil_until');
      sessionStorage.removeItem('oai_refresh_veil_hold_ms');
      sessionStorage.removeItem('oai_refresh_veil_reason');
      sessionStorage.removeItem('oai_refresh_veil_visible_until');
    }
    oaiMarkRefreshHistoryCompact(reason || 'refresh');
    if(showBeforeNavigation === true){
      var preHold = Math.max(d, beforeNavigationHold || d);
      window.__oaiRefreshVeilLocalVisibleUntil = now + d;
      if(carryToNext) sessionStorage.setItem('oai_refresh_veil_visible_until', String(now + d));
      oaiHoldStabilityVeil(reason || 'refresh', preHold);
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}

function oaiAfterRefreshVeilPaint(callback){
  // OK 직후 보호창이 실제로 한 번 그려진 다음 새로고침/캐시 작업을 시작한다.
  try{
    var run=function(){ setTimeout(function(){ try{ callback(); }catch(e){ console.warn('[가톨릭길동무]', e); } }, 90); };
    if(window.requestAnimationFrame){ requestAnimationFrame(function(){ requestAnimationFrame(run); }); }
    else setTimeout(run, 32);
  }catch(e){ try{ callback(); }catch(_e){} }
}
function oaiApplyPendingRefreshVeil(){
  try{
    var root = document.documentElement;
    var now = Date.now ? Date.now() : new Date().getTime();
    var until = parseInt(sessionStorage.getItem('oai_refresh_veil_until') || '0', 10) || 0;
    var holdMs = parseInt(sessionStorage.getItem('oai_refresh_veil_hold_ms') || '0', 10) || 0;
    var reason = sessionStorage.getItem('oai_refresh_veil_reason') || 'refresh-return';
    if(until > now){
      var showFor = Math.max(260, holdMs || Math.min(1200, Math.max(260, until - now)));
      var visibleUntil = parseInt(sessionStorage.getItem('oai_refresh_veil_visible_until') || '0', 10) || 0;
      // early script가 이미 보호막을 켰더라도 app.js가 실제로 붙은 뒤부터 최소 1초를 보장한다.
      // 그래야 긴 새로고침처럼 리소스 로딩이 느린 경우에도 보호창이 1초보다 짧게 느껴지지 않는다.
      var minVisibleUntil = now + showFor;
      if(!visibleUntil || visibleUntil < minVisibleUntil) visibleUntil = minVisibleUntil;
      try{ sessionStorage.setItem('oai_refresh_veil_visible_until', String(visibleUntil)); }catch(_e){}

      if(root.classList.contains('oai-stability-veil') && oaiIsRefreshVeilReason(root.getAttribute('data-oai-stability-reason') || reason)){
        root.classList.remove('oai-stability-veil-releasing');
        root.setAttribute('data-oai-stability-reason', reason || 'refresh-return');
        root.removeAttribute('data-oai-refresh-early-veil');
        clearTimeout(window.__oaiStabilityVeilTimer);
        window.__oaiStabilityVeilTimer = setTimeout(oaiReleaseStabilityVeil, Math.max(0, visibleUntil - now));
        clearTimeout(window.__oaiStabilityVeilHardTimer);
        window.__oaiStabilityVeilHardTimer = setTimeout(oaiReleaseStabilityVeil, Math.max(1600, visibleUntil - now + 900));
      }else{
        try{ sessionStorage.setItem('oai_refresh_veil_visible_until', String(now + showFor)); }catch(_e){}
        oaiHoldStabilityVeil(reason || 'refresh-return', showFor);
      }
      setTimeout(function(){
        try{
          sessionStorage.removeItem('oai_refresh_veil_until');
          sessionStorage.removeItem('oai_refresh_veil_hold_ms');
          sessionStorage.removeItem('oai_refresh_veil_reason');
        }catch(_e){}
      }, Math.max(300, Math.max(visibleUntil - now, showFor) + 320));
    }else if(until){
      sessionStorage.removeItem('oai_refresh_veil_until');
      sessionStorage.removeItem('oai_refresh_veil_hold_ms');
      sessionStorage.removeItem('oai_refresh_veil_reason');
      sessionStorage.removeItem('oai_refresh_veil_visible_until');
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
window.oaiPrepareRefreshVeil = oaiPrepareRefreshVeil;
window.oaiMarkRefreshHistoryCompact = oaiMarkRefreshHistoryCompact;
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', oaiApplyPendingRefreshVeil, {once:true});
else oaiApplyPendingRefreshVeil();

function oaiClearExternalNavigationState(opts){
  // 이전 버전에서 남았을 수 있는 외부 이동 상태를 정리한다.
  // opts.keepVeil=true이면 복귀 안정막은 공통 해제 함수가 부드럽게 제거하도록 남겨둔다.
  opts = opts || {};
  try{
    var html = document.documentElement;
    html.classList.remove('oai-navigating-out','oai-external-return-prepaint','oai-external-return-stabilize','oai-missa-return-stabilize','oai-external-leaving');
    html.removeAttribute('data-oai-external-return-early');
    if(!opts.keepVeil){
      html.classList.remove('oai-external-return-freeze');
      var reason = html.getAttribute('data-oai-stability-reason') || '';
      if(!oaiIsRefreshVeilReason(reason)){
        html.classList.remove('oai-stability-veil','oai-stability-veil-releasing');
        html.removeAttribute('data-oai-stability-reason');
      }
    }
    sessionStorage.removeItem('oai_external_nav_started_at');
    sessionStorage.removeItem('oai_external_nav_pagehide');
    sessionStorage.removeItem('oai_external_nav_kind');
    sessionStorage.removeItem('oai_external_nav_pending');
    sessionStorage.removeItem('oai_external_nav_hold_until');
    sessionStorage.removeItem('oai_external_nav_force_release_at');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{
    var v = document.getElementById('oai-nav-veil');
    if(v && v.parentNode) v.parentNode.removeChild(v);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function oaiSmoothNavigate(url, kind){
  // 모든 외부 http(s) 이동은 웹사이트 카테고리와 같은 경로로 통일한다.
  // 1) URL 보정  2) 외부 이동 상태 기록  3) 보호창 유지  4) 같은 탭 이동
  if(!url) return;
  try{
    if(typeof normalizeCatholicExternalUrl === 'function') url = normalizeCatholicExternalUrl(url);
    else url = String(url || '').trim();
  }catch(_e){ url = String(url || '').trim(); }
  if(!url) return;
  try{ document.activeElement && document.activeElement.blur && document.activeElement.blur(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ markExternalReturnStabilize(kind || 'external'); }catch(e){ console.warn("[가톨릭길동무]", e); }
  setTimeout(function(){
    try{ location.assign(url); }catch(e){ try{ location.href = url; }catch(_){ } }
  }, 70);
}

function oaiMeasureExternalViewport(){
  try{
    var vv = window.visualViewport || null;
    return [
      Math.round(window.innerWidth || 0),
      Math.round(window.innerHeight || 0),
      Math.round(vv && vv.height ? vv.height : 0),
      Math.round(vv && vv.offsetTop ? vv.offsetTop : 0),
      Math.round(window.scrollY || document.documentElement.scrollTop || 0)
    ].join('|');
  }catch(_e){ return '0'; }
}
function oaiReleasePassiveVeil(){
  try{
    var reason = document.documentElement.getAttribute('data-oai-stability-reason') || '';
    if(/external-leave|external-return/i.test(reason)) return;
    oaiReleaseStabilityVeil();
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function oaiGetExternalNavInfo(){
  try{
    var now = Date.now ? Date.now() : new Date().getTime();
    var ts = parseInt(sessionStorage.getItem('oai_external_nav_started_at') || '0', 10) || 0;
    var pending = sessionStorage.getItem('oai_external_nav_pending') === '1';
    var pageHidden = sessionStorage.getItem('oai_external_nav_pagehide') === '1';
    var forceAt = parseInt(sessionStorage.getItem('oai_external_nav_force_release_at') || '0', 10) || 0;
    return {now:now, ts:ts, pending:pending, pageHidden:pageHidden, forceAt:forceAt};
  }catch(_e){ return {now:0, ts:0, pending:false, pageHidden:false, forceAt:0}; }
}
function oaiHasExternalReturnPending(){
  try{
    var info = oaiGetExternalNavInfo();
    // V3-S: 실제로 앱이 hidden/pagehide 된 적이 있을 때만 "외부사이트에서 복귀"로 본다.
    // 단순 클릭 실패/미열림 상태까지 external-return 안정화로 처리하면 뒤로올 때 버벅임이 생긴다.
    return !!(info.ts && info.pageHidden && info.now && info.now - info.ts < 10 * 60 * 1000);
  }catch(_e){ return false; }
}
function oaiIsExternalLeaveStillOpening(){
  try{
    var info = oaiGetExternalNavInfo();
    return !!(info.pending && !info.pageHidden && info.forceAt && info.now && info.now < info.forceAt);
  }catch(_e){ return false; }
}
function oaiStartExternalReturnStabilize(){
  try{
    var root = document.documentElement;
    if(window.__oaiExternalReturnStabilizing) return true;
    window.__oaiExternalReturnStabilizing = true;
    root.classList.remove('oai-stability-veil-releasing');
    root.classList.add('oai-external-return-freeze');
    root.removeAttribute('data-oai-external-return-early');
    oaiHoldStabilityVeil('external-return', OAI_EXTERNAL_RETURN_MAX_MS);

    var started = Date.now ? Date.now() : new Date().getTime();
    var minUntil = started + OAI_EXTERNAL_RETURN_MIN_MS;
    var maxUntil = started + OAI_EXTERNAL_RETURN_MAX_MS;
    var last = oaiMeasureExternalViewport();
    var stableCount = 0;
    clearInterval(window.__oaiExternalReturnStableTimer);

    function finish(){
      try{
        clearInterval(window.__oaiExternalReturnStableTimer);
        window.__oaiExternalReturnStabilizing = false;
        oaiClearExternalNavigationState({keepVeil:true});
        oaiReleaseStabilityVeil();
      }catch(e){ console.warn('[가톨릭길동무]', e); }
    }
    window.__oaiExternalReturnStableTimer = setInterval(function(){
      try{
        var now = Date.now ? Date.now() : new Date().getTime();
        var cur = oaiMeasureExternalViewport();
        if(cur === last) stableCount++;
        else { stableCount = 0; last = cur; }
        if(now >= minUntil && stableCount >= OAI_EXTERNAL_RETURN_STABLE_TICKS){ finish(); return; }
        if(now >= maxUntil){ finish(); return; }
      }catch(e){ console.warn('[가톨릭길동무]', e); finish(); }
    }, 120);
    setTimeout(function(){
      try{ if(window.__oaiExternalReturnStabilizing) finish(); }catch(_e){}
    }, OAI_EXTERNAL_RETURN_MAX_MS + 260);
    return true;
  }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
}
function applyExternalReturnStabilize(){
  // 외부 사이트에서 돌아온 직후에는 공통 안정막을 유지한 뒤, 화면 높이/스크롤이 안정된 후에만 해제한다.
  // V3-S: 실제 pagehide/hidden이 확인되지 않은 "열기 시도 중" 상태는 복귀로 오판하지 않는다.
  try{
    if(oaiHasExternalReturnPending()){
      oaiStartExternalReturnStabilize();
      return;
    }
    if(oaiIsExternalLeaveStillOpening()){
      // 외부 페이지가 아직 열리는 중이면 보호창/상태를 유지한다.
      // 너무 오래 열리지 않으면 oaiReleaseStabilityVeil의 hard timer가 정리한다.
      return;
    }
    oaiClearExternalNavigationState();
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
window.addEventListener('pageshow', applyExternalReturnStabilize, true);
window.addEventListener('pageshow', function(){ setTimeout(oaiReleasePassiveVeil, 2600); }, true);
window.addEventListener('focus', function(){ setTimeout(applyExternalReturnStabilize, 40); setTimeout(oaiReleasePassiveVeil, 2600); }, true);
window.addEventListener('pagehide', function(){
  try{ if(sessionStorage.getItem('oai_external_nav_pending') === '1') sessionStorage.setItem('oai_external_nav_pagehide','1'); }catch(e){ console.warn("[가톨릭길동무]", e); }
}, true);
document.addEventListener('visibilitychange', function(){
  try{
    if(document.visibilityState === 'hidden' && sessionStorage.getItem('oai_external_nav_pending') === '1') sessionStorage.setItem('oai_external_nav_pagehide','1');
    if(document.visibilityState === 'visible') setTimeout(applyExternalReturnStabilize, 60);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}, true);

// 모든 앱 내부 링크 중 외부 http(s) 이동은 한 곳에서 안정화한다.
// tel/mail/local/hash/동일 출처 이동은 제외하고, 기존 onclick이 있는 버튼성 링크는 그 로직을 우선한다.
document.addEventListener('click', function(e){
  try{
    if(e.defaultPrevented) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if(!a) return;
    if(a.hasAttribute('download')) return;
    var raw = a.getAttribute('href') || '';
    if(!raw || raw.charAt(0)==='#' || /^(tel:|mailto:|sms:|javascript:)/i.test(raw)) return;
    var u = new URL(raw, location.href);
    if(u.origin === location.origin) return;
    if(typeof a.onclick === 'function') return;
    e.preventDefault();
    e.stopPropagation();
    oaiSmoothNavigate(u.toString(), 'anchor-external');
  }catch(err){ console.warn('[가톨릭길동무]', err); }
}, true);


function oaiSetMainMapLayerHidden(hidden){
  try{
    document.documentElement.classList.toggle('oai-hide-main-map-layer', !!hidden);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
window.oaiSetMainMapLayerHidden = oaiSetMainMapLayerHidden;

/* ── 뒤로가기 처리는 patches.js의 공통 컨트롤러에서 통합 관리 ── */

/* 기존 pull-to-refresh 핸들러는 아래의 최종 새로고침 핸들러로 통합 관리 */


/* ═══════════════════════════════════════════════
   §2. 미사 / 빠른메뉴 / 기도문 / 성가
   ═══════════════════════════════════════════════ */
function openMissa(){
  const today=new Date();
  const yyyy=today.getFullYear();
  const mm=String(today.getMonth()+1).padStart(2,'0');
  const dd=String(today.getDate()).padStart(2,'0');
  const url='https://missa.cbck.or.kr/DailyMissa/'+yyyy+mm+dd;
  try{ localStorage.setItem('oai_last_missa_url', url); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ if(typeof _resetCoverExitReady==='function') _resetCoverExitReady(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ if(typeof _clearCoverExitArmed==='function') _clearCoverExitArmed(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  /* 외부 브라우저로 이동 — 화면 전환 안정화 후 location.href 방식 유지 */
  oaiSmoothNavigate(url, 'missa');
}

function _setMassQuickReturn(on){
  // 매일미사·성가처럼 앱 밖으로 나가는 외부 사이트 복귀 상태만 관리한다.
  // 주요기도문은 내부 화면이므로 아래 _setPrayerQuickReturn()으로 분리한다.
  try{
    window.__MASS_QUICK_RETURN__ = !!on;
    if(on){
      var stamp = String(Date.now());
      sessionStorage.setItem('oai_mass_quick_return','1');
      sessionStorage.setItem('oai_mass_quick_return_ts', stamp);
      localStorage.setItem('oai_mass_quick_return','1');
      localStorage.setItem('oai_mass_quick_return_ts', stamp);
    }else{
      sessionStorage.removeItem('oai_mass_quick_return');
      sessionStorage.removeItem('oai_mass_quick_return_ts');
      localStorage.removeItem('oai_mass_quick_return');
      localStorage.removeItem('oai_mass_quick_return_ts');
    }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _setPrayerQuickReturn(on){
  // 빠른메뉴 → 주요기도문은 내부 카테고리 이동이다.
  // 매일미사·성가의 외부 복귀값과 분리하고, 본문을 다녀와도 목록 → 팝업 흐름이 유지되도록
  // 전용 잠금값을 함께 둔다. 이 값은 팝업에서 커버로 돌아갈 때만 지운다.
  try{
    window.__MASS_QUICK_FROM_PRAYER__ = !!on;
    window.__OAI_PRAYER_FROM_QUICK_LOCK__ = !!on;
    if(on){
      var stamp = String(Date.now());
      sessionStorage.setItem('oai_prayer_quick_return','1');
      sessionStorage.setItem('oai_prayer_quick_return_ts', stamp);
      sessionStorage.setItem('oai_prayer_from_quick_lock','1');
    }else{
      sessionStorage.removeItem('oai_prayer_quick_return');
      sessionStorage.removeItem('oai_prayer_quick_return_ts');
      sessionStorage.removeItem('oai_prayer_from_quick_lock');
    }
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _clearPrayerQuickReturn(){ _setPrayerQuickReturn(false); }
function _isFreshMassQuickReturnStore(store){
  try{
    if(!store || store.getItem('oai_mass_quick_return') !== '1') return false;
    var ts = parseInt(store.getItem('oai_mass_quick_return_ts') || '0', 10) || 0;
    if(!ts) return true;
    return Date.now() - ts < 5 * 60 * 1000;
  }catch(e){ return false; }
}
function _isFreshPrayerQuickReturn(){
  try{
    if(sessionStorage.getItem('oai_prayer_quick_return') !== '1') return false;
    var ts = parseInt(sessionStorage.getItem('oai_prayer_quick_return_ts') || '0', 10) || 0;
    if(!ts) return true;
    return Date.now() - ts < 30 * 60 * 1000;
  }catch(e){ return false; }
}
function _shouldMassQuickReturn(){
  try{
    return window.__MASS_QUICK_RETURN__ === true ||
      _isFreshMassQuickReturnStore(sessionStorage) ||
      _isFreshMassQuickReturnStore(localStorage);
  }catch(e){ console.warn("[가톨릭길동무]", e); return window.__MASS_QUICK_RETURN__ === true; }
}
function _shouldPrayerQuickReturn(){
  try{
    return window.__MASS_QUICK_FROM_PRAYER__ === true ||
      window.__OAI_PRAYER_FROM_QUICK_LOCK__ === true ||
      sessionStorage.getItem('oai_prayer_from_quick_lock') === '1' ||
      _isFreshPrayerQuickReturn();
  }catch(e){ console.warn("[가톨릭길동무]", e); return window.__MASS_QUICK_FROM_PRAYER__ === true || window.__OAI_PRAYER_FROM_QUICK_LOCK__ === true; }
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
    sessionStorage.removeItem('oai_mass_quick_return');
    sessionStorage.removeItem('oai_mass_quick_return_ts');
    localStorage.removeItem('oai_mass_quick_return');
    localStorage.removeItem('oai_mass_quick_return_ts');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
if(_isPageReloadNavigation()){
  _clearMassQuickReturnForReload();
  _clearPrayerQuickReturn();
}
/* ── core.js로 이동: _resetCoverExitReady ~ _resetAppBackTrap ── */

function _armMassQuickHistoryTrap(opts){
  try{
    var href = location.href.split('#')[0];
    if(opts && opts.skip){
      // 주요기도문에서 빠른메뉴 팝업으로 되돌아온 경우에는 새 mq history state를 만들지 않는다.
      // 이 팝업은 이미 커버 위에 떠 있어야 하며, 다음 Back은 기존 [root(0) → trap(1)] 구조에서
      // 팝업만 닫고 커버를 확정하면 된다. 여기서 다시 oai_mass_quick state를 만들면
      // history.go(1) 복원 타이밍과 충돌해 팝업 → 커버 단계가 앱 종료로 오판될 수 있다.
      return;
    }
    history.pushState({_p:1, oai_mass_quick:1}, '', href);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _hideMassQuickMenuOnly(afterHidden, opts){
  const modal=document.getElementById('mass-quick-modal');
  var deferHideUntilAfter = !!(opts && opts.deferHideUntilAfter);
  _resetCoverExitReady();
  _clearCoverExitArmed();

  function hideQuickModal(){
    if(modal){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
    }
  }

  // 주요기도문으로 들어갈 때는 팝업을 먼저 숨기면 커버가 잠깐 드러나며 화면이 흔들린다.
  // 기도문 화면을 먼저 띄운 뒤 팝업을 한 프레임 늦게 숨겨, 전환 중 커버 노출을 막는다.
  if(!deferHideUntilAfter) hideQuickModal();

  function done(){
    try{
      if(typeof afterHidden === 'function') afterHidden();
    }catch(e){ console.warn('[가톨릭길동무]', e); }
    finally{
      if(deferHideUntilAfter){
        if(window.requestAnimationFrame) requestAnimationFrame(hideQuickModal);
        else setTimeout(hideQuickModal, 0);
      }
    }
  }

  /* 빠른메뉴 팝업에서 주요기도문으로 들어갈 때는 팝업용 history state를
     replaceState로 바꾸지 말고 실제로 한 칸 pop한다.
     스택에 oai_mass_quick 항목이 남아 있으면 기도문 뒤로가기 복원의 history.go(1)이
     그 항목으로 다시 이동해 popstate가 한 번 더 발생하고, 팝업에서 커버로 가지 못한 채
     앱 종료 흐름으로 오판될 수 있다. */
  try{
    var st = history.state;
    if(st && st.oai_mass_quick){
      window.__OAI_MQ_STATE_POPPING__ = Date.now() + 1200;
      window.__OAI_AFTER_MQ_STATE_POP__ = done;
      history.back();
      setTimeout(function(){
        try{
          if(window.__OAI_AFTER_MQ_STATE_POP__ === done){
            window.__OAI_MQ_STATE_POPPING__ = 0;
            window.__OAI_AFTER_MQ_STATE_POP__ = null;
            done();
          }
        }catch(e){ console.warn('[가톨릭길동무]', e); }
      }, 220);
      return true;
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }

  if(typeof afterHidden === 'function'){
    if(window.requestAnimationFrame) requestAnimationFrame(done);
    else setTimeout(done, 0);
  }
  return false;
}
function _isCoverAlreadyVisibleForQuickMenu(){
  try{
    var cover=document.getElementById('cover');
    return !!(cover && !document.documentElement.classList.contains('app-active') && getComputedStyle(cover).display !== 'none');
  }catch(e){ return false; }
}
function _setPrayerPopupReturnSource(on){
  // 주요기도문에서 빠른메뉴 팝업으로 되돌아온 상태를 따로 표시한다.
  // 이 표시는 팝업을 닫을 때 반드시 커버 상태와 커버용 back trap을 다시 맞추기 위한 것이다.
  try{
    window.__MASS_QUICK_POPUP_FROM_PRAYER__ = !!on;
    if(on) sessionStorage.setItem('oai_mass_quick_popup_from_prayer','1');
    else sessionStorage.removeItem('oai_mass_quick_popup_from_prayer');
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _isPrayerPopupReturnSource(){
  try{
    return window.__MASS_QUICK_POPUP_FROM_PRAYER__ === true ||
      sessionStorage.getItem('oai_mass_quick_popup_from_prayer') === '1';
  }catch(e){ return window.__MASS_QUICK_POPUP_FROM_PRAYER__ === true; }
}

function _markPrayerCoverNeedsFirstToast(on){
  try{
    window.__OAI_PRAYER_COVER_NEEDS_FIRST_TOAST__ = !!on;
    if(on) sessionStorage.setItem('oai_prayer_cover_needs_first_toast','1');
    else sessionStorage.removeItem('oai_prayer_cover_needs_first_toast');
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _consumePrayerCoverNeedsFirstToast(){
  try{
    var on = window.__OAI_PRAYER_COVER_NEEDS_FIRST_TOAST__ === true ||
      sessionStorage.getItem('oai_prayer_cover_needs_first_toast') === '1';
    if(on) _markPrayerCoverNeedsFirstToast(false);
    return !!on;
  }catch(e){ return window.__OAI_PRAYER_COVER_NEEDS_FIRST_TOAST__ === true; }
}
function _forceCoverAfterPrayerQuickPopup(){
  // 주요기도문에서 돌아온 빠른메뉴 팝업을 닫는 순간에는 결과가 반드시 커버여야 한다.
  // popstate 중간의 현재 history 위치에 의존하지 않고, 커버 DOM 확정 뒤 다음 프레임까지
  // 커버용 [root(0) → trap(1)] 구조를 다시 세워 커버 첫 Back이 앱 종료로 빠지지 않게 한다.
  try{
    var modal=document.getElementById('mass-quick-modal');
    if(modal){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden','true');
      try{ delete modal.dataset.returnSource; }catch(_e){}
    }
    var pv=document.getElementById('prayer-view');
    var pd=document.getElementById('prayer-detail');
    if(pd) pd.classList.remove('show');
    if(pv){
      pv.classList.remove('open');
      try{ delete pv.dataset.quickSource; }catch(_e){}
    }
    document.querySelectorAll('.module-view.open,#diocese-view.open,#missa-view.open').forEach(function(v){ v.classList.remove('open'); });
    document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
    if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
    var cv=document.getElementById('cover');
    if(cv){
      cv.style.display='';
      cv.style.opacity='';
      cv.style.pointerEvents='';
      cv.scrollTop=0;
    }
    _setPrayerPopupReturnSource(false);
    _setMassQuickReturn(false);
    _clearPrayerQuickReturn();
    _resetCoverExitReady();
    _clearCoverExitArmed();
    _markPrayerCoverNeedsFirstToast(false);
    try{
      window.__OAI_PRAYER_POPUP_COVER_GUARD_UNTIL__ = 0;
      window.__OAI_PRAYER_COVER_FORCE_FIRST_TOAST_UNTIL__ = Date.now() + 10000;
    }catch(_e){}
    function prime(reason){
      try{
        if(document.documentElement.classList.contains('app-active')) return;
        var mq=document.getElementById('mass-quick-modal');
        if(mq && mq.classList.contains('show')) return;
        _resetCoverExitReady();
        _clearCoverExitArmed();
        if(typeof _resetCoverBackTrap === 'function') _resetCoverBackTrap(reason);
        else _ensureCoverBackTrap();
      }catch(_e){}
    }
    prime('prayer-popup-cover');
    if(window.requestAnimationFrame) requestAnimationFrame(function(){ prime('prayer-popup-cover-raf'); });
    setTimeout(function(){ prime('prayer-popup-cover-settle-80'); }, 80);
    setTimeout(function(){ prime('prayer-popup-cover-settle-220'); }, 220);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _openPrayerReturnQuickMenuStable(){
  // 주요기도문 목록에서 빠른메뉴 팝업으로 되돌아올 때의 화면 흔들림 방지.
  // goToCover()를 다시 타면 지도/시트 정리와 커버 표시가 먼저 일어나 잠깐 흔들린 뒤 팝업이 뜬다.
  // 기도문 전용 복귀에서는 무거운 카테고리 정리를 하지 않고, 기도문 뷰 닫기+커버 표시+팝업 표시를 한 프레임에 묶는다.
  try{
    var modal=document.getElementById('mass-quick-modal');
    var cv=document.getElementById('cover');
    var pv=document.getElementById('prayer-view');
    var pd=document.getElementById('prayer-detail');
    if(pd) pd.classList.remove('show');
    if(pv){
      pv.classList.remove('open');
      try{ delete pv.dataset.quickSource; }catch(_e){}
    }
    document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
    if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
    if(cv){
      cv.style.display='';
      cv.style.opacity='';
      cv.style.pointerEvents='';
      cv.scrollTop=0;
    }
    _resetCoverExitReady();
    _clearCoverExitArmed();
    _setPrayerPopupReturnSource(true);
    _setMassQuickReturn(false);
    _clearPrayerQuickReturn();
    if(modal){
      try{ modal.dataset.returnSource='prayer'; }catch(_e){}
    }
    try{ if(typeof _ensureCoverBackTrap === 'function') _ensureCoverBackTrap('prayer-return-popup'); }catch(_e){}
    openMassQuickMenu({keepReturn:true, fromPrayerReturn:true});
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _schedulePrayerReturnQuickMenuStable(){
  var called=false;
  function run(){
    if(called) return;
    called=true;
    try{
      window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__ = null;
      window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP_UNTIL__ = 0;
    }catch(_e){}
    if(window.requestAnimationFrame) requestAnimationFrame(_openPrayerReturnQuickMenuStable);
    else setTimeout(_openPrayerReturnQuickMenuStable, 0);
  }
  try{
    window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__ = run;
    window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP_UNTIL__ = Date.now() + 1800;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  // 일부 WebView에서 history.go(1) 복귀 popstate가 늦거나 생략될 수 있어 안전망만 둔다.
  // 정상 경로에서는 patches.js의 _restoring 해제 지점에서 즉시 실행된다.
  setTimeout(function(){
    try{
      if(window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__ === run) run();
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }, 90);
}
function _returnToMassQuickMenu(source){
  var fromPrayer = source === 'prayer' || (source && source.fromPrayer);
  // 외부 사이트 복귀(매일미사·성가)는 기존 흐름을 유지한다.
  // 주요기도문은 내부 화면이므로, history.go(1) 복원이 끝난 직후 한 프레임에서
  // 기도문 닫기+커버 표시+빠른메뉴 팝업 표시를 동시에 처리해 복귀 흔들림을 줄인다.
  if(fromPrayer){
    try{ _setPrayerPopupReturnSource(true); }catch(e){ console.warn('[가톨릭길동무]', e); }
    _resetCoverExitReady();
    _clearCoverExitArmed();
    _clearMassQuickReturnForReload();
    _clearPrayerQuickReturn();
    _schedulePrayerReturnQuickMenuStable();
    return;
  }
  if(!_isCoverAlreadyVisibleForQuickMenu() && typeof goToCover==='function'){
    goToCover();
  }
  _resetCoverExitReady();
  _clearCoverExitArmed();
  _clearMassQuickReturnForReload();
  _clearPrayerQuickReturn();
  var open = function(){
    try{ openMassQuickMenu({keepReturn:true}); }
    catch(e){ console.warn('[가톨릭길동무]', e); }
  };
  if(window.requestAnimationFrame) requestAnimationFrame(open);
  else setTimeout(open, 0);
}
function openMassQuickMenu(opts){
  const modal=document.getElementById('mass-quick-modal');
  if(!modal) return;
  if(opts && opts.fromPrayerReturn) _setPrayerPopupReturnSource(true);
  else if(!(opts && opts.keepReturn)) _setPrayerPopupReturnSource(false);
  try{
    if(opts && opts.fromPrayerReturn) modal.dataset.returnSource = 'prayer';
    else if(!(opts && opts.keepReturn)) delete modal.dataset.returnSource;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  if(!(opts && opts.keepReturn)) _setMassQuickReturn(false);
  _resetCoverExitReady();
  _clearCoverExitArmed();
  _armMassQuickHistoryTrap(opts && opts.fromPrayerReturn ? {reason:'prayer-return', skip:true} : null);
  modal.classList.add('show');
  modal.setAttribute('aria-hidden','false');
  try{ if(typeof oaiEnterPopup === 'function') oaiEnterPopup(modal); }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function closeMassQuickMenu(opts){
  const modal=document.getElementById('mass-quick-modal');
  var fromPrayerReturn = _isPrayerPopupReturnSource();
  try{ if(modal && modal.dataset && modal.dataset.returnSource === 'prayer') fromPrayerReturn = true; }catch(e){ console.warn('[가톨릭길동무]', e); }
  _setMassQuickReturn(false);
  _clearPrayerQuickReturn();
  _resetCoverExitReady();
  _clearCoverExitArmed();
  if(modal){
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden','true');
    try{ delete modal.dataset.returnSource; }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  if(fromPrayerReturn){
    _forceCoverAfterPrayerQuickPopup();
    return;
  }
  _ensureCoverBackTrap();
}
function openCatholicHymn(){
  const url='https://maria.catholic.or.kr/mobile/sungga/sungga.asp';
  try{ localStorage.setItem('oai_last_hymn_url', url); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ if(typeof _resetCoverExitReady==='function') _resetCoverExitReady(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ if(typeof _clearCoverExitArmed==='function') _clearCoverExitArmed(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  oaiSmoothNavigate(url, 'hymn');
}
var _massQuickResumeTimer = null;
var _massQuickResumeBusy = false;
function _resumeMassQuickReturnIfNeeded(){
  try{
    // 매일미사/성가 외부 사이트에서 돌아온 경우에만 빠른메뉴 팝업을 복구한다.
    // 기존 보정: pageshow에서 reload 판정으로 먼저 지워버리면 외부 복귀 플래그가 사라질 수 있으므로,
    // 복귀 플래그 확인을 가장 먼저 하고 실제 복구는 한 번만 예약한다.
    if(!_shouldMassQuickReturn()) return false;
    if(document.documentElement.classList.contains('app-active')) return false;
    var mq = document.getElementById('mass-quick-modal');
    if(mq && mq.classList.contains('show')){
      // bfcache가 팝업 열린 상태를 그대로 복원한 경우에는 다시 goToCover/open을 돌리지 않는다.
      // 여기서 복귀 플래그를 지워야 이후 다른 외부사이트 복귀 때 화면이 다시 튀지 않는다.
      _clearMassQuickReturnForReload();
      return true;
    }
    if(_massQuickResumeBusy) return true;
    if(_massQuickResumeTimer) clearTimeout(_massQuickResumeTimer);
    _massQuickResumeBusy = true;
    _massQuickResumeTimer = setTimeout(function(){
      try{
        _massQuickResumeTimer = null;
        if(_shouldMassQuickReturn() && !document.documentElement.classList.contains('app-active')){
          _returnToMassQuickMenu();
        }
      }catch(e){ console.warn("[가톨릭길동무]", e); }
      finally{
        setTimeout(function(){ _massQuickResumeBusy = false; }, 250);
      }
    }, 0);
    return true;
  }catch(e){ console.warn("[가톨릭길동무]", e); return false; }
}
function _tryResumeMassQuickSoon(){
  try{
    // 외부 복귀 팝업 재개 여부만 확인한다.
    // 커버 종료 대기값(_exitReady)은 focus/visibility 이벤트에서 건드리지 않는다.
    // 이 값이 이벤트마다 초기화되면 커버에서 두 번 뒤로가기 종료가 깨질 수 있다.
    if(_resumeMassQuickReturnIfNeeded()) return true;
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  return false;
}
window.addEventListener('pageshow', function(){
  // 외부 복귀 시에는 빠른메뉴 복귀만 확인한다.
  // 커버 종료 대기값은 여기서 초기화하지 않는다.
  // Android PWA에서 pageshow가 뒤로가기 흐름 사이에 들어오면
  // '한 번 더 누르면 앱을 종료합니다' 상태가 지워져 커버 2회 종료가 깨진다.
  var handled = _tryResumeMassQuickSoon();
  if(!handled){
    try{ _clearMassQuickReturnForReload(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  setTimeout(_tryResumeMassQuickSoon, 80);
}, true);
document.addEventListener('visibilitychange', function(){
  if(document.visibilityState === 'visible'){
    _tryResumeMassQuickSoon();
    setTimeout(_tryResumeMassQuickSoon, 120);
  }
}, true);
window.addEventListener('focus', function(){
  _tryResumeMassQuickSoon();
  setTimeout(_tryResumeMassQuickSoon, 120);
}, true);
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function(){ setTimeout(_tryResumeMassQuickSoon, 80); }, {once:true});
else setTimeout(_tryResumeMassQuickSoon, 80);
window.addEventListener('load', function(){ setTimeout(_tryResumeMassQuickSoon, 80); }, {once:true});
try{ window._shouldMassQuickReturn=_shouldMassQuickReturn; window._shouldPrayerQuickReturn=_shouldPrayerQuickReturn; window._setPrayerQuickReturn=_setPrayerQuickReturn; window._clearMassQuickReturnForReload=_clearMassQuickReturnForReload; window._clearPrayerQuickReturn=_clearPrayerQuickReturn; window._returnToMassQuickMenu=_returnToMassQuickMenu; window._closePrayerAndReturn=_closePrayerAndReturn; window._resetCoverExitReady=_resetCoverExitReady; window._clearCoverExitArmed=_clearCoverExitArmed; window._isCoverScreenVisible=_isCoverScreenVisible; window._isAppScreenActive=_isAppScreenActive; window._ensureCoverBackTrap=_ensureCoverBackTrap; window._ensureAppBackTrap=_ensureAppBackTrap; window._resetAppBackTrap=_resetAppBackTrap; window._hideMassQuickMenuOnly=_hideMassQuickMenuOnly; window._setPrayerPopupReturnSource=_setPrayerPopupReturnSource; window._isPrayerPopupReturnSource=_isPrayerPopupReturnSource; window._forceCoverAfterPrayerQuickPopup=_forceCoverAfterPrayerQuickPopup; window._resetCoverBackTrap=_resetCoverBackTrap; window._consumePrayerCoverNeedsFirstToast=_consumePrayerCoverNeedsFirstToast; window.openMassQuickMenu=openMassQuickMenu; window.closeMassQuickMenu=closeMassQuickMenu; }catch(e){ console.warn('[가톨릭길동무]', e); }

// 안정형 새로고침: 캐시/서비스워커를 지우지 않고 현재 화면만 다시 불러온다.
// 즐겨찾기/localStorage는 물론, Service Worker와 Cache Storage도 건드리지 않는다.
/* ═══════════════════════════════════════════════
   §3. 앱 새로고침 / 업데이트
   ═══════════════════════════════════════════════ */

function oaiFormatCoverVersionHtml(version, suffixText){
  var v = String(version || 'V1').trim() || 'V1';
  var m = v.match(/^(V1)(-.+)$/);
  var main = m ? m[1] : v;
  var sub = m ? m[2] : '';
  function esc(x){ return String(x).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c] || c); }); }
  return '<span class="refresh-version-main">' + esc(main) + '</span>' + (sub ? '<span class="refresh-version-sub">' + esc(sub) + '</span>' : '') + ' ' + esc(suffixText || '새로고침');
}
function oaiSetCoverRefreshButtonLabel(btn, version, suffixText){
  if(!btn) return;
  try{ btn.innerHTML = oaiFormatCoverVersionHtml(version, suffixText); }
  catch(_e){ btn.textContent = (version || 'V1') + ' ' + (suffixText || '새로고침'); }
}
function _runRefreshAppFilesOnly(){
  var btn = document.getElementById('cover-update-btn');
  try{
    if(btn){
      btn.disabled = true;
      oaiSetCoverRefreshButtonLabel(btn, btn.getAttribute('data-target-version') || 'V1', '새로고침 중');
    }
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    // V37: 새로고침 전에는 레이아웃/스크롤/모달 DOM을 건드리지 않고,
    // 복귀 상태값만 정리한다. 화면 흔들림은 주로 reload 직전 DOM 조작에서 발생했다.
    sessionStorage.setItem('oai_soft_refresh_requested', String(Date.now ? Date.now() : new Date().getTime()));
    try{ if(typeof oaiMarkRefreshHistoryCompact === 'function') oaiMarkRefreshHistoryCompact('short-refresh'); }catch(_e){}
    try{ _clearMassQuickReturnForReload(); }catch(_e){}
  }catch(e){
    console.warn('[가톨릭길동무]', e);
  }
  try{
    if(typeof oaiPrepareRefreshVeil === 'function')
      oaiPrepareRefreshVeil('short-refresh', OAI_REFRESH_VEIL_MS, OAI_REFRESH_CARRY_MS, true, OAI_REFRESH_PRE_NAV_HOLD_MS, false);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  oaiAfterRefreshVeilPaint(function(){
    try{
      location.reload();
    }catch(e){
      location.href = location.href.split('#')[0];
    }
  });
}
function _showRefreshContentDialog(onConfirm){
  try{
    var old = document.getElementById('oai-refresh-content-dialog');
    if(old && old.parentNode) old.parentNode.removeChild(old);

    var ua = (navigator.userAgent || '').toLowerCase();
    var isIOSRefresh = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var cfg = isIOSRefresh ? {
      backdropPad:'20px', panelW:'min(94vw,390px)', panelPad:'21px 17px 16px',
      title:'19px', titleLH:'1.16', titleMb:'9px',
      lead:'13px', leadLH:'1.42', leadMb:'9px',
      desc:'12.5px', descLH:'1.42', descMb:'11px',
      note:'11.8px', noteLH:'1.38', notePad:'8px 9px', noteMb:'15px',
      btnH:'40px', btnMin:'94px', btnFs:'14px', okPad:'0 17px', cancelPad:'0 15px',
      keepWords:true
    } : {
      backdropPad:'22px', panelW:'min(92vw,380px)', panelPad:'22px 18px 17px',
      title:'21px', titleLH:'1.2', titleMb:'10px',
      lead:'15px', leadLH:'1.55', leadMb:'10px',
      desc:'14px', descLH:'1.55', descMb:'12px',
      note:'12.5px', noteLH:'1.45', notePad:'8px 10px', noteMb:'16px',
      btnH:'42px', btnMin:'96px', btnFs:'15px', okPad:'0 18px', cancelPad:'0 16px',
      keepWords:false
    };
    var wordStyle = cfg.keepWords ? ';word-break:keep-all;overflow-wrap:normal;' : '';

    var wrap = document.createElement('div');
    wrap.id = 'oai-refresh-content-dialog';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-label','Refresh Content');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10090;display:flex;align-items:center;justify-content:center;background:rgba(14,21,53,.36);padding:' + cfg.backdropPad + ';box-sizing:border-box;-webkit-text-size-adjust:100%;text-size-adjust:100%;';
    wrap.innerHTML = '<div style="width:' + cfg.panelW + ';background:#fffaf2;border:1px solid rgba(212,170,106,.42);border-radius:20px;box-shadow:0 18px 42px rgba(14,21,53,.24);padding:' + cfg.panelPad + ';text-align:center;font-family:inherit;color:#1f2937;box-sizing:border-box;-webkit-text-size-adjust:100%;text-size-adjust:100%' + wordStyle + '">' +
      '<div style="font-size:' + cfg.title + ';font-weight:900;line-height:' + cfg.titleLH + ';margin-bottom:' + cfg.titleMb + ';letter-spacing:-.02em;">Refresh Content</div>' +
      '<div style="font-size:' + cfg.lead + ';font-weight:800;line-height:' + cfg.leadLH + ';color:#475569;margin-bottom:' + cfg.leadMb + ';letter-spacing:-.03em' + wordStyle + '">앱 화면을 안정형으로 다시 불러옵니다.</div>' +
      '<div style="font-size:' + cfg.desc + ';font-weight:700;line-height:' + cfg.descLH + ';color:#64748b;margin-bottom:' + cfg.descMb + ';letter-spacing:-.03em' + wordStyle + '">캐시와 설치 상태는 삭제하지 않습니다.<br>글자 크기와 즐겨찾기도 그대로 유지됩니다.</div>' +
      '<div style="font-size:' + cfg.note + ';font-weight:800;line-height:' + cfg.noteLH + ';color:#8A6A2F;background:#fff4d7;border:1px solid rgba(212,170,106,.45);border-radius:12px;padding:' + cfg.notePad + ';margin-bottom:' + cfg.noteMb + ';letter-spacing:-.035em' + wordStyle + '">문제가 계속되면 새로고침 버튼을 더 길게 눌러<br>앱 캐시 초기화를 실행할 수 있습니다.</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button type="button" data-oai-refresh-cancel="1" style="height:' + cfg.btnH + ';min-width:' + cfg.btnMin + ';padding:' + cfg.cancelPad + ';border:1px solid #d8d1c5;border-radius:999px;background:#fff;color:#475569;font-family:inherit;font-size:' + cfg.btnFs + ';font-weight:850;">취소</button>' +
      '<button type="button" data-oai-refresh-ok="1" style="height:' + cfg.btnH + ';min-width:' + cfg.btnMin + ';padding:' + cfg.okPad + ';border:0;border-radius:999px;background:#1f2a44;color:#fff;font-family:inherit;font-size:' + cfg.btnFs + ';font-weight:900;">확인</button>' +
      '</div></div>';
    function close(){ try{ if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }catch(_e){} }
    wrap.addEventListener('click', function(e){ if(e.target === wrap) close(); }, true);
    var cancel = wrap.querySelector('[data-oai-refresh-cancel]');
    var ok = wrap.querySelector('[data-oai-refresh-ok]');
    if(cancel) cancel.onclick = function(e){ e.preventDefault(); close(); };
    if(ok) ok.onclick = function(e){ e.preventDefault(); close(); if(typeof onConfirm === 'function') onConfirm(); };
    document.body.appendChild(wrap);
    setTimeout(function(){ try{ if(ok) ok.focus(); }catch(_e){} }, 0);
  }catch(e){
    console.warn('[가톨릭길동무]', e);
    if(typeof onConfirm === 'function') onConfirm();
  }
}
function refreshAppFilesOnly(){
  // 브라우저 기본 confirm은 도메인/저장소 이름이 제목처럼 붙을 수 있어 앱 내부 팝업으로 대체한다.
  _showRefreshContentDialog(_runRefreshAppFilesOnly);
}
window.refreshAppFilesOnly = refreshAppFilesOnly;

// 관리용 완전 정리 함수: 일반 새로고침 버튼에서는 호출하지 않는다.
// 캐시가 심하게 꼬였을 때만 새로고침 버튼 길게 누르기 또는 별도 호출로 사용한다.
async function _runClearAppFilesCacheCompletely(){
  try{
    if(typeof oaiPrepareRefreshVeil === 'function')
      oaiPrepareRefreshVeil('long-refresh-progress', OAI_REFRESH_VEIL_MS, OAI_REFRESH_CARRY_MS, true, OAI_REFRESH_PROGRESS_HOLD_MS, false);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  try{
    if(typeof oaiMarkRefreshHistoryCompact === 'function') oaiMarkRefreshHistoryCompact('long-refresh-progress');
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  await new Promise(function(resolve){ oaiAfterRefreshVeilPaint(resolve); });
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
  // V1-83: 긴 새로고침도 보호막을 다시 예약하지 않고 현재 문서에서 1회만 유지한다.
  try{
    // 현재 히스토리 항목을 그대로 reload한다.
    // location.replace(?refresh=...)는 이전 root 항목과 URL이 갈라져
    // 종료 토스트 뒤 이전 커버 문서로 되돌아가는 원인이 된다.
    location.reload();
  }catch(e){
    location.href = location.href.split('#')[0];
  }
}
function _showCacheClearDialog(onConfirm){
  try{
    var old = document.getElementById('oai-cache-clear-dialog');
    if(old && old.parentNode) old.parentNode.removeChild(old);
    var wrap = document.createElement('div');
    wrap.id = 'oai-cache-clear-dialog';
    wrap.setAttribute('role','dialog');
    wrap.setAttribute('aria-modal','true');
    wrap.setAttribute('aria-label','앱 캐시 초기화');
    wrap.style.cssText = 'position:fixed;inset:0;z-index:10095;display:flex;align-items:center;justify-content:center;background:rgba(14,21,53,.46);padding:22px;box-sizing:border-box;';
    wrap.innerHTML = '<div style="width:min(92vw,390px);background:#fffaf2;border:2px solid rgba(212,170,106,.70);border-radius:20px;box-shadow:0 18px 46px rgba(14,21,53,.30);padding:22px 18px 17px;text-align:center;font-family:inherit;color:#1f2937;box-sizing:border-box;">' +
      '<div style="font-size:21px;font-weight:950;line-height:1.2;margin-bottom:10px;color:#1f2a44;">앱 캐시 초기화</div>' +
      '<div style="font-size:15px;font-weight:800;line-height:1.55;color:#475569;margin-bottom:10px;">앱 파일 캐시를 삭제하고 다시 불러옵니다.</div>' +
      '<div style="font-size:14px;font-weight:700;line-height:1.55;color:#64748b;margin-bottom:12px;">화면이 이상하게 꼬였을 때만 사용하세요.<br>글자 크기와 즐겨찾기는 유지됩니다.</div>' +
      '<div style="font-size:12.5px;font-weight:800;line-height:1.45;color:#8A3B20;background:#fff1e8;border:1px solid rgba(194,65,12,.22);border-radius:12px;padding:8px 10px;margin-bottom:16px;">인터넷이 약하면 다시 불러오는 데 시간이 걸릴 수 있습니다.</div>' +
      '<div style="display:flex;gap:10px;justify-content:center;">' +
      '<button type="button" data-oai-cache-cancel="1" style="height:42px;min-width:96px;padding:0 16px;border:1px solid #d8d1c5;border-radius:999px;background:#fff;color:#475569;font-family:inherit;font-size:15px;font-weight:850;">취소</button>' +
      '<button type="button" data-oai-cache-ok="1" style="height:42px;min-width:120px;padding:0 18px;border:0;border-radius:999px;background:#1f2a44;color:#fff;font-family:inherit;font-size:15px;font-weight:900;">초기화</button>' +
      '</div></div>';
    function close(){ try{ if(wrap && wrap.parentNode) wrap.parentNode.removeChild(wrap); }catch(_e){} }
    wrap.addEventListener('click', function(e){ if(e.target === wrap) close(); }, true);
    var cancel = wrap.querySelector('[data-oai-cache-cancel]');
    var ok = wrap.querySelector('[data-oai-cache-ok]');
    if(cancel) cancel.onclick = function(e){ e.preventDefault(); close(); };
    if(ok) ok.onclick = function(e){ e.preventDefault(); close(); if(typeof onConfirm === 'function') onConfirm(); };
    document.body.appendChild(wrap);
    setTimeout(function(){ try{ if(cancel) cancel.focus(); }catch(_e){} }, 0);
  }catch(e){
    console.warn('[가톨릭길동무]', e);
    if(typeof onConfirm === 'function') onConfirm();
  }
}
function clearAppFilesCacheCompletely(){
  _showCacheClearDialog(_runClearAppFilesCacheCompletely);
}
window.clearAppFilesCacheCompletely = clearAppFilesCacheCompletely;

function syncCoverUpdateVersionState(){
  try{
    var btn = document.getElementById('cover-update-btn');
    var box = document.getElementById('cover-update-box');
    var marker = document.getElementById('oai-build-marker');
    if(!btn || !box) return;
        var target = btn.getAttribute('data-target-version') || 'V1';
    var current = '';
    if(window.APP_VERSION) current = String(window.APP_VERSION).trim();
    if(!current && marker) current = String(marker.textContent || '').trim();
    if(!current) current = target;
    var mismatch = current !== target;
    oaiSetCoverRefreshButtonLabel(btn, target, mismatch ? '업데이트 필요' : '새로고침');
    box.classList.toggle('update-needed', mismatch);
    if(marker){
      marker.textContent = target || 'V1';
      marker.setAttribute('hidden', 'hidden');
      marker.setAttribute('aria-hidden','true');
      marker.style.display = 'none';
      marker.style.visibility = 'hidden';
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
window.syncCoverUpdateVersionState = syncCoverUpdateVersionState;
document.addEventListener('DOMContentLoaded', function(){
  syncCoverUpdateVersionState();
  setTimeout(syncCoverUpdateVersionState, 250);
  setTimeout(syncCoverUpdateVersionState, 900);
}, true);
window.addEventListener('load', syncCoverUpdateVersionState, true);

// V37: 커버 전용 주요 기능 안내. 별도 파일 없이 작은 자동 안내 + 자세한 카드형 팝업을 제공한다.
(function(){
  'use strict';
  var HIDE_DAYS = 7;
  var MAX_LATER_COUNT = 3;
  var KEY_COUNT = 'catholicGuideLaterCount';
  var KEY_HIDE_UNTIL = 'catholicGuideHideUntil';
  var KEY_DISABLED = 'catholicGuideAutoDisabled';
  var KEY_INSTALLED_SHOWN = 'catholicGuideInstalledIntroShown';
  var SOFT_REFRESH_KEY = 'oai_soft_refresh_requested';
  var FAVORITES_RESET_NOTICE_KEY = 'catholicV2SFavoritesResetNoticeShown';
  var skipAutoPopupsThisLoad = false;

  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function isStandaloneApp(){
    try{ if(window.navigator.standalone === true) return true; }catch(e){}
    try{ return !!(window.matchMedia && window.matchMedia('(display-mode: standalone)').matches); }catch(e){}
    return false;
  }
  function isKakaoBrowser(){
    try{ return (navigator.userAgent || '').toLowerCase().indexOf('kakaotalk') > -1; }catch(e){ return false; }
  }
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
/* ═══════════════════════════════════════════════
   §4. 커버 UI — 가이드, 즐겨찾기 안내
   ═══════════════════════════════════════════════ */
  function showModal(id){
    var el=document.getElementById(id);
    if(!el) return;
    resetGuideScroll(id);
    el.classList.add('show');
    el.setAttribute('aria-hidden','false');
    try{ if(typeof oaiEnterPopup==='function') oaiEnterPopup(el); }catch(e){ console.warn('[가톨릭길동무]', e); }
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
    // 뒤로가기가 커버 trap을 소비하지 않도록 전용 state를 쌓는다
    try{
      if(history && history.pushState && !(history.state && history.state.oai_guide_manual)){
        history.pushState({_p:1, oai_guide_manual:true}, '', location.href);
      }
    }catch(_e){}
    // 주요 기능을 확인한 사용자는 일주일간 자동 안내를 다시 띄우지 않는다.
    setVal(KEY_HIDE_UNTIL, now() + HIDE_DAYS*24*60*60*1000);
  }
  function closeGuideManual(){
    hideModal('guide-manual-modal');
    // 확인버튼: oai_guide_manual state를 trap state로 교체해 뒤로가기 횟수 정상화
    try{
      if(history.state && history.state.oai_guide_manual){
        history.replaceState({_p:1, oai_cover_trap:'guide-confirm'}, '', location.href);
      }
    }catch(_e){}
  }
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
  function isGuideModalOpen(id){
    var el=document.getElementById(id);
    return !!(el && el.classList.contains('show') && el.getAttribute('aria-hidden') !== 'true');
  }
  function hideFavoritesResetNotice(){
    var el=document.getElementById('favorites-reset-notice-banner');
    if(el){
      el.classList.remove('show');
      el.setAttribute('hidden', '');
    }
  }
  function closeFavoritesResetNotice(){
    var el=document.getElementById('favorites-reset-notice-banner');
    var wasOpen=!!(el && el.classList.contains('show') && !el.hasAttribute('hidden'));
    hideFavoritesResetNotice();
    if(wasOpen) setVal(FAVORITES_RESET_NOTICE_KEY, '1');
  }
  function shouldShowFavoritesResetNotice(){
    // 업데이트 안내 배너는 자동 표시하지 않는다.
    // 사용자가 이전에 삭제 요청한 흐름을 유지하기 위해 기존 자동 조건을 닫아 둔다.
    return false;
  }
  function maybeShowFavoritesResetNotice(){
    if(shouldShowFavoritesResetNotice()){
      var el=document.getElementById('favorites-reset-notice-banner');
      if(el){
        el.removeAttribute('hidden');
        el.classList.add('show');
      }
    }
  }
  function shouldShowIntro(forceRefresh){
    // 주요기능 안내는 앱 첫 진입 때 자동 표시하지 않는다.
    // 커버의 주요기능 버튼을 눌렀을 때만 수동으로 열린다.
    return false;
  }
  function maybeShowIntro(){
    var forceRefresh = hasRecentSoftRefreshRequest();
    if(forceRefresh){
      // V37: 안정형 새로고침 뒤에는 어떤 커버 팝업도 자동으로 다시 띄우지 않는다.
      skipAutoPopupsThisLoad = true;
      try{ if(typeof closeMassQuickMenu === 'function') closeMassQuickMenu(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      try{ hideModal('guide-intro-modal'); hideModal('guide-manual-modal'); hideFavoritesResetNotice(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      clearSoftRefreshRequest();
      return;
    }
    if(shouldShowIntro(false)){
      setVal(KEY_INSTALLED_SHOWN, '1');
      showModal('guide-intro-modal');
    }
  }
  try{
// Google Play Android 정리본: 모바일 브라우저 안내 로직 제거
}catch(e){ console.warn('[가톨릭길동무]', e); }

  function bindGuide(){
    var btn=document.getElementById('cover-guide-btn');
    if(btn) btn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); openGuideManual(); });
    var detail=document.getElementById('guide-open-detail-btn');
    if(detail) detail.addEventListener('click', function(e){ e.preventDefault(); openGuideManual(); });
    var later=document.getElementById('guide-later-btn');
    if(later) later.addEventListener('click', function(e){ e.preventDefault(); closeIntroLater(); });
    var ok=document.getElementById('guide-ok-btn');
    if(ok) ok.addEventListener('click', function(e){ e.preventDefault(); closeGuideManual(); });
    var favOk=document.getElementById('favorites-reset-notice-ok');
    if(favOk) favOk.addEventListener('click', function(e){ e.preventDefault(); closeFavoritesResetNotice(); });
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
      closeFavoritesResetNotice();
    });
    // 자동 주요기능/업데이트 배너 표시 제거: 수동 버튼 동작만 유지한다.
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', bindGuide, {once:true});
  else bindGuide();
  window.openGuideManual = openGuideManual;
  window.resetGuideManualScroll = function(){ resetGuideScroll('guide-manual-modal'); };
})();

/* ═══════════════════════════════════════════════
   §5. 뷰 열기/닫기 — 미사, 기도문, 교구
   ═══════════════════════════════════════════════ */
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
  // 주요기도문은 앱 내부 카테고리지만, 빠른메뉴에서 들어온 경우 뒤로가기는 팝업으로 복귀한다.
  if(opts && opts.fromMassQuick){
    try{
      _setPrayerQuickReturn(true);
      window.__OAI_PRAYER_FROM_QUICK_LOCK__ = true;
      sessionStorage.setItem('oai_prayer_from_quick_lock','1');
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  try{ if(typeof _resetCoverExitReady==='function') _resetCoverExitReady(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  try{ if(typeof _clearCoverExitArmed==='function') _clearCoverExitArmed(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  const view=$('prayer-view');
  if(!view) return;
  try{
    if(opts && opts.fromMassQuick) view.dataset.quickSource = 'mass';
    else delete view.dataset.quickSource;
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  const cv=$('cover');
  if(cv){ cv.style.opacity='0'; cv.style.display='none'; }
  document.documentElement.classList.add('app-active');
  try{
    if(typeof window._oaiArmPrayerBackTrap==='function') window._oaiArmPrayerBackTrap('prayer-open');
    else if(typeof _ensureAppBackTrap==='function') _ensureAppBackTrap('prayer-open');
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(true);
  view.classList.add('open');
  // V3-S: restore 변수 미정의 오류 방지. 주요기도문 초기화가 중간에 끊기면
  // 탭/목록이 비어 보이므로 opts.restore 값을 명확히 계산해서 사용한다.
  var restore = !!(opts && opts.restore);
  if(!restore && typeof oaiEnterView==='function') oaiEnterView(view);
  var setupDelay = (opts && opts.instant) ? 0 : 50;
  var runPrayerSetup=function(){
    setTimeout(function(){
      if(typeof window.initPrayerView==='function') try{window.initPrayerView();}catch(e){ console.warn("[가톨릭길동무]", e); }
      try{ if(typeof window.prEnsureTabsVisible==='function') window.prEnsureTabsVisible(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(!(opts&&opts.restore) && typeof showPrayerListOnly==='function') try{showPrayerListOnly();}catch(e){ console.warn("[가톨릭길동무]", e); }
      setTimeout(function(){ try{ if(typeof window.prEnsureTabsVisible==='function') window.prEnsureTabsVisible(); }catch(e){ console.warn("[가톨릭길동무]", e); } }, 120);
      try{
        if(typeof window._oaiArmPrayerBackTrap==='function') window._oaiArmPrayerBackTrap('prayer-list-ready');
        else if(typeof _ensureAppBackTrap==='function') _ensureAppBackTrap('prayer-list-ready');
      }catch(e){ console.warn("[가톨릭길동무]", e); }
      var list=document.getElementById('prayer-list-view'); if(list) list.scrollTop=0;
      var tabs=document.getElementById('prayer-tabs'); if(tabs) tabs.scrollLeft=0;
    }, setupDelay);
  };
  if(typeof window.ensurePrayerModuleLoaded==='function'){
    window.ensurePrayerModuleLoaded().then(runPrayerSetup).catch(function(err){
      console.warn('[가톨릭길동무]', err);
      var ul=document.getElementById('pr-list-ul');
      if(ul) ul.innerHTML='<div class="pr-empty">기도문을 불러오지 못했습니다.<br>새로고침 후 다시 시도해 주세요.</div>';
    });
  } else {
    runPrayerSetup();
  }
}
function closePrayerView(){
  const view=$('prayer-view');
  const detail=$('prayer-detail');
  if(detail) detail.classList.remove('show');
  if(view){
    view.classList.remove('open');
    try{ delete view.dataset.quickSource; }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}
function _closePrayerAndReturn(){
  // history.go(-1) 으로 popstate를 발생시켜 handlePrayerBack 이 처리하도록 한다.
  // 직접 _oaiPrayerListToPopupOrCover 를 호출하면 popstate 없이 replaceState+pushState 가
  // 실행되어 history 스택이 오염(root 항목이 남아 앱 밖 탈출)되는 버그가 생긴다.
  try{
    history.go(-1);
    return;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  // fallback: history.go 실패 시 기존 직접 로직 유지
  try{
    if(typeof window._oaiPrayerListToPopupOrCover === 'function'){
      window._oaiPrayerListToPopupOrCover('prayer-close-button');
      return;
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  var pv = $('prayer-view');
  var fromQuickPrayer = _shouldPrayerQuickReturn();
  try{ if(pv && pv.dataset && pv.dataset.quickSource === 'mass') fromQuickPrayer = true; }catch(e){ console.warn("[가톨릭길동무]", e); }
  if(fromQuickPrayer){
    _returnToMassQuickMenu('prayer');
  } else {
    closePrayerView();
    try{ _clearPrayerQuickReturn(); }catch(e){ console.warn("[가톨릭길동무]", e); }
    if(typeof goToCover==='function') goToCover();
  }
}




// Google Play Android 정리본: 모바일 브라우저 설치 안내 컨트롤러는 제거했습니다.
function openDioceseView(opts){
  var view=document.getElementById('diocese-view');
  var frame=document.getElementById('diocese-frame');
  var loading=document.getElementById('diocese-loading');
  if(!view||!frame) return;
  var restore = !!(opts && opts.restore);
  var needsLoad = (!frame.src || frame.src==='about:blank' || !frame._loaded);
  if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(true);
  view.classList.add('open');
  // 외부 교구 홈페이지에서 복귀할 때는 진입 효과를 다시 주지 않는다.
  // 부모 안정막이 걷힌 뒤 iframe/헤더가 흔들리는 것을 막는다.
  if(!restore && typeof oaiEnterView==='function') oaiEnterView(view);
  if(loading) loading.style.display = needsLoad ? 'flex' : 'none';
  if(needsLoad){
    frame.onload=function(){
      if(loading) loading.style.display='none'; frame._loaded=true;
      try{ frame.contentWindow && frame.contentWindow.dioApplySharedFont && frame.contentWindow.dioApplySharedFont(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(!restore) try{ frame.contentWindow && frame.contentWindow.resetDioceseFirstPage && frame.contentWindow.resetDioceseFirstPage(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(typeof dioceseLoaded==='function') dioceseLoaded();
    };
    frame.src='diocese.html?v=V1-28';
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
    // V3-S: 원주·인천교구 대표 홈페이지는 공식 등록 주소가 HTTP이므로
    // 프로토콜을 강제로 바꾸지 않는다. www 보정만 수행한다.
    if(host === 'wjcatholic.or.kr') u.hostname = 'www.wjcatholic.or.kr';
    if(host === 'caincheon.or.kr') u.hostname = 'www.caincheon.or.kr';
    if(host === 'www.cathms.kr') u.hostname = 'cathms.kr';
    if(u.hostname.toLowerCase() === 'cathms.kr') u.protocol = 'https:';
    return u.toString();
  }catch(e){ return url; }
}
// 외부 URL 이동 함수들의 공통 전처리:
//   1) normalizeCatholicExternalUrl 호출  2) 빈 URL이면 null 반환
function prepareExternalUrl(url){
  url = (typeof normalizeCatholicExternalUrl === 'function')
        ? normalizeCatholicExternalUrl(url)
        : String(url || '').trim();
  return url || null;
}
function openCoreExternalUrl(url, extra){
  url = prepareExternalUrl(url);
  if(!url) return;
  saveCoreReturnState(extra);
  // location.href 방식: PWA/모바일에서 팝업 차단 우회, 뒤로가기로 복귀 가능
  oaiSmoothNavigate(url, 'core-external');
}

const DIOCESE_RETURN_KEY='catholic_diocese_external_return_v1';
function openDioceseExternal(url, state){
  url = prepareExternalUrl(url);
  if(!url) return false;
  try{
    var payload=JSON.stringify(state || {});
    sessionStorage.setItem(DIOCESE_RETURN_KEY, payload);
    localStorage.setItem(DIOCESE_RETURN_KEY, payload);
    window.__OAI_DIOCESE_EXTERNAL_LEAVING__ = true;
    var frame=document.getElementById('diocese-frame');
    if(frame && frame.contentWindow){
      try{ frame.contentWindow.__OAI_DIO_EXTERNAL_LEAVING__ = true; frame.contentWindow.__OAI_DIO_EXTERNAL_LEAVING_TS__ = Date.now ? Date.now() : new Date().getTime(); }catch(_e){}
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  // V3-S: iframe에서 온 교구 홈페이지 클릭은 지연 setTimeout 없이 즉시 top 페이지를 이동한다.
  // 지연 이동은 일부 Android/PWA에서 사용자 클릭 흐름이 끊겨 사이트가 열리지 않거나 pending만 남을 수 있다.
  try{ if(typeof markExternalReturnStabilize === 'function') markExternalReturnStabilize('diocese-external'); }catch(_e){}
  try{ location.assign(url); }
  catch(e){ try{ location.href = url; }catch(_e){ console.warn('[가톨릭길동무]', _e); return false; } }
  return true;
}
window.openDioceseExternal = openDioceseExternal;
function _finishDioceseExternalReturn(frame){
  try{
    var w = frame && frame.contentWindow;
    if(w){
      w.__OAI_DIO_EXTERNAL_LEAVING__ = false;
      w.__OAI_DIO_PARENT_RETURNING__ = false;
      if(typeof w.oaiReleaseDioceseStability === 'function') w.oaiReleaseDioceseStability({silent:true});
    }
  }catch(_e){}
  try{ sessionStorage.removeItem(DIOCESE_RETURN_KEY); localStorage.removeItem(DIOCESE_RETURN_KEY); }catch(_e){}
  window.__OAI_DIOCESE_EXTERNAL_LEAVING__ = false;
  window.__OAI_DIOCESE_RESTORING__ = false;
}
function restoreDioceseExternalState(opts){
  opts = opts || {};
  var raw=null, state=null;
  try{ raw=sessionStorage.getItem(DIOCESE_RETURN_KEY) || localStorage.getItem(DIOCESE_RETURN_KEY); }catch(e){ console.warn('[가톨릭길동무]', e); }
  if(!raw || window.__OAI_DIOCESE_RESTORING__) return false;

  try{ state=JSON.parse(raw); }catch(e){ state={}; }

  try{
    var root=document.documentElement;
    root.classList.remove('oai-diocese-returning');
    var view=document.getElementById('diocese-view');
    var frame=document.getElementById('diocese-frame');
    var alreadyOpen=!!(view && view.classList.contains('open'));
    var frameAlive=!!(frame && frame.contentWindow);

    // V3-S stable: frame.contentWindow가 있다는 이유만으로 '살아 있다'고 판단하면 안 된다.
    // Android/카카오 WebView에서는 부모 iframe 객체는 남아 있어도, iframe 내부 diocese.html이
    // 새로 초기화되어 목록이 맨 위로 돌아간 상태가 섞인다. 그래서 iframe 내부에 현재 탭/scrollTop이
    // 저장값과 실제로 일치하는지 물어본 뒤, 일치할 때만 웹사이트처럼 아무 복원도 하지 않는다.
    if(alreadyOpen && frameAlive){
      var preserved=false;
      try{
        var w=frame.contentWindow;
        if(w && typeof w.isDioceseReturnPreserved === 'function') preserved = !!w.isDioceseReturnPreserved(state || {});
        else if(w && w.__OAI_DIO_EXTERNAL_LEAVING__) preserved = true;
      }catch(_e){ preserved=false; }
      if(preserved){
        _finishDioceseExternalReturn(frame);
        return true;
      }
      // iframe은 존재하지만 보존 상태가 아니면 아래의 단일 복원 경로로 내려간다.
    }

    window.__OAI_DIOCESE_RESTORING__ = true;
    try{ sessionStorage.removeItem(DIOCESE_RETURN_KEY); localStorage.removeItem(DIOCESE_RETURN_KEY); }catch(e){ console.warn('[가톨릭길동무]', e); }

    function finish(){
      try{ root.classList.remove('oai-diocese-returning'); }catch(_e){}
      window.__OAI_DIOCESE_RESTORING__ = false;
    }
    function restoreInFrame(){
      try{
        frame=document.getElementById('diocese-frame');
        var w=frame && frame.contentWindow;
        if(w){
          w.__OAI_DIO_EXTERNAL_LEAVING__ = false;
          w.__OAI_DIO_PARENT_RETURNING__ = true;
        }
        if(w && typeof w.restoreDioceseReturnState === 'function'){
          // 새로 로드되어 관구교구 iframe 자체가 사라졌던 경우에만 최소 복원한다.
          w.restoreDioceseReturnState(state || {});
          setTimeout(finish, 120);
          return true;
        }
      }catch(e){ console.warn('[가톨릭길동무]', e); }
      return false;
    }

    if(!alreadyOpen && typeof openDioceseView === 'function') openDioceseView({restore:true});
    if(!alreadyOpen && typeof oaiSetMainMapLayerHidden === 'function') oaiSetMainMapLayerHidden(true);
    var tries=0;
    var timer=setInterval(function(){
      tries++;
      if(restoreInFrame()){ clearInterval(timer); return; }
      if(tries>10){ clearInterval(timer); finish(); }
    }, 70);
  }catch(e){ console.warn('[가톨릭길동무]', e); window.__OAI_DIOCESE_RESTORING__ = false; }
  return true;
}
window.addEventListener('pageshow', function(ev){
  try{
    var hasReturn=sessionStorage.getItem(DIOCESE_RETURN_KEY) || localStorage.getItem(DIOCESE_RETURN_KEY);
    if(hasReturn){
      document.documentElement.classList.remove('oai-diocese-returning');
      var view=document.getElementById('diocese-view');
      var frame=document.getElementById('diocese-frame');
      // 핵심: persisted 여부와 무관하게, 관구교구 화면/iframe이 살아 있으면 웹사이트처럼 그대로 둔다.
      // Android/카카오/WebView에서는 persisted=false여도 실제 DOM과 스크롤이 살아 있는 경우가 많다.
      if(view && view.classList.contains('open') && frame && frame.contentWindow){
        var state=null;
        try{ state=JSON.parse(hasReturn); }catch(_e){ state={}; }
        var preserved=false;
        try{
          var w=frame.contentWindow;
          if(w && typeof w.isDioceseReturnPreserved === 'function') preserved = !!w.isDioceseReturnPreserved(state || {});
          else if(w && w.__OAI_DIO_EXTERNAL_LEAVING__) preserved = true;
        }catch(_e){ preserved=false; }
        if(preserved){
          _finishDioceseExternalReturn(frame);
          return;
        }
      }
    }
  }catch(ex){}
  setTimeout(function(){ restoreDioceseExternalState({persisted: !!(ev && ev.persisted)}); }, 20);
}, true);
window.addEventListener('focus', function(){
  // 관구교구 외부 홈페이지 복귀는 pageshow 한 경로에서만 처리한다.
}, true);


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
  if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
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
  // V37: 외부사이트 복귀 시 지도 중심을 두 단계로 움직이지 않는다.
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
// 【성지 데이터 - shrines.js의 window._SH_RAW 배열】
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
// 【성당 데이터 - parishes-*.js의 window._PA_DIO_RAW 교구별 배열】 【피정의 집 - retreats.js의 window._RT_RAW 배열】
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
// 【항목 추가】성지는 shrines.js의 window._SH_RAW, 성당은 해당 교구 parishes-*.js의 window._PA_DIO_RAW 배열 끝에 콤마 후 새 항목 추가
// 【항목 수정】해당 항목 직접 편집
// 【항목 삭제】해당 항목 줄 전체 삭제 (앞뒤 콤마 주의)
// ════════════════════════════════════════════════
let _SH_RAW = [];

/* ═══════════════════════════════════════════════
   §6. 데이터 — 교구 코드, URL 디코딩
   ═══════════════════════════════════════════════ */
const _DIO={'SE':'서울대교구','SW':'수원교구','DG':'대구대교구','DJ':'대전교구','GJ':'광주대교구','IC':'인천교구','BS':'부산교구','JJ':'전주교구','UJ':'의정부교구','CJ':'청주교구','MS':'마산교구','CC':'춘천교구','WJ':'원주교구','AD':'안동교구','JE':'제주교구','ML':'군종교구'};
const _URL_T={'1':'http://cafe.daum.net/','2':'https://cafe.daum.net/','3':'http://cafe.naver.com/','4':'https://cafe.naver.com/','5':'http://www.','6':'https://www.','7':'http://','8':'https://','P1':'https://www.casuwon.or.kr','P2':'https://www.daegu-archdiocese.or.kr','P3':'https://www.djcatholic.or.kr','P4':'https://www.gjcatholic.or.kr','P5':'http://www.caincheon.or.kr','P6':'https://www.catholicbusan.or.kr','P7':'https://www.jcatholic.or.kr','P8':'http://www.ucatholic.or.kr','P9':'https://www.cdcj.or.kr','PA':'https://cathms.kr','PB':'https://aos.catholic.or.kr','PC':'https://www.diocesejeju.or.kr','PD':'https://www.gunjong.or.kr','PE':'https://sd.uca.or.kr','PR':'https://www.cbck.or.kr/Directory/Retreat/'};
function _decUrl(u){if(!u)return '';const t=_URL_T[u.slice(0,2)];if(t)return t+u.slice(2);const t1=_URL_T[u[0]];return t1?t1+u.slice(1):u;}
function _unpack(raw){return raw.map((r,i)=>({_idx:i,name:r[0],diocese:_DIO[r[1]]||r[1],addr:r[2],tel:r[3]||'',hp:_decUrl(r[4]||''),url:_decUrl(r[5]||''),lat:r[6],lng:r[7]}));}

let PARISHES=[];
let _parishRawLoaded=false;
let _parishDioIndexReady=false;
let _parishDataLoadPromise=null;
let _parishAllDataLoadPromise=null;
/* ═══════════════════════════════════════════════
   §7. 데이터 로더 — 성당/성지/피정
   ═══════════════════════════════════════════════ */
const _PARISH_SPLIT_LAZY_MODE=true;

// V3-S: 성당 데이터를 교구별 parishes-*.js 파일로 실제 분리한다.
// 지도·마커·길찾기·뒤로가기 로직은 그대로 두고, 데이터 배열만 필요한 시점에 채운다.
const _PARISH_DIOCESE_ORDER=[
  'SE','IC','SW','UJ','CC','WJ','DJ','CJ',
  'DG','BS','AD','MS','GJ','JJ','JE','ML'
];
const _PARISH_DIOCESE_ASSETS={
  'SE':'parishes-seoul.js',
  'IC':'parishes-incheon.js',
  'SW':'parishes-suwon.js',
  'UJ':'parishes-uijeongbu.js',
  'CC':'parishes-chuncheon.js',
  'WJ':'parishes-wonju.js',
  'DJ':'parishes-daejeon.js',
  'CJ':'parishes-cheongju.js',
  'DG':'parishes-daegu.js',
  'BS':'parishes-busan.js',
  'AD':'parishes-andong.js',
  'MS':'parishes-masan.js',
  'GJ':'parishes-gwangju.js',
  'JJ':'parishes-jeonju.js',
  'JE':'parishes-jeju.js',
  'ML':'parishes-military.js'
};
const _PARISH_DIOCESE_LOAD_STATE={};
const _PARISH_DIOCESE_LOAD_PROMISES={};
const _PARISH_ASSET_VERSION='V1-28';
function _getParishDioceseAsset(code){
  return _PARISH_DIOCESE_ASSETS[code] || null;
}
function _getParishDioceseRawStore(){
  try{ return window._PA_DIO_RAW || null; }catch(e){ console.warn('[가톨릭길동무]', e); }
  return null;
}
function _getParishRawByDioceseCode(code){
  const store=_getParishDioceseRawStore();
  if(store && Array.isArray(store[code])) return store[code];
  const raw=_getLegacyParishRawGlobal();
  if(!Array.isArray(raw) || !code) return [];
  return raw.filter(function(r){ return r && r[1]===code; });
}
function _rememberParishDioceseLoaded(code){
  if(code) _PARISH_DIOCESE_LOAD_STATE[code]=true;
  return _PARISH_DIOCESE_LOAD_STATE;
}
function _isParishDioceseReady(code){
  return !!(code && _PARISH_DIOCESE_LOAD_STATE[code] && _getParishRawByDioceseCode(code).length);
}
function _areAllParishDiocesesReady(){
  return _PARISH_DIOCESE_ORDER.every(function(code){ return _isParishDioceseReady(code); });
}
function _rememberAllParishDiocesesLoadedFromRaw(raw){
  if(!Array.isArray(raw)) return _PARISH_DIOCESE_LOAD_STATE;
  raw.forEach(function(r){
    if(r && r[1]) _rememberParishDioceseLoaded(r[1]);
  });
  return _PARISH_DIOCESE_LOAD_STATE;
}
function _mergeLoadedParishRaw(){
  const merged=[];
  const store=_getParishDioceseRawStore();
  _PARISH_DIOCESE_ORDER.forEach(function(code){
    const part=store && Array.isArray(store[code]) ? store[code] : [];
    if(part.length) merged.push.apply(merged, part);
  });
  return merged;
}
function _getLegacyParishRawGlobal(){
  try{ if(Array.isArray(window._PA_RAW) && window._PA_RAW.length) return window._PA_RAW; }catch(e){ console.warn('[가톨릭길동무]', e); }
  try{ if(typeof _PA_RAW!=='undefined' && Array.isArray(_PA_RAW) && _PA_RAW.length) return _PA_RAW; }catch(e){ console.warn('[가톨릭길동무]', e); }
  return null;
}
function _getParishRawGlobal(){
  const legacy=_getLegacyParishRawGlobal();
  if(Array.isArray(legacy) && legacy.length) return legacy;
  const merged=_mergeLoadedParishRaw();
  return merged.length ? merged : null;
}
function _buildParishList(raw){
  raw = Array.isArray(raw) ? raw : [];
  return raw.map((r,i)=>({
    _idx:i,
    name:r[0],
    diocese:_DIO[r[1]]||r[1],
    addr:r[2],
    tel:r[3]||'',
    hp:_decUrl(r[4]||''),
    url:_decUrl(r[5]||''),
    lat:r[6],
    lng:r[7]
  }));
}
function _setParishRawData(raw, loaded){
  raw = Array.isArray(raw) ? raw : [];
  PARISHES=_buildParishList(raw);
  _parishRawLoaded=loaded !== false && raw.length > 0;
  if(_parishRawLoaded) _rememberAllParishDiocesesLoadedFromRaw(raw);
  if(_parishDioIndexReady && typeof _rebuildParishDioIndex==='function') _rebuildParishDioIndex();
  return PARISHES;
}
function _refreshParishDataFromLoadedDioceses(){
  const raw=_getParishRawGlobal() || [];
  return _setParishRawData(raw, raw.length>0);
}
function _initParishDataFromGlobal(){
  return _refreshParishDataFromLoadedDioceses();
}
function _showParishDataLoadingMessage(msg){
  try{
    const listBody=document.getElementById('list-body');
    if(listBody && _mode==='parish') listBody.innerHTML='<div class="empty-msg">'+(msg||'성당 정보를 불러오는 중입니다...')+'</div>';
    const nearbyBody=document.getElementById('nearby-body');
    if(nearbyBody && _mode==='parish' && _activeTab==='nearby') nearbyBody.innerHTML='<div class="empty-msg">'+(msg||'성당 정보를 불러오는 중입니다...')+'</div>';
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _afterParishDataLoaded(){
  try{
    if(_mode==='parish'){
      if(_activeTab==='list') renderList();
      if(_activeDio) _showParishDioMkrs(_activeDio);
      _syncParishDioLabels();
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _ensureParishDioceseDataLoaded(code){
  if(!code) return Promise.reject(new Error('교구 코드가 없습니다.'));
  if(_isParishDioceseReady(code)) return Promise.resolve(_refreshParishDataFromLoadedDioceses());
  if(_PARISH_DIOCESE_LOAD_PROMISES[code]) return _PARISH_DIOCESE_LOAD_PROMISES[code];
  const asset=_getParishDioceseAsset(code);
  if(!asset) return Promise.reject(new Error('교구 데이터 파일을 찾을 수 없습니다: '+code));
  _PARISH_DIOCESE_LOAD_PROMISES[code]=new Promise(function(resolve,reject){
    const already=document.querySelector('script[data-parish-dio="'+code+'"]');
    function finish(){
      const raw=_getParishRawByDioceseCode(code);
      if(raw && raw.length){
        _rememberParishDioceseLoaded(code);
        resolve(_refreshParishDataFromLoadedDioceses());
      }else{
        reject(new Error('성당 교구 데이터가 비어 있습니다: '+code));
      }
    }
    if(already){
      already.addEventListener('load', finish, {once:true});
      already.addEventListener('error', function(){ reject(new Error('성당 교구 데이터 로드 실패: '+code)); }, {once:true});
      setTimeout(function(){ try{ if(_getParishRawByDioceseCode(code).length) finish(); }catch(_e){} },0);
      return;
    }
    const sc=document.createElement('script');
    sc.src=asset+'?v='+_PARISH_ASSET_VERSION;
    sc.dataset.parishDio=code;
    sc.onload=finish;
    sc.onerror=function(){ reject(new Error('성당 교구 데이터 로드 실패: '+code)); };
    document.head.appendChild(sc);
  }).then(function(result){
    delete _PARISH_DIOCESE_LOAD_PROMISES[code];
    _afterParishDataLoaded();
    return result;
  }).catch(function(err){
    delete _PARISH_DIOCESE_LOAD_PROMISES[code];
    throw err;
  });
  return _PARISH_DIOCESE_LOAD_PROMISES[code];
}
function _ensureAllParishDiocesesLoaded(){
  if(_areAllParishDiocesesReady()) return Promise.resolve(_refreshParishDataFromLoadedDioceses());
  if(_parishAllDataLoadPromise) return _parishAllDataLoadPromise;
  _showParishDataLoadingMessage('전체 성당 정보를 불러오는 중입니다...');
  _parishAllDataLoadPromise=Promise.all(_PARISH_DIOCESE_ORDER.map(function(code){
    return _ensureParishDioceseDataLoaded(code);
  })).then(function(){
    _parishAllDataLoadPromise=null;
    return _refreshParishDataFromLoadedDioceses();
  }).catch(function(err){
    _parishAllDataLoadPromise=null;
    throw err;
  });
  return _parishAllDataLoadPromise;
}
function _ensureParishDataLoaded(){
  if(_parishRawLoaded && PARISHES.length) return Promise.resolve(PARISHES);
  if(_parishDataLoadPromise) return _parishDataLoadPromise;
  _parishDataLoadPromise=_ensureAllParishDiocesesLoaded().catch(function(err){
    _parishDataLoadPromise=null;
    throw err;
  });
  return _parishDataLoadPromise;
}
_initParishDataFromGlobal();

const _PRAYER_ASSET_VERSION='V1-28';
let _prayerModuleLoadPromise=null;
function _isPrayerModuleReady(){
  return typeof window.initPrayerView === 'function' &&
         typeof window.prRenderList === 'function' &&
         typeof window.prAdjustFont === 'function';
}
function _showPrayerLoadingMessage(msg){
  const body=document.getElementById('pr-list-ul');
  if(body) body.innerHTML='<div class="pr-empty">'+(msg||'기도문을 불러오는 중입니다...')+'</div>';
}
function ensurePrayerModuleLoaded(){
  if(_isPrayerModuleReady()) return Promise.resolve(true);
  if(_prayerModuleLoadPromise) return _prayerModuleLoadPromise;
  _showPrayerLoadingMessage('기도문을 불러오는 중입니다...');
  _prayerModuleLoadPromise=new Promise(function(resolve,reject){
    const existing=document.querySelector('script[data-prayer-loader="true"],script[src*="prayer.js"]');
    function finish(){
      if(_isPrayerModuleReady()) resolve(true);
      else reject(new Error('기도문 모듈이 준비되지 않았습니다.'));
    }
    if(existing){
      existing.addEventListener('load', finish, {once:true});
      existing.addEventListener('error', function(){ reject(new Error('기도문 모듈 로드 실패')); }, {once:true});
      setTimeout(function(){ try{ if(_isPrayerModuleReady()) finish(); }catch(_e){} }, 0);
      return;
    }
    const sc=document.createElement('script');
    sc.src='prayer.js?v='+_PRAYER_ASSET_VERSION;
    sc.dataset.prayerLoader='true';
    sc.onload=finish;
    sc.onerror=function(){ reject(new Error('기도문 모듈 로드 실패')); };
    document.head.appendChild(sc);
  }).catch(function(err){
    _prayerModuleLoadPromise=null;
    throw err;
  });
  return _prayerModuleLoadPromise;
}
try{ window.ensurePrayerModuleLoaded=ensurePrayerModuleLoaded; }catch(e){ console.warn('[가톨릭길동무]', e); }

// ─── 피정의 집 데이터 [195개] ───
let _RT_RAW = [];
let _retreatRawLoaded = false;
let _retreatDataLoadPromise = null;
const _RETREAT_ASSET_VERSION='V1-28';

let RETREATS = [];
function _buildRetreatList(raw){
  return _unpack(Array.isArray(raw) ? raw : []);
}
function _getRetreatRawGlobal(){
  try{ if(Array.isArray(window._RT_RAW)) return window._RT_RAW; }catch(e){ console.warn('[가톨릭길동무]', e); }
  return null;
}
function _setRetreatRawData(raw, loaded){
  _RT_RAW = Array.isArray(raw) ? raw : [];
  RETREATS = _buildRetreatList(_RT_RAW);
  _retreatRawLoaded = loaded !== false && _RT_RAW.length > 0;
  return RETREATS;
}
function _initRetreatDataFromGlobal(){
  const raw=_getRetreatRawGlobal();
  return _setRetreatRawData(raw || [], !!raw);
}
function _ensureRetreatDataLoaded(){
  const existingRaw=_getRetreatRawGlobal();
  if(existingRaw && (!_retreatRawLoaded || !RETREATS.length)) _setRetreatRawData(existingRaw, true);
  if(_retreatRawLoaded && RETREATS.length) return Promise.resolve(RETREATS);
  if(_retreatDataLoadPromise) return _retreatDataLoadPromise;
  _retreatDataLoadPromise=new Promise(function(resolve,reject){
    const already=document.querySelector('script[data-retreat-loader="true"],script[src*="retreats.js"]');
    function finish(){
      const raw=_getRetreatRawGlobal();
      if(raw && raw.length){ resolve(_setRetreatRawData(raw, true)); }
      else reject(new Error('피정의집 데이터가 비어 있습니다.'));
    }
    if(already){
      already.addEventListener('load', finish, {once:true});
      already.addEventListener('error', function(){ reject(new Error('피정의집 데이터 로드 실패')); }, {once:true});
      setTimeout(function(){ try{ if(_getRetreatRawGlobal()) finish(); }catch(_e){} }, 0);
      return;
    }
    const sc=document.createElement('script');
    sc.src='retreats.js?v='+_RETREAT_ASSET_VERSION;
    sc.dataset.retreatLoader='true';
    sc.onload=finish;
    sc.onerror=function(){ reject(new Error('피정의집 데이터 로드 실패')); };
    document.head.appendChild(sc);
  }).catch(function(err){
    _retreatDataLoadPromise=null;
    throw err;
  });
  return _retreatDataLoadPromise;
}
try{ window._setRetreatRawData=_setRetreatRawData; }catch(e){ console.warn('[가톨릭길동무]', e); }
_initRetreatDataFromGlobal();
function _getCurrentItems(){return _mode==='shrine'?SHRINES:(_mode==='retreat'?RETREATS:PARISHES);}
function _getModeTypeText(){return _mode==='shrine'?'성지':(_mode==='retreat'?'피정의 집':'성당');}
function _getModeTypeLabel(item){return _mode==='shrine'?item.type:(_mode==='retreat'?'🏔 피정의 집':'⛪ 성당');}
const _RETREAT_DIO_COLORS={'SE':'#c0392b','IC':'#c0392b','SW':'#c0392b','UJ':'#c0392b','CC':'#1565c0','WJ':'#1565c0','DJ':'#c0392b','CJ':'#1565c0','DG':'#1b7a3e','AD':'#1b7a3e','BS':'#1565c0','MS':'#1b7a3e','GJ':'#1b7a3e','JJ':'#1b7a3e','JE':'#1b7a3e','ML':'#c0392b'};
const OAI_CATHEDRAL_CATEGORY_COLOR = '#3F4752';
const OAI_RETREAT_CATEGORY_COLOR = '#3F6F5A';
const OAI_RETREAT_LIST_DOT_COLOR = '#c0392b';
function _getRetreatColor(item){return OAI_RETREAT_CATEGORY_COLOR;}
function _getModeMarkerColor(item){return _mode==='shrine'?(TC[item.type]||'#555'):(_mode==='retreat'?_getRetreatColor(item):OAI_CATHEDRAL_CATEGORY_COLOR);}
function _getRouteGuideTarget(){return _mode==='shrine'?'성지':(_mode==='retreat'?'피정의 집':'성당');}
const OAI_ROUTE_VISUAL_DELAY_MS = 260;

// ─── Kakao 공개 설정: index.html 의 window.APP_CONFIG 에서 로드 ────────
// 공개 코드에는 Kakao JavaScript 키와 REST 프록시 주소만 둡니다.
// REST API 키는 Cloudflare Worker 또는 서버 환경변수에만 보관하세요.
/* ═══════════════════════════════════════════════
   §8. 카카오맵 초기화 / API
   ═══════════════════════════════════════════════ */
const JSKEY = (window.APP_CONFIG && window.APP_CONFIG.KAKAO_JS_KEY) || '';
const KAKAO_REST_PROXY_URL = (window.APP_CONFIG && window.APP_CONFIG.KAKAO_REST_PROXY_URL) || '';
(function(){
  if(!JSKEY || !KAKAO_REST_PROXY_URL){
    console.warn(
      '[가톨릭길동무] Kakao 설정이 비어 있습니다.\n' +
      '  JS 키는 도메인 제한 후 공개 코드에 둘 수 있고, REST 호출은 Worker 프록시 URL로 연결해야 합니다.'
    );
  }
})();
function _appendQueryToUrl(url, params){
  const qs = new URLSearchParams(params || {}).toString();
  if(!qs) return url;
  return url + (url.indexOf('?') >= 0 ? '&' : '?') + qs;
}
function _kakaoRestProxyUrl(endpoint, params){
  if(!KAKAO_REST_PROXY_URL) return '';
  return _appendQueryToUrl(KAKAO_REST_PROXY_URL, Object.assign({ endpoint: endpoint }, params || {}));
}
function _kakaoRestFetch(endpoint, params){
  const url = _kakaoRestProxyUrl(endpoint, params);
  if(!url) return Promise.reject(new Error('missing kakao rest proxy url'));
  return fetch(url, { method:'GET', credentials:'omit', cache:'no-store' });
}
function _kakaoDirectionsFetch(origin, destination){
  return _kakaoRestFetch('directions', { origin: origin, destination: destination, priority:'RECOMMEND' });
}
function _kakaoKeywordFetch(query, size, page){
  var params = { query: query, size: String(size || 10) };
  if(page) params.page = String(page);
  return _kakaoRestFetch('keyword', params);
}
function _dedupeKakaoDocs(groups, max){
  var seen = {};
  var docs = [];
  (groups || []).forEach(function(list){
    (list || []).forEach(function(d){
      var key = d.id || [d.place_name, d.x, d.y, d.road_address_name || d.address_name || ''].join('|');
      if(seen[key]) return;
      seen[key] = true;
      docs.push(d);
    });
  });
  return docs.slice(0, max);
}
function _kakaoKeywordDocsFromRest(query, max){
  var pages = Math.ceil(max / 15);
  var jobs = [];
  for(var page=1; page<=pages; page++){
    var size = Math.min(15, max - ((page - 1) * 15));
    jobs.push(
      _kakaoKeywordFetch(query, size, page)
        .then(function(r){ return r.json(); })
        .then(function(data){ return (data && data.documents) ? data.documents : []; })
        .catch(function(){ return []; })
    );
  }
  return Promise.all(jobs).then(function(groups){ return _dedupeKakaoDocs(groups, max); });
}
function _kakaoKeywordDocsFromJs(query, max){
  return new Promise(function(resolve){
    try{
      if(!(window.kakao && kakao.maps && kakao.maps.services && kakao.maps.services.Places)){
        resolve([]);
        return;
      }
      var places = new kakao.maps.services.Places();
      var pageLimit = Math.ceil(max / 15);
      var groups = [];
      var pageCount = 0;
      var settled = false;

      function done(){
        if(settled) return;
        settled = true;
        resolve(_dedupeKakaoDocs(groups, max));
      }

      /* Kakao JS Places는 병렬 page 옵션 호출보다 pagination.nextPage()가 안정적이다.
         page=2가 무시되어 15개만 보이는 문제를 막기 위해 1페이지를 받은 뒤
         pagination 객체로 다음 페이지를 순차 요청한다. */
      var searchOpts = { size: 15 };
      try{ if(kakao.maps.services.SortBy && kakao.maps.services.SortBy.ACCURACY) searchOpts.sort = kakao.maps.services.SortBy.ACCURACY; }catch(_e){}
      places.keywordSearch(query, function(data, status, pagination){
        try{
          var OK = kakao.maps.services.Status.OK;
          if(status === OK && data && data.length){
            groups.push(data);
            pageCount += 1;
            if(_dedupeKakaoDocs(groups, max).length >= max){ done(); return; }
            if(pagination && pagination.hasNextPage && pageCount < pageLimit){
              setTimeout(function(){
                try{ pagination.nextPage(); }catch(_e){ done(); }
              }, 80);
              return;
            }
          }
        }catch(e){
          console.warn('[가톨릭길동무]', e);
        }
        done();
      }, searchOpts);

      setTimeout(done, 4200);
    }catch(e){
      console.warn('[가톨릭길동무]', e);
      resolve([]);
    }
  });
}
function _kakaoKeywordDocs(query, limit){
  var max = Math.max(1, parseInt(limit || 10, 10) || 10);
  return _kakaoKeywordDocsFromRest(query, max).then(function(restDocs){
    restDocs = restDocs || [];
    /* 30개 후보가 필요한 지역검색/일반장소 검색은 REST 프록시와 Kakao JS Places를 합쳐서 채운다.
       프록시가 page=2를 전달하지 못해 1페이지 15개만 돌아와도 JS 2페이지 결과를 합쳐 최대 30개까지 확보한다. */
    if(restDocs.length >= max) return restDocs.slice(0, max);
    return _kakaoKeywordDocsFromJs(query, max).then(function(jsDocs){
      return _dedupeKakaoDocs([restDocs, jsDocs || []], max);
    }).catch(function(){ return restDocs.slice(0, max); });
  }).catch(function(){
    return _kakaoKeywordDocsFromJs(query, max).then(function(jsDocs){ return (jsDocs || []).slice(0, max); });
  });
}
const KAKAO_PLACE_SEARCH_DISPLAY_LIMIT = 30;
const TC    = {'성지':'#c0392b','순례지':'#1565c0','순교 사적지':'#1b7a3e'};
const _DIOS=[['all','전체'],['서울대교구','서울'],['인천교구','인천'],['수원교구','수원'],['의정부교구','의정부'],['춘천교구','춘천'],['원주교구','원주'],['대전교구','대전'],['청주교구','청주'],['대구대교구','대구'],['안동교구','안동'],['부산교구','부산'],['마산교구','마산'],['광주대교구','광주'],['전주교구','전주'],['제주교구','제주'],['군종교구','군종']];

const _SU='https://www.cbck.or.kr/Catholic/Shrine/Read?seq=';
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
      _kakaoDirectionsFetch(origin, dest)
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
const _GO1={enableHighAccuracy:true,timeout:30000,maximumAge:30000};
const _GO2={enableHighAccuracy:false,timeout:25000,maximumAge:600000};
const _GO3={enableHighAccuracy:false,timeout:40000,maximumAge:600000};
const _EC=encodeURIComponent;
const _NS='xmlns="http://www.w3.org/2000/svg"';
const _svgUrl=s=>'data:image/svg+xml;charset=utf-8,'+_EC(s);
const _isMob=/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const _isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
const _TY={'A':'성지','B':'순례지','C':'순교 사적지'};

let _shrineRawLoaded = false;
let _shrineDataLoadPromise = null;
const _SHRINE_ASSET_VERSION='V1-28';
let SHRINES = [];
let JUKRIMGUL_IDX = -1;
function _decodeShrineHomePage(hp){
  if(!hp) return '';
  if(_URL_T[hp.slice(0,2)]) return _URL_T[hp.slice(0,2)] + hp.slice(2);
  if(_URL_T[hp[0]]) return _URL_T[hp[0]] + hp.slice(1);
  return hp;
}
function _buildShrineList(raw){
  return (Array.isArray(raw) ? raw : []).map(function(src){
    const s = Object.assign({}, src);
    if(s.hp) s.hp = _decodeShrineHomePage(s.hp);
    if(_DIO[s.diocese]) s.diocese = _DIO[s.diocese];
    if(_TY[s.type]) s.type = _TY[s.type];
    return s;
  });
}
function _getShrineRawGlobal(){
  try{ if(Array.isArray(window._SH_RAW)) return window._SH_RAW; }catch(e){ console.warn('[가톨릭길동무]', e); }
  return null;
}
function _rebuildShrineSpecialIndexes(){
  try{ JUKRIMGUL_IDX = SHRINES.findIndex(function(s){ return s && s.name === '죽림굴'; }); }catch(e){ JUKRIMGUL_IDX = -1; }
}
function _setShrineRawData(raw, loaded){
  _SH_RAW = Array.isArray(raw) ? raw : [];
  SHRINES = _buildShrineList(_SH_RAW);
  _shrineRawLoaded = loaded !== false && _SH_RAW.length > 0;
  _rebuildShrineSpecialIndexes();
  return SHRINES;
}
function _initShrineDataFromGlobal(){
  const raw = _getShrineRawGlobal();
  return _setShrineRawData(raw || _SH_RAW || [], !!(raw || (_SH_RAW && _SH_RAW.length)));
}
function _ensureShrineDataLoaded(){
  const existingRaw=_getShrineRawGlobal();
  if(existingRaw && (!_shrineRawLoaded || !SHRINES.length)) _setShrineRawData(existingRaw, true);
  if(_shrineRawLoaded && SHRINES.length) return Promise.resolve(SHRINES);
  if(_shrineDataLoadPromise) return _shrineDataLoadPromise;
  _shrineDataLoadPromise=new Promise(function(resolve,reject){
    const already=document.querySelector('script[data-shrine-loader="true"],script[src*="shrines.js"]');
    function finish(){
      const raw=_getShrineRawGlobal();
      if(raw && raw.length){ resolve(_setShrineRawData(raw, true)); }
      else reject(new Error('성지 데이터가 비어 있습니다.'));
    }
    if(already){
      already.addEventListener('load', finish, {once:true});
      already.addEventListener('error', function(){ reject(new Error('성지 데이터 로드 실패')); }, {once:true});
      setTimeout(function(){ try{ if(_getShrineRawGlobal()) finish(); }catch(_e){} }, 0);
      return;
    }
    const sc=document.createElement('script');
    sc.src='shrines.js?v='+_SHRINE_ASSET_VERSION;
    sc.dataset.shrineLoader='true';
    sc.onload=finish;
    sc.onerror=function(){ reject(new Error('성지 데이터 로드 실패')); };
    document.head.appendChild(sc);
  }).catch(function(err){
    _shrineDataLoadPromise=null;
    throw err;
  });
  return _shrineDataLoadPromise;
}
try{ window._setShrineRawData = _setShrineRawData; }catch(e){ console.warn('[가톨릭길동무]', e); }
_initShrineDataFromGlobal();
// ─── 앱 전역 상태 객체 ──────────────────────────────────────────────────────
// 이전에 window 곳곳에 흩어져 있던 수십 개의 전역 변수를 하나의 객체로 통합합니다.
// 기존 코드와의 호환성을 유지하기 위해 아래 "레거시 프록시" 블록에서
// 각 변수를 AppState의 프로퍼티와 연결합니다.
/* ═══════════════════════════════════════════════
   §9. 앱 상태 / 지도 / 탭 / 마커
   ═══════════════════════════════════════════════ */
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
  regionMarker:    null, // 지역검색 기준점 보라색 마커

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
    ['_regionMarker',     'regionMarker'],
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
// Google Play Android 정리본: 모바일 브라우저 안내 로직 제거
// Google Play Android 정리본: 모바일 브라우저 안내 로직 제거
})();

function triggerPwaInstall(){ return false; }


/* ── core.js로 이동: _showBackToast ~ doExit ── */


function oaiEnterView(el){
  if(!el) return;
  try{
    var root=document.documentElement;
    if(root.classList.contains('oai-returning')) return;
    // V3-S: 카테고리 진입은 화면 자체를 fade하지 않고, 완성된 화면 위의
    // 얇은 아이보리 overlay가 0.7초 동안 사라지는 dissolve 방식으로 통일한다.
    // 성지·성당·피정의집 지도형 화면(#app)은 진입 효과를 적용하지 않는다.
    el.classList.remove('oai-enter-ready','oai-enter-show','oai-popup-ready','oai-popup-show','oai-prepaint-view');
    if(el.id === 'app') return;
    var veil=document.getElementById('oai-category-entry-veil');
    if(!veil) return;
    var ms=parseInt(getComputedStyle(root).getPropertyValue('--oai-category-enter-ms'),10) || 700;
    clearTimeout(window.__oaiCategoryDissolveTimer);
    clearTimeout(window.__oaiCategoryVeilTimer);
    veil.style.opacity='1';
    veil.className='soft';
    root.classList.remove('oai-category-dissolving');
    root.classList.add('oai-category-entering','oai-category-dissolve');
    try{ void veil.offsetHeight; }catch(_e){}
    var show=function(){
      try{
        root.classList.add('oai-category-dissolving');
        veil.style.opacity='0';
        window.__oaiCategoryDissolveTimer=setTimeout(function(){
          try{
            root.classList.remove('oai-category-entering','oai-category-dissolve','oai-category-dissolving');
            veil.style.opacity='';
            veil.className='';
          }catch(e){ console.warn("[가톨릭길동무]", e); }
        }, ms + 120);
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    };
    if(window.requestAnimationFrame) requestAnimationFrame(show);
    else setTimeout(show,16);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function oaiEnterPopup(el){
  if(!el) return;
  try{
    var root=document.documentElement;
    if(root.classList.contains('oai-returning')) return;
    // 팝업 전용 fade: 0.5초. 카테고리 진입 0.7초와 분리한다.
    el.classList.remove('oai-popup-ready','oai-popup-show','oai-enter-ready','oai-enter-show','oai-prepaint-view');
    el.classList.add('oai-popup-ready');
    try{ void el.offsetHeight; }catch(_e){}
    var ms=parseInt(getComputedStyle(root).getPropertyValue('--oai-popup-enter-ms'),10) || 500;
    var show=function(){
      try{
        el.classList.add('oai-popup-show');
        clearTimeout(el.__oaiPopupTimer);
        el.__oaiPopupTimer=setTimeout(function(){
          try{ el.classList.remove('oai-popup-ready','oai-popup-show','oai-prepaint-view'); }catch(e){ console.warn("[가톨릭길동무]", e); }
        }, ms + 120);
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    };
    if(window.requestAnimationFrame) requestAnimationFrame(show);
    else setTimeout(show,16);
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
        // 성지·성당·피정의집 지도형 화면은 별도 진입 fade를 적용하지 않는다.
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    }, 230);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}


function oaiPreopenNearbySheetForCategory(){
  // 성지·성당·피정의집 첫 진입 시 지도/배경이 먼저 보이는 깜빡임을 막기 위해
  // 지도 로딩 전에 내 주변 시트를 아이보리 배경 상태로 먼저 고정한다.
  // 실제 거리 계산과 목록 렌더링은 기존 openTab('nearby')가 그대로 처리한다.
  try{
    if(!(_mode==='shrine' || _mode==='parish' || _mode==='retreat')) return;
    _updateSheetPanelTitles();
    ['list','region','route'].forEach(function(n){
      var s=$('sheet-'+n);
      if(s){
        s.classList.remove('open','from-left','from-right','exit-left','exit-right','oai-preopen-nearby');
      }
    });
    var sheet=$('sheet-nearby');
    var body=$('nearby-body');
    if(sheet){
      sheet.style.display='';
      sheet.classList.remove('from-left','from-right','exit-left','exit-right');
      sheet.classList.add('open','oai-preopen-nearby');
    }
    if(body){
      body.innerHTML='<div class="empty-msg">📍 위치 권한 상태를 확인하는 중...</div>';
      try{ body.scrollTop=0; }catch(_e){}
    }
    if(typeof _updateTabBtns==='function') _updateTabBtns('nearby');
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}

/* ═══════════════════════════════════════════════
   §10. 앱 진입점 — startApp, goToCover
   ═══════════════════════════════════════════════ */
function startApp(mode){
  if(mode==='shrine' && (!_shrineRawLoaded || !SHRINES.length)){
    _mode='shrine';
    try{
      const cover=$('cover');
      if(cover) cover.style.display='none';
      if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
      document.documentElement.classList.add('app-active');
      document.documentElement.classList.remove('parish-mode','retreat-mode');
      const mapEl=$('map');
      if(mapEl) mapEl.innerHTML='<div class="map-loading"><div class="map-loading-icon">✝</div><div class="map-loading-txt">성지 정보를 불러오는 중...</div></div>';
    }catch(e){ console.warn('[가톨릭길동무]', e); }
    _ensureShrineDataLoaded().then(function(){ startApp('shrine'); }).catch(function(err){
      console.warn('[가톨릭길동무] 성지 데이터 로드 실패', err);
      try{ alert('성지 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }catch(_e){}
      try{ if(typeof goToCover==='function') goToCover(); }catch(_e){}
      try{ if(typeof oaiHideCategoryEntryVeil==='function') oaiHideCategoryEntryVeil(); }catch(_e){}
    });
    return;
  }
  if(mode==='retreat' && (!_retreatRawLoaded || !RETREATS.length)){
    _mode='retreat';
    try{
      const cover=$('cover');
      if(cover) cover.style.display='none';
      if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
      document.documentElement.classList.add('app-active','retreat-mode');
      document.documentElement.classList.remove('parish-mode');
      const mapEl=$('map');
      if(mapEl) mapEl.innerHTML='<div class="map-loading"><div class="map-loading-icon">🏔</div><div class="map-loading-txt">피정의집 정보를 불러오는 중...</div></div>';
    }catch(e){ console.warn('[가톨릭길동무]', e); }
    _ensureRetreatDataLoaded().then(function(){ startApp('retreat'); }).catch(function(err){
      console.warn('[가톨릭길동무] 피정의집 데이터 로드 실패', err);
      try{ alert('피정의집 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }catch(_e){}
      try{ if(typeof goToCover==='function') goToCover(); }catch(_e){}
      try{ if(typeof oaiHideCategoryEntryVeil==='function') oaiHideCategoryEntryVeil(); }catch(_e){}
    });
    return;
  }
  if(mode==='parish' && !_PARISH_SPLIT_LAZY_MODE && (!_parishRawLoaded || !PARISHES.length)){
    _mode='parish';
    try{
      const cover=$('cover');
      if(cover) cover.style.display='none';
      if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
      document.documentElement.classList.add('app-active','parish-mode');
      document.documentElement.classList.remove('retreat-mode');
      const mapEl=$('map');
      if(mapEl) mapEl.innerHTML='<div class="map-loading"><div class="map-loading-icon">✝</div><div class="map-loading-txt">성당 정보를 불러오는 중...</div></div>';
    }catch(e){ console.warn('[가톨릭길동무]', e); }
    _ensureParishDataLoaded().then(function(){ startApp('parish'); }).catch(function(err){
      console.warn('[가톨릭길동무] 성당 데이터 로드 실패', err);
      try{ alert('성당 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }catch(_e){}
      try{ if(typeof goToCover==='function') goToCover(); }catch(_e){}
      try{ if(typeof oaiHideCategoryEntryVeil==='function') oaiHideCategoryEntryVeil(); }catch(_e){}
    });
    return;
  }
  _mode=mode;
  _filterDio='all';
  _listSrch='';
  window._noAutoNearby = false;  // 직접 진입 시 nearby 열기 허용
  try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  _regionLat=null; _regionLng=null; _regionCache=[];
  _regionName=''; _regionPlaceName='';
  _routeRegionStart=null;
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
  if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
  document.documentElement.classList.add('app-active');
  document.documentElement.classList.toggle('parish-mode',mode==='parish');
  document.documentElement.classList.toggle('retreat-mode',mode==='retreat');
  const _setTxt=(id,v)=>{const el=$(id);if(el)el.textContent=v;};
  const listLbl = mode==='parish' ? '성당찾기' : (mode==='retreat' ? '피정의집 찾기' : '성지찾기');
  const listSearchInput=$('list-srch-inp');
  if(listSearchInput){
    const ph = mode==='parish' ? '선택 교구 성당명, 주소 검색' : '이름, 주소 검색';
    listSearchInput.placeholder = ph;
    listSearchInput.setAttribute('aria-label', ph);
  }
  _setTxt('tab-nearby-lbl', '내주변');
  _setTxt('tab-list-lbl', listLbl);
  $('legend').style.display = mode==='shrine'?'block':'none';
  if(mode==='shrine' || mode==='retreat'){
    try{ oaiPreopenNearbySheetForCategory(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }

  // 표지→카테고리 진입 시 항상 지도 완전 리셋 (마커 잔류 방지)
  _resetMapState();
  _mapInited=true;
  // RAF로 지연: UI가 먼저 업데이트된 후 무거운 지도 로딩 시작 → 버벅거림 방지
  requestAnimationFrame(function(){ setTimeout(_loadMap, 0); });
}

function _resetMapState(){
  // 지도 인스턴스 제거
  try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]', e); }
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
  try{
    if(document.querySelector('#web-view.open,#trail-view.open,#diocese-view.open,#missa-view.open') && typeof oaiHoldStabilityVeil === 'function') oaiHoldStabilityVeil('view-close', 260);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  closeTab(_activeTab);
  closeInfoCard();
  resetRoute();
  // 모든 마커 지도에서 제거
  _markers.forEach(m=>{if(m)try{m.marker.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }});
  _retreatMarkers.forEach(o=>{try{o.marker.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }});
  Object.values(_dioMkrs).forEach(arr=>arr.forEach(mk=>{try{mk.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); }}));
  if(_paSelMkr){try{_paSelMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _paSelMkr=null;}
  try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]',e); }
  try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); }
  if(_myMkr){try{_myMkr.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } _myMkr=null;}
  _screen='cover';
  if(typeof oaiSetMainMapLayerHidden==='function') oaiSetMainMapLayerHidden(false);
  document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
  const _coverEl=$('cover');
  if(_coverEl){
    _coverEl.style.display='';
    _coverEl.style.opacity='';
    _coverEl.style.pointerEvents='';
    _coverEl.scrollTop=0;
  }
  // 커버로 돌아오는 모든 경로는 새 종료 대기 상태로 시작해야 한다.
  // 정상 카테고리뿐 아니라 팝업/기도문/외부복귀 경로에서도
  // 이전 _exitReady=true가 남아 커버 첫 뒤로가기에서 바로 종료되는 것을 막는다.
  try{ if(typeof _resetCoverExitReady === 'function') _resetCoverExitReady(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  // 갤럭시 폴드처럼 화면 크기가 바뀐 뒤 커버로 돌아오는 경우, 현재 화면 기준으로 한 번 더 고정한다.
  try{
    if(typeof window.oaiSettleCoverSize === 'function'){
      window.oaiSettleCoverSize('cover-return');
      setTimeout(function(){ window.oaiSettleCoverSize('cover-return-late'); }, 180);
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
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
  sc.src=`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${JSKEY}&autoload=false&libraries=services`;
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
  if(_mode==='parish') { _buildParishDioSystem(); _syncParishDioLabels(); }
  else if(_mode==='retreat') _buildRetreatMarkers();
  // _noAutoNearby 플래그: 복귀 시 내주변 탭 자동 열기 방지
  if(!window._noAutoNearby){
    // V3-S: 성당 첫 진입도 기존 기준대로 내주변 탭을 먼저 연다.
    // 교구별 분리 구조는 유지하되, 성당찾기 탭으로 자동 전환하지 않는다.
    openTab('nearby');
  }
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
  // 길찾기 복귀는 시트가 내려가기 시작한 뒤 경로/마커를 정리한다.
  // 즉시 resetRoute를 실행하면 지도·마커·시트가 한 프레임에 바뀌어 화면이 너무 빨리 튀어 보인다.
  _closeSheetOnly('route');
  if(_activeTab==='route') _activeTab=null;
  _updateTabBtns(null);
  setTimeout(function(){
    try{ resetRoute(); }catch(e){ console.warn('[가톨릭길동무]', e); }
    _routeMode=false;
    try{ _exitRouteMode(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }, OAI_ROUTE_VISUAL_DELAY_MS);
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


/* ═══════════════════════════════════════════════
   §11. 탭 / 시트 관리
   ═══════════════════════════════════════════════ */
function openTab(name, opts){
  opts = opts || {};
  var shouldAutoFocusKeyboard = opts.keyboard === true;
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
  if(name==='route' && _routeRegionStart && _routeRegionStart.lat && _regionCache && _regionCache.length){
    try{ _showRegionItemsOnMap(_regionCache, _routeRegionStart.lat, _routeRegionStart.lng, {center:false}); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }else if(!(_mode==='parish' && name==='nearby')) _restoreMapMarkers();
  else { try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]',e); } }
  _resetTabWork(name);
  _activeTab=name;

  // ── 새 탭 진입 (스와이프 방향에서 들어옴) ──
  const sheet=$('sheet-'+name);
  if(sheet){ sheet.classList.remove('oai-preopen-nearby'); }
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
  else if(name==='list')  { renderList(); if(shouldAutoFocusKeyboard) oaiFocusSearchKeyboardInput('list-srch-inp'); }
  else if(name==='region'){ if(shouldAutoFocusKeyboard) oaiFocusSearchKeyboardInput('region-inp'); }
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
    // 경로 복귀 시 시트 닫힘과 지도/마커 복원이 동시에 일어나지 않게 기존 reset 흐름을 약간 늦춘다.
    setTimeout(function(){
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
    }, OAI_ROUTE_VISUAL_DELAY_MS);
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
    try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]', e); }
    _regionLat=null;_regionLng=null;_regionCache=[];
    _routeRegionStart=null;
    const ri=$('region-inp'); if(ri) ri.value='';
    const rb=$('region-body');
    if(rb) rb.innerHTML=_regionGuideHtml();
  }
  _scrollSheetTop(name);
}

function toggleTab(name){
  if(_activeTab===name){
    // 같은 탭을 다시 눌러 목록을 다시 올릴 때도 인포카드는 남기지 않는다.
    closeInfoCard({keepMap:true});
    _resetTabWork(name);
    if(name==='nearby') _loadNearby();
    else if(name==='list') { renderList(); oaiFocusSearchKeyboardInput('list-srch-inp'); }
    else if(name==='region'){
      try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      _regionLat=null;_regionLng=null;_regionCache=[];
      const ri=$('region-inp'); if(ri) ri.value='';
      const rb=$('region-body');
      if(rb) rb.innerHTML=_regionGuideHtml();
      oaiFocusSearchKeyboardInput('region-inp');
    }
    else if(name==='route'){ resetRoute({fresh:true}); _enterRouteMode(); }
    setTimeout(()=>_scrollSheetTop(name),30);
    return;
  }
  if(name==='route') resetRoute({fresh:!(_routeRegionStart&&_routeRegionStart.lat)});
  openTab(name, {keyboard:true});
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
  try{ if(typeof window.oaiKeepActiveTabsVisible === 'function') window.oaiKeepActiveTabsVisible('map-tab'); }catch(e){ console.warn("[가톨릭길동무]", e); }
}

function oaiScrollActiveTabIntoView(container, behavior){
  try{
    if(!container) return false;
    var active = container.querySelector('.active,.on,[aria-selected="true"],[aria-pressed="true"]');
    if(!active) return false;
    if(active === container) return false;
    active.scrollIntoView({behavior: behavior || 'smooth', block:'nearest', inline:'center'});
    return true;
  }catch(e){ console.warn("[가톨릭길동무]", e); return false; }
}
function oaiKeepActiveTabsVisible(reason){
  try{
    var selectors = [
      '#tabbar',
      '#prayer-tabs',
      '#web-cats',
      '.trail-tabs',
      '.qna-tabs',
      '#srch-modal #sm-tab-bar',
      '#sm-tab-bar'
    ];
    selectors.forEach(function(sel){
      document.querySelectorAll(sel).forEach(function(container){
        oaiScrollActiveTabIntoView(container, reason === 'instant' ? 'auto' : 'smooth');
      });
    });
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
window.oaiKeepActiveTabsVisible = oaiKeepActiveTabsVisible;
document.addEventListener('click', function(e){
  try{
    var t = e.target;
    if(!t || !t.closest) return;
    if(!t.closest('.tab-btn,.pr-tab,.web-cat-btn,.trail-tab,.qna-tab,.sm-tab,.filter-btn')) return;
    setTimeout(function(){ oaiKeepActiveTabsVisible('click'); }, 30);
    setTimeout(function(){ oaiKeepActiveTabsVisible('click-late'); }, 220);
  }catch(err){ console.warn("[가톨릭길동무]", err); }
}, true);

function _getInfoCardCenterTargetY(mapH){
  // V37: 성지·성당·피정 지도 중심은 항상 인포카드가 올라왔을 때의 기준으로 통일한다.
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

function _getRouteBoundsPadding(){
  const mapEl = $('map-wrap') || $('map');
  const mapH = (mapEl && (mapEl.clientHeight || mapEl.offsetHeight)) || window.innerHeight || 700;
  const tabH = ($('tabbar') && $('tabbar').offsetHeight) || 54;
  const sheet = $('sheet-route');
  let sheetH = 0;
  try{
    if(sheet && sheet.classList.contains('open')){
      const r = sheet.getBoundingClientRect ? sheet.getBoundingClientRect() : null;
      sheetH = Math.ceil((r && r.height) || sheet.offsetHeight || 0);
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  const bottomMin = 172;
  const bottomMax = Math.max(210, Math.round(mapH * 0.62));
  const bottom = Math.min(bottomMax, Math.max(bottomMin, sheetH + 28));
  return { top: tabH + 12, right: 52, bottom: bottom, left: 52 };
}
function _fitRouteBounds(bounds, opts){
  if(!_map || !bounds) return false;
  const pad = _getRouteBoundsPadding();
  try{
    _map.setBounds(bounds, pad.top, pad.right, pad.bottom, pad.left);
    if(opts && opts.repeat){
      setTimeout(function(){ try{ const p=_getRouteBoundsPadding(); _map.setBounds(bounds, p.top, p.right, p.bottom, p.left); }catch(e){ console.warn('[가톨릭길동무]', e); } }, 90);
      setTimeout(function(){ try{ const p=_getRouteBoundsPadding(); _map.setBounds(bounds, p.top, p.right, p.bottom, p.left); }catch(e){ console.warn('[가톨릭길동무]', e); } }, 260);
    }
    return true;
  }catch(e1){
    try{ _map.setBounds(bounds); return true; }
    catch(e2){ console.warn('[가톨릭길동무]', e2); }
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

/* ═══════════════════════════════════════════════
   §12. 인포카드 / 마커 선택
   ═══════════════════════════════════════════════ */
function selectItem(idx, opts={}){
  const items = _getCurrentItems();
  const item  = items[idx];
  if(!item) return;
  const fromSearchList = !!(_listSrch && _listSrch.trim());
  _curFromRegion = !!(opts.fromRegion && _regionLat);
  closeAllTabs();
  if(_mode==='shrine'){
  if(opts.fromRegion){
   if(!_showRegionSelectionMapIfActive()) _restoreAllCategoryMarkersForSelection();
  } else if(fromSearchList){
   _restoreAllCategoryMarkersForSelection();
  } else if(opts.fromNearby && _nearbyCache.length>0){
   _showItemsOnMap(_nearbyCache);
  } else {
   _restoreMapMarkers();
  }
  _selectShrineMarker(idx);
  } else if(_mode==='parish') {
  if(opts.fromRegion) _showRegionSelectionMapIfActive();
  _selectParishMarker(item);
  } else {
  if(opts.fromRegion){
   if(!_showRegionSelectionMapIfActive()) _restoreAllCategoryMarkersForSelection();
  } else if(fromSearchList) _restoreAllCategoryMarkersForSelection();
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
    const res=await _kakaoDirectionsFetch(`${_myLng},${_myLat}`, `${_snap.lng},${_snap.lat}`);
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
    const hpUrl = normalizeCatholicExternalUrl(item.hp);
    hp.href = hpUrl;
    hp.target = '_self';
    hp.rel = 'noopener';
    hp.onclick = function(e){
      e.preventDefault();
      e.stopPropagation();
      openCoreExternalUrl(hpUrl,{infoIdx:idx, source:'homepage'});
    };
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
  // V37: 시트 전환으로 닫을 때는 지도 중심을 다시 움직이지 않는다.
  // 사용자가 X/지도 터치로 인포카드만 닫을 때는 기존 V37 기준 중심을 유지한다.
  if(!opts.keepMap && wasItem && wasItem.item && wasItem.item.lat && _map){
    try{ _focusMarkerAboveInfoCard(wasItem.item); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
}

function openInAppRoute(){
  if(!_curInfoItem) return;
  const {item, idx}=_curInfoItem;
  if(!item.lat||!item.lng) return;

  function doRoute(spLat, spLng, spName){
  // 길찾기 시작 시 인포카드 닫힘 때문에 지도 중심이 먼저 움직이면,
  // 곧바로 이어지는 경로 bounds 보정과 겹쳐 화면이 크게 흔들린다.
  // 길찾기 흐름에서는 지도를 움직이지 않고 카드만 닫는다.
  closeInfoCard({keepMap:true});
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
  setTimeout(function(){ try{ _calcRoute(); }catch(e){ console.warn('[가톨릭길동무]', e); } }, OAI_ROUTE_VISUAL_DELAY_MS);
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
  doRoute(_myLat, _myLng, '현위치');
  } else {
  if(!_GEO){ alert('위치 정보를 지원하지 않습니다.'); return; }
  _requestCurrentPositionStable(
   function(p){ _setMyLoc(p.coords.latitude, p.coords.longitude); doRoute(p.coords.latitude, p.coords.longitude, '현위치'); },
   function(err){ alert(_geoErrorMessage(err)); }
  );
  }
}

function openKakaoNav(){
  if(!_curInfoItem) return;
  const {item,idx}=_curInfoItem;
  const isJuk = _mode==='shrine' && idx === JUKRIMGUL_IDX && JUKRIMGUL_IDX >= 0;
  const navItem = isJuk ? {...item, lat:JUKRIMGUL_PARKING.lat, lng:JUKRIMGUL_PARKING.lng, kw:JUKRIMGUL_PARKING.kw, name:JUKRIMGUL_PARKING.name} : item;
  const ep=_EC(navItem.kw||navItem.name);
  function launch(spLat,spLng,spName){
  const spLabel=_EC(spName||'현위치');
  const w=spLat?`https://map.kakao.com/link/from/${spLabel},${spLat},${spLng}/to/${ep},${navItem.lat},${navItem.lng}`:
         `https://map.kakao.com/link/to/${ep},${navItem.lat},${navItem.lng}`;
  const a=spLat?`kakaomap://route?sp=${spLat},${spLng}&ep=${navItem.lat},${navItem.lng}&by=CAR`:
         `kakaomap://route?ep=${navItem.lat},${navItem.lng}&by=CAR`;
  _kakaoLaunch(w,a);
  }
  if(_curFromRegion && _regionLat && _regionLng) launch(_regionLat,_regionLng,_regionPlaceName||_regionName||'검색지');
  else if(_myLat) launch(_myLat,_myLng);
  else if(_GEO){
  _requestCurrentPositionStable(function(p){ launch(p.coords.latitude,p.coords.longitude); },
   function(){ launch(null,null); },{noRefine:true});
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
  // v1: iPhone/Android marker cross uses SVG bars, not an emoji/text glyph.
  // This removes the purple emoji background and keeps a plain white cross.
  const crossBig = `<g fill="#fff" opacity="0.96"><rect x="18.45" y="10.5" width="3.1" height="18.5" rx="1.1"/><rect x="13.4" y="16.3" width="13.2" height="3.1" rx="1.1"/></g>`;
  const crossSmall = `<g fill="#fff" opacity="0.96"><rect x="12.85" y="7.8" width="2.3" height="12.8" rx="0.8"/><rect x="9.6" y="11.7" width="8.8" height="2.3" rx="0.8"/></g>`;
  const svg=big?
  `<svg ${_NS} width="40" height="52" viewBox="0 0 40 52"><path d="M20 0C8.954 0 0 8.954 0 20c0 14.21 20 32 20 32S40 34.21 40 20C40 8.954 31.046 0 20 0z" fill="${color}"/>${crossBig}</svg>`:
  `<svg ${_NS} width="28" height="36" viewBox="0 0 28 36"><path d="M14 0C6.268 0 0 6.268 0 14c0 9.941 14 22 14 22S28 23.941 28 14C28 6.268 21.732 0 14 0z" fill="${color}" opacity="0.92"/>${crossSmall}</svg>`;
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

function _mkrImgRegion(){
  const color='#7B2FBE';
  const svg=`<svg ${_NS} width="42" height="54" viewBox="0 0 42 54">
    <ellipse cx="21" cy="51" rx="8" ry="3" fill="rgba(0,0,0,.22)"/>
    <path d="M21 1C9.95 1 1 9.95 1 21c0 14.2 20 31 20 31s20-16.8 20-31C41 9.95 32.05 1 21 1z" fill="${color}" stroke="white" stroke-width="2"/>
    <circle cx="21" cy="21" r="10.5" fill="white" opacity=".95"/>
    <circle cx="21" cy="21" r="5.2" fill="${color}" opacity=".95"/>
  </svg>`;
  return new _MI(_svgUrl(svg),new _SZ(42,54),{offset:new _PT(21,52)});
}
function _clearRegionMarker(){
  try{ if(_regionMarker){ _regionMarker.setMap(null); _regionMarker=null; } }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _showRegionMarker(lat,lng,name){
  if(!_map||!lat||!lng||typeof _LL==='undefined'||typeof _MM==='undefined') return;
  try{
    _clearRegionMarker();
    _regionMarker=new _MM({
      position:new _LL(lat,lng),
      image:_mkrImgRegion(),
      title:name||'검색 위치',
      zIndex:500
    });
    _regionMarker.setMap(_map);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _regionMapLevelFor(items, lat, lng){
  let maxKm=0;
  try{
    (items||[]).forEach(function(p){
      if(!p||!p.lat||!p.lng) return;
      maxKm=Math.max(maxKm, calcDist(lat,lng,p.lat,p.lng));
    });
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  if(maxKm<=1.8) return 5;
  if(maxKm<=3.5) return 6;
  if(maxKm<=7) return 7;
  if(maxKm<=14) return 8;
  if(maxKm<=28) return 9;
  if(maxKm<=55) return 10;
  if(maxKm<=95) return 11;
  return 12;
}
function _centerRegionMap(lat,lng,items){
  if(!_map||!lat||!lng||typeof _LL==='undefined') return;
  try{
    const pos=new _LL(lat,lng);
    if(typeof _map.setLevel==='function') _map.setLevel(_regionMapLevelFor(items,lat,lng));
    _map.setCenter(pos);
    setTimeout(function(){ try{ if(_map) _map.setCenter(pos); }catch(e){ console.warn('[가톨릭길동무]', e); } }, 80);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _showRegionParishMarkers(items){
  if(_mode!=='parish'||!_map||!Array.isArray(items)||typeof _LL==='undefined') return;
  try{
    _clearParishNearbyMarkers();
    try{ _hideDioOverlays(); }catch(_e){}
    Object.keys(_dioMkrs||{}).forEach(function(code){
      (_dioMkrs[code]||[]).forEach(function(mk){ try{ mk.setMap(null); }catch(e){ console.warn('[가톨릭길동무]', e); } });
    });
    _activeDio=null;
    if(_paSelMkr){ try{ _paSelMkr.setMap(null); }catch(e){ console.warn('[가톨릭길동무]', e); } _paSelMkr=null; }
    if(!items.length) return;
    const arr=[];
    items.forEach(function(p){
      if(!p||!p.lat||!p.lng||p.lat===0||p.lng===0) return;
      const idx=PARISHES.indexOf(p);
      const mk=new _MM({
        position:new _LL(p.lat,p.lng),
        image:_mkrImg(OAI_CATHEDRAL_CATEGORY_COLOR,false),
        title:p.name,
        zIndex:60
      });
      kakao.maps.event.addListener(mk,'click',function(){
        if(_routeMode) _selectRouteItem(idx);
        else selectItem(idx,{fromRegion:true});
      });
      mk.setMap(_map);
      arr.push(mk);
    });
    if(AppState) AppState.nearbyParishMarkers=arr;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function _showRegionItemsOnMap(items, lat, lng, opts){
  opts=opts||{};
  if(!_map||!lat||!lng) return;
  const list=Array.isArray(items)?items.filter(function(p){ return p&&p.lat&&p.lng&&p.lat!==0&&p.lng!==0; }):[];
  try{
    if(_mode==='shrine'){
      _clearShrineMarkerSel();
      _markers.forEach(function(m){
        if(!m||!m.marker||!m.shrine) return;
        const on=list.indexOf(m.shrine)>=0;
        m.marker.setMap(on?_map:null);
        if(on){
          m.marker.setImage(_mkrImg(_typeColor(m.shrine.type),false));
          m.marker.setZIndex(40);
        }
      });
    }else if(_mode==='retreat'){
      if(!_retreatMarkers.length) _buildRetreatMarkers();
      _retreatMarkers.forEach(function(o){
        if(!o||!o.marker||!o.item) return;
        const on=list.indexOf(o.item)>=0;
        o.marker.setMap(on?_map:null);
        if(on){
          o.marker.setImage(_mkrImgRetreat('#2e7d32',false));
          o.marker.setZIndex(45);
        }
      });
      if(_paSelMkr){ try{ _paSelMkr.setMap(null); }catch(e){ console.warn('[가톨릭길동무]', e); } _paSelMkr=null; }
    }else if(_mode==='parish'){
      _showRegionParishMarkers(list);
    }
    _showRegionMarker(lat,lng,_regionPlaceName||_regionName||'검색 위치');
    if(opts.center!==false) _centerRegionMap(lat,lng,list);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
function showRegionPlaceOnMap(){
  if(!_regionLat||!_regionLng) return;
  try{
    document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
    _showRegionItemsOnMap(_regionCache||[], _regionLat, _regionLng, {center:true});
    _closeSheetOnly('region');
    if(_activeTab==='region') _activeTab=null;
    _updateTabBtns(null);
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}
try{ window.showRegionPlaceOnMap=showRegionPlaceOnMap; }catch(e){ console.warn('[가톨릭길동무]', e); }

function _isRegionItemContextActive(item){
  // 지역검색 지도 상태에서 성지/피정/성당 마커를 눌렀을 때
  // 인포카드·길찾기 출발지를 현재 위치가 아니라 검색 위치로 유지한다.
  // 새 이벤트를 덧씌우지 않고 기존 마커 클릭 판단 안에서만 지역검색 컨텍스트를 판별한다.
  try{
    if(!item || !_regionLat || !_regionLng || !_routeRegionStart || !_routeRegionStart.lat) return false;
    if(!Array.isArray(_regionCache) || !_regionCache.length) return false;
    if(_regionCache.indexOf(item) >= 0) return true;
    return _regionCache.some(function(p){
      return p && Number(p.lat)===Number(item.lat) && Number(p.lng)===Number(item.lng) && p.name===item.name;
    });
  }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
}

function _showRegionSelectionMapIfActive(){
  try{
    if(_regionLat && _regionLng && _regionCache && _regionCache.length){
      _showRegionItemsOnMap(_regionCache, _regionLat, _regionLng, {center:false});
      return true;
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  return false;
}

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
     else selectItem(index,{fromRegion:_isRegionItemContextActive(SHRINES[index])});
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
    /* 성당 카테고리의 교구명은 지도 위 선택 버튼이다.
       선택된 교구만 숨기고, 나머지 교구명은 계속 표시한다. */
    const keepCode = (AppState && AppState.nearbyParishDioCode) || _activeDio || null;
    if(keepCode){
      if(_activeDio && _activeDio!==keepCode){
        try{ _hideParishDioMkrs(_activeDio); }catch(e){ console.warn('[가톨릭길동무]',e); }
      }
      _activeDio=keepCode;
      _showParishDioMkrs(keepCode);
      _syncParishDioLabels();
      return;
    }
    _syncParishDioLabels();
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
    /* V37
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

    // 지도에는 해당 교구의 성당 마커 전체를 표시한다.
    // 교구명 라벨은 선택된 교구만 숨기고 나머지는 지도 위 선택 버튼으로 유지한다.
    if(_paSelMkr){ try{ _paSelMkr.setMap(null); }catch(e){ console.warn('[가톨릭길동무]',e); } _paSelMkr=null; }
    _activeDio = code;
    _showParishDioMkrs(code);
    _syncParishDioLabels();

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
    _syncParishDioLabels();
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
  'ML':{n:'군종교구',  lat:37.530,lng:126.972,c:'#5D6D7E'},

};

const _PARISH_DIO_CODE_MAP={'서울대교구':'SE','인천교구':'IC','수원교구':'SW','의정부교구':'UJ',
  '춘천교구':'CC','원주교구':'WJ','대전교구':'DJ','청주교구':'CJ','대구대교구':'DG',
  '안동교구':'AD','부산교구':'BS','마산교구':'MS','광주대교구':'GJ','전주교구':'JJ',
  '제주교구':'JE','군종교구':'ML'};
function _parishDioCodeOf(p){
  return p && p.diocese ? (_PARISH_DIO_CODE_MAP[p.diocese] || null) : null;
}

function _isParishDioBoundsOutlier(p, code){
  if(!p) return false;
  const name=String(p.name||'');
  const addr=String(p.addr||'');
  // 교구 전체 보기의 중심/범위 계산에서만 섬 지역을 제외한다.
  // 목록·검색·개별 성당 선택·길찾기 데이터는 그대로 유지한다.
  if(code==='IC' && (addr.indexOf('인천 옹진군')>=0 || name.indexOf('백령')>=0 || addr.indexOf('백령')>=0 || name.indexOf('대청')>=0 || addr.indexOf('대청')>=0 || name.indexOf('연평')>=0 || addr.indexOf('연평')>=0 || name.indexOf('덕적')>=0 || addr.indexOf('덕적')>=0)) return true;
  if(code==='DG' && (addr.indexOf('울릉')>=0 || name.indexOf('울릉')>=0)) return true;
  return false;
}

// 교구별 성당 목록 (코드 기준 분류)
let _PA_BY_DIO={};
function _rebuildParishDioIndex(){
  const m={};
  PARISHES.forEach(p=>{
    const code=_parishDioCodeOf(p)||'ETC';
    (m[code]||(m[code]=[])).push(p);
  });
  _PA_BY_DIO=m;
  return _PA_BY_DIO;
}
_parishDioIndexReady=true;
_rebuildParishDioIndex();

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
    if(_isParishDioBoundsOutlier(p, code)) return;
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
    // V37: 현재 위치/내 주변/선택 성당 모두 인포카드 기준 중심으로 통일한다.
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
    // V3-S: 군종교구는 데이터/검색에는 남기되 지도 위 교구 라벨에서는 제외한다.
    if(code==='ML') return;
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
    // 성당 카테고리에서 교구명은 지도 위 선택 버튼이므로 기본 표시한다.
    try{ ov.setMap(_map); if(typeof ov.setZIndex==='function') ov.setZIndex(10000); }catch(e){ console.warn('[가톨릭길동무]',e); }
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

function _isParishRouteLineActive(){
  return _mode==='parish' && !!_polyline;
}
function _showDioOverlays(){
  if(_isParishRouteLineActive()){
    _hideDioOverlays();
    return;
  }
  Object.values(_dioOverlays).forEach(ov=>{ try{ov.setMap(_map);}catch(e){ console.warn("[가톨릭길동무]", e); } });
}
function _hideDioOverlays(){
  Object.values(_dioOverlays).forEach(ov=>{ try{ov.setMap(null);}catch(e){ console.warn("[가톨릭길동무]", e); } });
}

function _syncParishDioLabels(){
  if(_mode!=='parish' || !_map) return;
  // 성당 길찾기 경로가 지도에 표시된 동안에는 출발/도착 마커와 경로선만 보이도록
  // 교구 라벨을 다시 띄우지 않는다. 지도 idle/복귀 보정에서 이 함수가 재호출되어도 유지된다.
  if(_isParishRouteLineActive()){
    _hideDioOverlays();
    return;
  }
  if(!_parishSysInited){ try{ _buildParishDioSystem(); }catch(e){ console.warn('[가톨릭길동무]',e); } }
  Object.entries(_dioOverlays||{}).forEach(function(pair){
    const code=pair[0], ov=pair[1];
    try{ ov.setMap(_map); if(typeof ov.setZIndex==='function') ov.setZIndex(10000); }catch(e){ console.warn('[가톨릭길동무]',e); }
    const el = ov && typeof ov.getContent==='function' ? ov.getContent() : null;
    if(el && el.style){
      el.style.display = (code===_activeDio) ? 'none' : '';
      el.style.visibility = 'visible';
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
      el.style.zIndex = '10000';
      el.style.transform = '';
    }
  });
}

function _toggleParishDio(code){
  if(_mode==='parish' && !_isParishDioceseReady(code)){
    _showParishDataLoadingMessage((_DIO[code]||'해당 교구')+' 성당 정보를 불러오는 중입니다...');
    _ensureParishDioceseDataLoaded(code).then(function(){ _toggleParishDio(code); }).catch(function(err){
      console.warn('[가톨릭길동무] 성당 교구 데이터 로드 실패', err);
      try{ alert('성당 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.'); }catch(_e){}
    });
    return;
  }
  if(_activeDio===code){
    _hideParishDioMkrs(code);
    _activeDio=null;
    _syncParishDioLabels();
    return;
  }
  if(_activeDio) _hideParishDioMkrs(_activeDio);
  _activeDio=code;
  _showParishDioMkrs(code);
  _syncParishDioLabels();
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
      if(_isParishDioBoundsOutlier(p, code)) return;
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
  if(_isParishRouteLineActive()){
    try{ _hideParishDioMkrs(code); }catch(e){ console.warn('[가톨릭길동무]',e); }
    return;
  }
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
        else selectItem(idx,{fromNearby:false,fromRegion:_isRegionItemContextActive(p)});
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
  if(_isParishRouteLineActive()){
    mkrs.forEach(mk=>{
      try{ mk.setMap(null); }catch(e){ console.warn('[가톨릭길동무]',e); }
    });
    return;
  }
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
        else selectItem(idx,{fromNearby:false,fromRegion:_isRegionItemContextActive(p)});
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

function _isInstalledLikeApp(){
  try{
    if(window.matchMedia && (window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches)) return true;
    if(navigator.standalone === true) return true;
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  return false;
}
function _geoPermissionState(){
  try{
    if(!navigator.permissions || !navigator.permissions.query) return Promise.resolve('unknown');
    return navigator.permissions.query({name:'geolocation'}).then(function(result){
      return result && result.state ? result.state : 'unknown';
    }).catch(function(){ return 'unknown'; });
  }catch(e){
    return Promise.resolve('unknown');
  }
}
function _geoRuntimeGuideText(){
  if(_isInstalledLikeApp()){
    return '설정 > 앱 > 가톨릭길동무 > 권한 > 위치에서 “앱 사용 중 허용”과 “정확한 위치 사용”을 켜 주세요.\n그래도 안 되면 설정 > 위치에서 위치 서비스와 Google 위치 정확도를 켠 뒤 앱을 완전히 종료하고 다시 실행해 주세요.';
  }
  return '브라우저 또는 앱의 사이트 설정에서 위치 권한을 허용하고, 휴대폰 위치 서비스와 정확한 위치 사용을 켠 뒤 다시 시도해 주세요.';
}
function _geoDeniedGuideText(){
  if(_isInstalledLikeApp()){
    return '휴대폰 설정 > 앱 > 가톨릭길동무 > 권한 > 위치에서 “앱 사용 중 허용”과 “정확한 위치 사용”을 켠 뒤 앱을 완전히 종료하고 다시 실행해 주세요.';
  }
  return '브라우저 또는 앱의 사이트 설정에서 위치 권한을 허용한 뒤 다시 시도해 주세요.';
}
function _geoErrorMessage(err){
  if(err && err.code===1) return '위치 권한이 꺼져 있습니다.\n' + _geoDeniedGuideText();
  if(err && err.code===2) return '휴대폰에서 현재 위치 신호를 찾지 못했습니다.\n' + _geoRuntimeGuideText();
  if(err && err.code===3) return '위치 확인 시간이 초과되었습니다.\n' + _geoRuntimeGuideText();
  return '위치를 가져올 수 없습니다.\n' + _geoRuntimeGuideText();
}
const OAI_LAST_GEO_KEY='oai_catholic_way_last_geo_v1';
function _saveLastGeo(lat,lng){
  try{
    const la=Number(lat), ln=Number(lng);
    if(!isFinite(la)||!isFinite(ln)) return;
    localStorage.setItem(OAI_LAST_GEO_KEY, JSON.stringify({lat:la,lng:ln,t:Date.now()}));
  }catch(_e){}
}
function _readLastGeo(maxAgeMs){
  try{
    const raw=localStorage.getItem(OAI_LAST_GEO_KEY);
    if(!raw) return null;
    const o=JSON.parse(raw);
    const la=Number(o&&o.lat), ln=Number(o&&o.lng), t=Number(o&&o.t||0);
    if(!isFinite(la)||!isFinite(ln)||!t) return null;
    if(maxAgeMs && Date.now()-t>maxAgeMs) return null;
    return {lat:la,lng:ln,t:t};
  }catch(_e){ return null; }
}
function _warmRefreshNearbyLocation(go){
  if(!_GEO) return;
  _requestCurrentPositionStable(function(p){
    try{
      _setMyLoc(p.coords.latitude,p.coords.longitude);
      if(typeof go==='function') go(p.coords.latitude,p.coords.longitude);
    }catch(e){ console.warn('[가톨릭길동무] 위치 배경 갱신 실패', e); }
  }, function(){}, {noRefine:true});
}
function _requestCurrentPositionStable(onSuccess,onError,opts){
  opts = opts || {};
  if(!_GEO){ if(onError) onError({code:0,message:'geolocation unavailable'}); return; }
  // Google Play/TWA 최신 단말에서는 고정밀 요청만 쓰면 OS 위치 제공자가 늦게 응답하거나
  // 정확한 위치 옵션과 충돌해 timeout으로 보일 수 있다. 먼저 일반 위치로 성공을 확보하고,
  // 실패 시 고정밀/장시간 일반 위치 순서로 재시도한다.
  const sequence = opts.auto ? [_GO2] : [_GO2,_GO1,_GO3];
  let i=0;
  let firstErr=null;
  let done=false;
  function ok(pos){
    if(done) return;
    done=true;
    try{ if(onSuccess) onSuccess(pos); }catch(e){ console.warn('[가톨릭길동무]', e); }
    if(!opts.noRefine && !opts.auto){
      // 낮은 정확도 위치로 먼저 표시한 뒤, 고정밀 위치가 빨리 잡히면 조용히 갱신한다.
      try{
        const acc = pos && pos.coords && typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : 0;
        if(acc && acc > 120){
          _GEO.getCurrentPosition(function(p2){
            try{ if(p2 && p2.coords && typeof p2.coords.accuracy === 'number' && p2.coords.accuracy < acc) _setMyLoc(p2.coords.latitude,p2.coords.longitude); }catch(_e){}
          },function(){},_GO1);
        }
      }catch(_e){}
    }
  }
  function fail(err){
    if(done) return;
    if(err && !firstErr) firstErr=err;
    if(i>=sequence.length){
      done=true;
      try{ if(onError) onError(err || firstErr || {code:0,message:'geolocation failed'}); }catch(e){ console.warn('[가톨릭길동무]', e); }
      return;
    }
    const opt=sequence[i++];
    try{ _GEO.getCurrentPosition(ok, fail, opt); }catch(e){ fail(firstErr || {code:0,message:String(e)}); }
  }
  fail(null);
}
function _nearbyGeoActionHtml(state, err){
  const noun=_modeTargetLabel ? _modeTargetLabel() : '장소';
  const denied = state==='denied' || (err && err.code===1);
  const title = denied ? '위치 권한이 꺼져 있습니다' : (err ? '위치를 찾지 못했습니다' : '내 주변 '+noun+'를 보려면 위치 권한이 필요합니다');
  const icon = denied ? '⚠️' : '📍';
  const msg = denied
    ? _geoDeniedGuideText()
    : (err ? _geoErrorMessage(err) : '아래 버튼을 누르면 위치 권한 요청창이 열립니다. 권한창이 뜨면 허용을 선택해 주세요.\n최신 갤럭시/Google Play 설치앱에서는 “정확한 위치 사용”도 켜져 있어야 안정적으로 찾을 수 있습니다.');
  return `<div class="nearby-permission-card" style="padding:28px 20px;text-align:center;">
    <div style="font-size:36px;margin-bottom:12px">${icon}</div>
    <div style="font-size:15px;font-weight:800;color:#0e1535;margin-bottom:8px">${title}</div>
    <div style="font-size:12px;color:#666;line-height:1.75;margin:0 auto 18px;max-width:330px;word-break:keep-all;white-space:pre-line">${msg}</div>
    <div style="display:flex;flex-direction:column;gap:8px;align-items:center">
      <button onclick="_loadNearby({request:true})" style="background:#0e1535;color:#d4aa6a;border:none;border-radius:20px;padding:10px 22px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;min-width:210px;">위치 다시 찾기</button>
      <button onclick="openTab('region',{keyboard:true})" style="background:#fff;color:#0e1535;border:1.5px solid #d8cbb9;border-radius:20px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;min-width:210px;">지역검색으로 찾기</button>
      <button onclick="openTab('list',{keyboard:true})" style="background:#fff;color:#5b5148;border:1.5px solid #e1d7ca;border-radius:20px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;min-width:210px;">목록에서 찾기</button>
    </div>
  </div>`;
}
function _autoLocate(){
  if(!_GEO) return;

  function runAutoLocate(){
    _requestCurrentPositionStable(function(p){
      _setMyLoc(p.coords.latitude,p.coords.longitude);
      if(_activeTab==='nearby'){
        setTimeout(function(){
          try{ _loadNearby({fromAutoLocate:true}); }catch(e){ console.warn('[가톨릭길동무] 자동 위치 목록 갱신 실패', e); }
        }, 60);
      }
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
    }, function(){}, {noRefine:true});
  }

  // Android WebView/Google Play 설치앱에서는 Permissions API가 실제 앱 권한과 다르게
  // prompt/unknown으로 남을 수 있다. 그래서 설치앱에서는 권한이 명시적으로 denied일 때만 멈추고,
  // 그 외에는 조용히 현재 위치 요청을 먼저 실행한다.
  _geoPermissionState().then(function(state){
    if(state==='denied') return;
    if(_isInstalledLikeApp() || state==='granted') {
      setTimeout(runAutoLocate, _isInstalledLikeApp() ? 700 : 100);
    }
  }).catch(function(){
    if(_isInstalledLikeApp()) setTimeout(runAutoLocate, 700);
  });
}

function _nearestDioCode(lat,lng){
  if(!_DIO_CFG) return null;
  let best=null,bestD=Infinity;
  Object.entries(_DIO_CFG).forEach(([code,cfg])=>{
    // 지도 기준 자동 교구 판단에서도 군종교구는 제외한다.
    if(code==='ML') return;
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
  if(!_isParishDioceseReady(code)){
    _ensureParishDioceseDataLoaded(code).then(function(){ _showCurrentParishDioIfIdle(); }).catch(function(err){ console.warn('[가톨릭길동무] 현재 위치 교구 로드 실패', err); });
    return;
  }
  try{
    if(_activeDio && _activeDio!==code) _hideParishDioMkrs(_activeDio);
    _ensureParishMarkerZoom();
    _activeDio=code;
    _showParishDioMkrs(code);
    _syncParishDioLabels();
    if(typeof _focusParishPointAround==='function') _focusParishPointAround(_myLat,_myLng,{level:6});
    document.querySelectorAll('.dio-label').forEach(e=>{e.style.transform='';e.style.display='';});
    const clickedEl=_dioOverlays[code]?.getContent?.();
    if(clickedEl){clickedEl.style.display='none';}
  }catch(e){ console.warn("[가톨릭길동무]", e); }
}
function _setMyLoc(lat,lng){
  _myLat=lat;_myLng=lng;
  _saveLastGeo(lat,lng);
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
  _requestCurrentPositionStable(function(p){
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  _map.setLevel(7);
  if(typeof _setMapCenterByInfoCardStandard==='function') _setMapCenterByInfoCardStandard(new _LL(p.coords.latitude,p.coords.longitude));
  else _map.setCenter(new _LL(p.coords.latitude,p.coords.longitude));
  },function(err){
  alert(_geoErrorMessage(err));
  });
}

function _loadNearby(opts){
  opts = opts || {};
  const body=$('nearby-body');
  if(!body) return;

  if(!_GEO){
    body.innerHTML=`<div style="padding:28px 20px;text-align:center;">
      <div style="font-size:36px;margin-bottom:12px">⚠️</div>
      <div style="font-size:15px;font-weight:800;color:#0e1535;margin-bottom:8px">위치 기능을 지원하지 않습니다</div>
      <div style="font-size:12px;color:#666;line-height:1.75;margin-bottom:18px">이 기기 또는 현재 실행 환경에서 위치 기능을 사용할 수 없습니다.<br>지역검색이나 목록에서 찾아 주세요.</div>
      <button onclick="openTab('region',{keyboard:true})" style="background:#0e1535;color:#d4aa6a;border:none;border-radius:20px;padding:10px 22px;font-size:13px;font-weight:800;cursor:pointer;font-family:inherit;">지역검색으로 찾기</button>
    </div>`;
    return;
  }

  const go=(lat,lng)=>{
    _myLat=lat;_myLng=lng;
    _saveLastGeo(lat,lng);
    if(_mode==='shrine') _loadNearbyShrines(lat,lng);
    else if(_mode==='retreat') _loadNearbyRetreats(lat,lng);
    else _loadNearbyParishes(lat,lng);
  };

  if(_myLat && _myLng) { go(_myLat,_myLng); return; }

  if(!opts.request){
    body.innerHTML='<div class="empty-msg">📍 현재 위치를 준비하는 중입니다...<br>잠시만 기다려 주세요.</div>';
    _geoPermissionState().then(function(state){
      if(_myLat && _myLng){ go(_myLat,_myLng); return; }

      // Android WebView/Google Play 설치앱에서는 navigator.permissions 값이 실제 앱 권한과
      // 다르게 prompt/unknown으로 남는 경우가 있다. 따라서 denied가 아니면 먼저 저장 위치를
      // 보여 주고, 설치앱에서는 “위치 다시 찾기” 버튼과 같은 위치 요청을 자동 실행한다.
      if(state!=='denied'){
        const cached=_readLastGeo(24*60*60*1000);
        if(cached){
          go(cached.lat,cached.lng);
          setTimeout(function(){ try{ _warmRefreshNearbyLocation(go); }catch(e){ console.warn('[가톨릭길동무] 저장 위치 갱신 실패', e); } }, 500);
          return;
        }
      }

      if(state==='granted' || _isInstalledLikeApp()){
        setTimeout(function(){
          try{
            if(_myLat && _myLng){ go(_myLat,_myLng); return; }
            _loadNearby({request:true, granted:state==='granted', retryCount:0, fromInitial:true});
          }catch(e){
            console.warn('[가톨릭길동무] 첫 위치 확인 시작 실패', e);
            body.innerHTML=_nearbyGeoActionHtml('unknown');
          }
        }, _isInstalledLikeApp() ? 900 : 1200);
      }else{
        body.innerHTML=_nearbyGeoActionHtml(state);
      }
    }).catch(function(){
      if(_isInstalledLikeApp()){
        setTimeout(function(){
          try{ _loadNearby({request:true, granted:false, retryCount:0, fromInitial:true}); }catch(e){ body.innerHTML=_nearbyGeoActionHtml('unknown'); }
        }, 900);
      }else{
        body.innerHTML=_nearbyGeoActionHtml('unknown');
      }
    });
    return;
  }

  const retryCount = Number(opts.retryCount || 0);
  body.innerHTML = retryCount
    ? '<div class="empty-msg">📍 위치 응답이 늦어 자동으로 다시 확인하는 중입니다...<br>잠시만 기다려 주세요.</div>'
    : '<div class="empty-msg">📍 위치를 확인하는 중...</div>';

  _requestCurrentPositionStable(function(p){
    _setMyLoc(p.coords.latitude,p.coords.longitude);
    go(p.coords.latitude,p.coords.longitude);
  },function(err){
    if(_myLat && _myLng){
      go(_myLat,_myLng);
      return;
    }
    const cached=_readLastGeo(12*60*60*1000);
    if(cached && retryCount>=1){
      go(cached.lat,cached.lng);
      setTimeout(function(){ try{ _warmRefreshNearbyLocation(go); }catch(e){ console.warn('[가톨릭길동무] 저장 위치 갱신 실패', e); } }, 800);
      return;
    }
    if(err && (err.code===2 || err.code===3) && retryCount<4){
      const delays=[1800,3600,6500,9000];
      const delay=delays[Math.min(retryCount,delays.length-1)];
      body.innerHTML='<div class="empty-msg">📍 위치 응답이 늦어 자동으로 다시 확인하는 중입니다...<br>잠시만 기다려 주세요.</div>';
      setTimeout(function(){
        try{
          if(_myLat && _myLng){ go(_myLat,_myLng); return; }
          _loadNearby({request:true, granted:opts.granted===true, retryCount:retryCount+1});
        }catch(e){
          console.warn('[가톨릭길동무] 위치 자동 재시도 실패', e);
          body.innerHTML=_nearbyGeoActionHtml(null, err);
        }
      }, delay);
      return;
    }
    body.innerHTML=_nearbyGeoActionHtml(null, err);
  });
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
    body.innerHTML='<div class="empty-msg nearby-distance-loading">📍 정확한 거리를 계산 중입니다...</div>';
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
  if(!_areAllParishDiocesesReady()){
    const body=$('nearby-body');
    if(body) body.innerHTML='<div class="empty-msg nearby-distance-loading">📍 위치 확인 완료<br>전체 성당 정보를 불러오는 중입니다...</div>';
    _ensureAllParishDiocesesLoaded().then(function(){ _loadNearbyParishes(lat,lng); }).catch(function(err){
      console.warn('[가톨릭길동무] 전체 성당 데이터 로드 실패', err);
      if(body) body.innerHTML='<div class="empty-msg">성당 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</div>';
    });
    return;
  }
  _loadNearbyWithDist(lat,lng,PARISHES,p=>PARISHES.indexOf(p),()=>OAI_CATHEDRAL_CATEGORY_COLOR,()=>'⛪ 성당');
}
function _loadNearbyRetreats(lat,lng){
  _loadNearbyWithDist(lat,lng,RETREATS,p=>RETREATS.indexOf(p),p=>_getRetreatColor(p),()=>'🏔 피정의 집');
}

/* ═══════════════════════════════════════════════
   §13. 목록 렌더링 / 검색 / 필터
   ═══════════════════════════════════════════════ */
function renderList(){
  const body=$('list-body');
  if(!body) return;
  const items = _getCurrentItems();
  const q=_listSrch;
  const groups={};
  items.forEach((s,i)=>{
  if(_mode==='shrine' && (!s.lat||!s.lng||s.lat<33||s.lat>38)) return;
  const matchDio = _mode==='parish' ? (_filterDio==='all'||s.diocese===_filterDio) : (q?true:(_filterDio==='all'||s.diocese===_filterDio));
  if(!matchDio) return;
  if(q){
    const nq=q.replace(/\s+/g,'');
    const nameNorm=String(s.name||'').replace(/\s+/g,'');
    const dioNorm=String(s.diocese||'').replace(/\s+/g,'');
    const addrNorm=String(s.addr||'').replace(/\s+/g,'');
    let matchAll=false;
    if(_mode==='parish'){
      /* V3-S: 성당찾기는 선택한 교구 안에서 성당명 첫 글자 일치 또는 주소 포함으로만 찾는다. */
      matchAll = nameNorm.startsWith(nq) || addrNorm.includes(nq);
    } else {
      const tokens=q.trim().split(/\s+/);
      matchAll=tokens.length>=2
        ?tokens.every(t=>{const nt=t.replace(/\s+/g,'');return nameNorm.includes(nt)||dioNorm.includes(nt)||addrNorm.includes(nt);})
        :nameNorm.includes(nq)||dioNorm.includes(nq)||addrNorm.includes(nq);
    }
    if(!matchAll) return;
  }
  if(!groups[s.diocese]) groups[s.diocese]=[];
  groups[s.diocese].push({s,i});
  });
  if(Object.keys(groups).length===0){
  if(_mode==='parish' && !PARISHES.length) body.innerHTML='<div class="empty-msg">교구를 선택해 주세요.</div>';
  else if(_mode==='parish' && q && _filterDio!=='all') body.innerHTML='<div class="empty-msg">선택한 교구 안에 검색 결과가 없습니다</div>';
  else body.innerHTML='<div class="empty-msg">검색 결과가 없습니다</div>';
  return;
  }
  /* 검색어 있을 때 성당명 일치 우선 정렬 — 그룹 내·그룹 간 모두 적용 */
  if(q){
    const nq=q.replace(/\s+/g,'');
    function _score(name){
      const n=name.replace(/\s+/g,'');
      if(n===nq)           return 0; // 정확 일치
      if(n.startsWith(nq)) return 1; // 이름 시작
      return 3;                       // 주소만 일치
    }
    // 그룹 내 정렬
    Object.keys(groups).forEach(dio=>{
      groups[dio].sort((a,b)=>_score(a.s.name)-_score(b.s.name));
    });
    // 그룹 간 정렬 (각 그룹의 최고 점수 기준)
    const dioOrder=Object.keys(groups).sort((a,b)=>{
      const sa=groups[a].reduce((m,x)=>Math.min(m,_score(x.s.name)),9);
      const sb=groups[b].reduce((m,x)=>Math.min(m,_score(x.s.name)),9);
      return sa-sb;
    });
    body.innerHTML='';
    dioOrder.forEach(dio=>{
      const hd=document.createElement('div');
      hd.className='dio-hd'; hd.textContent=dio;
      body.appendChild(hd);
      groups[dio].forEach(({s,i})=>{
        const c=_getModeMarkerColor(s);
        const dotColor=(_mode==='retreat')?OAI_RETREAT_LIST_DOT_COLOR:c;
        const d=document.createElement('div');
        d.className='list-item';
        d.innerHTML=`<div class="li-dot" style="background:${dotColor}"></div>
    <div class="li-info"><div class="li-name">${s.name}</div><div class="li-sub">${s.addr.substring(0,28)}${s.addr.length>28?'…':''}</div></div>
    <span class="li-badge" style="background:${c}18!important;color:${c}!important">${_mode==='shrine'?s.type:(_mode==='retreat'?'피정의 집':'성당')}</span>`;
        d.onclick=()=>selectItem(i);
        body.appendChild(d);
      });
    });
    return;
  }

  // 검색어가 없을 때도 성지·성당·피정의집 찾기 기본 목록을 표시한다.
  // 기존 renderList 내부에서 빠져 있던 기본 렌더링 흐름을 복원해,
  // 탭을 처음 열었을 때 빈 화면처럼 보이지 않게 한다.
  body.innerHTML='';
  Object.entries(groups).forEach(([dio,items])=>{
    const hd=document.createElement('div');
    hd.className='dio-hd'; hd.textContent=dio;
    body.appendChild(hd);
    items.forEach(({s,i})=>{
      const c=_getModeMarkerColor(s);
      const dotColor=(_mode==='retreat')?OAI_RETREAT_LIST_DOT_COLOR:c;
      const d=document.createElement('div');
      d.className='list-item';
      d.innerHTML=`<div class="li-dot" style="background:${dotColor}"></div>
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
  if(_mode==='parish'){
    const code = v==='all' ? null : (_PARISH_DIO_CODE_MAP[v]||null);
    if(v==='all' && !_areAllParishDiocesesReady()){
      _filterDio=v;
      $$('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn?.classList.add('active');
      _showParishDataLoadingMessage('전체 성당 정보를 불러오는 중입니다...');
      _ensureAllParishDiocesesLoaded().then(function(){ setDioFilter(v,btn); }).catch(function(err){ console.warn('[가톨릭길동무] 전체 성당 데이터 로드 실패', err); });
      return;
    }
    if(code && !_isParishDioceseReady(code)){
      _filterDio=v;
      $$('.filter-btn').forEach(b=>b.classList.remove('active'));
      btn?.classList.add('active');
      _showParishDataLoadingMessage((_DIO[code]||v)+' 성당 정보를 불러오는 중입니다...');
      _ensureParishDioceseDataLoaded(code).then(function(){ setDioFilter(v,btn); }).catch(function(err){ console.warn('[가톨릭길동무] 성당 교구 데이터 로드 실패', err); });
      return;
    }
  }
  _filterDio=v;
  $$('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn?.classList.add('active');
  _listSrch='';
  const inp=$('list-srch-inp');
  if(inp){inp.value='';$('list-srch-x').style.display='none';}
  renderList();
  setTimeout(()=>_scrollSheetTop('list'),0);
  if(v!=='all'&&DIOCESE_CENTER[v]&&_map){
  // 성당 카테고리는 고정 중심값 대신 교구별 실제 성당 bounds를 사용한다.
  // 이 계산에서 인천교구 백령도, 대구대교구 울릉도는 _isParishDioBoundsOutlier()로 제외된다.
  if(_mode==='parish'){
    const code=_PARISH_DIO_CODE_MAP[v]||null;
    if(code){
      try{
        if(_activeDio && _activeDio!==code) _hideParishDioMkrs(_activeDio);
        _activeDio=code;
        _showParishDioMkrs(code);
        _syncParishDioLabels();
        if(_fitParishDioBounds(code,{reason:'list-filter'})) return;
      }catch(e){ console.warn('[가톨릭길동무]',e); }
    }
  }
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

function _regionHtmlEsc(v){
  return String(v == null ? '' : v).replace(/[&<>"]/g, function(ch){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch];
  });
}
function _regionAttrEsc(v){
  return _regionHtmlEsc(v).replace(/'/g, '&#39;');
}

function _regionModeLabel(){
  return _mode==='parish' ? '성당' : (_mode==='retreat' ? '피정의 집' : '성지');
}
function _regionGuideHtml(){
  return '<div class="empty-msg region-guide-empty">🏞 여행지나 숙소 지역을 검색하면<br>근처 ' + _regionModeLabel() + ' 목록이 나타납니다</div>';
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
  '군종교구':{lat:37.53,lng:126.97,mob:10},
};

function onRegionInp(v){
  // 입력 중 현재 모드에 맞는 안내 표시
  const body=$('region-body');
  if(!v.trim()){
    body.innerHTML=_regionGuideHtml();
  }
}
/* ═══════════════════════════════════════════════
   §14. 지역 검색
   ═══════════════════════════════════════════════ */
function doRegionSearch(){
  const inp=$('region-inp');
  const q=(inp.value||'').trim();
  if(!q) return;
  inp.blur();
  const body=$('region-body');
  if(_mode==='parish' && !_areAllParishDiocesesReady()){
    body.innerHTML='<div class="empty-msg">⛪ 전체 성당 정보를 불러오는 중입니다...</div>';
    _ensureAllParishDiocesesLoaded().then(function(){ doRegionSearch(); }).catch(function(err){
      console.warn('[가톨릭길동무] 전체 성당 데이터 로드 실패', err);
      body.innerHTML='<div class="empty-msg">성당 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요.</div>';
    });
    return;
  }
  body.innerHTML='<div class="empty-msg">🔍 장소 검색 중...</div>';
  _kakaoKeywordDocs(q, KAKAO_PLACE_SEARCH_DISPLAY_LIMIT)
  .then(docs=>{
    if(!docs.length){ _showRegionFallback(q); return; }
    let html='<div style="padding:8px 14px 4px;font-size:11px;font-weight:700;color:#888;background:#f8f9fc;border-bottom:1px solid #eee;">📍 지역을 선택하세요</div>';
    docs.forEach(d=>{
      const nm=d.place_name||'', ad=d.road_address_name||d.address_name||'';
      const cat=d.category_name||'', url=d.place_url||'';
      html+=`<div class="region-place-cand nearby-item" data-lat="${parseFloat(d.y)}" data-lng="${parseFloat(d.x)}" data-name="${_regionAttrEsc(nm)}" data-addr="${_regionAttrEsc(ad)}" data-cat="${_regionAttrEsc(cat)}" data-url="${_regionAttrEsc(url)}"><div class="sm-place-icon" aria-hidden="true">📍</div><div class="nearby-info"><div class="nearby-name">${_regionHtmlEsc(nm)}</div>${ad?`<div class="nearby-addr">${_regionHtmlEsc(ad)}</div>`:''}</div></div>`;
    });
    body.innerHTML=html;
    body.onclick=function(e){
      const cand=e.target.closest('.region-place-cand');
      if(!cand) return;
      body.onclick=null;
      const clat=parseFloat(cand.dataset.lat),clng=parseFloat(cand.dataset.lng),cname=cand.dataset.name;
      const caddr=cand.dataset.addr||'', ccat=cand.dataset.cat||'', curl=cand.dataset.url||'';
      _regionLat=clat;_regionLng=clng;_regionName=cname;_regionPlaceName=cname;
      _routeRegionStart={lat:clat,lng:clng,name:'📍 '+cname,placeName:cname};
      body.innerHTML='<div class="empty-msg">🚗 자동차 거리 계산 중...</div>';
      _showRegionResults(cname,clat,clng,{place_name:cname,road_address_name:caddr,address_name:caddr,category_name:ccat,place_url:curl});
      if(_map) _showRegionItemsOnMap([],clat,clng,{center:true});
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
  _regionLat=lat; _regionLng=lng; _regionName=placeName; _regionPlaceName=placeName;
  _routeRegionStart={lat:lat,lng:lng,name:'📍 '+placeName,placeName:placeName};
  const safePlaceName=_regionHtmlEsc(placeName);
  const safePlaceAddr=_regionHtmlEsc(placeAddr);
  const safePlaceCat=_regionHtmlEsc(placeCat);
  const infoCard=`<div class="region-info-card"><div class="ric-hd"><div class="ric-icon">📍</div><div class="ric-name-wrap"><div class="ric-name">${safePlaceName}</div>${placeAddr?`<div class="ric-addr">${safePlaceAddr}</div>`:''}${placeCat?`<div class="ric-cat">${safePlaceCat}</div>`:''}</div><button type="button" class="ric-map-link" onclick="showRegionPlaceOnMap()">지도 보기</button></div></div>`;
  const listHd=`<div class="region-list-hd">${isParish?'⛪ 근처 성당':(isRetreat?'🏔 근처 피정의 집':'✝ 근처 성지')} <span style="font-size:13px;font-weight:500;color:#aaa">· 자동차 거리순 10곳</span></div>`;
  $('region-body').innerHTML=infoCard+listHd+'<div id="rg-loading" style="text-align:center;padding:10px;font-size:12px;color:#888;">🚗 정확한 거리 계산 중입니다…</div><div id="rg-list" style="background:#fff"></div>';
  if(!prelim.length){
    _regionCache=[];
    if(_map) _showRegionItemsOnMap([],lat,lng,{center:true});
    const loadEl=$('rg-loading');
    const rgl=$('rg-list');
    if(loadEl) loadEl.style.display='none';
    if(rgl) rgl.innerHTML='<div class="empty-msg">주변에 표시할 '+_regionModeLabel()+' 정보가 없습니다</div>';
    return;
  }
  const results=new Array(prelim.length).fill(null);let done=0;
  prelim.forEach((x,i)=>{
    _navFetch(`${lng},${lat}`,`${x.s.lng},${x.s.lat}`)
    .then(val=>{results[i]=val||{km:x.d*1.35,dur:null};})
    .catch(()=>{results[i]={km:x.d*1.35,dur:null};})
    .finally(()=>{ done++;
      if(done===prelim.length){
        const sorted=prelim.map((x,i)=>({x,r:results[i]||{km:x.d*1.35,dur:null}})).sort((a,b)=>a.r.km-b.r.km).slice(0,10);
        _regionCache=sorted.map(o=>o.x.s);
        if(_map) _showRegionItemsOnMap(_regionCache,lat,lng,{center:true});
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
  _routeRegionStart=null;
  try{ _clearRegionMarker(); }catch(e){ console.warn('[가톨릭길동무]', e); }
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


function _showRouteGuideText(msg){
  const g=$('route-guide');
  if(!g) return;
  if(_polyline || (_rS && _rE)){
    g.classList.remove('on');
    g.textContent='';
    return;
  }
  g.textContent=msg||'';
  g.classList.add('on');
}

function _hideRouteGuide(){
  const g=$('route-guide');
  if(!g) return;
  g.classList.remove('on');
  g.textContent='';
}

function _setImplicitCurrentLocationStartLabelVisible(visible){
  // 길찾기 탭을 처음 열 때 자동으로 잡는 현재 위치는 내부 출발지로만 유지하고,
  // 사용자가 '현재 위치' 버튼을 누르거나 실제 경로검색을 실행할 때만 문구를 보여 준다.
  try{
    if(_rS && (_rS.name === '현재 위치' || _rS.name === '현위치')){
      _setRouteLabel('start', visible ? '현위치' : '');
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
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
    _rS={idx:-1,name:'현재 위치',lat:_myLat,lng:_myLng,isImplicitCurrentLocation:true};
    _setRouteLabel('start','');
    _refreshRouteTmpMarkers();
    _updateSearchBtn();
    return;
  }
  if(!_GEO) return;
  _geoPermissionState().then(function(state){
    if(state!=='granted' || (_rS&&_rS.lat&&_rS.lng)) return;
    _requestCurrentPositionStable(function(p){
      _setMyLoc(p.coords.latitude,p.coords.longitude);
      if(!_rS){
        _rS={idx:-1,name:'현재 위치',lat:p.coords.latitude,lng:p.coords.longitude,isImplicitCurrentLocation:true};
        _setRouteLabel('start','');
        _refreshRouteTmpMarkers();
        _updateSearchBtn();
        if(!_rE){
          _showRouteGuideText(`도착 ${_getRouteGuideTarget()}를 탭하세요`);
        }
      }
    },function(){},{noRefine:true});
  }).catch(function(e){ console.warn('[가톨릭길동무] 길찾기 위치 권한 상태 확인 실패', e); });
}

/* ═══════════════════════════════════════════════
   §15. 길찾기
   ═══════════════════════════════════════════════ */
function _enterRouteMode(){
  _routeMode=true;
  const rs=$('sheet-route');
  if(rs){ rs.style.display=''; rs.classList.add('open'); }
  _ensureCurrentLocationStart();
  _showRouteGuideText(_rS?`도착 ${_getRouteGuideTarget()}를 탭하세요`:`출발지를 탭하거나 지도에서 ${_getRouteGuideTarget()}를 선택하세요`);
}

function _exitRouteMode(){
  _routeMode=false;
  _hideRouteGuide();
}

function setMyLocAsStart(){
  _routeRegionStart=null;
  if(!_GEO) return alert('위치 정보를 지원하지 않습니다.');
  _requestCurrentPositionStable(function(p){
  _setMyLoc(p.coords.latitude,p.coords.longitude);
  _clearRouteTmpMarkers();
  if(_mode==='shrine'&&_rS&&_rS.idx>=0&&_markers[_rS.idx]) _markers[_rS.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rS.idx].shrine.type),false));
  _rS={idx:-1,name:'현재 위치',lat:p.coords.latitude,lng:p.coords.longitude,isImplicitCurrentLocation:false};
  _setRouteLabel('start','현위치');
  _refreshRouteTmpMarkers();
  if(_rE) _updateSearchBtn();
  else {
   _showRouteGuideText(`도착 ${_getRouteGuideTarget()}를 탭하세요`);
  }
  },function(err){ alert(_geoErrorMessage(err)); });
}

function _setRouteLabel(role,name){
  const el=$(`rs-${role}-lbl`);
  if(!el) return;
  const rawName = name || '';
  el.textContent = rawName || (role==='start' ? '출발지를 선택하세요' : '도착지를 선택하세요');
  el.className='rs-lbl'+(rawName?' filled':' empty');
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
  // 출발지가 자동 현재 위치로 잡혀 있는데 라벨만 숨겨져 있던 경우,
  // 실제 경로 표시 단계에서는 사용자에게 '현재 위치'를 명확히 보여 준다.
  if(_rS && (_rS.name === '현재 위치' || _rS.name === '현위치')) _setImplicitCurrentLocationStartLabelVisible(true);
  if(_rS&&_rE) setTimeout(function(){ try{ _calcRoute(); }catch(e){ console.warn('[가톨릭길동무]', e); } }, OAI_ROUTE_VISUAL_DELAY_MS);
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
  _hideRouteGuide();
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
  _showRouteGuideText(`도착 ${_getRouteGuideTarget()}를 탭하세요`);
  if(!_activeTab) openTab('route');
  } else {
  _rE={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute(_typeColor(s.type),'도')); _setRouteMarkerZ(idx,'end'); }
  _setRouteLabel('end',s.name);
  _refreshRouteTmpMarkers();
  _hideRouteGuide();
  _updateSearchBtn();
  }
}

function _hideParishMarkersForRouteDisplay(){
  if(_mode!=='parish') return;
  try{ _clearParishNearbyMarkers(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  try{ _hideDioOverlays(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  try{
    Object.keys(_dioMkrs||{}).forEach(function(code){
      (_dioMkrs[code]||[]).forEach(function(mk){
        try{ mk.setMap(null); }catch(e){ console.warn('[가톨릭길동무]', e); }
      });
    });
    if(_parishIdleListener){
      try{ kakao.maps.event.removeListener(_parishIdleListener); }catch(e){ console.warn('[가톨릭길동무]', e); }
      _parishIdleListener=null;
    }
  }catch(e){ console.warn('[가톨릭길동무]', e); }
  try{ if(_paSelMkr) _paSelMkr.setMap(null); }catch(e){ console.warn('[가톨릭길동무]', e); }
}

function _hideRetreatMarkersForRouteDisplay(){
  if(_mode!=='retreat') return;
  try{
    (_retreatMarkers||[]).forEach(function(o){
      if(!o || !o.marker) return;
      // 피정의집 길찾기는 성당과 동일하게 출발/도착 임시 마커와 경로선만 남긴다.
      // 원래 초록 마커들은 경로 표시 중 숨기고, resetRoute/closeTab의 기존 복구 흐름에 맡긴다.
      o.marker.setMap(null);
    });
  }catch(e){ console.warn('[가톨릭길동무]', e); }
}

function _hideCategoryMarkersForRouteDisplay(){
  if(_mode==='parish') _hideParishMarkersForRouteDisplay();
  else if(_mode==='retreat') _hideRetreatMarkersForRouteDisplay();
}

async function _calcRoute(){
  if(!_rS||!_rE) return;
  _hideRouteGuide();
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

  // API 응답 전 임시 직선은 지도 중심을 움직이지 않는다.
  // 실제 경로 또는 추정 경로 확정 시 한 번만 bounds를 맞춰 화면 흔들림을 줄인다.
  _drawLine(_rS, navDest, null, {fit:false});

  try{
  const res=await _kakaoDirectionsFetch(`${_rS.lng},${_rS.lat}`, `${navDest.lng},${navDest.lat}`);
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
  _drawLine(_rS, navDest, null, {fit:true});
  }
}

function _drawLine(s1,s2,path,opts){
  opts = opts || {};
  _hideRouteGuide();
  if(_polyline) _polyline.setMap(null);
  _clearRouteTmpMarkers();
  const pts=path||[new _LL(s1.lat,s1.lng),new _LL(s2.lat,s2.lng)];
  _polyline=new _PL({path:pts,
  strokeWeight:path?6:3,strokeColor:path?'#1a73e8':'#b8965a',
  strokeOpacity:path?0.88:0.7,strokeStyle:path?'solid':'dashed'});
  _polyline.setMap(_map);
  _refreshRouteTmpMarkers();
  _hideCategoryMarkersForRouteDisplay();

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
  }

  const bounds=new _LB();
  pts.forEach(p=>bounds.extend(p));
  if(s1 && s1.lat && s1.lng) bounds.extend(new _LL(s1.lat,s1.lng));
  if(s2 && s2.lat && s2.lng) bounds.extend(new _LL(s2.lat,s2.lng));
  if(_startTmpMkr) bounds.extend(new _LL(s1.lat,s1.lng));
  if(_endTmpMkr) bounds.extend(new _LL(s2.lat,s2.lng));
  // 길찾기 결과는 아래 route 시트에 가려지기 쉬우므로,
  // 일반 인포카드 중심 보정 대신 실제 route 시트 높이를 반영한 전용 bounds를 사용한다.
  // 단, 여러 번 setBounds를 반복하면 성당/피정의집 경로 표시 순간 화면이 크게 흔들린다.
  // 경로가 확정되는 시점에 한 번만 맞추고, API 대기용 임시 직선은 fit:false로 넘긴다.
  if(opts.fit !== false){
    if(typeof _fitRouteBounds==='function') _fitRouteBounds(bounds, {repeat:false});
    else { try{_map.setBounds(bounds,80,52,190,52);}catch(e){ console.warn("[가톨릭길동무]", e); } }
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
 try{ markExternalReturnStabilize('kakao-route'); }catch(e){ console.warn("[가톨릭길동무]", e); }
 if(_isMob){
  _kakaoLaunching=true;
  setTimeout(()=>{_kakaoLaunching=false;},3000);
  const f=document.createElement('iframe');
  f.style.cssText='display:none;width:0;height:0;border:0;position:fixed;';
  document.body.appendChild(f);f.src=a;
  const t=setTimeout(()=>{_kakaoLaunching=false;if(typeof oaiSmoothNavigate==='function') oaiSmoothNavigate(w,'kakao-route'); else location.href=w;},1500);
  window.addEventListener('blur',()=>clearTimeout(t),{once:true});
  setTimeout(()=>{if(document.body.contains(f))document.body.removeChild(f);},2000);
 } else { if(typeof oaiSmoothNavigate==='function') oaiSmoothNavigate(w,'kakao-route'); else location.href=w; }
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
  oaiFocusSearchKeyboardInput('sm-inp');
}

function onSmInp(v){
  if(_smTab==='cat'){ filterModal(v); return; }
  clearTimeout(_smPlaceDebounce);
  if(!v.trim()){ $('sm-body-place').innerHTML='<div class="sm-place-loading">장소명을 입력하세요</div>'; return; }
  $('sm-body-place').innerHTML='<div class="sm-place-loading">🔍 검색 중...</div>';
  _smPlaceDebounce=setTimeout(()=>_searchKakaoPlace(v.trim()),400);
}

function _searchKakaoPlace(q){
  _kakaoKeywordDocs(q, KAKAO_PLACE_SEARCH_DISPLAY_LIMIT)
  .then(docs=>{
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
    else{ _showRouteGuideText(`도착 ${_getRouteGuideTarget()}를 탭하세요`); }
  } else {
    if(_mode==='shrine'&&_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
    _rE=locObj;
    _setRouteLabel('end',name);
    _refreshRouteTmpMarkers();
    _hideRouteGuide();
    if(_rS) _updateSearchBtn();
    else _showRouteGuideText(`출발 ${_getRouteGuideTarget()}를 탭하세요`);
  }
  if(!_activeTab||_activeTab!=='route') openTab('route');
  if(_map) _map.panTo(new _LL(lat,lng));
}
/* ═══════════════════════════════════════════════
   §16. 검색 모달
   ═══════════════════════════════════════════════ */
function openSearchModal(role){
  closeInfoCard({keepMap:true});
  _smRole=role;_smDio='all';
  _smTab='cat';
  // 탭 이름 카테고리별 설정
  const catTab=$('sm-tab-cat');
  if(catTab) catTab.textContent=_mode==='shrine'?'성지':_mode==='parish'?'성당':'피정의 집';
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
  const smInput=$('sm-inp');
  if(smInput){
    const smPh = _mode==='parish' ? '선택 교구 성당명, 주소 검색' : '이름 또는 장소 입력';
    smInput.placeholder = smPh;
    smInput.setAttribute('aria-label', smPh);
    smInput.value='';
  }
  filterModal('');
  var searchModal=$('srch-modal');
  if(searchModal){
    searchModal.classList.add('open');
    try{ if(typeof oaiEnterPopup==='function') oaiEnterPopup(searchModal); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  oaiFocusSearchKeyboardInput('sm-inp');
}

function _blurAll(){ try{document.activeElement&&document.activeElement.blur();}catch(e){ console.warn("[가톨릭길동무]", e); } }
function oaiInputIsVisible(el){
  try{
    if(!el) return false;
    if(el.disabled || el.readOnly) return false;
    var r=el.getBoundingClientRect();
    return r.width>0 && r.height>0;
  }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
}
function oaiFocusSearchKeyboardInput(id, delay){
  function run(){
    try{
      var el=document.getElementById(id);
      if(!oaiInputIsVisible(el)) return;
      if(document.activeElement!==el){
        try{ el.focus({preventScroll:true}); }catch(_e){ el.focus(); }
      }
      try{ if(typeof el.select === 'function' && el.value) el.select(); }catch(_e){}
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  if(delay && delay>0) setTimeout(run, delay);
  else { run(); setTimeout(run, 60); }
}
function oaiBlurIfAutoFocusedInput(id){
  setTimeout(function(){
    try{
      var el=document.getElementById(id);
      if(el && document.activeElement===el) el.blur();
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  },0);
}
function closeSearchModal(){
  _blurAll && _blurAll();
  $('srch-modal').classList.remove('open');
}

function setSmDio(v,btn){
  if(_mode==='parish'){
    const code = v==='all' ? null : (_PARISH_DIO_CODE_MAP[v]||null);
    if(v==='all' && !_areAllParishDiocesesReady()){
      _smDio=v;
      $$('.sm-fb').forEach(b=>b.classList.remove('on'));
      btn?.classList.add('on');
      const body=$('sm-body'); if(body) body.innerHTML='<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">전체 성당 정보를 불러오는 중입니다...</div>';
      _ensureAllParishDiocesesLoaded().then(function(){ setSmDio(v,btn); }).catch(function(err){ console.warn('[가톨릭길동무] 전체 성당 데이터 로드 실패', err); });
      return;
    }
    if(code && !_isParishDioceseReady(code)){
      _smDio=v;
      $$('.sm-fb').forEach(b=>b.classList.remove('on'));
      btn?.classList.add('on');
      const body=$('sm-body'); if(body) body.innerHTML='<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">성당 정보를 불러오는 중입니다...</div>';
      _ensureParishDioceseDataLoaded(code).then(function(){ setSmDio(v,btn); }).catch(function(err){ console.warn('[가톨릭길동무] 성당 교구 데이터 로드 실패', err); });
      return;
    }
  }
  _smDio=v;
  $$('.sm-fb').forEach(b=>b.classList.remove('on'));
  btn?.classList.add('on');
  filterModal($('sm-inp')?.value||'');
}

function filterModal(q){
  const body=$('sm-body');
  const groups={};
  _getCurrentItems().forEach((s,i)=>{
  const matchDio=_mode==='parish' ? (_smDio==='all'||s.diocese===_smDio) : (q?true:(_smDio==='all'||s.diocese===_smDio));
  if(!matchDio) return;
  if(q){
    const nq=q.replace(/\s+/g,'');
    const nameNorm=String(s.name||'').replace(/\s+/g,'');
    const dioNorm=String(s.diocese||'').replace(/\s+/g,'');
    const addrNorm=String(s.addr||'').replace(/\s+/g,'');
    let matchAll=false;
    if(_mode==='parish'){
      /* V3-S: 성당 길찾기 검색도 선택한 교구 안에서 성당명 첫 글자 일치 또는 주소 포함으로만 찾는다. */
      matchAll = nameNorm.startsWith(nq) || addrNorm.includes(nq);
    } else {
      const tokens=q.trim().split(/\s+/);
      matchAll=tokens.length>=2
        ?tokens.every(t=>{const nt=t.replace(/\s+/g,'');return nameNorm.includes(nt)||dioNorm.includes(nt)||addrNorm.includes(nt);})
        :nameNorm.includes(nq)||dioNorm.includes(nq)||addrNorm.includes(nq);
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
  body.innerHTML=html||((_mode==='parish'&&!PARISHES.length)?'<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">교구를 선택해 주세요</div>':((_mode==='parish'&&q&&_smDio!=='all')?'<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">선택한 교구 안에 검색 결과가 없습니다</div>':'<div style="padding:32px;text-align:center;color:#aaa;font-size:13px">검색 결과가 없습니다</div>'));
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
   _showRouteGuideText(`도착 ${_getRouteGuideTarget()}를 탭하세요`);
  }
  } else {
  if(_mode==='shrine'&&_rE&&_rE.idx>=0&&_markers[_rE.idx]) _markers[_rE.idx].marker.setImage(_mkrImg(_typeColor(_markers[_rE.idx].shrine.type),false));
  _rE={idx,name:s.name,lat:s.lat,lng:s.lng};
  if(_mode==='shrine'){ _markers[idx]?.marker.setImage(_mkrImgRoute(_typeColor(s.type),'도')); _setRouteMarkerZ(idx,'end'); }
  _setRouteLabel('end',s.name);
  _refreshRouteTmpMarkers();
  _hideRouteGuide();
  if(_rS) _updateSearchBtn();
  else _showRouteGuideText(`출발 ${_getRouteGuideTarget()}를 탭하세요`);
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
 if(_mode==='retreat') c=OAI_RETREAT_CATEGORY_COLOR;
 else if(_mode==='parish') c=OAI_CATHEDRAL_CATEGORY_COLOR;
 return `<div class="nearby-item" onclick="selectItem(${idx},{fromNearby:true})"><div class="nearby-num" style="background:${c}!important">${i+1}</div><div class="nearby-info"><div class="nearby-name">${name}</div><div class="nearby-addr">${addr.substring(0,26)}${addr.length>26?'…':''}</div></div><div class="nearby-meta"><div class="nearby-type" style="background:${c}18!important;color:${c}!important">${tLabel}</div><div class="nearby-dist" id="${distId}" style="color:${c}!important">🚗${estKm}km</div></div></div>`;
}
function _regionHtml(idx,i,name,addr,c,tLabel,distId,estKm){
 if(_mode==='retreat') c=OAI_RETREAT_CATEGORY_COLOR;
 else if(_mode==='parish') c=OAI_CATHEDRAL_CATEGORY_COLOR;
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
/* 기존 cover pull handler는 최종 새로고침 핸들러로 통합 관리 */
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
       하단 웹사이트 스와이프 보조 코드(bindWebSwipe)가 웹사이트 탭 이동을 전담한다.
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
  function adjustAppFont(delta) {
    if (typeof window.__APP_adjustSharedFont === 'function') {
      window.__APP_adjustSharedFont(delta);
      return;
    }
    if (typeof window.prAdjustFont === 'function') window.prAdjustFont(delta);
  }
  function withPrayerModule(fn) {
    if (typeof window.ensurePrayerModuleLoaded === 'function') {
      window.ensurePrayerModuleLoaded().then(function(){ try{ fn(); }catch(e){ console.warn('[가톨릭길동무]', e); } })
        .catch(function(err){ console.warn('[가톨릭길동무]', err); });
      return;
    }
    try{ fn(); }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function prepareSearchKeyboardInput(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.setAttribute('inputmode', 'search');
    el.setAttribute('enterkeyhint', 'done');
    el.removeAttribute('autofocus');
    return el;
  }
  function blurSearchKeyboardOnDone(e, afterBlur) {
    if (!e || e.key !== 'Enter' || e.isComposing) return false;
    e.preventDefault();
    e.stopPropagation();
    var target = e.currentTarget || e.target;
    if (typeof afterBlur === 'function') {
      try { afterBlur(target); } catch (err) { console.warn('[가톨릭길동무]', err); }
    }
    setTimeout(function() { try { target && target.blur && target.blur(); } catch (err) { console.warn('[가톨릭길동무]', err); } }, 0);
    return true;
  }
  ['list-srch-inp', 'region-inp', 'sm-inp', 'prayer-search-inp'].forEach(prepareSearchKeyboardInput);

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
  on('prayer-search-inp', 'input', function() { withPrayerModule(function(){ if(typeof window.prRenderList==='function') window.prRenderList(); }); });
  on('prayer-search-inp', 'keydown', function(e) {
    blurSearchKeyboardOnDone(e, function() {
      withPrayerModule(function(){ if(typeof window.prRenderList==='function') window.prRenderList(); });
    });
  });
  on('pr-sm-btn-1',   'click', function() { withPrayerModule(function(){ if(typeof window.prAdjustFont==='function') window.prAdjustFont(-1); }); });
  on('pr-lg-btn-1',   'click', function() { withPrayerModule(function(){ if(typeof window.prAdjustFont==='function') window.prAdjustFont(1); }); });
  on('pr-sm-btn-2',   'click', function() { withPrayerModule(function(){ if(typeof window.prAdjustFont==='function') window.prAdjustFont(-1); }); });
  on('pr-lg-btn-2',   'click', function() { withPrayerModule(function(){ if(typeof window.prAdjustFont==='function') window.prAdjustFont(1); }); });
  on('pr-detail-star','click', function(e) { var ev=e; withPrayerModule(function(){ if(typeof window.prToggleDetailFav==='function') window.prToggleDetailFav(ev); }); });
  on('pr-back-btn',   'click', function() { try{ history.go(-1); }catch(e){ withPrayerModule(function(){ if(typeof window.prCloseDetail==='function') window.prCloseDetail(); }); } });

  // ── 커버 글자크기 ──
  on('cover-sm-btn',  'click', function(e) { e.stopPropagation(); adjustAppFont(-1); });
  on('cover-lg-btn',  'click', function(e) { e.stopPropagation(); adjustAppFont(1); });

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
  on('mass-quick-missa', 'click', function() {
    // 외부 사이트 이동은 지연 체감이 가장 크므로 팝업 닫기/화면 정리 없이 즉시 이동한다.
    _setMassQuickReturn(true);
    if (typeof openMissa === 'function') openMissa();
  });
  on('mass-quick-prayer', 'click', function() {
    _setPrayerQuickReturn(true);
    var openPrayerFromQuick = function(){
      try{
        document.querySelectorAll('#mass-quick-modal .app-pressing').forEach(function(el){ el.classList.remove('app-pressing'); });
      }catch(e){ console.warn('[가톨릭길동무]', e); }
      if (typeof openPrayerBook === 'function') openPrayerBook({fromMassQuick:true, instant:true});
      else alert('기도문 기능이 연결되지 않았습니다.');
    };
    if (typeof _hideMassQuickMenuOnly === 'function') _hideMassQuickMenuOnly(openPrayerFromQuick, {deferHideUntilAfter:true});
    else openPrayerFromQuick();
  });
  on('mass-quick-hymn', 'click', function() {
    // 외부 사이트 이동은 지연 체감이 가장 크므로 팝업 닫기/화면 정리 없이 즉시 이동한다.
    _setMassQuickReturn(true);
    if (typeof openCatholicHymn === 'function') openCatholicHymn();
  });

  // ── 커버 기타 ──
  (function bindCoverRefreshPressActions(){
    var refreshBtn = document.getElementById('cover-update-btn');
    if(!refreshBtn) return;

    var holdTimer = null;
    var pressStarted = false;
    var longActionFired = false;
    var suppressClickUntil = 0;
    var CACHE_HOLD_MS = 1200;

    function now(){ return Date.now ? Date.now() : new Date().getTime(); }
    function stopEvent(e, preventDefault){
      try{
        if(!e) return;
        e.stopPropagation();
        if(preventDefault && e.cancelable) e.preventDefault();
      }catch(_e){}
    }
    function vibrateShort(){ try{ if(navigator.vibrate) navigator.vibrate(12); }catch(_e){} }
    function vibrateLong(){ try{ if(navigator.vibrate) navigator.vibrate([32, 22, 48]); }catch(_e){} }
    function clearHold(){ if(holdTimer){ clearTimeout(holdTimer); holdTimer = null; } }
    function beginPress(e){
      try{ if(e && e.button !== undefined && e.button !== 0) return; }catch(_e){}
      /* 짧은 누름은 click 이벤트가 가장 안정적이다. 여기서 preventDefault를 걸면
         Android/iPhone WebView에서 click이 사라져 새로고침이 실행되지 않을 수 있다. */
      stopEvent(e, false);
      clearHold();
      pressStarted = true;
      longActionFired = false;
      holdTimer = setTimeout(function(){
        holdTimer = null;
        if(!pressStarted || longActionFired) return;
        longActionFired = true;
        pressStarted = false;
        suppressClickUntil = now() + 1600;
        vibrateLong();
        if(typeof clearAppFilesCacheCompletely === 'function') clearAppFilesCacheCompletely();
      }, CACHE_HOLD_MS);
    }
    function endPress(e){
      stopEvent(e, false);
      pressStarted = false;
      clearHold();
    }
    function cancelPress(e){
      stopEvent(e, false);
      pressStarted = false;
      clearHold();
    }
    function shortRefresh(e){
      stopEvent(e, true);
      if(now() < suppressClickUntil || longActionFired){
        longActionFired = false;
        return;
      }
      pressStarted = false;
      clearHold();
      // 짧은 새로고침은 화면/기기가 떨리는 느낌을 줄 수 있어 햅틱 진동을 쓰지 않는다.
      if(typeof refreshAppFilesOnly === 'function') refreshAppFilesOnly();
    }
    function preventNativePressMenu(e){ stopEvent(e, true); return false; }

    if(window.PointerEvent){
      on(refreshBtn, 'pointerdown', beginPress, {passive:false});
      on(refreshBtn, 'pointerup', endPress, {passive:false});
      on(refreshBtn, 'pointercancel', cancelPress, {passive:false});
      on(refreshBtn, 'pointerleave', function(e){
        try{ if(e && e.pointerType === 'mouse') cancelPress(e); }catch(_e){}
      }, {passive:false});
    }else{
      on(refreshBtn, 'touchstart', beginPress, {passive:true});
      on(refreshBtn, 'touchend', endPress, {passive:true});
      on(refreshBtn, 'touchcancel', cancelPress, {passive:true});
      on(refreshBtn, 'mousedown', beginPress, {passive:false});
      on(refreshBtn, 'mouseup', endPress, {passive:false});
      on(refreshBtn, 'mouseleave', cancelPress, {passive:false});
    }
    on(refreshBtn, 'click', shortRefresh, {capture:true});
    on(refreshBtn, 'contextmenu', preventNativePressMenu, {capture:true});
    on(refreshBtn, 'selectstart', preventNativePressMenu, {capture:true});
    on(refreshBtn, 'dragstart', preventNativePressMenu, {capture:true});
  })();
  on('qna-cover-btn',  'click', function() { openQnaView(); });
  // Google Play 정리본: 설치/바로가기 버튼 제거


  // Google Play 커버 메뉴
  (function(){
    var modal = document.getElementById('cover-menu-modal');
    if(!modal) return;
    function openMenu(){
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
      try{ document.body.classList.add('modal-open'); }catch(e){}
    }
    function closeMenu(){
      modal.classList.remove('show');
      modal.setAttribute('aria-hidden', 'true');
      try{ document.body.classList.remove('modal-open'); }catch(e){}
    }
    window.closeCoverMenuPopup = closeMenu;
    window.isCoverMenuPopupOpen = function(){
      return !!(modal && modal.classList && modal.classList.contains('show'));
    };
    on('cover-menu-btn', 'click', function(e){
      if(e && e.preventDefault) e.preventDefault();
      openMenu();
    });
    on('cover-menu-close', 'click', function(e){
      if(e && e.preventDefault) e.preventDefault();
      closeMenu();
    });
    modal.addEventListener('click', function(e){
      if(e && e.target && e.target.getAttribute && e.target.getAttribute('data-cover-menu-close') === 'true'){
        closeMenu();
      }
    });
    on('cover-menu-guide-btn', 'click', function(e){
      if(e && e.preventDefault) e.preventDefault();
      closeMenu();
      try{
        if(window.openGuideManual) window.openGuideManual();
        else if(typeof openGuideManual === 'function') openGuideManual();
      }catch(err){ console.warn('[가톨릭길동무]', err); }
    });
    function markInternalPrivacyNavigation(){
      try{
        sessionStorage.setItem('oai_internal_return_no_effect_once','1');
        sessionStorage.setItem('oai_internal_page_nav','privacy');
        sessionStorage.removeItem('oai_external_nav_started_at');
        sessionStorage.removeItem('oai_external_nav_pagehide');
        sessionStorage.removeItem('oai_external_nav_kind');
        sessionStorage.removeItem('oai_external_nav_pending');
        sessionStorage.removeItem('oai_external_nav_hold_until');
        sessionStorage.removeItem('oai_external_nav_force_release_at');
        sessionStorage.removeItem('oai_refresh_veil_until');
        sessionStorage.removeItem('oai_refresh_veil_hold_ms');
        sessionStorage.removeItem('oai_refresh_veil_reason');
        sessionStorage.removeItem('oai_refresh_veil_visible_until');
      }catch(_e){}
    }
    on('cover-menu-qna-btn', 'click', function(e){
      if(e && e.preventDefault) e.preventDefault();
      closeMenu();
      try{ openQnaView(); }catch(err){ console.warn('[가톨릭길동무]', err); }
    });
    on('cover-menu-privacy-link', 'click', function(){
      markInternalPrivacyNavigation();
      closeMenu();
    });
    document.addEventListener('keydown', function(e){
      if(e && e.key === 'Escape' && modal.classList.contains('show')) closeMenu();
    });
  })();


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
  on('list-srch-inp', 'keydown', function(e) { blurSearchKeyboardOnDone(e, function(inp) { onListSearch(inp.value || ''); }); });
  on('list-srch-x',   'click', function() { clearListSearch(); });

  // ── 지역 검색 ──
  on('region-inp', 'keydown', function(e) { blurSearchKeyboardOnDone(e, function() { doRegionSearch(); }); });
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
  on('sm-inp', 'keydown', function(e) {
    blurSearchKeyboardOnDone(e, function(inp) {
      var v = (inp && inp.value ? inp.value : '').trim();
      if(_smTab==='place'){
        if(v) _searchKakaoPlace(v);
      } else {
        filterModal(v);
      }
    });
  });

  // ── 웹·순례길·Q&A 닫기 ──
  function closeGeneralModuleByButton(viewId){
    try{
      if(typeof window._oaiCloseGeneralModuleToCover === 'function' && window._oaiCloseGeneralModuleToCover(viewId + '-close-button')) return;
    }catch(e){ console.warn('[가톨릭길동무]', e); }
    var v = document.getElementById(viewId);
    if (v) v.classList.remove('open');
    if (typeof goToCover === 'function') goToCover();
  }
  on('web-close-btn', 'click', function() { closeGeneralModuleByButton('web-view'); });
  on('trail-close-btn', 'click', function() { closeGeneralModuleByButton('trail-view'); });
  on('qna-close-btn', 'click', function() { closeGeneralModuleByButton('qna-view'); });

  // ── 순례길 ──
  on('trail-sh-close-btn', 'click', function() { trailCloseSheet(); });
  on('trail-loc-btn',      'click', function() { trailMyLoc(); });
  on('trail-tab-map',  'click', function() { trailSetView('map'); });
  on('trail-tab-list', 'click', function() { trailSetView('list'); });

  // ── Q&A 탭 ──
  on('qna-tab-write',   'click', function() { qnaShowTab('write'); });

  // ── 검색 모달 탭 ──
  on('sm-tab-cat',   'click', function() { smSwitchTab('cat'); });
  on('sm-tab-place', 'click', function() { smSwitchTab('place'); });

  // ── 매일미사 iframe 로드 ──
  on('missa-frame', 'load', function() { if (typeof missaLoaded === 'function') missaLoaded(); });
});


// 커버 메뉴 popstate 처리는 patches.js 메인 컨트롤러에서 단일 처리
