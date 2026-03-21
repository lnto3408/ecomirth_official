// App initialization

document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  renderDashboard();

  // 자동 수집 완료 시 현재 뷰 갱신
  if (window.api.onAutoCollectDone) {
    window.api.onAutoCollectDone(() => {
      const view = AppState.currentView;
      if (view === 'dashboard') renderDashboard();
      else if (view === 'collection') { renderCollection(); loadCollectionLogs(); }
      else if (view === 'content-analysis') renderContentAnalysis();
      else if (view === 'trends') renderTrends();
    });
  }

  // 트렌드 급상승 알림
  if (window.api.onTrendAlert) {
    window.api.onTrendAlert((keywords) => {
      if (keywords.length > 0) {
        showToast(`새 급상승 키워드: ${keywords.slice(0, 3).join(', ')}${keywords.length > 3 ? ` 외 ${keywords.length - 3}개` : ''}`);
      }
    });
  }
});
