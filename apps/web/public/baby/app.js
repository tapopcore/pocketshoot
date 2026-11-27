/* Baby Shoot app. One page; every screen and sheet is a history entry so the phone's back button works.
   Talks to /api/b/* with the signed-in user's token. Photos are fetched as blobs so they never sit at a public URL. */
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const FAMS=['All','Indian','Classic','Floral','Minimal','Playful','Fine art','Sky'];
const AGES=[['u2','Under 2 weeks'],['2-4','2 to 4 weeks'],['1-2','1 to 2 months'],['2+','Over 2 months']];
const SEXES=[['boy','Boy'],['girl','Girl'],['','Rather not say']];
const AGE_TXT={'u2':'under 2 weeks','2-4':'2 to 4 weeks','1-2':'1 to 2 months','2+':'over 2 months'};
const AR={'4:5':'4/5','1:1':'1/1','9:16':'9/16'}, SHAPE_NAME={'4:5':'Post · 4:5','1:1':'Square · 1:1','9:16':'Story · 9:16'};
const SHAPES=[['4:5','Post',[18,22]],['1:1','Square',[20,20]],['9:16','Story',[14,25]]];
const CAM={overhead:'From above',eye:'At eye level',close:'Close-up'};
const S={cfg:null,sb:null,token:null,email:'',me:null,baby:{name:'',age:'',sex:''},refs:[],thumbs:{},uploading:0,bad:null,mode:'one',pick:null,count:6,mix:[],fam:'All',shape:'4:5',
  balance:0,freeLeft:false,packs:[],orders:[],shoots:[],after:null,view:null,back:'studio',prefs:{shape:'4:5',theme:'light',notify:true,keep:true},nudged:false,watch:new Set()};
const PRICE={1:149,6:699,10:1099,15:1499};
const rupee=n=>'₹'+Number(n).toLocaleString('en-IN');
const byId=id=>THEMES.find(t=>t.id===id)||{id,name:'Studio set',fam:'',blurb:'',cam:'overhead'};
const NAME=()=>S.baby.name||'your baby';
const POS=cap=>S.baby.name?S.baby.name+"'s":(cap?"Your baby's":"your baby's");
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const store={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ---------- prices: what a shoot of n costs right now ---------- */
function packFor(n){return n===1?'baby_1':'baby_'+n}
function priceRupees(n){const p=S.packs.find(x=>x.code===packFor(n));return p?Math.round(p.price_minor/100):(PRICE[n]||n*149)}
function covered(n){return S.balance>=n}
function tagOf(n){if(covered(n))return n===1&&S.freeLeft?'Free':(n===1?'1 of yours':`${n} of yours`);return rupee(priceRupees(n))}

/* ---------- server ---------- */
class ApiErr extends Error{constructor(m,status,code){super(m);this.status=status;this.code=code}}
async function token(){if(!S.sb)return null;const {data}=await S.sb.auth.getSession();S.token=data.session?.access_token||null;return S.token}
async function api(path,o={}){
  const t=await token();const h={'Authorization':'Bearer '+t};let body=o.form;
  if(o.body!==undefined){h['Content-Type']='application/json';body=JSON.stringify(o.body)}
  let r;try{r=await fetch(path,{method:o.method||(body?'POST':'GET'),headers:h,body})}catch(e){throw new ApiErr("Couldn't reach Baby Shoot. Check your internet and try again.",0,'offline')}
  const j=await r.json().catch(()=>({}));
  if(r.status===401){signedOut();throw new ApiErr('Please sign in again.',401)}
  if(!r.ok)throw new ApiErr(j.error||'Something went wrong. Please try again.',r.status,j.code);
  return j;
}
const blobCache=new Map();
async function blobUrl(path){if(blobCache.has(path))return blobCache.get(path);const p=(async()=>{const t=await token();const r=await fetch(path,{headers:{'Authorization':'Bearer '+t}});if(!r.ok)throw new Error('img '+r.status);return URL.createObjectURL(await r.blob())})();blobCache.set(path,p);p.catch(()=>blobCache.delete(path));return p}
const photoPath=(id,w,take)=>`/api/b/photo?id=${id}${w?'&w='+w:''}${take?'&take='+take:''}`;
function setImg(img,path){img.dataset.src=path;blobUrl(path).then(u=>{if(img.dataset.src===path)img.src=u}).catch(()=>{})}

/* ---------- boot and sign-in ---------- */
async function boot(){
  try{if('serviceWorker' in navigator&&location.hostname!=='localhost')navigator.serviceWorker.register('/sw.js').catch(()=>{})}catch(e){}
  let cfg=null;for(let i=0;i<3&&!cfg;i++){try{const r=await fetch('/api/b/config');if(r.ok)cfg=await r.json()}catch(e){await sleep(800)}}
  if(!cfg){bootDone();show('welcome');toast("Couldn't reach Baby Shoot. Check your internet.");return}
  S.cfg=cfg;applyBusiness();
  S.sb=supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:'bs-auth'}});
  S.sb.auth.onAuthStateChange((ev,session)=>{S.token=session?.access_token||null;if(ev==='SIGNED_IN'&&!S.me)load();if(ev==='SIGNED_OUT')signedOut()});
  const {data}=await S.sb.auth.getSession();
  if(location.search.includes('error_description')){const m=new URLSearchParams(location.search).get('error_description');history.replaceState(null,'','/');toast(m||"Sign-in didn't work. Try again.")}
  if(data.session){await load()}else{bootDone();show('welcome')}
}
function bootDone(){const b=$('#boot');if(b){b.classList.add('off');setTimeout(()=>b.remove(),400)}}
let loading=null;
function load(){if(!loading)loading=doLoad().finally(()=>{loading=null});return loading}
async function doLoad(){
  try{
    const me=await api('/api/b/me');S.me=me;S.email=me.email||'';
    if(location.search.includes('code='))history.replaceState(null,'','/'+location.hash);
    const p=me.profile||{};S.baby={name:p.baby_name||'',age:p.age_band||'',sex:p.sex||''};
    S.prefs={...S.prefs,...(p.prefs||{})};applyTheme();renderPrefs();
    S.refs=me.refs||[];S.packs=me.packs||[];S.orders=me.orders||[];S.shoots=me.shoots||[];
    setBalance(me.balance,p);
    renderChips();renderGrid();renderShoots();sync();bootDone();
    S.shoots.filter(s=>s.status==='running').forEach(s=>watchShoot(s.id));
    const start=(location.hash||'').slice(1);
    if(!p.baby_name&&!p.age_band&&!store.get('bs-asked:'+S.email)){store.set('bs-asked:'+S.email,'1');H.length=0;cur=null;openBaby('studio')}
    else show(['studio','shoots','you'].includes(start)?start:'studio',{root:true});
  }catch(e){bootDone();if(e.status!==401){show('welcome');toast(e.message)}}
}
function setBalance(b,p){S.balance=b|0;const prof=p||S.me?.profile||{};const made=S.shoots.reduce((a,s)=>a+s.baby_photos.length,0);S.freeLeft=!!prof.free_photo_granted&&S.balance>=1&&!made&&!S.orders.length}
async function refreshMe(){try{const me=await api('/api/b/me');S.me=me;S.orders=me.orders||[];S.shoots=me.shoots||[];S.refs=me.refs||S.refs;setBalance(me.balance,me.profile);sync();syncDock();renderShoots()}catch(e){}}
function signedOut(){S.me=null;S.token=null;S.shoots=[];S.refs=[];S.orders=[];blobCache.clear();if(!$('#welcome').hidden)return;closeSheets('force');show('welcome',{root:true})}

$('#w-google').onclick=async()=>{if(!S.sb)return;const b=$('#w-google');b.disabled=true;const {error}=await S.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+'/',queryParams:{prompt:'select_account'}}});if(error){b.disabled=false;toast("Google sign-in didn't open. Try email instead.")}};
/* email sign-in: address, then the 6-digit code from the email */
let rsT=null;
const emailOk=()=>/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test($('#f-tel').value.trim());
function pStep(n){$('#p-step1').hidden=n!==1;$('#p-step2').hidden=n!==2;const g=$('#p-go');g.classList.remove('busy');
  if(n===1){g.textContent=emailOk()?'Send code':'Enter your email';g.disabled=!emailOk()}else{const ok=$('#f-otp').value.replace(/\D/g,'').length>=6;g.textContent=ok?'Sign in':'Enter the code';g.disabled=!ok}}
