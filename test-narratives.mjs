const SUPABASE_URL = 'https://mixaxkywkojoclgbjjur.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1peGF4a3l3a29qb2NsZ2JqanVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTA5ODEsImV4cCI6MjA4MjQ4Njk4MX0._rvGSaVi4VERdWbA-Z229rhe4KyJH2FU5pHqLkYjtc4';

const THEME_STOP_WORDS = new Set([
  'the','a','an','of','in','on','for','and','or','to','with','by','from','is','are','was','were','be','been','being','has','have','had','do','does','did','will','would','could','should','may','might','can','shall','not','no','but','if','at','as','it','its','this','that','these','those','their','them','they','we','our','how','what','which','who','whom','when','where','why','all','each','every','both','few','more','most','other','some','such','than','too','very','also','just','about','above','after','again','between','into','through','during','before','via','under','over','upon','within','without','along','since',
  'using','based','exploring','examining','understanding','investigating','analyzing','analysing','assessing','evaluating','measuring','testing','comparing','developing','building','creating','designing','proposing','presenting','showing','demonstrating','revealing','suggesting','explaining','predicting','modeling','modelling','determining','identifying','mapping','tracking','monitoring','implementing','applying','adopting','integrating','combining','linking','bridging','rethinking','reconsidering','revisiting','extending','expanding','enhancing','improving','increasing','reducing','enabling','driving','shaping','influencing','affecting','mediating','moderating',
  'new','study','analysis','research','approach','role','effect','effects','impact','case','evidence','towards','toward','among','across','review','results','findings','implications','perspective','perspectives','framework','model','models','theory','theories','conceptual','empirical','systematic','comparative','critical','introduction','editorial','commentary','response','reply','note','chapter','paper','article','literature','future','directions','special','issue','part','volume',
  'really','highly','fully','merely','largely','mainly','primarily','particularly','especially','generally','currently','recently','increasingly','different','various','several','multiple','first','second','third','early','late','recent','current','good','better','best','high','low','large','small','long','short',
  'challenges','opportunities','strategies','practices','processes','outcomes','determinants','antecedents','consequences','dynamics','patterns','mechanisms','factors','dimensions','aspects','definition','overview','agenda','assessment','exploration','investigation','examination','discussion','considerations',
  'automated','automatic','semi-automated','manual','local','national','international','regional','potential','possible','proposed','alternative','traditional','comprehensive','preliminary','initial','advanced','novel','ethical','practical','theoretical','methodological',
  'seeing','believing','making','taking','getting','going','looking','working','thinking','knowing','finding','giving','telling','feeling','becoming','keeping','leaving','putting','running','setting','turning','bringing','holding','letting','beginning','seeming','helping','talking','moving','living','playing','standing','losing','paying','meeting','sitting','opening','growing','walking','winning','teaching','offering','learning','considering','appearing','leading','rising','changing','coming','reading','calling','following','adding','reaching','serving','pulling','pushing','covering','cutting','crossing','breaking','passing','raising','addressing','reporting','engaging','promoting','achieving','supporting','providing','ensuring','delivering','stimulating','fostering','leveraging','harnessing','unlocking','unleashing','overcoming','navigating','transforming','disrupting','accelerating','redefining','reimagining','uncovering','unraveling','unpacking','deconstructing',
  'drives','driven','matters',
  'curious','personal','reliability','gut','shop','collected','papers','adventures','character','years','vol','swiss','berlin',
  'real','world','open','key','big','end','old','age','set','well','way','much','back','turn','look','take','make','give','come','keep','let','say','get','got','put','run','see','seem','need','try','ask','use','find','tell','call','play','work','move','live','believe','bring','happen','write','provide','sit','stand','lose','pay','meet','include','continue','learn','change','lead','understand','watch','follow','stop','speak','read','add','spend','grow','win','teach','show','hear','offer','remember','consider','appear','love','buy','wait','die','send','expect','build','stay','fall','reach','kill','remain','suggest','raise','pass','sell','require','report','decide','pull',
  'book','books','handbook','proceedings','conference','journal','preprint','thesis','dissertation','monograph','manuscript',
  'der','die','das','und','ein','eine','einer','des','dem','den','auf','aus','bei','mit','von','zum','zur','als','les','des','une','dans','sur','par','pour','avec','aux',
  'het','een','van','voor','met','niet','dat','zij','ook','wel','nog','maar','wat','hoe','wie','waar','naar','tot','over','door','kan','moet','mag','zal','zou','hebben','zijn','worden','deze','dit','die','ons','hun','uw','meer','veel','alle','geen','elk','zo','dan','dus','want','omdat',
  'oude','dag','geld','financi','financieel','financiele','veerkracht','pensioen','pensioenen','sparen','beleggen','inkomen','schuld','schulden','huishouden','consument','onderzoek','studie','rapport','bijdrage','effect','effecten',
  'zetten','mensen','geven','maken','nemen','doen','laten','zien','werken','denken','weten','vinden','kopen','keuze','gedrag','kinderen','jongeren','ouderen','vrouwen','mannen','klanten',
  'aan','actie','punt','recht','deel','plaats','tijd','jaar','hulp','steun','weg','huis','land','stad','werk','leven',
  'zwischen','oder','aber','wenn','weil','nach','kann','wird','sind','nicht','auch','noch','nur','sehr','schon','doch','unter','gegen','durch','ohne','jede','alle','sein','meine','ihre','seine','unser','wir','sie','sich',
  'theorie','antwort','briefe','sechzig','english','translation','letter','jul','jan','feb','mar','apr','jun','aug','sep','oct','nov','dec',
]);

