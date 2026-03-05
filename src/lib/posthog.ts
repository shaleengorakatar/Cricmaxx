import posthog from 'posthog-js';

const POSTHOG_KEY = 'phc_BGkUqwsWdYvpuJ5Eq3DcviFN2Pygu3s66FvAh5jGn4A';
const POSTHOG_HOST = 'https://us.i.posthog.com';

let initialized = false;

export function initPostHog() {
  if (initialized) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // we handle manually via router
    capture_pageleave: true,
    autocapture: true,
  });
  initialized = true;
}

export function identifyUser(userId: string, properties?: Record<string, unknown>) {
  posthog.identify(userId, properties);
}

export function resetUser() {
  posthog.reset();
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

export function trackPageView(path: string) {
  posthog.capture('$pageview', { $current_url: window.location.href, path });
}

export { posthog };