$('#w-phone').onclick=()=>{$('#f-tel').value='';$('#f-otp').value='';$('#p-err').hidden=true;pStep(1);show('phone');setTimeout(()=>$('#f-tel').focus(),350)};
$('#ph-back').onclick=()=>history.back();
$('#f-tel').addEventListener('input',()=>pStep(1));
/* codes are 6 digits; up to 8 is accepted in case the sign-in settings change. Auto-submit at 8, or at 6 after a short pause. */
let otpT=null;$('#f-otp').addEventListener('input',e=>{e.target.value=e.target.value.replace(/\D/g,'').slice(0,8);$('#p-err').hidden=true;pStep(2);clearTimeout(otpT);const n=e.target.value.length;if(n===8||n===6)otpT=setTimeout(()=>{if(!$('#p-go').disabled&&$('#f-otp').value.length===n)$('#p-go').click()},n===8?250:1400)});
function resendTimer(){let t=45;const b=$('#p-resend');b.disabled=true;clearInterval(rsT);const tick=()=>{b.textContent=t>0?`Send a new code in ${t} s`:'Send a new code';b.disabled=t>0;t--;if(t<-1)clearInterval(rsT)};tick();rsT=setInterval(tick,1000)}
async function sendCode(){const email=$('#f-tel').value.trim().toLowerCase();const {error}=await S.sb.auth.signInWithOtp({email,options:{shouldCreateUser:true,emailRedirectTo:location.origin+'/',data:{source:'baby'}}});if(error)throw error;return email}
$('#p-resend').onclick=async()=>{try{await sendCode();toast('New code sent');resendTimer()}catch(e){toast(e.message||"Couldn't send. Try again in a minute.")}};
$('#p-change').onclick=()=>{pStep(1);setTimeout(()=>$('#f-tel').focus(),100)};
$('#p-go').onclick=async()=>{const g=$('#p-go');
  if(!$('#p-step1').hidden){if(!emailOk()||!S.sb)return;g.disabled=true;g.classList.add('busy');g.textContent='Sending';
    try{const em=await sendCode();$('#p-num').textContent=em;$('#f-otp').value='';pStep(2);resendTimer();setTimeout(()=>$('#f-otp').focus(),100)}
    catch(e){pStep(1);toast(/rate|seconds/i.test(e.message||'')?'Please wait a minute before asking for another code.':(e.message||"Couldn't send the code."))}return}
  g.disabled=true;g.classList.add('busy');g.textContent='Checking';
  const {error}=await S.sb.auth.verifyOtp({email:$('#f-tel').value.trim().toLowerCase(),token:$('#f-otp').value,type:'email'});
  if(error){pStep(2);$('#p-err').textContent="That code didn't match or has expired. Check the latest email, or send a new code.";$('#p-err').hidden=false;return}
  clearInterval(rsT);/* onAuthStateChange loads the app */};
$('#f-tel').addEventListener('keydown',e=>{if(e.key==='Enter'&&emailOk()){e.preventDefault();$('#p-go').click()}});

/* ---------- welcome wall ---------- */
const wallIds=['krishna','pookalam','sage','paper-moon','marigold','teddy','lotus','chai','flower-nest','rose-heart','balloon','kites','diwali','heart-bowl','shiva'];
$$('.wall .col').forEach((c,ci)=>{const l=wallIds.filter((_,i)=>i%3===ci);for(let k=0;k<4;k++)l.forEach(id=>{const im=new Image();im.src=IMG[id];im.alt='';im.decoding='async';c.append(im)})});

/* ---------- baby details ---------- */
AGES.forEach(([k,l])=>{const b=document.createElement('button');b.className='opt';b.setAttribute('role','radio');b.setAttribute('aria-checked','false');b.textContent=l;b.onclick=()=>{S.baby.age=k;$$('#ages .opt').forEach(x=>x.setAttribute('aria-checked',String(x===b)));$('#age-note').hidden=k!=='2+';canGo()};$('#ages').append(b)});
SEXES.forEach(([k,l])=>{const b=document.createElement('button');b.className='opt sx';b.setAttribute('role','radio');b.setAttribute('aria-checked','false');b.textContent=l;b.dataset.k=k;b.onclick=()=>{S.baby.sex=k;$$('.opt.sx').forEach(x=>x.setAttribute('aria-checked',String(x===b)))};$('#sexes').append(b)});
const canGo=()=>{const n=$('#f-name').value.trim(),b=$('#baby-go');b.disabled=!(n&&S.baby.age);b.textContent=b.disabled?(n?'Choose an age':'Add a name and age'):'Continue'};
const keepInView=()=>{const f=$('#f-name');if(document.activeElement===f)f.closest('.field').scrollIntoView({block:'center',behavior:'smooth'})};
$('#f-name').addEventListener('focus',()=>{setTimeout(keepInView,320);setTimeout(keepInView,700)});
window.visualViewport&&visualViewport.addEventListener('resize',keepInView);
$('#f-name').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();e.target.blur();$('#ages').closest('.field').scrollIntoView({block:'center',behavior:'smooth'})}});
$('#f-name').addEventListener('input',canGo);
const leaveBaby=()=>{sync();if(S.back==='studio')show('studio',{root:true});else history.back()};
$('#baby-go').onclick=()=>{S.baby.name=$('#f-name').value.trim().replace(/\s+/g,' ');api('/api/b/me',{body:{babyName:S.baby.name,ageBand:S.baby.age||undefined,sex:S.baby.sex||'none'}}).catch(e=>toast(e.message));leaveBaby()};
$('#baby-skip').onclick=leaveBaby;
function openBaby(back){S.back=back;$('#f-name').value=S.baby.name;$$('#ages .opt').forEach((x,i)=>x.setAttribute('aria-checked',String(AGES[i][0]===S.baby.age)));$$('.opt.sx').forEach(x=>x.setAttribute('aria-checked',String(x.dataset.k===S.baby.sex)));$('#age-note').hidden=S.baby.age!=='2+';$('#baby-skip').textContent=back!=='studio'?'Cancel':'Skip';canGo();show('baby')}

