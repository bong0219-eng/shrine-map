/* sw-update.js — 서비스워커 캐시 버전 관리
   앱 버전 변경 감지 → 강제 새로고침 처리
   원본 index.html Block F 에서 분리 */

(function(){
  'use strict';
  if(window.__APP_CACHE_LIFECYCLE_GUARD__) return;
  window.__APP_CACHE_LIFECYCLE_GUARD__ = true;
  var APP_VERSION = 'V1-5';
  window.APP_VERSION = APP_VERSION;

  function now(){ return Date.now ? Date.now() : new Date().getTime(); }
  function isTypingTarget(el){
    if(!el) return false;
    var tag = (el.tagName || '').toLowerCase();
    return tag === 'input' || tag === 'textarea' || el.isContentEditable;
  }
  function isTransientOpen(){
    try{
      if(document.getElementById('srch-modal') && document.getElementById('srch-modal').classList.contains('open')) return true;
      if(document.getElementById('sheet-route') && document.getElementById('sheet-route').classList.contains('open')) return true;
      if(document.getElementById('missa-view') && document.getElementById('missa-view').classList.contains('open')) return true;
    }catch(e){ console.warn("[가톨릭길동무]", e); }
    return false;
  }
  function stableReload(reason){
    try{ if(isTypingTarget(document.activeElement) || isTransientOpen()) return false; }catch(e){ console.warn("[가톨릭길동무]", e); }
    try{ sessionStorage.setItem('oai_stable_auto_reload_reason', reason || 'maintenance'); }catch(e){ console.warn("[가톨릭길동무]", e); }
    try{ location.reload(); }catch(e){ location.href = location.href; }
    return true;
  }

  /* 오래 백그라운드에 있던 앱만 조용히 새로 시작합니다. 사용 중 강제 새로고침은 하지 않습니다. */
  var hiddenAt = 0;
  var BACKGROUND_RELOAD_AFTER = 30 * 60 * 1000;  // 30분 이상 방치 후 복귀 시 1회 정리
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'hidden'){
      hiddenAt = now();
      try{ sessionStorage.setItem('oai_hidden_at', String(hiddenAt)); }catch(e){ console.warn("[가톨릭길동무]", e); }
      return;
    }
    if(document.visibilityState === 'visible'){
      var last = hiddenAt;
      try{ last = Math.max(last, parseInt(sessionStorage.getItem('oai_hidden_at') || '0', 10) || 0); }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(last && now() - last >= BACKGROUND_RELOAD_AFTER){
        setTimeout(function(){ stableReload('background-return'); }, 350);
      }
    }
  }, true);

  /* 서비스워커는 캐시를 매번 지우지 않고, 버전이 바뀔 때만 오래된 캐시를 정리합니다. */
  function registerServiceWorker(){
    if(!('serviceWorker' in navigator)) return;
    try{
      navigator.serviceWorker.register('./sw.js?v=' + encodeURIComponent(APP_VERSION))
        .then(function(reg){ try{ reg.update(); }catch(e){ console.warn("[가톨릭길동무]", e); } })
        .catch(function(){});
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', registerServiceWorker, {once:true});
  else registerServiceWorker();
})();
