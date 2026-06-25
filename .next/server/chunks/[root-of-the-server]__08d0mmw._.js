module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},42315,(e,t,r)=>{"use strict";t.exports=e.r(18622)},47540,(e,t,r)=>{"use strict";t.exports=e.r(42315).vendored["react-rsc"].React},707,e=>{"use strict";e.s(["getAdminDb",0,()=>{throw Error("Firebase removed")}])},41634,e=>{"use strict";var t=e.i(47909),r=e.i(74017),a=e.i(60476),o=e.i(59756),n=e.i(61916),i=e.i(74677),s=e.i(69741),l=e.i(16795),d=e.i(87718),p=e.i(95169),c=e.i(47587),u=e.i(66012),x=e.i(70101),g=e.i(26937),h=e.i(10372),f=e.i(93695);e.i(20232);var m=e.i(5232),v=e.i(707),b=e.i(89171);function y(e){return`NGN ${(e/100).toLocaleString("en-NG",{minimumFractionDigits:2})}`}function w(e){try{return(e&&"object"==typeof e&&e.toDate?e.toDate():new Date(e)).toLocaleDateString("en-NG",{day:"numeric",month:"long",year:"numeric"})}catch{return"—"}}async function R(e,{params:t}){let{orderId:r}=await t;try{let e=await (0,v.getAdminDb)().collection("orders").doc(r).get();if(!e.exists)return b.NextResponse.json({error:"Order not found"},{status:404});let t=e.data(),a=t.itemPrice||0,o=t.platformFee||0,n=t.totalAmount||a,i=`ZMX-${r.slice(0,8).toUpperCase()}`,s=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${i}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; padding: 40px; max-width: 680px; margin: auto; }
  .logo { font-size: 22px; font-weight: 800; color: #f97316; letter-spacing: -0.5px; }
  .logo span { color: #1a1a1a; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #f1f5f9; }
  .receipt-meta { text-align: right; }
  .receipt-meta h2 { font-size: 18px; font-weight: 700; color: #1a1a1a; }
  .receipt-meta p { font-size: 12px; color: #64748b; margin-top: 2px; }
  .badge { display: inline-block; background: #dcfce7; color: #166534; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; margin-top: 6px; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 10px; }
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
  .party h3 { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
  .party p { font-size: 12px; color: #475569; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; }
  thead th { padding: 8px 12px; text-align: left; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; border-bottom: 1px solid #e2e8f0; }
  thead th:last-child { text-align: right; }
  tbody td { padding: 10px 12px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  tbody td:last-child { text-align: right; }
  .totals { margin-top: 8px; }
  .totals tr td { border: none; padding: 5px 12px; }
  .totals .total-row td { font-weight: 700; font-size: 15px; border-top: 2px solid #1a1a1a; padding-top: 10px; }
  .fee { color: #ef4444; }
  .escrow-note { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 12px 16px; margin-top: 24px; }
  .escrow-note p { font-size: 12px; color: #1e40af; line-height: 1.5; }
  .escrow-note strong { font-weight: 700; }
  .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; text-align: center; }
  .footer p { font-size: 11px; color: #94a3b8; line-height: 1.6; }
  @media print {
    body { padding: 20px; }
    .no-print { display: none; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">ZAMOR<span>AX</span></div>
    <p style="font-size:11px;color:#94a3b8;margin-top:4px;">Nigeria's Trusted Marketplace</p>
  </div>
  <div class="receipt-meta">
    <h2>RECEIPT</h2>
    <p>${i}</p>
    <p>${w(t.createdAt)}</p>
    <div class="badge">✓ ${t.status?.replace(/_/g," ").toUpperCase()||"COMPLETED"}</div>
  </div>
</div>

<div class="section">
  <div class="section-title">Parties</div>
  <div class="parties">
    <div class="party">
      <h3>Buyer</h3>
      <p>
        ${t.buyerName||"—"}<br/>
        ${t.buyerEmail||""}
      </p>
    </div>
    <div class="party">
      <h3>Seller</h3>
      <p>
        ${t.sellerName||t.sellerStoreName||"—"}<br/>
        ${t.sellerEmail||""}
      </p>
    </div>
  </div>
</div>

<div class="section">
  <div class="section-title">Order Details</div>
  <table>
    <thead>
      <tr>
        <th>Item</th>
        <th>Type</th>
        ${"rental"===t.orderType?"<th>Rental Period</th>":""}
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>${t.itemTitle||"—"}</td>
        <td style="text-transform:capitalize">${t.orderType||"Purchase"}</td>
        ${"rental"===t.orderType&&t.rentalStart?`
        <td>${w(t.rentalStart)} — ${w(t.rentalEnd)}</td>
        `:""}
        <td>${y(a)}</td>
      </tr>
    </tbody>
    <tbody class="totals">
      ${o>0?`
      <tr>
        <td colspan="${"rental"===t.orderType?3:2}"></td>
        <td class="fee">- ${y(o)} (platform fee)</td>
      </tr>
      `:""}
      <tr class="total-row">
        <td colspan="${"rental"===t.orderType?3:2}">Total Paid</td>
        <td>${y(n)}</td>
      </tr>
    </tbody>
  </table>
</div>

${t.trackingNumber?`
<div class="section">
  <div class="section-title">Delivery</div>
  <p style="font-size:13px;">Tracking number: <strong>${t.trackingNumber}</strong></p>
</div>
`:""}

<div class="escrow-note">
  <p>
    <strong>🔒 Escrow Protected</strong> — This transaction was secured by Zamorax Escrow.
    Payment was held safely and released only after buyer confirmation.
    Order ID: ${r}
  </p>
</div>

<div class="footer">
  <p>
    Thank you for trading safely on Zamorax.<br/>
    For support: support@zamorax.ng \xb7 zamorax.ng<br/>
    This receipt was automatically generated and is valid without a signature.
  </p>
</div>

<div class="no-print" style="text-align:center;margin-top:32px;">
  <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;padding:10px 28px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">
    🖨 Print / Save as PDF
  </button>
</div>

</body>
</html>`;return new b.NextResponse(s,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`inline; filename="Zamorax-Receipt-${i}.html"`}})}catch(e){return console.error("Receipt generation error:",e),b.NextResponse.json({error:"Could not generate receipt"},{status:500})}}e.s(["GET",0,R,"dynamic",0,"force-dynamic"],85699);var E=e.i(85699);let C=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/receipts/[orderId]/route",pathname:"/api/receipts/[orderId]",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/receipts/[orderId]/route.ts",nextConfigOutput:"",userland:E,...{}}),{workAsyncStorage:T,workUnitAsyncStorage:A,serverHooks:N}=C;async function P(e,t,a){a.requestMeta&&(0,o.setRequestMeta)(e,a.requestMeta),C.isDev&&(0,o.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let v="/api/receipts/[orderId]/route";v=v.replace(/\/index$/,"")||"/";let b=await C.prepare(e,t,{srcPage:v,multiZoneDraftMode:!1});if(!b)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:y,deploymentId:w,params:R,nextConfig:E,parsedUrl:T,isDraftMode:A,prerenderManifest:N,routerServerContext:P,isOnDemandRevalidate:$,revalidateOnlyGenerated:k,resolvedPathname:S,clientReferenceManifest:D,serverActionsManifest:O}=b,q=(0,s.normalizeAppPath)(v),I=!!(N.dynamicRoutes[q]||N.routes[S]),_=async()=>((null==P?void 0:P.render404)?await P.render404(e,t,T,!1):t.end("This page could not be found"),null);if(I&&!A){let e=!!N.routes[S],t=N.dynamicRoutes[q];if(t&&!1===t.fallback&&!e){if(E.adapterPath)return await _();throw new f.NoFallbackError}}let j=null;!I||C.isDev||A||(j="/index"===(j=S)?"/":j);let z=!0===C.isDev||!I,M=I&&!z;O&&D&&(0,i.setManifestsSingleton)({page:v,clientReferenceManifest:D,serverActionsManifest:O});let U=e.method||"GET",H=(0,n.getTracer)(),F=H.getActiveScopeSpan(),K=!!(null==P?void 0:P.isWrappedByNextServer),L=!!(0,o.getRequestMeta)(e,"minimalMode"),B=(0,o.getRequestMeta)(e,"incrementalCache")||await C.getIncrementalCache(e,E,N,L);null==B||B.resetRequestCache(),globalThis.__incrementalCache=B;let G={params:R,previewProps:N.preview,renderOpts:{experimental:{authInterrupts:!!E.experimental.authInterrupts},cacheComponents:!!E.cacheComponents,supportsDynamicResponse:z,incrementalCache:B,cacheLifeProfiles:E.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,o)=>C.onRequestError(e,t,a,o,P)},sharedContext:{buildId:y,deploymentId:w}},Z=new l.NodeNextRequest(e),X=new l.NodeNextResponse(t),V=d.NextRequestAdapter.fromNodeNextRequest(Z,(0,d.signalFromNodeResponse)(t));try{let o,i=async e=>C.handle(V,G).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==p.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${U} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t),o&&o!==e&&(o.setAttribute("http.route",a),o.updateName(t))}else e.updateName(`${U} ${v}`)}),s=async o=>{var n,s;let l=async({previousCacheEntry:r})=>{try{if(!L&&$&&k&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let n=await i(o);e.fetchMetrics=G.renderOpts.fetchMetrics;let s=G.renderOpts.pendingWaitUntil;s&&a.waitUntil&&(a.waitUntil(s),s=void 0);let l=G.renderOpts.collectedTags;if(!I)return await (0,u.sendResponse)(Z,X,n,G.renderOpts.pendingWaitUntil),null;{let e=await n.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(n.headers);l&&(t[h.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==G.renderOpts.collectedRevalidate&&!(G.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&G.renderOpts.collectedRevalidate,a=void 0===G.renderOpts.collectedExpire||G.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:G.renderOpts.collectedExpire;return{value:{kind:m.CachedRouteKind.APP_ROUTE,status:n.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await C.onRequestError(e,t,{routerKind:"App Router",routePath:v,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:$})},!1,P),t}},d=await C.handleResponse({req:e,nextConfig:E,cacheKey:j,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:$,revalidateOnlyGenerated:k,responseGenerator:l,waitUntil:a.waitUntil,isMinimalMode:L});if(!I)return null;if((null==d||null==(n=d.value)?void 0:n.kind)!==m.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==d||null==(s=d.value)?void 0:s.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});L||t.setHeader("x-nextjs-cache",$?"REVALIDATED":d.isMiss?"MISS":d.isStale?"STALE":"HIT"),A&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let p=(0,x.fromNodeOutgoingHttpHeaders)(d.value.headers);return L&&I||p.delete(h.NEXT_CACHE_TAGS_HEADER),!d.cacheControl||t.getHeader("Cache-Control")||p.get("Cache-Control")||p.set("Cache-Control",(0,g.getCacheControlHeader)(d.cacheControl)),await (0,u.sendResponse)(Z,X,new Response(d.value.body,{headers:p,status:d.value.status||200})),null};K&&F?await s(F):(o=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(p.BaseServerSpan.handleRequest,{spanName:`${U} ${v}`,kind:n.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},s),void 0,!K))}catch(t){if(t instanceof f.NoFallbackError||await C.onRequestError(e,t,{routerKind:"App Router",routePath:q,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:M,isOnDemandRevalidate:$})},!1,P),I)throw t;return await (0,u.sendResponse)(Z,X,new Response(null,{status:500})),null}}e.s(["handler",0,P,"patchFetch",0,function(){return(0,a.patchFetch)({workAsyncStorage:T,workUnitAsyncStorage:A})},"routeModule",0,C,"serverHooks",0,N,"workAsyncStorage",0,T,"workUnitAsyncStorage",0,A],41634)}];

//# sourceMappingURL=%5Broot-of-the-server%5D__08d0mmw._.js.map