/* ---------- studio ---------- */
function mixFor(n,seed=0){const pools=FAMS.slice(1).map(f=>THEMES.filter(t=>t.fam===f));pools.forEach((p,i)=>p.length&&p.push(...p.splice(0,(seed+i)%p.length)));const out=[];for(let r=0;out.length<n&&r<60;r++)for(const p of pools)if(p[r]&&out.length<n)out.push(p[r].id);return out}
function renderChips(){const c=$('#chips');c.innerHTML='';FAMS.forEach(f=>{const n=f==='All'?THEMES.length:THEMES.filter(t=>t.fam===f).length;const b=document.createElement('button');b.className='chip';b.setAttribute('aria-pressed',String(f===S.fam));b.innerHTML=`${f}<em>${n}</em>`;b.onclick=()=>{S.fam=f;renderChips();renderGrid();$('#studio-scroll').scrollTo({top:0,behavior:'smooth'})};c.append(b)})}
function renderGrid(){
  const g=$('#grid');g.innerHTML='';
  THEMES.filter(t=>S.fam==='All'||t.fam===S.fam).forEach(t=>{
    const inMix=S.mode==='shoot'?S.mix.indexOf(t.id):-1;const on=S.mode==='one'?S.pick===t.id:inMix>=0;
    const b=document.createElement('div');b.className='tile';b.setAttribute('aria-pressed',String(on));
    b.innerHTML=`<button class="ph" aria-label="${on?'Remove':'Choose'} ${esc(t.name)}"><img src="${IMG[t.id]}" alt="" loading="lazy" decoding="async"><span class="pick">${on?(S.mode==='shoot'?inMix+1:'<svg><use href="#i-check"/></svg>'):''}</span></button><button class="look" aria-label="See ${esc(t.name)} full screen"><svg><use href="#i-expand"/></svg></button><b>${esc(t.name)}</b><span class="fam">${t.fam}</span>`;
    b.querySelector('.ph').onclick=()=>toggle(t.id);b.querySelector('.look').onclick=()=>openViewer(t.id);g.append(b);
  });
  syncDock();
}
function toggle(id){
  if(S.mode==='one'){S.pick=S.pick===id?null:id}
  else{const i=S.mix.indexOf(id);if(i>=0)S.mix.splice(i,1);else if(S.mix.length<S.count)S.mix.push(id);else{toast(`Your shoot has ${S.count} sets. Remove one first.`);return}}
  renderGrid();
}
function setMode(m){S.mode=m;$('#seg').dataset.mode=m;$$('#seg button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===m)));$('#shootbox').hidden=m!=='shoot';if(m==='shoot'&&!S.mix.length)S.mix=mixFor(S.count);renderGrid()}
$$('#seg button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
function renderCounts(){const c=$('#counts');c.innerHTML='';[6,10,15].forEach(n=>{const b=document.createElement('button');b.className='count';const t=covered(n)?'Paid':rupee(priceRupees(n));b.innerHTML=`<b>${n} photos</b><small>${t}</small>`;b.setAttribute('aria-label',`${n} photos, ${t}`);b.setAttribute('aria-pressed',String(n===S.count));b.onclick=()=>{const old=S.count;S.count=n;if(n<S.mix.length)S.mix=S.mix.slice(0,n);else if(n>old)fillMix(n);renderCounts();renderGrid()};c.append(b)})}
function syncDock(){
  const go=$('#go');const set=(l,t)=>{$('#go-l').textContent=l;$('#go-t').textContent=t};
  if(S.mode==='one'){const t=S.pick&&byId(S.pick);go.disabled=!t;set(t?`Shoot ${t.name}`:'Tap a set to choose it',t?tagOf(1):'')}
  else{const n=S.mix.length,k=S.count-n;go.disabled=false;set(k===S.count?'Plan the shoot for me':k?`Add ${k} more for me`:`Start the ${n}-photo shoot`,k?'':tagOf(n));
    $('#mix-note').innerHTML=n===S.count?'<b>Your sets.</b> Tap one to change it.':`<b>${S.count-n} more to add.</b> Tap a plus to choose.`;renderStrip()}
  requestAnimationFrame(()=>document.documentElement.style.setProperty('--dock-h',($('#dock').offsetHeight+24)+'px'));
}
let fresh=-1;
function renderStrip(){
  const s=$('#mixstrip');const keep=s.scrollLeft;s.innerHTML='';
  for(let i=0;i<S.count;i++){const id=S.mix[i];const b=document.createElement('button');
    if(id){b.className='mix'+(i===fresh?' fresh':'');b.setAttribute('aria-label',`Set ${i+1}: ${byId(id).name}. Change it`);b.innerHTML=`<img src="${IMG[id]}" alt=""><span>${i+1}</span>`}
    else{b.className='mix empty';b.setAttribute('aria-label',`Choose set ${i+1}`);b.innerHTML='<svg><use href="#i-plus"/></svg>'}
    b.onclick=()=>openSwap(i);s.append(b)}
  s.scrollLeft=keep;fresh=-1;
}
$('#shuffle').onclick=()=>{S.mix=mixFor(S.count,(Date.now()/1000|0)%97);renderGrid();$('#mixstrip').scrollLeft=0};
let swapAt=0,swapFam='All';
function openSwap(i){swapAt=i;swapFam='All';renderSwap();openSheet('swap')}
function renderSwap(){
  const cur=S.mix[swapAt];
  $('#sw-h').textContent=cur?`Change set ${swapAt+1}`:`Choose set ${swapAt+1}`;
  $('#sw-cur').innerHTML=cur?`<img src="${IMG[cur]}" alt=""><span><b>${esc(byId(cur).name)}</b><span>Now in your shoot</span></span>`:'';$('#sw-cur').hidden=!cur;
  $('#sw-rm').hidden=!cur||S.mix.length<=1;
  const c=$('#sw-chips');c.innerHTML='';FAMS.forEach(f=>{const b=document.createElement('button');b.className='chip';b.setAttribute('aria-pressed',String(f===swapFam));b.textContent=f;b.onclick=()=>{swapFam=f;renderSwap()};c.append(b)});
  const g=$('#sw-grid');g.innerHTML='';
  THEMES.filter(t=>swapFam==='All'||t.fam===swapFam).forEach(t=>{const used=S.mix.includes(t.id);const b=document.createElement('button');b.className='sw';if(used)b.disabled=true;
    b.innerHTML=`<img src="${IMG[t.id]}" alt="" loading="lazy">${used?`<em>${t.id===cur?'This one':'In shoot'}</em>`:''}<b>${esc(t.name)}</b>`;
    b.onclick=()=>{if(used)return;if(swapAt<S.mix.length)S.mix[swapAt]=t.id;else S.mix.push(t.id);const at=Math.min(swapAt,S.mix.length-1);fresh=at;closeSheets();renderGrid();toast(`Set ${at+1} is now ${t.name}`)};g.append(b)});
  $('#sheet-swap .body').scrollTop=0;
}
$('#sw-rm').onclick=()=>{S.mix.splice(swapAt,1);closeSheets();renderGrid();toast('Set removed')};
function fillMix(n){for(const id of mixFor(40,(Date.now()/1000|0)%53))if(S.mix.length<n&&!S.mix.includes(id))S.mix.push(id)}
$('#go').onclick=()=>{if(S.mode==='shoot'&&S.mix.length<S.count){const before=S.mix.length;fillMix(S.count);fresh=before;renderGrid();toast(before?`Added ${S.count-before} sets. Tap any to change it.`:'Your shoot is planned. Tap any set to change it.');return}S.after=S.mode;openPhotos()};

/* ---------- full-screen set viewer ---------- */
let vIndex=0;
function openViewer(id){const s=$('#slides');if(!s.childElementCount)THEMES.forEach(t=>{const d=document.createElement('div');d.className='slide';d.innerHTML=`<img src="${IMG[t.id]}" alt="${esc(t.name)}, example photo" loading="lazy">`;s.append(d)});show('viewer');vIndex=THEMES.findIndex(t=>t.id===id);requestAnimationFrame(()=>{s.scrollLeft=vIndex*s.clientWidth;syncViewer()})}
function syncViewer(){const s=$('#slides');vIndex=Math.max(0,Math.min(THEMES.length-1,Math.round(s.scrollLeft/Math.max(1,s.clientWidth))));const t=THEMES[vIndex];$('#counter').textContent=`${vIndex+1} of ${THEMES.length}`;$('#v-name').textContent=t.name;$('#v-blurb').textContent=t.blurb+'. Example photo.';$('#v-meta').textContent=`${t.fam} · ${CAM[t.cam]||''}`;$('#v-choose').textContent=S.mode==='one'?'Choose this set':(S.mix.includes(t.id)?'In your shoot':'Add to my shoot')}
$('#slides').addEventListener('scroll',()=>{clearTimeout(window.__v);window.__v=setTimeout(syncViewer,60)},{passive:true});
$('#v-choose').onclick=()=>{const id=THEMES[vIndex].id;if(S.mode==='one')S.pick=id;else if(!S.mix.includes(id)){if(S.mix.length>=S.count)S.mix.pop();S.mix.push(id)}show('studio');renderGrid()};

/* ---------- baby's photos ---------- */
function thumb(id){if(!S.thumbs[id])S.thumbs[id]=blobUrl(`/api/b/refs/${id}`);return S.thumbs[id]}
function renderUps(){
  const u=$('#ups');u.innerHTML='';
  if(S.bad){const d=document.createElement('div');d.className='up bad';d.innerHTML=`<img src="${S.bad.url}" alt="Photo that can't be used"><span>${esc(S.bad.msg)}</span><button class="x" aria-label="Remove this photo"><svg><use href="#i-x"/></svg></button>`;d.querySelector('.x').onclick=()=>{URL.revokeObjectURL(S.bad.url);S.bad=null;renderUps()};u.append(d)}
  S.refs.forEach((id,i)=>{const d=document.createElement('div');d.className='up'+(id===S.justAdded?' new':'');d.innerHTML=`<img alt="Photo ${i+1} of your baby"><button class="x" aria-label="Remove photo ${i+1}"><svg><use href="#i-x"/></svg></button>`;
    thumb(id).then(url=>d.querySelector('img').src=url).catch(()=>{});
    d.querySelector('.x').onclick=()=>{S.refs=S.refs.filter(x=>x!==id);renderUps();sync();api(`/api/b/refs/${id}`,{method:'DELETE'}).catch(e=>toast(e.message))};u.append(d)});
  for(let k=0;k<S.uploading;k++){const d=document.createElement('div');d.className='up';d.innerHTML='<span class="spin">Adding</span>';u.append(d)}
  if(S.refs.length+S.uploading<5){const a=document.createElement('button');a.className='up add';a.innerHTML=`<svg><use href="#i-plus"/></svg>${S.refs.length?'Add more':'Add photos'}`;a.onclick=()=>$('#file').click();u.append(a)}
  S.justAdded=null;
  const n=S.refs.length;$$('#meter i').forEach((m,i)=>m.classList.toggle('on',i<n));
  $('#like-word').textContent=n?`${n} of 5`:'None yet';
  const go=$('#ph-go');$('#ph-done').hidden=!!S.after;$('#consent-line').hidden=!S.after;
  if(!S.after){go.hidden=true;$('#shape-wrap').hidden=true;$('#summary').hidden=true;return}
  go.hidden=false;$('#shape-wrap').hidden=false;$('#summary').hidden=false;
  const ids=S.after==='one'?[S.pick]:S.mix;const k=ids.length;
  $('#summary').innerHTML=`<span class="stack">${ids.slice(0,3).map(i=>`<img src="${IMG[i]}" alt="">`).join('')}</span><span><b>${S.after==='one'?esc(byId(S.pick).name):k+' photos, mixed sets'}</b><span>${tagOf(k)} · ready in about ${k===1?'1 minute':Math.max(2,Math.ceil(k/4))+' minutes'}</span></span>`;
  go.disabled=!n||S.uploading>0;
  go.textContent=S.uploading?'Adding your photos':!n?'Add a photo first':covered(k)?(k===1&&S.freeLeft?'Make my free photo':`Make ${k===1?'my photo':'my '+k+' photos'}`):`Continue · ${rupee(priceRupees(k))}`;
}
/* shrink big phone photos before upload; the server still checks the size */
async function prepare(file){
  try{const bmp=await createImageBitmap(file,{imageOrientation:'from-image'});const m=Math.max(bmp.width,bmp.height);if(m<=2048&&file.type==='image/jpeg'&&file.size<6e6){bmp.close&&bmp.close();return file}
    const s=Math.min(1,2048/m);const c=document.createElement('canvas');c.width=Math.round(bmp.width*s);c.height=Math.round(bmp.height*s);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);bmp.close&&bmp.close();
    const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.92));return b?new File([b],'photo.jpg',{type:'image/jpeg'}):file}catch(e){return file}}
