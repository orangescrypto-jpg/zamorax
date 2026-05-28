module.exports=[18622,(e,t,r)=>{t.exports=e.x("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js",()=>require("next/dist/compiled/next-server/app-page-turbo.runtime.prod.js"))},56704,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-async-storage.external.js",()=>require("next/dist/server/app-render/work-async-storage.external.js"))},32319,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/work-unit-async-storage.external.js",()=>require("next/dist/server/app-render/work-unit-async-storage.external.js"))},24725,(e,t,r)=>{t.exports=e.x("next/dist/server/app-render/after-task-async-storage.external.js",()=>require("next/dist/server/app-render/after-task-async-storage.external.js"))},93695,(e,t,r)=>{t.exports=e.x("next/dist/shared/lib/no-fallback-error.external.js",()=>require("next/dist/shared/lib/no-fallback-error.external.js"))},27817,e=>e.a(async(t,r)=>{try{let t=await e.y("firebase-admin-a14c8a5423a75469/firestore");e.n(t),r()}catch(e){r(e)}},!0),2717,e=>e.a(async(t,r)=>{try{let t=await e.y("firebase-admin-a14c8a5423a75469/app");e.n(t),r()}catch(e){r(e)}},!0),4948,e=>e.a(async(t,r)=>{try{let t=await e.y("firebase-admin-a14c8a5423a75469/auth");e.n(t),r()}catch(e){r(e)}},!0),707,e=>e.a(async(t,r)=>{try{var a=e.i(2717),n=e.i(27817),o=e.i(4948),i=t([a,n,o]);function s(){return(0,a.getApps)().length||(0,a.initializeApp)({credential:(0,a.cert)({clientEmail:process.env.FIREBASE_ADMIN_CLIENT_EMAIL,privateKey:process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g,"\n"),projectId:process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID})}),(0,a.getApp)()}[a,n,o]=i.then?(await i)():i,(0,o.getAuth)(s()),e.s(["getAdminDb",0,function(){return(0,n.getFirestore)(s())}]),r()}catch(e){r(e)}},!1),85699,e=>e.a(async(t,r)=>{try{var a=e.i(707),n=e.i(89171),o=t([a]);function i(e){return`NGN ${(e/100).toLocaleString("en-NG",{minimumFractionDigits:2})}`}function s(e){try{return(e?.toDate?e.toDate():new Date(e)).toLocaleDateString("en-NG",{day:"numeric",month:"long",year:"numeric"})}catch{return"—"}}async function l(e,{params:t}){let{orderId:r}=await t;try{let e=await (0,a.getAdminDb)().collection("orders").doc(r).get();if(!e.exists)return n.NextResponse.json({error:"Order not found"},{status:404});let t=e.data(),o=t.itemPrice||0,l=t.platformFee||0,d=t.totalAmount||o,p=`ZMX-${r.slice(0,8).toUpperCase()}`,c=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Receipt ${p}</title>
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
    <p>${p}</p>
    <p>${s(t.createdAt)}</p>
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
        <td>${s(t.rentalStart)} — ${s(t.rentalEnd)}</td>
        `:""}
        <td>${i(o)}</td>
      </tr>
    </tbody>
    <tbody class="totals">
      ${l>0?`
      <tr>
        <td colspan="${"rental"===t.orderType?3:2}"></td>
        <td class="fee">- ${i(l)} (platform fee)</td>
      </tr>
      `:""}
      <tr class="total-row">
        <td colspan="${"rental"===t.orderType?3:2}">Total Paid</td>
        <td>${i(d)}</td>
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
</html>`;return new n.NextResponse(c,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`inline; filename="Zamorax-Receipt-${p}.html"`}})}catch(e){return console.error("Receipt generation error:",e),n.NextResponse.json({error:"Could not generate receipt"},{status:500})}}[a]=o.then?(await o)():o,e.s(["GET",0,l,"dynamic",0,"force-dynamic"]),r()}catch(e){r(e)}},!1),41634,e=>e.a(async(t,r)=>{try{var a=e.i(47909),n=e.i(74017),o=e.i(96250),i=e.i(59756),s=e.i(61916),l=e.i(74677),d=e.i(69741),p=e.i(16795),c=e.i(87718),u=e.i(95169),h=e.i(47587),g=e.i(66012),x=e.i(70101),f=e.i(26937),m=e.i(10372),v=e.i(93695);e.i(20232);var y=e.i(220),b=e.i(85699),w=t([b]);[b]=w.then?(await w)():w;let E=new a.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/api/receipts/[orderId]/route",pathname:"/api/receipts/[orderId]",filename:"route",bundlePath:""},distDir:".next",relativeProjectDir:"",resolvedPagePath:"[project]/app/api/receipts/[orderId]/route.ts",nextConfigOutput:"",userland:b,...{}}),{workAsyncStorage:A,workUnitAsyncStorage:C,serverHooks:T}=E;async function R(e,t,r){r.requestMeta&&(0,i.setRequestMeta)(e,r.requestMeta),E.isDev&&(0,i.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let a="/api/receipts/[orderId]/route";a=a.replace(/\/index$/,"")||"/";let o=await E.prepare(e,t,{srcPage:a,multiZoneDraftMode:!1});if(!o)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:b,deploymentId:w,params:R,nextConfig:A,parsedUrl:C,isDraftMode:T,prerenderManifest:N,routerServerContext:P,isOnDemandRevalidate:$,revalidateOnlyGenerated:I,resolvedPathname:_,clientReferenceManifest:k,serverActionsManifest:S}=o,D=(0,d.normalizeAppPath)(a),O=!!(N.dynamicRoutes[D]||N.routes[_]),q=async()=>((null==P?void 0:P.render404)?await P.render404(e,t,C,!1):t.end("This page could not be found"),null);if(O&&!T){let e=!!N.routes[_],t=N.dynamicRoutes[D];if(t&&!1===t.fallback&&!e){if(A.adapterPath)return await q();throw new v.NoFallbackError}}let z=null;!O||E.isDev||T||(z=_,z="/index"===z?"/":z);let M=!0===E.isDev||!O,j=O&&!M;S&&k&&(0,l.setManifestsSingleton)({page:a,clientReferenceManifest:k,serverActionsManifest:S});let U=e.method||"GET",H=(0,s.getTracer)(),F=H.getActiveScopeSpan(),B=!!(null==P?void 0:P.isWrappedByNextServer),L=!!(0,i.getRequestMeta)(e,"minimalMode"),K=(0,i.getRequestMeta)(e,"incrementalCache")||await E.getIncrementalCache(e,A,N,L);null==K||K.resetRequestCache(),globalThis.__incrementalCache=K;let G={params:R,previewProps:N.preview,renderOpts:{experimental:{authInterrupts:!!A.experimental.authInterrupts},cacheComponents:!!A.cacheComponents,supportsDynamicResponse:M,incrementalCache:K,cacheLifeProfiles:A.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>E.onRequestError(e,t,a,n,P)},sharedContext:{buildId:b,deploymentId:w}},X=new p.NodeNextRequest(e),Z=new p.NodeNextResponse(t),V=c.NextRequestAdapter.fromNodeNextRequest(X,(0,c.signalFromNodeResponse)(t));try{let o,i=async e=>E.handle(V,G).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=H.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let n=r.get("next.route");if(n){let t=`${U} ${n}`;e.setAttributes({"next.route":n,"http.route":n,"next.span_name":t}),e.updateName(t),o&&o!==e&&(o.setAttribute("http.route",n),o.updateName(t))}else e.updateName(`${U} ${a}`)}),l=async o=>{var s,l;let d=async({previousCacheEntry:n})=>{try{if(!L&&$&&I&&!n)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let a=await i(o);e.fetchMetrics=G.renderOpts.fetchMetrics;let s=G.renderOpts.pendingWaitUntil;s&&r.waitUntil&&(r.waitUntil(s),s=void 0);let l=G.renderOpts.collectedTags;if(!O)return await (0,g.sendResponse)(X,Z,a,G.renderOpts.pendingWaitUntil),null;{let e=await a.blob(),t=(0,x.toNodeOutgoingHttpHeaders)(a.headers);l&&(t[m.NEXT_CACHE_TAGS_HEADER]=l),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==G.renderOpts.collectedRevalidate&&!(G.renderOpts.collectedRevalidate>=m.INFINITE_CACHE)&&G.renderOpts.collectedRevalidate,n=void 0===G.renderOpts.collectedExpire||G.renderOpts.collectedExpire>=m.INFINITE_CACHE?void 0:G.renderOpts.collectedExpire;return{value:{kind:y.CachedRouteKind.APP_ROUTE,status:a.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:n}}}}catch(t){throw(null==n?void 0:n.isStale)&&await E.onRequestError(e,t,{routerKind:"App Router",routePath:a,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:$})},!1,P),t}},p=await E.handleResponse({req:e,nextConfig:A,cacheKey:z,routeKind:n.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:$,revalidateOnlyGenerated:I,responseGenerator:d,waitUntil:r.waitUntil,isMinimalMode:L});if(!O)return null;if((null==p||null==(s=p.value)?void 0:s.kind)!==y.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==p||null==(l=p.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});L||t.setHeader("x-nextjs-cache",$?"REVALIDATED":p.isMiss?"MISS":p.isStale?"STALE":"HIT"),T&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let c=(0,x.fromNodeOutgoingHttpHeaders)(p.value.headers);return L&&O||c.delete(m.NEXT_CACHE_TAGS_HEADER),!p.cacheControl||t.getHeader("Cache-Control")||c.get("Cache-Control")||c.set("Cache-Control",(0,f.getCacheControlHeader)(p.cacheControl)),await (0,g.sendResponse)(X,Z,new Response(p.value.body,{headers:c,status:p.value.status||200})),null};B&&F?await l(F):(o=H.getActiveScopeSpan(),await H.withPropagatedContext(e.headers,()=>H.trace(u.BaseServerSpan.handleRequest,{spanName:`${U} ${a}`,kind:s.SpanKind.SERVER,attributes:{"http.method":U,"http.target":e.url}},l),void 0,!B))}catch(t){if(t instanceof v.NoFallbackError||await E.onRequestError(e,t,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,h.getRevalidateReason)({isStaticGeneration:j,isOnDemandRevalidate:$})},!1,P),O)throw t;return await (0,g.sendResponse)(X,Z,new Response(null,{status:500})),null}}e.s(["handler",0,R,"patchFetch",0,function(){return(0,o.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:C})},"routeModule",0,E,"serverHooks",0,T,"workAsyncStorage",0,A,"workUnitAsyncStorage",0,C]),r()}catch(e){r(e)}},!1)];

//# sourceMappingURL=%5Broot-of-the-server%5D__0no6~_5._.js.map