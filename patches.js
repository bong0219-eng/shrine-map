/* patches.js — 뒤로가기·스와이프·터치 UX 패치
   history 기반 뒤로가기 컨트롤러, 스와이프 액션,
   터치 피드백 & 키보드 입력 보정
   원본 index.html Block D+E+G 에서 분리 */

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
      var mq = $b('mass-quick-modal');
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
    /* 기도문: 본문이면 목록으로, 목록이면 커버로 */
    var prayer = $b('prayer-view');
    if(prayer && prayer.classList.contains('open')){
      var prayerDetail = $b('prayer-detail');
      if(prayerDetail && prayerDetail.classList.contains('show')){
        window.__APP_PRAYER_DETAIL_TS__ = Date.now();
        prayerDetail.classList.remove('show');
        return true;
      }
      if(typeof window._closePrayerAndReturn === 'function') window._closePrayerAndReturn();
      else {
        if(typeof window.closePrayerView === 'function') window.closePrayerView();
        else prayer.classList.remove('open');
        callGTC();
      }
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

  window.addEventListener('popstate', function(){
    if(window._appExiting) return;

    /* 빠른메뉴/안내 팝업이 열려 있으면 어떤 복원 상태보다 먼저 닫는다.
       _restoring이 남은 상태에서 이 검사를 건너뛰면 Android PWA가 팝업을 닫지 못하고
       바로 앱 종료 흐름으로 빠질 수 있다. */
    if(isGuideModalOpen()){
      _restoring = false;
      closeGuideModals();
      try{ history.replaceState({_p:1}, '', _href); }catch(e){ console.warn("[가톨릭길동무]", e); }
      return;
    }

    if(_restoring){ _restoring = false; return; }

    // 일부 모바일/PWA 복귀 타이밍에서 app-active 클래스가 먼저 풀려도
    // 기도문 화면이 열려 있으면 커버 종료 로직보다 기도문 닫기를 우선한다.
    var prayerOpen = $b('prayer-view');
    if(prayerOpen && prayerOpen.classList.contains('open')){
      _restoring = true;
      history.go(1);
      if(typeof window._closePrayerAndReturn === 'function') window._closePrayerAndReturn();
      else { prayerOpen.classList.remove('open'); callGTC(); }
      return;
    }

    /* 커버: 토스트 → 두 번째에 종료. go(1) 재복원 없이 바로 트랩만 다시 심어 2번으로 끝낸다. */
    if(!appActive()){
      var exiting = false;
      if(typeof window._showBackToast==='function') exiting = window._showBackToast() === true;
      if(!exiting){ try{ history.pushState({_p:1}, '', _href); }catch(e){ console.warn("[가톨릭길동무]", e); } }
      return;
    }

    /* 앱 활성: go(1) 복원 후 처리 */
    _restoring = true;
    history.go(1);

    if(closeExtOrModule()) return;  /* 닫으면서 goToCover() 이미 호출됨 */
    if(closeLayer()) return;        /* 레이어만 닫기, 앱 유지 */
    callGTC();                      /* 아무것도 없으면 커버로 */
  }, false);

  /* Cordova 물리 백버튼 */
  document.addEventListener('backbutton', function(){
    if(isGuideModalOpen()){ closeGuideModals(); return; }
    var prayerOpen = $b('prayer-view');
    if(prayerOpen && prayerOpen.classList.contains('open')){
      if(typeof window._closePrayerAndReturn === 'function') window._closePrayerAndReturn();
      else { prayerOpen.classList.remove('open'); callGTC(); }
      return;
    }
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
    var lv=el('prayer-list-view');
    if(lv){
      try{ lv.style.scrollBehavior='auto'; lv.scrollTop=0; lv.style.scrollBehavior=''; }catch(_){ console.warn("[가톨릭길동무] silent catch"); }
    }
  }
  try{ window.showPrayerListOnly = showPrayerListOnly; }catch(_){ console.warn("[가톨릭길동무] silent catch"); }
})();