$('#file').addEventListener('change',async e=>{
  const files=[...e.target.files].slice(0,5-S.refs.length);e.target.value='';if(!files.length)return;
  if(S.bad){URL.revokeObjectURL(S.bad.url);S.bad=null}
  S.uploading+=files.length;renderUps();
  await Promise.all(files.map(async f=>{const prev=URL.createObjectURL(f);
    try{const fd=new FormData();fd.append('photo',await prepare(f));const r=await api('/api/b/refs',{form:fd});S.refs.push(r.id);S.justAdded=r.id;URL.revokeObjectURL(prev)}
    catch(err){S.bad={url:prev,msg:err.code==='too_small'?'Too small. Add the original photo, not a screenshot.':err.message}}
    finally{S.uploading--;renderUps();sync()}}));
});
SHAPES.forEach(([k,l,[w,h]])=>{const b=document.createElement('button');b.className='shape';b.setAttribute('aria-pressed',String(k===S.shape));b.innerHTML=`<i style="width:${w}px;height:${h}px"></i>${l}<small>${k}</small>`;b.onclick=()=>{S.shape=k;$$('.shape').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))};$('#shapes').append(b)});
function openPhotos(){S.shape=S.prefs.shape||'4:5';$$('.shape').forEach((x,i)=>x.setAttribute('aria-pressed',String(SHAPES[i][0]===S.shape)));renderUps();openSheet('photos')}
$('#ph-go').onclick=()=>{const ids=S.after==='one'?[S.pick]:[...S.mix];if(!covered(ids.length)){openPay(ids);return}startShoot(ids,$('#ph-go'))};

async function startShoot(ids,btn){
  if(btn){btn.disabled=true;btn.classList.add('busy');btn.textContent='Starting your shoot'}
  try{const r=await api('/api/b/shoots',{body:{themeIds:ids,shape:S.shape,refIds:S.refs.slice(0,5)}});
    S.balance=Math.max(0,S.balance-ids.length);S.freeLeft=false;
    const shoot={id:r.id,shape:S.shape,status:'running',created_at:new Date().toISOString(),baby_photos:ids.map((t,i)=>({id:'tmp'+i,idx:i,theme_id:t,status:'queued'}))};
    S.shoots.unshift(shoot);busy=false;closeSheets('force');develop(shoot);watchShoot(r.id);sync();
  }catch(e){
    if(btn){btn.classList.remove('busy');btn.disabled=false;renderUps()}
    if(e.code==='needs_payment'){await refreshMe();openPay(ids);return}
    if(e.code==='no_photos'){S.refs=[];renderUps()}
    toast(e.message);
  }
}

/* ---------- paying ---------- */
let payIds=null,busy=false,rzpReady=null;
function loadRazorpay(){if(window.Razorpay)return Promise.resolve();if(!rzpReady)rzpReady=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=ok;s.onerror=()=>{rzpReady=null;no(new Error("Couldn't open payments. Check your internet."))};document.head.append(s)});return rzpReady}
function openPay(ids){payIds=ids;const n=ids.length,p=priceRupees(n);
  $('#pay-h').textContent=n===1?'Pay for your photo':`Pay for ${n} photos`;
  $('#pay-sum').innerHTML=`<span class="stack">${ids.slice(0,3).map(i=>`<img src="${IMG[i]}" alt="">`).join('')}</span><span><b>${n===1?esc(byId(ids[0]).name):n+'-photo shoot'}</b><span>${SHAPE_NAME[S.shape]}</span></span><span class="amt">${rupee(p)}</span>`;
  const pf=$('#pay-free');
  if(S.freeLeft&&n>1){pf.hidden=false;pf.innerHTML='Your free photo is still unused. <button class="linkbtn" id="try-free" type="button">Try one set free first</button>';$('#try-free').onclick=()=>{closeSheets();setMode('one');toast('Pick any set. Your first photo is free')}}
  else if(S.balance>0){pf.hidden=false;pf.textContent=`You have ${S.balance} photo${S.balance>1?'s':''} left from before. ${S.balance>1?'They stay':'It stays'} in your account for next time.`}
  else pf.hidden=true;
  if(!loadRazorpay.ok&&S.cfg?.payments==='razorpay')loadRazorpay().catch(()=>{});
  $('#pay-err').hidden=true;const b=$('#pay-go');b.disabled=false;b.className='btn main';b.textContent=`Pay ${rupee(p)}`;closeSheets('swap');openSheet('pay');$('#sheet-pay .body').scrollTop=0}
function payFailed(msg){busy=false;const b=$('#pay-go');b.disabled=false;b.className='btn main';b.textContent='Try again · '+rupee(priceRupees(payIds.length));$('#pay-err').textContent=msg||"Payment didn't go through. No money was taken. Try again, or pick another way to pay.";$('#pay-err').hidden=false}
async function paid(orderId){const b=$('#pay-go');b.classList.remove('busy');b.classList.add('paid');b.innerHTML='<svg><use href="#i-check"/></svg>Paid';
  await refreshMe();await sleep(500);busy=false;closeSheets('force');await startShoot(payIds,null)}
$('#pay-go').onclick=async()=>{
  const b=$('#pay-go'),ids=payIds,n=ids.length;if(busy)return;busy=true;b.disabled=true;b.classList.add('busy');b.textContent='Opening payment';$('#pay-err').hidden=true;
  let order;try{order=await api('/api/b/checkout',{body:{pack:packFor(n)}})}catch(e){payFailed(e.message);return}
  if(order.mode==='sandbox'){try{await api('/api/checkout/sandbox',{body:{orderId:order.orderId}});await paid(order.orderId)}catch(e){payFailed(e.message)}return}
  try{await loadRazorpay()}catch(e){payFailed(e.message);return}
  b.textContent='Waiting for payment';
  const rz=new Razorpay({key:order.keyId,amount:order.amount,currency:order.currency,name:'Baby Shoot',description:order.description||`${n} photo${n>1?'s':''}`,image:location.origin+'/baby/icons/icon-192.png',order_id:order.razorpayOrderId,
    prefill:{email:S.email||undefined},notes:{order_id:order.orderId},theme:{color:'#d63f74'},
    handler:async resp=>{b.textContent='Confirming payment';
      for(let i=0;i<3;i++){try{await api('/api/checkout/verify',{body:resp});await paid(order.orderId);return}catch(e){if(e.status&&e.status<500&&e.status!==0){break}await sleep(1500)}}
      // The payment went through at Razorpay; our webhook adds the photos even if this check failed.
      await refreshMe();busy=false;if(covered(n)){closeSheets('force');startShoot(ids,null)}else payFailed("We're confirming your payment. If money was taken, your photos will appear within a few minutes, or contact us.")},
    modal:{ondismiss:()=>{if(busy&&!b.classList.contains('paid')){busy=false;b.disabled=false;b.className='btn main';b.textContent=`Pay ${rupee(priceRupees(n))}`}},confirm_close:true}});
  rz.on('payment.failed',r=>{payFailed(r?.error?.description?`${r.error.description} No money was taken.`:null)});
  rz.open();
};

/* ---------- sheets ---------- */
document.addEventListener('click',e=>{const t=e.target.closest('[data-sheet]');if(!t)return;const k=t.dataset.sheet;if(k==='photos'){S.after=null;renderUps()}if(k==='history')renderHistory();if(k==='prices')renderPrices();openSheet(k);$('#sheet-'+k+' .body').scrollTop=0});
function openSheet(id){const t=H[H.length-1];if(!(t&&t.t==='sheet'&&!t.dead))hpush({t:'sheet'});$$('.screen').forEach(x=>x.inert=true);setTimeout(()=>{const f=$('#sheet-'+id+' .sheet-x, #sheet-'+id+' button');f&&f.focus({preventScroll:true})},350);$('#toast').classList.remove('on');$('#scrim').classList.add('on');$$('.sheet').forEach(s=>s.classList.toggle('on',s.id==='sheet-'+id))}
function closeSheets(how){if(busy&&how!=='force')return;if(how!=='pop'&&how!=='swap'){const t=H[H.length-1];if(t&&t.t==='sheet')t.dead=true}$$('.screen').forEach(x=>x.inert=false);$('#scrim').classList.remove('on');$$('.sheet').forEach(s=>s.classList.remove('on'))}
$('#scrim').onclick=()=>closeSheets();document.addEventListener('click',e=>{if(e.target.closest('[data-close]'))closeSheets()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeSheets()});

