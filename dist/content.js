/* empty css                     */function x(){var a,r;return{name:((a=document.querySelector("#gsc_prf_in"))==null?void 0:a.textContent)||"",affiliation:((r=document.querySelector(".gsc_prf_il"))==null?void 0:r.textContent)||"",citations:Array.from(document.querySelectorAll("#gsc_rsb_st tr")).map(e=>{var t,n,c;return{metric:((t=e.querySelector("td:first-child"))==null?void 0:t.textContent)||"",all:((n=e.querySelector("td:nth-child(2)"))==null?void 0:n.textContent)||"",since2018:((c=e.querySelector("td:last-child"))==null?void 0:c.textContent)||""}}),publications:Array.from(document.querySelectorAll("#gsc_a_b .gsc_a_tr")).map(e=>{var t,n,c,s,d,l;return{title:((t=e.querySelector(".gsc_a_t a"))==null?void 0:t.textContent)||"",authors:((n=e.querySelector(".gsc_a_t .gsc_a_at"))==null?void 0:n.textContent)||"",venue:((c=e.querySelector(".gsc_a_t .gsc_a_v"))==null?void 0:c.textContent)||"",year:((s=e.querySelector(".gsc_a_y"))==null?void 0:s.textContent)||"",citations:parseInt(((d=e.querySelector(".gsc_a_c"))==null?void 0:d.textContent)||"0"),url:((l=e.querySelector(".gsc_a_t a"))==null?void 0:l.getAttribute("href"))||""}}),coauthors:Array.from(document.querySelectorAll("#gsc_rsb_co .gsc_rsb_a_desc")).map(e=>{var t,n,c;return{name:((t=e.querySelector(".gsc_rsb_a_desc a"))==null?void 0:t.textContent)||"",imageUrl:((n=e.querySelector("img"))==null?void 0:n.src)||"",profileUrl:((c=e.querySelector("a"))==null?void 0:c.href)||""}})}}function h(o){const a=o.publications.length,r={};let e=0,t=0;o.publications.forEach(i=>{i.year&&(r[i.year]=(r[i.year]||0)+1),t+=i.citations});const n=Object.keys(r),c=a/n.length,s=o.name.split(" ")[1];o.publications.forEach(i=>{i.authors.includes(s)&&(e+=Math.round(i.citations*.2))});const d=e/t*100,l=o.publications.filter(i=>i.citations>0).length/a*100;return{totalPublications:a,publicationsPerYear:c.toFixed(1),selfCitationRate:d.toFixed(1)+"%",sIndex:l.toFixed(1)+"%",hpIndex:Math.round(o.citations[0].all*.8),rcr:(t/a/10).toFixed(2)}}function f(o){const a=document.createElement("div");a.className="scholar-metrics-container";const r=document.createElement("style");r.textContent=`
    .scholar-metrics-container {
      margin: 20px 0;
      padding: 16px;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(12px);
      border-radius: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
      border: 1px solid rgba(0,0,0,0.1);
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .metric-card {
      background: rgba(255, 255, 255, 0.9);
      padding: 12px;
      border-radius: 12px;
      border: 1px solid rgba(0,0,0,0.05);
    }
    .metric-title {
      font-size: 0.75rem;
      color: #64748b;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 1.25rem;
      font-weight: 600;
      color: #1e40af;
    }
    .metrics-header {
      font-size: 1rem;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `,a.appendChild(r);const e=document.createElement("div");e.className="metrics-grid",Object.entries(o).forEach(([n,c])=>{const s=document.createElement("div");s.className="metric-card";const d=document.createElement("div");d.className="metric-title",d.textContent=n.replace(/([A-Z])/g," $1").trim();const l=document.createElement("div");l.className="metric-value",l.textContent=String(c),s.appendChild(d),s.appendChild(l),e.appendChild(s)}),a.appendChild(e);const t=document.querySelector("#gsc_prf_i");t&&t.appendChild(a)}if(window.location.pathname.includes("/citations")){const o=x(),a=h(o);chrome.runtime.sendMessage({type:"PROFILE_DATA",data:{...o,...a}},r=>{chrome.runtime.sendMessage({type:"GET_METRICS"},e=>{e&&f(e)})}),o.coauthors.forEach(async r=>{var e,t,n;if(r.profileUrl)try{const s=await(await fetch(r.profileUrl)).text(),l=new DOMParser().parseFromString(s,"text/html"),i=((e=l.querySelector("#gsc_rsb_st tr:first-child td:nth-child(2)"))==null?void 0:e.textContent)||"0",u=((t=l.querySelector("#gsc_rsb_st tr:nth-child(2) td:nth-child(2)"))==null?void 0:t.textContent)||"0";r.citations=parseInt(i),r.hIndex=parseInt(u);const g=(n=document.querySelector(`a[href="${CSS.escape(r.profileUrl)}"]`))==null?void 0:n.parentElement;if(g){const m=document.createElement("div");m.className="coauthor-metrics";const p=document.createElement("span");p.className="text-sm text-gray-600",p.textContent=`${i} citations • h-index: ${u}`,m.appendChild(p),g.appendChild(m)}}catch(c){console.error("Error fetching co-author metrics:",c)}})}
//# sourceMappingURL=content.js.map
