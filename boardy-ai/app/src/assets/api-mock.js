/**
 * Boardy API Interceptor & Local Mock Service
 * Handles live requests for:
 *   - GET  /api/public-globe
 *   - POST /api/onboard/text
 * Provides safe stubs for analytics and hydration objects.
 */
(function() {
  // Safe stubs to prevent hydration or analytics errors
  if (!window.posthog) {
    window.posthog = {
      capture: function() {},
      identify: function() {},
      on: function() {},
      init: function() {},
      register: function() {},
      people: { set: function() {} }
    };
  }

  const origFetch = window.fetch;
  window.fetch = async function(resource, config) {
    const url = typeof resource === 'string' ? resource : resource instanceof URL ? resource.toString() : (resource && resource.url ? resource.url : '');

    // 1. Globe activity polling
    if (url.includes('/api/public-globe')) {
      try {
        const response = await origFetch('/assets/public-globe.json');
        if (response.ok) {
          const data = await response.json();
          data.generatedAt = new Date().toISOString();
          data.status = 'ready';
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      } catch (err) {
        console.warn('[Boardy API Mock] Public globe fallback', err);
      }
    }

    // 2. Onboarding text submission
    if (url.includes('/api/onboard/text')) {
      let body = {};
      try {
        if (config && config.body) {
          body = typeof config.body === 'string' ? JSON.parse(config.body) : config.body;
        }
      } catch (e) {}

      console.log('[Boardy API Mock] POST /api/onboard/text received:', body);

      // Brief latency simulation (200ms)
      await new Promise(res => setTimeout(res, 200));

      const mockResponse = {
        success: true,
        phoneNumber: "+14159699735",
        smsBody: "Hey Boardy, I'd love your help with some warm introductions. Can we jump on a quick call?",
        qrCodeDataUrl: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200' viewBox='0 0 200 200'><rect width='200' height='200' fill='white'/><path d='M20 20h40v40H20zM30 30h20v20H30zM140 20h40v40h-40zM150 30h20v20h-20zM20 140h40v40H20zM30 150h20v20H30zM80 30h10v10H80zM100 20h10v20h-10zM90 60h20v10H90zM30 80h20v10H30zM70 90h10v20H70zM90 80h20v20H90zM120 90h30v10h-30zM130 110h20v20h-20zM90 120h20v30H90zM120 140h10v20h-10zM140 150h20v10h-20z' fill='black'/></svg>",
        messageUrl: "sms:+14159699735?body=Hey%20Boardy%2C%20I'd%20love%20your%20help%20with%20some%20warm%20introductions.%20Can%20we%20jump%20on%20a%20quick%20call%3F"
      };

      return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 3. Analytics / Third-Party trackers (safe no-op responses)
    if (url.includes('posthog') || url.includes('sentry') || url.includes('fbevents')) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return origFetch.apply(this, arguments);
  };
})();
