/*
 * iSeeYou first-party collector
 *
 * Required script attributes:
 *   data-endpoint="https://collector.example.com/v1/collect"
 *   data-site-id="site_public_demo"
 *   data-site-key="site_key_public_demo"
 *
 * The site key is a public site credential, not a Brevo/API secret. This
 * collector never reads or sends Brevo credentials and never performs extra
 * fingerprinting (WebGL, Canvas, Audio, Fonts or hardware probing).
 */
(function iSeeYouCollectorFactory(window, document) {
  'use strict';

  var script = document.currentScript || document.querySelector('script[data-site-id][data-site-key]');
  if (!script) return;

  var endpoint = script.getAttribute('data-endpoint') || '/v1/collect';
  var siteId = script.getAttribute('data-site-id');
  var siteKey = script.getAttribute('data-site-key');
  var tunnelBypass = script.getAttribute('data-tunnel-bypass') === 'true';
  if (!siteId || !siteKey) return;

  var storagePrefix = 'iseeyou:' + siteId + ':';
  var sessionStorageKey = storagePrefix + 'session_key';
  var deviceStorageKey = storagePrefix + 'device_key';
  var sessionStartedKey = storagePrefix + 'session_started';
  var memory = {};
  var replayQueue = [];
  var replayTimer = null;
  var lastScrollAt = 0;
  var replayStarted = false;
  var pageStartedAt = Date.now();
  var preciseLocation = null;
  var locationRequested = false;

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (error) { return memory[key] || null; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); } catch (error) { memory[key] = value; }
  }

  function opaqueKey(prefix) {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') return prefix + '_' + window.crypto.randomUUID();
      if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
        var bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return prefix + '_' + Array.prototype.map.call(bytes, function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
      }
    } catch (error) {}
    return prefix + '_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function keyFor(storageKey, prefix) {
    var value = readStorage(storageKey);
    if (!value) { value = opaqueKey(prefix); writeStorage(storageKey, value); }
    return value;
  }

  function consentGranted() {
    return script.getAttribute('data-consent') === 'granted' || window.iSeeYouConsent === true || (window.iSeeYouConsent && window.iSeeYouConsent.analytics === true);
  }

  function replayGranted() {
    return consentGranted() && (script.getAttribute('data-replay') === 'granted' || (window.iSeeYouConsent && window.iSeeYouConsent.replay === true));
  }

  function privateElement(element) {
    if (!element || !element.closest) return true;
    return !!element.closest('input,textarea,select,[contenteditable="true"],[data-iseeyou-private],[data-sensitive],[type="password"]');
  }

  function safeTarget(element) {
    if (!element || privateElement(element)) return null;
    var target = element.closest('button,a,[role="button"],[data-iseeyou-action]') || element;
    if (privateElement(target)) return null;
    return {
      tag: String(target.tagName || '').toLowerCase().slice(0, 20) || 'unknown',
      id: String(target.id || '').slice(0, 80) || null,
      role: String(target.getAttribute && target.getAttribute('role') || '').slice(0, 40) || null,
      action: String(target.getAttribute && target.getAttribute('data-iseeyou-action') || '').slice(0, 80) || null
    };
  }

  function viewport() {
    return { width: Math.min(Number(window.innerWidth) || 0, 10000), height: Math.min(Number(window.innerHeight) || 0, 10000) };
  }

  function enqueueReplay(action, data) {
    if (!replayGranted()) return;
    var item = { action: action, at_ms: Date.now(), data: data || {} };
    replayQueue.push(item);
    if (replayQueue.length >= 8) flushReplay();
    else if (!replayTimer) replayTimer = window.setTimeout(flushReplay, 1200);
  }

  function flushReplay(unloading) {
    replayTimer = null;
    if (!replayQueue.length || !replayGranted()) { replayQueue = []; return; }
    var batch = replayQueue.splice(0, 8);
    batch.forEach(function (item) {
      var data = item.data || {};
      var event = {
        type: item.action,
        occurred_at: new Date(item.at_ms).toISOString(),
        page_path: String(data.page_path || window.location.pathname || '/').slice(0, 500)
      };
      if (item.action === 'click') {
        event.x = Number(data.x) || 0;
        event.y = Number(data.y) || 0;
        event.tag = data.tag || null;
        event.selector = data.selector || data.id || data.action || data.role || null;
        event.text = null;
        event.text_length = 0;
      } else if (item.action === 'scroll') {
        event.percent = Math.max(0, Math.min(100, Number(data.percent) || 0));
      } else if (item.action === 'navigation') {
        event.to_path = data.to_path || null;
      } else if (item.action === 'viewport') {
        event.width = Number(data.width) || 1;
        event.height = Number(data.height) || 1;
      } else if (item.action === 'timing') {
        event.name = data.name || null;
        event.duration_ms = Math.max(0, Math.min(3600000, Number(data.duration_ms) || 0));
      }
      sendReplayEvent(event, unloading);
    });
  }

  function startReplay() {
    if (replayStarted || !replayGranted()) return;
    replayStarted = true;
    enqueueReplay('page', { page_path: String(window.location.pathname || '/').slice(0, 500) });
    document.addEventListener('click', function (event) {
      var target = safeTarget(event.target);
      if (target) enqueueReplay('click', { x: event.clientX, y: event.clientY, tag: target.tag, id: target.id, role: target.role, action: target.action });
    }, { capture: true, passive: true });
    window.addEventListener('scroll', function () {
      var now = Date.now();
      if (now - lastScrollAt < 400) return;
      lastScrollAt = now;
      var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      enqueueReplay('scroll', { percent: Math.max(0, Math.min(100, (window.scrollY / max) * 100)) });
    }, { passive: true });
    window.addEventListener('resize', function () { enqueueReplay('viewport', viewport()); }, { passive: true });
    ['pushState', 'replaceState'].forEach(function (method) {
      var original = window.history[method];
      if (typeof original !== 'function') return;
      window.history[method] = function () {
        var result = original.apply(this, arguments);
        recordPageTransition(String(window.location.pathname || '/').slice(0, 500));
        return result;
      };
    });
    window.addEventListener('popstate', function () { recordPageTransition(String(window.location.pathname || '/').slice(0, 500)); });
    window.addEventListener('beforeunload', function () {
      enqueueReplay('timing', { name: 'page_duration', duration_ms: Math.max(0, Date.now() - pageStartedAt) });
      flushReplay(true);
    });
  }

  function recordPageTransition(path) {
    enqueueReplay('timing', { name: 'page_duration', duration_ms: Math.max(0, Date.now() - pageStartedAt) });
    enqueueReplay('page', { page_path: path });
    pageStartedAt = Date.now();
  }

  function browserFamily(userAgent) {
    if (/Edg\//i.test(userAgent)) return 'Edge';
    if (/OPR\//i.test(userAgent)) return 'Opera';
    if (/Chrome\//i.test(userAgent)) return 'Chrome';
    if (/Firefox\//i.test(userAgent)) return 'Firefox';
    if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)) return 'Safari';
    return 'Other';
  }

  function osFamily(userAgent) {
    if (/Windows/i.test(userAgent)) return 'Windows';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS';
    if (/Mac OS X|Macintosh/i.test(userAgent)) return 'macOS';
    if (/Linux/i.test(userAgent)) return 'Linux';
    return 'Other';
  }

  function deviceType() {
    var width = window.innerWidth || 0;
    if (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')) return width >= 768 ? 'tablet' : 'mobile';
    return width && width < 768 ? 'mobile' : 'desktop';
  }

  function referrerDomain() {
    try { return document.referrer ? new URL(document.referrer).hostname : null; } catch (error) { return null; }
  }

  function queryParams() {
    var result = {};
    try {
      new URLSearchParams(window.location.search).forEach(function (value, key) {
        if (/^utm_(source|medium|campaign|term|content)$/i.test(key)) result[key.toLowerCase()] = value.slice(0, 200);
      });
    } catch (error) {}
    return result;
  }

  function requestPreciseLocation(done) {
    if (locationRequested) { done(); return; }
    locationRequested = true;
    if (!navigator.geolocation || typeof navigator.geolocation.getCurrentPosition !== 'function') { done(); return; }
    try {
      navigator.geolocation.getCurrentPosition(function (position) {
        var coords = position && position.coords;
        if (coords && Number.isFinite(Number(coords.latitude)) && Number.isFinite(Number(coords.longitude))) {
          preciseLocation = {
            lat: Number(coords.latitude),
            lon: Number(coords.longitude),
            accuracy_m: Number.isFinite(Number(coords.accuracy)) ? Math.round(Number(coords.accuracy)) : null,
            precision: 'browser-authorized',
            source: 'browser-geolocation'
          };
        }
        done();
      }, function () { done(); }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
    } catch (error) { done(); }
  }

  function payload(type, extra) {
    var userAgent = navigator.userAgent || '';
    var params = queryParams();
    var result = {
      type: type,
      site_id: siteId,
      site_key: siteKey,
      session_key: keyFor(sessionStorageKey, 'sess'),
      device_key: keyFor(deviceStorageKey, 'dev'),
      occurred_at: new Date().toISOString(),
      page_path: String(window.location.pathname || '/').slice(0, 500),
      page_title: String(document.title || '').slice(0, 200),
      referrer_domain: referrerDomain(),
      utm_source: params.utm_source || null,
      utm_medium: params.utm_medium || null,
      utm_campaign: params.utm_campaign || null,
      language: String(navigator.language || '').slice(0, 40) || null,
      timezone: (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 80) || null,
      device_type: deviceType(),
      browser: browserFamily(userAgent),
      os: osFamily(userAgent),
      consent_status: 'granted',
      source: 'first_party'
    };
    if (preciseLocation) result.approx_location = preciseLocation;
    if (extra && extra.replay_event && typeof extra.replay_event === 'object') result.replay_event = extra.replay_event;
    return result;
  }

  function sendReplayEvent(event, unloading) {
    if (!consentGranted()) return;
    var body;
    try { body = JSON.stringify(payload('replay', { replay_event: event })); } catch (error) { return; }
    if (unloading && navigator.sendBeacon) {
      try {
        var accepted = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
        if (accepted) return;
      } catch (error) {}
    }
    send('replay', { replay_event: event });
  }

  function send(type, extra) {
    if (!consentGranted() || !window.fetch) return;
    var body;
    try { body = JSON.stringify(payload(type, extra)); } catch (error) { return; }
    try {
      window.fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        keepalive: true,
        headers: { 'content-type': 'application/json', 'x-site-key': siteKey, ...(tunnelBypass ? { 'bypass-tunnel-reminder': '1' } : {}) },
        body: body,
        credentials: 'omit'
      }).catch(function () {});
    } catch (error) {}
  }

  function start() {
    if (!consentGranted()) return;
    if (!readStorage(sessionStartedKey)) {
      writeStorage(sessionStartedKey, '1');
      send('session_started');
    }
    send('page_view');
    startReplay();
  }

  window.iSeeYouCollector = window.iSeeYouCollector || {};
  window.iSeeYouCollector.grantConsent = function () {
    window.iSeeYouConsent = true;
    requestPreciseLocation(start);
  };
  window.iSeeYouCollector.enableReplay = function () {
    if (!consentGranted()) return false;
    script.setAttribute('data-replay', 'granted');
    startReplay();
    return true;
  };
  window.iSeeYouCollector.revokeConsent = function () { window.iSeeYouConsent = false; };
  window.iSeeYouCollector.track = function (type) {
    if (typeof type === 'string' && /^[a-z][a-z0-9_]{0,48}$/.test(type)) send(type);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}(window, document));