/* ---------- making the photos ---------- */
/* things to read while the photo is made: true newborn facts and a few warm lines with the baby's name */
const FACTS=[
  'A newborn sees most clearly at about 20 to 30 cm, roughly the distance to your face while feeding.',
  'Babies are born with around 300 bones. Many fuse as they grow, which is why adults have 206.',
  'A newborn already knows their mother\'s voice. They heard it for months before birth.',
  'On the first day, a baby\'s stomach is about the size of a cherry.',
  'Newborns sleep 14 to 17 hours a day, in short stretches around the clock.',
  'Newborns often cry without tears. Tear production picks up over the first few weeks.',
  'That tight grip around your finger is a reflex babies are born with.',
  'A newborn can pick out the smell of their own mother within the first days.',
  'The first real social smile usually arrives at around 6 to 8 weeks.',
  'Of everything around them, newborns would rather look at a face.',
  'A newborn\'s heart beats about 120 to 160 times a minute, nearly twice as fast as yours.',
];
const he=()=>S.baby.sex==='boy'?'he':S.baby.sex==='girl'?'she':'they';
const LINES=[
  ()=>`${S.baby.name||'Your baby'} will only be this small for a few weeks. This is how you keep it.`,
  ()=>`The light is being set up just for ${S.baby.name||'your baby'}.`,
  ()=>`One day ${he()}'ll look at these and ask, "Was I really that tiny?"`,
  ()=>`${S.baby.name?S.baby.name+"'s":'Your baby\'s'} first studio shoot, no car ride or crying in a strange room.`,
];
let factT=null,factI=0;
function startFacts(){
  const order=[];const f=[...FACTS].sort(()=>Math.random()-.5);const l=[...LINES].sort(()=>Math.random()-.5);
  for(let i=0;order.length<8;i++){order.push(['Did you know?',f[i%f.length]]);if(i%2===1&&l.length)order.push([S.baby.name?'For '+S.baby.name:'Meanwhile',l.shift()()])}
  const box=$('#d-fact'),dots=$('#fact-dots');dots.innerHTML=order.slice(0,6).map(()=>'<i></i>').join('');factI=0;
  const showF=()=>{const [k,t]=order[factI%order.length];box.classList.add('out');setTimeout(()=>{$('#fact-k').textContent=k;$('#fact-t').textContent=t;box.classList.remove('out');
      const ds=[...dots.children];ds.forEach((d,j)=>{d.classList.remove('on','done');const pos=factI%ds.length;if(j<pos)d.classList.add('done');if(j===pos){void d.offsetWidth;d.classList.add('on')}})},factI?420:0);factI++};
  clearInterval(factT);box.hidden=false;showF();factT=setInterval(showF,5500);
}
function stopFacts(){clearInterval(factT);$('#d-fact').hidden=true}
const STEPS=['Laying out the set','Lighting from the side','Wrapping and styling','Keeping the face true','Developing'];
let devId=null,devT0=0,stepT=null;
function develop(shoot){
  devId=shoot.id;devT0=Date.now();const ph=shoot.baby_photos;const n=ph.length,one=n===1,shape=shoot.shape;
  $('#d-acts').hidden=true;$('#d-btn').hidden=false;renderShoots();
  const st=$('#d-stage');st.style.setProperty('--ar',AR[shape]);st.dataset.shape=shape;st.style.maxWidth=shape==='9:16'&&one?'300px':'';st.style.marginInline='auto';
  $('#d-tag').textContent=one?'Your photo':`${n} photos`;
  $('#d-title').textContent=one?byId(ph[0].theme_id).name:`${NAME().replace(/^./,c=>c.toUpperCase())} in the studio`;
  const tray=(p,i)=>`<div class="tray go" id="t${i}"><div class="fillw" aria-hidden="true"><img src="${IMG[p.theme_id]}" alt=""></div><img src="${IMG[p.theme_id]}" alt=""><div class="grain"></div>${one?'':`<span class="ex" aria-hidden="true"><svg><use href="#i-expand"/></svg></span><span class="failmsg">Didn't work<small>Not charged</small></span>`}</div>`;
  st.innerHTML=one?tray(ph[0],0):`<div class="contact">${ph.map(tray).join('')}</div>`;
  show('develop');$('#bar').style.width='4%';$('#d-note').hidden=false;const db=$('#d-btn');db.className='btn soft';db.textContent='Keep browsing sets';db.dataset.go='studio';
  clearInterval(stepT);let k=0;const est=estimate(n);
  const tick=()=>{const el=(Date.now()-devT0);const p=Math.min(.92,el/est);$('#step-text').textContent=STEPS[Math.min(STEPS.length-1,Math.floor(p*STEPS.length))];$('#bar').style.width=Math.max(4,p*100)+'%';const left=Math.max(0,Math.round((est-el)/1000));$('#step-time').textContent=left>90?`about ${Math.ceil(left/60)} min`:left>5?`about ${left} s`:'almost there'};
  tick();stepT=setInterval(tick,1000);startFacts();
}
const estimate=n=>(Math.ceil(n/4)*30+8)*1000;
function updateDevelop(shoot){
  if(devId!==shoot.id||$('#develop').hidden)return;
  const ph=shoot.baby_photos,n=ph.length;
  ph.forEach((p,i)=>{const t=$('#t'+i);if(!t)return;
    if(p.status==='done'&&!t.classList.contains('real')){const im=t.querySelector(':scope>img');im.onload=()=>{t.classList.add('real','done')};setImg(im,photoPath(p.id,700))}
    if(p.status==='failed'&&!t.classList.contains('fail'))t.classList.add('fail');
    if(p.status==='deleted')t.remove()});
  if(shoot.status!=='done'&&ph.some(p=>p.status==='queued'||p.status==='running'))return;
  clearInterval(stepT);stopFacts();$('#bar').style.width='100%';
  const ok=ph.filter(p=>p.status==='done'),failed=ph.filter(p=>p.status==='failed').length;
  if(n===1){if(ok.length){$('#step-text').textContent='Ready';$('#step-time').textContent='';setTimeout(()=>{if(!$('#develop').hidden&&devId===shoot.id)openPhoto(shoot,0,'studio',{replace:true})},1600)}else{$('#d-title').textContent="This one didn't work";$('#step-text').textContent="You weren't charged. The photo is back in your account, so you can try again.";$('#step-time').textContent='';$('#d-note').hidden=true;const db=$('#d-btn');db.className='btn main';db.textContent='Try again';db.dataset.go='studio'}return}
  $('#d-tag').textContent=`${ok.length} photos`;
  $('#d-title').textContent=failed?`${ok.length} of ${n} photos are ready`:'Your shoot is ready';
  $('#step-text').textContent=failed?`${failed} didn't work, so you weren't charged for ${failed>1?'them':'it'}. ${failed>1?'They are':'It is'} back in your account to use again.`:'Tap any photo to save or share it';
  $('#step-time').textContent='';$('#d-note').hidden=true;$('#d-btn').hidden=true;$('#d-acts').hidden=!ok.length;
  $('#d-save').textContent=`Save all ${ok.length}`;$('#d-save').onclick=()=>saveMany(ok);$('#d-see').onclick=()=>show('shoots');
  $$('.contact .tray').forEach((t,i)=>{const p=ph[i];if(!p||p.status!=='done')return;const j=ok.indexOf(p);t.style.cursor='pointer';t.setAttribute('role','button');t.setAttribute('tabindex','0');t.onclick=()=>openPhoto(shoot,j,'develop')});
}
/* one poller per running shoot; keeps going when the parent leaves the screen */
async function watchShoot(id){
  if(S.watch.has(id))return;S.watch.add(id);let wait=3000;
  try{for(let i=0;i<400;i++){await sleep(document.hidden?Math.max(wait,8000):wait);
      let r;try{r=await api(`/api/b/shoots/${id}`)}catch(e){if(e.status===401||e.status===404)return;wait=Math.min(wait*1.5,15000);continue}
      wait=3000;const shoot=r.shoot;const k=S.shoots.findIndex(s=>s.id===id);if(k>=0)S.shoots[k]=shoot;else S.shoots.unshift(shoot);
      updateDevelop(shoot);if(!$('#shoots').hidden)renderShoots();
      if(S.view&&S.view.shoot.id===id){S.view.shoot=shoot}
      const pending=shoot.baby_photos.some(p=>p.status==='queued'||p.status==='running');
      if(!pending){renderShoots();finished(shoot);return}}
  }finally{S.watch.delete(id)}
}
async function finished(shoot){
  await refreshMe();
  const ok=shoot.baby_photos.filter(p=>p.status==='done').length;
  if(!S.prefs.keep&&S.refs.length){const ids=[...S.refs];S.refs=[];S.thumbs={};ids.forEach(id=>api(`/api/b/refs/${id}`,{method:'DELETE'}).catch(()=>{}))}
  if(document.hidden&&S.prefs.notify&&ok&&'Notification' in window&&Notification.permission==='granted'){
    const title=ok>1?`${ok} photos are ready`:'Your photo is ready',body=`${S.baby.name?S.baby.name+"'s":'Your'} shoot is done. Tap to see it.`;
    try{const reg=await navigator.serviceWorker?.getRegistration();if(reg)reg.showNotification(title,{body,icon:'/baby/icons/icon-192.png',badge:'/baby/icons/icon-192.png',tag:shoot.id});else new Notification(title,{body,icon:'/baby/icons/icon-192.png'})}catch(e){}
  }else if(devId!==shoot.id&&!(S.view&&S.view.shoot.id===shoot.id&&!$('#result').hidden)){if(ok)toast(ok>1?`${ok} photos are ready in Shoots`:'Your photo is ready in Shoots')}
}

