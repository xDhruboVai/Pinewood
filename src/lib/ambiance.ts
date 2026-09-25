// Shared by the root layout (a server component) and the ambiance switch (a client component).
// It lives outside the "use client" file on purpose: importing a value from a client module into
// a server component gives a client reference, not the value, which broke the <head> script below.

export type AmbianceMode = "auto" | "day" | "evening";
// Cream (day) is the default. The key was renamed from "pw-ambiance" so earlier saved choices reset to day.
export const AMBIANCE_KEY = "pw-ambiance-v2";
export const DEFAULT_AMBIANCE: AmbianceMode = "day";

/** Runs before paint (inlined in <head>) so there's no flash of the wrong mood. */
export const ambianceScript = `(function(){try{var d=document.documentElement;if(location.pathname.indexOf('/admin')===0){d.dataset.ambiance='day';return;}var m=localStorage.getItem('${AMBIANCE_KEY}')||'${DEFAULT_AMBIANCE}';var h=new Date().getHours();d.dataset.ambiance=m==='auto'?((h>=18||h<6)?'evening':'day'):m;d.dataset.ambianceMode=m;}catch(e){}})();`;
