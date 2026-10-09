// Settings that belong to where the site is deployed, not to its code; the deploy's build (build.mjs)
// rewrites this file. An API key lets "From Google Drive" read stacks shared as "Anyone with the
// link" (empty, that option is off), and the default link is the folder that option opens on.
window.MV_CONFIG = {
  google: { apiKey: "" },
  drive: { defaultLink: "" },
};
