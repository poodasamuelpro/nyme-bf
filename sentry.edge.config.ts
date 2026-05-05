// sentry.edge.config.ts — nyme-bf
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://e7a43131e9001126d7d85ed64bfde639@o4511334237929472.ingest.de.sentry.io/4511334328369232",

  // Performance Monitoring
  tracesSampleRate: 1.0,

  // Désactivé en développement
  enabled: process.env.NODE_ENV !== "development",

  debug: false,
});
