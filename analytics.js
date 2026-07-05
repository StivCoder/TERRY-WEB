/**
 * ============================================================
 *  TERRY TENDER WEAR — ANALYTICS TRACKING
 * ============================================================
 *  Handles:
 *   • Session tracking (creates unique session ID)
 *   • Page view tracking
 *   • Product view/click tracking
 *   • Time on page measurement
 *   • Sales tracking (from orders)
 * ============================================================
 *  LOAD AFTER: supabase-config.js, db.js
 * ============================================================
 */

(function() {
  'use strict';

  /* ── Config & Defaults ─────────────────────────────────── */
  var ANALYTICS = window.ANALYTICS = {};
  var _sessionId = null;
  var _pageStartTime = Date.now();
  var _lastPageUrl = null;

  /* ── Generate or retrieve session ID ──────────────────── */
  function initSession() {
    var key = 'ttw_session_id';
    _sessionId = localStorage.getItem(key);
    
    if (!_sessionId || !isSessionValid()) {
      _sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem(key, _sessionId);
      localStorage.setItem('ttw_session_start', Date.now());
      
      // New session - track it
      trackNewSession();
    }
  }

  function isSessionValid() {
    var sessionStart = localStorage.getItem('ttw_session_start');
    if (!sessionStart) return false;
    
    // Session expires after 30 minutes of inactivity
    var now = Date.now();
    var elapsed = now - parseInt(sessionStart, 10);
    return elapsed < (30 * 60 * 1000);
  }

  function getSessionId() {
    return _sessionId;
  }

  /* ── Track New Session ───────────────────────────────── */
  function trackNewSession() {
    if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
      // Local storage mode - store in localStorage
      var sessions = JSON.parse(localStorage.getItem('ttw_analytics_sessions') || '[]');
      sessions.push({
        session_id: _sessionId,
        first_visit: new Date().toISOString(),
        last_visit: new Date().toISOString(),
        page_count: 1,
        total_time_sec: 0,
        referrer: document.referrer || '',
        country: 'Unknown',
        device_type: getDeviceType()
      });
      localStorage.setItem('ttw_analytics_sessions', JSON.stringify(sessions));
      return;
    }

    // Supabase mode
    if (!window.supabase) return;
    
    var data = {
      session_id: _sessionId,
      first_visit: new Date().toISOString(),
      last_visit: new Date().toISOString(),
      page_count: 1,
      total_time_sec: 0,
      referrer: document.referrer || '',
      country: 'Unknown',
      device_type: getDeviceType()
    };

    supabase.from('analytics_sessions').insert([data]).catch(function(err) {
      console.error('Analytics: Failed to track session', err);
    });
  }

  /* ── Track Page View ────────────────────────────────── */
  ANALYTICS.trackPageView = function(pageUrl, pageTitle) {
    pageUrl = pageUrl || window.location.pathname;
    pageTitle = pageTitle || document.title;
    
    if (!_sessionId) initSession();

    if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
      // Local storage mode
      var views = JSON.parse(localStorage.getItem('ttw_analytics_page_views') || '[]');
      views.push({
        session_id: _sessionId,
        page_url: pageUrl,
        page_title: pageTitle,
        time_on_page_sec: 0,
        viewed_at: new Date().toISOString()
      });
      localStorage.setItem('ttw_analytics_page_views', JSON.stringify(views));
      
      updateSessionLastVisit();
      return;
    }

    // Supabase mode
    if (!window.supabase) return;
    
    var data = {
      session_id: _sessionId,
      page_url: pageUrl,
      page_title: pageTitle,
      time_on_page_sec: 0,
      viewed_at: new Date().toISOString()
    };

    supabase.from('analytics_page_views').insert([data]).catch(function(err) {
      console.error('Analytics: Failed to track page view', err);
    });

    updateSessionLastVisit();
    _pageStartTime = Date.now();
    _lastPageUrl = pageUrl;
  };

  /* ── Track Product View ───────────────────────────────── */
  ANALYTICS.trackProductView = function(productId, productName, interaction) {
    interaction = interaction || 'view';
    
    if (!_sessionId) initSession();

    if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
      // Local storage mode
      var views = JSON.parse(localStorage.getItem('ttw_analytics_product_views') || '[]');
      views.push({
        session_id: _sessionId,
        product_id: productId,
        product_name: productName || '',
        interaction: interaction,
        viewed_at: new Date().toISOString()
      });
      localStorage.setItem('ttw_analytics_product_views', JSON.stringify(views));
      return;
    }

    // Supabase mode
    if (!window.supabase) return;
    
    var data = {
      session_id: _sessionId,
      product_id: productId,
      product_name: productName || '',
      interaction: interaction,
      viewed_at: new Date().toISOString()
    };

    supabase.from('analytics_product_views').insert([data]).catch(function(err) {
      console.error('Analytics: Failed to track product view', err);
    });
  };

  /* ── Track Sale ────────────────────────────────────── */
  ANALYTICS.trackSale = function(orderId, totalAmount, itemCount) {
    if (!_sessionId) initSession();

    if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
      // Local storage mode
      var sales = JSON.parse(localStorage.getItem('ttw_analytics_sales') || '[]');
      sales.push({
        order_id: orderId,
        session_id: _sessionId,
        total_amount: totalAmount,
        item_count: itemCount,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('ttw_analytics_sales', JSON.stringify(sales));
      return;
    }

    // Supabase mode
    if (!window.supabase) return;
    
    var data = {
      order_id: orderId,
      session_id: _sessionId,
      total_amount: totalAmount,
      item_count: itemCount,
      created_at: new Date().toISOString()
    };

    supabase.from('analytics_sales').insert([data]).catch(function(err) {
      console.error('Analytics: Failed to track sale', err);
    });
  };

  /* ── Update Session Last Visit ────────────────────────── */
  function updateSessionLastVisit() {
    if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
      var sessions = JSON.parse(localStorage.getItem('ttw_analytics_sessions') || '[]');
      var session = sessions.find(function(s) { return s.session_id === _sessionId; });
      if (session) {
        session.last_visit = new Date().toISOString();
        session.page_count = (session.page_count || 0) + 1;
        localStorage.setItem('ttw_analytics_sessions', JSON.stringify(sessions));
      }
      return;
    }

    if (!window.supabase) return;

    supabase.from('analytics_sessions')
      .update({
        last_visit: new Date().toISOString(),
        page_count: supabase.raw('page_count + 1')
      })
      .eq('session_id', _sessionId)
      .catch(function(err) {
        console.error('Analytics: Failed to update session', err);
      });
  }

  /* ── Get Device Type ────────────────────────────────── */
  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/mobile|android|iphone|ipod|windows phone/i.test(ua)) return 'Mobile';
    if (/tablet|ipad|playbook|silk|(android(?!.*mobi))/i.test(ua)) return 'Tablet';
    return 'Desktop';
  }

  /* ── Auto-init on page load ───────────────────────────– */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      initSession();
      ANALYTICS.trackPageView();
    });
  } else {
    initSession();
    ANALYTICS.trackPageView();
  }

  /* ── Track time on page before unload ────────────────── */
  window.addEventListener('beforeunload', function() {
    if (_pageStartTime && _lastPageUrl) {
      var timeOnPage = Math.round((Date.now() - _pageStartTime) / 1000);
      
      if (!TERRY_CONFIG || !TERRY_CONFIG.configured) {
        var views = JSON.parse(localStorage.getItem('ttw_analytics_page_views') || '[]');
        if (views.length > 0) {
          views[views.length - 1].time_on_page_sec = timeOnPage;
          localStorage.setItem('ttw_analytics_page_views', JSON.stringify(views));
        }
        return;
      }

      if (!window.supabase) return;

      supabase.from('analytics_page_views')
        .update({ time_on_page_sec: timeOnPage })
        .eq('session_id', _sessionId)
        .eq('page_url', _lastPageUrl)
        .catch(function(err) {
          console.error('Analytics: Failed to update page time', err);
        });
    }
  });

  /* ── Public API ────────────────────────────────────── */
  ANALYTICS.getSessionId = getSessionId;
  ANALYTICS.trackNewSession = trackNewSession;

  console.log('%c📊 Analytics Initialized', 'color:#4E7DFF;font-weight:bold');
})();