(function(){
  'use strict';
  if(window.__APP_FONT_REGION_GUARD__) return;
  window.__APP_FONT_REGION_GUARD__=true;
  var KEY='prayer_font_size', BASE=16;
  function currentPx(){
    var px=parseInt((localStorage&&localStorage.getItem(KEY))||BASE,10);
    if(!px||px<15||px>28) px=BASE;
    return px;
  }
  function applyStableScale(){
    var scale=currentPx()/BASE;
    document.documentElement.classList.add('oai-font-global');
    document.documentElement.style.setProperty('--app-font-scale', String(scale));
    var pv=document.getElementById('prayer-view');
    if(pv){
      pv.style.setProperty('--pr-item-fs', currentPx()+'px');
      pv.style.setProperty('--pr-body-fs', currentPx()+'px');
      pv.style.setProperty('--pr-detail-fs', (currentPx()+1)+'px');
    }
    try{
      var df=document.getElementById('diocese-frame');
      if(df && df.contentWindow && typeof df.contentWindow.dioApplySharedFont==='function'){
        df.contentWindow.dioApplySharedFont();
      }
    }catch(e){ console.warn("[가톨릭길동무]", e); }
    try{ if(typeof window.__APP_applyGlobalFont==='function') window.__APP_applyGlobalFont(); }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
  window.addEventListener('DOMContentLoaded', applyStableScale, {once:true});
  window.addEventListener('load', applyStableScale, {once:true});
  var old=window.prAdjustFont;
  if(typeof old==='function'){
    window.prAdjustFont=function(delta){
      old.call(this,delta);
      setTimeout(applyStableScale,0);
      setTimeout(applyStableScale,80);
    };
  }
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
  setInterval(function(){
    var pv = document.getElementById('prayer-view');
    if(pv && pv.classList.contains('open')) syncPrayerTabOn();
  }, 500);
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
  var QA_URL="qa-firebase.html?v=V38-1";
  var FONT_KEY='prayer_font_size', BASE=16, SIZES=[15,16,17,18,19,20,21,22,24,26,28];
  function el(id){return document.getElementById(id)}
  function getPx(){var px=parseInt(localStorage.getItem(FONT_KEY)||BASE,10);return (px>=15&&px<=28)?px:BASE;}
  function setPx(px){px=parseInt(px,10)||BASE;var best=SIZES[0],diff=999;SIZES.forEach(function(v){var d=Math.abs(v-px);if(d<diff){diff=d;best=v;}});try{localStorage.setItem(FONT_KEY,String(best));}catch(_){ console.warn("[가톨릭길동무] silent catch"); }return best;}
  function applyScale(){var scale=getPx()/BASE;document.documentElement.classList.add('oai-font-global');document.documentElement.style.setProperty('--app-font-scale',String(scale));var pv=el('prayer-view');if(pv){pv.style.setProperty('--pr-item-fs',getPx()+'px');pv.style.setProperty('--pr-body-fs',getPx()+'px');pv.style.setProperty('--pr-detail-fs',(getPx()+1)+'px')}}
  window.__APP_applyGlobalFont=applyScale;
  window.prAdjustFont=function(delta){var cur=getPx(),i=SIZES.indexOf(cur);if(i<0)i=SIZES.indexOf(BASE);i+=(delta>0?1:-1);if(i<0)i=0;if(i>=SIZES.length)i=SIZES.length-1;setPx(SIZES[i]);applyScale();setTimeout(applyScale,80);setTimeout(applyScale,220);};
  function ensureCoverControls(){var cover=el('cover');if(!cover)return;var box=el('cover-font-controls');if(!box){box=document.createElement('div');box.id='cover-font-controls';cover.appendChild(box);}box.className='pr-font-ctrl';box.innerHTML='<button class="pr-font-btn pr-sm" type="button" aria-label="글자 작게">가</button><div class="pr-font-divider"></div><button class="pr-font-btn pr-lg" type="button" aria-label="글자 크게">가</button>';var sm=box.querySelector('.pr-sm'),lg=box.querySelector('.pr-lg');if(sm)sm.onclick=function(e){e.preventDefault();e.stopPropagation();window.prAdjustFont(-1)};if(lg)lg.onclick=function(e){e.preventDefault();e.stopPropagation();window.prAdjustFont(1)};}
  function setEmojiIcons(){var icons={'cc-1':'✝️','cc-2':'⛪','cc-3':'🙏','cc-4':'🌿','cc-5':'🥾','cc-6':'🌐','cc-7':'🧭'};Object.keys(icons).forEach(function(id){var btn=el(id);if(!btn)return;var wrap=btn.querySelector('.cover-icon-wrap');if(wrap)wrap.innerHTML='<span class="cover-emoji" aria-hidden="true">'+icons[id]+'</span>';});}
  function normalizeLabels(root){root=root||document;try{root.querySelectorAll('button,a,span,div').forEach(function(n){if(!n||!n.childNodes||n.childNodes.length!==1||n.childNodes[0].nodeType!==3)return;var t=n.textContent,nt=t;nt=nt.replace(/카카오\s*맵/g,'카카오내비').replace(/카카오\s*나비/g,'카카오내비').replace(/Kakao\s*Map/gi,'카카오내비').replace(/Kakao\s*Navi/gi,'카카오내비');nt=nt.replace(/상장예식\s*\(\s*위령기도1\s*\)/g,'위령기도1(상장예식)').replace(/^위령기도1$/g,'위령기도1(상장예식)').replace(/Memorial Prayer 1\s*\(\s*Courting Ceremony\s*\)/gi,'위령기도1(상장예식)');nt=nt.replace(/위령\s*기도2\s*\(\s*짧은\s*위령기도\s*\)/g,'위령기도2 (짧은 위령기도)').replace(/^위령기도2$/g,'위령기도2 (짧은 위령기도)').replace(/Memorial Prayer 2\s*\(\s*short Memorial Prayer\s*\)/gi,'위령기도2 (짧은 위령기도)');if(nt!==t)n.textContent=nt;});}catch(e){ console.warn("[가톨릭길동무]", e); }}
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
  function ll(lat,lng){try{if(typeof _LL==='function')return new _LL(lat,lng);}catch(e){ console.warn("[가톨릭길동무]", e); }try{if(window.kakao&&kakao.maps)return new kakao.maps.LatLng(lat,lng);}catch(e){ console.warn("[가톨릭길동무]", e); }return null;}
  function getMap(){try{if(typeof _map!=='undefined'&&_map)return _map;}catch(e){ console.warn("[가톨릭길동무]", e); }return window._map||null;}
  function getLatLng(item){if(!item)return null;var lat=item.lat,lng=item.lng;if((lat==null||lng==null)&&item.coords){lat=item.coords.latitude||item.coords.lat;lng=item.coords.longitude||item.coords.lng;}lat=Number(lat);lng=Number(lng);return(isFinite(lat)&&isFinite(lng))?{lat:lat,lng:lng}:null;}
  function pan(map,pos){try{if(map&&typeof map.panTo==='function')map.panTo(pos);else if(map)map.setCenter(pos);}catch(e){try{map.setCenter(pos)}catch(_){ console.warn("[가톨릭길동무] silent catch"); }}}
  function ensureMilitaryParish(){try{if(typeof _RAW!=='undefined'&&Array.isArray(_RAW)&&!_RAW.some(function(r){return r&&r[1]==='ML';})){_RAW.push(['천주교 국군중앙주교좌성당','ML','서울 용산구 한강대로40길 46','02-798-2457','','https://www.gunjong.or.kr/',37.5295394,126.9717368]);}}catch(e){ console.warn("[가톨릭길동무]", e); }}
  function ensureQnaButton(){
    var cover=el('cover'); if(!cover) return;
    var btn=el('qna-cover-btn');
    if(!btn){
      btn=document.createElement('button');
      btn.id='qna-cover-btn';
      btn.type='button';
      btn.setAttribute('aria-label','문의·건의');
      btn.textContent='💬 문의·건의';
      cover.appendChild(btn);
    }
    btn.onclick=function(ev){ if(ev) ev.preventDefault(); window.openQnaView(); };
  }
  window.openQnaView=function(){ location.href=QA_URL; };
  window.goQaFirebase=function(){ location.href=QA_URL; };
  function boot(){ensureMilitaryParish();ensureCoverControls();setEmojiIcons();normalizeLabels(document);configureQna();ensureQnaButton();applyScale();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();window.addEventListener('load',function(){boot();setTimeout(boot,250);setTimeout(boot,900);},{once:true});window.addEventListener('pageshow',boot);document.addEventListener('click',function(){setTimeout(function(){normalizeLabels(document);configureQna();ensureQnaButton();},80);},true);
})();

// user-cache mode: keep app cache stable; refresh changed files through versioned URLs.

// ── PWA 설치 버튼 로직 ──
(function(){
  // 이미 설치된 앱(standalone)이면 버튼 절대 표시 안 함
  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if(isStandalone) return;

  var btn = null;
  var prompt = null;

  function getBtn(){ return btn || (btn = document.getElementById('pwa-install-btn')); }

  // 크롬이 설치 가능 판단 시 버튼 표시
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault();
    prompt = e;
    var b = getBtn();
    if(b) b.style.display = 'flex';
  });

  // 설치 완료 시 버튼 숨김
  window.addEventListener('appinstalled', function(){
    var b = getBtn();
    if(b) b.style.display = 'none';
    prompt = null;
  });

  // 버튼 클릭 → 설치 다이얼로그 실행
  window.triggerPwaInstall = function(){
    if(!prompt) return;
    prompt.prompt();
    prompt.userChoice.then(function(r){
      if(r.outcome === 'accepted'){
        var b = getBtn();
        if(b) b.style.display = 'none';
      }
      prompt = null;
    });
  };
})();

