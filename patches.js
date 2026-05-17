/* patches.js — 뒤로가기·스와이프·터치 UX 보조 모듈
   history 기반 뒤로가기 컨트롤러, 스와이프 액션,
   터치 피드백과 키보드 입력 보정을 담당합니다. */

/*
 * ═══════════════════════════════════════════════════════════
 *  뒤로가기 원칙
 *  [대전제] 커버에서만 앱 탈출.
 *
 *  핵심 설계:
 *  - go(1) 방식: [루트(0), 트랩(1)] 유지 → back → go(1) → UI처리
 *  - 외부뷰(미사/기도/교구지도)/모듈뷰(웹/순례길) 닫힐 때 → goToCover()
 *  - 카테고리 레이어(시트/카드/모달) → 하나씩 닫기
 *  - 아무것도 없고 앱 활성 → goToCover()
 *  - 커버 상태 → 토스트 → 두 번째 → 앱 종료
 * ═══════════════════════════════════════════════════════════
 */
(function(){
  'use strict';
  if(window.__BACK_CTRL__) return;
  window.__BACK_CTRL__ = true;

  var _href = location.href.split('#')[0];

  /* history 초기화 */
  try{
    history.replaceState({_p:0}, '', _href);
    history.pushState({_p:1}, '', _href);
  }catch(e){ console.warn("[가톨릭길동무]", e); }

  function $b(id){ return document.getElementById(id); }
  function appActive(){ return document.documentElement.classList.contains('app-active'); }

  function isGuideModalOpen(){
    try{ return !!document.querySelector('.guide-modal.show'); }catch(e){ return false; }
  }
  function closeGuideModals(){
    try{
      var mq = $('mass-quick-modal');
      if(mq && mq.classList.contains('show') && typeof window.closeMassQuickMenu === 'function'){
        var fromPrayer = false;
        try{ fromPrayer = !!(mq.dataset && mq.dataset.returnSource === 'prayer'); }catch(e){}
        try{ if(typeof window._isPrayerPopupReturnSource === 'function' && window._isPrayerPopupReturnSource()) fromPrayer = true; }catch(e){}
        // closeMassQuickMenu() 안에서 기도문 복귀 팝업 여부를 직접 판정해 커버를 확정한다.
        // 여기서 한 번 더 _forceCoverAfterPrayerQuickPopup()를 호출하면 커버/히스토리 재설정이 중복되어
        // 팝업 복귀 또는 팝업 닫힘 순간 화면이 흔들릴 수 있다.
        window.closeMassQuickMenu();
      } else {
        document.querySelectorAll('.guide-modal.show').forEach(function(el){
          el.classList.remove('show');
          el.setAttribute('aria-hidden','true');
        });
      }
      if(typeof window.resetGuideManualScroll === 'function') window.resetGuideManualScroll();
      if(typeof window._resetCoverExitReady === 'function') window._resetCoverExitReady();
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }

  function callGTC(){
    if(typeof window.goToCover === 'function') window.goToCover();
    else {
      document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
      var cv = $b('cover'); if(cv) cv.style.display = '';
    }
  }

  /* ── 외부·모듈 뷰 닫기 (닫으면 항상 goToCover) ── */
  function closeExtOrModule(){
    /* 매일미사 */
    var missa = $b('missa-view');
    if(missa && missa.classList.contains('open')){
      if(typeof window.closeMissa === 'function') window.closeMissa();
      else missa.classList.remove('open');
      return true;
    }
    /* 기도문은 전용 컨트롤러 한 곳에서만 처리한다. */
    var prayer = $b('prayer-view');
    if(prayer && prayer.classList.contains('open')){
      if(typeof handlePrayerBack === 'function') return handlePrayerBack('closeExtOrModule-prayer');
      if(typeof window.closePrayerView === 'function') window.closePrayerView();
      else prayer.classList.remove('open');
      callGTC();
      return true;
    }
    /* 교구지도 */
    var diocese = $b('diocese-view');
    if(diocese && diocese.classList.contains('open')){
      if(typeof window.closeDioceseView === 'function') window.closeDioceseView();
      else diocese.classList.remove('open');
      callGTC(); return true;
    }
    /* module-view (웹/순례길) */
    var mods = document.querySelectorAll('.module-view.open');
    if(mods.length){
      mods[mods.length-1].classList.remove('open');
      callGTC(); return true;
    }
    return false;
  }

  /* ── 카테고리 레이어 닫기 (하나씩) ── */
  function closeLayer(){
    var el;
    el = $b('exit-dlg');
    if(el && el.classList.contains('open')){ el.classList.remove('open'); return true; }

    el = $b('srch-modal');
    if(el && el.classList.contains('open')){
      if(typeof window.closeSearchModal==='function') window.closeSearchModal();
      else el.classList.remove('open');
      return true;
    }

    // 길찾기 시트가 열려 있거나 경로 상태가 남아 있으면 인포카드보다 먼저 정리한다.
    // 순서: 경로삭제 → 출발/도착 초기화 → 도착 노랑마커 + 인포카드 복귀.
    el = $b('sheet-route');
    try{
      if((el && el.classList.contains('open')) || _routeMode || _rS || _rE){
        var dest = (_rE && _rE.lat) ? Object.assign({}, _rE) : null;
        try{ if(typeof window.resetRoute==='function') window.resetRoute(); }catch(e){ console.warn("[가톨릭길동무]", e); }
        try{ _routeMode = false; }catch(e){ console.warn("[가톨릭길동무]", e); }
        if(el) el.classList.remove('open');
        try{ if(_activeTab==='route') _activeTab=null; if(typeof _updateTabBtns==='function') _updateTabBtns(null); }catch(e){ console.warn("[가톨릭길동무]", e); }
        if(dest){
          setTimeout(function(){
            try{
              var items = (typeof _getCurrentItems==='function') ? _getCurrentItems() : [];
              var idx = (typeof dest.idx==='number' && dest.idx>=0) ? dest.idx : items.findIndex(function(p){return Number(p.lat)===Number(dest.lat)&&Number(p.lng)===Number(dest.lng);});
              var item = idx>=0 ? items[idx] : null;
              if(item){
                if(_mode==='shrine' && typeof _selectShrineMarker==='function') _selectShrineMarker(idx);
                else if(_mode==='parish' && typeof _selectParishMarker==='function') _selectParishMarker(item);
                else if(typeof _selectRetreatMarker==='function') _selectRetreatMarker(item);
                if(typeof _showInfoCard==='function') _showInfoCard(item, idx);
                if(typeof _focusMarkerAboveInfoCard==='function') _focusMarkerAboveInfoCard(item);
              }
            }catch(e){ console.warn("[가톨릭길동무]", e); }
          }, 90);
        }
        return true;
      }
    }catch(e){ console.warn("[가톨릭길동무]", e); }

    el = $b('info-card');
    if(el && el.classList.contains('open')){
      if(typeof window.closeInfoCard==='function') window.closeInfoCard();
      else{ el.classList.remove('open'); el.style.display='none'; }
      return true;
    }

    try{ if(_activeTab && typeof closeTab==='function'){ closeTab(_activeTab); return true; } }catch(e){ console.warn("[가톨릭길동무]", e); }

    var tsh = document.querySelector('.trail-sheet.open');
    if(tsh){ tsh.classList.remove('open'); return true; }

    var sheets = document.querySelectorAll('.sheet.open');
    if(sheets.length){ sheets[sheets.length-1].classList.remove('open'); return true; }

    return false;
  }

  /* ── popstate 핸들러 ── */
  var _restoring = false;


  /* ─────────────────────────────────────────────
     V1-S 기도문 전용 뒤로가기 컨트롤러 — history 단계 분리 제거

     원칙:
     1) 다른 정상 카테고리처럼 실제 history는 공통 root/trap 한 쌍만 사용한다.
     2) 기도문 detail/list/popup은 별도 history state를 만들지 않고 DOM 상태로만 판단한다.
     3) popstate가 오면 먼저 history.go(1)로 공통 trap을 복원한 뒤 화면만 바꾼다.
        - 본문   → 목록
        - 목록   → 빠른메뉴 팝업 또는 커버
        - 팝업   → 커버
     4) 매일미사·성가는 외부 사이트, 기도문은 내부 카테고리이므로 복귀 플래그는 분리한다.
     ───────────────────────────────────────────── */
  function prayerView(){ return $b('prayer-view'); }
  function prayerDetail(){ return $b('prayer-detail'); }
  function prayerPopup(){ return $b('mass-quick-modal'); }
  function isPrayerOpen(){
    var pv = prayerView();
    return !!(pv && pv.classList.contains('open'));
  }
  function isPrayerDetailShowing(){
    var d = prayerDetail();
    return !!(isPrayerOpen() && d && d.classList.contains('show'));
  }
  function isPrayerQuickSource(){
    var pv = prayerView();
    var yes = false;
    try{ if(pv && pv.dataset && pv.dataset.quickSource === 'mass') yes = true; }catch(_e){}
    try{ if(window.__OAI_PRAYER_FROM_QUICK_LOCK__ === true) yes = true; }catch(_e){}
    try{ if(sessionStorage.getItem('oai_prayer_from_quick_lock') === '1') yes = true; }catch(_e){}
    try{ if(typeof window._shouldPrayerQuickReturn === 'function' && window._shouldPrayerQuickReturn()) yes = true; }catch(_e){}
    return !!yes;
  }
  function keepPrayerQuickSource(on){
    try{ if(typeof window._setPrayerQuickReturn === 'function') window._setPrayerQuickReturn(!!on); }catch(_e){}
    try{ window.__OAI_PRAYER_FROM_QUICK_LOCK__ = !!on; }catch(_e){}
    try{ if(on) sessionStorage.setItem('oai_prayer_from_quick_lock','1'); else sessionStorage.removeItem('oai_prayer_from_quick_lock'); }catch(_e){}
    try{
      var pv = prayerView();
      if(pv && pv.dataset){
        if(on) pv.dataset.quickSource = 'mass';
        else delete pv.dataset.quickSource;
      }
    }catch(_e){}
  }
  function isPrayerReturnPopupOpen(){
    var mq = prayerPopup();
    if(!(mq && mq.classList.contains('show'))) return false;
    var yes = false;
    try{ if(mq.dataset && mq.dataset.returnSource === 'prayer') yes = true; }catch(_e){}
    try{ if(typeof window._isPrayerPopupReturnSource === 'function' && window._isPrayerPopupReturnSource()) yes = true; }catch(_e){}
    return !!yes;
  }
  function armPrayerBackTrap(reason){
    /* 호환용 함수. V1-S부터 기도문 detail/list용 별도 pushState는 만들지 않는다.
       공통 컨트롤러가 이미 갖고 있는 root/trap을 유지하는 것만 필요하다. */
    try{
      if(isPrayerOpen() && typeof window._ensureAppBackTrap === 'function'){
        window._ensureAppBackTrap(reason || 'prayer-ui-state');
      }
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function pushPrayerDetailState(reason){ armPrayerBackTrap(reason || 'prayer-detail'); }
  function replacePrayerListState(reason){ armPrayerBackTrap(reason || 'prayer-list'); }
  function hidePrayerOnly(){
    try{
      var d = prayerDetail();
      if(d) d.classList.remove('show');
      var pv = prayerView();
      if(pv){
        pv.classList.remove('open');
        try{ delete pv.dataset.quickSource; }catch(_e){}
      }
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function showCoverOnlyForPrayer(){
    try{
      document.documentElement.classList.remove('app-active','parish-mode','retreat-mode');
      if(typeof window.oaiSetMainMapLayerHidden === 'function') window.oaiSetMainMapLayerHidden(false);
      var cv = $b('cover');
      if(cv){
        cv.style.display = '';
        cv.style.opacity = '';
        cv.style.pointerEvents = '';
        try{ cv.scrollTop = 0; }catch(_e){}
      }
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function resetPrayerFlags(){
    try{ if(typeof window._setPrayerPopupReturnSource === 'function') window._setPrayerPopupReturnSource(false); }catch(_e){}
    try{ if(typeof window._clearPrayerQuickReturn === 'function') window._clearPrayerQuickReturn(); }catch(_e){}
    try{ if(typeof window._clearMassQuickReturnForReload === 'function') window._clearMassQuickReturnForReload(); }catch(_e){}
    try{ window.__OAI_PRAYER_FROM_QUICK_LOCK__ = false; }catch(_e){}
    try{ sessionStorage.removeItem('oai_prayer_from_quick_lock'); }catch(_e){}
    try{ window.__OAI_PRAYER_POPUP_COVER_GUARD_UNTIL__ = 0; }catch(_e){}
    try{ window.__OAI_PRAYER_COVER_FORCE_FIRST_TOAST_UNTIL__ = 0; }catch(_e){}
  }
  function ensureCoverTrapAfterPrayer(reason){
    try{
      if(typeof window._resetCoverBackTrap === 'function') window._resetCoverBackTrap(reason || 'prayer-cover-reset');
      else if(typeof window._ensureCoverBackTrap === 'function') window._ensureCoverBackTrap(reason || 'prayer-cover-reset');
      else {
        var href = location.href.split('#')[0];
        history.replaceState({_p:0, oai_cover_root:reason||'prayer-cover-reset'}, '', href);
        history.pushState({_p:1, oai_cover_trap:reason||'prayer-cover-reset'}, '', href);
      }
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function settleCoverTrapAfterPrayer(reason){
    // V1-S: 기도문 팝업 → 커버 후에는 이미 공통 컨트롤러가 history.go(1)로 trap을 복원한 상태다.
    // 여기서 replaceState/pushState를 강제로 반복하면 Android/PWA에서 다음 Back이 앱 종료로 오판될 수 있다.
    // 따라서 현재 trap이 살아 있으면 그대로 두고, 없을 때만 최소한으로 보강한다.
    function run(tag){
      try{
        if(document.documentElement.classList.contains('app-active')) return;
        var mq = prayerPopup();
        if(mq && mq.classList.contains('show')) return;
        if(typeof window._resetCoverExitReady === 'function') window._resetCoverExitReady();
        if(typeof window._clearCoverExitArmed === 'function') window._clearCoverExitArmed();
        if(typeof window._ensureCoverBackTrap === 'function') window._ensureCoverBackTrap((reason||'prayer-cover') + '-' + tag);
        else {
          var st = history.state;
          if(!(st && st._p === 1)) ensureCoverTrapAfterPrayer((reason||'prayer-cover') + '-' + tag);
        }
      }catch(e){ console.warn('[가톨릭길동무]', e); }
    }
    run('now');
    setTimeout(function(){ run('after-popstate'); }, 0);
    if(window.requestAnimationFrame) window.requestAnimationFrame(function(){ run('raf'); });
    setTimeout(function(){ run('settle-80'); }, 80);
  }
  function resetPrayerToCover(reason){
    try{
      var mq = prayerPopup();
      if(mq){
        mq.classList.remove('show');
        mq.setAttribute('aria-hidden','true');
        try{ delete mq.dataset.returnSource; }catch(_e){}
      }
      hidePrayerOnly();
      showCoverOnlyForPrayer();
      resetPrayerFlags();
      try{ if(typeof window._resetCoverExitReady === 'function') window._resetCoverExitReady(); }catch(_e){}
      try{ if(typeof window._clearCoverExitArmed === 'function') window._clearCoverExitArmed(); }catch(_e){}
      settleCoverTrapAfterPrayer(reason || 'prayer-cover-reset');
      return true;
    }catch(e){ console.warn('[가톨릭길동무]', e); return true; }
  }
  function prayerDetailToList(reason){
    try{
      var fromQuick = isPrayerQuickSource();
      var d = prayerDetail();
      if(d) d.classList.remove('show');
      if(typeof window.showPrayerListOnly === 'function') window.showPrayerListOnly();
      keepPrayerQuickSource(!!fromQuick);
      return true;
    }catch(e){ console.warn('[가톨릭길동무]', e); return true; }
  }
  function prayerListToPopupOrCover(reason){
    try{
      var fromQuick = isPrayerQuickSource();
      if(!fromQuick) return resetPrayerToCover(reason || 'prayer-list-cover');

      /* V1-S: 기도문 목록 → 빠른메뉴 팝업 복귀는 직접 팝업을 띄우지 않는다.
         사용자의 Back으로 공통 trap이 일단 소비된 직후라, 이 자리에서 openMassQuickMenu()를
         바로 호출하면 Android/PWA에서 history.go(1) 복원 타이밍과 겹쳐 팝업 Back이 앱 종료로
         먹힐 수 있다. 기존 안정 함수 _returnToMassQuickMenu('prayer')에게 맡기면,
         공통 trap 복원이 끝난 뒤
         '기도문 닫기 → 커버 복원 → 커버 위 빠른메뉴 팝업 표시'를 한 번에 실행한다. */
      try{ keepPrayerQuickSource(true); }catch(_e){}
      try{ if(typeof window._setPrayerPopupReturnSource === 'function') window._setPrayerPopupReturnSource(true); }catch(_e){}
      try{ if(typeof window._resetCoverExitReady === 'function') window._resetCoverExitReady(); }catch(_e){}
      try{ if(typeof window._clearCoverExitArmed === 'function') window._clearCoverExitArmed(); }catch(_e){}
      if(typeof window._returnToMassQuickMenu === 'function'){
        window._returnToMassQuickMenu('prayer');
        return true;
      }

      /* fallback: _returnToMassQuickMenu가 없을 때만 예전 방식으로 복구 */
      hidePrayerOnly();
      showCoverOnlyForPrayer();
      var mq = prayerPopup();
      if(mq){
        try{ mq.dataset.returnSource = 'prayer'; }catch(_e){}
        mq.classList.add('show');
        mq.setAttribute('aria-hidden','false');
      }
      try{ history.pushState({_p:1, oai_mass_quick:1, oai_from_prayer:1}, '', location.href.split('#')[0]); }catch(_e){}
      return true;
    }catch(e){ console.warn('[가톨릭길동무]', e); return true; }
  }
  function handlePrayerBack(reason){
    try{
      if(isPrayerReturnPopupOpen()) return resetPrayerToCover(reason || 'prayer-popup-cover');
      if(isPrayerDetailShowing()) return prayerDetailToList(reason || 'prayer-detail-back');
      if(isPrayerOpen()) return prayerListToPopupOrCover(reason || 'prayer-list-back');
      return false;
    }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
  }
  try{
    window._oaiArmPrayerBackTrap = armPrayerBackTrap;
    window._oaiPrayerPushDetailState = pushPrayerDetailState;
    window._oaiPrayerReplaceListState = replacePrayerListState;
    window._oaiPrayerBackHandle = handlePrayerBack;
    window._oaiPrayerListToPopupOrCover = prayerListToPopupOrCover;
    window._oaiPrayerResetToCover = resetPrayerToCover;
  }catch(_e){}

  function runPendingPrayerQuickPopup(){
    try{
      var cb = window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__;
      var until = Number(window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP_UNTIL__ || 0);
      if(typeof cb !== 'function') return false;
      if(until && Date.now() > until){
        window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__ = null;
        window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP_UNTIL__ = 0;
        return false;
      }
      window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP__ = null;
      window.__OAI_AFTER_RESTORE_PRAYER_QUICK_POPUP_UNTIL__ = 0;
      setTimeout(function(){
        try{ cb(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      }, 0);
      return true;
    }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
  }

  function runPendingPrayerCoverReset(){
    try{
      var cb = window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__;
      var until = Number(window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET_UNTIL__ || 0);
      if(typeof cb !== 'function') return false;
      if(until && Date.now() > until){
        window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__ = null;
        window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET_UNTIL__ = 0;
        return false;
      }
      window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__ = null;
      window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET_UNTIL__ = 0;
      setTimeout(function(){
        try{ cb(); }catch(e){ console.warn('[가톨릭길동무]', e); }
      }, 0);
      return true;
    }catch(e){ console.warn('[가톨릭길동무]', e); return false; }
  }

  window.addEventListener('popstate', function(){
    if(window._appExiting) return;

    /* history.go(1)로 공통 trap을 복원하면서 발생한 popstate는
       어떤 화면 처리도 하지 않고 여기서 끝낸다. 이 순서가 중요하다. */
    if(_restoring){
      _restoring = false;
      if(runPendingPrayerCoverReset()) return;
      runPendingPrayerQuickPopup();
      return;
    }

    /* 빠른메뉴에서 주요기도문으로 진입하기 위해 팝업용 mq history state를
       직접 pop하는 중이면, 이것은 사용자의 뒤로가기 명령이 아니다. */
    try{
      var mqPopUntil = Number(window.__OAI_MQ_STATE_POPPING__ || 0);
      if(mqPopUntil && Date.now() < mqPopUntil){
        window.__OAI_MQ_STATE_POPPING__ = 0;
        var cb = window.__OAI_AFTER_MQ_STATE_POP__;
        window.__OAI_AFTER_MQ_STATE_POP__ = null;
        if(typeof cb === 'function') setTimeout(cb, 0);
        return;
      }
    }catch(e){ console.warn('[가톨릭길동무]', e); }

    /* 커버 위에 떠 있는 기도문 복귀 팝업은 일반 종료 흐름보다 먼저 닫고 커버를 확정한다.
       단, 먼저 history.go(1)로 방금 소비된 공통 trap을 복원한 뒤 닫아야
       커버 첫 Back이 앱 종료로 빠지지 않는다. */
    if(isPrayerReturnPopupOpen()){
      var coverCb = function(){ resetPrayerToCover('prayer-popup-cover-after-restore'); };
      try{
        window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__ = coverCb;
        window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET_UNTIL__ = Date.now() + 1800;
        _restoring = true;
        history.go(1);
        setTimeout(function(){
          try{
            if(window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__ === coverCb){
              _restoring = false;
              window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET__ = null;
              window.__OAI_AFTER_RESTORE_PRAYER_COVER_RESET_UNTIL__ = 0;
              coverCb();
            }
          }catch(e){ console.warn('[가톨릭길동무]', e); }
        }, 160);
      }catch(e){
        _restoring = false;
        console.warn('[가톨릭길동무]', e);
        coverCb();
      }
      return;
    }

    /* 빠른메뉴/안내 팝업이 열려 있으면 먼저 닫는다. */
    if(isGuideModalOpen()){
      closeGuideModals();
      try{ if(typeof window._ensureCoverBackTrap === 'function') window._ensureCoverBackTrap(); else history.replaceState({_p:1}, '', _href); }catch(e){ console.warn("[가톨릭길동무]", e); }
      return;
    }

    /* 커버: 토스트 → 두 번째에 종료. */
    if(!appActive()){
      var exiting = false;
      if(typeof window._showBackToast==='function') exiting = window._showBackToast() === true;
      if(!exiting){ try{ history.pushState({_p:1}, '', _href); }catch(e){ console.warn("[가톨릭길동무]", e); } }
      return;
    }

    /* 앱 활성 상태에서는 다른 정상 카테고리와 동일하게 먼저 trap을 복원하고,
       그 다음 DOM 상태를 직접 정리한다. 기도문도 여기서만 처리한다. */
    _restoring = true;
    try{ history.go(1); }catch(e){ _restoring = false; console.warn("[가톨릭길동무]", e); }

    if(handlePrayerBack('prayer-popstate')) return;
    if(closeExtOrModule()) return;
    if(closeLayer()) return;
    callGTC();
  }, false);
  /* Cordova 물리 백버튼 */
  document.addEventListener('backbutton', function(){
    if(handlePrayerBack('prayer-hardware-back')) return;
    if(isGuideModalOpen()){ closeGuideModals(); return; }
    if(!appActive()){
      if(typeof window._showBackToast==='function') window._showBackToast();
      return;
    }
    if(closeExtOrModule()) return;
    if(closeLayer()) return;
    callGTC();
  }, false);

  // 외부 사이트 방문 후 복귀 시 history 트랩 강제 재확립.
  // 트랩이 소실되면 다음 뒤로가기에서 앱이 탈출된다.
  window.addEventListener('pageshow', function(){
    try{
      var st = history.state;
      if(st && st._p === 1) return;  // 트랩 유지 중이면 스킵
      history.replaceState({_p:0}, '', _href);
      history.pushState({_p:1}, '', _href);
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }, true);

})();

/* removed auto ?v=Date.now redirect for no-cache mode */

/* OAI removed destructive startup reset: preserves back/external return state. */

(function(){
  'use strict';
  if(window.__APP_PRAYER_VIEW_HELPER__) return;
  window.__APP_PRAYER_VIEW_HELPER__ = true;

  function el(id){ return document.getElementById(id); }
  function blurActive(){ try{ var a=document.activeElement; if(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) a.blur(); }catch(_){ console.warn("[가톨릭길동무] silent catch"); } }

  /* 통합 뒤로가기 컨트롤러가 기도문을 처리하므로, 여기서는 목록 초기화만 담당한다.
     기도문 전용 history.pushState / 별도 popstate / 별도 backbutton은 사용하지 않는다. */
  function showPrayerListOnly(){
    blurActive();
    var d=el('prayer-detail');
    if(d) d.classList.remove('show');
    if(typeof window.prRestoreListPosition === 'function'){
      try{ window.prRestoreListPosition(); }catch(_){ console.warn("[가톨릭길동무] silent catch"); }
    }
  }
  try{ window.showPrayerListOnly = showPrayerListOnly; }catch(_){ console.warn("[가톨릭길동무] silent catch"); }
})();




(function(){
  if(window.__APP_PRAYER_SYNC_GUARD__) return;
  window.__APP_PRAYER_SYNC_GUARD__ = true;
  function syncPrayerTabOn(){
    var wrap = document.getElementById('prayer-tabs');
    if(!wrap) return;
    var tabs = wrap.querySelectorAll('.pr-tab');
    if(!tabs || !tabs.length) return;
    var active = null;
    for(var i=0;i<tabs.length;i++){
      var c = tabs[i].style && tabs[i].style.color ? String(tabs[i].style.color).toLowerCase() : '';
      if(c === '#fff' || c === 'white' || c.indexOf('255, 255, 255') > -1){ active = tabs[i]; break; }
    }
    if(!active) active = wrap.querySelector('.pr-tab.on') || tabs[0];
    for(var j=0;j<tabs.length;j++) tabs[j].classList.toggle('on', tabs[j] === active);
  }
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('#prayer-tabs .pr-tab') : null;
    if(t){
      setTimeout(function(){
        var tabs = document.querySelectorAll('#prayer-tabs .pr-tab');
        for(var i=0;i<tabs.length;i++) tabs[i].classList.remove('on');
        t.classList.add('on');
      }, 0);
      setTimeout(syncPrayerTabOn, 80);
    }
  }, true);
  document.addEventListener('DOMContentLoaded', function(){ setTimeout(syncPrayerTabOn, 300); });
  window.addEventListener('load', function(){ setTimeout(syncPrayerTabOn, 300); });
  // setInterval → MutationObserver: prayer-view의 class 변화(open/close)시에만 실행
  // 기존 500ms 폴링은 앱 수명 동안 영구 실행되어 불필요한 CPU 낭비였음
  (function(){
    var pv = document.getElementById('prayer-view');
    if(!pv){
      // DOM 준비 전이면 DOMContentLoaded 후 재시도
      document.addEventListener('DOMContentLoaded', function(){
        var el = document.getElementById('prayer-view');
        if(el) new MutationObserver(function(){
          if(el.classList.contains('open')) syncPrayerTabOn();
        }).observe(el, {attributes:true, attributeFilter:['class']});
      }, {once:true});
      return;
    }
    new MutationObserver(function(){
      if(pv.classList.contains('open')) syncPrayerTabOn();
    }).observe(pv, {attributes:true, attributeFilter:['class']});
  })();
})();


(function(){
  if(window.__APP_FAITH_GUARD__) return;
  window.__APP_FAITH_GUARD__ = true;

  function normalizeParishCountText(text){
    text = String(text || '').replace(/\s+/g,' ').trim();
    var m = text.match(/본당\s*수\s*(\d+)\s*개?/);
    if(!m) m = text.match(/(\d+)\s*본당/);
    if(!m) m = text.match(/본당\s*(\d+)\s*개?/);
    if(!m) m = text.match(/(\d+)\s*개/);
    return m ? ('본당 수 ' + m[1] + '개') : text;
  }

  function patchDioceseParishCount(){
    var frame = document.getElementById('diocese-frame');
    if(!frame) return;
    var doc = null;
    try{ doc = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document); }catch(e){ return; }
    if(!doc) return;
    try{
      doc.querySelectorAll('.lv-parish-count,.oai-parish-count,.lv-sec-cnt,.lv-count-line,.oai-parish-count-line').forEach(function(el){
        var t = normalizeParishCountText(el.textContent);
        if(t){ el.textContent = t; el.classList.add('oai-parish-count-line'); }
      });
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }

  window.addEventListener('load',function(){
    patchDioceseParishCount();
    var frame = document.getElementById('diocese-frame');
    if(frame && !frame.__oaiParishCountFinal20260428){
      frame.__oaiParishCountFinal20260428 = true;
      frame.addEventListener('load',function(){
        setTimeout(patchDioceseParishCount,100);
        setTimeout(patchDioceseParishCount,500);
      });
    }
  });
  document.addEventListener('click',function(){
    setTimeout(patchDioceseParishCount,150);
    setTimeout(patchDioceseParishCount,700);
  },true);
})();





(function(){
  if(window.__APP_FONT_SCALE_GUARD__) return;
  window.__APP_FONT_SCALE_GUARD__=true;
  // V37: 문의·건의는 qa-firebase.html 한 경로로만 통일한다.
  var QA_URL="qa-firebase.html?v=V1-S-A16";
  var FONT_KEY='prayer_font_size', BASE=16;
  function el(id){return document.getElementById(id)}
  function getPx(){var px=parseInt(localStorage.getItem(FONT_KEY)||BASE,10);return (px>=13&&px<=30)?px:BASE;}
  function applyScale(){
    var px=getPx();
    var scale=px/BASE;
    document.documentElement.classList.add('oai-font-global');
    document.documentElement.style.setProperty('--app-font-scale',String(scale));
    var pv=el('prayer-view');
    if(pv){
      pv.style.setProperty('--pr-item-fs',px+'px');
      pv.style.setProperty('--pr-body-fs',px+'px');
      pv.style.setProperty('--pr-detail-fs',(px+1)+'px');
    }
    try{
      var df=el('diocese-frame');
      if(df && df.contentWindow && typeof df.contentWindow.dioApplySharedFont==='function') df.contentWindow.dioApplySharedFont();
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  window.__APP_applyGlobalFont=applyScale;
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', applyScale, {once:true});
  else applyScale();
  window.addEventListener('load', applyScale, {once:true});
  function ensureCoverControls(){var cover=el('cover');if(!cover)return;var box=el('cover-font-controls');if(!box){box=document.createElement('div');box.id='cover-font-controls';cover.appendChild(box);}box.className='pr-font-ctrl';box.innerHTML='<button class="pr-font-btn pr-sm" type="button" aria-label="글자 작게">가</button><div class="pr-font-divider"></div><button class="pr-font-btn pr-lg" type="button" aria-label="글자 크게">가</button>';var sm=box.querySelector('.pr-sm'),lg=box.querySelector('.pr-lg');if(sm)sm.onclick=function(e){e.preventDefault();e.stopPropagation();window.prAdjustFont(-1)};if(lg)lg.onclick=function(e){e.preventDefault();e.stopPropagation();window.prAdjustFont(1)};}
  function setEmojiIcons(){var icons={'cc-1':'✝️','cc-2':'⛪','cc-3':'🙏','cc-4':'🌿','cc-5':'🥾','cc-6':'🌐','cc-7':'🧭'};Object.keys(icons).forEach(function(id){var btn=el(id);if(!btn)return;var wrap=btn.querySelector('.cover-icon-wrap');if(wrap)wrap.innerHTML='<span class="cover-emoji" aria-hidden="true">'+icons[id]+'</span>';});}
  function configureQna(){
    window.QNA_FORM_URL=QA_URL;
    window.QNA_ANSWER_URL=QA_URL;
    var q=el('qna-list');
    if(q&&q.innerHTML.indexOf('Google Form')>=0){
      q.innerHTML='<div class="qna-card"><div class="qna-kicker">문의 · 수정건의</div><div class="qna-title">문의·건의 페이지 연결</div><div class="qna-text">문의와 수정건의는 가톨릭길동무 문의·건의 페이지에서 작성하고 확인합니다.</div><div class="qna-actions"><button class="primary" type="button" onclick="goQaFirebase()">문의 작성하기</button><button type="button" onclick="goQaFirebase()">답변 보기</button></div></div>';
    }
  }
  window.qnaOpenFormUrl=function(){ if(typeof window.goQaFirebase==='function') window.goQaFirebase(); else location.href=QA_URL; };
  window.qnaOpenAnswerUrl=function(){ if(typeof window.goQaFirebase==='function') window.goQaFirebase(); else location.href=QA_URL; };
  function wireQnaButton(){var btn=el('qna-cover-btn');if(btn)btn.onclick=function(ev){if(ev)ev.preventDefault();window.openQnaView();};}
  window.openQnaView=function(){ location.href=QA_URL; };
  window.goQaFirebase=function(){ location.href=QA_URL; };
  function boot(){ensureCoverControls();setEmojiIcons();configureQna();wireQnaButton();applyScale();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('load',function(){boot();setTimeout(boot,250);setTimeout(boot,900);},{once:true});window.addEventListener('pageshow',boot);
})();

// user-cache mode: keep app cache stable; refresh changed files through versioned URLs.

// ── PWA 설치 버튼 로직 ──
(function(){
  /* PWA 설치 버튼 통합 컨트롤러
     ① standalone(설치된 앱) 상태이면 버튼 즉시 숨기고 종료
     ② 아닌 경우: beforeinstallprompt 감지 → 버튼 표시
        app-active 클래스·matchMedia 변화 → 즉시 재평가 */
  if(window.__APP_PWA_INSTALL_GUARD__) return;
  window.__APP_PWA_INSTALL_GUARD__ = true;

  var prompt = null;

  function isStandaloneNow(){
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.documentElement.classList.contains('app-active');
  }

  function getBtn(){ return document.getElementById('pwa-install-btn'); }

  function hideInstallBtn(){
    var btn = getBtn();
    if(btn) btn.style.setProperty('display','none','important');
  }

  function applyVisibility(){
    if(isStandaloneNow()) hideInstallBtn();
  }

  if(isStandaloneNow()){ hideInstallBtn(); return; }

  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    prompt = e;
    if(!isStandaloneNow()){
      var btn = getBtn();
      if(btn) btn.style.display = 'flex';
    }
  });

  window.addEventListener('appinstalled', function(){
    hideInstallBtn();
    prompt = null;
  });

  window.triggerPwaInstall = function(){
    if(!prompt) return;
    prompt.prompt();
    prompt.userChoice.then(function(r){
      if(r.outcome === 'accepted') hideInstallBtn();
      prompt = null;
    });
  };

  new MutationObserver(applyVisibility)
    .observe(document.documentElement, {attributes:true, attributeFilter:['class']});

  try{
    window.matchMedia('(display-mode: standalone)').addEventListener('change', applyVisibility);
  }catch(e){ console.warn("[가톨릭길동무]", e); }

  window.addEventListener('load', applyVisibility);
  window.addEventListener('pageshow', applyVisibility);
})();

/* ====== 성능 최적화 보정 ====== */
(function(){
  // 화면 전환 중 불필요한 레이아웃 부담을 줄인다.
  // cover의 pull-to-refresh: 불필요한 transform 제거
  var coverEl = document.getElementById('cover');
  if(coverEl) coverEl.style.willChange = 'auto';
  
  // 모듈뷰 열릴 때 contain 해제, 닫힐 때 재적용
  var observer = new MutationObserver(function(mutations){
    mutations.forEach(function(m){
      if(m.attributeName === 'class'){
        var el = m.target;
        if(el.classList.contains('open')){
          el.style.contain = 'none';
        } else {
          // 닫힌 후 짧은 딜레이로 contain 복구
          setTimeout(function(){ el.style.contain = ''; }, 300);
        }
      }
    });
  });
  
  ['missa-view','diocese-view','prayer-view','web-view','trail-view','qna-view'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) observer.observe(el, {attributes:true, attributeFilter:['class']});
  });
})();


(function(){
  'use strict';
  if(window.__APP_BACK_ROUTE_GUARD__) return;
  window.__APP_BACK_ROUTE_GUARD__ = true;

  function $(id){return document.getElementById(id);}
  function flash(el, dir){
    if(!el) return;
    el.classList.remove('oai-swipe-left','oai-swipe-right');
    void el.offsetWidth;
    el.classList.add(dir==='right'?'oai-swipe-right':'oai-swipe-left');
    setTimeout(function(){try{el.classList.remove('oai-swipe-left','oai-swipe-right');}catch(e){ console.warn("[가톨릭길동무]", e); }},240);
  }
  /* 가로로 밀 때 브라우저/웹뷰 자체 화면이 옆으로 밀리는 현상 차단 */
  /* 가로 스와이프 중 브라우저 화면이 함께 밀리는 것을 막는다. */
  function bindHorizontalGuard(el){
    if(!el || el.__oaiPreciseGuard) return;
    el.__oaiPreciseGuard = true;
    var sx=0, sy=0, horizontal=false;
    el.addEventListener('touchstart', function(e){
      if(!e.touches || !e.touches[0]) return;
      sx=e.touches[0].clientX; sy=e.touches[0].clientY; horizontal=false;
    }, {passive:true, capture:true});
    el.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches[0]) return;
      var dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
      if(Math.abs(dx)>10 && Math.abs(dx)>Math.abs(dy)*1.15) horizontal=true;
      if(horizontal && e.cancelable) e.preventDefault();
    }, {passive:false, capture:true});
  }

  /* 웹사이트 좌우 스와이프 탭 이동 — 기도문과 동일 감도 */
  function bindWebSwipe(){
    var el=$('web-list');
    if(!el || el.__oaiFinalWebSwipe) return;
    el.__oaiFinalWebSwipe = true;
    var sx=0, sy=0;
    var THRESHOLD = 32;
    var HORIZONTAL_RATIO = 1.03;
    function isHorizontalSwipe(dx, dy){
      return Math.abs(dx) >= THRESHOLD && Math.abs(dx) >= Math.abs(dy) * HORIZONTAL_RATIO;
    }
    el.addEventListener('touchstart', function(e){
      if(!e.touches || !e.touches[0]) return;
      sx=e.touches[0].clientX; sy=e.touches[0].clientY;
    }, {passive:true});
    el.addEventListener('touchmove', function(e){
      if(!e.touches || !e.touches[0]) return;
      var dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
      if(Math.abs(dx)>7 && Math.abs(dx)>Math.abs(dy)*HORIZONTAL_RATIO && e.cancelable) e.preventDefault();
    }, {passive:false});
    el.addEventListener('touchend', function(e){
      if(!e.changedTouches || !e.changedTouches[0]) return;
      var dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
      if(!isHorizontalSwipe(dx, dy)) return;
      var tabs=Array.prototype.slice.call(document.querySelectorAll('#web-cats .web-cat-btn'));
      if(!tabs.length) return;
      var cur=tabs.findIndex(function(b){return b.classList.contains('on');});
      if(cur<0) cur=0;
      var next = dx<0 ? (cur+1)%tabs.length : (cur-1+tabs.length)%tabs.length;
      var nextCat = tabs[next].dataset.webCat || tabs[next].id.replace('web-cat_','');
      if(typeof window.setWebCat==='function') window.setWebCat(nextCat);
      else tabs[next].click();
      /* 기도문과 동일하게 overlay 방식 시각 피드백 사용 */
      if(typeof window.oaiSwipeAction==='function') window.oaiSwipeAction($('web-list'), dx<0?'left':'right');
      else flash($('web-list'), dx<0?'left':'right');
    }, {passive:true});
  }

  /* 뒤로가기/경로삭제 뒤 노란 마커 복귀 보강 */
  function restoreYellowMarkerFromRoute(dest){
    if(!dest || !dest.lat) return;
    setTimeout(function(){
      try{
        var items = (typeof _getCurrentItems==='function') ? _getCurrentItems() : [];
        var idx = (typeof dest.idx==='number' && dest.idx>=0) ? dest.idx : items.findIndex(function(p){return Number(p.lat)===Number(dest.lat)&&Number(p.lng)===Number(dest.lng);});
        var item = idx>=0 ? items[idx] : (dest.item || null);
        if(typeof _mode!=='undefined'){
          if(_mode==='shrine' && idx>=0 && typeof _selectShrineMarker==='function') _selectShrineMarker(idx);
          else if(_mode==='parish' && item && typeof _selectParishMarker==='function') _selectParishMarker(item);
          else if(_mode==='retreat' && item && typeof _selectRetreatMarker==='function') _selectRetreatMarker(item);
        }
        if(item && typeof _showInfoCard==='function') _showInfoCard(item, idx);
        if(item && typeof _focusMarkerAboveInfoCard==='function') _focusMarkerAboveInfoCard(item);
      }catch(e){ console.warn("[가톨릭길동무]", e); }
    },90);
  }

  function wrapRouteReset(){
    if(typeof resetRoute!=='function' || resetRoute.__oaiFinalWrapped) return;
    var old = resetRoute;
    resetRoute = function(){
      var dest=null;
      try{
        if(typeof _rE!=='undefined' && _rE && _rE.lat) dest={lat:_rE.lat,lng:_rE.lng,idx:_rE.idx,name:_rE.name};
        else if(typeof _curInfoItem!=='undefined' && _curInfoItem && _curInfoItem.item) dest={lat:_curInfoItem.item.lat,lng:_curInfoItem.item.lng,idx:_curInfoItem.idx,item:_curInfoItem.item,name:_curInfoItem.item.name};
      }catch(e){ console.warn("[가톨릭길동무]", e); }
      var isReselect=false;
      try{ isReselect=!!(arguments[0] && arguments[0].fromButton); }catch(e){ console.warn("[가톨릭길동무]", e); }
      var r = old.apply(this, arguments);
      if(!isReselect) restoreYellowMarkerFromRoute(dest);
      return r;
    };
    resetRoute.__oaiFinalWrapped = true;
    try{ window.resetRoute = resetRoute; }catch(e){ console.warn("[가톨릭길동무]", e); }
  }

  /* 경로 시트 뒤로 닫힘도 경로삭제와 동일하게 노란 마커 복귀 */
  function watchRouteSheet(){
    var rs=$('sheet-route');
    if(!rs || rs.__oaiFinalRouteWatch) return;
    rs.__oaiFinalRouteWatch=true;
    var wasOpen=rs.classList.contains('open');
    new MutationObserver(function(){
      var open=rs.classList.contains('open');
      if(wasOpen && !open){
        var dest=null;
        try{
          if(typeof _rE!=='undefined' && _rE && _rE.lat) dest={lat:_rE.lat,lng:_rE.lng,idx:_rE.idx,name:_rE.name};
          else if(typeof _curInfoItem!=='undefined' && _curInfoItem && _curInfoItem.item) dest={lat:_curInfoItem.item.lat,lng:_curInfoItem.item.lng,idx:_curInfoItem.idx,item:_curInfoItem.item,name:_curInfoItem.item.name};
        }catch(e){ console.warn("[가톨릭길동무]", e); }
        restoreYellowMarkerFromRoute(dest);
      }
      wasOpen=open;
    }).observe(rs,{attributes:true,attributeFilter:['class']});
  }

  function init(){
    bindHorizontalGuard($('prayer-view'));
    bindHorizontalGuard($('prayer-list-view'));
    bindHorizontalGuard($('web-view'));
    bindHorizontalGuard($('web-list'));
    bindWebSwipe();
    wrapRouteReset();
    watchRouteSheet();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.addEventListener('load', init);
  window.addEventListener('pageshow', init);
})();
(function(){
  'use strict';
  if(window.__APP_PRECISE_GUARD__) return;
  window.__APP_PRECISE_GUARD__ = true;
  function byId(id){ return document.getElementById(id); }
  function openNewTab(url){ if(!url) return; try{ var w=window.open(url,'_blank','noopener'); if(w) return; }catch(e){ console.warn("[가톨릭길동무]", e); } try{ var a=document.createElement('a'); a.href=url; a.target='_blank'; a.rel='noopener'; document.body.appendChild(a); a.click(); setTimeout(function(){try{a.remove();}catch(e){ console.warn("[가톨릭길동무]", e); }},300); }catch(e){ alert('새창 열기가 차단되었습니다. 브라우저의 팝업 허용을 확인해 주세요.'); } }
  /* openDioceseExternal 중복 덮어쓰기 제거: 위쪽의 상태보존/복귀안정화 버전을 그대로 사용 */
  function rememberRouteDest(){ try{ if(_rE&&_rE.lat) return {lat:_rE.lat,lng:_rE.lng,idx:_rE.idx,name:_rE.name}; if(_curInfoItem&&_curInfoItem.item) return {lat:_curInfoItem.item.lat,lng:_curInfoItem.item.lng,idx:_curInfoItem.idx,item:_curInfoItem.item,name:_curInfoItem.item.name}; }catch(e){ console.warn("[가톨릭길동무]", e); } return null; }
  function restoreDest(dest){ if(!dest||!dest.lat) return; setTimeout(function(){ try{ var items=(typeof _getCurrentItems==='function')?_getCurrentItems():[]; var idx=(typeof dest.idx==='number'&&dest.idx>=0)?dest.idx:items.findIndex(function(p){return Number(p.lat)===Number(dest.lat)&&Number(p.lng)===Number(dest.lng);}); var item=idx>=0?items[idx]:dest.item; if(item&&typeof _showInfoCard==='function') _showInfoCard(item,idx); if(item&&typeof _focusMarkerAboveInfoCard==='function') _focusMarkerAboveInfoCard(item); }catch(e){ console.warn("[가톨릭길동무]", e); } },80); }
  window.oaiResetRouteThenClose=function(){ var dest=rememberRouteDest(); try{ if(typeof window.resetRoute==='function') window.resetRoute(); }catch(e){ console.warn("[가톨릭길동무]", e); } try{_routeMode=false;}catch(e){ console.warn("[가톨릭길동무]", e); } var rs=byId('sheet-route'); if(rs) rs.classList.remove('open'); restoreDest(dest); };
  function guardHorizontal(el){ if(!el||el.__oaiPreciseGuard) return; el.__oaiPreciseGuard=true; var sx=0,sy=0,h=false; el.addEventListener('touchstart',function(e){if(!e.touches||!e.touches[0])return; sx=e.touches[0].clientX; sy=e.touches[0].clientY; h=false;},{passive:true}); el.addEventListener('touchmove',function(e){if(!e.touches||!e.touches[0])return; var dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy; if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.15) h=true; if(h&&e.cancelable)e.preventDefault();},{passive:false}); }
  function init(){ ['prayer-view','prayer-list-view','prayer-detail','web-view','web-list'].forEach(function(id){guardHorizontal(byId(id));}); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init); else init(); window.addEventListener('load',init); window.addEventListener('pageshow',init);
})();
(function(){
  'use strict';
  window.oaiSwipeAction = function(el, dir){
    /* overlay div 방식: position:fixed로 화면 정중앙 고정, 항상 선명하게 */
    var ov=document.getElementById('oai-swipe-overlay');
    if(!ov){
      ov=document.createElement('div');
      ov.id='oai-swipe-overlay';
      document.body.appendChild(ov);
    }
    ov.textContent = dir==='left' ? '›' : '‹';
    ov.style.left  = dir==='left' ? 'auto' : '20px';
    ov.style.right = dir==='left' ? '20px' : 'auto';
    ov.classList.remove('active');
    void ov.offsetWidth; /* reflow for animation restart */
    ov.classList.add('active');
    clearTimeout(ov._t);
    ov._t=setTimeout(function(){ try{ov.classList.remove('active');}catch(e){ console.warn("[가톨릭길동무]", e); } }, 420);
  };
})();
(function(){
  function removeMissaPopupState(){var mv=document.getElementById('missa-view');if(mv&&!document.documentElement.classList.contains('app-active')) mv.classList.remove('open');}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', removeMissaPopupState, {once:true});
  else removeMissaPopupState();
  window.addEventListener('pageshow', removeMissaPopupState);
})();
(function(){
  'use strict';
  if(window.__APP_PULL_REFRESH_CLEAN_V20_8__) return;
  window.__APP_PULL_REFRESH_CLEAN_V20_8__ = true;

  function $(id){ return document.getElementById(id); }
  function isTypingTarget(el){
    if(!el) return false;
    var tag=(el.tagName||'').toLowerCase();
    return tag==='input' || tag==='textarea' || el.isContentEditable;
  }
  function isCoverVisible(){
    var cover=$('cover');
    return !!(cover && !document.documentElement.classList.contains('app-active') && getComputedStyle(cover).display !== 'none');
  }
  function closeTransientViews(){
    try{
      document.querySelectorAll('.module-view.open,#prayer-view.open,#diocese-view.open,#missa-view.open,.sheet.open,.trail-sheet.open,#srch-modal.open,#info-card.open,#exit-dlg.open').forEach(function(v){
        v.classList.remove('open','show');
      });
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }
  function isGuideModalOpen(){
    try{ return !!document.querySelector('.guide-modal.show'); }catch(e){ return false; }
  }
  function closeGuideModals(){
    try{
      var mq = $('mass-quick-modal');
      if(mq && mq.classList.contains('show') && typeof window.closeMassQuickMenu === 'function'){
        window.closeMassQuickMenu();
      } else {
        document.querySelectorAll('.guide-modal.show').forEach(function(el){
          el.classList.remove('show');
          el.setAttribute('aria-hidden','true');
        });
      }
      if(typeof window.resetGuideManualScroll === 'function') window.resetGuideManualScroll();
      if(typeof window._resetCoverExitReady === 'function') window._resetCoverExitReady();
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }

  function hideIndicator(ind){
    if(!ind) return;
    ind.classList.remove('show','ready','refreshing');
    ind.style.removeProperty('transform');
  }
  function setIndicator(ind, state, dy){
    if(!ind) return;
    var y=Math.min(Math.max(dy||0,0),112);
    ind.style.setProperty('transform','translate(-50%,' + Math.round(y * 0.36) + 'px) scale(1)','important');
    ind.classList.add('show');
    ind.classList.toggle('ready', state === 'ready');
    ind.classList.toggle('refreshing', state === 'refreshing');
  }

  window.__oaiSoftCoverRefresh = function(){
    var cover=$('cover'), ind=$('cv-pull-modern');
    try{ if(typeof window._clearMassQuickReturnForReload === 'function') window._clearMassQuickReturnForReload(); }catch(e){ console.warn('[가톨릭길동무]', e); }
    try{
      document.documentElement.classList.remove('app-active','parish-mode','retreat-mode','oai-returning');
      closeTransientViews();
      closeGuideModals();
      if(cover){
        cover.style.display='';
        cover.style.opacity='';
        cover.style.pointerEvents='';
        cover.classList.remove('pulling','refreshing');
        cover.scrollTop=0;
      }
      // 커버는 fixed 레이어이므로 window scroll을 강제로 움직이지 않는다.
      // 짧은 새로고침 때 화면이 위/아래로 튀는 원인이 될 수 있다.
      hideIndicator(ind);
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  };

  function installPullRefresh(){
    var cover=$('cover'), ind=$('cv-pull-modern');
    if(!cover || !ind || cover.__oaiPullRefreshCleanV20_8) return;
    cover.__oaiPullRefreshCleanV20_8 = true;

    var sx=0, sy=0, active=false, ready=false, refreshing=false;
    var THRESHOLD=74;
    var MAX=112;

    cover.addEventListener('touchstart', function(e){
      if(refreshing || isGuideModalOpen() || !isCoverVisible() || isTypingTarget(document.activeElement) || cover.scrollTop > 0 || !e.touches || !e.touches[0]) return;
      sx=e.touches[0].clientX;
      sy=e.touches[0].clientY;
      active=true;
      ready=false;
      hideIndicator(ind);
    }, {passive:true, capture:true});

    cover.addEventListener('touchmove', function(e){
      if(!active || refreshing || isGuideModalOpen() || !e.touches || !e.touches[0]){ active=false; ready=false; hideIndicator(ind); return; }
      var dx=e.touches[0].clientX - sx;
      var dy=e.touches[0].clientY - sy;
      if(Math.abs(dx) > Math.abs(dy) * 1.15){ active=false; hideIndicator(ind); return; }
      if(dy <= 3){ ready=false; hideIndicator(ind); return; }
      if(e.cancelable) e.preventDefault();
      ready = dy >= THRESHOLD;
      setIndicator(ind, ready ? 'ready' : 'pulling', Math.min(dy, MAX));
    }, {passive:false, capture:true});

    function finish(){
      if(!active) return;
      active=false;
      if(!ready){ ready=false; hideIndicator(ind); return; }
      ready=false;
      refreshing=true;
      setIndicator(ind, 'refreshing', MAX);
      try{ navigator.vibrate && navigator.vibrate(10); }catch(e){ console.warn('[가톨릭길동무]', e); }
      setTimeout(function(){
        try{ window.__oaiSoftCoverRefresh(); }catch(e){ console.warn('[가톨릭길동무]', e); }
        refreshing=false;
        hideIndicator(ind);
      }, 420);
    }
    cover.addEventListener('touchend', finish, {passive:true, capture:true});
    cover.addEventListener('touchcancel', function(){ active=false; ready=false; refreshing=false; hideIndicator(ind); }, {passive:true, capture:true});
  }

  window.addEventListener('pageshow', function(){
    try{
      var ind=$('cv-pull-modern');
      hideIndicator(ind);
      // 외부 사이트에서 돌아올 때 강제 window.scrollTo(0,0)를 실행하면
      // 화면이 아래로 내려갔다가 돌아오는 흔들림이 생긴다.
      // pull-to-refresh 표시만 정리하고 스크롤 위치는 브라우저 복원에 맡긴다.
    }catch(e){ console.warn('[가톨릭길동무]', e); }
  }, true);

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPullRefresh, {once:true});
  else installPullRefresh();
})();

(function(){
  'use strict';
  if(window.__APP_TABS_BACK_GUARD__) return;
  window.__APP_TABS_BACK_GUARD__=true;
  function $(id){return document.getElementById(id);}
  function fixRetreatTabLabel(){
    var lbl=$('tab-list-lbl');
    if(lbl && document.documentElement.classList.contains('retreat-mode')) lbl.textContent='피정의집 찾기';
    document.querySelectorAll('#tabbar .tab-btn').forEach(function(btn){
      btn.style.whiteSpace='nowrap';
      btn.style.minWidth='0';
      btn.style.maxWidth='none';
    });
  }
  var lastCover=false;
  function isCover(){var c=$('cover');return !!(c && !document.documentElement.classList.contains('app-active') && getComputedStyle(c).display!=='none');}
  function clearNativeExitToast(){
    try{window._exitReady=false; clearTimeout(window._exitTimer);}catch(e){ console.warn("[가톨릭길동무]", e); }
    try{var t=$('_bt'); if(t) t.remove(); var t2=$('oai-cover-exit-toast'); if(t2) t2.classList.remove('show');}catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  if(typeof window._resetCoverExitReady !== 'function') window._resetCoverExitReady = clearNativeExitToast;
  function resetNativeExitToastOnCoverEntry(){
    var now=isCover();
    if(now && !lastCover){
      clearNativeExitToast();
      try{ if(typeof window._clearCoverExitArmed === 'function') window._clearCoverExitArmed(); }catch(e){ console.warn("[가톨릭길동무]", e); }
    }
    lastCover=now;
  }
  function resetNativeExitToastIfCover(){
    if(isCover()) clearNativeExitToast();
  }
  var oldGTC=window.goToCover;
  if(typeof oldGTC==='function'){
    window.goToCover=function(){
      var r=oldGTC.apply(this,arguments);
      // goToCover가 호출되었다면 lastCover 상태와 무관하게 종료 대기값을 지운다.
      // 팝업/기도문 흐름은 이미 커버 위에서 움직여 lastCover가 true인 경우가 있으므로
      // '커버가 아니었다가 커버가 됨' 조건에만 의존하면 첫 뒤로가기에서 바로 종료될 수 있다.
      clearNativeExitToast();
      try{ if(typeof window._clearCoverExitArmed === 'function') window._clearCoverExitArmed(); }catch(e){ console.warn("[가톨릭길동무]", e); }
      setTimeout(function(){fixRetreatTabLabel();resetNativeExitToastIfCover();},0);
      return r;
    };
  }
  var oldStart=window.startApp;
  if(typeof oldStart==='function'){
    window.startApp=function(){
      var r=oldStart.apply(this,arguments);
      setTimeout(fixRetreatTabLabel,0);
      setTimeout(fixRetreatTabLabel,80);
      return r;
    };
  }
  function boot(){fixRetreatTabLabel();resetNativeExitToastOnCoverEntry();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.addEventListener('load',function(){boot();setTimeout(boot,200);},{once:true});
  // pageshow에서 종료 대기값을 지우지 않는다. 커버 진입/복귀 시에는 goToCover와 class 변화 감지에서만 초기화한다.
  try{new MutationObserver(function(){fixRetreatTabLabel();resetNativeExitToastOnCoverEntry();}).observe(document.documentElement,{attributes:true,attributeFilter:['class']});}catch(e){ console.warn("[가톨릭길동무]", e); }
})();

(function(){
  if(window.__appTouchUxKeyboard20260506) return;
  window.__appTouchUxKeyboard20260506 = true;

  var ACTION_DELAY_MS = 55;
  var FEEDBACK_MS = 190;
  var PRESS_DELAY_MS = 85;
  var MOVE_CANCEL_PX = 7;

  /* 스크롤/당겨서 새로고침 중 눌림 방지 적용 대상: 목록형 요소만 */
  var delayedSelectors = [
    '#cover .cover-card','#cover .cv-hotspot','#cover .cv-btn',
    '#prayer-list-view .pr-item','#prayer-list-view .prayer-item','#prayer-list-view .prayer-card','#prayer-list-view .prayer-list-item','#prayer-list-view .pr-list-item',
    '#trail-list .trail-card',
    '#region-body .list-item','#region-body .nearby-item','#region-body .region-item',
    '#nearby-list .nearby-item','#list-body .list-item',
    '.sheet .list-item','.sheet .nearby-item','.sheet .region-item',
    '.sm-item','.sm-place-item',
    '#web-list .web-card'
  ].join(',');

  var directSelectors = [
    'a','input','textarea','select','label',
    '#mass-quick-modal .mass-quick-btn',
    '.ic-link-btn','.ic-hp-btn','.ic-guide-btn',
    '.btn-kakao-route','.btn-kakao-nav','.c-btn',
    '.trail-foot','.web-card-foot','.trail-sh-foot','.trail-sh-body',
    '#close-btn','.module-close','.sheet-x','.sm-x','.ic-close-btn','.c-x',
    '#qna-cover-btn','#pwa-install-btn','.missa-open-link',
    '.btn-primary','.btn-secondary','#write-btn','#sb','#admin-pin-check',
    '.filter-btn','.cat-opt','.tab','.tab-btn','.trail-tab','.web-cat-btn',
    '#prayer-search-input','#prayer-search-bar button'
  ].join(',');

  var activeTouch = null;

  function closest(el, sel){
    try{return el && el.closest ? el.closest(sel) : null;}catch(e){return null;}
  }
  function clearPress(el){
    if(!el) return;
    try{el.classList.remove('app-pressing');}catch(e){ console.warn("[가톨릭길동무]", e); }
    el.__appPressing = false;
  }
  function press(el){
    if(!el || el.__appPressing) return;
    el.__appPressing = true;
    el.classList.add('app-touchable','app-pressing');
    setTimeout(function(){ clearPress(el); }, FEEDBACK_MS);
  }

  var instantPressSelectors = '#mass-quick-modal .mass-quick-btn';
  document.addEventListener('pointerdown', function(e){
    var el = closest(e.target, instantPressSelectors);
    if(!el) return;
    press(el);
  }, true);

  function cancelActive(){
    if(!activeTouch) return;
    activeTouch.canceled = true;
    if(activeTouch.timer){ clearTimeout(activeTouch.timer); activeTouch.timer = null; }
    clearPress(activeTouch.el);
    try{ activeTouch.el.__appTouchCanceledUntil = Date.now() + 350; }catch(e){ console.warn("[가톨릭길동무]", e); }
  }

  document.addEventListener('pointerdown', function(e){
    if(closest(e.target, directSelectors)) return;
    var el = closest(e.target, delayedSelectors);
    if(!el) return;
    activeTouch = { el:el, id:e.pointerId, x:e.clientX, y:e.clientY, canceled:false, timer:null };
    activeTouch.timer = setTimeout(function(){
      if(activeTouch && activeTouch.el === el && !activeTouch.canceled) press(el);
    }, PRESS_DELAY_MS);
  }, true);

  document.addEventListener('pointermove', function(e){
    if(!activeTouch || activeTouch.id !== e.pointerId) return;
    var dx = Math.abs(e.clientX - activeTouch.x);
    var dy = Math.abs(e.clientY - activeTouch.y);
    if(dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) cancelActive();
  }, true);

  document.addEventListener('pointercancel', cancelActive, true);
  document.addEventListener('pointerup', function(e){
    if(!activeTouch || activeTouch.id !== e.pointerId) return;
    if(activeTouch.timer){ clearTimeout(activeTouch.timer); activeTouch.timer = null; }
    if(activeTouch.canceled) clearPress(activeTouch.el);
    activeTouch = null;
  }, true);

  document.addEventListener('click', function(e){
    if(e.__oaiTouchReplay) return;
    if(closest(e.target, directSelectors)) return;
    var el = closest(e.target, delayedSelectors);
    if(!el) return;
    if(el.__appTouchCanceledUntil && Date.now() < el.__appTouchCanceledUntil){
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    if(el.__appClickDelay) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    press(el);
    el.__appClickDelay = true;
    setTimeout(function(){
      try{
        var ev = new MouseEvent('click', {bubbles:true,cancelable:true,view:window});
        ev.__oaiTouchReplay = true;
        el.dispatchEvent(ev);
      }catch(err){
        try{ el.click(); }catch(_e){ console.warn("[가톨릭길동무]", _e); }
      }
      setTimeout(function(){ el.__appClickDelay = false; }, 0);
    }, ACTION_DELAY_MS);
  }, true);

  function disableKeyboardSuggestions(root){
    root = root || document;
    var nodes = root.querySelectorAll ? root.querySelectorAll('input[type="text"], input[type="search"], input:not([type]), textarea') : [];
    nodes.forEach(function(el){
      if(el.type === 'password' || el.type === 'number' || el.type === 'tel' || el.type === 'email') return;
      el.setAttribute('autocomplete','off');
      el.setAttribute('autocorrect','off');
      el.setAttribute('autocapitalize','off');
      el.setAttribute('spellcheck','false');
      el.setAttribute('enterkeyhint','done');
    });
  }
  disableKeyboardSuggestions(document);
  document.addEventListener('DOMContentLoaded', function(){ disableKeyboardSuggestions(document); });
  try{
    var mo = new MutationObserver(function(muts){
      for(var i=0;i<muts.length;i++){
        for(var j=0;j<muts[i].addedNodes.length;j++){
          var n=muts[i].addedNodes[j];
          if(n && n.nodeType===1) disableKeyboardSuggestions(n);
        }
      }
    });
    mo.observe(document.documentElement,{childList:true,subtree:true});
  }catch(e){ console.warn("[가톨릭길동무]", e); }
})();