/* ---------- one photo ---------- */
const doneOf=shoot=>shoot.baby_photos.filter(p=>p.status==='done');
function openPhoto(shoot,i,from,o){S.view={shoot,i,from};renderView();show('result',o);fitFrame()}
function backTo(t){for(let i=H.length-2;i>=0;i--){const e=H[i];if(e.t==='screen'&&!e.dead){if(e.id===t){history.back();return}break}}show(t)}
function curPhoto(){const v=S.view;if(!v)return null;return doneOf(v.shoot)[v.i]||null}
function renderView(){zoomSet(1);const {shoot}=S.view;const list=doneOf(shoot);const n=list.length;if(!n){backTo(S.view.from||'studio');return}S.view.i=Math.min(S.view.i,n-1);const p=list[S.view.i],t=byId(p.theme_id);
  const f=$('#r-frame');f.style.setProperty('--ar',AR[shoot.shape]);f.dataset.shape=shoot.shape;f.classList.add('real');
  const im=$('#r-img');im.removeAttribute('src');im.alt=`${t.name}, ${POS()} photo`;setImg(im,photoPath(p.id,1400,p.remade?(p.kept||'new'):null));
  $('#r-fill').removeAttribute('src');$('#r-name').textContent=t.name;
  $('#r-shape').textContent=SHAPE_NAME[shoot.shape]+(n>1?` · ${S.view.i+1} of ${n}`:'');$('#r-prev').hidden=S.view.i===0;$('#r-next').hidden=S.view.i===n-1;syncRedo();
  $('#r-main').textContent=S.view.from==='shoots'?'Back to shoots':(n>1?'Back to the shoot':'Shoot another set');fitFrame()}
function stepView(d){const v=S.view;if(!v)return;const j=v.i+d;if(j<0||j>=doneOf(v.shoot).length)return;v.i=j;renderView()}
$('#r-prev').onclick=()=>stepView(-1);$('#r-next').onclick=()=>stepView(1);
$('#r-close').onclick=()=>backTo(S.view?.from==='develop'?'develop':(S.view?.from||'studio'));
$('#r-main').onclick=()=>backTo(S.view?.from==='develop'?'develop':(S.view?.from||'studio'));
const Z={s:1,x:0,y:0};function zoomSet(s,x=0,y=0){const f=$('#r-frame'),im=$('#r-img');Z.s=Math.min(4,Math.max(1,s));const mx=(Z.s-1)*f.clientWidth/2,my=(Z.s-1)*f.clientHeight/2;Z.x=Math.max(-mx,Math.min(mx,Z.s>1?x:0));Z.y=Math.max(-my,Math.min(my,Z.s>1?y:0));im.style.transform=Z.s>1?`translate(${Z.x}px,${Z.y}px) scale(${Z.s})`:'';f.classList.toggle('zoomed',Z.s>1);f.style.touchAction=Z.s>1?'none':'pan-y'}
(()=>{let x0=null,y0=null,d0=0,s0=1,px=0,py=0,lastTap=0,lastTouch=0;const st=$('#r-stage'),f=$('#r-frame');const dist=t=>Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
  st.addEventListener('touchstart',e=>{lastTouch=Date.now();if(e.touches.length===2){d0=dist(e.touches);s0=Z.s;x0=null}else{x0=e.touches[0].clientX;y0=e.touches[0].clientY;px=Z.x;py=Z.y}},{passive:true});
  st.addEventListener('touchmove',e=>{if(e.touches.length===2&&d0){e.preventDefault();zoomSet(s0*dist(e.touches)/d0,Z.x,Z.y)}else if(Z.s>1&&x0!=null){e.preventDefault();zoomSet(Z.s,px+e.touches[0].clientX-x0,py+e.touches[0].clientY-y0)}},{passive:false});
  st.addEventListener('touchend',e=>{if(d0&&e.touches.length<2){d0=0;if(Z.s<1.05)zoomSet(1);return}if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;const now=Date.now();
    if(Math.abs(dx)<10&&Math.abs(dy)<10&&e.target.closest('#r-frame')&&!e.target.closest('.r-nav')){if(now-lastTap<350){zoomSet(Z.s>1?1:2.5);lastTap=0}else lastTap=now}
    else if(Z.s===1&&Math.abs(dx)>50)stepView(dx<0?1:-1);x0=null},{passive:true});
  f.addEventListener('dblclick',()=>{if(Date.now()-lastTouch<1000)return;zoomSet(Z.s>1?1:2.5)})})();
document.addEventListener('keydown',e=>{if($('#result').hidden)return;if(e.key==='ArrowRight')stepView(1);if(e.key==='ArrowLeft')stepView(-1)});
function fitFrame(){const st=$('.r-stage'),f=$('#r-frame');if(!st||!f.dataset.shape||$('#result').hidden)return;const cs=getComputedStyle(st);const W=st.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight),Hh=st.clientHeight-parseFloat(cs.paddingTop)-parseFloat(cs.paddingBottom);const [a,b]=f.dataset.shape.split(':').map(Number);let w=W,h=W*b/a;if(h>Hh){h=Hh;w=Hh*a/b}f.style.width=Math.floor(w)+'px';f.style.height=Math.floor(h)+'px'}
addEventListener('resize',fitFrame);