/* ====== 성능 최적화 JS 패치 ====== */
(function(){
  // 중복 setTimeout 래핑으로 인한 함수 실행 누적 방지
  // relayoutAll 류 함수의 과도한 setTimeout 체인 제한
  var _raf = requestAnimationFrame;
  
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

/* OAI removed duplicate route-sheet observer: 경로삭제가 아닌 닫기/복귀에서 노란마커로 강제 이동하지 않도록 제거. */
(function(){
  // 설치 버튼: standalone 감지 즉시 숨김 (CSS 외 JS 보강)
  function hideInstallIfStandalone(){
    var isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true ||
      document.documentElement.classList.contains('app-active');
    if(isStandalone){
      var btn = document.getElementById('pwa-install-btn');
      if(btn) btn.style.setProperty('display','none','important');
    }
  }
  hideInstallIfStandalone();
  // app-active 클래스 변화 감지
  var htmlEl = document.documentElement;
  var htmlObs = new MutationObserver(function(){ hideInstallIfStandalone(); });
  htmlObs.observe(htmlEl, {attributes:true, attributeFilter:['class']});
  // matchMedia 변화 감지
  try{
    window.matchMedia('(display-mode: standalone)').addEventListener('change', hideInstallIfStandalone);
  }catch(e){ console.warn("[가톨릭길동무]", e); }
  // load 후 한번 더
  window.addEventListener('load', hideInstallIfStandalone);
  window.addEventListener('pageshow', hideInstallIfStandalone);
})();

(function(){
  'use strict';
  window.oaiSwipeAction = function(el, dir){
    if(!el) return;
    el.classList.remove('oai-swipe-left','oai-swipe-right');
    requestAnimationFrame(function(){
      el.classList.add(dir === 'right' ? 'oai-swipe-right' : 'oai-swipe-left');
      setTimeout(function(){ try{ el.classList.remove('oai-swipe-left','oai-swipe-right'); }catch(e){ console.warn("[가톨릭길동무]", e); } }, 180);
    });
  };
  var DIO_KEY = 'oai_diocese_return_state_v3';
  window.openDioceseExternal = function(url, state){
    if(!url) return;
    var payload = state || {};
    try{ var frame = document.getElementById('diocese-frame'); if(frame && frame.contentWindow && typeof frame.contentWindow.getDioceseReturnState === 'function'){ payload = frame.contentWindow.getDioceseReturnState(payload.source || 'link') || payload; } }catch(e){ console.warn("[가톨릭길동무]", e); }
    try{ sessionStorage.setItem(DIO_KEY, JSON.stringify(payload)); }catch(e){ console.warn("[가톨릭길동무]", e); }
    // location.href 방식: PWA/모바일 팝업 차단 우회, 뒤로가기로 복귀 가능
    location.href = url;
  };
  function restoreDioceseIfNeeded(){
    var raw=null; try{ raw=sessionStorage.getItem(DIO_KEY); }catch(e){ console.warn("[가톨릭길동무]", e); }
    if(!raw) return;
    var state=null; try{ state=JSON.parse(raw); }catch(e){ console.warn("[가톨릭길동무]", e); }
    try{ sessionStorage.removeItem(DIO_KEY); }catch(e){ console.warn("[가톨릭길동무]", e); }
    if(!state) return;
    if(typeof window.openDioceseView === 'function') window.openDioceseView({restore:true});
    var tries=0, timer=setInterval(function(){
      tries++; var frame=document.getElementById('diocese-frame');
      try{ if(frame && frame.contentWindow && typeof frame.contentWindow.restoreDioceseReturnState === 'function'){ frame.contentWindow.restoreDioceseReturnState(state); clearInterval(timer); } }catch(e){ console.warn("[가톨릭길동무]", e); }
      if(tries>25) clearInterval(timer);
    },120);
  }
  window.addEventListener('pageshow', function(){ restoreDioceseIfNeeded(); setTimeout(restoreDioceseIfNeeded, 40); });
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
  window.oaiSwipeAction = function(el, dir){ flash(el, dir); };

  /* 가로로 밀 때 브라우저/웹뷰 자체 화면이 옆으로 밀리는 현상 차단 */
  function bindHorizontalGuard(el){
    if(!el || el.__oaiFinalHorizontalGuard) return;
    el.__oaiFinalHorizontalGuard = true;
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
  function pickActiveBody(){
    try{
      if(document.getElementById('prayer-view')?.classList.contains('open')) return document.getElementById('pr-list-ul') || document.getElementById('prayer-list-view');
      if(document.getElementById('web-view')?.classList.contains('open')) return document.getElementById('web-list');
      if(document.getElementById('trail-view')?.classList.contains('open')) return document.querySelector('#trail-panel-list.on #trail-list') || document.querySelector('#trail-view .trail-panel.on');
      var at = window._activeTab;
      if(at) return document.querySelector('#sheet-'+at+' .sheet-body') || document.getElementById('sheet-'+at);
    }catch(e){ console.warn("[가톨릭길동무]", e); }
    return null;
  }
  function flash(el, dir){
    el = el || pickActiveBody();
    if(!el) return;
    try{
      el.classList.remove('oai-swipe-left','oai-swipe-right');
      void el.offsetWidth;
      el.classList.add(dir === 'right' ? 'oai-swipe-right' : 'oai-swipe-left');
      setTimeout(function(){try{el.classList.remove('oai-swipe-left','oai-swipe-right');}catch(e){ console.warn("[가톨릭길동무]", e); }}, 460);
    }catch(e){ console.warn("[가톨릭길동무]", e); }
  }
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
      var mq = $b('mass-quick-modal');
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
    try{ sessionStorage.removeItem('oai_force_cover_after_reload'); }catch(e){ console.warn('[가톨릭길동무]', e); }
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
      window.scrollTo(0,0);
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
