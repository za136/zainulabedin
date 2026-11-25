// The only way the website talks to the backend. Same-origin: /api/* is proxied by next.config.ts.
import { createApi } from "@zainlabs/content";

export const api = createApi("");