function extractTitleThemes(pubs, authorName, fieldTopics) {
  const bc = new Map();
  for (const pub of pubs) {
    if (/[\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(pub.title)) continue;
    const ac = pub.title.replace(/[^a-zA-ZÀ-ÖØ-öø-ÿĀ-ſ]/g, '');
    const nac = (pub.title.match(/[À-ÖØ-öø-ÿĀ-ſ]/g) || []).length;
    if (ac.length > 0 && nac / ac.length > 0.15) continue;
    const ws = pub.title.toLowerCase().replace(/[^a-z\s-]/g,' ').split(/\s+/).filter(w=>w.length>2&&!THEME_STOP_WORDS.has(w));
    for (let i=0;i<ws.length-1;i++) bc.set(`${ws[i]} ${ws[i+1]}`,(bc.get(`${ws[i]} ${ws[i+1]}`)||0)+1);
  }
  const authorWords = new Set();
  if (authorName) for (const p of authorName.toLowerCase().split(/\s+/)) if (p.length>2) authorWords.add(p);
  const topicPhrases = new Set();
  if (fieldTopics) for (const t of fieldTopics) topicPhrases.add(t.toLowerCase().trim());
  const minC = pubs.length>=50?3:2;
  const sorted = [...bc.entries()].filter(([t,c])=>{
    if(c<minC)return false;const ws=t.split(' ');if(ws.some(w=>authorWords.has(w)))return false;if(topicPhrases.has(t))return false;if(ws.every(w=>w.length<=3))return false;return true;
  }).sort((a,b)=>b[1]-a[1]);
  const sel=[];
  for(const[t]of sorted){if(sel.length>=6)break;const ws=t.split(' ');
    if(sel.some(s=>{const sw=s.split(' ');return ws.some(w=>sw.includes(w))}))continue;sel.push(t);}
  return sel;
}
function fmt(items){if(!items.length)return'';if(items.length===1)return items[0];return items.slice(0,-1).join(', ')+' and '+items[items.length-1]}
function parseAffiliation(raw){
  if(!raw)return{position:'',institution:''};
  const tp=/^(professor|prof\.|assistant|associate|lecturer|instructor|postdoc|post-doc|phd|doctoral|research\s+(scientist|fellow|associate|assistant)|visiting|adjunct|emeritus|dean|chair|director|senior\s+lecturer|junior\s+professor)/i;
  const ci=raw.indexOf(',');if(ci===-1){if(tp.test(raw.trim()))return{position:raw.trim(),institution:''};return{position:'',institution:raw.trim()}}
  const b=raw.slice(0,ci).trim(),a=raw.slice(ci+1).trim();if(tp.test(b))return{position:b,institution:a};return{position:'',institution:raw.trim()};
}
function inferDiscipline(aff,topics){
  const pp=[/(?:professor|prof\.?)\s+(?:of|in|for)\s+(.+?)(?:\s*[,;]|$)/i,/(?:department|dept\.?)\s+(?:of|in)\s+(.+?)(?:\s*[,;]|$)/i];
  for(const p of pp){const m=(aff||'').match(p);if(m){const f=m[1].trim().replace(/\s+at\s+.*$/i,'');if(f.length>2&&f.length<60&&!/\b(university|institute|college|school|center|centre|lab|studies)\b/i.test(f))return f;}}
  if(topics.length>0&&topics[0].split(/\s+/).length<=5)return topics[0];return null;
}
function getCareerSpan(pubs){const cy=new Date().getFullYear();let ys=pubs.map(p=>p.year).filter(y=>y>=1950&&y<=cy+1);if(!ys.length)return{firstYear:0,lastYear:0,years:0};
  if(ys.length>=5){const s=[...ys].sort((a,b)=>a-b);const q1=s[Math.floor(s.length*0.25)];const q3=s[Math.floor(s.length*0.75)];const iqr=q3-q1;ys=ys.filter(y=>y>=q1-1.5*iqr)}
  if(!ys.length)return{firstYear:0,lastYear:0,years:0};return{firstYear:ys.reduce((a,b)=>a<b?a:b),lastYear:ys.reduce((a,b)=>a>b?a:b),years:ys.reduce((a,b)=>a>b?a:b)-ys.reduce((a,b)=>a<b?a:b)+1}}
function getPhase(pubs){const cy=new Date().getFullYear();const r=pubs.filter(p=>p.year>=cy-3).length;const o=pubs.filter(p=>p.year>=cy-6&&p.year<cy-3).length;if(!r)return'inactive';if(!o)return r>=10?'accelerating':'emerging';const rt=r/Math.max(o,1);if(rt>1.3)return'accelerating';if(rt>0.7)return'steady';return'decelerating'}
function inferMethods(pubs){
  const ac=pubs.filter(p=>!/\b(interview|memoir|autobiography|biography|lecture|speech|letter|obituary|tribute|foreword|preface|afterword)\b/i.test(p.title)).map(p=>p.title.toLowerCase()).join(' ');
  const mp=[[/\bmeta[- ]?analy/,'meta-analysis'],[/\bexperiment(?:al|s)?\b/,'experimental methods'],[/\blongitudinal\b/,'longitudinal studies'],[/\bcross[- ]?sectional\b/,'cross-sectional analysis'],[/\bsurvey(?:s|ing)?\b/,'survey research'],[/\bqualitative\b/,'qualitative methods'],[/\bcase stud(?:y|ies)\b/,'case study research'],[/\bmachine learning|deep learning|\bneural net/,'machine learning'],[/\bnatural language processing|\bnlp\b/,'natural language processing'],[/\bsimulat(?:ion|ing|e)\b/,'simulation'],[/\bregression\b/,'regression analysis'],[/\btext mining|sentiment analysis/,'text mining'],[/\beconometric/,'econometric analysis'],[/\bstructural equation\b/,'structural equation modeling']];
  return mp.filter(([rx])=>rx.test(ac)).map(([,l])=>l).slice(0,4);
}
function getVenues(pubs,limit){
  const vc=new Map();
  pubs.forEach(pub=>{const v=pub.venue?.trim();if(!v)return;
    const bn=v.replace(/,\s*(?:vol\.?|no\.?|pp\.?|issue|pages?|supplement)\s.*/i,'').replace(/\s+\d+\s*\([\d()–\-]+\)[\s,.\d–\-]*$/,'').replace(/,\s*\d[\d()–\-\s]*$/,'').replace(/\s+\d+\s*,.*$/,'').replace(/\s+\d+\s*$/,'').trim();
    const lb=bn.toLowerCase();if(/\b(ssrn|arxiv|researchgate|netspar|rijksoverheid|working paper|discussion paper|technical report|preprint|mimeo|unpublished|available at|course|thesis|dissertation|patent|us patent|google patent|university press|academic press|verlag|publisher|editora)\b/i.test(lb)||bn.length<=3)return;
    if(bn.length>0){const k=bn.toLowerCase();const e=vc.get(k);if(e)e.count++;else vc.set(k,{name:bn,count:1})}
  });
  return[...vc.values()].sort((a,b)=>b.count-a.count).slice(0,limit);
}

function generate(data){
  const{publications:pubs,metrics,topics,name,totalCitations:tc}=data;
  const career=getCareerSpan(pubs),phase=getPhase(pubs);
  const topPaper=pubs.length?pubs.reduce((m,p)=>p.citations>m.citations?p:m,pubs[0]):null;
  const tn=topics.map(t=>typeof t.name==='object'?t.name.title:t.name).filter(Boolean).slice(0,5);
  const disc=inferDiscipline(data.affiliation,tn);
  const{position:pos,institution:inst}=parseAffiliation(data.affiliation);
  const SURNAME_PREFIXES=new Set(['de','van','von','di','da','del','della','la','le','el','al','bin','ben','ter','ten','den','der']);
  let ln;
  if(name.includes(',')){ln=name.split(',')[0].trim().split(/\s+/).pop()||name}
  else{const np=name.trim().split(/\s+/);if(np.length>2){let si=np.length-1;for(let i=np.length-2;i>=1;i--){if(SURNAME_PREFIXES.has(np[i].toLowerCase()))si=i;else break;}ln=np.slice(si).join(' ')}else ln=np.length>1?np[np.length-1]:name}
  const tv=getVenues(pubs,3),methods=inferMethods(pubs);
  const cy=new Date().getFullYear(),rr=pubs.filter(p=>p.year>=cy-3&&p.year<=cy).length,or=pubs.filter(p=>p.year>=cy-6&&p.year<cy-3).length;

  const lines=[];
  // CAREER
  let c=`${name} is`;
  if(pos){c+=(/^[aeiou]/i.test(pos)?' an':' a')+` ${pos}`;if(inst)c+=` at ${inst}`}
  else if(inst){c+=disc?` a ${disc} researcher at ${inst}`:` a researcher at ${inst}`}else c+=' a researcher';
  if(tn.length)c+=`, working in the ${tn.length===1?'area':'areas'} of ${fmt(tn)}`;c+='.';
  if(career.firstYear>0)c+=career.years<=2?` ${ln}'s first indexed publication appeared in ${career.firstYear}.`:` ${ln}'s publication record spans ${career.years} years, from ${career.firstYear} to ${career.lastYear}.`;
  if(methods.length)c+=` Based on publication titles, ${ln}'s work draws on ${fmt(methods)}.`;
  lines.push(c);

  // IMPACT
  let im='';
  if(tc===0)im=`${ln} has ${pubs.length} indexed publication${pubs.length!==1?'s':''} and has not yet accumulated citations.`;
  else{im=`Over the course of their career, ${ln} has published ${pubs.length} work${pubs.length!==1?'s':''} and accumulated ${tc.toLocaleString()} citations, yielding an h-index of ${metrics.hIndex}`;if(metrics.i10Index>0)im+=` and an i10-index of ${metrics.i10Index} (${metrics.i10Index} publication${metrics.i10Index!==1?'s':''} with 10 or more citations)`;im+='.';
    if(topPaper?.citations>0)im+=` Their most cited work, "${topPaper.title}", has received ${topPaper.citations.toLocaleString()} citations.`}
  lines.push(im);

  // TREND
  let tr='';const rrF=(rr/3).toFixed(1),orF=(or/3).toFixed(1);
  if(phase==='accelerating')tr=`${ln}'s publication output has been accelerating, averaging ${rrF} publications per year recently compared to ${orF} in the preceding period.`;
  else if(phase==='steady')tr=`${ln} maintains a steady publication pace of approximately ${rrF} publications per year, indicating a sustained and active research program.`;
  else if(phase==='decelerating')tr=`${ln}'s recent publication rate has slowed to ${rrF} per year, compared to ${orF} in the preceding three-year period.`;
  else if(phase==='emerging')tr=`${ln} appears to be in the early stages of their publication career.`;
  else if(phase==='inactive')tr='There are no publications in the most recent three years in the indexed record.';
  if(Math.abs(metrics.citationGrowthRate)>=2){const d=metrics.citationGrowthRate>0?'growing':'declining';tr+=` Citations have been ${d} at an average rate of ${Math.abs(metrics.citationGrowthRate)}% per year over the last three complete years.`}
  else if(metrics.citationGrowthRate!==0&&tc>0)tr+=' Citation rates have remained relatively stable in recent years.';
  if(tr)lines.push(tr);

  // EVOLUTION
  if(career.years>=4&&pubs.length>=6){
    const s=[...pubs].sort((a,b)=>a.year-b.year),mid=Math.floor(s.length/2);
    const fl=tn.length?tn:undefined;
    const et=extractTitleThemes(s.slice(0,mid),name,fl),rt=extractTitleThemes(s.slice(mid),name,fl);
    const es=new Set(et),rs=new Set(rt),eo=et.filter(t=>!rs.has(t)).slice(0,3),ro=rt.filter(t=>!es.has(t)).slice(0,3);
    if(eo.length>0&&ro.length>0)lines.push(`${ln}'s earlier work focused on topics such as ${fmt(eo)}, while more recent publications have shifted towards ${fmt(ro)}.`);
    else if(ro.length>0)lines.push(`${ln}'s recent work has increasingly focused on ${fmt(ro)}.`);
    else{const sh=et.filter(t=>rs.has(t)).slice(0,3);if(sh.length)lines.push(`Throughout their career, ${ln}'s research has consistently centered on ${fmt(sh)}.`)}
  }

  // COLLAB
  if(metrics.collaborationScore>0){
    let cp;if(metrics.collaborationScore===100)cp='All';else if(metrics.collaborationScore>=95)cp='Nearly all';else if(metrics.collaborationScore>=75)cp=`The majority (${metrics.collaborationScore}%)`;else if(metrics.collaborationScore>=50)cp=`About half (${metrics.collaborationScore}%)`;else if(metrics.collaborationScore>=10)cp=`A smaller share (${metrics.collaborationScore}%)`;else cp=`A small fraction (${metrics.collaborationScore}%)`;
    let ct=`${cp} of ${ln}'s publications are co-authored, with an average of ${metrics.averageAuthors} authors per paper across ${metrics.totalCoAuthors} unique co-author${metrics.totalCoAuthors!==1?'s':''}.`;
    if(metrics.topCoAuthor&&metrics.topCoAuthorPapers>=2)ct+=` ${ln}'s most frequent collaborator is ${metrics.topCoAuthor}, with whom they have published ${metrics.topCoAuthorPapers} papers.`;
    lines.push(ct);
  }else if(pubs.length>0)lines.push('All indexed publications are single-authored.');

  // VENUES
  if(tv.length){
    const vl=tv.map(v=>`${v.name} (${v.count} publication${v.count!==1?'s':''})`);
    lines.push(`${ln}'s most frequent publication outlets include ${fmt(vl)}.`);
  }

  // CITATION DIST
  if(tc>0){
    const parts=[];
    if(metrics.citationGini>0){let gd;if(metrics.citationGini>=0.8)gd='highly concentrated among a few key papers';else if(metrics.citationGini>=0.6)gd='moderately concentrated';else if(metrics.citationGini>=0.4)gd='moderately spread across publications';else gd='relatively evenly distributed across publications';parts.push(`Their citation Gini coefficient of ${metrics.citationGini.toFixed(2)} indicates that citations are ${gd}.`)}
    if(metrics.citationHalfLife>0&&metrics.citationHalfLife<100)parts.push(`The citation half-life is ${metrics.citationHalfLife} year${metrics.citationHalfLife!==1?'s':''}, meaning half of all citations were received within ${metrics.citationHalfLife} year${metrics.citationHalfLife!==1?'s':''} of publication.`);
    if(metrics.ageNormalizedRate>0)parts.push(`Age-normalized, they receive approximately ${metrics.ageNormalizedRate} citation${metrics.ageNormalizedRate!==1?'s':''} per career year.`);
    if(parts.length)lines.push(parts.join(' '));
  }

  return lines;
}

async function fetchProfile(id){
  const r=await fetch(`${SUPABASE_URL}/functions/v1/scholar`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${ANON_KEY}`},body:JSON.stringify({profileUrl:`https://scholar.google.com/citations?user=${id}`})});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();
}

const IDS=[
  {id:'NOSPtp8AAAAJ',label:'Jonas Heller'},
  {id:'kZlzBrwAAAAJ',label:'Tim Hilken'},
  {id:'09P2NX4AAAAJ',label:'Dominik Mahr'},
  {id:'THsg1_IAAAAJ',label:'Ko de Ruyter'},
  {id:'QvBkWlIAAAAJ',label:'Elisabeth Brüggen'},
];

async function main(){
  for(let i=0;i<IDS.length;i++){
    if(i>0)await new Promise(r=>setTimeout(r,1500));
    const{id,label}=IDS[i];
    try{
      const d=await fetchProfile(id);
      const lines=generate(d);
      console.log(`\n${'━'.repeat(70)}`);
      console.log(`  ${d.name}`);
      console.log(`${'━'.repeat(70)}\n`);
      for(const line of lines){
        // word wrap at 80 chars
        const wrapped=line.replace(/(.{1,78})(\s|$)/g,'  $1\n').trimEnd();
        console.log(wrapped+'\n');
      }
    }catch(e){console.log(`\n${label} (${id}): ERROR ${e.message}`)}
  }
}
main();