/* takes, feedback and the free remake */
function syncTakes(){const p=curPhoto();if(!p)return;const used=!!p.remade;$('#takes').hidden=!used;const t=p.kept||'new';$$('#takes button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.take===t)));
  $('#fb').hidden=used;$('#fb-q').textContent=`Looks like ${S.baby.name||'your baby'}?`;$$('#fb button').forEach(b=>b.setAttribute('aria-pressed',String(p.feedback===b.dataset.fb)))}
$$('#takes button').forEach(b=>b.onclick=()=>{const p=curPhoto();if(!p)return;p.kept=b.dataset.take;syncTakes();setImg($('#r-img'),photoPath(p.id,1400,p.kept));api(`/api/b/photos/${p.id}`,{body:{action:'keep',take:p.kept}}).catch(e=>toast(e.message));toast(p.kept==='first'?'Keeping the first take':'Keeping the new take')});
$$('#fb button').forEach(b=>b.onclick=()=>{const p=curPhoto();if(!p)return;p.feedback=b.dataset.fb;syncTakes();api(`/api/b/photos/${p.id}`,{body:{action:'feedback',value:p.feedback}}).catch(()=>{});
  if(p.feedback==='yes')toast('Thanks. That helps us get better');else if(!p.remade)$('#r-redo').click();else toast('Thanks. Tell us more from Contact us in You')});
function syncRedo(){syncTakes();const p=curPhoto();const used=!!p?.remade,running=p&&remaking.has(p.id);$('#r-redo small').textContent=running?'Making':used?'Used':'Free';$('#r-redo').classList.toggle('used',used||running);$('#r-redo').setAttribute('aria-label',used?'Remake, already used for this photo':'Remake this photo, free')}
const remaking=new Set();
$('#r-redo').onclick=()=>{const p=curPhoto();if(!p)return;if(remaking.has(p.id)){toast('Your new take is on its way');return}if(p.remade){toast('This photo has had its free remake');return}
  ask({title:'Remake this photo?',body:'Same set, same baby, a fresh take. Every photo gets one free remake. You can keep whichever take you like.',yes:'Remake',no:'Keep this one',onYes:()=>remake(p)})};
async function remake(p){const shoot=S.view.shoot;
  try{await api(`/api/b/photos/${p.id}`,{body:{action:'remake'}})}catch(e){toast(e.message);return}
  remaking.add(p.id);syncRedo();const f=$('#r-frame');f.classList.remove('redo');void f.offsetWidth;f.classList.add('redo');toast('Making a new take. About a minute');
  for(let i=0;i<60;i++){await sleep(4000);let r;try{r=await api(`/api/b/shoots/${shoot.id}`)}catch(e){continue}
    const q=r.shoot.baby_photos.find(x=>x.id===p.id);if(!q)break;
    if(q.status==='done'&&q.remade){Object.assign(p,q);const k=S.shoots.findIndex(s=>s.id===shoot.id);if(k>=0)S.shoots[k]=r.shoot;if(S.view?.shoot.id===shoot.id)S.view.shoot=r.shoot;remaking.delete(p.id);
      if(!$('#result').hidden&&curPhoto()?.id===p.id){renderView();toast('New take ready. Keep whichever you like')}else toast('Your new take is ready in Shoots');renderShoots();return}
    if(q.status==='done'&&!q.remade&&i>2){remaking.delete(p.id);syncRedo();toast("The remake didn't work this time. Try again in a moment.");return}}
  remaking.delete(p.id);syncRedo()}
$('#r-del').onclick=()=>ask({title:'Delete this photo?',body:"It will be removed from your shoots. This can't be undone.",yes:'Delete',no:'Keep it',danger:true,onYes:delPhoto});
async function delPhoto(){const p=curPhoto();if(!p)return;try{await api(`/api/b/photos/${p.id}`,{method:'DELETE'})}catch(e){toast(e.message);return}
  p.status='deleted';const shoot=S.view.shoot;toast('Photo deleted');
  if(!doneOf(shoot).length){S.shoots=S.shoots.filter(s=>s.baby_photos.some(x=>x.status==='done'||x.status==='queued'||x.status==='running'));renderShoots();backTo(S.view.from==='develop'?'studio':S.view.from);return}
  renderShoots();renderView()}

/* save and share: full-quality JPEG straight from the server */
async function fileFor(p){const t=await token();const r=await fetch(photoPath(p.id,null,null)+'&dl=1',{headers:{'Authorization':'Bearer '+t}});if(!r.ok)throw new Error('dl');const b=await r.blob();return new File([b],`baby-shoot-${p.theme_id}-${(p.idx|0)+1}.jpg`,{type:'image/jpeg'})}
function download(file){const u=URL.createObjectURL(file);const a=document.createElement('a');a.href=u;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
async function savePhotos(list){if(!list.length){toast('No photos yet');return}
  toast(list.length>1?`Getting ${list.length} photos ready`:'Getting your photo ready');
  try{const files=[];for(const p of list)files.push(await fileFor(p));
    if(files.length>1&&!(navigator.canShare&&navigator.canShare({files}))){const z=await zipOf(files);download(z)}else if(files.length===1)download(files[0]);
    else{try{await navigator.share({files});return}catch(e){if(e.name==='AbortError')return;download(await zipOf(files))}}
    toast(list.length>1?`${list.length} photos saved`:'Saved in full quality')}catch(e){toast("Couldn't save. Check your internet and try again.")}}
const saveMany=savePhotos;
let zipLib=null;function zipOf(files){if(!zipLib)zipLib=new Promise((ok,no)=>{const s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';s.onload=ok;s.onerror=no;document.head.append(s)});
  return zipLib.then(async()=>{const z=new JSZip();files.forEach(f=>z.file(f.name,f));const b=await z.generateAsync({type:'blob'});return new File([b],`${(S.baby.name||'baby').replace(/[^\w-]+/g,'-').toLowerCase()}-shoot.zip`,{type:'application/zip'})})}
async function sharePhotos(list,wa){if(!list.length)return;try{const files=[];for(const p of list)files.push(await fileFor(p));
  const text=wa?`${S.baby.name?S.baby.name+"'s":'Our'} newborn shoot`:'';
  if(navigator.canShare&&navigator.canShare({files})){try{await navigator.share({files,text})}catch(e){}return}
  if(wa){download(files.length>1?await zipOf(files):files[0]);toast('Saved. Attach it in WhatsApp');return}
  download(files.length>1?await zipOf(files):files[0])}catch(e){toast("Couldn't share. Check your internet and try again.")}}
document.addEventListener('click',e=>{const b=e.target.closest('[data-share]');if(!b)return;const p=curPhoto();if(p)sharePhotos([p],b.dataset.share==='wa')});
document.addEventListener('click',e=>{const b=e.target.closest('#result [data-toast="Saved to your phone in full quality"]');if(!b)return;e.stopImmediatePropagation();const p=curPhoto();if(p)savePhotos([p])},true);

/* ---------- shoots ---------- */
const timeOf=d=>new Date(d).toLocaleTimeString('en-IN',{hour:'numeric',minute:'2-digit'}).toLowerCase();
const dayOf=d=>{const x=new Date(d),t=new Date();const y=new Date(Date.now()-864e5);if(x.toDateString()===t.toDateString())return 'Today';if(x.toDateString()===y.toDateString())return 'Yesterday';return x.toLocaleDateString('en-IN',{day:'numeric',month:'short'})};
function renderShoots(){
  const L=$('#shoot-list');const list=S.shoots.filter(s=>s.baby_photos.some(p=>p.status!=='deleted'&&p.status!=='failed'));
  if(!list.length){L.innerHTML=`<div class="empty"><b style="font-size:17px">No photos yet</b><span class="muted small" style="max-width:26ch">Every photo you make is kept here, so you can save or share it again later.</span><button class="btn main" style="margin-top:12px" data-go="studio">Pick a set</button></div>`;return}
  L.innerHTML='';
  list.forEach(m=>{const done=doneOf(m),pend=m.baby_photos.filter(p=>p.status==='queued'||p.status==='running');const n=done.length+pend.length;const c=document.createElement('section');c.className='shoot-card';
    const first=m.baby_photos[0];
    c.innerHTML=`<div class="sc-head"><b>${m.baby_photos.length===1?esc(byId(first.theme_id).name):'Full shoot'}</b><span>${pend.length?`<i class="pending-dot"></i>${done.length} of ${n} ready`:`${n} photo${n>1?'s':''}`} · ${SHAPE_NAME[m.shape]} · ${dayOf(m.created_at)}, ${timeOf(m.created_at)}</span></div>
    <div class="strip" data-shape="${m.shape}" style="--ar:${AR[m.shape]}">${done.map((p,i)=>`<button class="ph-btn real" data-i="${i}" aria-label="Open ${esc(byId(p.theme_id).name)}"><img alt="" data-pid="${p.id}"><span class="ex" aria-hidden="true"><svg><use href="#i-expand"/></svg></span></button>`).join('')}${pend.map(p=>`<div class="ph-btn" aria-label="Still making"><div class="fillw" aria-hidden="true"><img src="${IMG[p.theme_id]}" alt=""></div><img src="${IMG[p.theme_id]}" alt="" style="opacity:.35;filter:blur(6px)"></div>`).join('')}</div>
    ${done.length?`<div class="sc-acts"><button class="btn soft" data-act="save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5v11m0 0-4-4m4 4 4-4"/><path d="M4.5 15v2.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15"/></svg>${done.length>1?`Save all ${done.length}`:'Save'}</button><button class="btn soft" data-act="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.2 19.8l1.2-3.9A8 8 0 1 1 8.3 18.7z"/><path d="M9.2 8.6c.3 2.9 2.4 5.2 5.6 6l1-1.3-1.8-1-.8.8c-1.2-.5-2.1-1.4-2.6-2.6l.8-.8-1-1.8z" stroke-width="1.4"/></svg>WhatsApp</button></div>`:''}`;
    c.querySelectorAll('img[data-pid]').forEach(im=>{const p=done.find(x=>x.id===im.dataset.pid);setImg(im,photoPath(im.dataset.pid,500,p?.remade?(p.kept||'new'):null))});
    c.querySelectorAll('button.ph-btn').forEach(b=>b.onclick=()=>openPhoto(m,+b.dataset.i,'shoots'));
    c.querySelector('[data-act="save"]')?.addEventListener('click',()=>savePhotos(done));
    c.querySelector('[data-act="share"]')?.addEventListener('click',()=>sharePhotos(done,true));
    L.append(c)});
}

/* ---------- you ---------- */
function sync(){
  const made=S.shoots.reduce((a,m)=>a+doneOf(m).length,0);
  const nw=$('#nudge-wrap');nw.innerHTML=(!S.baby.name&&made&&!S.nudged)?'<div class="nudge"><span><b>Add your baby\'s name</b>Every shoot gets their name.</span><button class="linkbtn" id="nudge-go">Add</button><button class="x2" aria-label="Not now" id="nudge-x"><svg><use href="#i-x"/></svg></button></div>':'';
  if($('#nudge-go')){$('#nudge-go').onclick=()=>openBaby('you-studio');$('#nudge-x').onclick=()=>{S.nudged=true;sync()}}
  $('#studio-h').innerHTML=`Pick a set for <span class="script">${esc(NAME())}</span>`;
  $('#shoots-h').innerHTML=S.baby.name?`<span class="script">${esc(S.baby.name)}'s</span> shoots`:'Your shoots';
  $('#ph-h').textContent=`Add ${POS()} photos`;
  $('#chip-text').textContent=S.baby.name||'Add baby';
  $$('[data-name]').forEach(e=>e.textContent=S.baby.name||'Your baby');
  $$('[data-avatar]').forEach(a=>{if(S.refs.length){a.innerHTML='<img alt="">';thumb(S.refs[0]).then(u=>{const i=a.querySelector('img');if(i)i.src=u}).catch(()=>{})}else a.textContent=S.baby.name?S.baby.name[0].toUpperCase():'+'});
  $('#you-age').textContent=S.baby.age?AGE_TXT[S.baby.age]:'Age not added';
  $('#you-photos').textContent=S.refs.length?`${S.refs.length} of 5 added`:'None added yet';
  $('#you-login').textContent=S.email?'Signed in as '+S.email:'';
  $('#you-price').textContent=S.freeLeft?'Your first photo is free':S.balance?`${S.balance} photo${S.balance>1?'s':''} ready to use`:'One photo ₹149 · shoots from ₹699';
  $('#pr-free').textContent=S.freeLeft?'Your first one is free':'';
  $('#you-pays').textContent=S.orders.length?`${S.orders.length} payment${S.orders.length>1?'s':''}`:'None yet';
  $('#you-dl-sub').textContent=made?`${made} photo${made>1?'s':''} in full quality`:'No photos yet';
  $('#keep-sub').textContent=S.prefs.keep?'Kept for 90 days, then deleted':'Deleted after each shoot';
  $$('.row[role="switch"]').forEach(b=>b.setAttribute('aria-checked',String(!!S.prefs[b.dataset.pref])));
  if($('#studio').hidden===false)syncDock();renderCounts();
}
function renderPrices(){const rows=S.packs.length?S.packs:[{code:'baby_1',name:'One photo',credits:1,price_minor:14900},{code:'baby_6',name:'6-photo shoot',credits:6,price_minor:69900},{code:'baby_10',name:'10-photo shoot',credits:10,price_minor:109900},{code:'baby_15',name:'15-photo shoot',credits:15,price_minor:149900}];
  $('#sheet-prices .plist').innerHTML=rows.map(p=>`<div class="prow"><span><b>${esc(p.name)}</b><span>${p.credits===1?(S.freeLeft?'Your first one is free':''):'₹'+Math.round(p.price_minor/100/p.credits)+' a photo'}</span></span><span class="p">${rupee(p.price_minor/100)}</span></div>`).join('')}
const dateOf=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
function renderHistory(){const h=$('#hist');
  if(!S.orders.length){h.innerHTML=`<p class="muted" style="font-size:15px">No payments yet.${S.freeLeft?' Your first photo is free, so it won\'t show here.':''}</p>`;return}
  h.innerHTML=`<div class="plist">${S.orders.map(x=>`<div class="prow"><span><b>${esc(x.name||x.credits+' photos')}</b><span>${dateOf(x.paidAt)}, ${timeOf(x.paidAt)}</span></span><span style="display:flex;flex-direction:column;align-items:flex-end"><span class="p">${rupee(x.total/100)}</span>${x.invoiceId?`<button class="inv" data-inv="${x.invoiceId}">Invoice</button>`:''}</span></div>`).join('')}</div><p class="fine" style="margin-top:12px">Each invoice shows the GST included in the price.</p>`;
  h.querySelectorAll('[data-inv]').forEach(b=>b.onclick=async()=>{const w=window.open('','_blank');try{const t=await token();const r=await fetch('/api/b/invoice/'+b.dataset.inv,{headers:{'Authorization':'Bearer '+t}});if(!r.ok)throw 0;const u=URL.createObjectURL(new Blob([await r.text()],{type:'text/html'}));if(w)w.location.href=u;else location.href=u}catch(e){w&&w.close();toast("Couldn't open the invoice. Try again.")}})}
function applyTheme(){const r=document.documentElement;if(S.prefs.theme==='auto')r.removeAttribute('data-theme');else r.setAttribute('data-theme',S.prefs.theme||'light')}
function savePrefs(){api('/api/b/me',{body:{prefs:{shape:S.prefs.shape,theme:S.prefs.theme,notify:!!S.prefs.notify,keep:!!S.prefs.keep}}}).catch(()=>{})}
function miniSeg(el,opts,key,after){el.innerHTML='';opts.forEach(([v,l])=>{const b=document.createElement('button');b.textContent=l;b.setAttribute('aria-pressed',String(S.prefs[key]===v));b.onclick=()=>{S.prefs[key]=v;$$('#'+el.id+' button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));savePrefs();after&&after(v)};el.append(b)})}
function renderPrefs(){miniSeg($('#pref-shape'),[['4:5','Post'],['1:1','Square'],['9:16','Story']],'shape',v=>toast(`New shoots start as ${SHAPE_NAME[v]}`));miniSeg($('#pref-theme'),[['light','Light'],['dark','Dark'],['auto','Phone']],'theme',applyTheme)}
renderPrefs();applyTheme();
$$('.row[role="switch"]').forEach(b=>b.onclick=()=>{const on=b.getAttribute('aria-checked')!=='true';if(on&&b.dataset.pref==='notify'){try{window.Notification&&Notification.requestPermission&&Notification.requestPermission().catch(()=>{})}catch(e){}}b.setAttribute('aria-checked',String(on));S.prefs[b.dataset.pref]=on;savePrefs();sync();toast(b.dataset[on?'on':'off'])});
$('#you-dl').onclick=()=>{const all=S.shoots.flatMap(doneOf);if(!all.length){toast('No photos yet. Make one in Studio');return}savePhotos(all)};
$('#you-del').onclick=()=>ask({title:'Delete your account?',body:"This erases your baby's photos, every shoot and your details. Invoices are kept for tax records, as the law requires. This can't be undone.",yes:'Delete',no:'Keep it',danger:true,onYes:async()=>{
  try{await api('/api/b/account',{method:'DELETE'})}catch(e){toast(e.message);return}
  try{await S.sb.auth.signOut({scope:'local'})}catch(e){}S.pick=null;S.mix=[];S.baby={name:'',age:''};signedOut();toast('Your account has been deleted')}});
$('#you-edit').onclick=()=>openBaby('you');
$('#you-out').onclick=async()=>{try{await S.sb.auth.signOut()}catch(e){}signedOut()};
$$('[data-go="baby"]').forEach(b=>{b.removeAttribute('data-go');b.addEventListener('click',()=>openBaby('studio'))});
document.addEventListener('click',e=>{const b=e.target.closest('[data-doc]');if(!b)return;location.assign('/'+({terms:'terms',privacy:'privacy',refund:'refunds'}[b.dataset.doc]||'terms'))});
function applyBusiness(){const b=S.cfg?.business||{};const wa=b.whatsapp,em=b.email;
  $('#help-wa-l').textContent=wa?'Message us on WhatsApp':'Contact us';
  $('#help-wa').onclick=()=>{if(wa)window.open(`https://wa.me/${wa}?text=${encodeURIComponent('Hi Baby Shoot, ')}`,'_blank');else location.assign('/contact')};
  const bl=$('#biz-line');if(bl)bl.textContent=b.legalName||'Contact and address';
  const help=$('#help-wa')?.querySelector('.lbl span');if(help&&!wa&&em)help.textContent=em}

/* ---------- confirm ---------- */
let onYes=null;
function ask(o){$('#cf-h').textContent=o.title;$('#cf-p').textContent=o.body;$('#cf-yes').textContent=o.yes;$('#cf-yes').className='btn '+(o.danger?'danger':'main');$('#cf-no').textContent=o.no||'Cancel';onYes=o.onYes;closeSheets('swap');openSheet('confirm')}
$('#cf-yes').onclick=()=>{const f=onYes;onYes=null;closeSheets();f&&f()};

function toast(m){const scr=$$('.screen').find(s=>!s.hidden);const base=$('.sheet.on')||(scr&&(scr.querySelector('.r-panel')||scr.querySelector('.dock')||scr.querySelector('.w-body')));$('#app').style.setProperty('--toast-b',((base?base.offsetHeight:40)+12)+'px');const x=$('#toast');x.textContent=m;x.classList.add('on');clearTimeout(window.__t);window.__t=setTimeout(()=>x.classList.remove('on'),2600)}

/* ---------- routing ---------- */
const H=[];let cur=null;
function hpush(e){H.push(e);try{history.pushState({d:H.length-1},'',e.t==='screen'?'#'+e.id:location.hash)}catch(x){}}
function show(id,o={}){$('#toast').classList.remove('on');$$('.screen').forEach(s=>s.hidden=s.id!==id);
  if(o.replace&&H.length){H[H.length-1]={t:'screen',id};try{history.replaceState({d:H.length-1},'','#'+id)}catch(x){}}
  else if(!o.back&&id!==cur){if(!H.length){H.push({t:'screen',id});try{history.replaceState({d:0},'','#'+id)}catch(x){}}else{if(o.root)H.forEach(e=>e.dead=true);hpush({t:'screen',id})}}
  cur=id;if(id==='studio'){sync();syncDock()}if(id==='shoots')renderShoots();if(id==='you')sync();if(id==='result')requestAnimationFrame(fitFrame)}
addEventListener('popstate',e=>{const d=e.state&&e.state.d;if(d==null)return;
  while(H.length-1>d){const x=H.pop();if(x.t==='sheet'&&!x.dead)closeSheets('pop')}
  const top=H[H.length-1];if(top&&top.dead&&H.length>1){history.back();return}
  if($('.sheet.on')&&!(top&&top.t==='sheet'))closeSheets('pop');
  if(busy)return;
  if(!H.some(x=>x.t==='screen'&&!x.dead)){H[H.length-1]={t:'screen',id:cur};try{history.replaceState({d:H.length-1},'','#'+cur)}catch(x){}return}
  for(let i=H.length-1;i>=0;i--){if(H[i].t==='screen'&&!H[i].dead){if(H[i].id!==cur)show(H[i].id,{back:true});break}}});
document.addEventListener('click',e=>{const g=e.target.closest('[data-go]');if(g){closeSheets();show(g.dataset.go)}const t=e.target.closest('[data-toast]');if(t)toast(t.dataset.toast)});
const net=()=>{$('#offline').hidden=navigator.onLine!==false};addEventListener('online',net);addEventListener('offline',net);net();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.me)refreshMe()});
$('#offline').textContent="You're offline. Your shoot keeps going and will be here when you're back.";
$('#set-count').textContent=THEMES.length;renderChips();renderGrid();renderCounts();
boot();
