"use strict";
const e = React.createElement;
const {useState, useMemo, useEffect, useRef} = React;

// Safe localStorage wrappers — iOS private browsing throws SecurityError on any localStorage access
const safeLS=(key,fb='')=>{try{const v=localStorage.getItem(key);return v!==null?v:fb;}catch(ex){return fb;}};
const safeLSSet=(key,val)=>{try{localStorage.setItem(key,val);}catch(ex){}};

// Local date string (YYYY-MM-DD) using device timezone — avoids UTC midnight rollover bug
function localDateStr(ts=Date.now()){const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// Streak milestone check — [3,7,14] + every 30 days + 365
function isStreakMilestone(n){return [3,7,14].includes(n)||(n>0&&n%30===0)||n===365;}

// ── Capacitor Local Notifications ─────────────────────────────────────
// All calls are silent no-ops in the browser (Capacitor bridge not present).
// In the native iOS/Android app, schedules a daily 7 pm reminder that
// automatically reschedules each time the user practices.
const Notif=(()=>{
  const ID=42;           // stable notification ID — always cancel/replace this slot
  const CH='jgl_streak'; // Android channel (ignored on iOS)
  function plug(){return window?.Capacitor?.Plugins?.LocalNotifications||null;}
  async function requestPermission(){
    const P=plug();if(!P)return false;
    try{const{display}=await P.requestPermissions();return display==='granted';}catch(ex){return false;}
  }
  async function schedule(streak){
    const P=plug();if(!P)return;
    try{
      // Android channel creation (no-op on iOS)
      await P.createChannel?.({id:CH,name:'Practice reminders',importance:3});
      // Replace any existing reminder
      await P.cancel({notifications:[{id:ID}]});
      // Fire at 7 pm today; if already past 7 pm, fire tomorrow
      const at=new Date();at.setHours(19,0,0,0);
      if(at<=new Date())at.setDate(at.getDate()+1);
      const body=streak>0?`${streak}-day streak — practice today to keep it going`:'Your daily jazz practice is waiting';
      await P.schedule({notifications:[{id:ID,title:'🎸 Jazz Guitar Lab',body,
        schedule:{at,allowWhileIdle:true},channelId:CH}]});
    }catch(ex){}
  }
  async function cancel(){
    const P=plug();if(!P)return;
    try{await P.cancel({notifications:[{id:ID}]});}catch(ex){}
  }
  return{requestPermission,schedule,cancel};
})();

// ── Tuning ───────────────────────────────────────────────────────────
const OPEN_MIDI=[40,45,50,55,59,64];
const OPEN_PC  =[4, 9, 2, 7,11, 4];
const STR_NAMES=['E','A','D','G','B','e'];

const KEYS=[
  {root:0,name:'C'},{root:1,name:'Db'},{root:2,name:'D'},{root:3,name:'Eb'},
  {root:4,name:'E'},{root:5,name:'F'},{root:6,name:'F#'},{root:7,name:'G'},
  {root:8,name:'Ab'},{root:9,name:'A'},{root:10,name:'Bb'},{root:11,name:'B'},
];
const FLAT_KEYS=new Set([1,3,5,8,10]);
const N_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const N_FLAT =['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const nn=(pc,k)=>(FLAT_KEYS.has(k)?N_FLAT:N_SHARP)[((pc%12)+12)%12];

// ── Chord theory ─────────────────────────────────────────────────────
const MAJOR_SCALE=[0,2,4,5,7,9,11];
const QTYPES=['maj7','m7','m7','maj7','dom7','m7','m7b5'];
const QSYMS =['△7','m7','m7','△7','7','m7','m7b5']; // △ = major 7th (standard jazz notation)
const ROMAN =['I','ii','iii','IV','V','vi','vii'];
const INTERVALS={maj7:[0,4,7,11],m7:[0,3,7,10],dom7:[0,4,7,10],m7b5:[0,3,6,10]};

// FIX: maj7's 7th was 'd7' (diminished 7) — corrected to 'Δ7' (major 7)
const DNAMES={
  maj7:['R','3','5','Δ7'], m7:['R','b3','5','b7'],
  dom7:['R','3','5','b7'], m7b5:['R','b3','b5','b7']
};
const RL_DNAMES={
  maj7:['9','3','5','Δ7'], m7:['9','b3','5','b7'],
  dom7:['9','3','5','b7'], m7b5:['9','b3','b5','b7']
};

// ── Extended / standalone chord types ────────────────────────────────
const EXT_TYPES=[
  {id:'maj7', sym:'△7',   label:'Major 7',  iv:[0,4,7,11], dn:['R','3','5','Δ7'],  ctx:'I and IV in major keys — lush, stable home sound'},
  {id:'m7',   sym:'m7',   label:'Minor 7',  iv:[0,3,7,10], dn:['R','b3','5','b7'], ctx:'ii, iii, vi in major keys — smooth, floating quality'},
  {id:'dom7', sym:'7',    label:'Dom 7',    iv:[0,4,7,10], dn:['R','3','5','b7'],  ctx:'V in any key — tritone tension that pulls to I'},
  {id:'m7b5', sym:'ø7',   label:'Half-Dim', iv:[0,3,6,10], dn:['R','b3','b5','b7'],ctx:'ii in minor keys, vii in major — searching and tense'},
  {id:'maj9', sym:'△9',   label:'Major 9',  iv:[0,4,11,2], dn:['R','3','Δ7','9'],  ctx:'Richer I or IV — 9th adds open, luminous color above the Δ7'},
  {id:'m9',   sym:'m9',   label:'Minor 9',  iv:[0,3,10,2], dn:['R','b3','b7','9'], ctx:'Warmer IIm or VIm — natural 9th softens the b3'},
  {id:'dom9', sym:'9',    label:'Dom 9',    iv:[0,4,10,2], dn:['R','3','b7','9'],  ctx:'V7 with natural 9 — full dominant sound, less tension than altered'},
  {id:'7alt', sym:'7alt', label:'Altered',  iv:[0,4,10,3], dn:['R','3','b7','#9'], ctx:'All tensions altered (b9 #9 b5 #5) — maximum pull on V7'},
  {id:'7b9',  sym:'7♭9',  label:'7♭9',     iv:[0,4,10,1], dn:['R','3','b7','b9'], ctx:'b9 creates diminished/Spanish sound — strong tension on V7'},
  {id:'9sus', sym:'9sus4',label:'9sus4',    iv:[0,5,10,2], dn:['R','4','b7','9'],  ctx:'No 3rd — suspended, floating; resolves when 4 drops to 3'},
];

// Extension options per EXT_TYPES index — each replaces the 5th (interval slot 2)
// with a colour tone. Available only for the four base 7th-chord types (idx 0-3).
const CHORD_EXTS={
  0:[{id:'9',  sym:'9',   tone:2, dn:'9'},  {id:'s11',sym:'#11', tone:6, dn:'#11'},{id:'13',sym:'13',tone:9,dn:'13'}],  // maj7
  1:[{id:'9',  sym:'9',   tone:2, dn:'9'},  {id:'11', sym:'11',  tone:5, dn:'11'}],                                      // m7
  2:[{id:'9',  sym:'9',   tone:2, dn:'9'},  {id:'b9', sym:'b9',  tone:1, dn:'b9'},{id:'s9',sym:'#9',tone:3,dn:'#9'},
     {id:'s11',sym:'#11', tone:6, dn:'#11'},{id:'13', sym:'13',  tone:9, dn:'13'}],                                      // dom7
  3:[{id:'9',  sym:'nat9',tone:2, dn:'9'}],                                                                               // ø7
};
// Chord types that support rootless voicings (root replaced by 9th)
const ROOTLESS_OK=new Set(['maj7','m7','dom7']);

// ── Chord detection ──────────────────────────────────────────────────
const DETECT_SHAPES=[
  {sym:'',      name:'major',    iv:[0,4,7]},
  {sym:'m',     name:'minor',    iv:[0,3,7]},
  {sym:'°',     name:'dim',      iv:[0,3,6]},
  {sym:'+',     name:'aug',      iv:[0,4,8]},
  {sym:'sus2',  name:'sus2',     iv:[0,2,7]},
  {sym:'sus4',  name:'sus4',     iv:[0,5,7]},
  {sym:'6',     name:'major 6',  iv:[0,4,7,9]},
  {sym:'m6',    name:'minor 6',  iv:[0,3,7,9]},
  {sym:'△7',    name:'major 7',  iv:[0,4,7,11]},
  {sym:'m7',    name:'minor 7',  iv:[0,3,7,10]},
  {sym:'7',     name:'dom 7',    iv:[0,4,7,10]},
  {sym:'ø7',    name:'half-dim', iv:[0,3,6,10]},
  {sym:'°7',    name:'dim 7',    iv:[0,3,6,9]},
  {sym:'△9',    name:'major 9',  iv:[0,2,4,7,11]},
  {sym:'m9',    name:'minor 9',  iv:[0,2,3,7,10]},
  {sym:'9',     name:'dom 9',    iv:[0,2,4,7,10]},
  {sym:'m△7',   name:'min/maj7', iv:[0,3,7,11]},
];
function detectChords(pitchClasses){
  const pcs=[...new Set(pitchClasses)];
  if(pcs.length<2) return [];
  const results=[];
  for(let root=0;root<12;root++){
    const norm=pcs.map(p=>(p-root+12)%12).sort((a,b)=>a-b);
    const normStr=norm.join(',');
    for(const sh of DETECT_SHAPES){
      const shNorm=[...sh.iv].sort((a,b)=>a-b);
      if(normStr===shNorm.join(','))
        results.push({root,sym:sh.sym,name:nn(root,root)+sh.sym,quality:sh.name,exact:true,iv:sh.iv});
    }
    // Subset: user's notes are all contained in a known chord shape
    if(pcs.length>=2&&pcs.length<5){
      for(const sh of DETECT_SHAPES){
        const shSet=new Set(sh.iv);
        if(norm.every(n=>shSet.has(n))&&norm.length<sh.iv.length)
          results.push({root,sym:sh.sym,name:nn(root,root)+sh.sym,quality:sh.name,exact:false,matched:norm.length,total:sh.iv.length,iv:sh.iv});
      }
    }
  }
  results.sort((a,b)=>a.exact===b.exact?0:a.exact?-1:1);
  // Deduplicate by name
  const seen=new Set();
  return results.filter(r=>{if(seen.has(r.name))return false;seen.add(r.name);return true;}).slice(0,6);
}

// Interval names by semitone distance (0..12) — for 2-note identification.
const INTERVAL_NAMES=['Unison','Minor 2nd','Major 2nd','Minor 3rd','Major 3rd','Perfect 4th','Tritone','Perfect 5th','Minor 6th','Major 6th','Minor 7th','Major 7th','Octave'];
// Ordinal inversion names, keyed by the bass note's position in the (sorted) chord shape.
const INV_ORD=['Root position','1st inversion','2nd inversion','3rd inversion','4th inversion'];
// Detected-chord symbols that have a Build-page (Chords) equivalent → EXT_TYPES index.
const DETECT_TO_EXT={'△7':0,'m7':1,'7':2,'ø7':3,'△9':4,'m9':5,'9':6};

// ── Chord-scale data ─────────────────────────────────────────────────
const PARENT_SC={major:[0,2,4,5,7,9,11],melmin:[0,2,3,5,7,9,11]};
const PTYPE_NAME={major:'Major',melmin:'Mel. Minor',dim:'Diminished',wt:'Whole Tone'};
// FIX: index 11 = 11 semitones = major 7th; was 'd7' (diminished 7), now 'Δ7'
const INT_NAMES=['R','b9','2','b3','3','4','#11','5','b13','6','b7','Δ7'];

const CHORD_SCALES=[
  [{name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,avoid:[5], desc:'Home — fully inside the key'},
   {name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,avoid:[],  desc:'#11 — floating, bright color'}],
  [{name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,avoid:[],  desc:'Standard — nat. 6, fully inside'}],
  [{name:'Phrygian', abbr:'Phr',   iv:[0,1,3,5,7,8,10],pType:'major', mPos:2,avoid:[1], desc:'Diatonic — dark b2 tension'},
   {name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,avoid:[],  desc:'Brighter — avoids b2'}],
  [{name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,avoid:[],  desc:'Natural — #11 defines the sound'},
   {name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,avoid:[5], desc:'Inside — IV as local tonic'},
   {name:'Lyd.Aug.', abbr:'LydAug',iv:[0,2,4,6,8,9,11],pType:'melmin',mPos:2,avoid:[],  desc:'#5+#11 — dreamy quality'}],
  [{name:'Mixolydian',abbr:'Mix',  iv:[0,2,4,5,7,9,10],  pType:'major', mPos:4,avoid:[5],desc:'Standard — natural tensions'},
   {name:'Altered',  abbr:'Alt',   iv:[0,1,3,4,6,8,10],  pType:'melmin',mPos:6,avoid:[],  desc:'All tensions altered — max pull'},
   {name:'Lyd.Dom.', abbr:'LydDom',iv:[0,2,4,6,7,9,10],  pType:'melmin',mPos:3,avoid:[],  desc:'#11 — bright dominant color'},
   {name:'HW Dim.',  abbr:'HWDim', iv:[0,1,3,4,6,7,9,10],pType:'dim',   mPos:0,avoid:[],  desc:'8-note: b9 #9 #11 nat.13'},
   {name:'Whole Tone',abbr:'W.T.', iv:[0,2,4,6,8,10],    pType:'wt',    mPos:0,avoid:[],  desc:'6-note: #5 and #11'}],
  [{name:'Aeolian',  abbr:'Aeo',   iv:[0,2,3,5,7,8,10],pType:'major', mPos:5,avoid:[8],  desc:'Natural minor — fully diatonic'},
   {name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,avoid:[],   desc:'nat.6 brightens — outside key'}],
  [{name:'Locrian',  abbr:'Loc',   iv:[0,1,3,5,6,8,10],pType:'major', mPos:6,avoid:[1],  desc:'Diatonic — b2 b5 b6'},
   {name:'Loc.nat.2',abbr:'Loc2',  iv:[0,2,3,5,6,8,10],pType:'melmin',mPos:5,avoid:[],   desc:'nat.2 softens harshest interval'}],
];

function getParentRoot(chordRoot,pType,mPos){
  const sc=PARENT_SC[pType]; if(!sc) return chordRoot;
  return(chordRoot-sc[mPos]+120)%12;
}

// ── Colors ──────────────────────────────────────────────────────────
const TC    =['#FF6B6B','#4ECDC4','#74C0FC','#FFD43B'];
const TC_DIM=['#FF6B6B55','#4ECDC455','#74C0FC55','#FFD43B55'];
const TC_RIM=['#FF6B6B99','#4ECDC499','#74C0FC99','#FFD43B99'];
const TC_RL =['#C084FC','#4ECDC4','#74C0FC','#FFD43B'];
const BG     ='var(--bg)';
const BG2    ='var(--bg2)';
const BORDER ='var(--brd)';
const LBL    ='var(--lbl)';
const HINT   ='var(--hint)';
const BTN_OFF='var(--btn-off)';
const BTN_BRD='var(--btn-brd)';
const GOLD   ='var(--gold)';
const ACT_GOLD='var(--act-gold)';
const ACT_RED ='var(--act-red)';
const ACT_TEAL='var(--act-teal)';
const ACT_BLUE='var(--act-blue)';
const ACT_PUR ='var(--act-pur)';
const ACT_YEL ='var(--act-yel)';
const UI_FONT  ="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
const SERIF ="Georgia,'Times New Roman',serif";
const APP_VERSION='1.0.0';
const SUPPORT_URL='https://pablohoney1977.github.io/jazz-guitar-app/docs/support.html';

// ── Voicing tables ───────────────────────────────────────────────────
const D2_INV=[
  {label:'Root',bassIdx:2,a:[2,0,1,3]},{label:'1st',bassIdx:3,a:[3,1,2,0]},
  {label:'2nd', bassIdx:0,a:[0,2,3,1]},{label:'3rd',bassIdx:1,a:[1,3,0,2]},
];
const D2_SETS=[
  {lbl:'6-5-4-3',s:[0,1,2,3]},{lbl:'5-4-3-2',s:[1,2,3,4]},{lbl:'4-3-2-1',s:[2,3,4,5]}
];
const D3_INV=[
  {label:'Root',bassIdx:1,a:[1,0,2,3]},{label:'1st',bassIdx:2,a:[2,1,3,0]},
  {label:'2nd', bassIdx:3,a:[3,2,0,1]},{label:'3rd',bassIdx:0,a:[0,3,1,2]},
];
const D3_SETS=[{lbl:'6-4-3-2',s:[0,2,3,4]},{lbl:'5-3-2-1',s:[1,3,4,5]}];
// Shells are root-position guide-tone voicings (R+3+7). The 3-R-7 / 7-R-3
// rotations were removed: with the root above the bass they force a 9th
// spread — a 5-fret window that isn't physically playable in low positions.
const SHELLS=[
  {lbl:'R-7-3',form:'A',root:'6th',s:[0,2,3],a:[0,3,1],bassIdx:0},
  {lbl:'R-7-3',form:'A',root:'5th',s:[1,3,4],a:[0,3,1],bassIdx:0},
  {lbl:'R-3-7',form:'B',root:'6th',s:[0,1,2],a:[0,1,3],bassIdx:0},
  {lbl:'R-3-7',form:'B',root:'5th',s:[1,2,3],a:[0,1,3],bassIdx:0},
];
const ROOTLESS=[
  {lbl:'3-5-7-9',type:'A',strs:'5-4-3-2',s:[1,2,3,4],a:[1,2,3,0],bassIdx:1},
  {lbl:'3-5-7-9',type:'A',strs:'4-3-2-1',s:[2,3,4,5],a:[1,2,3,0],bassIdx:1},
  {lbl:'7-9-3-5',type:'B',strs:'5-4-3-2',s:[1,2,3,4],a:[3,0,1,2],bassIdx:3},
  {lbl:'7-9-3-5',type:'B',strs:'4-3-2-1',s:[2,3,4,5],a:[3,0,1,2],bassIdx:3},
];
// Drop 2+4: drop voices 2 and 4 from top. Low→high: R-5-3-7 / 3-7-5-R / 5-R-7-3 / 7-3-R-5
// Skips one string in the middle (string sets 6-5-3-2 and 5-4-2-1)
const D24_INV=[
  {bassIdx:0,a:[0,2,1,3]},{bassIdx:1,a:[1,3,2,0]},
  {bassIdx:2,a:[2,0,3,1]},{bassIdx:3,a:[3,1,0,2]},
];
const D24_SETS=[{lbl:'6-5-3-2',s:[0,1,3,4]},{lbl:'5-4-2-1',s:[1,2,4,5]}];
// Drop 2+3: drop voices 2 and 3 from top. Low→high: 3-5-R-7 / 5-7-3-R / 7-R-5-3 / R-3-7-5
// Skips one string on the high side (string sets 6-5-4-2 and 5-4-3-1)
const D23_INV=[
  {bassIdx:1,a:[1,2,0,3]},{bassIdx:2,a:[2,3,1,0]},
  {bassIdx:3,a:[3,0,2,1]},{bassIdx:0,a:[0,1,3,2]},
];
const D23_SETS=[{lbl:'6-5-4-2',s:[0,1,2,4]},{lbl:'5-4-3-1',s:[1,2,3,5]}];

const DROP_DATA={drop2:{inv:D2_INV,sets:D2_SETS},drop3:{inv:D3_INV,sets:D3_SETS},
  drop24:{inv:D24_INV,sets:D24_SETS},drop23:{inv:D23_INV,sets:D23_SETS}};
const EQ_FREQS=[80,250,800,2500,8000];
const EQ_LABELS=['80','250','800','2.5k','8k'];
const EQ_TYPES=['lowshelf','peaking','peaking','peaking','highshelf'];
const DROP_TYPES=new Set(['drop2','drop3','drop24','drop23']);
const DROP_LBL={drop2:'DROP 2',drop3:'DROP 3',drop24:'DROP 2+4',drop23:'DROP 2+3'};

// ── Engine ───────────────────────────────────────────────────────────
const getChordTones=(root,q)=>INTERVALS[q].map(i=>(root+i)%12);
const getExtTones=(root,extType)=>extType.iv.map(i=>(root+i)%12);
const getRootlessTones=(root,q)=>{const t=getChordTones(root,q);return[(root+2)%12,t[1],t[2],t[3]];};

const noteForDot=(mode,degName,pc,keyIdx)=>{
  const note=nn(pc,keyIdx);
  if(mode==='note') return note;
  if(mode==='both') return note+(degName?'/'+degName:'');
  return degName; // interval + finger both show interval name (finger overrides in ChordBox/NeckSVG)
};
// A 4-fret span only works from the 5th fret up, where the frets are narrow enough.
// Anything wider is rejected and the shape is retried an octave higher.
function spanOK(frets){
  const mn=Math.min(...frets),mx=Math.max(...frets),span=mx-mn;
  return span<=3||(span===4&&mn>=5);
}

function calcVoicing(strings,assignment,tones,minFret){
  minFret=minFret===undefined?0:minFret;
  const bs=strings[0],bpc=tones[assignment[0]];
  let bf=((bpc-OPEN_PC[bs])+12)%12;
  while(bf<minFret) bf+=12;
  for(let att=0;att<4;att++){
    const b=bf+att*12; if(b>17) break;
    const frets=[b],midis=[OPEN_MIDI[bs]+b]; let ok=true;
    for(let i=1;i<strings.length;i++){
      const pc=tones[assignment[i]],s=strings[i];
      let off=((pc-OPEN_PC[s])+12)%12,m=OPEN_MIDI[s]+off;
      while(off<minFret){off+=12;m=OPEN_MIDI[s]+off;}
      while(m<=midis[i-1]){off+=12;m=OPEN_MIDI[s]+off;}
      if(off>19){ok=false;break;}
      frets.push(off);midis.push(m);
    }
    if(!ok) continue;
    if(spanOK(frets)){
      const mn=Math.min(...frets),mx=Math.max(...frets);
      if(mn>12||mx>15){
        const lf=frets.map(f=>f-12);
        if(Math.min(...lf)>=minFret&&spanOK(lf)){
          return{frets:lf,midis:midis.map(m=>m-12),mn:mn-12,mx:mx-12};
        }
        // The neck diagram only draws 15 frets. If the shape would otherwise
        // land off the right edge, drop it an octave anyway (it stays on the
        // board and span is preserved) even when that dips to an open string
        // or a low-position stretch spanOK would normally reject.
        if(mx>15&&Math.min(...lf)>=0){
          return{frets:lf,midis:midis.map(m=>m-12),mn:mn-12,mx:mx-12};
        }
      }
      return{frets,midis,mn,mx};
    }
  }
  return null;
}

function getArpPos(tones){
  const out=[];
  for(let s=0;s<6;s++)
    for(let f=0;f<=15;f++){
      const ti=tones.indexOf((OPEN_PC[s]+f)%12);
      if(ti>=0) out.push({s,f,ti});
    }
  return out;
}

function getScalePos(rootPC,scaleIv,chordTones){
  const out=[];
  for(let s=0;s<6;s++)
    for(let f=0;f<=15;f++){
      const pc=(OPEN_PC[s]+f)%12;
      const interval=(pc-rootPC+12)%12;
      if(scaleIv.indexOf(interval)>=0 && chordTones.indexOf(pc)<0)
        out.push({s,f,interval});
    }
  return out;
}

function findBestInvIdx(prevVoicing,candidates){
  if(!prevVoicing) return 0;
  let best=0,bestScore=Infinity;
  candidates.forEach((v,i)=>{
    if(!v) return;
    // Compare by MIDI pitch so voice leading works across all voicing types including shells
    const len=Math.min(v.midis.length,prevVoicing.midis.length);
    const score=v.midis.slice(0,len).reduce((sum,m,j)=>sum+Math.abs(m-prevVoicing.midis[j]),0);
    if(score<bestScore){bestScore=score;best=i;}
  });
  return best;
}

function makeClickBuf(ctx,freq,vol){
  const sr=ctx.sampleRate;
  const len=Math.round(sr*0.04);
  const buf=ctx.createBuffer(1,len,sr);
  const d=buf.getChannelData(0);
  for(let i=0;i<len;i++){
    const t=i/sr;
    d[i]=vol*Math.exp(-t*200)*Math.sin(2*Math.PI*freq*t);
  }
  return buf;
}

function playClick(ctx,buf,startTime){
  const src=ctx.createBufferSource();
  src.buffer=buf;
  const g=ctx.createGain();g.gain.value=1;
  src.connect(g);g.connect(ctx.destination);
  src.start(startTime);
  src.stop(startTime+buf.duration+0.05);
}

// Sync fallback ride (used if async render not yet ready)
function makeRideBuf(ctx,vol,accent){
  const sr=ctx.sampleRate,dur=accent?0.35:0.18;
  const len=Math.round(sr*dur),buf=ctx.createBuffer(1,len,sr);
  const d=buf.getChannelData(0);
  const freqs=[4200,5600,7800,9100,11200];
  for(let i=0;i<len;i++){
    const t=i/sr,env=vol*Math.exp(-t*(accent?12:28));
    let s=0;freqs.forEach(f=>s+=Math.sin(2*Math.PI*f*t+Math.random()*0.3));
    d[i]=env*(s/freqs.length*0.3+(Math.random()*2-1)*0.7);
  }
  return buf;
}
// High-quality ride using OfflineAudioContext + real filter nodes.
// 4 independent frequency-decay chains approximate how a physical cymbal's
// inharmonic modes ring at different rates.
async function makeRideBufAsync(sr,vol,accent){
  const dur=accent?0.9:0.55;
  const offCtx=new OfflineAudioContext(1,Math.round(sr*dur),sr);
  const noiseLen=Math.round(sr*dur);
  const noiseBuf=offCtx.createBuffer(1,noiseLen,sr);
  const nd=noiseBuf.getChannelData(0);
  for(let i=0;i<noiseLen;i++) nd[i]=Math.random()*2-1;
  function mkNoise(){const s=offCtx.createBufferSource();s.buffer=noiseBuf;return s;}
  // Chain 1 — attack transient: broadband, very fast decay (~18ms)
  const s1=mkNoise(),f1=offCtx.createBiquadFilter(),g1=offCtx.createGain();
  f1.type='highpass';f1.frequency.value=9000;f1.Q.value=0.5;
  g1.gain.setValueAtTime(vol*0.55,0);g1.gain.exponentialRampToValueAtTime(0.0001,0.018);
  s1.connect(f1);f1.connect(g1);g1.connect(offCtx.destination);s1.start(0);
  // Chain 2 — body shimmer: bandpass ~4kHz, medium decay
  const s2=mkNoise(),f2=offCtx.createBiquadFilter(),g2=offCtx.createGain();
  f2.type='bandpass';f2.frequency.value=4200;f2.Q.value=2.0;
  g2.gain.setValueAtTime(vol*0.65,0);
  g2.gain.exponentialRampToValueAtTime(0.0001,accent?0.42:0.20);
  s2.connect(f2);f2.connect(g2);g2.connect(offCtx.destination);s2.start(0);
  // Chain 3 — air / ring: highpass ~6.5kHz, slowest decay
  const s3=mkNoise(),f3=offCtx.createBiquadFilter(),g3=offCtx.createGain();
  f3.type='highpass';f3.frequency.value=6500;f3.Q.value=1.0;
  g3.gain.setValueAtTime(vol*0.38,0);
  g3.gain.exponentialRampToValueAtTime(0.0001,accent?0.80:0.42);
  s3.connect(f3);f3.connect(g3);g3.connect(offCtx.destination);s3.start(0);
  // Chain 4 — low metallic ping: high-Q bandpass at ~750Hz (bell-like resonance)
  const s4=mkNoise(),f4=offCtx.createBiquadFilter(),g4=offCtx.createGain();
  f4.type='bandpass';f4.frequency.value=750;f4.Q.value=14;
  g4.gain.setValueAtTime(vol*0.45,0);
  g4.gain.exponentialRampToValueAtTime(0.0001,accent?0.24:0.11);
  s4.connect(f4);f4.connect(g4);g4.connect(offCtx.destination);s4.start(0);
  return offCtx.startRendering();
}
function playRide(ctx,buf,startTime,eqGains,vol){
  if(!buf) return;
  const src=ctx.createBufferSource();
  src.buffer=buf;
  const g=ctx.createGain();g.gain.value=0.42*(vol||1);
  src.connect(g);
  if(eqGains&&eqGains.some(v=>v!==0)){
    const eq=EQ_FREQS.map((fr,i)=>{const f=ctx.createBiquadFilter();f.type=EQ_TYPES[i];f.frequency.value=fr;f.Q.value=1.2;f.gain.value=eqGains[i]||0;return f;});
    g.connect(eq[0]);eq.reduce((a,b)=>{a.connect(b);return b;});eq[4].connect(ctx.destination);
  } else {
    g.connect(ctx.destination);
  }
  src.start(startTime);
  src.stop(startTime+buf.duration+0.1); // release the node when done
}

// KS synthesis — kept as fast fallback while guitar samples load
function precomputeKS(ctx){
  const sr=ctx.sampleRate,bufs={};
  for(let pc=0;pc<12;pc++){
    const freq=440*Math.pow(2,(48+pc-69)/12);
    const N=Math.round(sr/freq),len=Math.round(sr*2.5);
    const buf=ctx.createBuffer(1,len,sr);
    const d=buf.getChannelData(0);
    const ring=new Float32Array(N);
    for(let i=0;i<N;i++) ring[i]=Math.random()*2-1;
    let pos=0;
    for(let i=0;i<len;i++){
      const next=(pos+1)%N;d[i]=ring[pos];
      ring[pos]=0.996*0.5*(ring[pos]+ring[next]);pos=(pos+1)%N;
    }
    bufs[pc]=buf;
  }
  return bufs;
}

// ── Guitar sample CDN (chord preview + guide + ear training) ─────────
// electric guitar samples every ~2-3 semitones; max pitch-shift ≤2 semitones
const GUITAR_CDN='https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/';
const GUITAR_NOTES={40:'E2.mp3',42:'Fs2.mp3',45:'A2.mp3',48:'C3.mp3',
  52:'E3.mp3',54:'Fs3.mp3',57:'A3.mp3',60:'C4.mp3',
  64:'E4.mp3',66:'Fs4.mp3',69:'A4.mp3',72:'C5.mp3'};
let _previewCtx=null;
let _guitarBufs=null;  // MIDI→AudioBuffer for current ctx
let _guitarRaw=null;   // MIDI→ArrayBuffer raw — survives AudioContext resets
let _guitarLoading=false;
let _ksFallback=null;  // KS bufs for current _previewCtx

function _reDecodeGuitar(ctx){
  if(!_guitarRaw) return;
  Promise.all(Object.entries(_guitarRaw).map(async([midi,arr])=>{
    try{return{midi:+midi,buf:await ctx.decodeAudioData(arr.slice(0))};}
    catch(e){return null;}
  })).then(res=>{const m={};res.forEach(r=>{if(r)m[r.midi]=r.buf;});if(Object.keys(m).length)_guitarBufs=m;});
}
function _loadGuitar(ctx){
  if(_guitarLoading) return;
  _guitarLoading=true;
  Promise.all(Object.entries(GUITAR_NOTES).map(async([midi,file])=>{
    try{const r=await fetch(GUITAR_CDN+file);if(!r.ok)return null;return{midi:+midi,data:await r.arrayBuffer()};}
    catch(e){return null;}
  })).then(res=>{
    const raw={};res.forEach(r=>{if(r)raw[r.midi]=r.data;});
    if(Object.keys(raw).length){_guitarRaw=raw;if(ctx)_reDecodeGuitar(ctx);}
    _guitarLoading=false;
  });
}
// Pre-fetch ArrayBuffers immediately on page load (no AudioContext needed for fetch)
_loadGuitar(null);
// Release the preview AudioContext when the page is hidden to avoid exceeding
// the browser's per-page AudioContext limit and to free OS audio resources.
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden'&&_previewCtx&&_previewCtx.state!=='closed'){
      _previewCtx.close().catch(()=>{});
      _previewCtx=null;_guitarBufs=null;_ksFallback=null;
    }
  });
}

function _getPreviewCtx(){
  try{
    if(!_previewCtx||_previewCtx.state==='closed'){
      _previewCtx=new(window.AudioContext||window.webkitAudioContext)();
      _ksFallback=null;_guitarBufs=null;
      if(_guitarRaw) _reDecodeGuitar(_previewCtx);
    }
    if(_previewCtx.state==='suspended') _previewCtx.resume();
    return _previewCtx;
  }catch(ex){return null;}
}
function _playSampledNote(ctx,midi,startTime,vol,decaySec){
  const notes=Object.keys(_guitarBufs).map(Number);
  const nearest=notes.reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a);
  const src=ctx.createBufferSource();
  src.buffer=_guitarBufs[nearest];
  src.detune.value=(midi-nearest)*100;
  const g=ctx.createGain();
  g.gain.setValueAtTime(vol,startTime);
  g.gain.exponentialRampToValueAtTime(0.001,startTime+decaySec);
  src.connect(g);g.connect(ctx.destination);
  src.start(startTime);src.stop(startTime+decaySec+0.05);
}
function _playKSNote(ctx,midi,startTime,vol){
  if(!_ksFallback) _ksFallback=precomputeKS(ctx);
  const pc=((midi%12)+12)%12;
  const src=ctx.createBufferSource();
  src.buffer=_ksFallback[pc];
  src.playbackRate.value=Math.pow(2,(midi-(48+pc))/12);
  const g=ctx.createGain();
  g.gain.setValueAtTime(vol,startTime);g.gain.exponentialRampToValueAtTime(0.001,startTime+2.0);
  src.connect(g);g.connect(ctx.destination);
  src.start(startTime);src.stop(startTime+2.2);
}
function playChordPreview(voicing,strings){
  if(!voicing) return;
  try{
    const ctx=_getPreviewCtx();if(!ctx) return;
    // Samples fetched but not yet decoded into this context — wait for decode.
    if(!_guitarBufs&&_guitarRaw){setTimeout(()=>playChordPreview(voicing,strings),300);return;}
    strings.forEach((si,i)=>{
      const midi=OPEN_MIDI[si]+voicing.frets[i];
      const t=ctx.currentTime+i*0.028;
      if(_guitarBufs) _playSampledNote(ctx,midi,t,0.65,2.8);
      else _playKSNote(ctx,midi,t,0.55);
    });
  }catch(ex){}
}

// ── DotModeToggle ─────────────────────────────────────────────────────
function DotModeToggle({dotMode,setDotMode}){
  const opts=[{id:'interval',lbl:'Interval'},{id:'note',lbl:'Note'}];
  return e('div',{style:{display:'flex',alignItems:'center',gap:6}},
    e('span',{style:{fontSize:'0.65rem',color:'var(--lbl)',letterSpacing:'0.5px',flexShrink:0}},'Dots'),
    e('div',{style:{display:'flex',border:'1px solid var(--btn-brd)',borderRadius:14,overflow:'hidden'}},
      opts.map(({id,lbl})=>e('button',{key:id,onClick:()=>setDotMode(id),style:{
        padding:'2px 10px',fontFamily:UI_FONT,fontSize:'0.65rem',border:'none',cursor:'pointer',
        background:dotMode===id?'var(--bg)':'transparent',
        color:dotMode===id?'var(--txt)':'var(--btn-off)',fontWeight:dotMode===id?700:400,minHeight:36
      }},lbl))
    )
  );
}

// ── GuitarToggle ──────────────────────────────────────────────────────
// Front view of a Gibson Les Paul 3-way pickup selector: cream "poker chip"
// ring with a chrome nut and a bat-handle lever that flips up (Full) or
// down (Basics). The cream amber tip and poker chip are the iconic LP cues.
function GuitarToggle({level,setLevel}){
  const isBasic=level==='essentials';
  const up=!isBasic;                 // Full = lever thrown up, Basics = down
  const px=36,py=42;                 // pivot (center of the poker chip / nut)
  const tip=up?{x:33,y:14}:{x:39,y:70}; // bat-handle tip travel
  const ACT='#C084FC',OFF='#6a6a7e';
  return e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:1,flexShrink:0}},
    e('span',{style:{fontSize:'0.55rem',color:'var(--lbl)',letterSpacing:'2px',fontFamily:UI_FONT}},'MODE'),
    e('button',{
      onClick:()=>setLevel(isBasic?'pro':'essentials'),
      'aria-label':'Currently '+(isBasic?'Essentials':'Pro')+' — tap to switch',
      title:isBasic?'Switch to Pro: adds Drop 3, Rootless voicings, Altered scale, extended chord types':'Switch to Essentials: simplified view for building fundamentals',
      style:{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:0,touchAction:'manipulation'},
    },
      e('svg',{width:50,height:60,viewBox:'0 0 72 86',style:{display:'block'}},
        e('defs',null,
          e('radialGradient',{id:'lpChip',cx:'38%',cy:'32%',r:'70%'},
            e('stop',{offset:'0%',stopColor:'#f4ecd2'}),
            e('stop',{offset:'62%',stopColor:'#e6d9b2'}),
            e('stop',{offset:'100%',stopColor:'#cdbd8a'}),
          ),
          e('radialGradient',{id:'lpNut',cx:'36%',cy:'30%',r:'72%'},
            e('stop',{offset:'0%',stopColor:'#fbfbff'}),
            e('stop',{offset:'48%',stopColor:'#c9c9d6'}),
            e('stop',{offset:'100%',stopColor:'#8b8b9c'}),
          ),
          e('linearGradient',{id:'lpLever',x1:'0',y1:'0',x2:'1',y2:'0'},
            e('stop',{offset:'0%',stopColor:'#8b8b9a'}),
            e('stop',{offset:'42%',stopColor:'#e8e8f0'}),
            e('stop',{offset:'100%',stopColor:'#7a7a88'}),
          ),
          e('radialGradient',{id:'lpTip',cx:'34%',cy:'30%',r:'68%'},
            e('stop',{offset:'0%',stopColor:'#fbf4d8'}),
            e('stop',{offset:'52%',stopColor:'#e7d39a'}),
            e('stop',{offset:'100%',stopColor:'#bd9f5c'}),
          ),
        ),
        // Position labels (active one lights up purple)
        e('text',{x:36,y:9,textAnchor:'middle',fontFamily:UI_FONT,fontSize:'8',fontWeight:up?'700':'400',
          letterSpacing:'1',fill:up?ACT:OFF},'FULL'),
        e('text',{x:36,y:84,textAnchor:'middle',fontFamily:UI_FONT,fontSize:'8',fontWeight:up?'400':'700',
          letterSpacing:'1',fill:up?OFF:ACT},'BASIC'),
        // Poker chip — drop shadow, cream rim, cream face
        e('circle',{cx:36,cy:45,r:20,fill:'rgba(0,0,0,0.45)'}),
        e('circle',{cx:px,cy:py,r:20,fill:'#bfb086',stroke:'#23232f',strokeWidth:1.2}),
        e('circle',{cx:px,cy:py,r:16.5,fill:'url(#lpChip)'}),
        e('circle',{cx:px,cy:py,r:13,fill:'none',stroke:'rgba(80,60,20,0.18)',strokeWidth:0.8}),
        // Bat-handle lever — metallic shaft + cream amber tip
        e('line',{x1:px,y1:py,x2:tip.x,y2:tip.y,stroke:'#26262f',strokeWidth:9,strokeLinecap:'round'}),
        e('line',{x1:px,y1:py,x2:tip.x,y2:tip.y,stroke:'url(#lpLever)',strokeWidth:6,strokeLinecap:'round'}),
        e('circle',{cx:tip.x,cy:tip.y,r:6.5,fill:'url(#lpTip)',stroke:'#9c8348',strokeWidth:0.9}),
        e('ellipse',{cx:tip.x-2,cy:tip.y-2.3,rx:2.2,ry:1.4,fill:'rgba(255,255,255,0.45)'}),
        // Active glow halo on the thrown tip
        e('circle',{cx:tip.x,cy:tip.y,r:9.5,fill:'none',stroke:ACT,strokeWidth:1.3,opacity:0.32}),
        // Chrome mounting nut at the pivot
        e('circle',{cx:px,cy:py,r:7,fill:'url(#lpNut)',stroke:'#54545f',strokeWidth:0.9}),
        e('circle',{cx:px,cy:py,r:3.2,fill:'none',stroke:'rgba(0,0,0,0.35)',strokeWidth:0.8}),
        e('ellipse',{cx:px-2,cy:py-2.4,rx:2.4,ry:1.5,fill:'rgba(255,255,255,0.5)'}),
      )
    )
  );
}

// ── Analytics ─────────────────────────────────────────────────────────
function track(event,props){
  try{if(window.posthog&&typeof window.posthog.capture==='function')window.posthog.capture(event,props||{});}catch(e){}
}

// ── UpgradeSheet ──────────────────────────────────────────────────────
function UpgradeSheet({feature,onClose,onUnlock,trialUsed,trialActive,onTrial}){
  const trialExpired=trialUsed&&!trialActive;
  const PERKS=[
    'Drop 2, Drop 3, and Rootless voicings in the Keys tab',
    'All play forms + 5 jazz standards — Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, There Will Never Be Another You',
    'All 12 ear training intervals + harmonic mode, triads, 7th chords, and cadence recognition',
    'All extended chord types (9ths, 11ths, 13ths, altered) in the Any Chord tab',
  ];
  const FEATURE_DESC={
    'Drop 2 voicings':'The most common jazz comping grip — four notes across adjacent strings, clean and compact.',
    'Drop 3 voicings':'Wider spread, more open sound — great for comping in lower positions.',
    'Rootless voicings':'Play like a pianist: remove the root so the bassist has space. Type A and B give you two inversion sets.',
    'Triads':'Major, minor, dim, aug — hear them in isolation before combining into 7th chords.',
    '7th Chords':'Identify maj7, m7, dom7, and half-dim chords by ear — the core vocabulary of jazz harmony.',
    'Auto ear training':'Listen without scoring pressure — the app plays, speaks the answer, and moves on automatically.',
    'Find Chord':'Tap any notes on the fretboard and instantly see what chord you\'re playing.',
    'BLUE BOSSA':'16 bars, two key centers: C minor for bars 1–8, D♭ major for bars 9–12, back to C minor. The modulation is the lesson — watch the key shift at bar 9.',
    'AUTUMN LEAVES':'32-bar AABA in G major/E minor. Practice the descending ii–V–I–IV motion and the minor ii–V–i in the bridge.',
    'ALL THINGS':'Two ii–V–I cycles descending a fourth apart — the root motion that shows up in countless standards. Set key to Ab.',
    'STELLA':'Three ii–V–I chains through different keys (E♭, G, B♭) in 16 bars. The opening Em7♭5–A7 is the harmonic surprise — it doesn\'t resolve where you expect. Set key to B♭.',
    'ANOTHER YOU':'Backdoor ii–V, secondary dominants, and a turnaround all in one 12-bar A section. Set key to Eb.',
    'MINOR ii–V–i':'The half-diminished iim7♭5 creates stronger pull than a plain m7 — the ear hears it lean hard into im7.',
    'JAZZ BLUES':'12-bar blues transformed: VI7 in bar 8, iim7–V7 in bars 9–10, turnaround in bar 12.',
    'I–VI–ii–V':'The engine of rhythm changes and endless standards. The VI is dominant so it pulls harder into ii.',
    'MINOR BLUES':'im7 throughout, iiø7–V7 in bars 9–10 — the minor ii–V you already know drops right in.',
    'TRITONE SUB':'Hear the chromatic bass D♭→C vs. the fifth-down G→C. Same resolution, totally different color.',
    'SEC. DOM.':'E7 pulls to Am7, A7 pulls to Dm7 — each a mini ii–V before the main ii–V–I resolves home.',
  };
  // Map partial feature strings to a perk index (0-3) so that perk gets highlighted
  const PERK_IDX={'Drop 2':0,'Drop 3':0,'Rootless':0,'drop2':0,'drop3':0,'rootless':0,
    'minor ii':1,'MINOR ii':1,'Jazz Blues':1,'JAZZ BLUES':1,'Tritone':1,'TRITONE':1,
    'Sec. Dom':1,'SEC. DOM':1,'Turnaround':1,'I–VI':1,'MINOR BLUES':1,'Minor Blues':1,
    'BLUE BOSSA':1,'AUTUMN':1,'ALL THINGS':1,'STELLA':1,'ANOTHER YOU':1,
    'Triads':2,'7th Chords':2,'Auto ear':2,'auto ear':2,
    '△':3,'ø':3,'9sus':3};
  const featureKey=Object.keys(PERK_IDX).find(k=>feature&&feature.toLowerCase().includes(k.toLowerCase()));
  const highlightPerk=featureKey!==undefined?PERK_IDX[featureKey]:null;
  const desc=feature&&FEATURE_DESC[feature];
  return e(React.Fragment,null,
    e('div',{onClick:onClose,style:{position:'fixed',inset:0,zIndex:299,background:'rgba(0,0,0,0.5)'}}),
    e('div',{style:{position:'fixed',bottom:0,left:0,right:0,zIndex:300,
      background:BG2,borderRadius:'16px 16px 0 0',
      border:'1px solid '+GOLD+'44',padding:'20px 20px 36px',
      boxShadow:'0 -8px 32px rgba(0,0,0,0.55)',maxHeight:'72vh',overflowY:'auto'}},
      e('div',{style:{width:40,height:4,background:BORDER,borderRadius:2,margin:'0 auto 18px'}}),
      e('div',{style:{fontSize:'1.6rem',textAlign:'center',marginBottom:8}},trialExpired?'⏱️':'🔒'),
      e('div',{style:{fontFamily:SERIF,fontSize:'1.15rem',fontWeight:700,
        color:'var(--scale-name)',textAlign:'center',marginBottom:4}},
        trialExpired?'Your free trial has ended':feature+' is a Pro feature'),
      trialExpired
        ?e('div',{style:{fontSize:'0.82rem',color:HINT,textAlign:'center',
            marginBottom:16,fontFamily:UI_FONT,lineHeight:1.5,padding:'0 8px'}},
            'You had full access to everything. Unlock Pro to keep it — one price, forever.')
        :desc?e('div',{style:{fontSize:'0.82rem',color:HINT,textAlign:'center',
            marginBottom:16,fontFamily:UI_FONT,lineHeight:1.5,padding:'0 8px'}},desc):null,
      e('div',{style:{fontSize:'0.75rem',color:HINT,
        marginBottom:8,fontFamily:UI_FONT,fontWeight:600,letterSpacing:'0.05em',
        textTransform:'uppercase'}},desc&&!trialExpired?'Pro also unlocks:':'Pro unlocks:'),
      e('ul',{style:{listStyle:'none',margin:'0 0 22px',padding:0}},
        PERKS.map((p,i)=>e('li',{key:i,style:{display:'flex',gap:9,padding:'6px 0',
          fontSize:'0.82rem',
          color:highlightPerk===i?GOLD:'var(--txt)',
          fontWeight:highlightPerk===i?700:400,
          fontFamily:UI_FONT,lineHeight:1.5}},
          e('span',{style:{color:GOLD,flexShrink:0,marginTop:1}},'✦'),p))),
      e('button',{onClick:onUnlock,style:{
        width:'100%',padding:'15px',borderRadius:10,cursor:'pointer',
        fontFamily:UI_FONT,fontSize:'1rem',fontWeight:700,
        background:GOLD,border:'none',color:'#07070f',minHeight:54,marginBottom:10}},
        'Unlock Pro — $9.99'),
      !trialUsed?e('button',{onClick:onTrial,style:{
        width:'100%',padding:'12px',borderRadius:10,cursor:'pointer',
        fontFamily:UI_FONT,fontSize:'0.88rem',fontWeight:600,
        background:'transparent',border:'1px solid '+GOLD+'66',
        color:GOLD,minHeight:44,marginBottom:10}},
        'Try Pro free for 7 days'):null,
      e('button',{onClick:onClose,style:{
        width:'100%',padding:'10px',borderRadius:10,cursor:'pointer',
        fontFamily:UI_FONT,fontSize:'0.82rem',background:'transparent',
        border:'1px solid '+BORDER,color:HINT,minHeight:44}},
        'Maybe later')
    )
  );
}

// ── AboutSheet ────────────────────────────────────────────────────────
function AboutSheet({onClose,level,onRestore}){
  const [restored,setRestored]=React.useState(false);
  function handleRestore(){onRestore();setRestored(true);}
  return e(React.Fragment,null,
    e('div',{onClick:onClose,style:{position:'fixed',inset:0,zIndex:299,background:'rgba(0,0,0,0.5)'}}),
    e('div',{style:{position:'fixed',bottom:0,left:0,right:0,zIndex:300,
      background:BG2,borderRadius:'16px 16px 0 0',
      border:'1px solid '+BORDER,padding:'20px 20px 36px',
      boxShadow:'0 -8px 32px rgba(0,0,0,0.55)',maxHeight:'72vh',overflowY:'auto'}},
      e('div',{style:{width:40,height:4,background:BORDER,borderRadius:2,margin:'0 auto 18px'}}),
      e('div',{style:{fontFamily:SERIF,fontSize:'1.15rem',fontWeight:700,
        color:'var(--scale-name)',textAlign:'center',marginBottom:3}},'Jazz Guitar Lab'),
      e('div',{style:{fontSize:'0.78rem',color:HINT,textAlign:'center',fontFamily:UI_FONT,marginBottom:24}},
        'Version '+APP_VERSION+' · '+(level==='pro'?'Pro ✦':'Essentials')),
      e('a',{href:SUPPORT_URL,target:'_blank',rel:'noopener noreferrer',
        style:{display:'block',width:'100%',padding:'14px',borderRadius:10,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.95rem',fontWeight:700,textAlign:'center',
          textDecoration:'none',border:'1px solid '+BORDER,background:'var(--bg)',
          color:'var(--txt)',marginBottom:10,minHeight:44,boxSizing:'border-box'}},
        'Contact Support'),
      level==='essentials'?e('button',{
        onClick:handleRestore,
        style:{width:'100%',padding:'14px',borderRadius:10,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.95rem',fontWeight:700,
          background:'transparent',border:'1px solid '+GOLD+'66',
          color:restored?HINT:GOLD,minHeight:44,marginBottom:10}},
        restored?'Purchase restored ✓':'Restore Purchase'):null,
      e('div',{style:{borderTop:'1px solid '+BORDER,marginTop:14,paddingTop:14,
        fontSize:'0.75rem',color:HINT,fontFamily:UI_FONT,lineHeight:1.6}},
        '🦶 Bluetooth pedal: AirTurn or PageFlip works in all tabs. Forward = next chord / next question. Back = previous chord / replay sound.'),
      e('button',{onClick:onClose,style:{
        width:'100%',padding:'10px',borderRadius:10,cursor:'pointer',
        fontFamily:UI_FONT,fontSize:'0.82rem',background:'transparent',
        border:'1px solid '+BORDER,color:HINT,minHeight:44,marginTop:14}},'Close')
    )
  );
}

// ── ColorLegend ───────────────────────────────────────────────────────
function ColorLegend(){
  const pairs=[['R',TC[0]],['3rd',TC[1]],['5th',TC[2]],['7th',TC[3]]];
  return e('div',{style:{display:'flex',alignItems:'center',gap:8,flexShrink:0}},
    pairs.map(([lbl,col])=>
      e('span',{key:lbl,style:{display:'flex',alignItems:'center',gap:3}},
        e('span',{style:{width:9,height:9,borderRadius:'50%',background:col,flexShrink:0,boxShadow:'0 0 4px '+col+'88'}}),
        e('span',{style:{fontSize:'0.66rem',color:col,fontFamily:UI_FONT,fontWeight:700}},lbl)
      )
    )
  );
}

// ── BpmKnob ───────────────────────────────────────────────────────────
function BpmKnob({bpm,setBpm,onTap}){
  const dragRef=useRef(null);
  const min=35,max=220;
  const pct=(bpm-min)/(max-min);
  const angle=-135+pct*270;
  const cx=30,cy=30,r=24;
  const rad=(angle-90)*Math.PI/180;
  const mx=cx+r*0.55*Math.cos(rad),my=cy+r*0.55*Math.sin(rad);
  const mx2=cx+r*0.82*Math.cos(rad),my2=cy+r*0.82*Math.sin(rad);
  function arcPath(startDeg,endDeg,radius){
    const s=(startDeg-90)*Math.PI/180,en=(endDeg-90)*Math.PI/180;
    const x1=cx+radius*Math.cos(s),y1=cy+radius*Math.sin(s);
    const x2=cx+radius*Math.cos(en),y2=cy+radius*Math.sin(en);
    const large=endDeg-startDeg>180?1:0;
    return 'M '+x1+' '+y1+' A '+radius+' '+radius+' 0 '+large+' 1 '+x2+' '+y2;
  }
  function handleWheel(ev){ev.preventDefault();setBpm(b=>Math.max(min,Math.min(max,b-(ev.deltaY>0?1:-1)*5)));}
  function handleKey(ev){
    if(ev.key==='ArrowUp'||ev.key==='ArrowRight') setBpm(b=>Math.min(max,b+5));
    if(ev.key==='ArrowDown'||ev.key==='ArrowLeft') setBpm(b=>Math.max(min,b-5));
  }
  function handlePointerDown(ev){
    ev.currentTarget.setPointerCapture(ev.pointerId);
    dragRef.current={startY:ev.clientY,startBpm:bpm};
  }
  function handlePointerMove(ev){
    if(!dragRef.current) return;
    const delta=Math.round((dragRef.current.startY-ev.clientY)/1.5);
    setBpm(Math.max(min,Math.min(max,dragRef.current.startBpm+delta)));
  }
  function handlePointerUp(){dragRef.current=null;}
  return e('div',{style:{display:'flex',flexDirection:'row',alignItems:'center',gap:8,cursor:'pointer',flexShrink:0},
    onWheel:handleWheel,onKeyDown:handleKey,tabIndex:0,'aria-label':'BPM '+bpm},
    e('svg',{width:60,height:60,viewBox:'0 0 60 60',style:{display:'block',userSelect:'none',touchAction:'none'},
      onPointerDown:handlePointerDown,onPointerMove:handlePointerMove,onPointerUp:handlePointerUp},
      e('path',{d:arcPath(-135,135,20),fill:'none',stroke:'var(--brd)',strokeWidth:3,strokeLinecap:'round'}),
      e('path',{d:arcPath(-135,angle,20),fill:'none',stroke:GOLD,strokeWidth:3,strokeLinecap:'round'}),
      e('circle',{cx,cy,r:16,fill:'var(--bg2)',stroke:'var(--brd)',strokeWidth:1.5}),
      e('line',{x1:mx,y1:my,x2:mx2,y2:my2,stroke:GOLD,strokeWidth:2.5,strokeLinecap:'round'})
    ),
    e('div',{style:{display:'flex',flexDirection:'column',alignItems:'flex-start',gap:3}},
      e('div',{style:{display:'flex',alignItems:'baseline',gap:4}},
        e('span',{style:{fontSize:'1.15rem',fontWeight:700,color:GOLD,fontFamily:UI_FONT,lineHeight:1}},bpm),
        e('span',{style:{fontSize:'0.6rem',color:'var(--lbl)',letterSpacing:'1px',lineHeight:1}},'BPM')
      ),
      e('button',{onClick:onTap,style:{fontSize:'0.68rem',color:'var(--btn-off)',background:'transparent',
        border:'1px solid var(--btn-brd)',borderRadius:4,padding:'3px 10px',cursor:'pointer',
        fontFamily:UI_FONT,minHeight:0}},'TAP')
    )
  );
}

// ── Guide audio helper ────────────────────────────────────────────────
function playGuideChord(quality){
  try{
    const ctx=_getPreviewCtx();if(!ctx) return;
    const iv=INTERVALS[quality]||[0,4,7,11];
    iv.forEach((interval,i)=>{
      const midi=48+interval;
      const t=ctx.currentTime+i*0.08;
      if(_guitarBufs) _playSampledNote(ctx,midi,t,0.5,2.8);
      else _playKSNote(ctx,midi,t,0.5);
    });
  }catch(ex){}
}
function GuidePlayBtn({quality}){
  return e('button',{onClick:()=>playGuideChord(quality),style:{
    display:'inline-flex',alignItems:'center',gap:3,
    padding:'2px 8px',borderRadius:12,cursor:'pointer',
    fontFamily:UI_FONT,fontSize:'0.69rem',
    border:'1px solid var(--btn-brd)',background:'var(--bg2)',
    color:'var(--hint)',minHeight:0,verticalAlign:'middle',marginLeft:6
  }},'▶ hear');
}

// ── Glossary definitions (used in Guide; also available to any tab) ───
const GLOSS_DEFS={
  '7th':{term:'7th chord',short:'A 4-note chord (root–3–5–7) — the extra note gives jazz its richness.',detail:'Jazz chords almost always include the 7th. It\'s the note that distinguishes a plain major triad (C–E–G) from a jazz Cmaj7 (C–E–G–B). The flavor of the 7th — major, minor, or diminished — is what creates the four chord qualities: maj7 (lush), m7 (floating), dom7 (tense), ø7 (searching).'},
  'maj7':{term:'Major 7 (△7)',short:'Stable and lush — the "home" chord. Written △7 in jazz charts (triangle = major 7th). The 7th sits a half-step below the octave.',detail:'Spelled root–3–5–Δ7. In C: C–E–G–B. The major 7th (B) is a half-step below the octave — close to resolution but not quite there, which gives it a gentle, suspended beauty. This is the I and IV chord in major keys. In jazz ballads and bossa nova, maj7 is the most "at rest" sound.'},
  'dom7':{term:'Dominant 7 (7)',short:'The tension chord — its tritone (3rd + ♭7) pulls strongly toward resolution.',detail:'Spelled root–3–5–♭7. In G: G–B–D–F. The 3rd (B) and ♭7 (F) are a tritone apart — the most dissonant interval. Both notes want to resolve: B moves up a half-step to C, F moves down to E. Those are the root and 3rd of Cmaj7. This is the V chord — the engine of all tonal resolution.'},
  'm7':{term:'Minor 7 (m7)',short:'Smooth and floating — neither fully resolved nor urgently tense.',detail:'Spelled root–♭3–5–♭7. In D: D–F–A–C. The flat 3rd darkens the quality; the flat 7th (shared with dominant 7) prevents it from settling. It\'s the ii, iii, and vi chord in major keys. Because it lacks the tritone of a dominant chord, it doesn\'t pull hard toward anything — it floats. Play Dm7 → G7 → Cmaj7 to hear it act as tension-before-the-tension.'},
  'halfdim':{term:'Half-diminished (ø7)',short:'m7 with a flattened 5th — more tense and searching than a regular minor 7.',detail:'Spelled root–♭3–♭5–♭7. In B: B–D–F–A. The flattened 5th (F instead of F#) adds instability. This chord naturally occurs on the vii degree of major keys and on the ii degree of minor keys (where it\'s written iiø or iim7♭5). In C major, Bm7♭5 is the viiø7 — it shares G7\'s guide tones (B, D, F), so it acts as a rootless dominant that resolves to the I with extra darkness.'},
  'inv':{term:'Inversion',short:'Which chord tone sits lowest — root, 3rd, 5th, or 7th in the bass.',detail:'Root position: root on the bottom (C–E–G–B). 1st inversion: 3rd on the bottom (E–G–B–C). 2nd inversion: 5th on the bottom. 3rd inversion: 7th on the bottom. For Drop 2 voicings, all four inversions give you different positions on the neck. Voice leading chains them together so the hand moves minimally between chords.'},
  'drop2':{term:'Drop 2',short:'Second-highest note dropped an octave — spreads the chord across 4 adjacent strings.',detail:'Start with a closed chord (all notes within one octave, low to high: C–E–G–B). Drop 2 takes the second-from-top note (G) and moves it down an octave, producing C–G–B–E across 4 adjacent strings. This creates the characteristic jazz comping voicing — full, playable, four-note grip. Every chord has four Drop 2 inversions, each at a different neck position.'},
  'vl':{term:'Voice leading',short:'Moving each string to the nearest available note in the next chord.',detail:'Good voice leading means each string moves as little as possible between chords. When G7 resolves to Cmaj7, the B (3rd of G7) stays as B (7th of Cmaj7), and the F (7th of G7) moves a half-step to E (3rd of Cmaj7). The bass moves, but the inner voices barely do. This is what makes chords "flow" — the opposite is jumping shapes all over the neck.'},
  'guide':{term:'Guide tones',short:'The 3rd and 7th — they define chord quality and move most dramatically chord to chord.',detail:'In any 7th chord, the root tells you the name and the 5th is mostly filler. The 3rd and 7th do all the work: the 3rd sets major vs. minor quality; the 7th sets dom7 vs. maj7. In a ii–V–I progression, the guide tones swap roles on each chord — the 7th of G7 (F) becomes the 3rd of Cmaj7 (E after a half-step resolution). Shell voicings isolate these two notes plus the root.'},
  'diat':{term:'Diatonic',short:'Notes or chords belonging entirely to one key, with no outside alterations.',detail:'In C major, the 7 diatonic notes are C–D–E–F–G–A–B. Any melody, chord, or scale that uses only these 7 notes is diatonic to C major. The 7 diatonic chords are Cmaj7–Dm7–Em7–Fmaj7–G7–Am7–Bm7♭5. "Chromatic" or "outside" means using notes not in the key. Jazz constantly moves between diatonic and chromatic — in and out — for tension and color.'},
  'shell':{term:'Shell voicing',short:'3-note voicing: root + 3rd + 7th — the 5th is omitted.',detail:'Shell voicings use only the 3 most essential notes: root, 3rd, and 7th. The 5th is dropped because it adds little harmonic information (it just confirms the sound is "open"). The result is lighter, lower, and easier to move. Form A uses skip-string layouts (strings 6-4-3 or 5-3-2); Form B uses adjacent strings (6-5-4 or 5-4-3). Both are R–3–7 but in different orders and octave placements.'},
  'rootless':{term:'Rootless voicing',short:'Root replaced by 9th — designed to play over a bassist without doubling their note.',detail:'A rootless voicing replaces the root with the 9th (the note a whole-step above the root). Cmaj9 rootless: E–G–B–D instead of C–E–G–B. Without the root, the chord sits higher, has less low-end clutter, and leaves more sonic space for the bassist\'s walking notes. Type A (3-5-7-9) and Type B (7-9-3-5) are two inversions of the same four notes.'},
  'arp':{term:'Arpeggio',short:'Chord notes played one at a time rather than simultaneously.',detail:'An arpeggio is a chord broken up into individual notes, usually ascending or descending. On guitar, strumming each string individually creates an arpeggiated effect. In jazz soloing, outlining the chord tones as an arpeggio ("playing through the changes") is the foundation — hitting the right chord tones at the right time, even with passing notes in between.'},
  'modes':{term:'Modes',short:'Scales starting on different degrees of a parent scale (Dorian, Mixolydian, etc.).',detail:'Every major scale generates 7 modes by starting on each successive degree. C major (C–D–E–F–G–A–B) starting on D gives D Dorian (D–E–F–G–A–B–C) — same notes, different root. Each mode has a distinct color: Dorian (ii) is the standard minor; Mixolydian (V) has a dominant quality; Lydian (IV) has a #4 that sounds bright and floating. In jazz, modes label which scale to use over each chord.'},
  'roman':{term:'Roman numerals',short:'I, ii, V etc. — chord position relative to the key, independent of key signature.',detail:'Roman numerals describe where a chord sits in the key, not what key it\'s in. In C major, Cmaj7 = I, Dm7 = ii, G7 = V. In Bb major, Bbmaj7 = I, Cm7 = ii, F7 = V. The ii–V–I pattern is always the same relationship regardless of key. Uppercase (I, IV, V) = major or dominant; lowercase (ii, iii, vi) = minor. Learning progressions by Roman numeral means you understand them in every key at once.'},
  'tritone':{term:'Tritone',short:'6 semitones apart — the most tense interval, wants to resolve by half-step in both directions.',detail:'A tritone is exactly half an octave — 6 semitones. C to F# (or Gb). It\'s the most dissonant interval in Western music, historically called "diabolus in musica" (devil in music). In a G7 chord, the tritone lives between the 3rd (B) and ♭7 (F). B wants to move up a half-step to C; F wants to move down to E. That pull is why V7 resolves so powerfully to I.'},
  'tritone_sub':{term:'Tritone substitution',short:'Replacing V7 with a dominant 7 a tritone away (♭II7). Both share the same tritone and resolve identically, but ♭II7 approaches by half-step in the bass.',detail:'G7 and D♭7 share the same tritone: B/F (in G7) = C♭/F (in D♭7, enharmonically). Because they share the tritone, both resolve equally well to Cmaj7. D♭7 approaches C from a half-step above in the bass — a smooth chromatic descent. So instead of G7 → Cmaj7 (bass leaps a 4th), you play D♭7 → Cmaj7 (bass steps down by half-step). This substitution is heard everywhere in jazz and bebop.'},
  'sec_dom':{term:'Secondary dominant',short:'A V7 chord temporarily pointing to a chord other than I — creates chromatic motion and brief tonicization.',detail:'Any diatonic chord can temporarily become a local I, with a dominant 7 built a 5th above it. In C major: G7 is V7/I. But D7 isn\'t diatonic — it points to Gm7 (ii) as if it were I. Writing it V7/ii names the relationship. Common ones: V7/ii (D7 → Dm7), V7/IV (F#7 → Fmaj7), V7/V (A7 → G7), V7/vi (B7 → Am7). They create brief tonicizations — momentary shifts of gravity — before returning to the main key.'},
  'modal_int':{term:'Modal interchange (borrowing)',short:'Using chords from the parallel minor or major key for unexpected color without leaving the key.',detail:'In C major, you can "borrow" chords from C minor (C–D–Eb–F–G–Ab–Bb). Common borrowed chords: Fm7 (IVm — the note Ab adds darkness), Bbmaj7 (♭VII — a whole-step below the root), Ab major (♭VI — very dramatic). The defining moment is when a chord tone outside the key (like Ab in C major) appears — your ear notices the shift but it doesn\'t feel like a key change. Common in Beatles songs, jazz ballads, and pop standards.'},
  'approach_note':{term:'Chromatic approach note',short:'A half-step above or below a chord tone, played just before the chord — creates bebop\'s characteristic lean-and-land feel.',detail:'Play any note one half-step above or below a target chord tone on the beat just before the chord arrives. On beat 4 of the bar before Cmaj7, play a C# or B — then land on C when the chord hits. The momentary half-step creates a small lean of tension that releases immediately. String a few of these together and you sound like bebop. Charlie Parker and Dizzy Gillespie built entire vocabulary systems around this principle.'},
  'comp':{term:'Comping',short:'Playing chords rhythmically to back a soloist or singer — short for "accompany."',detail:'To comp is to play the chords of a tune in rhythm — feeding the harmony and the groove while someone else (or you) plays the melody or solo. It\'s the guitarist\'s main job in a jazz group. Good comping is about placement and space: you don\'t strum every beat. Classic spots are beats 2 and 4, or the "Charleston" (beat 1 plus the "and" of beat 2). Shell and Drop 2 voicings are the standard comping grips.'},
};

// ── EarTrainingView ───────────────────────────────────────────────────


// ── TrainView ───────────────────────────────────────────────────────
function TrainView({level,onPracticed,onUpgrade,pedalRef}){
  return e(EarTrainingView,{level,onPracticed,onUpgrade,pedalRef});
}


function EarTrainingView({level,onPracticed,onUpgrade,pedalRef}){
  const isEss=level==='essentials';
  const practicedRef=useRef(false);
  const answerCountRef=useRef(0);
  const skipSaveRef=useRef(0); // suppresses localStorage write during level-change score reset
  const levelInitRef=useRef(false); // skip level-change effect on first mount
  const levelChangingRef=useRef(false); // set by [level] effect to suppress the [mode] effect's newRound

  // Modes: intervals always visible; triads + 7th chords are Full only
  const [mode,setMode]=useState('intervals');
  // Per-mode scores — persisted so progress survives app restarts
  const [scores,setScores]=useState(()=>{
    try{const s=JSON.parse(safeLS('jg-ear-scores','{}'));
      return {intervals:{r:s.intervals?.r||0,w:s.intervals?.w||0},
        triads:{r:s.triads?.r||0,w:s.triads?.w||0},
        chords:{r:s.chords?.r||0,w:s.chords?.w||0},
        cadences:{r:s.cadences?.r||0,w:s.cadences?.w||0}};}
    catch(ex){return {intervals:{r:0,w:0},triads:{r:0,w:0},chords:{r:0,w:0},cadences:{r:0,w:0}};}
  });
  // Per-item breakdown — persisted for spaced-repetition weighting
  const [detail,setDetail]=useState(()=>{
    try{
      const s=JSON.parse(safeLS('jg-ear-detail','{}'));
      return {intervals:s.intervals||{},triads:s.triads||{},chords:s.chords||{},cadences:s.cadences||{}};
    }
    catch(ex){return {intervals:{},triads:{},chords:{},cadences:{}};}
  });
  useEffect(()=>{if(skipSaveRef.current>0){skipSaveRef.current--;return;}safeLSSet('jg-ear-scores',JSON.stringify(scores));},[scores]);
  useEffect(()=>{if(skipSaveRef.current>0){skipSaveRef.current--;return;}safeLSSet('jg-ear-detail',JSON.stringify(detail));},[detail]);
  // Intro gate — shown once, persisted to localStorage
  const [seenIntro,setSeenIntro]=useState(()=>!!safeLS('jg-ear-intro'));
  // Round state
  const [current,setCurrent]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [lastResult,setLastResult]=useState(null);
  const [wrongGuess,setWrongGuess]=useState(null);
  const [choices,setChoices]=useState([]); // random 4-of-12 for intervals mode
  const [harmonic,setHarmonic]=useState(false); // Full only: play both notes simultaneously
  // Interval difficulty tier — gentle progression instead of all 12 at once
  const [ivalTier,setIvalTier]=useState(()=>{const v=parseInt(safeLS('jg-ear-ival-tier','1'),10);return v>=1&&v<=3?v:1;});
  useEffect(()=>{safeLSSet('jg-ear-ival-tier',String(ivalTier));},[ivalTier]);
  const [autoMode,setAutoMode]=useState(false);
  // Back-navigation history: snapshots of prior rounds so ← steps to the previous question
  const historyRef=useRef([]);
  const autoTimerRef=useRef(null);
  const autoTimer2Ref=useRef(null);
  const bestVoiceRef=useRef(null);
  const audioClipsRef=useRef({});
  const autoModeRef=useRef(false);

  // Load best available TTS voice; prefer enhanced/neural en-US voices
  useEffect(()=>{
    function pickVoice(){
      const vs=window.speechSynthesis?.getVoices()||[];
      if(!vs.length) return;
      bestVoiceRef.current=
        vs.find(v=>/enhanced|premium/i.test(v.name)&&/en[-_]/i.test(v.lang))
        ||vs.find(v=>/google.*en.*us|en.*us.*google/i.test(v.name))
        ||vs.find(v=>v.lang==='en-US'&&v.localService)
        ||vs.find(v=>v.lang==='en-US')
        ||vs.find(v=>/^en/i.test(v.lang))
        ||null;
    }
    pickVoice();
    window.speechSynthesis?.addEventListener('voiceschanged',pickVoice);
    return()=>window.speechSynthesis?.removeEventListener('voiceschanged',pickVoice);
  },[]);

  // Preload Google TTS audio clips; falls back to browser TTS if files absent
  useEffect(()=>{
    const keys=[
      'minor-second','major-second','minor-third','major-third',
      'perfect-fourth','tritone','perfect-fifth','minor-sixth',
      'major-sixth','minor-seventh','major-seventh','octave',
      'major-triad','minor-triad','augmented-triad','diminished-triad',
      'major-seven','minor-seven','dominant-seven','half-diminished',
      'two-five','five-one','two-five-one','one-six','four-minor-one',
    ];
    const clips={};
    keys.forEach(k=>{const a=new Audio('./audio/'+k+'.mp3');a.preload='auto';clips[k]=a;});
    audioClipsRef.current=clips;
  },[]);

  // Keep autoModeRef in sync so advance/adv callbacks can bail if mode was turned off
  useEffect(()=>{autoModeRef.current=autoMode;},[autoMode]);
  // Cancel timers and speech when auto mode turns off or component unmounts
  useEffect(()=>{
    if(!autoMode){clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);window.speechSynthesis?.cancel();}
  },[autoMode]);
  useEffect(()=>()=>{clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);window.speechSynthesis?.cancel();},[]);

  // ── Data ──
  const IVALS=[
    {s:1, name:'Minor 2nd', feel:'"Jaws" 2-note shark motif · "Mission: Impossible" theme'},
    {s:2, name:'Major 2nd', feel:'"Happy Birthday" opening step (C→D) · "Frère Jacques"'},
    {s:3, name:'Minor 3rd', feel:'"Smoke on the Water" main riff · "Greensleeves" opening'},
    {s:4, name:'Major 3rd', feel:'"When the Saints Go Marching In" · "Morning" by Grieg'},
    {s:5, name:'Perfect 4th',feel:'"Here Comes the Bride" · "Amazing Grace" (G→C)'},
    {s:6, name:'Tritone',   feel:'"The Simpsons" theme · "Maria" from West Side Story (Ma-RÍ-a)'},
    {s:7, name:'Perfect 5th',feel:'"Star Wars" main theme · "Twinkle Twinkle" (C→G leap)'},
    {s:8, name:'Minor 6th', feel:'"The Star-Spangled Banner" (Oh→SAY) · "Because" by The Beatles'},
    {s:9, name:'Major 6th', feel:'"My Bonnie Lies Over the Ocean" · "Nobody Knows the Trouble I\'ve Seen"'},
    {s:10,name:'Minor 7th', feel:'"Somewhere" from West Side Story · "Watermelon Man" opening'},
    {s:11,name:'Major 7th', feel:'"Take On Me" (A-ha) chorus · "Don\'t Know Why" by Norah Jones'},
    {s:12,name:'Octave',    feel:'"Somewhere Over the Rainbow" (Some-WHERE) · "Singin\' in the Rain"'},
  ];
  // Interval pool grows with the chosen tier: start with octave + perfects,
  // add 3rds/6ths, then all 12. Tier 3 (all 12) stays Pro-gated.
  const IVAL_TIERS=[
    {lbl:'Octave & Perfects', ivals:[5,7,12]},
    {lbl:'+ 3rds & 6ths',     ivals:[3,4,5,7,8,9,12]},
    {lbl:'All 12',            ivals:[1,2,3,4,5,6,7,8,9,10,11,12]},
  ];
  const maxTier=isEss?2:3;
  const effTier=Math.min(ivalTier,maxTier);
  const activeIvals=IVALS.filter(x=>IVAL_TIERS[effTier-1].ivals.includes(x.s));

  const CADENCES=[
    {id:'ii-V',   name:'ii–V',             chords:[{r:2,q:'m7'},{r:7,q:'dom7'}],             feel:'The most common jazz movement — minor pulling to dominant'},
    {id:'V-I',    name:'V–I',              chords:[{r:7,q:'dom7'},{r:0,q:'maj7'}],            feel:'The resolution — tension releasing to home'},
    {id:'ii-V-I', name:'ii–V–I',           chords:[{r:2,q:'m7'},{r:7,q:'dom7'},{r:0,q:'maj7'}], feel:'The engine of jazz harmony'},
    {id:'I-VI',   name:'I–VI (turnaround)',chords:[{r:0,q:'maj7'},{r:9,q:'dom7'}],            feel:'Home moving to secondary dominant — sets up ii–V'},
    {id:'iv-I',   name:'iv–I (plagal)',    chords:[{r:5,q:'m7'},{r:0,q:'maj7'}],              feel:'Minor IV to major I — the "Amen" cadence in jazz'},
  ];

  const TRIAD_IV={major:[0,4,7],minor:[0,3,7],dim:[0,3,6],aug:[0,4,8]};
  const TRIAD_LBL={major:'Major',minor:'Minor',dim:'Diminished',aug:'Augmented'};
  const TRIAD_DESC={
    major:'bright, stable — I, IV, V of a major key',
    minor:'dark, smooth — ii, iii, vi of a major key',
    dim:'tense, unstable — VII degree; two minor thirds stacked',
    aug:'eerie, whole-tone color — major third + major third'
  };
  const TRIAD_LIST=['major','minor','dim','aug'];
  const QUALITIES=['maj7','m7','dom7','m7b5'];
  const QLABELS={'maj7':'Major 7','m7':'Minor 7','dom7':'Dom 7','m7b5':'Half-Dim'};
  const QDESCS={
    maj7:'lush, stable — the I and IV chord',
    m7:'smooth, floating — the ii and vi chord',
    dom7:'tense, pulling — the V chord',
    m7b5:'searching, unstable — the vii and minor ii chord'
  };

  // ── Play functions ──
  function playInterval(root,sem,isHarmonic){
    try{
      const ctx=_getPreviewCtx();if(!ctx)return;
      const m1=52+root,m2=m1+sem;
      const t2=isHarmonic?ctx.currentTime+0.05:ctx.currentTime+0.62;
      if(_guitarBufs){_playSampledNote(ctx,m1,ctx.currentTime+0.05,0.65,2.5);_playSampledNote(ctx,m2,t2,0.65,2.5);}
      else{_playKSNote(ctx,m1,ctx.currentTime+0.05,0.55);_playKSNote(ctx,m2,t2,0.55);}
    }catch(ex){}
  }
  function playTriad(root,quality){
    try{
      const ctx=_getPreviewCtx();if(!ctx)return;
      TRIAD_IV[quality].forEach((iv,i)=>{
        const t=ctx.currentTime+i*0.1;
        if(_guitarBufs) _playSampledNote(ctx,48+root+iv,t,0.55,2.8);
        else _playKSNote(ctx,48+root+iv,t,0.5);
      });
    }catch(ex){}
  }
  function playChord(root,quality){
    try{
      const ctx=_getPreviewCtx();if(!ctx)return;
      const iv=INTERVALS[quality]||[0,4,7,11];
      iv.forEach((interval,i)=>{
        const t=ctx.currentTime+i*0.08;
        if(_guitarBufs) _playSampledNote(ctx,48+root+interval,t,0.5,2.8);
        else _playKSNote(ctx,48+root+interval,t,0.5);
      });
    }catch(ex){}
  }
  function playCadence(root,cadence){
    try{
      const ctx=_getPreviewCtx();if(!ctx)return;
      cadence.chords.forEach((chord,ci)=>{
        const chordRoot=((root+chord.r)%12);
        const iv=INTERVALS[chord.q]||[0,4,7,10];
        iv.forEach((interval,ni)=>{
          const t=ctx.currentTime+ci*1.2+ni*0.07;
          if(_guitarBufs) _playSampledNote(ctx,48+chordRoot+interval,t,0.25,2.8);
          else _playKSNote(ctx,48+chordRoot+interval,t,0.5);
        });
      });
    }catch(ex){}
  }
  // Play the sound for an arbitrary round snapshot (used by replay + back navigation)
  function playRound(r){
    if(!r||!r.current) return;
    if(r.mode==='intervals') playInterval(r.current.root,r.current.semitones,!!r.harmonic);
    else if(r.mode==='triads') playTriad(r.current.root,r.current.quality);
    else if(r.mode==='cadences') playCadence(r.current.root,r.current.cadence);
    else playChord(r.current.root,r.current.quality);
  }
  function replayCurrent(){
    if(!current) return;
    playRound({mode,current,harmonic});
  }
  // Push the current round onto the back-history stack (bounded)
  function pushHistory(){
    if(!current) return;
    historyRef.current.push({mode,current,choices,revealed,lastResult,wrongGuess,harmonic});
    if(historyRef.current.length>50) historyRef.current.shift();
  }
  // User-initiated advance: remember the current round, then generate a fresh one
  function nextRound(){
    pushHistory();
    newRound();
  }
  // Step back to the previous question, restoring its answered state and replaying it.
  // Falls back to replaying the current sound when there's no history (e.g. first question).
  function goBack(){
    const h=historyRef.current.pop();
    if(!h){replayCurrent();return;}
    clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);
    setCurrent(h.current);
    setChoices(h.choices||[]);
    setRevealed(h.revealed);
    setLastResult(h.lastResult);
    setWrongGuess(h.wrongGuess);
    setTimeout(()=>playRound(h),150);
  }
  function autoReveal(){
    if(!current) return;
    let spk='';
    if(mode==='intervals'){
      const iv=IVALS.find(x=>x.s===current.semitones);
      const ORD={'2nd':'second','3rd':'third','4th':'fourth','5th':'fifth','6th':'sixth','7th':'seventh','8th':'octave'};
      spk=iv?iv.name.replace(/\b(\d+(?:st|nd|rd|th))\b/g,m=>ORD[m]||m):'';
    } else if(mode==='triads'){spk=(TRIAD_LBL[current.quality]||'')+' triad';}
    else if(mode==='cadences'){
      const m={'ii-V':'Two five','V-I':'Five one','ii-V-I':'Two five one','I-VI':'One six','iv-I':'Four minor one'};
      spk=m[current.cadence.id]||current.cadence.name;
    } else {
      const m={'maj7':'Major seven','m7':'Minor seven','dom7':'Dominant seven','m7b5':'Half diminished'};
      spk=m[current.quality]||QLABELS[current.quality]||'';
    }
    setRevealed(true);setLastResult('auto');
    if(!spk){autoTimerRef.current=setTimeout(newRound,2600);return;}
    // TTS fallback used when MP3 clip is unavailable
    function speakTTS(){
      if(window.speechSynthesis){
        window.speechSynthesis.cancel();
        const utt=new SpeechSynthesisUtterance(spk);
        if(bestVoiceRef.current) utt.voice=bestVoiceRef.current;
        utt.rate=0.82;utt.pitch=0.9;
        let done=false;
        function adv(){if(done||!autoModeRef.current)return;done=true;autoTimerRef.current=setTimeout(newRound,1600);}
        utt.onend=adv;utt.onerror=adv;
        autoTimerRef.current=setTimeout(adv,Math.max(3000,spk.length*80));
        window.speechSynthesis.speak(utt);
      } else {autoTimerRef.current=setTimeout(newRound,2600);}
    }
    const clip=audioClipsRef.current[spk.toLowerCase().replace(/\s+/g,'-')];
    if(clip){
      clip.currentTime=0;
      let done=false;
      function advance(){if(done||!autoModeRef.current)return;done=true;autoTimerRef.current=setTimeout(newRound,1400);}
      clip.onended=advance;
      clip.onerror=()=>{clip.onerror=null;clip.onended=null;speakTTS();};
      // Safety: if onended never fires (e.g. browser quirk), fall through after 4s
      autoTimerRef.current=setTimeout(advance,4000);
      clip.play().catch(speakTTS);
    } else {
      speakTTS();
    }
  }

  // Auto-advance: wait 3s after each new round then reveal + speak
  useEffect(()=>{
    if(!autoMode||!current||revealed)return;
    clearTimeout(autoTimerRef.current);
    clearTimeout(autoTimer2Ref.current);
    autoTimer2Ref.current=setTimeout(replayCurrent,2000);
    autoTimerRef.current=setTimeout(autoReveal,7000);
    return()=>{clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);};
  },[current,autoMode,revealed]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Round logic ──
  function newRound(){
    const root=Math.floor(Math.random()*12);
    setRevealed(false);setLastResult(null);setWrongGuess(null);
    if(mode==='intervals'){
      const correct=activeIvals[Math.floor(Math.random()*activeIvals.length)];
      const others=activeIvals.filter(x=>x.s!==correct.s).sort(()=>Math.random()-0.5).slice(0,3);
      setChoices([correct,...others].sort(()=>Math.random()-0.5));
      setCurrent({root,semitones:correct.s});
      setTimeout(()=>playInterval(root,correct.s,harmonic),150);
    } else if(mode==='triads'){
      const quality=TRIAD_LIST[Math.floor(Math.random()*4)];
      setCurrent({root,quality});
      setTimeout(()=>playTriad(root,quality),150);
    } else if(mode==='cadences'){
      const cadencePool=isEss?CADENCES.slice(0,2):CADENCES;
      const correct=cadencePool[Math.floor(Math.random()*cadencePool.length)];
      // Use full CADENCES as distractor pool so Essentials always shows 4 choices
      const others=CADENCES.filter(x=>x.id!==correct.id).sort(()=>Math.random()-0.5).slice(0,3);
      setChoices([correct,...others].sort(()=>Math.random()-0.5));
      setCurrent({root,cadence:correct});
      setTimeout(()=>playCadence(root,correct),150);
    } else {
      const quality=QUALITIES[Math.floor(Math.random()*4)];
      setCurrent({root,quality});
      setTimeout(()=>playChord(root,quality),150);
    }
  }
  function guess(answer){
    if(revealed||!current||autoMode) return;
    let correct,key;
    if(mode==='intervals'){correct=answer===current.semitones;key=current.semitones;}
    else if(mode==='cadences'){correct=answer===current.cadence.id;key=current.cadence.id;}
    else{correct=answer===current.quality;key=current.quality;}
    setRevealed(true);setLastResult(correct?'right':'wrong');
    if(!correct) setWrongGuess(answer);
    answerCountRef.current++;
    if(!practicedRef.current&&answerCountRef.current>=5){practicedRef.current=true;onPracticed?.();}
    setScores(s=>({...s,[mode]:{r:s[mode].r+(correct?1:0),w:s[mode].w+(correct?0:1)}}));
    setDetail(d=>{const m={...d[mode]},e={...m[key]||{r:0,w:0}};
      e[correct?'r':'w']++;m[key]=e;return{...d,[mode]:m};});
  }
  useEffect(()=>{
    if(seenIntro){
      if(levelChangingRef.current){levelChangingRef.current=false;return;}
      clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);
      historyRef.current=[];
      newRound();
    }
  },[mode,seenIntro,ivalTier]);
  useEffect(()=>{
    if(!levelInitRef.current){levelInitRef.current=true;return;} // skip initial mount
    if(!seenIntro) return;
    clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);
    if(isEss){
      setHarmonic(false);
      setAutoMode(false);
      if(mode==='triads'||mode==='chords'||mode==='cadences'){
        levelChangingRef.current=true; // suppress the [mode] effect's newRound — we call it below
        setMode('intervals');
      }
    }
    skipSaveRef.current+=2; // suppress the upcoming score+detail saves so Pro history survives
    setScores(s=>({...s,intervals:{r:0,w:0}}));
    setDetail(d=>({...d,intervals:{}}));
    historyRef.current=[];
    newRound();
  },[level]);
  if(!seenIntro) return e('div',{style:{paddingTop:'25vh',paddingBottom:'20px',paddingLeft:'16px',paddingRight:'16px',textAlign:'center',maxWidth:420,margin:'0 auto'}},
    e('div',{style:{fontSize:'2.5rem',marginBottom:12}},'♫'),
    e('div',{style:{fontSize:'1.0rem',fontWeight:700,fontFamily:SERIF,marginBottom:8}},'Ear Training'),
    e('div',{style:{fontSize:'0.8rem',color:LBL,lineHeight:1.6,marginBottom:20}},
      'You\'ll hear notes played. Identify what you hear — interval, chord type, or quality. ',
      'The more you practice, the more your ear will recognize these sounds naturally.'
    ),
    e('button',{onClick:()=>{setSeenIntro(true);safeLSSet('jg-ear-intro','1');},
      style:{padding:'10px 28px',borderRadius:8,fontSize:'0.9rem',fontWeight:600,
        background:GOLD,color:'#000',border:'none',cursor:'pointer'}},
      'Start Training →')
  );
  // Register pedal handlers — overwrite on every render so closure is always current
  if(pedalRef) pedalRef.current={
    forward:autoMode
      ?(()=>{clearTimeout(autoTimerRef.current);clearTimeout(autoTimer2Ref.current);if(!revealed)autoReveal();else newRound();})
      :(()=>revealed?nextRound():replayCurrent()),
    back:autoMode?replayCurrent:goBack,
  };

  const sc=scores[mode];
  const total=sc.r+sc.w;
  const pct=total>0?Math.round(100*sc.r/total):0;
  // Find the weakest item (min r/(r+w) with at least 2 attempts)
  const weakest=(()=>{
    const dm=detail[mode]||{};
    let worst=null,worstRate=1;
    Object.entries(dm).forEach(([k,v])=>{
      const t=v.r+v.w;if(t<2) return;
      const rate=v.r/t;if(rate<worstRate){worstRate=rate;worst={k,r:v.r,w:v.w};}
    });
    if(!worst) return null;
    const label=mode==='intervals'
      ?(IVALS.find(x=>x.s===+worst.k)||{name:worst.k}).name
      :mode==='triads'?(TRIAD_LBL[worst.k]||worst.k)
      :mode==='cadences'?((CADENCES.find(x=>x.id===worst.k)||{name:worst.k}).name)
      :(QLABELS[worst.k]||worst.k);
    return{label,missed:worst.w,total:worst.r+worst.w};
  })();

  // ── Choices grid ──
  function renderChoices(){
    const mkBtn=(key,onClick,label,isAns,isWrong)=>e('button',{key,onClick,disabled:revealed,style:{
      padding:'12px 8px',borderRadius:8,cursor:revealed?'default':'pointer',
      fontFamily:SERIF,fontSize:'0.95rem',fontWeight:700,minHeight:52,transition:'opacity 0.2s',
      border:'2px solid '+(isAns?GOLD:isWrong?'#FF6B6B':BTN_BRD),
      background:isAns?ACT_YEL:isWrong?ACT_RED:BG2,
      color:isAns?GOLD:isWrong?'#FF6B6B':BTN_OFF,
      opacity:revealed&&!isAns&&!isWrong?0.45:1
    }},label);
    if(mode==='intervals'){
      return choices.map(iv=>mkBtn(iv.s,()=>guess(iv.s),iv.name,
        revealed&&iv.s===current.semitones,revealed&&wrongGuess===iv.s));
    }
    if(mode==='cadences'){
      return choices.map(cad=>mkBtn(cad.id,()=>guess(cad.id),cad.name,
        revealed&&cad.id===current.cadence.id,revealed&&wrongGuess===cad.id));
    }
    const list=mode==='triads'?TRIAD_LIST:QUALITIES;
    const lbls=mode==='triads'?TRIAD_LBL:QLABELS;
    return list.map(q=>mkBtn(q,()=>guess(q),lbls[q],
      revealed&&q===current.quality,revealed&&wrongGuess===q));
  }

  // ── Reveal feedback ──
  function renderReveal(){
    if(!revealed) return null;
    let answerName,answerDesc;
    if(mode==='intervals'){
      const iv=IVALS.find(x=>x.s===current.semitones);
      answerName=iv?iv.name:'';answerDesc=iv?iv.feel:'';
    } else if(mode==='triads'){
      answerName=TRIAD_LBL[current.quality];answerDesc=TRIAD_DESC[current.quality];
    } else if(mode==='cadences'){
      answerName=current.cadence.name;answerDesc=current.cadence.feel;
    } else {
      answerName=QLABELS[current.quality];answerDesc=QDESCS[current.quality];
    }
    if(lastResult==='auto'){
      return e('div',{style:{textAlign:'center',marginBottom:14,padding:'12px 20px',
        background:BG2,border:'1px solid '+BORDER,borderRadius:8}},
        e('div',{style:{fontFamily:SERIF,fontSize:'1.1rem',color:GOLD,marginBottom:4}},answerName),
        e('div',{style:{fontSize:'0.77rem',color:HINT}},answerDesc)
      );
    }
    return e('div',{style:{textAlign:'center',marginBottom:14,padding:'12px 20px',
      background:lastResult==='right'?ACT_YEL:ACT_RED,
      border:'1px solid '+(lastResult==='right'?GOLD:'#FF6B6B'),borderRadius:8}},
      e('div',{style:{fontSize:'1.05rem',fontWeight:700,
        color:lastResult==='right'?GOLD:'#FF6B6B',marginBottom:4}},
        lastResult==='right'?'✓ Correct!':'✗ That was…'),
      e('div',{style:{fontFamily:SERIF,fontSize:'1.1rem',color:GOLD,marginBottom:4}},answerName),
      e('div',{style:{fontSize:'0.77rem',color:HINT}},answerDesc)
    );
  }

  const intervalHint=mode==='intervals'
    ?(harmonic?'Two notes played simultaneously — name the interval':'Two notes played ascending — name the interval')
    :null;
  const modeHint={
    intervals:intervalHint,
    triads:'Three-note chord — major, minor, diminished, or augmented?',
    chords:'Four-note chord — identify the 7th chord quality',
    cadences:'Two chords played in sequence — name the progression'
  };
  const TABS=[
    {id:'intervals',lbl:'Intervals',locked:false},
    {id:'triads',lbl:'Triads',locked:isEss},
    {id:'chords',lbl:'7th Chords',locked:isEss},
    {id:'cadences',lbl:'Cadences',locked:isEss},
  ];

  function toggleAuto(){
    if(!autoMode&&isEss){onUpgrade('Auto ear training');return;}
    if(!autoMode){
      // iOS requires both speech and Audio.play() to be called inside a user gesture
      if(window.speechSynthesis){window.speechSynthesis.cancel();window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));}
      const clips=Object.values(audioClipsRef.current);
      if(clips[0]){clips[0].play().then(()=>{clips[0].pause();clips[0].currentTime=0;}).catch(()=>{});}
      // Batch with newRound so mode + fresh question land in a single render (no intermediate flash)
      setAutoMode(true);
      newRound();
    } else {
      clearTimeout(autoTimerRef.current);
      clearTimeout(autoTimer2Ref.current);
      window.speechSynthesis?.cancel(); // may synchronously trigger utt.onerror → adv, which writes autoTimerRef
      clearTimeout(autoTimerRef.current); // clear any timer written by the onerror callback above
      setAutoMode(false);
    }
  }

  return e('div',{style:{padding:'0 0 20px'}},
    e('div',{style:{textAlign:'center',marginBottom:12}},
      e('div',{style:{fontFamily:SERIF,fontSize:'1.2rem',fontWeight:700,color:'var(--scale-name)',marginBottom:4}},'Ear Training'),
      autoMode
        ?e('div',{style:{fontSize:'0.78rem',color:HINT,fontFamily:UI_FONT}},'Auto mode — listen and learn, no scoring')
        :total>0?e('div',null,
          e('div',{style:{fontSize:'0.95rem',fontWeight:700,color:pct>=70?GOLD:'#FF6B6B'}},pct+'% — '+sc.r+'/'+total),
          weakest?e('div',{style:{fontSize:'0.7rem',color:HINT,marginTop:3}},
            '⚠ Weakest: '+weakest.label+' ('+weakest.missed+'/'+weakest.total+' missed)'):null,
          total>=20&&pct>=80&&isEss&&mode==='intervals'?e('div',{style:{
            fontSize:'0.72rem',color:'#86EFAC',marginTop:6,padding:'4px 8px',
            borderRadius:6,border:'1px solid #86EFAC44',background:'#86EFAC11',lineHeight:1.5}},
            '🎉 Great ear! Try Pro to unlock all 12 intervals, triads, and 7th chords.'):null
          ):null
    ),
    e('div',{'data-tour':'ear-mode-tabs',style:{display:'flex',gap:2,marginBottom:0,alignItems:'flex-end'}},
      isEss
        ?[e('button',{key:'intervals',onClick:()=>setMode('intervals'),style:{
            padding:'7px 16px',borderRadius:'6px 6px 0 0',cursor:'pointer',
            fontFamily:UI_FONT,fontSize:'0.79rem',fontWeight:mode==='intervals'?700:400,
            border:'1px solid '+BTN_BRD,borderBottom:mode==='intervals'?'1px solid '+BG2:'1px solid '+BTN_BRD,
            background:mode==='intervals'?BG2:'transparent',color:mode==='intervals'?'var(--txt)':BTN_OFF,
            marginBottom:mode==='intervals'?'-1px':0,position:'relative',zIndex:mode==='intervals'?1:0,minHeight:44
          }},'Intervals'),
          e('button',{key:'pro-unlock',onClick:()=>onUpgrade('Triads, 7th Chords & Cadences'),style:{
            padding:'7px 16px',borderRadius:'6px 6px 0 0',cursor:'pointer',
            fontFamily:UI_FONT,fontSize:'0.79rem',fontWeight:400,
            border:'1px solid '+GOLD,borderBottom:'1px solid '+BTN_BRD,
            background:'transparent',color:GOLD,minHeight:44,opacity:0.8
          }},'3 more modes ',e('span',{style:{fontSize:'0.6rem'}},'🔒'))]
        :TABS.map(({id,lbl,locked})=>e('button',{key:id,onClick:locked?()=>onUpgrade(lbl):()=>setMode(id),style:{
            padding:'7px 16px',borderRadius:'6px 6px 0 0',cursor:'pointer',
            fontFamily:UI_FONT,fontSize:'0.79rem',fontWeight:mode===id?700:400,
            border:'1px solid '+BTN_BRD,borderBottom:mode===id?'1px solid '+BG2:'1px solid '+BTN_BRD,
            background:mode===id?BG2:'transparent',color:mode===id?'var(--txt)':BTN_OFF,
            marginBottom:mode===id?'-1px':0,position:'relative',zIndex:mode===id?1:0,minHeight:44,
            ...(locked?{opacity:0.6}:{})
          }},lbl,(locked?e('span',{style:{fontSize:'0.6rem',marginLeft:2}},'🔒'):null)))
    ),
    e('div',{style:{display:'flex',justifyContent:'flex-end',marginTop:4,marginBottom:4}},
      e('button',{onClick:toggleAuto,title:autoMode?'Turn off auto-advance':'Auto-advance: hear the answer, then next question',
        style:{padding:'5px 10px',borderRadius:8,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
          fontWeight:autoMode?700:400,border:'1px solid '+(autoMode?GOLD:BTN_BRD),
          background:autoMode?ACT_GOLD:'transparent',color:autoMode?GOLD:BTN_OFF,
          minHeight:40,flexShrink:0,whiteSpace:'nowrap'}},
        autoMode?'Auto ●':e(React.Fragment,null,'Auto ○',(isEss?e('span',{style:{fontSize:'0.6rem',marginLeft:3}},'🔒'):null)))
    ),
    e('div',{style:{background:BG2,border:'1px solid '+BTN_BRD,
      borderRadius:'0 6px 6px 6px',padding:'16px',marginBottom:12}},
      e('div',{style:{fontSize:'0.74rem',color:HINT,textAlign:'center',marginBottom:mode==='intervals'?4:14,letterSpacing:'0.3px'}},
        modeHint[mode]),
      mode==='intervals'&&!isEss?e('div',{style:{display:'flex',gap:6,justifyContent:'center',marginBottom:14}},
        e('button',{onClick:()=>setHarmonic(false),style:{
          padding:'4px 12px',borderRadius:6,cursor:'pointer',fontSize:'0.72rem',fontWeight:!harmonic?700:400,
          border:'1px solid '+(!harmonic?GOLD:BTN_BRD),background:!harmonic?ACT_YEL:'transparent',
          color:!harmonic?GOLD:BTN_OFF,minHeight:30
        }},'Ascending ↑'),
        e('button',{onClick:()=>setHarmonic(true),style:{
          padding:'4px 12px',borderRadius:6,cursor:'pointer',fontSize:'0.72rem',fontWeight:harmonic?700:400,
          border:'1px solid '+(harmonic?GOLD:BTN_BRD),background:harmonic?ACT_YEL:'transparent',
          color:harmonic?GOLD:BTN_OFF,minHeight:30
        }},'♪♪ Harmonic')
      ):mode==='intervals'?e('div',{style:{marginBottom:10}}):null,
      mode==='intervals'?e('div',{style:{marginBottom:14}},
        e('div',{style:{fontSize:'0.66rem',color:HINT,textAlign:'center',marginBottom:6,letterSpacing:'0.3px'}},'Difficulty — add intervals as your ear grows'),
        e('div',{style:{display:'flex',gap:6,justifyContent:'center',flexWrap:'wrap'}},
          IVAL_TIERS.map((t,i)=>{const tn=i+1,locked=isEss&&tn>2,active=effTier===tn;
            return e('button',{key:tn,onClick:locked?()=>onUpgrade('All 12 intervals'):()=>setIvalTier(tn),style:{
              padding:'4px 10px',borderRadius:6,cursor:'pointer',fontSize:'0.7rem',fontWeight:active?700:400,
              border:'1px solid '+(active?GOLD:BTN_BRD),background:active?ACT_YEL:'transparent',
              color:active?GOLD:BTN_OFF,minHeight:30,opacity:locked?0.6:1}},
              'Lv'+tn+' · '+t.lbl,(locked?e('span',{style:{fontSize:'0.58rem',marginLeft:2}},'🔒'):null));
          })
        )
      ):null,
      mode==='cadences'&&isEss?e('div',{style:{fontSize:'0.7rem',color:HINT,textAlign:'center',marginBottom:14}},
        'Essentials: ii–V and V–I  →  Pro unlocks ii–V–I, I–VI, and iv–I'
      ):null,
      e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:8,marginBottom:16}},
        e('div',{style:{display:'flex',alignItems:'center',gap:20}},
          e('button',{onClick:autoMode?replayCurrent:goBack,'aria-label':'Previous question',
            disabled:autoMode,style:{
            width:44,height:44,borderRadius:'50%',border:'1px solid '+BTN_BRD,
            background:'transparent',color:BTN_OFF,fontSize:'1.2rem',
            cursor:autoMode?'default':'pointer',opacity:autoMode?0.35:1,
            display:'flex',alignItems:'center',justifyContent:'center'
          }},'←'),
          e('button',{'data-tour':'ear-play-btn',onClick:replayCurrent,style:{
            width:72,height:72,borderRadius:'50%',border:'2px solid '+GOLD,
            background:ACT_YEL,color:GOLD,fontSize:'2rem',cursor:'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:'0 0 16px '+GOLD+'44',transition:'box-shadow 0.15s'
          }},'♪'),
          e('button',{onClick:!autoMode&&revealed?nextRound:replayCurrent,'aria-label':'Next',
            disabled:autoMode,style:{
            width:44,height:44,borderRadius:'50%',
            border:'1px solid '+(!autoMode&&revealed?GOLD:BTN_BRD),
            background:!autoMode&&revealed?ACT_YEL:'transparent',
            color:!autoMode&&revealed?GOLD:BTN_OFF,
            fontSize:'1.2rem',cursor:autoMode?'default':'pointer',
            display:'flex',alignItems:'center',justifyContent:'center',
            opacity:autoMode?0.35:1
          }},'→')
        ),
        e('div',{style:{fontSize:'0.72rem',color:HINT}},
          autoMode&&!revealed?'Listen… answer coming':autoMode&&revealed?'Next question coming…':'Tap to replay')
      ),
      renderReveal(),
      !revealed&&mode==='intervals'?e('div',{style:{marginBottom:12}},
        e('details',{style:{cursor:'pointer'}},
          e('summary',{style:{fontSize:'0.7rem',color:HINT,userSelect:'none',letterSpacing:'0.3px',listStyle:'none',textAlign:'center'}},
            '▸ Song reference hints'),
          e('div',{style:{marginTop:8,display:'grid',gridTemplateColumns:'1fr 1fr',gap:4}},
            activeIvals.map(iv=>
              e('div',{key:iv.s,style:{fontSize:'0.68rem',color:HINT,padding:'3px 6px',
                borderRadius:4,border:'1px solid '+BORDER,lineHeight:1.4}},
                e('span',{style:{color:BTN_OFF,fontWeight:600}},(['P1','m2','M2','m3','M3','P4','TT','P5','m6','M6','m7','M7','P8'][iv.s]||iv.name),' '),
                iv.feel
              )
            )
          )
        )
      ):null,
      current?e('div',{'data-tour':'ear-choices',style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:revealed?12:0}},
        renderChoices()
      ):null,
    ),
    !autoMode?e('button',{onClick:()=>{setScores(s=>({...s,[mode]:{r:0,w:0}}));setDetail(d=>({...d,[mode]:{}}));},style:{
      width:'100%',padding:'6px',background:'transparent',
      border:'1px solid '+BTN_BRD,borderRadius:6,color:BTN_OFF,
      fontFamily:UI_FONT,fontSize:'0.78rem',cursor:'pointer',minHeight:44
    }},'Reset score'):null
  );
}

// ── Tour ──────────────────────────────────────────────────────────────
const OVERVIEW_STEPS=[
  {target:'nav-guide',    view:'guide',
   title:'The Guide — your learning path',
   text:'Work through jazz harmony step by step. Each stage explains one concept and opens the right tool already configured. Start here.'},
  {target:'nav-diatonic', view:'diatonic',
   title:'Keys — see all 7 chords in any key',
   text:'Tap any chord to hear it and see exactly how to play it. Change the key chip at the top and everything updates instantly.'},
  {target:'nav-custom',   view:'custom',
   title:'Chords — explore freely',
   text:'Pick any root and chord quality to see all its voicings. Useful for chords from charts or songs you\'re working on.'},
  {target:'nav-iivi',     view:'iivi',
   title:'Play — back-track practice',
   text:'Play ii-V-Is and jazz standards with bass and drums. Set your key, choose a tempo, and practice playing along.'},
  {target:'nav-quiz',     view:'quiz',
   title:'Ear Training — recognize what you hear',
   text:'Identify intervals and chord qualities by ear. Essentials starts with the five most consonant sounds; Pro unlocks all twelve.',
   proText:'Identify intervals and chord qualities by ear — all twelve intervals, plus triads, 7th chords, and cadences.'},
  {target:'page-tour-btn', view:'guide',
   title:'Page tours',
   text:'Each section has its own guided walkthrough. Tap the gold "? Tour" button at the top right whenever you want to learn what you\'re looking at.'},
  {target:'ear-mode-tabs', view:'quiz',
   essentialsOnly:true,
   title:'One price, everything — forever',
   text:'Essentials is free: shells, major ii–V–I, 5 ear training intervals. Pro is $9.99 once — no subscription, no future paywalls. Every voicing, play form, standard, ear training mode, and chord type we ever add is included. Look for 🔒 to see what unlocks now.'},
];

const PAGE_TOURS={
  diatonic:[
    {target:'key-chip',       title:'Set your key',
     text:'Tap to pick any key. Every chord and scale in the app updates to match.'},
    {target:'voicing-tabs',   title:'Essentials vs Pro voicings',
     text:'Shell voicings are free. Drop 2, Drop 3, and Rootless unlock with Pro — tap any 🔒 to learn more.',
     proTitle:'Voicing types',
     proText:'Shell, Drop 2, Drop 3, and Rootless. Shell uses just 3 strings — the simplest start. Drop 2 gives the full comping sound. Tap each to see and hear it.'},
    {target:'chord-row',      title:'The 7 chords in a key',
     text:'Each button is one of the chords that naturally occurs in this key. Roman numerals (I–VII) show position — I is home, V is tension.'},
    {target:'voicing-tabs',   title:'How to play each chord',
     text:'Shell uses just 3 strings — the easiest start. Drop 2 gives the full comping sound. Try each and listen.'},
    {target:'neck-area',      title:'The fretboard',
     text:'Bright dots show the selected voicing. Dim dots show every other position of those same notes on the neck. Tap any dot to hear that note.'},
    {target:'diatonic-explore',title:'Explore any chord further',
     text:'Tap "Explore ↗" to jump to the Chords view with this chord already loaded — see every voicing type, add extensions, and look up which keys it belongs to.'},
  ],
  iivi:[
    {target:'play-form-row',  title:'Choose a progression',
     text:'Pick a form — ii-V-I is the foundation of jazz harmony. Pro unlocks 5 jazz standards: Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, and There Will Never Be Another You.',
     proText:'Pick a form — ii-V-I is the foundation of jazz harmony. You\'ve also got 5 jazz standards: Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, and There Will Never Be Another You.'},
    {target:'play-transport', title:'Play controls',
     text:'Hit the green button for a 4-count-in, then the loop begins. BPM knob sets tempo — start at 60 and build up.'},
    {target:'bar-grid',       title:'Follow the chord changes',
     text:'The gold-pulsing bar shows the current chord. Watch it cycle and play along.'},
    {target:'neck-area',      title:'Comp along',
     text:'The fretboard shows the voicing for the active chord. Find it, hold it, play the rhythm.'},
    {target:'play-transport', title:'Bluetooth pedal supported',
     text:'Using an AirTurn or PageFlip pedal? Forward steps to the next chord, back steps to the previous — hands stay on the guitar. Works in Keys, Chords, and Ear Training too.'},
  ],
  guide:[
    {target:'guide-stage-0',  title:'Stage cards',
     text:'Each card explains one concept. "Open in app" switches to the right view already set up for that lesson.'},
    {target:'guide-progress', title:'Track your progress',
     text:'Mark stages done as you finish them. Go at whatever pace your practice time allows — there\'s no clock here.'},
    {target:'guide-glossary', title:'The Glossary',
     text:'Every term in the app is defined here. Tap any underlined term in the stage text to see its definition instantly.'},
  ],
  quiz:[
    {target:'ear-mode-tabs', title:'Three training modes',
     text:'Start with Intervals — they\'re the building blocks. Triads and 7th Chords unlock in Pro.',
     proText:'Start with Intervals — they\'re the building blocks. Triads, 7th Chords, and Cadences are here too.'},
    {target:'ear-play-btn',  title:'Listen, then answer',
     text:'Tap the gold circle to hear the sound. Replay as many times as you need before choosing.'},
    {target:'ear-choices',   title:'Learn from every answer',
     text:'Wrong answers show you the correct answer immediately. Your score tracks your weakest intervals.'},
  ],
  custom:[
    {target:'chord-type-tabs', title:'Pick any chord type',
     text:'Choose a quality — major 7, minor 7, dominant, and more in Pro.',
     proText:'Choose a quality — major 7, minor 7, dominant, and every extended chord.'},
    {target:'neck-area',       title:'See all voicings',
     text:'Every playable shape appears below. Tap any diagram to hear it. Tap any dot on the neck to hear that individual note.'},
    {target:'custom-inkey',    title:'Find this chord in a key',
     text:'Tap "In a key ↗" to jump to the Keys view and see where this exact chord naturally fits in the diatonic harmony of any key.'},
  ],
};

// Adapt tour steps to the user's tier. Pro users already paid — drop the
// pricing pitch entirely and swap any "unlocks with Pro" copy for plain
// descriptions of what they have.
function tourStepsFor(steps,isPro){
  if(!isPro) return steps;
  return steps
    .filter(s=>!s.essentialsOnly)
    .map(s=>(s.proText||s.proTitle)
      ?{...s,...(s.proTitle?{title:s.proTitle}:null),...(s.proText?{text:s.proText}:null)}
      :s);
}

function TourOverlay({steps,step,onNext,onSkip}){
  const [rect,setRect]=useState(null);
  const s=steps[step];
  useEffect(()=>{
    if(!s){setRect(null);return;}
    let pollActive=true;
    let pollRafId=null;
    let eventRafId=null;
    function measure(){
      const el=document.querySelector('[data-tour="'+s.target+'"]');
      if(el){
        const r=el.getBoundingClientRect();
        setRect(prev=>{
          if(prev&&Math.abs(prev.top-r.top)<0.5&&Math.abs(prev.left-r.left)<0.5
            &&Math.abs(prev.w-r.width)<0.5&&Math.abs(prev.h-r.height)<0.5) return prev;
          return {top:r.top,left:r.left,w:r.width,h:r.height};
        });
      } else setRect(null);
      return !!el;
    }
    // Poll every frame for 2s to catch iOS address-bar / Shared-with-You banner
    // collapse and any late layout shifts. Separate rAF chain so events below
    // don't accidentally cancel the poll loop.
    function poll(){if(!pollActive) return; measure(); pollRafId=requestAnimationFrame(poll);}
    pollRafId=requestAnimationFrame(poll);
    const stopPoll=setTimeout(()=>{pollActive=false;},2000);
    // After the poll window, events keep the rect current. window.resize catches
    // browser-chrome changes (address bar, iOS Shared-with-You banner, keyboard)
    // that visualViewport.resize might not fire for.
    const vv=window.visualViewport;
    function onEvent(){cancelAnimationFrame(eventRafId); eventRafId=requestAnimationFrame(measure);}
    window.addEventListener('scroll',onEvent,{passive:true});
    window.addEventListener('resize',onEvent);
    vv&&vv.addEventListener('resize',onEvent); vv&&vv.addEventListener('scroll',onEvent);
    return ()=>{
      pollActive=false;
      cancelAnimationFrame(pollRafId); cancelAnimationFrame(eventRafId);
      clearTimeout(stopPoll);
      window.removeEventListener('scroll',onEvent);
      window.removeEventListener('resize',onEvent);
      vv&&vv.removeEventListener('resize',onEvent); vv&&vv.removeEventListener('scroll',onEvent);
    };
  },[step,s&&s.target]);

  if(!s) return null;
  const isLast=step>=steps.length-1;
  const PAD=8;
  const DIM='rgba(0,0,0,0.75)';

  // Spotlight: 4 dark panels leaving target exposed
  const overlay=rect?[
    e('div',{key:'ot',onClick:onSkip,style:{position:'absolute',top:0,left:0,right:0,
      height:Math.max(0,rect.top-PAD),background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ob',onClick:onSkip,style:{position:'absolute',left:0,right:0,bottom:0,
      top:rect.top+rect.h+PAD,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ol',onClick:onSkip,style:{position:'absolute',top:rect.top-PAD,
      left:0,width:Math.max(0,rect.left-PAD),
      height:rect.h+PAD*2,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'or',onClick:onSkip,style:{position:'absolute',top:rect.top-PAD,
      left:rect.left+rect.w+PAD,right:0,
      height:rect.h+PAD*2,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ring',style:{position:'absolute',
      top:rect.top-PAD,left:rect.left-PAD,
      width:rect.w+PAD*2,height:rect.h+PAD*2,
      border:'2px solid var(--gold)',borderRadius:8,
      boxShadow:'0 0 12px var(--gold)',pointerEvents:'none'}}),
  ]:e('div',{onClick:onSkip,style:{position:'absolute',inset:0,background:DIM,pointerEvents:'auto'}});

  // Tooltip: place below target if it fits, else above; clamp horizontally
  let tipTop=null,tipBottom=null;
  if(rect){
    const vp=(window.visualViewport?.height||window.innerHeight)||600;
    const below=rect.top+rect.h+PAD+16;
    if(below+220<vp) tipTop=below;
    else tipBottom=vp-(rect.top-PAD-12);
  } else {
    tipBottom=90;
  }
  const tipLeft='50%';

  return e('div',{style:{position:'fixed',inset:0,zIndex:200}},
    overlay,
    e('div',{style:{
      position:'absolute',
      ...(tipTop!==null?{top:tipTop}:{bottom:tipBottom}),
      left:tipLeft,transform:'translateX(-50%)',
      width:'min(360px,90vw)',background:'var(--bg2)',border:'1px solid var(--brd)',
      borderRadius:12,padding:'16px 18px',pointerEvents:'auto',
      boxShadow:'0 8px 32px rgba(0,0,0,0.5)',zIndex:201
    }},
      e('div',{style:{fontSize:'0.67rem',color:GOLD,letterSpacing:'0.5px',marginBottom:5}},
        (step+1)+' / '+steps.length),
      e('div',{style:{fontFamily:SERIF,fontSize:'1.0rem',fontWeight:700,color:'var(--scale-name)',marginBottom:7}},s.title),
      e('div',{style:{fontSize:'0.81rem',color:'var(--txt)',lineHeight:1.65,marginBottom:14,opacity:0.85}},s.text),
      e('div',{style:{display:'flex',gap:8,justifyContent:'flex-end'}},
        e('button',{onClick:onSkip,style:{padding:'6px 14px',borderRadius:8,border:'1px solid var(--brd)',
          background:'transparent',color:BTN_OFF,fontFamily:UI_FONT,fontSize:'0.79rem',cursor:'pointer',minHeight:44}},
          'Skip tour'),
        e('button',{onClick:onNext,style:{padding:'6px 20px',borderRadius:8,border:'none',
          background:GOLD,color:'var(--bg)',fontFamily:UI_FONT,fontSize:'0.82rem',
          fontWeight:700,cursor:'pointer',minHeight:44}},
          isLast?'Done':'Next →')
      )
    )
  );
}

// ── NeckSVG ───────────────────────────────────────────────────────────
const NeckSVG=React.memo(function NeckSVG({arpPos,highlight,scalePos,extraDots,degNames,hlTc,dotMode,dotKeyIdx}){
  hlTc=hlTc||TC;
  dotMode=dotMode||'interval';
  dotKeyIdx=dotKeyIdx===undefined?0:dotKeyIdx;
  const FW=44,SH=30,PL=38,PT=28,PB=36,NF=15;
  const W=PL+NF*FW+24,H=PT+5*SH+PB;
  const nx=f=>PL+(f-0.5)*FW;
  const sy=si=>PT+(5-si)*SH;
  const hiMap={};
  (highlight||[]).forEach(h=>{hiMap[h.s+'-'+h.f]=h;});
  // Finger assignments for highlight dots (used when dotMode==='finger')
  const hiFingerMap={};
  if(dotMode==='finger'&&highlight){
    const played=highlight.filter(h=>h.f>0).sort((a,b)=>a.f-b.f);
    const groups=[];
    played.forEach(h=>{
      if(!groups.length||groups[groups.length-1].f!==h.f) groups.push({f:h.f,strings:[h.s]});
      else groups[groups.length-1].strings.push(h.s);
    });
    groups.forEach((g,gi)=>{if(gi<4) g.strings.forEach(s=>{hiFingerMap[s]=gi+1;});});
  }
  const OPEN_X=PL-5; // x-position for fret-0 (open string) indicators, sits within nut
  const SINGLE_INLAYS=[3,5,7,9,15];

  return e('svg',{width:'100%',viewBox:`0 0 ${W} ${H}`,style:{display:'block',WebkitTransform:'translateZ(0)',transform:'translateZ(0)'}},
    e('defs',null,
      e('filter',{id:'ng',x:'-60%',y:'-60%',width:'220%',height:'220%'},
        e('feGaussianBlur',{stdDeviation:'3.5',result:'b'}),
        e('feMerge',null,e('feMergeNode',{in:'b'}),e('feMergeNode',{in:'SourceGraphic'}))
      ),
      e('linearGradient',{id:'neckBg',x1:'0',y1:'0',x2:'1',y2:'0'},
        e('stop',{offset:'0%',style:{stopColor:'var(--neck-wood1)'}}),
        e('stop',{offset:'60%',style:{stopColor:'var(--neck-wood2)'}}),
        e('stop',{offset:'100%',style:{stopColor:'var(--neck-wood3)'}})
      ),
      e('linearGradient',{id:'nutG',x1:'0',y1:'0',x2:'0',y2:'1'},
        e('stop',{offset:'0%',stopColor:'#e8c870'}),
        e('stop',{offset:'100%',stopColor:'#b8922a'})
      )
    ),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'url(#neckBg)'}),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'none',style:{stroke:'var(--neck-edge)'},strokeWidth:1}),
    e('rect',{x:PL-9,y:PT-11,width:8,height:5*SH+22,fill:'url(#nutG)',rx:2}),
    Array.from({length:NF},(_,k)=>k+1).map(k=>
      e('line',{key:'fl'+k,x1:PL+k*FW,y1:PT-10,x2:PL+k*FW,y2:PT+5*SH+10,
        style:{stroke:k===12?'var(--neck-fret12)':'var(--neck-fret)'},strokeWidth:k===12?2.5:1.5})
    ),
    SINGLE_INLAYS.map(f=>
      e('ellipse',{key:'il'+f,cx:nx(f),cy:PT+2.5*SH,rx:5.5,ry:4.5,style:{fill:'var(--neck-inlay)'}})
    ),
    e('ellipse',{key:'12a',cx:nx(12),cy:PT+1.5*SH,rx:5.5,ry:4.5,style:{fill:'var(--neck-inlay)'}}),
    e('ellipse',{key:'12b',cx:nx(12),cy:PT+3.5*SH,rx:5.5,ry:4.5,style:{fill:'var(--neck-inlay)'}}),
    Array.from({length:6},(_,si)=>
      e('line',{key:'st'+si,x1:PL-22,y1:sy(si),x2:PL+NF*FW+8,y2:sy(si),
        stroke:`rgba(220,195,130,${0.30+si*0.09})`,strokeWidth:0.4+si*0.26})
    ),
    [1,3,5,7,9,12,15].map(f=>
      e('text',{key:'fn'+f,x:nx(f),y:H-6,textAnchor:'middle',style:{fill:'var(--neck-lbl)'},fontSize:13,fontFamily:UI_FONT},f)
    ),
    STR_NAMES.map((n,si)=>
      e('text',{key:'sl'+si,x:PL-26,y:sy(si),textAnchor:'end',dominantBaseline:'middle',
        style:{fill:'var(--neck-lbl)'},fontSize:9.5,fontFamily:UI_FONT},n)
    ),
    (scalePos||[]).map((p,i)=>
      e('g',{key:'sp'+i},
        e('circle',{cx:nx(p.f),cy:sy(p.s),r:5.5,fill:'var(--scale-circ)',stroke:'var(--scale-circ-str)',strokeWidth:1}),
        e('text',{x:nx(p.f),y:sy(p.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'var(--scale-circ-txt)',fontSize:6,fontFamily:UI_FONT,pointerEvents:'none'},INT_NAMES[p.interval])
      )
    ),
    arpPos.map((p,i)=>{
      if(hiMap[p.s+'-'+p.f]) return null;
      const cx=p.f===0?OPEN_X:nx(p.f);
      const playDot=()=>{try{const ctx=_getPreviewCtx();if(!ctx)return;const midi=OPEN_MIDI[p.s]+p.f;if(_guitarBufs)_playSampledNote(ctx,midi,ctx.currentTime+0.04,0.55,1.8);else _playKSNote(ctx,midi,ctx.currentTime+0.04,0.5);}catch(ex){}};
      return e('g',{key:'ap'+i,onClick:playDot,style:{cursor:'pointer'}},
        e('circle',{cx,cy:sy(p.s),r:10,style:{fill:'var(--tc-dim-'+p.ti+')'},stroke:TC[p.ti],strokeWidth:1.3}),
        e('text',{x:cx,y:sy(p.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'#fff',fontSize:7.5,fontFamily:UI_FONT,pointerEvents:'none'},
          noteForDot(dotMode,degNames[p.ti],(OPEN_PC[p.s]+p.f)%12,dotKeyIdx))
      );
    }),
    (highlight||[]).map((h,i)=>{
      const cx=h.f===0?OPEN_X:nx(h.f);
      const lbl=dotMode==='finger'
        ?(h.f>0&&hiFingerMap[h.s]!=null?String(hiFingerMap[h.s]):'')
        :noteForDot(dotMode,h.dl,(OPEN_PC[h.s]+h.f)%12,dotKeyIdx);
      const playDot=()=>{try{const ctx=_getPreviewCtx();if(!ctx)return;const midi=OPEN_MIDI[h.s]+h.f;if(_guitarBufs)_playSampledNote(ctx,midi,ctx.currentTime+0.04,0.65,2.0);else _playKSNote(ctx,midi,ctx.currentTime+0.04,0.55);}catch(ex){}};
      return e('g',{key:'hi'+i,filter:'url(#ng)',onClick:playDot,style:{cursor:'pointer'}},
        e('circle',{cx,cy:sy(h.s),r:h.f===0?11:13,fill:hlTc[h.ti],stroke:'var(--hi-dot-str)',strokeWidth:1.8}),
        e('text',{x:cx,y:sy(h.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'var(--dot-lbl)',fontSize:dotMode==='finger'?11:10,fontWeight:'bold',fontFamily:UI_FONT},lbl)
      );
    }),
    (extraDots||[]).map((d,i)=>{
      const cx=nx(d.f);
      return e('g',{key:'gt'+i},
        e('rect',{x:cx-7,y:sy(d.s)-7,width:14,height:14,rx:2,
          fill:d.color+'22',stroke:d.color,strokeWidth:1.5,
          transform:'rotate(45,'+cx+','+sy(d.s)+')'}),
        e('text',{x:cx,y:sy(d.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:d.color,fontSize:6.5,fontWeight:700,fontFamily:UI_FONT,pointerEvents:'none'},d.role)
      );
    })
  );
});

// ── DetectNeckSVG ─────────────────────────────────────────────────────
// Interactive fretboard for Find Chord mode. Tap any position to toggle
// note selection; shows 5 frets at once, navigated via fretOffset.
function DetectNeckSVG({selectedFrets,fretOffset,onToggle,completionPcs}){
  const FW=52,SH=38,PL=38,PT=26,PB=26;
  const NF=5;
  const W=PL+NF*FW+24,H=PT+5*SH+PB;
  const showOpen=fretOffset===0;
  const DN=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  const nx=wf=>PL+(wf-0.5)*FW;
  const OPEN_X=PL-15;
  const sy=si=>PT+(5-si)*SH;
  const cpSet=new Set(completionPcs||[]);
  const COMP_C='#74C0FC'; // blue hint dots for missing chord tones

  function tap(si,fret){
    try{const ctx=_getPreviewCtx();if(ctx){const midi=OPEN_MIDI[si]+fret;if(_guitarBufs)_playSampledNote(ctx,midi,ctx.currentTime+0.04,0.5,1.6);else _playKSNote(ctx,midi,ctx.currentTime+0.04,0.45);}}catch(ex){}
    onToggle(si,fret);
  }

  return e('svg',{width:'100%',viewBox:`0 0 ${W} ${H}`,style:{display:'block',WebkitTapHighlightColor:'transparent'}},
    e('defs',null,
      e('filter',{id:'dng',x:'-60%',y:'-60%',width:'220%',height:'220%'},
        e('feGaussianBlur',{stdDeviation:'3',result:'b'}),
        e('feMerge',null,e('feMergeNode',{in:'b'}),e('feMergeNode',{in:'SourceGraphic'}))
      ),
      e('filter',{id:'dnh',x:'-60%',y:'-60%',width:'220%',height:'220%'},
        e('feGaussianBlur',{stdDeviation:'2',result:'b'}),
        e('feMerge',null,e('feMergeNode',{in:'b'}),e('feMergeNode',{in:'SourceGraphic'}))
      ),
      e('linearGradient',{id:'dnBg',x1:'0',y1:'0',x2:'1',y2:'0'},
        e('stop',{offset:'0%',style:{stopColor:'var(--neck-wood1)'}}),
        e('stop',{offset:'60%',style:{stopColor:'var(--neck-wood2)'}}),
        e('stop',{offset:'100%',style:{stopColor:'var(--neck-wood3)'}})
      ),
      e('linearGradient',{id:'dnNut',x1:'0',y1:'0',x2:'0',y2:'1'},
        e('stop',{offset:'0%',stopColor:'#e8c870'}),
        e('stop',{offset:'100%',stopColor:'#b8922a'})
      )
    ),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'url(#dnBg)'}),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'none',style:{stroke:'var(--neck-edge)'},strokeWidth:1}),
    showOpen
      ?e('rect',{x:PL-9,y:PT-11,width:8,height:5*SH+22,fill:'url(#dnNut)',rx:2})
      :e('text',{x:3,y:PT+2.5*SH,dominantBaseline:'middle',style:{fill:'var(--neck-lbl)'},fontSize:10,fontFamily:UI_FONT},(fretOffset+1)+'fr'),
    ...Array.from({length:NF},(_,k)=>e('line',{key:'dfl'+k,
      x1:PL+(k+1)*FW,y1:PT-10,x2:PL+(k+1)*FW,y2:PT+5*SH+10,
      style:{stroke:'var(--neck-fret)'},strokeWidth:1.5})),
    ...Array.from({length:6},(_,si)=>e('line',{key:'dsl'+si,
      x1:PL-22,y1:sy(si),x2:PL+NF*FW+8,y2:sy(si),
      stroke:`rgba(220,195,130,${0.30+si*0.09})`,strokeWidth:0.4+si*0.26})),
    ...Array.from({length:NF},(_,k)=>e('text',{key:'dfn'+k,
      x:nx(k+1),y:H-6,textAnchor:'middle',style:{fill:'var(--neck-lbl)'},fontSize:11,fontFamily:UI_FONT},fretOffset+(k+1))),
    ...STR_NAMES.map((n,si)=>e('text',{key:'dsn'+si,x:PL-26,y:sy(si),
      textAnchor:'end',dominantBaseline:'middle',style:{fill:'var(--neck-lbl)'},fontSize:9.5,fontFamily:UI_FONT},n)),
    ...(showOpen?Array.from({length:6},(_,si)=>{
      const isSel=selectedFrets[si]===0;
      const pc=OPEN_PC[si];
      const isHint=!isSel&&cpSet.has(pc);
      return e('g',{key:'dop'+si,onClick:()=>tap(si,0),style:{cursor:'pointer'}},
        e('circle',{cx:OPEN_X,cy:sy(si),r:isSel?13:isHint?11:8,
          fill:isSel?'var(--gold)':isHint?COMP_C+'33':'transparent',
          stroke:isSel?'var(--hi-dot-str)':isHint?COMP_C:'rgba(255,255,255,0.25)',
          strokeWidth:isSel?1.8:isHint?1.5:1,
          strokeDasharray:isHint?'3 2':null}),
        (isSel||isHint)?e('text',{x:OPEN_X,y:sy(si),textAnchor:'middle',dominantBaseline:'middle',
          fill:isSel?'var(--dot-lbl)':COMP_C,fontSize:8,fontWeight:'bold',fontFamily:UI_FONT,pointerEvents:'none'},DN[pc]):null
      );
    }):[]),
    ...Array.from({length:NF},(_,wf)=>Array.from({length:6},(_,si)=>{
      const actF=fretOffset+wf+1;
      const isSel=selectedFrets[si]===actF;
      const pc=(OPEN_PC[si]+actF)%12;
      const isHint=!isSel&&cpSet.has(pc);
      const cx=nx(wf+1),cy=sy(si);
      return e('g',{key:'dfp'+wf+'-'+si,onClick:()=>tap(si,actF),style:{cursor:'pointer'}},
        e('rect',{x:cx-FW*0.48,y:cy-SH*0.48,width:FW*0.96,height:SH*0.96,fill:'transparent',pointerEvents:'all'}),
        isSel
          ?e('g',{filter:'url(#dng)'},
            e('circle',{cx,cy,r:13,fill:'var(--gold)',stroke:'var(--hi-dot-str)',strokeWidth:1.8}),
            e('text',{x:cx,y:cy,textAnchor:'middle',dominantBaseline:'middle',
              fill:'var(--dot-lbl)',fontSize:8,fontWeight:'bold',fontFamily:UI_FONT,pointerEvents:'none'},DN[pc])
          )
          :isHint
          ?e('g',{filter:'url(#dnh)'},
            e('circle',{cx,cy,r:11,fill:COMP_C+'33',stroke:COMP_C,strokeWidth:1.5,strokeDasharray:'3 2'}),
            e('text',{x:cx,y:cy,textAnchor:'middle',dominantBaseline:'middle',
              fill:COMP_C,fontSize:8,fontWeight:'bold',fontFamily:UI_FONT,pointerEvents:'none'},DN[pc])
          )
          :e('circle',{cx,cy,r:7,fill:'transparent',stroke:'rgba(255,255,255,0.2)',strokeWidth:1})
      );
    })).flat()
  );
}

// ── ScrollNeck ────────────────────────────────────────────────────────
// Full-width neck that scrolls only when the active voicing would be off-screen.
// Targets iPad layout (720px content); on iPhone it scrolls to keep dots visible.
const ScrollNeck=React.memo(function ScrollNeck({arpPos,highlight,scalePos,extraDots,degNames,hlTc,dotMode,dotKeyIdx,
  marginBottom,dataTour}){
  const scrollRef=useRef(null);
  const FW=44,PL=38,SVG_W=PL+15*FW+24; // 722 — matches NeckSVG W
  useEffect(()=>{
    const el=scrollRef.current;
    if(!el) return;
    const frets=(highlight||[]).filter(h=>h.f>0).map(h=>h.f);
    if(!frets.length) return;
    const lo=Math.min(...frets),hi=Math.max(...frets);
    const scale=el.scrollWidth/SVG_W;
    const voiceLeft=(PL+(lo-1)*FW)*scale-20;
    const voiceRight=(PL+hi*FW)*scale+20;
    const sl=el.scrollLeft,vw=el.clientWidth;
    if(voiceLeft<sl){
      el.scrollTo({left:Math.max(0,voiceLeft-5),behavior:'auto'});
    } else if(voiceRight>sl+vw){
      el.scrollTo({left:voiceRight-vw+5,behavior:'auto'});
    }
  },[highlight]);
  return e('div',{
    'data-tour':dataTour,
    ref:scrollRef,
    style:{background:'var(--neck-wrap)',border:'1px solid '+BORDER,borderRadius:9,
      padding:'8px 4px 4px',marginBottom:marginBottom!==undefined?marginBottom:10,
      overflowX:'auto',WebkitOverflowScrolling:'touch'}
  },
    e('div',{style:{minWidth:680}},
      e(NeckSVG,{arpPos,highlight,scalePos,extraDots,degNames,hlTc,dotMode,dotKeyIdx})
    )
  );
});

// ── ChordBox ──────────────────────────────────────────────────────────
// Assigns fingers 1-4 to fretted strings by fret order; same-fret strings share a finger.
function calcFingering(allF){
  const played=[];
  allF.forEach((f,s)=>{if(f!==null&&f>0) played.push({s,f});});
  played.sort((a,b)=>a.f-b.f);
  const groups=[];
  played.forEach(({s,f})=>{
    if(!groups.length||groups[groups.length-1].f!==f) groups.push({f,strings:[s]});
    else groups[groups.length-1].strings.push(s);
  });
  const map={};
  groups.forEach((g,gi)=>{g.strings.forEach(s=>{map[s]=Math.min(gi+1,4);});});
  return map;
}
const ChordBox=React.memo(function ChordBox({voicing,strings,tones,degNames,invLabel,bassLabel,selected,onClick,tcArr,dotMode,dotKeyIdx}){
  const tc=tcArr||TC;
  dotMode=dotMode||'interval';
  dotKeyIdx=dotKeyIdx===undefined?0:dotKeyIdx;
  const [pressed,setPressed]=useState(false);
  if(!voicing) return null;
  const frets=voicing.frets;
  const allF=[null,null,null,null,null,null];
  frets.forEach((f,i)=>{allF[strings[i]]=f;});
  const fingerMap=dotMode==='finger'?calcFingering(allF):{};
  const nonZ=frets.filter(f=>f>0);
  const mn=nonZ.length?Math.min(...nonZ):1;
  const mx=nonZ.length?Math.max(...nonZ):4;
  const NF=Math.max(4,mx-mn+1),SF=Math.max(1,mn),FS=22;
  const H=66+NF*FS+18,W=120,SS=18,PL=15,PT=66;
  const showNut=SF===1;
  const sx=i=>PL+i*SS;
  const fy=f=>PT+(f-SF)*FS+FS/2;
  return e('div',{
    onClick:()=>{playChordPreview(voicing,strings);if(onClick)onClick();},
    onPointerDown:()=>setPressed(true),
    onPointerUp:()=>setPressed(false),
    onPointerLeave:()=>setPressed(false),
    style:{cursor:'pointer',flexShrink:0,filter:pressed?'brightness(1.35)':'none',transition:'filter 0.08s'}},
    e('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`},
      e('rect',{width:W,height:H,rx:9,fill:selected?'var(--cb-sel)':'var(--cb-bg)',stroke:selected?'var(--txt)':BORDER,strokeWidth:selected?2.5:1.5}),
      e('text',{x:W/2,y:20,textAnchor:'middle',fill:selected?'var(--txt)':BTN_OFF,fontSize:13,fontWeight:selected?'bold':'normal',fontFamily:UI_FONT},invLabel),
      bassLabel?e('text',{x:W/2,y:38,textAnchor:'middle',fill:HINT,fontSize:11,fontFamily:UI_FONT},bassLabel):null,
      !showNut?e('text',{x:3,y:PT+FS/2,dominantBaseline:'middle',fill:HINT,fontSize:10,fontFamily:UI_FONT},SF+'fr'):null,
      showNut?e('rect',{x:sx(0)-2,y:PT-5,width:5*SS+4,height:5,fill:'#c8a855',rx:1.5}):null,
      Array.from({length:NF+1},(_,k)=>
        e('line',{key:'frl'+k,x1:sx(0),y1:PT+k*FS,x2:sx(5),y2:PT+k*FS,stroke:(k===0&&showNut)?'#c8a855':'var(--cb-str)',strokeWidth:1})
      ),
      Array.from({length:6},(_,i)=>
        e('line',{key:'stl'+i,x1:sx(i),y1:PT,x2:sx(i),y2:PT+NF*FS,stroke:'var(--cb-str)',strokeWidth:1})
      ),
      allF.map((f,i)=>{
        if(f===null) return e('text',{key:'mx'+i,x:sx(i),y:PT-10,textAnchor:'middle',fill:HINT,fontSize:13,fontFamily:UI_FONT},'x');
        if(f===0){const ti2=tones.indexOf(OPEN_PC[i]);return e('circle',{key:'op'+i,cx:sx(i),cy:PT-12,r:6,fill:'none',stroke:ti2>=0?tc[ti2]:'#6668a0',strokeWidth:2});}
        return null;
      }),
      allF.map((f,i)=>{
        if(f===null||f===0) return null;
        if(f<SF||f>SF+NF-1) return null;
        const pc=(OPEN_PC[i]+f)%12,ti2=tones.indexOf(pc);
        const dotLabel=dotMode==='finger'
          ?(fingerMap[i]!=null?String(fingerMap[i]):'')
          :(ti2>=0?noteForDot(dotMode,degNames[ti2],pc,dotKeyIdx):'');
        return e('g',{key:'dt'+i},
          e('circle',{cx:sx(i),cy:fy(f),r:9,fill:ti2>=0?tc[ti2]:'#556',stroke:'var(--hi-dot-str)',strokeWidth:1}),
          e('text',{x:sx(i),y:fy(f),textAnchor:'middle',dominantBaseline:'middle',fill:'var(--dot-lbl)',fontSize:dotMode==='finger'?9:7,fontWeight:'bold',fontFamily:UI_FONT},dotLabel)
        );
      })
    )
  );
});

// ── ScalePanel ────────────────────────────────────────────────────────
function ScalePanel({degree,chordRoot,tones,degNames,keyIdx,scaleIdx,onScaleChange,level}){
  // Essentials keeps one scale per chord — the diatonic default
  const options=level==='essentials'?CHORD_SCALES[degree].slice(0,1):CHORD_SCALES[degree];
  const sc=options[Math.min(scaleIdx,options.length-1)];
  const parentRoot=getParentRoot(chordRoot,sc.pType,sc.mPos);
  const parentLabel=nn(parentRoot,keyIdx)+' '+PTYPE_NAME[sc.pType];
  const sameAsKey=sc.pType==='major'&&parentRoot===KEYS[keyIdx].root;
  const avoidSet=new Set(sc.avoid||[]);
  const noteRow=sc.iv.map(interval=>{
    const pc=(chordRoot+interval)%12;
    const ti=tones.indexOf(pc);
    return{noteName:nn(pc,keyIdx),interval,isTone:ti>=0,ti,isAvoid:avoidSet.has(interval)};
  });
  return e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:8,padding:'10px 14px',marginBottom:12}},
    e('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:8,flexWrap:'wrap',gap:6}},
      e('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}},
        options.length>1?e('div',{style:{display:'flex',gap:3}},
          options.map((opt,i)=>
            e('button',{key:i,onClick:()=>onScaleChange(i),style:{
              padding:'2px 8px',borderRadius:3,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.79rem',
              border:'1px solid '+(scaleIdx===i?'#FFD43B60':BTN_BRD),
              background:scaleIdx===i?ACT_GOLD:BG,
              color:scaleIdx===i?'#FFD43B':BTN_OFF,fontWeight:scaleIdx===i?700:400}},opt.abbr)
          )
        ):null,
        e('span',{style:{fontFamily:SERIF,fontSize:'1rem',fontWeight:700,color:'var(--scale-name)'}},nn(chordRoot,keyIdx)+' '+sc.name),
        e('span',{style:{fontSize:'0.7rem',color:HINT,fontFamily:UI_FONT}},sc.desc)
      ),
      e('div',{style:{display:'flex',alignItems:'center',gap:6,flexShrink:0}},
        e('span',{style:{fontSize:'0.79rem',color:LBL,fontFamily:UI_FONT}},'parent'),
        e('span',{style:{fontSize:'0.79rem',fontFamily:UI_FONT,
          color:sameAsKey?'var(--parent-key)':'var(--parent-other)',
          border:'1px solid '+(sameAsKey?'var(--parent-key-brd)':BTN_BRD),
          borderRadius:4,padding:'2px 8px',background:sameAsKey?'var(--parent-box-act)':BG}},
          parentLabel+(sameAsKey?' (this key)':''))
      )
    ),
    e('div',{style:{display:'flex',gap:5,flexWrap:'wrap',alignItems:'flex-end'}},
      noteRow.map((n,i)=>
        e('div',{key:i,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2}},
          e('div',{style:{width:30,height:30,borderRadius:'50%',
            background:n.isTone?TC[n.ti]:'var(--note-non-chord)',
            border:'1.5px solid '+(n.isAvoid?'#F97316':n.isTone?TC[n.ti]:BTN_BRD),
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:n.isTone?'0 0 8px '+TC[n.ti]+'44':n.isAvoid?'0 0 6px #F9731644':'none',
            opacity:n.isAvoid?0.7:1}},
            e('span',{style:{fontSize:'0.71rem',fontWeight:700,fontFamily:UI_FONT,color:n.isTone?'white':'var(--note-non-chord-txt)'}},n.noteName)
          ),
          e('span',{style:{fontSize:'0.64rem',fontFamily:UI_FONT,
            color:n.isAvoid?'#F97316':n.isTone?TC[n.ti]+'cc':'var(--note-iv-txt)'}},
            n.isAvoid?INT_NAMES[n.interval]+'⚠':INT_NAMES[n.interval])
        )
      ),
      e('div',{style:{marginLeft:'auto',alignSelf:'flex-start',paddingTop:2}},
        e('span',{style:{fontSize:'0.77rem',fontFamily:UI_FONT,color:HINT,border:'1px solid '+BTN_BRD,borderRadius:3,padding:'2px 7px',background:BG}},sc.iv.length+'-note')
      )
    )
  );
}

// ── DiagSection ───────────────────────────────────────────────────────
function DiagSection({title,children}){
  return e('div',{style:{marginBottom:14}},
    e('div',{style:{fontSize:'0.71rem',color:LBL,letterSpacing:'0.3px',marginBottom:6,fontWeight:600}},title),
    e('div',{style:{display:'flex',flexWrap:'wrap',gap:8,alignItems:'flex-start'}},children)
  );
}

// Shown when every shape in a section failed the playability check.
// Rendered on its own (the neck is hidden in this case), so it's a full-width
// block rather than a stray line of muted text that reads like a render bug.
function NoShapes(){
  return e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
    gap:6,width:'100%',padding:'26px 18px',textAlign:'center',
    background:BG2,border:'1px dashed '+BORDER,borderRadius:8}},
    e('span',{style:{fontSize:'1.5rem',lineHeight:1}},'🤚'),
    e('span',{style:{fontSize:'0.85rem',color:'var(--txt)',fontFamily:UI_FONT,fontWeight:700}},
      'No playable shape for this voicing'),
    e('span',{style:{fontSize:'0.75rem',color:HINT,fontFamily:UI_FONT,maxWidth:340,lineHeight:1.5}},
      'This combination needs a stretch wider than a hand allows. Try a different voicing type or another string set.')
  );
}

// ── Shared button style helpers ───────────────────────────────────────
const mkSsBtn=(active)=>({
  padding:'6px 12px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
  border:'1px solid '+(active?'#74C0FC':BTN_BRD),background:active?ACT_BLUE:BG2,
  color:active?'#74C0FC':BTN_OFF,fontWeight:active?700:400,minHeight:44,
});

// ── Play-along forms ──────────────────────────────────────────────────
// chords: [semitones above key root, quality, symbol, roman]
// bars: chord index per bar
const FORM_DEFS={
  major:{lbl:'ii–V–I',col:'var(--gold)',bg:'var(--act-gold)',
    chords:[[2,'m7','m7','ii'],[7,'dom7','7','V'],[0,'maj7','maj7','I']],
    bars:[0,1,2,2],
    tip:'Major ii–V–I: keep common tones, move others by step. Classic: iim7 (7 bass) → V7 (5 bass) → Imaj7 root pos, all on the same string set.'},
  minor:{lbl:'MINOR ii–V–i',col:'#C084FC',bg:ACT_PUR,
    chords:[[2,'m7b5','ø7','ii'],[7,'dom7','7','V'],[0,'m7','m7','i']],
    bars:[0,1,2,2],
    tip:'Minor ii–V–i: the ♭5 of iiø resolves up a half-step to the 5th of im7. Classic path: iiø (7 bass) → V7 (5 bass) → im7 root pos.'},
  turn:{lbl:'I–VI–ii–V',col:'#FFD43B',bg:ACT_YEL,
    chords:[[0,'maj7','maj7','I'],[9,'dom7','7','VI'],[2,'m7','m7','ii'],[7,'dom7','7','V']],
    bars:[0,1,2,3],
    tip:'The turnaround: one chord per bar, loop it forever — it ends countless standards and is the engine of rhythm changes. The VI is played dominant (VI7) so it pulls harder into the iim7.'},
  blues:{lbl:'JAZZ BLUES',col:'#74C0FC',bg:ACT_BLUE,
    chords:[[0,'dom7','7','I'],[5,'dom7','7','IV'],[9,'dom7','7','VI'],[2,'m7','m7','ii'],[7,'dom7','7','V']],
    bars:[0,1,0,0, 1,1,0,2, 3,4,0,4],
    tip:'Jazz blues = the 12-bar you know plus three moves: bar 8 picks up a VI7, bars 9–10 swap the old V–IV for a iim7–V7, and bar 12 turns around on V7. Spot the ii–V–I hiding in bars 9–11.'},
  autumn:{lbl:'AUTUMN LEAVES',col:'#F4A261',bg:ACT_GOLD,
    chords:[[2,'m7','m7','iim7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],[5,'maj7','maj7','IVmaj7'],
            [11,'m7b5','ø7','viiø7'],[4,'dom7','7','III7'],[9,'m7','m7','vim7']],
    bars:[0,1,2,3,4,5,6,6,0,1,2,3,4,5,6,6,4,5,6,6,0,1,2,2,0,1,2,3,4,5,6,6],
    tip:'Autumn Leaves — AABA, 32 bars (key of G major / E minor). A: iim7→V7→Imaj7→IVmaj7→viiø7→III7→vim7. B: minor ii–V–i then major ii–V–I. Root motion descends in 4ths. Set key to G.'},
  minblues:{lbl:'MINOR BLUES',col:'#FF6B6B',bg:ACT_RED,
    chords:[[0,'m7','m7','im7'],[5,'m7','m7','ivm7'],[2,'m7b5','ø7','iiø7'],[7,'dom7','7','V7']],
    bars:[0,0,0,0, 1,1,0,0, 2,3,0,3],
    tip:'Minor blues: im7 replaces I7 throughout; bars 9–10 become iiø7–V7 — the minor ii–V you already know. The V7 creates stronger pull back to im7 than in major blues.'},
  attya:{lbl:'ALL THINGS',col:'#7BC8A4',bg:'#081a10',
    chords:[[9,'m7','m7','vim7'],[2,'m7','m7','iim7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],
            [5,'maj7','maj7','IVmaj7'],[11,'dom7','7','VII7'],[4,'maj7','maj7','IIImaj7']],
    bars:[0,1,2,3,4,5,6,6],
    tip:'"All The Things You Are" A section: two ii–V–I cycles descending by 4ths — Bbm7–Eb7–Abmaj7 (in Ab), then Dbmaj7–G7–Cmaj7 (in C). This root motion descending in 4ths is the fundamental bass motion of jazz harmony. Set key to Ab.'},
  twnbay:{lbl:'ANOTHER YOU',col:'#F472B6',bg:'#1a0812',
    chords:[[0,'maj7','maj7','Imaj7'],[7,'m7','m7','vm7'],[0,'dom7','7','I7'],[5,'maj7','maj7','IVmaj7'],
            [5,'m7','m7','ivm7'],[10,'dom7','7','bVII7'],[9,'m7','m7','vim7'],[2,'dom7','7','II7'],
            [2,'m7','m7','iim7'],[7,'dom7','7','V7']],
    bars:[0,1,2,3,4,5,0,6,7,8,9,0],
    tip:'"There Will Never Be Another You" A section (Eb): cadence to IVmaj7 via vm7–I7 (Bbm7–Eb7–Abmaj7), then backdoor ii–V home (ivm7–bVII7–I). Closes with I–vim7–II7–iim7–V7. Set key to Eb.'},
  bluebossa:{lbl:'BLUE BOSSA',col:'#60A5FA',bg:'#030d1e',
    chords:[[0,'m7','m7','im7'],[5,'m7','m7','ivm7'],[2,'m7b5','ø7','iiø7'],[7,'dom7','7','V7'],
            [3,'m7','m7','♭IIIm7'],[8,'dom7','7','♭VI7'],[1,'maj7','maj7','♭IImaj7']],
    bars:[0,0,1,1, 2,3,0,0, 4,5,6,6, 2,3,0,0],
    tip:'Blue Bossa — 16 bars. A: C minor (im7–ivm7–iiø7–V7–im7). B bars 9–12: key shifts to D♭ major (♭IIIm7–♭VI7–♭IImaj7). A\' bars 13–16: returns to C minor ii–V–i. Set key to C.'},
  stella:{lbl:'STELLA',col:'#C4B5FD',bg:'#07051a',
    chords:[[6,'m7b5','ø7','iiø'],[11,'dom7','7','VII7'],[2,'m7','m7','iim7'],[7,'dom7','7','V7'],
            [7,'maj7','maj7','Vmaj7'],[7,'m7','m7','vm7'],[0,'dom7','7','I7'],[5,'maj7','maj7','IVmaj7'],
            [11,'m7b5','ø7','iiø'],[4,'dom7','7','III7'],[9,'maj7','maj7','VImaj7'],[0,'maj7','maj7','Imaj7']],
    bars:[0,1, 2,3, 4,5, 6,7, 8,9, 10,10, 2,3, 11,11],
    tip:'Stella by Starlight — 16-bar form in B♭. Three ii–V–I chains: to E♭ (vm7–I7–IVmaj7), to G (Am7♭5–D7–Gmaj7), home to B♭ (iim7–V7–Imaj7). The opening Em7♭5–A7 is a ii–V of D that dissolves into the Cm7–F7 — the harmonic surprise that defines the tune. Set key to B♭.'},
  tritone:{lbl:'TRITONE SUB',col:'#FF6B6B',bg:ACT_RED,
    chords:[[2,'m7','m7','iim7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],[1,'dom7','7','♭II7']],
    bars:[0,1,2,2,0,3,2,2],
    tip:'Bars 1–4: standard iim7–V7–Imaj7. Bars 5–8: the V7 is replaced by ♭II7 — a dominant 7 a tritone away. G7 and D♭7 share the same tritone (B/C♭ and F), so both resolve identically to Cmaj7. Listen for the chromatic bass motion D♭→C vs. the 5th-down G→C. Set key to C.'},
  secdom:{lbl:'SEC. DOM.',col:'#F4A261',bg:ACT_GOLD,
    chords:[[0,'maj7','maj7','Imaj7'],[4,'dom7','7','V/vi'],[9,'m7','m7','vim7'],[9,'dom7','7','V/ii'],[2,'m7','m7','iim7'],[7,'dom7','7','V7']],
    bars:[0,1,2,2,3,4,5,0],
    tip:'Secondary dominants: E7 (V7/vi) temporarily acts as V of Am7; A7 (V7/ii) acts as V of Dm7 — each creates a mini ii–V pull before the main ii–V–I. Any chord in the key can be preceded by its own V7. Set key to C.'},
  custom:{lbl:'CUSTOM',col:'#9CA3AF',bg:'transparent',chords:[],bars:[],tip:''},
};

// Scale suggestions per chord quality (shown on neck when user picks a scale)
const SCALE_HINTS={
  maj7:[{name:'Ionian',   iv:[0,2,4,5,7,9,11],note:'Home — R 3 5 Δ7 all inside key'},
        {name:'Lydian',   iv:[0,2,4,6,7,9,11],note:'#11 replaces 4 — bright, lifted feel'}],
  m7:  [{name:'Dorian',   iv:[0,2,3,5,7,9,10],note:'Standard — b3 b7 match chord; nat.6 adds color'},
        {name:'Aeolian',  iv:[0,2,3,5,7,8,10],note:'Natural minor — b6 darkens vs Dorian'}],
  dom7:[{name:'Mixolydian',   iv:[0,2,4,5,7,9,10],note:'Standard — R 3 5 b7 all inside; nat. tensions'},
        {name:'Altered',      iv:[0,1,3,4,6,8,10], note:'b9 #9 #11 b13 all altered — max tension into I'},
        {name:'Lyd. Dom.',    iv:[0,2,4,6,7,9,10], note:'#11 with b7 — bright; no avoid notes'},
        {name:'Phrygian Dom.',iv:[0,1,4,5,7,8,10], note:'V7 in minor — harmonic minor sound, b9 b13'}],
  m7b5:[{name:'Locrian',   iv:[0,1,3,5,6,8,10],note:'Diatonic — b2 b5 b6 match chord tones'},
        {name:'Loc. nat2', iv:[0,2,3,5,6,8,10],note:'nat.2 softens b2 harshness'}],
};

// Rhythm pattern display names (for barPatternRef)
const COMP_NAMES=['Bop comp','Freddie Green','Sparse','Two-beat'];
const BASS_NAMES=['Walking','Two-feel','Scale walk','Encircle','5th-down'];
const RIDE_NAMES=['Swing 8ths','Half-time','Lazy'];

// Default custom progression (C – G7 – C – C)
const DFLT_CPROG=[{root:0,q:'maj7'},{root:7,q:'dom7'},{root:0,q:'maj7'},{root:0,q:'maj7'}];
const CPROG_QUALS=['maj7','m7','dom7','m7b5']; // available qualities in custom builder

// ── IIVIView ──────────────────────────────────────────────────────────
// Guitar-pedal-style LED toggle for transport controls
function LedToggle({label,enabled,onToggle,color,textColor,compact}){
  textColor=textColor||color;
  return e('button',{onClick:onToggle,style:{
    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
    gap:compact?3:5,padding:compact?'4px 8px':'6px 12px',borderRadius:8,cursor:'pointer',
    minWidth:compact?40:54,minHeight:compact?36:52,
    border:'1px solid '+(enabled?color+'66':BTN_BRD),
    background:enabled?color+'18':BG2,
    transition:'border-color 0.15s,background 0.15s,min-width 0.15s,min-height 0.15s',fontFamily:UI_FONT
  }},
    e('div',{style:{
      width:compact?7:9,height:compact?7:9,borderRadius:'50%',flexShrink:0,
      background:enabled?color:'var(--brd)',
      boxShadow:enabled?`0 0 8px ${color},0 0 3px ${color}`:'inset 0 1px 2px rgba(0,0,0,0.3)',
      border:`1px solid ${enabled?color+'aa':'var(--brd)'}`,
      transition:'background 0.15s,box-shadow 0.15s'
    }}),
    e('span',{style:{
      fontSize:compact?'0.55rem':'0.62rem',letterSpacing:'0.8px',fontWeight:enabled?700:400,
      color:enabled?textColor:BTN_OFF,transition:'color 0.15s'
    }},label)
  );
}

function IIVIView({keyIdx,dotMode,setDotMode,level,onPlayStateChange,pedalRef,onPracticed,onUpgrade}){
  dotMode=dotMode||'interval';
  const isEss=level==='essentials';
  const [strSetIdx,setStrSetIdx]=useState(()=>parseInt(safeLS('jg-strSet','2'),10));
  const [invIdxs,setInvIdxs]=useState([]);
  const [activeChordIdx,setActiveChordIdx]=useState(0);
  const [isPlaying,setIsPlaying]=useState(false);
  const [bpm,setBpm]=useState(()=>Math.max(35,Math.min(220,parseInt(safeLS('jg-bpm','80'),10))));
  const [bassEnabled,setBassEnabled]=useState(()=>safeLS('jg-bass')!=='false');
  const [metronomeEnabled,setMetronomeEnabled]=useState(()=>safeLS('jg-met')==='true');
  const [form,setForm]=useState(()=>{
    const f=safeLS('jg-form');
    if(f&&FORM_DEFS[f]) return f;
    return safeLS('jg-minor')==='true'?'minor':'major';
  });
  const [playingChordIdx,setPlayingChordIdx]=useState(null);
  const [playingBar,setPlayingBar]=useState(null);
  const [scaleHint,setScaleHint]=useState(null); // name of active scale suggestion
  const [countIn,setCountIn]=useState(0); // 0=off, 1-4=counting
  const [starting,setStarting]=useState(false); // true between play-press and isPlaying
  const startingRef=useRef(false); // sync guard against double-tap — React state is async
  const countInTimersRef=useRef([]); // clearable handles for count-in display timeouts
  const [loopCount,setLoopCount]=useState(0);
  const [rideEnabled,setRideEnabled]=useState(()=>safeLS('jg-ride')!=='false');
  const [showGTLine,setShowGTLine]=useState(false);
  const [showTip,setShowTip]=useState(false);
  const [eqGains,setEqGains]=useState(()=>{
    try{return JSON.parse(safeLS('jg-eq','null'))||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showEq,setShowEq]=useState(false);
  const [guitarEnabled,setGuitarEnabled]=useState(()=>safeLS('jg-guitar')!=='false');
  const [guitarEqGains,setGuitarEqGains]=useState(()=>{
    try{return JSON.parse(safeLS('jg-geq','null'))||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showGuitarEq,setShowGuitarEq]=useState(false);
  const [rideEqGains,setRideEqGains]=useState(()=>{
    try{return JSON.parse(safeLS('jg-req','null'))||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showRideEq,setShowRideEq]=useState(false);
  const [bassVolume,setBassVolume]=useState(()=>parseInt(safeLS('jg-bvol','80'),10));
  const [guitarVolume,setGuitarVolume]=useState(()=>parseInt(safeLS('jg-cvol','80'),10));
  const [rideVolume,setRideVolume]=useState(()=>parseInt(safeLS('jg-rvol','80'),10));
  const [pinnedChords,setPinnedChords]=useState(()=>new Set());
  const [barVTypes,setBarVTypes]=useState(()=>[]);
  const [showBarOverride,setShowBarOverride]=useState(false); // per-bar voicing override disclosure
  const pendingBarVTypesRef=useRef(null);
  const skipVLRef=useRef(false); // set when a favorite restore drives both form+vType in one click
  const [vType,setVType]=useState(()=>{const v=safeLS('jg-vtype','shell');return safeLS('jg-level')==='essentials'&&v!=='shell'?'shell':v;});
  const [customProg,setCustomProg]=useState(()=>{
    try{return JSON.parse(safeLS('jg-cprog','null'))||DFLT_CPROG;}
    catch(ex){return DFLT_CPROG;}
  });
  const [editingBar,setEditingBar]=useState(-1);
  const [savedFaves,setSavedFaves]=useState(()=>{
    try{return JSON.parse(safeLS('jg-faves','null'))||[];}
    catch{return [];}
  });

  // If user switches back to Basic while a non-major form or Pro vType is active, reset
  useEffect(()=>{
    if(level==='essentials'){
      if(form!=='major'){setForm('major');setIsPlaying(false);}
      if(vType!=='shell') setVType('shell');
    }
  },[level]); // eslint-disable-line react-hooks/exhaustive-deps

  const audioCtxRef=useRef(null);
  const compRef=useRef(null);
  const timerRef=useRef(null);
  const nextTimeRef=useRef(0);
  const beatRef=useRef(0);
  const genRef=useRef(0);
  const bpmRef=useRef(bpm);
  const bassRef=useRef(bassEnabled);
  const metronomeRef=useRef(metronomeEnabled);
  const chordsRef=useRef(null);
  const barsRef=useRef(null);
  const ksBufsRef=useRef(null);
  const clickBufsRef=useRef(null);
  const bassRawRef=useRef(null);   // pre-fetched ArrayBuffers (persists across play/stop)
  const bassSamplesRef=useRef(null); // decoded AudioBuffers for current AudioContext
  const tapTimesRef=useRef([]);
  const loopCountRef=useRef(0);
  const playPracticedRef=useRef(false);
  const rideRef=useRef(rideEnabled); rideRef.current=rideEnabled;
  const preRideRef=useRef({accent:null,norm:null}); // async-rendered ride buffers
  const eqRef=useRef([0,0,0,0,0]); eqRef.current=eqGains;
  const guitarEnabledRef=useRef(guitarEnabled); guitarEnabledRef.current=guitarEnabled;
  const guitarEqRef=useRef([0,0,0,0,0]); guitarEqRef.current=guitarEqGains;
  const rideEqRef=useRef([0,0,0,0,0]); rideEqRef.current=rideEqGains;
  const bassVolRef=useRef(80); bassVolRef.current=bassVolume;
  const guitarVolRef=useRef(80); guitarVolRef.current=guitarVolume;
  const rideVolRef=useRef(80); rideVolRef.current=rideVolume;
  const guitarRawRef=useRef(null);
  const guitarSamplesRef=useRef(null);
  const compMidiRef=useRef([]);
  const barPatternRef=useRef({});
  const scaleByQualityRef=useRef({});
  bpmRef.current=bpm;
  bassRef.current=bassEnabled;
  metronomeRef.current=metronomeEnabled;

  useEffect(()=>{safeLSSet('jg-strSet',strSetIdx);},[strSetIdx]);
  useEffect(()=>{safeLSSet('jg-bpm',bpm);},[bpm]);
  useEffect(()=>{
    safeLSSet('jg-bass',bassEnabled);
    if(bassEnabled&&audioCtxRef.current&&!bassSamplesRef.current) decodeBassRaw(audioCtxRef.current);
  },[bassEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{safeLSSet('jg-met',metronomeEnabled);},[metronomeEnabled]);
  useEffect(()=>{safeLSSet('jg-ride',rideEnabled);},[rideEnabled]);
  useEffect(()=>{safeLSSet('jg-eq',JSON.stringify(eqGains));},[eqGains]);
  useEffect(()=>{onPlayStateChange?.(isPlaying);},[isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{
    safeLSSet('jg-guitar',guitarEnabled);
    if(guitarEnabled&&audioCtxRef.current&&!guitarSamplesRef.current) decodeGuitarRaw(audioCtxRef.current);
  },[guitarEnabled]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{safeLSSet('jg-geq',JSON.stringify(guitarEqGains));},[guitarEqGains]);
  useEffect(()=>{safeLSSet('jg-req',JSON.stringify(rideEqGains));},[rideEqGains]);
  useEffect(()=>{safeLSSet('jg-bvol',bassVolume);},[bassVolume]);
  useEffect(()=>{safeLSSet('jg-cvol',guitarVolume);},[guitarVolume]);
  useEffect(()=>{safeLSSet('jg-rvol',rideVolume);},[rideVolume]);
  useEffect(()=>{safeLSSet('jg-form',form);},[form]);
  useEffect(()=>{safeLSSet('jg-cprog',JSON.stringify(customProg));},[customProg]);
  useEffect(()=>{safeLSSet('jg-vtype',vType);},[vType]);
  useEffect(()=>{safeLSSet('jg-faves',JSON.stringify(savedFaves));},[savedFaves]);
  useEffect(()=>{setScaleHint(null);},[activeChordIdx,form]);

  // Pre-fetch real bass guitar samples (recorded bass-electric) on mount so
  // they are ready before the user hits play.
  useEffect(()=>{
    let live=true;
    const BASE='https://nbrosowsky.github.io/tonejs-instruments/samples/bass-electric/';
    // Samples every minor-3rd cover the whole octave with ≤1 semitone shift.
    const FILES={37:'Cs2.mp3',40:'E2.mp3',43:'G2.mp3',46:'As2.mp3'};
    Promise.all(Object.entries(FILES).map(async([midi,file])=>{
      try{
        const r=await fetch(BASE+file);
        if(!r.ok||!live) return null;
        return{midi:+midi,data:await r.arrayBuffer()};
      }catch(e){return null;}
    })).then(res=>{
      if(!live) return;
      const raw={};
      res.forEach(r=>{if(r)raw[r.midi]=r.data;});
      if(Object.keys(raw).length>0) bassRawRef.current=raw;
    });
    return ()=>{live=false;};
  },[]);

  // Pre-fetch guitar-electric samples for comping
  useEffect(()=>{
    let live=true;
    const BASE='https://nbrosowsky.github.io/tonejs-instruments/samples/guitar-electric/';
    // Three anchors spread across guitar range: F#2 (42), F#3 (54), F#4 (66)
    const FILES={42:'Fs2.mp3',54:'Fs3.mp3',66:'Fs4.mp3'};
    Promise.all(Object.entries(FILES).map(async([midi,file])=>{
      try{
        const r=await fetch(BASE+file);
        if(!r.ok||!live) return null;
        return{midi:+midi,data:await r.arrayBuffer()};
      }catch(e){return null;}
    })).then(res=>{
      if(!live) return;
      const raw={};
      res.forEach(r=>{if(r)raw[r.midi]=r.data;});
      if(Object.keys(raw).length>0) guitarRawRef.current=raw;
    });
    return ()=>{live=false;};
  },[]);

  // Pre-render high-quality ride buffers asynchronously (before user hits play)
  useEffect(()=>{
    // Probe actual device sample rate via a throwaway context so the buffer matches
    const tmp=new (window.AudioContext||window.webkitAudioContext)();
    const sr=tmp.sampleRate;tmp.close();
    makeRideBufAsync(sr,1,true).then(b=>{preRideRef.current.accent=b;}).catch(()=>{});
    makeRideBufAsync(sr,1,false).then(b=>{preRideRef.current.norm=b;}).catch(()=>{});
  },[]);

  const def=form==='custom'?null:FORM_DEFS[form];
  const chords=def
    ?def.chords.map(([off,quality,sym,roman])=>{
        const rootPC=(KEYS[keyIdx].root+off)%12;
        const tones=getChordTones(rootPC,quality);
        const minorQ=quality==='m7'||quality==='m7b5';
        const romanCased=minorQ?roman.replace(/[IVX]+/,m=>m.toLowerCase()):roman;
        return{rootPC,quality,tones,dnames:DNAMES[quality],name:nn(rootPC,keyIdx)+sym,roman:romanCased};
      })
    :customProg.map(({root,q})=>{
        const tones=getChordTones(root,q);
        const qt=EXT_TYPES.find(t=>t.id===q)||EXT_TYPES[0];
        return{rootPC:root,quality:q,tones,dnames:DNAMES[q],name:nn(root,root)+qt.sym,roman:qt.sym};
      });
  const bars=def?def.bars:customProg.map((_,i)=>i);
  chordsRef.current=chords;
  barsRef.current=bars;
  // Register pedal handlers — overwrite on every render so closure is always current
  if(pedalRef) pedalRef.current={
    forward:()=>setActiveChordIdx(i=>(i+1)%bars.length),
    back:()=>setActiveChordIdx(i=>(i-1+bars.length)%bars.length),
  };

  const dropD=DROP_DATA[vType]||DROP_DATA.drop2;
  const ssIdx=Math.min(strSetIdx,dropD.sets.length-1);
  const ss=vType==='shell'?null:dropD.sets[ssIdx].s;
  const safeBarIdx=Math.min(activeChordIdx||0,bars.length-1);
  const ac=chords[bars[safeBarIdx]];
  // Keep compMidiRef current (per-bar) so tick() plays the right voicing per bar
  compMidiRef.current=bars.map((ci,barIdx)=>{
    const chord=chords[ci];
    const bvt=barVTypes[barIdx]||null;
    const bt=bvt?bvt.vType:vType;
    const bsi=bvt?bvt.strSetIdx:strSetIdx;
    const bD=DROP_DATA[bt]||DROP_DATA.drop2;
    const bsIdx=Math.min(bsi,bD.sets.length-1);
    let vx;
    if(bt==='shell'){vx=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1));}
    else if(bt==='rootless'){
      if(!ROOTLESS_OK.has(chord.quality)){vx=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1));}
      else{const rl=[(chord.tones[0]+2)%12,chord.tones[1],chord.tones[2],chord.tones[3]];vx=ROOTLESS.map(cfg=>calcVoicing(cfg.s,cfg.a,rl,1));}
    } else {vx=bD.inv.map(inv=>calcVoicing(bD.sets[bsIdx].s,inv.a,chord.tones));}
    const maxI=vx.length-1;
    const v=vx[Math.min(invIdxs[barIdx]||0,maxI)];
    return v?[...v.midis].sort((a,b)=>a-b):[];
  });

  const arpPos=useMemo(()=>getArpPos(ac.tones),[activeChordIdx,keyIdx,form,customProg]);
  // Effective voicing type/strSet for the currently selected bar
  const barVT=barVTypes[safeBarIdx]||null;
  // Collapse the per-bar override disclosure whenever the selected bar changes
  useEffect(()=>{setShowBarOverride(false);},[safeBarIdx]);
  const activeVT=barVT?barVT.vType:vType;
  const activeVTSI=barVT?Math.min(barVT.strSetIdx,(DROP_DATA[barVT.vType]||DROP_DATA.drop2).sets.length-1):ssIdx;
  const activeDropD=DROP_DATA[activeVT]||DROP_DATA.drop2;
  const activeSS=activeVT==='shell'?null:activeDropD.sets[activeVTSI].s;
  // Rootless tones: replace root with 9th; null when quality doesn't support rootless
  const activeRlTones=ROOTLESS_OK.has(ac.quality)
    ?[(ac.tones[0]+2)%12,ac.tones[1],ac.tones[2],ac.tones[3]]
    :null;
  const activeVoicings=useMemo(()=>{
    if(activeVT==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,ac.tones,1));
    if(activeVT==='rootless'){
      if(!activeRlTones) return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,ac.tones,1));
      return ROOTLESS.map(cfg=>calcVoicing(cfg.s,cfg.a,activeRlTones,1));
    }
    return activeDropD.inv.map(inv=>calcVoicing(activeSS,inv.a,ac.tones));
  },[activeChordIdx,strSetIdx,keyIdx,form,customProg,vType,barVTypes]);
  // Restore per-quality scale choice when chord quality changes; default to first option on first visit
  useEffect(()=>{
    const opts=SCALE_HINTS[ac.quality]||[];
    if(!opts.length){setScaleHint(null);return;}
    const saved=scaleByQualityRef.current[ac.quality];
    if(saved&&opts.find(s=>s.name===saved)){setScaleHint(saved);return;}
    setScaleHint(opts[0].name);
  },[ac.quality]); // eslint-disable-line react-hooks/exhaustive-deps
  const activeScale=scaleHint?(SCALE_HINTS[ac.quality]||[]).find(s=>s.name===scaleHint):null;
  // Hide scale overlay in basic mode; otherwise show when a scale is selected
  const scalePos=useMemo(()=>{
    if(level==='essentials') return [];
    return activeScale?getScalePos(ac.rootPC,activeScale.iv,ac.tones):[];
  },[scaleHint,activeChordIdx,keyIdx,form,customProg,level]);
  const highlight=useMemo(()=>{
    const maxIdx=activeVT==='shell'?SHELLS.length-1:activeDropD.inv.length-1;
    const selIdx=Math.min(invIdxs[safeBarIdx]||0,maxIdx);
    const v=activeVoicings[selIdx];
    if(!v) return null;
    const strSet=activeVT==='shell'||(!ROOTLESS_OK.has(ac.quality)&&activeVT==='rootless')
      ?SHELLS[selIdx]?.s||SHELLS[0].s
      :activeVT==='rootless'?ROOTLESS[selIdx].s:activeSS;
    const hlTones=activeVT==='rootless'&&activeRlTones?activeRlTones:ac.tones;
    const hlDnames=activeVT==='rootless'&&activeRlTones?RL_DNAMES[ac.quality]:ac.dnames;
    return v.frets.map((f,i)=>{
      const si=strSet[i],ti=hlTones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?hlDnames[ti]:''};
    });
  },[activeVoicings,invIdxs,safeBarIdx,strSetIdx,form,vType,barVTypes]);

  // Guide-tone dots: show 3rd and 7th of each chord at low neck positions
  const gtDots=useMemo(()=>{
    if(level==='essentials'||!showGTLine||chords.length<2) return [];
    const dots=[];
    chords.forEach((chord,ci)=>{
      [[1,'3rd',TC[1]],[3,'7th',TC[3]]].forEach(([ti,role,col])=>{
        const pc=chord.tones[ti];
        for(let str=1;str<=4;str++){
          for(let f=1;f<=12;f++){
            if((OPEN_PC[str]+f)%12===pc){
              dots.push({s:str,f,role,color:col,ci});
              break;
            }
          }
          if(dots[dots.length-1]&&dots[dots.length-1].ci===ci&&dots[dots.length-1].s===str) break;
        }
      });
    });
    return dots;
  },[showGTLine,chords,form,keyIdx,customProg]);

  function decodeBassRaw(ctx){
    // Decode pre-fetched ArrayBuffers into AudioBuffers for the current AudioContext.
    // Uses .slice(0) so the originals survive multiple play/stop cycles.
    bassSamplesRef.current=null;
    const raw=bassRawRef.current;
    if(!raw||Object.keys(raw).length===0) return;
    Promise.all(Object.entries(raw).map(async([midi,arr])=>{
      try{return{midi:+midi,buf:await ctx.decodeAudioData(arr.slice(0))};}
      catch(e){return null;}
    })).then(res=>{
      if(ctx!==audioCtxRef.current) return; // playback restarted with a new context
      const map={};
      res.forEach(r=>{if(r)map[r.midi]=r.buf;});
      bassSamplesRef.current=map;
    });
  }

  function decodeGuitarRaw(ctx){
    guitarSamplesRef.current=null;
    const raw=guitarRawRef.current;
    if(!raw||Object.keys(raw).length===0) return;
    Promise.all(Object.entries(raw).map(async([midi,arr])=>{
      try{return{midi:+midi,buf:await ctx.decodeAudioData(arr.slice(0))};}
      catch(e){return null;}
    })).then(res=>{
      if(ctx!==audioCtxRef.current) return; // playback restarted with a new context
      const map={};
      res.forEach(r=>{if(r)map[r.midi]=r.buf;});
      guitarSamplesRef.current=map;
    });
  }

  function playGuitarNote(ctx,midiNote,startTime,sustainSecs,vol){
    const samples=guitarSamplesRef.current;
    if(!samples||Object.keys(samples).length===0) return;
    const notes=Object.keys(samples).map(Number);
    const nearest=notes.reduce((a,b)=>Math.abs(b-midiNote)<Math.abs(a-midiNote)?b:a);
    const src=ctx.createBufferSource();
    src.buffer=samples[nearest];
    src.detune.value=(midiNote-nearest)*100;
    const eqG=guitarEqRef.current;
    const eq=EQ_FREQS.map((fr,i)=>{const f=ctx.createBiquadFilter();f.type=EQ_TYPES[i];f.frequency.value=fr;f.Q.value=1.2;f.gain.value=eqG[i]||0;return f;});
    const jWarmth=ctx.createBiquadFilter();
    jWarmth.type='peaking';jWarmth.frequency.value=200;jWarmth.Q.value=0.7;jWarmth.gain.value=7;
    const jPressCut=ctx.createBiquadFilter();
    jPressCut.type='peaking';jPressCut.frequency.value=2200;jPressCut.Q.value=1.1;jPressCut.gain.value=-11;
    const jHiCut=ctx.createBiquadFilter();
    jHiCut.type='highshelf';jHiCut.frequency.value=3000;jHiCut.gain.value=-17;
    const gain=ctx.createGain();
    const v=vol*(guitarVolRef.current/100);
    gain.gain.setValueAtTime(0.001,startTime);
    gain.gain.linearRampToValueAtTime(v,startTime+0.03);
    gain.gain.exponentialRampToValueAtTime(v*0.6,startTime+0.35);
    gain.gain.exponentialRampToValueAtTime(v*0.28,startTime+Math.min(sustainSecs*0.7,1.2));
    gain.gain.exponentialRampToValueAtTime(0.001,startTime+sustainSecs);
    src.connect(jWarmth);jWarmth.connect(jPressCut);jPressCut.connect(jHiCut);
    jHiCut.connect(eq[0]);eq.reduce((a,b)=>{a.connect(b);return b;});eq[4].connect(gain);gain.connect(compRef.current||ctx.destination);
    src.start(startTime);src.stop(startTime+sustainSecs+0.05);
    src.onended=()=>{try{src.disconnect();jWarmth.disconnect();jPressCut.disconnect();jHiCut.disconnect();eq.forEach(f=>f.disconnect());gain.disconnect();}catch(_){}};
  }

  function playGuitarChord(ctx,midiNotes,startTime,sustainSecs,vol,strum){
    if(!midiNotes||midiNotes.length===0) return;
    const stepSec=strum?(strum.ms/1000):0;
    const notes=(strum&&strum.dir==='up')?[...midiNotes].reverse():[...midiNotes];
    notes.forEach((midi,i)=>{
      const t=startTime+i*stepSec;
      const vScale=Math.max(0.72,1-i*0.05); // slight taper away from first string hit
      playGuitarNote(ctx,midi,t,sustainSecs,vol*vScale);
    });
  }

  function pickStrum(isStab){
    const r=Math.random();
    if(isStab){
      if(r<0.60) return {dir:'down',ms:10};
      if(r<0.85) return {dir:'up',ms:12};
      return {dir:'down',ms:18};
    }
    if(r<0.50) return {dir:'down',ms:12};
    if(r<0.80) return {dir:'down',ms:22};
    return {dir:'up',ms:14};
  }

  function playBassNote(ctx,pc,startTime,beatDur,accent){
    const midiNote=36+((pc%12+12)%12); // C2–B2
    const vol=(accent?0.88:0.56)*(bassVolRef.current/100);
    const samples=bassSamplesRef.current;
    if(samples&&Object.keys(samples).length>0){
      const notes=Object.keys(samples).map(Number);
      const nearest=notes.reduce((a,b)=>Math.abs(b-midiNote)<Math.abs(a-midiNote)?b:a);
      const src=ctx.createBufferSource();
      src.buffer=samples[nearest];
      src.detune.value=(midiNote-nearest)*100;
      // Jazz bass tone: warm lows, punchy thump, dark top end
      const bLowBoost=ctx.createBiquadFilter();
      bLowBoost.type='lowshelf';bLowBoost.frequency.value=120;bLowBoost.gain.value=10;
      const bThump=ctx.createBiquadFilter();
      bThump.type='peaking';bThump.frequency.value=260;bThump.Q.value=0.9;bThump.gain.value=5;
      const bMidCut=ctx.createBiquadFilter();
      bMidCut.type='peaking';bMidCut.frequency.value=700;bMidCut.Q.value=0.9;bMidCut.gain.value=-9;
      const bHiCut=ctx.createBiquadFilter();
      bHiCut.type='highshelf';bHiCut.frequency.value=2000;bHiCut.gain.value=-16;
      const eqG=eqRef.current;
      const eq=EQ_FREQS.map((fr,i)=>{const f=ctx.createBiquadFilter();f.type=EQ_TYPES[i];f.frequency.value=fr;f.Q.value=1.2;f.gain.value=eqG[i]||0;return f;});
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(0.001,startTime);
      gain.gain.exponentialRampToValueAtTime(vol,startTime+0.004);
      gain.gain.exponentialRampToValueAtTime(vol*0.85,startTime+0.055);
      gain.gain.exponentialRampToValueAtTime(0.001,startTime+beatDur*1.65);
      src.connect(bLowBoost);bLowBoost.connect(bThump);bThump.connect(bMidCut);bMidCut.connect(bHiCut);
      bHiCut.connect(eq[0]);eq.reduce((a,b)=>{a.connect(b);return b;});eq[4].connect(gain);
      gain.connect(compRef.current||ctx.destination);
      src.start(startTime);src.stop(startTime+beatDur*1.65+0.05);
      src.onended=()=>{try{src.disconnect();bLowBoost.disconnect();bThump.disconnect();bMidCut.disconnect();bHiCut.disconnect();eq.forEach(f=>f.disconnect());gain.disconnect();}catch(_){}};
      return;
    }
    // Fallback: KS at half speed (will be replaced once samples decode)
    const bufs=ksBufsRef.current;
    if(!bufs) return;
    const src=ctx.createBufferSource();
    src.buffer=bufs[(pc%12+12)%12];
    src.playbackRate.value=0.5;
    const gain=ctx.createGain();
    gain.gain.setValueAtTime(accent?0.70:0.44,startTime);
    gain.gain.exponentialRampToValueAtTime(0.001,startTime+beatDur*0.92);
    src.connect(gain);gain.connect(compRef.current||ctx.destination);
    src.start(startTime);src.stop(startTime+beatDur);
    src.onended=()=>{try{src.disconnect();gain.disconnect();}catch(_){}};
  }

  function tick(gen,ctx){
    if(!audioCtxRef.current) return;
    const beatDur=60/bpmRef.current;
    while(audioCtxRef.current&&nextTimeRef.current < audioCtxRef.current.currentTime+0.25){
      const bars=barsRef.current;
      const rawBeat=beatRef.current;
      const beat=rawBeat%(bars.length*4);
      const bar=Math.floor(beat/4);
      const ci=bars[bar];
      // Loop counter — increment when the form wraps around
      if(rawBeat>0 && rawBeat%(barsRef.current.length*4)===0){
        loopCountRef.current++;
        const lc=loopCountRef.current;
        setTimeout(()=>{if(genRef.current===gen)setLoopCount(lc);},
          Math.max(0,(nextTimeRef.current-audioCtxRef.current.currentTime)*1000));
        if(lc>=4&&!playPracticedRef.current){playPracticedRef.current=true;onPracticed&&onPracticed();}
      }
      const delay=Math.max(0,(nextTimeRef.current-audioCtxRef.current.currentTime)*1000);
      setTimeout(()=>{if(genRef.current===gen){setPlayingChordIdx(ci);setPlayingBar(bar);setActiveChordIdx(bar);}},delay);
      // Assign rhythm pattern per bar (chosen once, persists per loop iteration)
      if(beat%4===0&&!barPatternRef.current[bar]){
        const compRange=bpmRef.current<70?2:4; // slow tempo: only dense patterns (0=bop, 1=4-to-bar)
        barPatternRef.current[bar]={comp:Math.floor(Math.random()*compRange),ride:Math.floor(Math.random()*3),bass:Math.floor(Math.random()*5)};
      }
      const barPat=barPatternRef.current[bar]||{comp:0,ride:0,bass:0};
      // Bass line — 5 patterns, each 4 beats, with approach note into chord changes
      const ct=chordsRef.current[ci].tones; // [root,3rd,5th,7th]
      const nextChordRoot=chordsRef.current[bars[(bar+1)%bars.length]].tones[0];
      const isDifferentChord=bars[(bar+1)%bars.length]!==ci;
      const b=beat%4;
      const chrBelow=(nextChordRoot-1+12)%12;
      const chrAbove=(nextChordRoot+1)%12;
      let bassPC;
      if(barPat.bass===1){
        // Two-feel: root–5th repeating, chromatic approach on beat 4
        bassPC=[ct[0],ct[2],ct[0],isDifferentChord?chrBelow:ct[2]][b];
      } else if(barPat.bass===2){
        // Scale walk-up: root–2nd–3rd–5th (approach if chord change)
        bassPC=[ct[0],(ct[0]+2)%12,ct[1],isDifferentChord?chrBelow:ct[2]][b];
      } else if(barPat.bass===3){
        // Encircle next root on beats 3–4 (above then below)
        if(b===0) bassPC=ct[0];
        else if(b===1) bassPC=ct[1];
        else if(b===2) bassPC=isDifferentChord?chrAbove:ct[2];
        else bassPC=isDifferentChord?chrBelow:ct[3];
      } else if(barPat.bass===4){
        // 5th prominence: root–5th–passing(5th−2)–root
        bassPC=[ct[0],ct[2],(ct[2]-2+12)%12,isDifferentChord?chrBelow:ct[0]][b];
      } else {
        // Pattern 0: walking chord tones (root–3rd–5th–7th), turnaround on repeated last bar
        const lastSame=bar===bars.length-1&&bars[bar-1]===ci;
        const idxs=isDifferentChord&&b===3?null:(lastSame?[0,2,1,0]:[0,1,2,3]);
        bassPC=idxs?ct[idxs[b]]:chrBelow;
      }
      if(guitarEnabledRef.current){
        const midi=compMidiRef.current[bar]||[];
        if(midi.length>0){
          const b=beat%4;
          const sustLong=Math.min(beatDur*2.6,bpmRef.current<70?3.4:2.6);
          const sustStab=Math.min(beatDur*1.1,bpmRef.current<70?1.3:0.95);
          const top3=midi.slice(-Math.min(3,midi.length));
          if(barPat.comp===0){
            // Standard bop: 1, 2-stab, 3, 4-and anticipation
            if(b===0) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.30,pickStrum(false));
            else if(b===1) playGuitarChord(ctx,top3,nextTimeRef.current,sustStab,0.17,pickStrum(true));
            else if(b===2) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.24,pickStrum(false));
            else playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.21,pickStrum(true));
          } else if(barPat.comp===1){
            // Freddie Green 4-to-bar: all 4 beats, short punchy
            playGuitarChord(ctx,top3,nextTimeRef.current,sustStab,b===0?0.28:0.20,pickStrum(true));
          } else if(barPat.comp===2){
            // Sparse: beat 2 stab + 4-and anticipation only
            if(b===1) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.26,pickStrum(false));
            else if(b===3) playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.22,pickStrum(true));
          } else {
            // Two-beat: beats 1 and 3 full, beat 2-and stab
            if(b===0) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.28,pickStrum(false));
            else if(b===1) playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.16,pickStrum(true));
            else if(b===2) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.22,pickStrum(false));
          }
        }
      }
      if(bassRef.current && chordsRef.current){
        playBassNote(ctx,bassPC,nextTimeRef.current,beatDur,beat%4===0);
      }
      if(metronomeRef.current && clickBufsRef.current){
        const buf=beat%4===0?clickBufsRef.current.accent:clickBufsRef.current.normal;
        playClick(ctx,buf,nextTimeRef.current);
      }
      // Ride cymbal — swing 8ths with pattern variation
      if(rideRef.current&&clickBufsRef.current){
        const rideEq=rideEqRef.current;
        const b=beat%4;
        const onBeat1=b===0;
        const rVol=rideVolRef.current/100;
        if(barPat.ride===0){
          // Standard swing 8ths: every beat + every and
          playRide(ctx,onBeat1?clickBufsRef.current.rideAccent:clickBufsRef.current.rideNorm,nextTimeRef.current,rideEq,rVol);
          playRide(ctx,clickBufsRef.current.rideNorm,nextTimeRef.current+beatDur*(2/3),rideEq,rVol);
        } else if(barPat.ride===1){
          // Half-time feel: beats 1 and 3 only (no ands)
          if(b===0||b===2) playRide(ctx,b===0?clickBufsRef.current.rideAccent:clickBufsRef.current.rideNorm,nextTimeRef.current,rideEq,rVol);
        } else {
          // Lazy: beat 1 accent + ands only
          if(b===0) playRide(ctx,clickBufsRef.current.rideAccent,nextTimeRef.current,rideEq,rVol);
          playRide(ctx,clickBufsRef.current.rideNorm,nextTimeRef.current+beatDur*(2/3),rideEq,rVol);
        }
      }
      nextTimeRef.current+=beatDur;
      beatRef.current++;
    }
    timerRef.current=setTimeout(()=>tick(gen,ctx),25);
  }

  function startPlayback(){
    if(countIn>0||startingRef.current) return; // sync guard — starting state is async
    startingRef.current=true;
    setStarting(true);
    setEditingBar(-1);
    const beatDur=60/bpmRef.current;
    setCountIn(4);
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    ctx.resume(); // iOS may create AudioContext in suspended state even from a tap
    audioCtxRef.current=ctx;
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-18;comp.knee.value=8;comp.ratio.value=4;
    comp.attack.value=0.003;comp.release.value=0.15;
    comp.connect(ctx.destination);
    compRef.current=comp;
    ksBufsRef.current=precomputeKS(ctx);
    clickBufsRef.current={accent:makeClickBuf(ctx,1400,1.0),normal:makeClickBuf(ctx,900,0.65)};
    // Use pre-rendered ride if sample rate matches playback context; otherwise fall
    // back to the synchronous version and re-render async for the next session.
    const preA=preRideRef.current.accent,preN=preRideRef.current.norm;
    const rideOk=preA?.sampleRate===ctx.sampleRate;
    clickBufsRef.current.rideAccent=rideOk?preA:makeRideBuf(ctx,1,true);
    clickBufsRef.current.rideNorm=rideOk?preN:makeRideBuf(ctx,1,false);
    if(!rideOk){
      makeRideBufAsync(ctx.sampleRate,1,true).then(b=>{preRideRef.current.accent=b;}).catch(()=>{});
      makeRideBufAsync(ctx.sampleRate,1,false).then(b=>{preRideRef.current.norm=b;}).catch(()=>{});
    }
    if(bassRef.current) decodeBassRaw(ctx);
    if(guitarEnabledRef.current) decodeGuitarRaw(ctx);
    // Schedule 4 count-in clicks, then begin real playback
    countInTimersRef.current=[];
    for(let i=0;i<4;i++){
      const t=ctx.currentTime+0.05+i*beatDur;
      playClick(ctx,i===0?clickBufsRef.current.accent:clickBufsRef.current.normal,t);
      const delay=Math.max(0,(t-ctx.currentTime)*1000);
      countInTimersRef.current.push(setTimeout(()=>{setCountIn(3-i);},delay));
    }
    const startDelay=Math.max(0,(ctx.currentTime+0.05+4*beatDur-ctx.currentTime)*1000);
    setTimeout(()=>{
      if(!audioCtxRef.current||audioCtxRef.current!==ctx) return;
      setCountIn(0);
      // invIdxs already voice-led by the auto-VL effect; respect any manual overrides.
      setActiveChordIdx(0);
      nextTimeRef.current=ctx.currentTime+0.05;
      beatRef.current=0;
      loopCountRef.current=0;
      playPracticedRef.current=false;
      setLoopCount(0);
      const gen=++genRef.current;
      setIsPlaying(true);
      setStarting(false);
      startingRef.current=false;
      tick(gen,ctx);
    },startDelay);
  }

  function stopPlayback(){
    countInTimersRef.current.forEach(clearTimeout);
    countInTimersRef.current=[];
    startingRef.current=false;
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}compRef.current=null;
    barPatternRef.current={};
    setIsPlaying(false);setStarting(false);setCountIn(0);setPlayingChordIdx(null);setPlayingBar(null);
  }

  function handleTap(){
    const now=Date.now();
    const recent=tapTimesRef.current.filter(t=>now-t<3000);
    recent.push(now);
    tapTimesRef.current=recent;
    if(recent.length>=2){
      const intervals=[];
      for(let i=1;i<recent.length;i++) intervals.push(recent[i]-recent[i-1]);
      const avg=intervals.reduce((s,v)=>s+v,0)/intervals.length;
      setBpm(Math.max(35,Math.min(220,Math.round(60000/avg))));
    }
  }

  // Resume AudioContext when app returns to foreground (iOS suspends it on background)
  useEffect(()=>{
    function onVisible(){
      if(document.visibilityState==='visible'&&audioCtxRef.current?.state==='suspended'){
        audioCtxRef.current.resume().then(()=>{
          if(audioCtxRef.current) nextTimeRef.current=audioCtxRef.current.currentTime+0.05;
        });
      }
    }
    document.addEventListener('visibilitychange',onVisible);
    return ()=>document.removeEventListener('visibilitychange',onVisible);
  },[]);

  // cleanup on unmount
  useEffect(()=>()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    countInTimersRef.current.forEach(clearTimeout);countInTimersRef.current=[];
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}
  },[]);

  // stop when key or mode changes
  useEffect(()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}
    setIsPlaying(false);setPlayingChordIdx(null);setPlayingBar(null);
    setActiveChordIdx(0);
    barPatternRef.current={};
    // Reset count-in state so the play button never stays permanently locked
    startingRef.current=false;setStarting(false);setCountIn(0);
    countInTimersRef.current.forEach(clearTimeout);countInTimersRef.current=[];
  },[keyIdx,form]);

  function computeAllVoicings(cs,brs,bvts){
    return brs.map((ci,barIdx)=>{
      const chord=cs[ci];
      const bvt=(bvts&&bvts[barIdx])||null;
      const bt=bvt?bvt.vType:vType;
      const bsi=bvt?bvt.strSetIdx:strSetIdx;
      if(bt==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1));
      if(bt==='rootless'){
        if(!ROOTLESS_OK.has(chord.quality)) return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1));
        const rl=[(chord.tones[0]+2)%12,chord.tones[1],chord.tones[2],chord.tones[3]];
        return ROOTLESS.map(cfg=>calcVoicing(cfg.s,cfg.a,rl,1));
      }
      const dD=DROP_DATA[bt]||DROP_DATA.drop2;
      const sIdx=Math.min(bsi,dD.sets.length-1);
      return dD.inv.map(inv=>calcVoicing(dD.sets[sIdx].s,inv.a,chord.tones));
    });
  }
  function runVL(allVoicings,startIdxs,pinned){
    const n=allVoicings.length;
    if(n<2) return [...startIdxs];
    const idxs=[...startIdxs];
    for(let pass=0;pass<2;pass++){
      for(let i=0;i<n;i++){
        if(pinned&&pinned.has(i)) continue;
        const prevI=(i-1+n)%n;
        idxs[i]=findBestInvIdx(allVoicings[prevI][idxs[prevI]],allVoicings[i]);
      }
    }
    return idxs;
  }
  // Auto voice-lead over bars. Resets per-bar type overrides on form/key/customProg change.
  // vType/strSetIdx changes only affect bars without a per-bar override.
  useEffect(()=>{
    const pending=pendingBarVTypesRef.current;
    pendingBarVTypesRef.current=null;
    const cs=chordsRef.current,brs=barsRef.current;
    if(!cs||!brs||brs.length<2) return;
    setBarVTypes(pending||[]);
    const av=computeAllVoicings(cs,brs,pending||[]);
    setInvIdxs(runVL(av,av.map(()=>0),null));
    setPinnedChords(new Set());
    setActiveChordIdx(0);
    skipVLRef.current=true; // vType effect runs in same cycle — skip to avoid overwriting
  },[form,keyIdx,customProg]);
  useEffect(()=>{
    if(skipVLRef.current){skipVLRef.current=false;return;}
    const cs=chordsRef.current,brs=barsRef.current;
    if(!cs||!brs||brs.length<2) return;
    // Keep bar-specific overrides; re-VL only unoverridden bars
    const av=computeAllVoicings(cs,brs,barVTypes);
    setInvIdxs(runVL(av,av.map(()=>0),pinnedChords));
  },[vType,strSetIdx]);

  const modeBtn=(act,col,actBg)=>({padding:'6px 13px',borderRadius:5,cursor:'pointer',
    fontFamily:UI_FONT,fontSize:'0.78rem',border:'1px solid '+(act?col:BTN_BRD),
    background:act?actBg:'transparent',color:act?col:BTN_OFF,fontWeight:act?700:400,minHeight:44});
  const playBtn={
    width:isPlaying?46:64,height:isPlaying?38:52,borderRadius:10,
    cursor:'pointer',border:'none',flexShrink:0,
    background:isPlaying?'#c41a1a':'#1a9944',
    color:'#ffffff',fontFamily:UI_FONT,
    fontWeight:700,
    boxShadow:isPlaying
      ?'0 4px 0 #801010,0 0 20px #ff333344'
      :'0 4px 0 #0e6628,0 0 20px #22dd5544',
    transition:'background 0.12s,box-shadow 0.12s,width 0.15s,height 0.15s',
    display:'flex',alignItems:'center',justifyContent:'center',
  };

  return e('div',null,
    // Form selector — own row so buttons can wrap freely; standards visually separated
    !isPlaying?(
    level==='essentials'
      ?e('div',{'data-tour':'play-form-row',style:{marginBottom:10}},
          e('div',{style:{display:'flex',gap:6,alignItems:'center',marginBottom:5}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Progression'),
            e('button',{onClick:()=>setForm('major'),style:modeBtn(form==='major',FORM_DEFS.major.col,FORM_DEFS.major.bg)},FORM_DEFS.major.lbl),
          ),
          e('div',{style:{position:'relative'}},
            e('div',{style:{display:'flex',gap:6,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none',msOverflowStyle:'none'}},
              ['minor','turn','blues','minblues','tritone','secdom','bluebossa','autumn','attya','stella','twnbay'].map(f=>
                e('button',{key:f,onClick:()=>onUpgrade(FORM_DEFS[f].lbl),style:{
                  padding:'4px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,
                  fontSize:'0.72rem',border:'1px solid '+BORDER,background:'transparent',
                  color:HINT,fontWeight:600,minHeight:36,letterSpacing:'0.2px',
                  flexShrink:0,opacity:0.55,
                }},
                  '🔒 ',FORM_DEFS[f].lbl
                )
              )
            ),
            e('div',{style:{
              position:'absolute',top:0,right:0,width:40,height:'100%',
              background:'linear-gradient(to right, transparent, var(--bg))',
              pointerEvents:'none',
            }})
          )
        )
      :e('div',{'data-tour':'play-form-row',style:{marginBottom:10}},
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:5}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Progressions'),
            ['major','minor','turn','blues','minblues','tritone','secdom','custom'].map(f=>
              e('button',{key:f,onClick:()=>setForm(f),style:modeBtn(form===f,FORM_DEFS[f].col,FORM_DEFS[f].bg)},FORM_DEFS[f].lbl)
            )
          ),
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Standards'),
            ['bluebossa','autumn','attya','stella','twnbay'].map(f=>
              e('button',{key:f,onClick:()=>setForm(f),style:modeBtn(form===f,FORM_DEFS[f].col,FORM_DEFS[f].bg)},FORM_DEFS[f].lbl)
            ),
            e('button',{
              title:'Save current progression as a favorite',
              onClick:()=>{
                const lbl=(FORM_DEFS[form]?.lbl||form)+' · '+bpm+'bpm · '+vType;
                const prog=form==='custom'?customProg:undefined;
                const bvts=barVTypes.some(Boolean)?[...barVTypes]:undefined;
                if(savedFaves.some(f=>f.form===form&&f.bpm===bpm&&f.vType===vType&&
                  (form!=='custom'||JSON.stringify(f.prog)===JSON.stringify(prog)))) return;
                const extra={};if(prog)extra.prog=prog;if(bvts)extra.barVTypes=bvts;
                setSavedFaves(fs=>[...fs,{form,bpm,vType,lbl,...extra}]);
              },
              style:{padding:'4px 10px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,
                fontSize:'0.75rem',border:'1px solid '+BTN_BRD,background:'transparent',
                color:savedFaves.some(f=>f.form===form&&f.bpm===bpm&&f.vType===vType)?GOLD:BTN_OFF,
                minHeight:44,flexShrink:0,marginLeft:'auto',
              }
            },'★')
          ),
          savedFaves.length>0?e('div',{style:{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginTop:5}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Saved'),
            savedFaves.map((fav,i)=>
              e('div',{key:i,style:{display:'flex',alignItems:'center',gap:0,
                border:'1px solid '+GOLD+'55',borderRadius:5,overflow:'hidden'}},
                e('button',{
                  onClick:()=>{pendingBarVTypesRef.current=fav.barVTypes||null;
                    setForm(fav.form);setBpm(fav.bpm);
                    const safeVT=(level==='essentials'&&fav.vType!=='shell')?'shell':fav.vType;
                    setVType(safeVT);
                    if(fav.prog&&fav.form==='custom') setCustomProg(fav.prog);},
                  title:'Restore: '+fav.lbl,
                  style:{padding:'3px 8px',cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.68rem',
                    border:'none',background:'transparent',color:GOLD,minHeight:0,whiteSpace:'nowrap'}
                },fav.lbl),
                e('button',{
                  onClick:()=>setSavedFaves(fs=>fs.filter((_,j)=>j!==i)),
                  title:'Remove favorite',
                  style:{padding:'3px 5px',cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.68rem',
                    border:'none',borderLeft:'1px solid '+GOLD+'33',background:'transparent',
                    color:HINT,minHeight:0}
                },'×')
              )
            )
          ):null
        )
    ):null,
    // Play-along controls
    e('div',{'data-tour':'play-transport',style:{display:'flex',alignItems:'center',flexWrap:'wrap',gap:isPlaying?6:10,marginBottom:10,
      padding:isPlaying?'6px 10px':'10px 14px',background:BG2,border:'1px solid '+BORDER,borderRadius:8}},
      // Left: play button + BPM grouped so they stay together
      e('div',{style:{display:'flex',alignItems:'center',gap:8,flexShrink:0}},
        countIn>0||starting
          ?e('div',{style:{minWidth:80,textAlign:'center',fontSize:'1.6rem',fontWeight:700,
              color:'#ffffff',fontFamily:SERIF,letterSpacing:4}},countIn>0?countIn:'')
          :e('button',{onClick:isPlaying?stopPlayback:startPlayback,style:playBtn},
              isPlaying
                ?e('svg',{width:18,height:18,viewBox:'0 0 18 18'},e('rect',{x:2,y:2,width:14,height:14,rx:2,fill:'white'}))
                :e('svg',{width:18,height:18,viewBox:'0 0 18 18'},e('polygon',{points:'3,1 17,9 3,17',fill:'white'}))),
        e('span',{style:{fontSize:'0.72rem',color:HINT,fontFamily:UI_FONT,minWidth:52,
          visibility:isPlaying&&loopCount>0?'visible':'hidden'}},
          'Loop '+loopCount),
        e(BpmKnob,{bpm,setBpm,onTap:handleTap})
      ),
      // Right: instruments (with Mix sub-buttons), separator, click
      e('div',{style:{display:'flex',gap:4,marginLeft:'auto',alignItems:'flex-end'}},
        // BASS + Mix
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e(LedToggle,{label:'BASS',enabled:bassEnabled,onToggle:()=>setBassEnabled(v=>!v),color:'#74C0FC',textColor:'var(--led-bass-fg)',compact:isPlaying}),
          e('button',{onClick:()=>{setShowEq(v=>!v);setShowGuitarEq(false);setShowRideEq(false);},'aria-label':'Bass Mix',title:'Bass EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showEq?'#74C0FC22':'transparent',color:showEq||eqGains.some(v=>v!==0)||bassVolume!==80?'var(--led-bass-fg)':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},isPlaying?(showEq?'▴':'▾'):(showEq?'MIX ▴':'MIX ▾'))
        ),
        // COMP + Mix
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e(LedToggle,{label:'GUITAR',enabled:guitarEnabled,onToggle:()=>setGuitarEnabled(v=>!v),color:'#86EFAC',textColor:'var(--led-guitar-fg)',compact:isPlaying}),
          e('button',{onClick:()=>{setShowGuitarEq(v=>!v);setShowEq(false);setShowRideEq(false);},'aria-label':'Comp Mix',title:'Comp EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showGuitarEq?'#86EFAC22':'transparent',color:showGuitarEq||guitarEqGains.some(v=>v!==0)||guitarVolume!==80?'var(--led-guitar-fg)':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},isPlaying?(showGuitarEq?'▴':'▾'):(showGuitarEq?'MIX ▴':'MIX ▾'))
        ),
        // RIDE + Mix
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e(LedToggle,{label:'RIDE',enabled:rideEnabled,onToggle:()=>setRideEnabled(v=>!v),color:'#FFD43B',textColor:'var(--led-ride-fg)',compact:isPlaying}),
          e('button',{onClick:()=>{setShowRideEq(v=>!v);setShowEq(false);setShowGuitarEq(false);},'aria-label':'Ride Mix',title:'Ride EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showRideEq?'#FFD43B22':'transparent',color:showRideEq||rideEqGains.some(v=>v!==0)||rideVolume!==80?'var(--led-ride-fg)':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},isPlaying?(showRideEq?'▴':'▾'):(showRideEq?'MIX ▴':'MIX ▾'))
        ),
        // Separator before click-only control
        e('div',{style:{width:1,alignSelf:'stretch',background:BORDER,margin:'0 2px'}}),
        // CLICK — metronome icon button
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e('button',{
            onClick:()=>setMetronomeEnabled(v=>!v),
            title:'Click track',
            style:{
              background:'none',border:'none',cursor:'pointer',padding:'3px 4px',minHeight:0,
              display:'flex',flexDirection:'column',alignItems:'center',gap:1,
            }
          },
            e('svg',{width:22,height:22,viewBox:'0 0 24 24',fill:'none',xmlns:'http://www.w3.org/2000/svg'},
              e('polygon',{points:'5,22 19,22 15,4 9,4',stroke:metronomeEnabled?'#aaaacc':BTN_OFF,strokeWidth:1.5,fill:metronomeEnabled?'#aaaacc18':'none',strokeLinejoin:'round'}),
              e('line',{x1:12,y1:22,x2:12,y2:4,stroke:metronomeEnabled?'#aaaacc':BTN_OFF,strokeWidth:1,opacity:0.4}),
              e('line',{x1:12,y1:13,x2:17,y2:8,stroke:metronomeEnabled?'#FFD43B':'#FFD43B66',strokeWidth:2,strokeLinecap:'round'}),
              e('circle',{cx:12,cy:22,r:1.5,fill:metronomeEnabled?'#aaaacc':BTN_OFF})
            ),
            e('span',{style:{fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
              color:metronomeEnabled?'#aaaacc':BTN_OFF}},'CLICK')
          )
        )
      )
    ),
    // Bass EQ panel
    showEq?e('div',{style:{
      marginBottom:isPlaying?0:10,padding:'10px 14px',background:BG2,
      border:'1px solid #74C0FC44',
      ...(isPlaying
        ?{position:'fixed',bottom:0,left:0,right:0,zIndex:150,
           borderRadius:'12px 12px 0 0',boxShadow:'0 -4px 20px rgba(0,0,0,0.5)',
           paddingBottom:'calc(10px + env(safe-area-inset-bottom))'}
        :{borderRadius:8}
      ),
    }},
      e('div',{style:{display:'flex',alignItems:'center',marginBottom:8}},
        e('span',{style:{fontSize:'0.72rem',color:'#74C0FC',letterSpacing:'0.3px',fontFamily:UI_FONT}},'Bass Mix'),
        e('button',{onClick:()=>setEqGains([0,0,0,0,0]),style:{
          marginLeft:'auto',padding:'2px 10px',borderRadius:4,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.68rem',border:'1px solid '+BTN_BRD,
          background:'transparent',color:BTN_OFF,minHeight:44,
        }},'Flat')
      ),
      e('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
        e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT,flexShrink:0}},'Vol'),
        e('input',{type:'range',min:0,max:100,step:1,value:bassVolume,
          onChange:ev=>setBassVolume(+ev.target.value),
          style:{flex:1,accentColor:'#74C0FC',cursor:'pointer'}}),
        e('span',{style:{fontSize:'0.65rem',color:'#74C0FC',fontFamily:UI_FONT,minWidth:28,textAlign:'right'}},bassVolume+'%')
      ),
      e('div',{style:{display:'flex',justifyContent:'space-around'}},
        EQ_FREQS.map((freq,i)=>
          e('div',{key:i,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:4}},
            e('span',{style:{
              fontSize:'0.65rem',fontFamily:UI_FONT,minWidth:28,textAlign:'center',
              color:eqGains[i]>0?GOLD:eqGains[i]<0?'#FF6B6B':HINT,
            }},(eqGains[i]>0?'+':'')+eqGains[i]),
            e('input',{
              type:'range',min:-12,max:12,step:1,value:eqGains[i],
              onChange:ev=>{const g=[...eqGains];g[i]=+ev.target.value;setEqGains(g);},
              style:{
                WebkitAppearance:'slider-vertical',
                writingMode:'vertical-lr',direction:'rtl',
                width:28,height:96,cursor:'pointer',
                accentColor:GOLD,touchAction:'none',
              }
            }),
            e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT}},EQ_LABELS[i])
          )
        )
      )
    ):null,
    // Comp guitar EQ panel
    showGuitarEq?e('div',{style:{
      marginBottom:isPlaying?0:10,padding:'10px 14px',background:BG2,
      border:'1px solid #86EFAC44',
      ...(isPlaying
        ?{position:'fixed',bottom:0,left:0,right:0,zIndex:150,
           borderRadius:'12px 12px 0 0',boxShadow:'0 -4px 20px rgba(0,0,0,0.5)',
           paddingBottom:'calc(10px + env(safe-area-inset-bottom))'}
        :{borderRadius:8}
      ),
    }},
      e('div',{style:{display:'flex',alignItems:'center',marginBottom:10}},
        e('span',{style:{fontSize:'0.72rem',color:'#86EFAC',letterSpacing:'0.3px',fontFamily:UI_FONT}},'Comp Mix'),
        e('button',{onClick:()=>setGuitarEqGains([0,0,0,0,0]),style:{
          marginLeft:'auto',padding:'2px 10px',borderRadius:4,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.68rem',border:'1px solid '+BTN_BRD,
          background:'transparent',color:BTN_OFF,minHeight:44,
        }},'Flat')
      ),
      e('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
        e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT,flexShrink:0}},'Vol'),
        e('input',{type:'range',min:0,max:100,step:1,value:guitarVolume,
          onChange:ev=>setGuitarVolume(+ev.target.value),
          style:{flex:1,accentColor:'#86EFAC',cursor:'pointer'}}),
        e('span',{style:{fontSize:'0.65rem',color:'#86EFAC',fontFamily:UI_FONT,minWidth:28,textAlign:'right'}},guitarVolume+'%')
      ),
      e('div',{style:{display:'flex',justifyContent:'space-around'}},
        EQ_FREQS.map((freq,i)=>
          e('div',{key:i,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:4}},
            e('span',{style:{
              fontSize:'0.65rem',fontFamily:UI_FONT,minWidth:28,textAlign:'center',
              color:guitarEqGains[i]>0?GOLD:guitarEqGains[i]<0?'#FF6B6B':HINT,
            }},(guitarEqGains[i]>0?'+':'')+guitarEqGains[i]),
            e('input',{
              type:'range',min:-12,max:12,step:1,value:guitarEqGains[i],
              onChange:ev=>{const g=[...guitarEqGains];g[i]=+ev.target.value;setGuitarEqGains(g);},
              style:{
                WebkitAppearance:'slider-vertical',
                writingMode:'vertical-lr',direction:'rtl',
                width:28,height:96,cursor:'pointer',
                accentColor:'#86EFAC',touchAction:'none',
              }
            }),
            e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT}},EQ_LABELS[i])
          )
        )
      )
    ):null,
    // Ride EQ panel
    showRideEq?e('div',{style:{
      marginBottom:isPlaying?0:10,padding:'10px 14px',background:BG2,
      border:'1px solid '+GOLD+'44',
      ...(isPlaying
        ?{position:'fixed',bottom:0,left:0,right:0,zIndex:150,
           borderRadius:'12px 12px 0 0',boxShadow:'0 -4px 20px rgba(0,0,0,0.5)',
           paddingBottom:'calc(10px + env(safe-area-inset-bottom))'}
        :{borderRadius:8}
      ),
    }},
      e('div',{style:{display:'flex',alignItems:'center',marginBottom:8}},
        e('span',{style:{fontSize:'0.72rem',color:GOLD,letterSpacing:'0.3px',fontFamily:UI_FONT}},'Ride Mix'),
        e('button',{onClick:()=>setRideEqGains([0,0,0,0,0]),style:{
          marginLeft:'auto',padding:'2px 10px',borderRadius:4,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.68rem',border:'1px solid '+BTN_BRD,
          background:'transparent',color:BTN_OFF,minHeight:44,
        }},'Flat')
      ),
      e('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:10}},
        e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT,flexShrink:0}},'Vol'),
        e('input',{type:'range',min:0,max:100,step:1,value:rideVolume,
          onChange:ev=>setRideVolume(+ev.target.value),
          style:{flex:1,accentColor:GOLD,cursor:'pointer'}}),
        e('span',{style:{fontSize:'0.65rem',color:GOLD,fontFamily:UI_FONT,minWidth:28,textAlign:'right'}},rideVolume+'%')
      ),
      e('div',{style:{display:'flex',justifyContent:'space-around'}},
        EQ_FREQS.map((freq,i)=>
          e('div',{key:i,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:4}},
            e('span',{style:{fontSize:'0.65rem',fontFamily:UI_FONT,minWidth:28,textAlign:'center',
              color:rideEqGains[i]>0?GOLD:rideEqGains[i]<0?'#FF6B6B':HINT,
            }},(rideEqGains[i]>0?'+':'')+rideEqGains[i]),
            e('input',{type:'range',min:-12,max:12,step:1,value:rideEqGains[i],
              onChange:ev=>{const g=[...rideEqGains];g[i]=+ev.target.value;setRideEqGains(g);},
              style:{WebkitAppearance:'slider-vertical',writingMode:'vertical-lr',direction:'rtl',
                width:28,height:96,cursor:'pointer',accentColor:GOLD,touchAction:'none'}
            }),
            e('span',{style:{fontSize:'0.65rem',color:LBL,fontFamily:UI_FONT}},EQ_LABELS[i])
          )
        )
      )
    ):null,
    // Custom progression controls
    form==='custom'&&!isPlaying?e('div',{style:{marginBottom:8}},
      e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:editingBar>=0?6:0,alignItems:'center'}},
        e('span',{style:{fontSize:'0.72rem',color:'#9CA3AF',letterSpacing:'0.3px'}},'Custom progression'),
        e('button',{onClick:()=>setCustomProg(p=>[...p,{root:0,q:'dom7'}]),
          disabled:customProg.length>=12,
          style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
            border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,minHeight:44}},
          '+ Bar'),
        customProg.length>1?e('button',{onClick:()=>{setCustomProg(p=>{const n=p.slice(0,-1);setActiveChordIdx(a=>Math.min(a,n.length-1));return n;});setEditingBar(-1);},
          style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
            border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,minHeight:44}},
          '− Bar'):null,
        e('button',{onClick:()=>setCustomProg(DFLT_CPROG),
          style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
            border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,minHeight:44}},
          'Reset')
      ),
      editingBar>=0?e('div',{style:{padding:'8px 12px',background:BG2,border:'1px solid '+GOLD,
        borderRadius:6,marginBottom:6}},
        e('div',{style:{display:'flex',alignItems:'center',marginBottom:6,gap:10}},
          e('span',{style:{fontSize:'0.77rem',color:GOLD,letterSpacing:'0.5px',fontWeight:600}},'Bar '+(editingBar+1)+' — Root'),
          e('button',{onClick:()=>setEditingBar(-1),style:{marginLeft:'auto',padding:'2px 8px',borderRadius:4,
            cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',border:'1px solid '+BTN_BRD,
            background:'transparent',color:BTN_OFF,minHeight:44}},'✕ Close')
        ),
        e('div',{style:{display:'flex',gap:3,flexWrap:'wrap',marginBottom:8}},
          KEYS.map((k,i)=>e('button',{key:i,onClick:()=>setCustomProg(p=>p.map((b,j)=>j===editingBar?{...b,root:k.root}:b)),
            style:{padding:'3px 8px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',minHeight:44,
              border:'1px solid '+(customProg[editingBar]?.root===k.root?GOLD:BTN_BRD),
              background:customProg[editingBar]?.root===k.root?ACT_GOLD:BG2,
              color:customProg[editingBar]?.root===k.root?GOLD:BTN_OFF}},k.name))
        ),
        e('div',{style:{display:'flex',gap:4,flexWrap:'wrap',alignItems:'center'}},
          e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',marginRight:4}},'Quality'),
          CPROG_QUALS.map(qid=>{const qt=EXT_TYPES.find(t=>t.id===qid);return e('button',{key:qid,
            onClick:()=>setCustomProg(p=>p.map((b,j)=>j===editingBar?{...b,q:qid}:b)),
            style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',minHeight:44,
              border:'1px solid '+(customProg[editingBar]?.q===qid?'#C084FC':BTN_BRD),
              background:customProg[editingBar]?.q===qid?ACT_PUR:BG2,
              color:customProg[editingBar]?.q===qid?'#C084FC':BTN_OFF}},qt.sym);})
        )
      ):null
    ):null,
    // Lead-sheet chord display — rows of 4 bars with measure lines
    e('div',{'data-tour':'bar-grid',style:{border:'1px solid '+BORDER,borderRadius:8,overflow:'hidden',marginBottom:10}},
      Array.from({length:Math.ceil(bars.length/4)},(_,rowIdx)=>{
        const rowStart=rowIdx*4;
        const rowBars=bars.slice(rowStart,rowStart+4);
        const isNewSection=rowIdx>0&&rowStart%8===0;
        return e('div',{key:rowIdx,style:{
          display:'flex',
          borderTop:rowIdx===0?'none':(isNewSection?'2px solid '+BORDER:'1px solid '+BORDER),
        }},
          rowBars.map((ci,col)=>{
            const barIdx=rowStart+col;
            const lit=isPlaying&&playingBar===barIdx;
            const isSel=!isPlaying&&barIdx===activeChordIdx;
            const isPinned=pinnedChords.has(barIdx);
            const isEditing=form==='custom'&&editingBar===barIdx;
            const hasBarOverride=!!(barVTypes[barIdx]);
            return e('div',{key:barIdx,
              onClick:()=>{
                setActiveChordIdx(barIdx);
                if(form==='custom') setEditingBar(prev=>prev===barIdx?-1:barIdx);
              },
              style:{
                flex:1,position:'relative',padding:isPlaying?'3px 4px 5px':'5px 7px 10px',cursor:'pointer',
                borderRight:col<rowBars.length-1?'1px solid '+BORDER:'none',
                background:lit?ACT_YEL:isSel?ACT_GOLD+'44':isEditing?ACT_GOLD:'transparent',
                animation:lit?'barPulse '+(60/bpm).toFixed(2)+'s ease-in-out infinite':'none',
                transition:'background 0.1s,padding 0.15s,min-height 0.15s',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:isPlaying?34:54,
              }
            },
              hasBarOverride?e('div',{style:{position:'absolute',left:0,top:0,bottom:0,width:3,
                background:'#74C0FC',opacity:0.7,borderRadius:'0 0 0 0'}}):null,
              e('div',{style:{position:'absolute',top:4,left:hasBarOverride?8:6,fontSize:'0.5rem',lineHeight:1,
                color:lit?'#FFD43Baa':HINT,fontFamily:UI_FONT}},barIdx+1),
              e('div',{style:{fontSize:'0.62rem',fontWeight:600,lineHeight:1,marginBottom:2,textAlign:'center',
                color:lit?'#FFD43B':isSel||isEditing?GOLD:HINT,fontFamily:UI_FONT}},chords[ci].roman),
              e('div',{style:{fontSize:'0.82rem',fontWeight:lit||isSel?700:400,lineHeight:1.1,textAlign:'center',
                color:lit?'#FFD43B':isSel||isEditing?GOLD:BTN_OFF,fontFamily:SERIF}},chords[ci].name),
              isPinned&&!lit?e('div',{style:{position:'absolute',top:4,right:4,
                width:5,height:5,borderRadius:'50%',background:GOLD,opacity:0.9}}):null
            );
          })
        );
      })
    ),
    // Dot mode toggle — always visible so you can change notation during playback
    setDotMode?e(DotModeToggle,{dotMode,setDotMode}):null,
    // Neck
    e(ScrollNeck,{arpPos,highlight,scalePos,extraDots:gtDots,degNames:ac.dnames,dotMode,dotKeyIdx:keyIdx,marginBottom:level==='essentials'?12:0}),
    // Scale + guide-tone controls (full mode only)
    level==='pro'&&e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',
      padding:'6px 10px',background:BG2,border:'1px solid '+BORDER,borderTop:'none',
      borderRadius:'0 0 9px 9px',marginBottom:12,minHeight:52}},
      e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.5px',flexShrink:0}},'Scale'),
      (SCALE_HINTS[ac.quality]||[]).map(sc=>
        e('button',{key:sc.name,onClick:()=>{const next=scaleHint===sc.name?null:sc.name;setScaleHint(next);if(next)scaleByQualityRef.current[ac.quality]=next;},style:{
          padding:'3px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
          border:'1px solid '+(scaleHint===sc.name?GOLD:BTN_BRD),
          background:scaleHint===sc.name?ACT_GOLD:BG2,
          color:scaleHint===sc.name?GOLD:BTN_OFF,minHeight:44}},
          sc.name+' — '+sc.note)
      ),
      (SCALE_HINTS[ac.quality]||[]).length===0&&e('span',{style:{fontSize:'0.72rem',color:HINT}},'—'),
      e('span',{style:{marginLeft:'auto',flexShrink:0}},
        e('button',{onClick:()=>setShowGTLine(v=>!v),style:{
          padding:'3px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
          border:'1px solid '+(showGTLine?GOLD:BTN_BRD),
          background:showGTLine?ACT_GOLD:BG2,
          color:showGTLine?GOLD:BTN_OFF,minHeight:44}},'Guide tones ♦')
      )
    ),
    // Voicing + String Set row — full buttons when stopped, compact label when playing
    e('div',{style:{marginBottom:8}},
      isPlaying
        ?e('div',{style:{display:'flex',alignItems:'center',gap:6}},
            e('span',{style:{fontSize:'0.68rem',color:LBL}},'Voicing'),
            e('span',{style:{fontSize:'0.68rem',color:GOLD,fontWeight:600}},
              activeVT==='shell'?'Shell':activeVT==='drop3'?'Drop 3':activeVT==='rootless'?'Rootless':'Drop 2'
              +(vType!=='shell'&&dropD.sets[ssIdx]?' · '+dropD.sets[ssIdx].lbl:'')
            )
          )
        :e('div',{style:{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}},
            e('div',{style:{display:'flex',gap:6,alignItems:'center',flexShrink:0}},
              e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'},title:'Voicing style applied to every bar — override a single bar with "Customize this bar" below'},'Voicing (all bars)'),
              (level==='essentials'
                ?[{id:'shell',lbl:'Shell'}]
                :[{id:'drop2',lbl:'Drop 2'},{id:'drop3',lbl:'Drop 3'},{id:'rootless',lbl:'Rootless'},{id:'shell',lbl:'Shell'}]
              ).map(({id,lbl})=>e('button',{key:id,onClick:()=>setVType(id),style:mkSsBtn(vType===id)},lbl))
            ),
            vType!=='shell'?e('div',{key:'ssg',style:{display:'flex',gap:6,alignItems:'center',flexShrink:0}},
              e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'Set'),
              dropD.sets.map((set,i)=>
                e('button',{key:i,onClick:()=>setStrSetIdx(i),style:mkSsBtn(strSetIdx===i)},set.lbl)
              )
            ):null
          )
    ),
    // Voicing picker — always show chord boxes; compact inversion label during playback
    e('div',null,
      e('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
        (()=>{
          const pick=(ii)=>{
            const n=[...invIdxs];n[safeBarIdx]=ii;
            const newPinned=new Set(pinnedChords);newPinned.add(safeBarIdx);
            setPinnedChords(newPinned);
            const cs=chordsRef.current,brs=barsRef.current;
            if(cs&&brs&&brs.length>=2) setInvIdxs(runVL(computeAllVoicings(cs,brs,barVTypes),n,newPinned));
            else setInvIdxs(n);
          };
          const pickType=(t)=>{
            const newBVTs=[...barVTypes];
            newBVTs[safeBarIdx]={vType:t,strSetIdx};
            setBarVTypes(newBVTs);
            const newPinned=new Set(pinnedChords);newPinned.delete(safeBarIdx);
            setPinnedChords(newPinned);
            const newIdxs=[...invIdxs];newIdxs[safeBarIdx]=0;
            const cs=chordsRef.current,brs=barsRef.current;
            if(cs&&brs&&brs.length>=2) setInvIdxs(runVL(computeAllVoicings(cs,brs,newBVTs),newIdxs,newPinned));
            else setInvIdxs(newIdxs);
          };
          const clearBarType=()=>{
            const newBVTs=[...barVTypes];newBVTs[safeBarIdx]=null;
            setBarVTypes(newBVTs);
            const newPinned=new Set(pinnedChords);newPinned.delete(safeBarIdx);
            setPinnedChords(newPinned);
            const newIdxs=[...invIdxs];newIdxs[safeBarIdx]=0;
            const cs=chordsRef.current,brs=barsRef.current;
            if(cs&&brs&&brs.length>=2) setInvIdxs(runVL(computeAllVoicings(cs,brs,newBVTs),newIdxs,newPinned));
            else setInvIdxs(newIdxs);
          };
          const typeBtn=(t,label,locked)=>e('button',{key:t,onClick:locked?()=>onUpgrade('Drop 3'):()=>pickType(t),style:{
            padding:'2px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.7rem',
            border:'1px solid '+(activeVT===t?GOLD:BTN_BRD),
            background:activeVT===t?ACT_GOLD:'transparent',
            color:activeVT===t?GOLD:BTN_OFF,minHeight:0,opacity:locked?0.6:1,
          }},label,(locked?e('span',{style:{fontSize:'0.55rem',marginLeft:2}},'🔒'):null));
          // Per-bar override is progressive disclosure: collapsed to a link until the
          // user opts in (or the bar already carries an override).
          const barOverrideOpen=!!barVT||showBarOverride;
          return e(React.Fragment,null,
            barOverrideOpen
              ?e('div',{style:{width:'100%',display:'flex',alignItems:'center',gap:5,marginBottom:6,flexWrap:'wrap'}},
                  e('span',{style:{fontSize:'0.65rem',color:HINT,fontFamily:UI_FONT,letterSpacing:'0.3px'},
                    title:'Voicing for this bar only — other bars keep the global setting'},'This bar ('+ac.name+')'),
                  typeBtn('shell','Shell'),
                  typeBtn('drop2','Drop 2'),
                  typeBtn('drop3','Drop 3',isEss),
                  barVT
                    ?e('button',{onClick:()=>{clearBarType();setShowBarOverride(false);},style:{
                        marginLeft:4,padding:'2px 7px',borderRadius:4,cursor:'pointer',
                        fontFamily:UI_FONT,fontSize:'0.65rem',
                        border:'1px solid '+BTN_BRD,background:'transparent',color:HINT,minHeight:0,
                      }},'↺ default')
                    :e('button',{onClick:()=>setShowBarOverride(false),style:{
                        marginLeft:4,padding:'2px 7px',borderRadius:4,cursor:'pointer',
                        fontFamily:UI_FONT,fontSize:'0.65rem',
                        border:'1px solid '+BTN_BRD,background:'transparent',color:HINT,minHeight:0,
                      }},'✕')
                )
              :e('div',{style:{width:'100%',marginBottom:6}},
                  e('button',{onClick:()=>setShowBarOverride(true),style:{
                    padding:'2px 0',background:'none',border:'none',cursor:'pointer',
                    fontFamily:UI_FONT,fontSize:'0.68rem',color:HINT,minHeight:0,
                    textDecoration:'underline',textUnderlineOffset:2}},
                    'Customize this bar ('+ac.name+') →')
                ),
            activeVT==='shell'
              ?SHELLS.map((sh,ii)=>
                  e(ChordBox,{key:ii,voicing:activeVoicings[ii],strings:sh.s,tones:ac.tones,
                    degNames:ac.dnames,invLabel:sh.lbl+' ('+sh.root+')',bassLabel:'bass: R',
                    selected:invIdxs[safeBarIdx]===ii,dotMode,
                    dotKeyIdx:form==='custom'?ac.rootPC:keyIdx,onClick:()=>pick(ii)
                  })
                )
              :activeVT==='rootless'
                ?(ROOTLESS_OK.has(ac.quality)?ROOTLESS:SHELLS).map((cfg,ii)=>
                    e(ChordBox,{key:ii,voicing:activeVoicings[ii],strings:cfg.s,
                      tones:activeRlTones||ac.tones,
                      degNames:activeRlTones?RL_DNAMES[ac.quality]:ac.dnames,
                      tcArr:activeRlTones?TC_RL:undefined,
                      invLabel:activeRlTones?cfg.lbl+' ('+cfg.strs+')':cfg.lbl+' ('+cfg.root+')',
                      bassLabel:activeRlTones?'no root':'bass: R',
                      selected:invIdxs[safeBarIdx]===ii,dotMode,
                      dotKeyIdx:form==='custom'?ac.rootPC:keyIdx,onClick:()=>pick(ii)
                    })
                  )
                :activeDropD.inv.map((inv,ii)=>
                    e(ChordBox,{key:ii,voicing:activeVoicings[ii],strings:activeSS,tones:ac.tones,
                      degNames:ac.dnames,
                      invLabel:ii===0?'Root pos.':ac.dnames[inv.bassIdx]+' bass',
                      bassLabel:ii===0?'bass: '+ac.dnames[inv.bassIdx]:null,
                      selected:invIdxs[safeBarIdx]===ii,dotMode,
                      dotKeyIdx:form==='custom'?ac.rootPC:keyIdx,onClick:()=>pick(ii)
                    })
                  )
          );
        })()
      )
    )
  );
}

// ── CustomChordView ───────────────────────────────────────────────────
// Reuses the same voicing UI as the diatonic view. Receives the active
// chord data as props and renders controls + neck + chord boxes.
function CustomChordView({customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level,dotMode,setDotMode,onFindInKey,vType,setVType,onUpgrade,ssIdx,setSsIdx,invIdx,setInvIdx,shellIdx,setShellIdx}){
  dotMode=dotMode||'interval';
  const isEss=level==='essentials';
  const [detectMode,setDetectMode]=useState(false);
  const [selectedFrets,setSelectedFrets]=useState({}); // {stringIdx: fretNum}
  const [completionChord,setCompletionChord]=useState(null);
  const detectFretPos=5; // how many frets shown at once
  const [fretOffset,setFretOffset]=useState(0);
  // ssIdx / invIdx / shellIdx are lifted to App state (shared with the Keys
  // view) so the chosen voicing — string set, inversion, shell shape —
  // survives switching between Any Chord and Keys via "In a key ↗" /
  // "Explore ↗". The index tables (DROP_DATA, D2_INV, SHELLS) are identical
  // across both views, so the values transfer directly.
  const [extOpt,setExtOpt]=useState(null); // active extension id or null
  const typeChangeMount=useRef(false); // skip the reset-on-mount run
  const shellResetMount=useRef(false);
  useEffect(()=>{
    if(isEss&&(vType==='drop3'||vType==='drop24'||vType==='drop23'||vType==='drop2'))setVType('shell');
    if(isEss)setExtOpt(null);
  },[level]);
  useEffect(()=>{
    // Skip the mount run so a voicing carried in from the Keys view (via
    // "Explore ↗") isn't reset; only reset when the user picks a new chord here.
    if(!typeChangeMount.current){typeChangeMount.current=true;return;}
    setExtOpt(null);setInvIdx(0);setScaleHintCustom(null);
  },[customTypeIdx,customRoot]);

  const [scaleHintCustom,setScaleHintCustom]=useState(null);
  const scaleHintQKey={'maj7':'maj7','m7':'m7','dom7':'dom7','m7b5':'m7b5','maj9':'maj7','m9':'m7','dom9':'dom7','7alt':'dom7','7b9':'dom7','9sus':'dom7'};
  const baseType=EXT_TYPES[customTypeIdx];
  const availExts=CHORD_EXTS[customTypeIdx]||[];
  const extDef=extOpt?availExts.find(e=>e.id===extOpt):null;
  // Extension replaces the 5th (interval slot 2) with a colour tone
  const effectiveIv=extDef?baseType.iv.map((x,i)=>i===2?extDef.tone:x):baseType.iv;
  const degNames=extDef?baseType.dn.map((x,i)=>i===2?extDef.dn:x):baseType.dn;
  const tones=useMemo(()=>effectiveIv.map(i=>(customRoot+i)%12),[customRoot,customTypeIdx,extOpt]);
  const arpPos=useMemo(()=>getArpPos(tones),[tones]);
  const customScaleKey=scaleHintQKey[baseType&&baseType.id]||null;
  const customScaleOpts=(customScaleKey&&SCALE_HINTS[customScaleKey])||[];
  const customActiveScale=scaleHintCustom?customScaleOpts.find(s=>s.name===scaleHintCustom):null;
  const customScalePos=useMemo(()=>customActiveScale?getScalePos(customRoot,customActiveScale.iv,tones):[]
    ,[scaleHintCustom,customRoot,customTypeIdx,extOpt]); // eslint-disable-line react-hooks/exhaustive-deps
  // Build chord name using enharmonic spelling matching the root (Ab not G#, Bb not A#)
  const chordName=nn(customRoot,customRoot)+baseType.sym+(extDef?extDef.sym:'');

  // Audio preview for the root/type/extension selectors — mirrors the diatonic
  // chord cards, which play a shell voicing on tap. Computed from the passed
  // values (not state) since setState is async and tones lag a render behind.
  const previewSelection=(root,typeIdx,extId)=>{
    try{
      const bt=EXT_TYPES[typeIdx];if(!bt) return;
      const exts=CHORD_EXTS[typeIdx]||[];
      const ed=extId?exts.find(x=>x.id===extId):null;
      const iv=ed?bt.iv.map((x,i)=>i===2?ed.tone:x):bt.iv;
      const tns=iv.map(i=>(root+i)%12);
      const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tns,1));
      const vi=vs.findIndex(v=>v!==null);
      if(vi>=0)playChordPreview(vs[vi],SHELLS[vi].s);
    }catch(ex){}
  };

  const dropD=DROP_DATA[vType]||DROP_DATA.drop2;
  const invData=dropD.inv, setsData=dropD.sets;
  const safeSSIdx=Math.min(ssIdx,setsData.length-1);

  const allVoicings=useMemo(()=>{
    if(vType==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,1));
    if(!DROP_TYPES.has(vType)) return [];
    const ss=setsData[safeSSIdx].s;
    return invData.map(inv=>calcVoicing(ss,inv.a,tones));
  },[vType,safeSSIdx,tones,ssIdx]);

  const firstValidShell=useMemo(()=>{
    const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,1));
    const f=vs.findIndex(v=>v!==null); return f>=0?f:0;
  },[tones]);
  useEffect(()=>{
    // Skip the mount run so a shell shape carried in from the Keys view isn't
    // snapped back to the first playable one; safeShellIdx still guards an
    // index that's invalid for the current chord.
    if(!shellResetMount.current){shellResetMount.current=true;return;}
    if(vType==='shell') setShellIdx(firstValidShell);
  },[firstValidShell,vType]);
  const safeShellIdx=allVoicings[shellIdx]?shellIdx:firstValidShell;
  const selIdx=vType==='shell'?safeShellIdx:invIdx;

  // Which string sets yield at least one playable inversion for this chord.
  const playableSets=useMemo(()=>DROP_TYPES.has(vType)
    ?setsData.map(ss=>invData.some(inv=>calcVoicing(ss.s,inv.a,tones)!==null)):[]
  ,[vType,setsData,invData,tones]);
  const firstPlayableSet=useMemo(()=>{const f=playableSets.findIndex(Boolean);return f>=0?f:0;},[playableSets]);
  // If the picked string set has no shape for this chord, snap to one that does
  // so the dead-end empty state is never reached in normal use.
  useEffect(()=>{
    if(DROP_TYPES.has(vType)&&playableSets.length&&!playableSets[safeSSIdx]&&playableSets[firstPlayableSet]){
      setSsIdx(firstPlayableSet);setInvIdx(0);
    }
  },[vType,playableSets,safeSSIdx,firstPlayableSet]);
  // True only when no string set works at all — then we hide the neck and show the notice.
  const noDropShape=DROP_TYPES.has(vType)&&playableSets.length>0&&!playableSets.some(Boolean);

  const highlight=useMemo(()=>{
    if(vType==='arpeggio') return null;
    const v=allVoicings[selIdx]; if(!v) return null;
    const ss=vType==='shell'?SHELLS[safeShellIdx].s:setsData[safeSSIdx].s;
    return v.frets.map((f,i)=>{
      const si=ss[i],ti=tones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?degNames[ti]:''};
    });
  },[allVoicings,selIdx,vType,safeShellIdx,safeSSIdx,tones,degNames]);

  const tabStyle=id=>{const act=vType===id;return{
    padding:'7px 14px',borderRadius:'6px 6px 0 0',cursor:'pointer',
    border:'1px solid '+(act?'#74C0FC30':BORDER),
    borderBottom:act?'1px solid '+BG2:'1px solid '+BORDER,
    background:act?BG2:BG,fontFamily:UI_FONT,fontSize:'0.76rem',
    color:act?'#74C0FC':BTN_OFF,fontWeight:act?700:400,minHeight:44};};

  const TABS=[
    {id:'shell',lbl:'Shell',locked:false},
    {id:'drop2',lbl:'Drop 2',locked:isEss},
    {id:'drop3',lbl:'Drop 3',locked:isEss},
    {id:'drop24',lbl:'Drop 2+4',locked:isEss},
    {id:'drop23',lbl:'Drop 2+3',locked:isEss},
    {id:'arpeggio',lbl:'Arpeggio',locked:false},
  ];

  const shellsA=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='A');
  const shellsB=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='B');

  const detectPcs=Object.entries(selectedFrets).map(([s,f])=>(OPEN_PC[parseInt(s)]+parseInt(f))%12);
  const detectedChords=detectPcs.length>=2?detectChords(detectPcs):[];
  // Pitch classes that would complete the user-selected incomplete chord
  const completionPcs=useMemo(()=>{
    if(!completionChord) return [];
    const fullPcs=completionChord.iv.map(i=>(completionChord.root+i)%12);
    return fullPcs.filter(pc=>!detectPcs.includes(pc));
  },[completionChord,detectPcs]); // eslint-disable-line react-hooks/exhaustive-deps
  const DETECT_NOTE_NAMES=['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
  // Lowest-pitched selected note → bass pitch-class, used to label inversion.
  const detectEntries=Object.entries(selectedFrets);
  const bassPc=detectEntries.length
    ?((Math.min(...detectEntries.map(([s,f])=>OPEN_MIDI[parseInt(s)]+parseInt(f)))%12)+12)%12
    :null;
  // Exactly two notes → identify the interval instead of a chord.
  let detectInterval=null;
  if(detectEntries.length===2){
    const midis=detectEntries.map(([s,f])=>OPEN_MIDI[parseInt(s)]+parseInt(f)).sort((a,b)=>a-b);
    const semi=midis[1]-midis[0], within=semi%12, octs=Math.floor(semi/12);
    const base=semi===0?'Unison':(within===0?'Octave':INTERVAL_NAMES[within]);
    detectInterval={
      name:base+(octs>0&&within!==0?' + '+octs+' oct':''),
      notes:nn(((midis[0]%12)+12)%12,0)+' → '+nn(((midis[1]%12)+12)%12,0),
      semi,
    };
  }

  const modeToggleRow=e('div',{style:{display:'flex',gap:8,marginBottom:14}},
    e('button',{onClick:()=>{setDetectMode(false);},style:{
      flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.82rem',
      fontWeight:!detectMode?700:400,border:'1px solid '+(!detectMode?GOLD:BTN_BRD),
      background:!detectMode?ACT_GOLD:'transparent',color:!detectMode?GOLD:BTN_OFF,minHeight:40}},
      'Build a Chord'),
    e('button',{onClick:()=>{if(isEss){onUpgrade('Find Chord');return;}setDetectMode(true);setSelectedFrets({});setFretOffset(0);},style:{
      flex:1,padding:'8px',borderRadius:8,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.82rem',
      fontWeight:detectMode?700:400,border:'1px solid '+(detectMode?GOLD:BTN_BRD),
      background:detectMode?ACT_GOLD:'transparent',color:detectMode?GOLD:BTN_OFF,minHeight:40,
      opacity:isEss?0.7:1}},
      'Find Chord',(isEss?e('span',{style:{fontSize:'0.6rem',marginLeft:3}},'🔒'):null))
  );

  if(detectMode) return e('div',null,
    modeToggleRow,
    e('div',{style:{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}},
      e('span',{style:{fontSize:'0.72rem',color:HINT,fontFamily:UI_FONT}},'Tap the notes you\'re playing'),
      e('div',{style:{display:'flex',gap:6,alignItems:'center'}},
        e('button',{onClick:()=>{setFretOffset(f=>Math.max(0,f-5));setSelectedFrets({});setCompletionChord(null);},disabled:fretOffset===0,style:{
          padding:'4px 10px',borderRadius:6,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
          border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,opacity:fretOffset===0?0.4:1}},'↑'),
        e('span',{style:{fontSize:'0.72rem',color:HINT,minWidth:50,textAlign:'center'}},
          fretOffset===0?'Open':'+'+(fretOffset)),
        e('button',{onClick:()=>{setFretOffset(f=>Math.min(7,f+5));setSelectedFrets({});setCompletionChord(null);},disabled:fretOffset>=7,style:{
          padding:'4px 10px',borderRadius:6,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
          border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,opacity:fretOffset>=7?0.4:1}},'↓')
      )
    ),
    e(DetectNeckSVG,{selectedFrets,fretOffset,completionPcs,
      onToggle:(si,fret)=>setSelectedFrets(sf=>sf[si]===fret?Object.fromEntries(Object.entries(sf).filter(([k])=>parseInt(k)!==si)):({...sf,[si]:fret}))}),
    // Clear button
    Object.keys(selectedFrets).length>0?e('button',{onClick:()=>{setSelectedFrets({});setCompletionChord(null);},style:{
      width:'100%',padding:'6px',background:'transparent',border:'1px solid '+BTN_BRD,
      borderRadius:6,color:BTN_OFF,fontFamily:UI_FONT,fontSize:'0.78rem',cursor:'pointer',minHeight:36,marginBottom:12}},
      'Clear all'):null,
    // Results
    detectInterval
      ?e('div',null,
        e('div',{style:{fontSize:'0.72rem',color:HINT,fontFamily:UI_FONT,marginBottom:8}},'Interval:'),
        e('div',{style:{padding:'8px 14px',borderRadius:8,border:'1px solid '+GOLD,background:ACT_GOLD,display:'inline-block'}},
          e('div',{style:{fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,color:GOLD}},detectInterval.name),
          e('div',{style:{fontSize:'0.68rem',color:HINT,fontFamily:UI_FONT}},detectInterval.notes+'  ·  '+detectInterval.semi+' semitones')
        )
      )
      :detectedChords.length>0
      ?e('div',null,
        e('div',{style:{fontSize:'0.72rem',color:HINT,fontFamily:UI_FONT,marginBottom:8}},
          detectedChords[0].exact
            ?'Exact match:'
            :(completionChord
              ?'Tap the highlighted notes to complete the voicing:'
              :'Possible matches — tap to see missing notes:')),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:8}},
          detectedChords.map((ch,i)=>{
            const extIdx=DETECT_TO_EXT[ch.sym];
            const clickable=ch.exact&&extIdx!==undefined;
            const isCompTarget=!ch.exact&&completionChord&&completionChord.name===ch.name;
            const bassInt=bassPc!=null?((bassPc-ch.root+12)%12):null;
            const invPos=(bassInt!=null&&ch.iv)?ch.iv.indexOf(bassInt):-1;
            const invLbl=invPos>=0?(INV_ORD[invPos]||null):null;
            const cardBorder=ch.exact&&i===0?GOLD:isCompTarget?'#74C0FC':BTN_BRD;
            const cardBg=ch.exact&&i===0?ACT_GOLD:isCompTarget?ACT_BLUE:BG2;
            return e('div',{key:i,
              onClick:clickable
                ?()=>{setDetectMode(false);setCustomRoot(ch.root);setCustomTypeIdx(extIdx);setInvIdx(0);window.scrollTo(0,0);}
                :!ch.exact
                  ?()=>setCompletionChord(cc=>cc&&cc.name===ch.name?null:ch)
                  :null,
              title:clickable?'Open '+ch.name+' on the Chords page':(!ch.exact?'Show missing notes on fretboard':null),
              style:{
                padding:'8px 14px',borderRadius:8,
                border:'1px solid '+cardBorder,
                background:cardBg,
                cursor:clickable||!ch.exact?'pointer':'default'}},
              e('div',{style:{display:'flex',alignItems:'baseline',gap:6}},
                e('span',{style:{fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,
                  color:ch.exact&&i===0?GOLD:isCompTarget?'#74C0FC':'var(--txt)'}},ch.name),
                clickable?e('span',{style:{fontSize:'0.62rem',color:GOLD,fontFamily:UI_FONT}},'open ↗'):null,
                (!ch.exact&&!isCompTarget)?e('span',{style:{fontSize:'0.62rem',color:'#74C0FC',fontFamily:UI_FONT}},'show missing ↓'):null,
                isCompTarget?e('span',{style:{fontSize:'0.62rem',color:'#74C0FC',fontFamily:UI_FONT}},'showing ✓'):null
              ),
              e('div',{style:{fontSize:'0.68rem',color:HINT,fontFamily:UI_FONT}},
                ch.quality+(invLbl?'  ·  '+invLbl:'')+(ch.exact?'':'  ·  '+ch.matched+'/'+ch.total+' notes'))
            );
          })
        )
      )
      :detectPcs.length>=2?e('div',{style:{fontSize:'0.8rem',color:HINT,textAlign:'center',padding:'12px 0'}},'No chord found — try adding or removing a note')
      :e('div',{style:{fontSize:'0.8rem',color:HINT,textAlign:'center',padding:'12px 0'}},'Select 2 or more notes to identify the chord')
  );

  return e('div',null,
    modeToggleRow,
    // Root + type selectors
    e('div',{style:{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12,alignItems:'flex-start'}},
      e('div',null,
        e('div',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',marginBottom:6,fontWeight:600}},'Root'),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
          KEYS.map((k,i)=>
            e('button',{key:i,onClick:()=>{setCustomRoot(k.root);setInvIdx(0);previewSelection(k.root,customTypeIdx,extOpt);},style:{
              padding:'4px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
              border:'1px solid '+(customRoot===k.root?GOLD:BTN_BRD),
              background:customRoot===k.root?ACT_GOLD:BG2,
              color:customRoot===k.root?GOLD:BTN_OFF,fontWeight:customRoot===k.root?700:400,
              minHeight:44}},k.name)
          )
        )
      ),
      e('div',null,
        e('div',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',marginBottom:6,fontWeight:600}},'Chord type'),
        e('div',{'data-tour':'chord-type-tabs',style:{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}},
          EXT_TYPES.map((t,i)=>{
            const locked=isEss&&i>=4;
            return e('button',{key:i,onClick:locked?()=>onUpgrade(t.sym+' chords'):()=>{setCustomTypeIdx(i);setInvIdx(0);previewSelection(customRoot,i,null);},style:{
              padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
              border:'1px solid '+(customTypeIdx===i?'#C084FC':BTN_BRD),
              background:customTypeIdx===i?ACT_PUR:BG2,
              color:customTypeIdx===i?'#C084FC':BTN_OFF,fontWeight:customTypeIdx===i?700:400,
              minHeight:44,opacity:locked?0.55:1}},t.sym,(locked?e('span',{style:{fontSize:'0.6rem',marginLeft:2}},'🔒'):null));
          })
        ),
        e('div',{style:{fontSize:'0.62rem',color:HINT,fontFamily:UI_FONT,lineHeight:1.4}},baseType.ctx)
      )
    ),
    // Scale overlay selector — Pro only, when scale hints exist for this chord type
    !isEss&&customScaleOpts.length>0?e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:8,alignItems:'center'}},
      e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Scale'),
      customScaleOpts.map(sc=>
        e('button',{key:sc.name,
          onClick:()=>setScaleHintCustom(scaleHintCustom===sc.name?null:sc.name),
          style:{padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
            border:'1px solid '+(scaleHintCustom===sc.name?GOLD:BTN_BRD),
            background:scaleHintCustom===sc.name?ACT_GOLD:BG2,
            color:scaleHintCustom===sc.name?GOLD:BTN_OFF,minHeight:36}},sc.name)
      )
    ):null,
    // Extension row — Full mode only
    availExts.length>0&&!isEss?e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,alignItems:'center'}},
      e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'Extension'),
      availExts.map(ex=>
        e('button',{key:ex.id,onClick:()=>{const ne=extOpt===ex.id?null:ex.id;setExtOpt(ne);previewSelection(customRoot,customTypeIdx,ne);},style:{
          padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
          border:'1px solid '+(extOpt===ex.id?'#F4A261':BTN_BRD),
          background:extOpt===ex.id?ACT_GOLD:BG2,
          color:extOpt===ex.id?'#F4A261':BTN_OFF,fontWeight:extOpt===ex.id?700:400,minHeight:44}},
          ex.sym)
      )
    ):null,
    // Chord info bar
    e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:7,
      padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:GOLD,fontStyle:'italic'}},chordName),
      e('span',{style:{fontSize:'0.79rem',color:LBL}},baseType.label+(extDef?' + '+extDef.dn:'')+(extDef?' (5th → '+extDef.dn+')':'')),
      e('div',{style:{display:'flex',gap:12,flexWrap:'wrap',marginLeft:'auto'}},
        tones.map((t,i)=>
          e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5,fontSize:'0.76rem',color:TC[i]}},
            e('span',{style:{width:8,height:8,borderRadius:'50%',background:TC[i],display:'inline-block',flexShrink:0}}),
            degNames[i]+'='+nn(t,customRoot)
          )
        )
      ),
      onFindInKey&&customTypeIdx<4?e('button',{'data-tour':'custom-inkey',
        onClick:()=>onFindInKey(customRoot,customTypeIdx),
        title:'Open this chord in a key — keeps your voicing (string set & inversion). The key map covers the seven 7th chords, so any extension shows as its base 7th.',
        style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,
          fontSize:'0.7rem',border:'1px solid '+BTN_BRD,background:'transparent',
          color:BTN_OFF,minHeight:0,flexShrink:0,whiteSpace:'nowrap'}
      },'In a key ↗'):null
    ),
    // Voicing tabs
    e('div',{style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
      TABS.map(({id,lbl,locked})=>e('button',{key:id,onClick:locked?()=>onUpgrade(lbl+' voicings'):()=>setVType(id),style:{...tabStyle(locked?'':id),opacity:locked?0.65:1}},lbl,(locked?e('span',{style:{fontSize:'0.65rem',marginLeft:3}},'🔒'):null)))
    ),
    // Controls bar
    e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
      borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
      display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
      DROP_TYPES.has(vType)?[
        e('span',{key:'lbl',style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'String set'),
        setsData.map((ss,i)=>{const ok=playableSets[i]!==false;return e('button',{key:i,disabled:!ok,
          onClick:ok?()=>{setSsIdx(i);setInvIdx(0);}:undefined,
          title:ok?undefined:'No playable shape for this chord on these strings',
          style:{...mkSsBtn(safeSSIdx===i),opacity:ok?1:0.4,cursor:ok?'pointer':'not-allowed'}},ss.lbl);})
      ]:null,
      vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'3-note voicing: root, 3rd & 7th — the 5th is omitted (it\'s implied by the context)'):null,
      vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions on neck'):null
    ),
    // Neck (with dot-mode toggle inside) — hidden when no shape exists, so the
    // notice below isn't sitting under an empty fretboard that looks broken.
    noDropShape?null:e('div',{style:{border:'1px solid '+BORDER,borderRadius:6,overflow:'hidden',marginBottom:10}},
      e(ScrollNeck,{arpPos,highlight,scalePos:customScalePos,degNames,dotMode,dotKeyIdx:customRoot}),
      setDotMode?e('div',{style:{borderTop:'1px solid '+BORDER,padding:'4px 10px',background:BG2}},
        e(DotModeToggle,{dotMode,setDotMode})
      ):null
    ),
    // Chord diagrams
    DROP_TYPES.has(vType)?
      e(DiagSection,{title:DROP_LBL[vType]+' inversions'},
        allVoicings.every(v=>!v)?e(NoShapes,null):
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:i===0?'Root pos.':degNames[inv.bassIdx]+' bass',
            bassLabel:i===0?'bass: '+degNames[inv.bassIdx]:null,
            selected:invIdx===i,onClick:()=>setInvIdx(i),dotMode,dotKeyIdx:customRoot})
        )
      ):null,
    vType==='shell'?e('div',null,
      e(DiagSection,{title:'Form A — skip-string'},
        shellsA.map(x=>
          e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:customRoot})
        )
      ),
      e(DiagSection,{title:'Form B — adjacent strings'},
        shellsB.map(x=>
          e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:customRoot})
        )
      )
    ):null
  );
}

// ── VoiceLeadingDiagram ────────────────────────────────────────────────
// Shows how guide tones move through a ii-V-I in C (shell voicings):
// F path (3rd of ii → 7th of V stays, then drops ½ step to 3rd of I)
// C/B path (7th of ii drops ½ step to 3rd of V, then stays as 7th of I)
function VoiceLeadingDiagram(){
  const W=340, H=195;
  const cols=[65,170,275];
  const rows=[88,145];
  const R=19;
  const AMB=TC[3]; // gold  — 7th
  const TEA=TC[1]; // teal  — 3rd
  const data=[
    {name:'Dm7',  role:'ii', r0:{n:'F',c:TEA,l:'3rd'}, r1:{n:'C',c:AMB,l:'7th'}},
    {name:'G7',   role:'V',  r0:{n:'F',c:AMB,l:'7th'}, r1:{n:'B',c:TEA,l:'3rd'}},
    {name:'Cmaj7',role:'I',  r0:{n:'E',c:TEA,l:'3rd'}, r1:{n:'B',c:AMB,l:'7th'}},
  ];
  function dot(x,y,n,c,l){
    return e('g',{key:'d'+x+y},
      e('circle',{cx:x,cy:y,r:R,fill:c+'22',stroke:c,strokeWidth:1.8}),
      e('text',{x,y,textAnchor:'middle',dominantBaseline:'middle',fill:c,fontSize:12,fontWeight:'bold',fontFamily:UI_FONT},n),
      e('text',{x,y:y+R+8,textAnchor:'middle',fill:c+'bb',fontSize:9,fontFamily:UI_FONT},l)
    );
  }
  function conn(x1,y,x2,half){
    const mx=(x1+x2)/2;
    return e('g',{key:'cn'+x1+x2+y},
      e('line',{x1:x1+R,y1:y,x2:x2-R,y2:y,
        stroke:half?AMB+'cc':'rgba(255,255,255,0.18)',
        strokeWidth:half?2:1.5,
        strokeDasharray:half?undefined:'5,3'}),
      e('text',{x:mx,y:y-9,textAnchor:'middle',
        fill:half?AMB:'rgba(255,255,255,0.3)',fontSize:9,
        fontWeight:half?700:400,fontFamily:UI_FONT},
        half?'½ step':'same note')
    );
  }
  return e('div',{style:{margin:'14px 0 4px'}},
    e('div',{style:{fontSize:'0.8rem',fontWeight:700,marginBottom:8,color:'var(--txt)'}},
      'Guide tone movement — ii–V–I in C'),
    e('div',{style:{overflowX:'auto',WebkitOverflowScrolling:'touch'}},
      e('svg',{viewBox:`0 0 ${W} ${H}`,
        style:{display:'block',width:'100%',minWidth:280,height:'auto',overflow:'visible'}},
        ...data.map((d,i)=>[
          e('text',{key:'cn'+i,x:cols[i],y:22,textAnchor:'middle',
            fill:'var(--txt)',fontSize:13,fontWeight:'bold',fontFamily:SERIF},d.name),
          e('text',{key:'rn'+i,x:cols[i],y:37,textAnchor:'middle',
            fill:HINT,fontSize:10,fontFamily:UI_FONT},d.role),
        ]).flat(),
        e('line',{x1:24,y1:50,x2:W-24,y2:50,stroke:'rgba(255,255,255,0.12)',strokeWidth:1}),
        conn(cols[0],rows[0],cols[1],false),
        conn(cols[1],rows[0],cols[2],true),
        conn(cols[0],rows[1],cols[1],true),
        conn(cols[1],rows[1],cols[2],false),
        ...data.map((d,i)=>[
          dot(cols[i],rows[0],d.r0.n,d.r0.c,d.r0.l),
          dot(cols[i],rows[1],d.r1.n,d.r1.c,d.r1.l),
        ]).flat()
      )
    ),
    e('div',{style:{fontSize:'0.76rem',color:HINT,marginTop:10,lineHeight:1.55,fontFamily:UI_FONT}},[
      e('b',{key:'k1'},'The pattern: '),
      'every transition has one common tone (same note, new role) and one half-step movement down. Roots jump by 4ths — the hand moves. Guide tones barely move — the harmony flows.'
    ])
  );
}

// ── GuideView — the Path + glossary ──────────────────────────────────
function GuideView({openPreset,level,streak,lastPracticeDay,bestStreak,onUpgrade,onPracticed}){
  const daysSince=lastPracticeDay?Math.round((Date.now()-new Date(lastPracticeDay+'T00:00:00'))/86400000):0;
  const [expanded,setExpanded]=useState({});
  function tog(id){setExpanded(s=>({...s,[id]:!s[id]?true:undefined}));}
  const [popTerm,setPopTerm]=useState(null);
  const STAGE_IDS=['qualities','shells','iivi','ear','drop2a','drop2b','modes','play','turnaround','blues','minor','tritone_sub','secdom','keys','approach','standard'];
  // Path progress, persisted
  const [done,setDone]=useState(()=>{try{return JSON.parse(safeLS('jg-path','{}'));}catch(ex){return{};}});
  useEffect(()=>{safeLSSet('jg-path',JSON.stringify(done));},[done]);
  // Granular per-stage checklist progress, persisted separately
  const [doneItems,setDoneItems]=useState(()=>{try{return JSON.parse(safeLS('jg-path-items','{}'));}catch(ex){return{};}});
  useEffect(()=>{safeLSSet('jg-path-items',JSON.stringify(doneItems));},[doneItems]);
  function toggleItem(stId,i){setDoneItems(s=>{const k=stId+':'+i;const wasUnchecked=!s[k];if(wasUnchecked)onPracticed?.();return {...s,[k]:wasUnchecked?true:undefined};});}
  const [justDone,setJustDone]=useState(null);
  const prevStreakRef=useRef(streak);
  const [streakBump,setStreakBump]=useState(false);
  useEffect(()=>{
    if(streak>prevStreakRef.current){
      setStreakBump(true);
      const t=setTimeout(()=>setStreakBump(false),2500);
      return()=>clearTimeout(t);
    }
    prevStreakRef.current=streak;
  },[streak]);
  const firstIncomplete=()=>{try{const d=JSON.parse(safeLS('jg-path','{}'));return STAGE_IDS.find(id=>!d[id]);}catch(ex){return null;}};
  const [stagesOpen,setStagesOpen]=useState(()=>{
    const first=firstIncomplete();
    return first?{[first]:true}:{}; // all done → start fully collapsed
  });
  function toggleStage(id){setStagesOpen(s=>({...s,[id]:!s[id]}));}
  function jumpTo(id){
    setStagesOpen(s=>({...s,[id]:true}));
    setTimeout(()=>{const el=document.getElementById('guide-stage-'+id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},70);
  }
  useEffect(()=>{
    const first=firstIncomplete();
    const anyDone=Object.values(done).some(Boolean);
    const t=setTimeout(()=>{
      if(first&&anyDone){const el=document.getElementById('guide-stage-'+first);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
      else window.scrollTo(0,0);
    },80);
    return()=>clearTimeout(t);
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  function togDone(id){
    setDone(s=>{
      const isNowDone=!s[id];
      if(isNowDone){setJustDone(id);setTimeout(()=>setJustDone(d=>d===id?null:d),1200);track('guide.stage.completed',{stage_id:id});}
      return {...s,[id]:isNowDone?true:undefined};
    });
  }
  useEffect(()=>{
    const first=firstIncomplete();
    const anyDone=Object.values(done).some(Boolean)||Object.values(doneItems).some(Boolean);
    const t=setTimeout(()=>{
      if(first&&anyDone){const el=document.getElementById('guide-stage-'+first);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});}
      else window.scrollTo(0,0);
    },80);
    return()=>clearTimeout(t);
  },[]);// eslint-disable-line react-hooks/exhaustive-deps
  const S={marginBottom:14,padding:'14px 16px',background:BG2,border:'1px solid '+BORDER,borderRadius:8};
  const H={fontFamily:SERIF,fontSize:'1.15rem',fontWeight:700,color:'var(--scale-name)',marginBottom:8};
  const P={fontSize:'0.80rem',lineHeight:1.75,color:'var(--txt)',fontFamily:UI_FONT,marginBottom:8};
  const LI={fontSize:'0.80rem',lineHeight:1.7,color:'var(--txt)',fontFamily:UI_FONT,paddingLeft:16};
  const HL={color:'var(--scale-name)',fontWeight:700};
  const TC4={color:'#4ECDC4'};const TRD={color:'#FF6B6B'};
  const TBL={color:'#74C0FC'};const TYL={color:'#FFD43B'};
  function sec(title,...ch){return e('div',{style:S},e('div',{style:H},title),...ch);}
  function p(...k){return e('p',{style:P},...k);}
  function ul(...items){return e('ul',{style:{listStyle:'none',margin:'0 0 8px'}},
    ...items.map((it,i)=>e('li',{key:i,style:LI},'• ',...[].concat(it))));}
  // Checkable practice list. "Done when:" strings render as a highlighted
  // mastery criterion (no checkbox); everything else is a tappable micro-task.
  function isCriterion(it){return typeof it==='string'&&/^Done when:/i.test(it);}
  function checklist(stId,items){
    return e('ul',{style:{listStyle:'none',margin:'0 0 8px',padding:0}},
      ...items.map((it,i)=>{
        if(isCriterion(it)) return e('li',{key:i,style:{display:'flex',gap:7,alignItems:'flex-start',
          padding:'7px 10px',marginTop:4,background:ACT_GOLD,border:'1px solid '+GOLD+'55',borderRadius:6}},
          e('span',{style:{color:GOLD,flexShrink:0,fontSize:'0.78rem'}},'◆'),
          e('span',{style:{fontSize:'0.78rem',lineHeight:1.6,color:'var(--txt)',fontFamily:UI_FONT}},
            e('b',{style:{color:GOLD}},'You\'ve got it when: '),it.replace(/^Done when:\s*/i,'')));
        const checked=!!doneItems[stId+':'+i];
        return e('li',{key:i,onClick:()=>toggleItem(stId,i),
          style:{display:'flex',gap:9,alignItems:'flex-start',padding:'7px 2px',cursor:'pointer',minHeight:36}},
          e('span',{style:{flexShrink:0,width:18,height:18,marginTop:1,borderRadius:4,
            border:'1.5px solid '+(checked?GOLD:BTN_BRD),background:checked?ACT_GOLD:'transparent',
            color:GOLD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'0.72rem',fontWeight:700}},checked?'✓':''),
          e('span',{style:{fontSize:'0.80rem',lineHeight:1.6,fontFamily:UI_FONT,
            color:checked?HINT:'var(--txt)'}},...[].concat(it)));
      }));
  }
  function callout(...k){
    return e('div',{style:{background:'var(--act-blue)',border:'1px solid var(--brd)',borderRadius:6,
      padding:'8px 12px',marginBottom:8,fontSize:'0.79rem',lineHeight:1.7,color:'var(--txt)',fontFamily:UI_FONT}},...k);
  }
  function term(id,text){
    return e('span',{key:id,
      onClick:ev=>{ev.stopPropagation();setPopTerm(t=>t===id?null:id);},
      style:{borderBottom:'1px dotted '+GOLD,cursor:'pointer',color:'inherit'}},text);
  }
  function gloss(id,term,short,playQuality,...detail){
    const open=expanded['g_'+id];
    return e('div',{key:id,style:{borderBottom:'1px solid '+BORDER,paddingBottom:8,marginBottom:8,cursor:'pointer'},
      onClick:()=>tog('g_'+id)},
      e('div',{style:{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}},
        e('span',{style:{color:GOLD,fontSize:'0.85rem',flexShrink:0,fontFamily:UI_FONT}},open?'▾':'▸'),
        e('span',{style:{fontFamily:UI_FONT,fontSize:'0.84rem',fontWeight:700,color:'var(--txt)'}},term),
        playQuality?e('button',{onClick:ev=>{ev.stopPropagation();playGuideChord(playQuality);},style:{
          display:'inline-flex',alignItems:'center',gap:3,padding:'2px 8px',borderRadius:10,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.68rem',border:'1px solid '+BTN_BRD,background:BG2,
          color:HINT,minHeight:0,flexShrink:0}},'▶ hear'):null,
        !open&&e('span',{style:{fontSize:'0.79rem',color:HINT,fontFamily:UI_FONT}},' — '+short)
      ),
      open&&e('div',{style:{marginTop:6,paddingLeft:16}},
        ...detail.map((d,i)=>e('p',{key:i,style:{...P,marginBottom:4}},d))
      )
    );
  }
  // The Path: ordered stages with phase grouping
  const stages=[
    // ── PHASE 1: FOUNDATION ──────────────────────────────────────────────
    {id:'qualities',phase:'Foundation',phaseLabel:'Phase 1 — Foundation',
     phaseNote:'These four stages run together over roughly two months — practice shells daily while you learn the ii–V–I, and start ear training in parallel from Stage 4 onward. They reinforce each other; don\'t wait to "finish" one before starting the next.',
     title:'The four chord qualities — hear the difference',
     time:'1–2 weeks',
     preset:{view:'diatonic',key:0,deg:0,vType:'shell'},
     body:['The most important contrast to hear first: ',term('maj7','Major 7'),' (lush, settled — the "home" chord) versus ',term('dom7','Dominant 7'),' (tense, pulling — wants to resolve). Once you can tell those two apart by ear, add ',term('m7','Minor 7'),' (smooth, floating — darker than major but not tense) and ',term('halfdim','Half-diminished'),' (unstable, searching — the most urgent). These four qualities are the building blocks of all jazz harmony.',
           'The colored dots label each note in the app: red = root, teal = 3rd, blue = 5th, gold = 7th. The 3rd and 7th are the notes that define each quality — learn to hear them first.'],
     items:['Open in Keys (C major) and tap Imaj7 — then tap V7. Which one "leans"? Which one feels settled?','Set the Dots toggle to "Interval" to see the chord tones labeled (R, 3, 5, 7) — these colors appear everywhere in the app','Don\'t memorize names yet — just build the habit of identifying settled vs. tense by sound','Done when: you can hear the difference between a major 7 (settled) and a dominant 7 (tense) without reading the chord name']},
    {id:'shells',phase:'Foundation',
     title:'Shell voicings — your first jazz grips',
     time:'2–4 months to feel natural',
     preset:{view:'diatonic',key:0,deg:0,vType:'shell'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:56,vType:'shell'},
     body:[[term('shell','A shell voicing'),' uses just 3 notes: root, 3rd, and 7th. The 5th is left out — it adds bulk without adding harmonic information. The result is lighter, lower, and much easier to move around the neck. These are your working vocabulary; every subsequent voicing type builds on knowing shells cold.'],
           ['The 3rd and 7th are called ',term('guide','"guide tones"'),' — the 3rd sets major vs. minor quality, the 7th sets dom7 vs. maj7. Together they carry all the harmonic meaning. Form A and Form B are the same 3 notes on different string sets. Professionals ',term('comp','comp'),' with shells on fast tempos because they\'re clean and mobile.'],
           ['When you open the Play tab for the first time: ',e('b',null,'start by landing each chord on beat 1 only'),'. Once that feels steady, add beat 3. The classic jazz comping placement — beats 2 and 4, or the "Charleston" (beat 1 + the "and" of beat 2) — comes later. A simple chord landed confidently in time sounds better than a complex rhythm that rushes or drags. Rhythm is the delivery mechanism; get that right first.'],
           [e('b',null,'Listen while you practice: '),'Three records that will teach you more than any app can. ',e('b',null,'Wes Montgomery — The Incredible Jazz Guitar'),' (1960): the standard for jazz guitar swing feel and melodic clarity. ',e('b',null,'Kenny Burrell — Midnight Blue'),' (1963): blues-rooted, direct, shows how shells and simple rhythm create authority. ',e('b',null,'Joe Pass — Virtuoso'),' (1973): solo guitar, every harmonic trick laid bare. Don\'t try to transcribe yet — just absorb the sound of what you\'re building toward.']],
     items:['Form A (6th-string root): in the Chords tab, set root to C and cycle the quality to find all 4 shells — Cmaj7, Cm7, C7, Cm7♭5','Form B (5th-string root): same 4 qualities, this time reading the shapes with the root on string 5',['Back in Keys, play all 7 ',term('diat','diatonic'),' shells in C major top to bottom without stopping — Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5'],['Comp (play chords in rhythm behind the beat) the ii–V–I in C at 60 BPM with the Play tab — shells only, focus on landing on time'],'Add G and F major — same shapes, shifted on the neck','Done when: you can find any of the 4 qualities in Form A and Form B without hunting for the shape']},
    {id:'iivi',phase:'Foundation',
     title:'The ii–V–I — jazz\'s engine',
     time:'3–6 weeks alongside shells',
     preset:{view:'iivi',key:0,form:'major',bpm:60},
     body:['Three chords that appear in virtually every jazz standard: a ',term('m7','minor 7'),' chord (ii), a ',term('dom7','dominant 7'),' chord (V), and a ',term('maj7','major 7'),' chord (I). In C: Dm7 → G7 → Cmaj7. The ',term('roman','Roman numerals'),' indicate position in the key — the same pattern works in every key. Learn it once, use it everywhere.',
           ['Why does it work? The V7 chord contains a ',term('tritone','tritone'),' between its 3rd and 7th (B and F in G7). Both notes want to resolve by half-step: B moves up to C, F moves down to E — exactly the root and 3rd of Cmaj7. The resolution is built into the physics of the interval.'],
           ['The ',term('guide','guide tones'),' swap roles on each chord: the 7th of G7 (F) resolves to the 3rd of Cmaj7 (E), and the 3rd of G7 (B) approaches the root. This guide tone chain is the engine of jazz ',term('vl','voice leading'),'.']],
     items:['Slow the Play tab to 55 BPM and comp shells through the ii–V–I — listen for how the V "leans" into the I',['Change the key to F: Gm7→C7→Fmaj7 — same relationship, different starting point'],'Done when: you can play a ii–V–I from memory in C, F, and G without looking']},
    {id:'ear',phase:'Foundation',
     title:'Train your ear — start now, not later',
     time:'10–15 min/session, runs alongside every stage from here',
     preset:{view:'quiz'},
     body:['Ear training is not a later phase — it runs in parallel from the beginning. You\'ve learned shell voicings and the ii–V–I pattern. The next step is ',e('b',null,'hearing'),' them: being able to identify chord quality (major 7 vs. dominant 7 vs. minor 7) and the ii–V cadence by ear, without seeing the chord name. Without this connection, you\'re building vocabulary in silence.',
           ['The Train tab has two modes: ',e('b',null,'Interval recognition'),' (identify the distance between two notes) and ',e('b',null,'Cadence recognition'),' (identify chord progressions). The most immediately useful free exercise is M3 vs m3 — the major vs. minor 3rd is the exact interval that makes a major chord sound major and a minor chord sound minor. From there, the major 7th interval is the "color" of a maj7 chord; the minor 7th is the color of both dom7 and m7. Cadence recognition (ii–V and V–I) is Pro, but you\'ve been playing those patterns in the Play tab — recognizing them by ear is the natural next step.'],
           'Song mnemonics are provided for every interval. Major 3rd: "When the Saints Go Marching In." Minor 3rd: "Smoke on the Water" riff. Perfect 5th: "Twinkle Twinkle." Tritone: "The Simpsons" theme. Octave: "Somewhere Over the Rainbow." Major 7th (Pro): "Take On Me" chorus. Use what sticks. 10–15 minutes per session will accelerate everything else faster than extra shape drilling.'],
     items:['Train tab → Intervals → tap the "+ 3rds & 6ths" difficulty, then drill M3 (major 3rd — the "bright" quality) vs m3 (minor 3rd — "darker"): this is the free interval that most directly maps to chord quality','Close your eyes and play a maj7 shell, then a m7 shell — which one floats? Which one settles?','[Pro] Train tab → 7th Chords: practice maj7 vs dom7 vs m7 — direct recognition of the chord qualities you\'ve been playing','[Pro] Train tab → Cadences → ii–V: you\'ve played this hundreds of times; now identify it cold from sound alone','10–15 min of ear training per practice session, from here through the end of the path','Done when: you can tell a maj7 from a dom7 by ear, and identify a ii–V cadence without looking at the chord name']},
    // ── PHASE 2: VOICINGS ────────────────────────────────────────────────
    {id:'drop2a',phase:'Voicings',phaseLabel:'Phase 2 — Voicings & Texture',fullPreset:true,
     phaseNote:'The voicing family, simplest to richest: Shells (root-3-7) → Drop 2 (add the 5th back for a full 4-note grip) → Rootless (drop the root, add the 9th — for playing over a bassist) → Drop 3 (a wider spread). Each one builds on the shapes before it. Drop 2, Drop 3, and Rootless voicings are Pro features — unlock them in the app to work through Stages 5 and 6. Free users: use this time to deepen shell fluency in more keys (Stage 13 covers this).',
     title:'Drop 2 — learning the shapes',
     time:'3–5 weeks for the shapes',
     preset:{view:'diatonic',key:0,deg:0,vType:'drop2',ssIdx:2},
     body:[[term('drop2','Drop 2'),' takes a "closed" chord (all 4 notes within one octave) and drops the second-highest note down an octave. This spreads the chord across 4 adjacent strings in a span the hand can reach. Drop 2 is the standard jazz guitar comping voicing. ',e('b',null,'Pro feature — requires unlocking Drop 2 in the app.')],
           ['Start with one string set: strings 1–4. Learn Drop 2 for all four chord qualities in C. Every chord has four ',term('inv','inversions'),' — same 4 notes, different note on the bottom. Get the shapes in your fingers before thinking about connecting them.']],
     items:['[Pro] On strings 1–4: find Drop 2 root position for Cmaj7, Dm7, G7, and Bm7♭5','[Pro] Learn all 4 inversions of Cmaj7 on strings 1–4 — play them low to high and back','[Pro] Do the same for Dm7 and G7 — now you have 12 shapes for a ii–V–I','[Pro] Play each shape cleanly at 50 BPM — accuracy first, speed follows','Done when: all 4 qualities, all 4 inversions on strings 1–4, no hesitation on any shape']},
    {id:'drop2b',phase:'Voicings',fullPreset:true,
     title:'Drop 2 — connecting the chords',
     time:'6–10 weeks to connect smoothly',
     preset:{view:'diatonic',key:0,deg:0,vType:'drop2'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:60,vType:'drop2'},
     body:[['Now put the shapes to work. ',term('vl','Voice leading'),' means finding the inversion of each next chord where each string moves the smallest distance. Instead of jumping shapes, you find the nearest neighbor. The Play tab auto-selects the best inversions — watch it, then replicate by hand. ',e('b',null,'Pro feature — requires unlocking Drop 2.')],
           e(VoiceLeadingDiagram,null),
           ['Key insight: run the ii–V–I forward and watch the guide tones. The 7th of Dm7 (C) resolves down a half-step to the 3rd of G7 (B); the 3rd of Dm7 (F) holds as the 7th of G7. Then the 7th of G7 (F) resolves down to the 3rd of Cmaj7 (E). ',e('b',null,'Every transition: one note holds still, one moves a half-step.'),' This is why smooth voice leading sounds inevitable rather than mechanical. The 5-4-3-2 string set gives you another register for the same shapes.']],
     items:['[Pro] Voice-lead a ii–V–I in C: find the V7 inversion closest to your ii inversion, then the I closest to that V','[Pro] Try the same on the 5-4-3-2 string set — same concept, higher or lower register','[Pro] Loop the Play tab (Drop 2, 60 BPM) and watch which inversions it chooses — replicate them','[Pro] Add F major and G major — same logic, shifted on the neck','Done when: smooth ii–V–I with Drop 2 in C, F, G — no pauses between chords']},
    {id:'modes',phase:'Voicings',
     title:'Scales over chords — Dorian, Mixolydian, Ionian',
     time:'2–3 months to build melodic fluency',
     preset:{view:'diatonic',key:0,deg:1,vType:'arpeggio'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:60},
     body:['Every chord implies a scale — the notes that belong over it. Three ',term('modes','modes'),' cover the ii–V–I: ',e('b',null,'Dorian'),' (iim7 — minor with a natural 6th), ',e('b',null,'Mixolydian'),' (V7 — major with a ♭7), ',e('b',null,'Ionian'),' (Imaj7 — the major scale). These aren\'t separate scales to memorize — they\'re the same major scale heard from different starting points. D Dorian and C major use identical notes; the difference is which note feels like home. (The deeper question — how to use modal color expressively, not just which scale "goes" over a chord — comes with time and ear.)',
           'For the V7, Mixolydian is the neutral, safe choice — the major scale of the key you\'re resolving to, with a ♭7. The Scale panel in the Keys tab shows which mode applies to each chord. (Tenser, "altered" dominant scales come later, with the minor ii–V–i.)',
           'The goal right now is not speed or licks — it\'s knowing which scale belongs over which chord in the ii–V–I. Play the scale tones as quarter notes over the Play tab, slow and deliberate.'],
     items:['In Keys, set deg to V7 (G7) — the Scale panel below the neck names it Mixolydian and highlights its notes','Play those notes in order over the Play tab at 55 BPM — this is the foundation of improvisation','Set deg to iim7 (Dm7) — the Scale panel shows Dorian; notice the raised 6th (B♮) vs. natural minor (B♭)','Set deg to Imaj7 — the Scale panel shows Ionian; recognize these as the major scale you already know','Done when: you can name and play the right scale over each chord of a ii–V–I without checking the Scale panel']},
    {id:'play',phase:'Voicings',
     title:'Play along — rhythm and groove',
     time:'Ongoing — start early, never fully done',
     preset:{view:'iivi',key:0,bpm:72},
     body:['A correct voicing played out of time sounds worse than a simpler voicing played confidently in the groove. Rhythm is the delivery mechanism — without it, the harmony doesn\'t land. The Play tab loops chord progressions with walking bass and ride cymbal. Your job: place each chord at the right moment, confidently, every time.',
           'The Charleston rhythm (beat 1 + the "and" of 2) is the core jazz comping pattern. Start slow. 60 BPM is not embarrassingly slow — it\'s where control develops. Four consecutive choruses without stopping is the real milestone.'],
     items:['Strum on beats 1 and 3 first — the strongest beats, lowest risk','Then try the Charleston: beat 1 and the "and" of 2','4 choruses without stopping = move up 5 BPM','Done when: you can play 4 choruses without stopping, listening to the bass line instead of hunting for shapes']},
    // ── PHASE 3: FORMS ───────────────────────────────────────────────────
    {id:'turnaround',phase:'Forms',phaseLabel:'Phase 3 — Forms',fullPreset:true,
     title:'The turnaround — I–vi–ii–V',
     time:'2–4 weeks',
     preset:{view:'diatonic',key:0,deg:5,vType:'shell'},
     playPreset:{view:'iivi',key:0,form:'turn',bpm:60},
     body:['The turnaround is the last two bars of nearly every standard — the little loop that resets the form and sends you back to the top. The most common one is ',e('b',null,'I–vi–ii–V'),' (in C: Cmaj7 – Am7 – Dm7 – G7). It\'s your ii–V–I with two chords stacked in front, and once you hear it you\'ll hear it everywhere — the end of "Rhythm Changes" (the chord form of "I Got Rhythm," a jazz staple), the turnaround of a blues, the tag of a ballad.',
           ['The jazzier version swaps the vi chord for a dominant 7 built on that same root: I–VI7–ii–V (Cmaj7 – A7 – Dm7 – G7). The A7 pulls harder into Dm7 than Am7 does — dominant chords lean toward their resolution more strongly than minor chords do. You can also start on iii: iii–vi–ii–V (Em7 – Am7 – Dm7 – G7), a smooth descending cascade. All three are the same idea — a short, repeating engine that loops back home.'],
           '[Pro] Open Play → Turnaround form to loop the I–VI7–ii–V shape at tempo. The dominant VI (A7) is built in — notice how it pulls harder into Dm7 than Am7 would.'],
     items:['In Keys, find shells for Cmaj7, Am7, Dm7, G7 — then play them in a loop, top back to top','[Pro] Play tab → select the Turnaround form and loop at 60 BPM — hear the VI7 (A7) pulling into Dm7','Try transposing to G and F — same shape, different starting point','Listen for turnarounds in tunes you know — they\'re almost always the last two bars before the form repeats','Done when: you can loop a I–vi–ii–V from memory and hear how it resets the form']},
    {id:'blues',phase:'Forms',fullPreset:true,
     title:'The jazz blues form',
     time:'4–6 weeks',
     preset:{view:'iivi',key:5,form:'blues',bpm:66},
     body:['The 12-bar blues (a chord pattern that repeats every 12 bars) is one of the most-played forms in all of music. Jazz transformed it with richer chords and a ii–V–I in bars 9–10. The result — jazz blues — sounds unmistakably jazz while keeping the familiar 12-bar architecture.',
           'Jazz blues in F: bars 1–4 on F7 (I), bars 5–6 on B♭7 (IV), bar 7 back to F7, bar 8 adds D7 (a secondary dominant — V7/ii), bars 9–10 are a ii–V (Gm7–C7), bar 11 returns to F7, bar 12 is a V7 turnaround. F is the traditional jazz-blues key — "Now\'s the Time," "Billie\'s Bounce," "Blues for Alice" are all in F.'],
     items:['[Pro] Loop the Jazz Blues form with shells only — one chord per bar, focus on landing in time','Identify the ii–V–I in bars 9–11 — it\'s the same progression you already know','Listen to Billie\'s Bounce or Now\'s the Time: can you follow the 12-bar form and hear the ii–V coming?',['[Pro] Next, try ',term('drop2','Drop 2'),' on bars 1 and 5 first, then gradually through the rest of the form'],'Done when: you can play all 12 bars of a jazz blues in F from memory at a steady tempo, shells all the way through']},
    {id:'minor',phase:'Forms',fullPreset:true,
     title:'The minor ii–V–i',
     time:'3–4 weeks',
     preset:{view:'iivi',key:0,form:'minor',bpm:60},
     body:['The minor ii–V–i uses the same structural logic as the major version with different harmonic color: iim7♭5 (half-diminished) – V7 – im7. The half-diminished chord has a flattened 5th, adding instability beyond a regular minor 7 — it has more pull than a plain m7.',
           'The V7 in a minor key often becomes an altered dominant — a V7 with tense added notes like ♭9 or ♯9 that sharpen its pull. The "altered scale" supplies all of these colors at once (♭9, ♯9, ♯11, ♭13); it\'s an advanced sound you can explore later. "Autumn Leaves" alternates major and minor ii–V–is back to back — the most-studied standard for learning this distinction.',
           'Loop major then minor ii–V–i back to back in the same key and listen to the contrast. The half-diminished chord has a specific "searching" quality that ear training makes immediately recognizable.'],
     items:['[Pro] Loop major then minor ii–V–i in the same key — hear the contrast in the iiø vs. iim7','Listen for how the ♭5 of the iiø pulls downward into the V7 root','[Pro] Train tab → Cadences: try to distinguish major vs. minor ii–V by sound alone — the half-diminished is the tell','Done when: you can play a minor ii–V–i from memory and hear the difference from the major version without looking at the chord names']},
    {id:'tritone_sub',phase:'Forms',fullPreset:true,
     title:'Tritone substitution — same destination, different road',
     time:'3–5 weeks',
     preset:{view:'iivi',key:0,form:'tritone',bpm:60},
     body:[['The ',term('tritone_sub','tritone substitution'),' replaces the V7 chord with another dominant 7 a ',term('tritone','tritone'),' (6 semitones) away. In C: G7 can be replaced by D♭7. Both chords share the same tritone — B/C♭ and F — so both resolve identically to Cmaj7. The difference is the bass: G7 drops a 5th (G→C), D♭7 slides a half-step (D♭→C). That chromatic bass descent is the signature sound.'],
           ['The ',term('guide','guide tones'),' do the same job either way; only the bass and outer color change. Tap the Tritone Sub form to hear both approaches back to back.']],
     items:['[Pro] Bars 1–4: standard V7 (bass drops a 5th G→C). Bars 5–8: tritone sub (bass slides D♭→C) — hear the difference','[Pro] On the D♭7 bar, try a Drop 2 D♭7 — root on string 5, fret 9 (same shape as G7 but 6 frets higher)',['Wherever you see a V7 resolving to I in a standard, try the tritone sub — "Autumn Leaves," "All The Things You Are," and most bebop heads use them'],'Done when: you can play both the standard ii–V–I and the tritone-subbed version in C, and hear the bass-motion difference without the screen']},
    {id:'secdom',phase:'Forms',fullPreset:true,
     title:'Secondary dominants — borrowing V7 for any chord',
     time:'4–6 weeks',
     preset:{view:'iivi',key:0,form:'secdom',bpm:60},
     body:[['A ',term('sec_dom','secondary dominant'),' is any dominant 7 chord temporarily acting as V7 to a chord other than I. In C, A7 isn\'t ',term('diat','diatonic'),' — but it pulls to Dm7 (ii) because A7 is V7/ii (the dominant a fifth above D). You can build a secondary dominant to any chord in the key.'],
           ['Secondary dominants are often tritone-substituted: E♭7 moving to Dm7 is just A7 (V7/ii) with a tritone sub — same function, chromatically recolored. The Sec. Dom. form in Play chains them into a cascade of chromatic bass resolutions.']],
     items:['[Pro] In C: A7 → Dm7 is V7/ii — hear the pull in the Sec. Dom. form','Look for them in standards: the D7 in bar 8 of an F jazz blues (V7/ii in F), or E7 → Am7 (V7/vi) in a I–VI7–ii–V turnaround',['Secondary dominants are often tritone-subbed: E♭7→Dm7 is A7 (V7/ii) ',term('tritone_sub','tritone-subbed'),' — same function, different color'],'Done when: you can hear a secondary dominant in a progression and name which chord it\'s pulling toward']},
    // ── PHASE 4: APPLICATION ─────────────────────────────────────────────
    {id:'keys',phase:'Application',phaseLabel:'Phase 4 — Application',
     title:'Take it around the keys',
     time:'3+ months to cover all 12',
     preset:{view:'diatonic',key:7,deg:0,vType:'shell'},
     playPreset:{view:'iivi',key:7,form:'major',bpm:66},
     body:['Every concept so far works identically in all 12 keys — the interval relationships never change, only the pitch names do. Jazz musicians practice moving around the cycle of fourths — each key a fourth above the last (C → F → B♭ → E♭ → A♭ → D♭ → G♭ → B → E → A → D → G). Most standards change key (modulate) several times, so knowing the patterns in every key is essential, not optional.',
           'One new key per week = all 12 in three months. Don\'t move on from a key until the ii–V–I feels easy, not just possible. Priority order: G, F, B♭, E♭ (most common jazz keys), then the remaining flats, then sharps.'],
     items:['Shells in G major: use the Keys tab to find all 7 shells, then play the ii–V–I in Play at 60 BPM','Add F and B♭ — these come up constantly in standards and jazz blues','Work through the flat keys (E♭, A♭, D♭) — they appear more often than sharps in jazz','Done when: ii–V–I with shells in all 12 keys from memory, no chart needed']},
    {id:'approach',phase:'Application',
     title:'Chromatic approaches — bebop\'s half-step glue',
     time:'6–12 months to feel natural',
     preset:{view:'diatonic',key:0,deg:4,vType:'arpeggio'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:60,vType:'shell'},
     body:['A ',term('approach_note','chromatic approach note'),' is played a half-step above or below a chord tone on the last beat before the chord changes. You land on the target when the new chord arrives. This lean-and-land motion is the signature of bebop (the fast, virtuosic 1940s jazz style of Charlie Parker and Dizzy Gillespie) — phrases feel like they\'re pulled toward their destination.',
           ['The best targets are ',term('guide','"guide tones"'),' — 3rd and 7th — because they move most dramatically between chords. Approach from below (natural, pulls up), from above (tenser, falls down), or double chromatic: one above then one below, landing on beat 1. Even one approach note per chord change starts to sound like bebop.']],
     items:['Pick the 3rd of each chord as your target — on beat 4 of the previous bar, play a half-step below, land on beat 1','Use Arpeggio view in Keys to locate all chord tones — those are your landing points','Double chromatic into the 3rd of G7 (B): play B♭ then C♯ on beats 3–4, land on B on beat 1 — a bebop staple','Done when: you can add a chromatic approach note into each chord change of a ii–V–I consistently, landing on a guide tone on beat 1']},
    {id:'standard',phase:'Application',
     title:'Play a jazz standard',
     time:'An arrival, not a finish line',
     preset:{view:'iivi',key:0,form:'major',bpm:65},
     body:['This is what the whole path built toward. Pick one standard and play it all the way through — changes, form, in time. Suggested starting points: ',e('b',null,'Autumn Leaves'),' (major and minor ii–V–Is back to back, most-studied), ',e('b',null,'Blue Bossa'),' (16-bar bossa nova feel, key modulation — in the Play tab), ',e('b',null,'Stella by Starlight'),' (three ii–V–I chains through different keys — in the Play tab), or ',e('b',null,'Fly Me to the Moon'),' (clear changes in one key, beautiful melody).',
           e('div',{style:{marginTop:12,marginBottom:4,fontWeight:700,fontSize:'0.9rem'}},'▸ Autumn Leaves — first 8 bars (G minor, shell voicings)'),
           e('div',{style:{fontSize:'0.8rem',color:'var(--hint)',marginBottom:8}},'Two ii–V–Is back to back — everything you\'ve practiced is in these 8 bars.'),
           e('div',{style:{overflowX:'auto'}},
             e('table',{style:{borderCollapse:'collapse',width:'100%',fontSize:'0.78rem',fontFamily:'var(--ui-font)'}},
               e('thead',null,
                 e('tr',null,
                   e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Bar'),
                   e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Chord'),
                   e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Shell (Form)'),
                   e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Role'))),
               e('tbody',null,
                 ...[
                   ['1','Cm7','Root on A-string fret 3 (Form B)','ii of Bb — major ii–V starts'],
                   ['2','F7','Root on E-string fret 1 (Form A)','V of Bb'],
                   ['3','Bbmaj7','Root on A-string fret 1 (Form B)','I — resolution ✓'],
                   ['4','Ebmaj7','Root on A-string fret 6 (Form B)','IV of Bb'],
                   ['5','Am7♭5','Root on A-string open (Form B)','ii of Gm — minor ii–V starts'],
                   ['6','D7','Root on A-string fret 5 (Form B)','V of Gm'],
                   ['7–8','Gm7','Root on E-string fret 3 (Form A)','i — resolution ✓'],
                 ].map(([bar,chord,shape,role],i)=>
                   e('tr',{key:i,style:{background:i%2===0?'var(--bg2)':'transparent'}},
                     e('td',{style:{padding:'5px 8px',color:'var(--hint)'}},'Bar '+bar),
                     e('td',{style:{padding:'5px 8px',fontWeight:700,letterSpacing:'0.3px'}},chord),
                     e('td',{style:{padding:'5px 8px',color:'var(--txt)'}},shape),
                     e('td',{style:{padding:'5px 8px',color:'var(--hint)',fontSize:'0.74rem'}},role)))))),
           e('div',{style:{marginTop:10,fontSize:'0.8rem',color:'var(--hint)',lineHeight:1.5}},'You\'ve played these ii–V–Is dozens of times in the Play tab — Autumn Leaves is just two of them chained together in a 32-bar form. The moment they connect to a real melody is the moment everything clicks.'),
           e('div',{style:{marginTop:14,marginBottom:4,fontWeight:700,fontSize:'0.9rem'}},'▸ Blue Bossa — watch the key change (bar 9)'),
           e('div',{style:{fontSize:'0.8rem',color:'var(--hint)',marginBottom:8}},'Set key to C in the Play tab. Bars 1–8 are C minor. At bar 9 the harmony shifts to D♭ major for 4 bars — you\'re playing a ii–V–I in a completely different key center. Bar 13 returns to the C minor ii–V–i. That modulation is the whole lesson: recognizing when the key changes and landing the new chords cleanly.'),
           e('div',{style:{overflowX:'auto',marginBottom:10}},
             e('table',{style:{borderCollapse:'collapse',width:'100%',fontSize:'0.78rem',fontFamily:'var(--ui-font)'}},
               e('thead',null,e('tr',null,
                 e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Bars'),
                 e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Key center'),
                 e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'Changes'),
                 e('th',{style:{padding:'4px 8px',textAlign:'left',borderBottom:'1px solid var(--border)',color:'var(--hint)',fontWeight:600}},'What to do'))),
               e('tbody',null,...[
                 ['1–8','C minor','im7 – ivm7 – iiø7–V7 – im7','Stay in C minor; land the minor ii–V–i solidly'],
                 ['9–12','D♭ major','♭IIIm7 – ♭VI7 – ♭IImaj7','New key center — hear the brightness shift'],
                 ['13–16','C minor','iiø7 – V7 – im7','Return home; the minor ii–V–i closes the form'],
               ].map(([bars,key,changes,tip],i)=>
                 e('tr',{key:i,style:{background:i%2===0?'var(--bg2)':'transparent'}},
                   e('td',{style:{padding:'5px 8px',color:'var(--hint)'}},bars),
                   e('td',{style:{padding:'5px 8px',fontWeight:700}},key),
                   e('td',{style:{padding:'5px 8px',color:'var(--txt)'}},changes),
                   e('td',{style:{padding:'5px 8px',color:'var(--hint)',fontSize:'0.74rem'}},tip)))))),
           e('div',{style:{marginTop:14,marginBottom:4,fontWeight:700,fontSize:'0.9rem'}},'▸ Stella by Starlight — three key centers'),
           e('div',{style:{fontSize:'0.8rem',color:'var(--hint)',marginBottom:8}},'Set key to B♭. The opening Em7♭5–A7 is a ii–V of D that doesn\'t resolve to D — it dissolves into Cm7–F7 instead, which is the harmonic ambiguity that defines the tune. After that, three ii–V–I chains shift the key center: vm7–I7 to E♭maj7 (key of E♭), then Am7♭5–D7 to Gmaj7 (key of G), then iim7–V7 to B♭maj7 home. Every ii–V you\'ve practiced is in here — Stella just moves through all of them back to back.'),
           e('div',{style:{marginTop:14,padding:'10px 12px',background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:8,fontSize:'0.82rem',lineHeight:1.5}},[
             e('b',null,'Use iReal Pro for backing tracks. '),'It\'s a separate app ($21.99, the jazz musician\'s standard tool) with 3,000+ chord charts and playable backing tracks. Jazz Guitar Lab teaches the harmony — iReal Pro is where you apply it to real tunes. Get it, search "Autumn Leaves," set the tempo to 80 BPM, and ',term('comp','comp'),' through the changes (play the chords in time through the progression) with what you\'ve learned here. These two apps are designed to work together.',
             e('div',{style:{marginTop:6,fontSize:'0.76rem',color:'var(--hint)'}},'Search "iReal Pro" on the App Store, or find charts at ',e('span',{style:{textDecoration:'underline',color:'var(--txt)'}},'irealpro.com'),' and ',e('span',{style:{textDecoration:'underline',color:'var(--txt)'}},'jazzstandards.com'),'.')
           ]),
           'What comes after: Drop 3 and Rootless voicings add harmonic depth (Pro). Chord melody (playing the tune inside the chords), reharmonization (re-coloring the chords under a melody), and playing with other humans are the next frontiers. Finding a musician to play with is the single most accelerating thing you can do from here.'],
     items:['Open iReal Pro (or jazzstandards.com) and find Autumn Leaves — look at the changes and map every chord to a shell voicing you know','Play bars 1–4 only at 60 BPM until the two-bar major ii–V–I resolves cleanly to Bbmaj7','Play bars 5–8 at 60 BPM — the minor ii–V–I to Gm. Notice how Am7♭5 has a different pull than Am7','Play all 8 bars without stopping — you\'ve already practiced every chord in this sequence','[Pro] Open BLUE BOSSA in the Play tab (key C, 70 BPM) — play bars 1–8, then let bar 9 arrive and notice the key shift to D♭','[Pro] Open STELLA in the Play tab (key B♭, 65 BPM) — name each key center as the ii–V–I chains arrive: E♭, G, B♭','[Pro] Upgrade to Drop 2 for any standard once the shells are solid','Play your chosen standard in one other key']},
  ];
  const doneCount=stages.filter(s=>done[s.id]).length;
  const allDone=stages.length>0&&doneCount===stages.length;
  const nextIdx=stages.findIndex(s=>!done[s.id]);
  const nextStage=nextIdx>=0?stages[nextIdx]:null;
  const PHASE_ORDER=['Foundation','Voicings','Forms','Application'];
  const phaseNum=nextStage?PHASE_ORDER.indexOf(nextStage.phase)+1:4;
  function stage(n,st,nextSt,dataTour){
    const isDone=!!done[st.id];
    const isOpen=!!stagesOpen[st.id];
    const theoryOpen=!!expanded['st_'+st.id];
    // Granular task progress (criteria don't count toward the tally)
    let taskTotal=0,taskDone=0;
    (st.items||[]).forEach((it,i)=>{if(!isCriterion(it)){taskTotal++;if(doneItems[st.id+':'+i])taskDone++;}});
    const allTasks=taskTotal>0&&taskDone===taskTotal;
    return e('div',{key:st.id,id:'guide-stage-'+st.id,...(dataTour?{'data-tour':dataTour}:{}),style:{
      marginBottom:8,background:BG,borderRadius:8,overflow:'hidden',
      border:'1px solid '+(isDone?GOLD+'60':BORDER),
      borderLeft:'3px solid '+(isDone?GOLD:isOpen?GOLD+'60':BORDER)}},
      e('div',{style:{display:'flex',gap:12,padding:'12px 14px',cursor:'pointer',alignItems:'center'},
        onClick:()=>toggleStage(st.id)},
        e('div',{style:{flexShrink:0,width:26,height:26,borderRadius:'50%',
          border:'2px solid '+GOLD,color:isDone?GOLD:LBL,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:'0.8rem',fontWeight:700,fontFamily:UI_FONT,background:isDone?ACT_GOLD:'transparent',
          animation:justDone===st.id?'doneFlash 0.5s ease-out':'none'}},isDone?'✓':String(n)),
        e('div',{style:{flex:1}},
          e('div',{style:{fontFamily:SERIF,fontSize:'0.97rem',fontWeight:700,color:'var(--scale-name)'}},st.title),
          e('div',{style:{fontSize:'0.71rem',color:HINT,fontFamily:UI_FONT,marginTop:2}},st.time)
        ),
        // Per-stage step tally — visible even when collapsed
        !isDone&&taskTotal>0?e('span',{style:{fontSize:'0.68rem',fontFamily:UI_FONT,fontWeight:700,flexShrink:0,
          color:allTasks?GOLD:taskDone>0?'var(--txt)':HINT}},taskDone+'/'+taskTotal):null,
        e('span',{style:{color:GOLD,fontSize:'0.85rem',flexShrink:0}},isOpen?'▾':'▸')
      ),
      isOpen?e('div',{style:{padding:'0 14px 14px',borderTop:'1px solid '+BORDER}},
        st.body.length>0?e('p',{style:{...P,marginBottom:8,marginTop:10}},...[].concat(st.body[0])):null,
        e('div',{style:{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}},
          (()=>{
            const gated=st.fullPreset&&level==='essentials';
            // Derive feature name so UpgradeSheet highlights the right perk
            const FORM_FEAT={turn:'Turnaround form',blues:'Jazz Blues',minor:'minor ii–V–i',tritone:'Tritone Sub',secdom:'Sec. Dom.'};
            const stageFeature=st.preset?.vType==='drop2'?'Drop 2 voicings':
              st.preset?.vType==='drop3'?'Drop 3 voicings':
              FORM_FEAT[st.playPreset?.form]||FORM_FEAT[st.preset?.form]||'Play forms';
            const presetLbl='▶ Open in '+({diatonic:'Keys',iivi:'Play',custom:'Chords',quiz:'Ear Training'}[st.preset.view]||'app');
            return e('button',{onClick:gated?()=>onUpgrade?.(stageFeature):()=>openPreset(st.preset),style:{
              padding:'5px 16px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.78rem',
              border:'1px solid '+GOLD,background:ACT_GOLD,color:GOLD,fontWeight:700,minHeight:44,
              opacity:gated?0.7:1}},
              presetLbl,(gated?e('span',{style:{fontSize:'0.65rem',marginLeft:4}},'🔒'):null));
          })(),
          st.playPreset?(()=>{
            const gated=(st.fullPreset||st.playPresetFull)&&level==='essentials';
            const FORM_FEAT={turn:'Turnaround form',blues:'Jazz Blues',minor:'minor ii–V–i',tritone:'Tritone Sub',secdom:'Sec. Dom.'};
            const playFeature=FORM_FEAT[st.playPreset?.form]||'Play forms';
            return e('button',{onClick:gated?()=>onUpgrade?.(playFeature):()=>openPreset(st.playPreset),style:{
              padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.78rem',
              border:'1px solid #74C0FC',background:'#0a1520',color:'#74C0FC',fontWeight:700,minHeight:44,
              opacity:gated?0.7:1}},
              '⌾ Try in Play →',(gated?e('span',{style:{fontSize:'0.65rem',marginLeft:4}},'🔒'):null));
          })():null
        ),
        st.items&&st.items.length?checklist(st.id,st.items):null,
        st.body.length>1?e('div',{style:{marginTop:6}},
          e('button',{onClick:ev=>{ev.stopPropagation();tog('st_'+st.id);},style:{
            background:'transparent',border:'none',cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.74rem',color:HINT,padding:'4px 0',display:'flex',alignItems:'center',gap:5,minHeight:0}},
            e('span',{style:{color:GOLD,fontSize:'0.8rem'}},theoryOpen?'▾':'▸'),' Why it works'),
          theoryOpen?e('div',{style:{marginTop:4,paddingLeft:10,borderLeft:'2px solid '+BORDER}},
            ...st.body.slice(1).map((t,i)=>t&&typeof t==='object'&&t.$$typeof
              ?e('div',{key:'bt'+i,style:{marginBottom:5}},t)
              :e('p',{key:'bt'+i,style:{...P,marginBottom:5}},...[].concat(t)))
          ):null
        ):null,
        // Stage 16 upgrade CTA — shown only for essentials users on the last stage
        st.id==='standard'&&isEss?e('div',{style:{
          marginTop:14,padding:'14px 16px',borderRadius:8,
          border:'1px solid '+GOLD+'80',background:ACT_GOLD}},
          e('div',{style:{fontFamily:SERIF,fontSize:'1rem',fontWeight:700,color:GOLD,marginBottom:5}},
            '🎵 Ready to play real jazz standards?'),
          e('div',{style:{fontSize:'0.78rem',lineHeight:1.65,color:'var(--txt)',fontFamily:UI_FONT,marginBottom:10}},
            'You\'ve completed the full learning path. Pro unlocks Blue Bossa, Autumn Leaves, All The Things You Are, Stella by Starlight, and There Will Never Be Another You — plus Drop 2/3/Rootless voicings and all ear training modes. One price, forever.'),
          e('button',{onClick:()=>onUpgrade('Jazz Standards'),style:{
            width:'100%',padding:'11px 14px',borderRadius:6,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.85rem',fontWeight:700,
            border:'1px solid '+GOLD,background:GOLD,color:'#07070f',minHeight:44}},
            'Unlock Pro — $9.99 once, forever')
        ):null,
        // "I've got this" — quieter, after the checklist (it's the last thing you do)
        e('button',{onClick:()=>{
          togDone(st.id);
          if(!isDone){
            if(nextSt){setStagesOpen(s=>({...s,[st.id]:false,[nextSt.id]:true}));
              setTimeout(()=>{const el=document.getElementById('guide-stage-'+nextSt.id);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},70);}
            else setStagesOpen(s=>({...s,[st.id]:false}));
          }
        },style:{
          width:'100%',marginTop:12,padding:'9px 14px',borderRadius:6,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.78rem',fontWeight:700,
          border:'1px solid '+(isDone?GOLD:BTN_BRD),background:isDone?ACT_GOLD:'transparent',
          color:isDone?GOLD:BTN_OFF,minHeight:44,
          animation:justDone===st.id?'doneFlash 0.5s ease-out':'none'}},
          isDone?'✓ Marked complete — tap to undo':'I\'ve got this'+(nextSt?' — next stage':''))
      ):null
    );
  }
  return e('div',null,
    streakBump?e('div',{style:{
      position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',
      background:'#222',color:GOLD,fontFamily:UI_FONT,fontWeight:700,fontSize:'0.88rem',
      padding:'10px 20px',borderRadius:24,boxShadow:'0 4px 16px #0008',
      zIndex:9999,pointerEvents:'none',whiteSpace:'nowrap',
      animation:'milestoneUp 0.35s ease-out'
    }},'🔥 '+(streak)+'-day streak!'):null,
    // ── Resume / Today card — a single clear next action on every visit ──
    allDone
      ?e('div',{style:{marginBottom:14,padding:'14px 16px',background:ACT_GOLD,border:'1px solid '+GOLD,borderRadius:8}},
        e('div',{style:{fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,color:GOLD,marginBottom:6}},'🎉 You\'ve worked the whole Path'),
        p('You\'ve covered the core of jazz harmony — the four qualities, shells, Drop 2, the ii–V–I and its variations, the common forms, and a standard. That\'s a real foundation. The road from here is open-ended:'),
        ul('Drop 3 and Rootless voicings add harmonic depth (Pro)','Chord melody (the tune inside the chords) and reharmonization (re-coloring the chords)','Learn more standards — every tune you know is a new entry point','Play with other people — the single most accelerating thing you can do'),
        streak>0?e('div',{style:{fontSize:'0.74rem',color:GOLD,fontWeight:700,fontFamily:UI_FONT,marginTop:4}},'🔥 '+streak+'-day streak — keep it going'):null,
        isEss?e('button',{onClick:()=>onUpgrade('Jazz Standards'),style:{
          marginTop:10,width:'100%',padding:'11px 14px',borderRadius:6,cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'0.85rem',fontWeight:700,
          border:'1px solid '+GOLD,background:GOLD,color:'#07070f',minHeight:44}},
          'Unlock Pro — $9.99 once, forever'):null)
      :nextStage?e('div',{style:{marginBottom:14,padding:'12px 14px',background:BG2,border:'1px solid '+GOLD+'66',borderRadius:8,
        display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}},
        e('div',{style:{flex:1,minWidth:170}},
          daysSince>1?e('div',{style:{fontSize:'0.72rem',color:HINT,fontFamily:UI_FONT,marginBottom:2}},
            '👋 Welcome back after '+daysSince+' day'+(daysSince===1?'':'s')
            +(bestStreak>1?' — your best streak: '+bestStreak+' day'+(bestStreak===1?'':'s'):'')):null,
          streak>0?e('div',{style:{fontSize:'0.73rem',color:GOLD,fontWeight:700,fontFamily:UI_FONT,marginBottom:2}},'🔥 '+streak+'-day streak'):null,
          e('div',{style:{fontSize:'0.69rem',color:HINT,fontFamily:UI_FONT,textTransform:'uppercase',letterSpacing:'0.06em'}},
            doneCount===0?'Start here':'Pick up where you left off'),
          e('div',{style:{fontFamily:SERIF,fontSize:'0.96rem',fontWeight:700,color:'var(--scale-name)',marginTop:2}},
            'Stage '+(nextIdx+1)+' — '+nextStage.title)),
        e('button',{onClick:()=>jumpTo(nextStage.id),style:{
          padding:'9px 18px',borderRadius:6,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.8rem',fontWeight:700,
          border:'1px solid '+GOLD,background:ACT_GOLD,color:GOLD,minHeight:44,flexShrink:0}},
          doneCount===0?'Start →':'Jump back in →'))
      :null,
    sec('Start Here',
      p('The only thing this guide assumes is that you can play guitar chords — open chords, barre chords, however you\'ve learned them. If you know that some chords sound bright and happy while others sound dark or tense, you already have the ear for this. No other music theory background is required.'),
      p('What you\'ll learn here: jazz uses ',e('b',{style:HL},'four-note chords'),' where most styles use three-note chords. The extra note is what gives jazz its characteristic richness. You\'ll learn to recognize these chord types by ear, play them in multiple positions, and connect them smoothly — the skills that make jazz harmony feel natural rather than academic.'),
      p('Every term that might be unfamiliar — ',term('inv','inversion'),', ',term('modes','mode'),', ',term('guide','guide tone'),', ',term('vl','voice leading'),' — is defined in plain English in the Glossary at the bottom of this page. You do not need to know them before you start. Meet them as they come up.'),
      callout(e('b',null,'Reading chord symbols: '),'Jazz writes the four chord types in shorthand — ',e('b',null,'△7'),' (or maj7) = major 7, where the triangle just means "major"; ',e('b',null,'m7'),' = minor 7; ',e('b',null,'7'),' = dominant 7; and ',e('b',null,'ø7'),' (or m7♭5) = half-diminished. No need to memorize these now — each is defined in the Glossary below.'),
      callout(e('b',null,'Coming from rock? '),'Jazz uses the same I–IV–V relationships you already know — just with four-note chords instead of three, and more intentional movement between them. The dominant 7 (V7) you already bend notes over is the engine of everything here. Drop 2 voicings (Stage 2) will feel awkward at first and then start to click — your fretting hand already has the strength and independence, so the shapes tend to come faster than the theory.'),
      callout(e('b',null,'How long will this take? '),'The estimate under each stage assumes roughly 15–20 minutes of practice on most days. Practice twice a week and the timelines roughly double; bring a serious musical background and they shrink. Treat them as loose guides, not deadlines — how long anything takes varies enormously from person to person, and falling outside a range says nothing about whether you\'ll get there. One thing is well established, though: short and frequent beats long and occasional. Fifteen minutes a day will take you further than a two-hour session every couple of weeks — which is exactly what the 🔥 streak is built to encourage.'),
      callout(e('b',null,'How to use this page: '),'Tap a stage to expand it. Check off each practice step as you nail it — the gold "◆ You\'ve got it when…" line is your mastery target for that stage. When it feels solid, tap "I\'ve got this" to mark it done and jump to the next. The buttons open the app already set up, so you can start playing immediately. The goal is playing your guitar, not racing a checklist.')
    ),
    e('div',{style:S},
      e('div',{style:{...H,display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}},
        e('span',null,'The Learning Path — from first chords to jazz'),
        e('span',{'data-tour':'guide-progress',style:{fontSize:'0.72rem',fontFamily:UI_FONT,fontWeight:allDone?700:400,color:allDone?GOLD:HINT}},
          allDone?'Complete ✓':'Phase '+phaseNum+' of 4 · '+doneCount+'/'+stages.length)
      ),
      p('Work top to bottom. Tap a stage to see what to practice and open the right tool. Stages vary in depth — some take a few sessions, some take months, and the time under each one is a rough guide, not a target to hit. The Path covers everything — some steps use Pro features, which you can unlock anytime.'),
      stages.flatMap((st,i)=>{
        const out=[];
        if(st.phaseLabel) out.push(e('div',{key:'ph_'+st.id,style:{padding:'12px 2px 4px'}},
          e('div',{style:{fontSize:'0.71rem',fontWeight:700,fontFamily:UI_FONT,color:GOLD,
            letterSpacing:'0.09em',textTransform:'uppercase',opacity:0.85}},st.phaseLabel),
          st.phaseNote?e('div',{style:{fontSize:'0.74rem',lineHeight:1.6,color:HINT,fontFamily:UI_FONT,marginTop:4}},st.phaseNote):null));
        out.push(stage(i+1,st,stages[i+1],i===0?'guide-stage-0':undefined));
        return out;
      })
    ),
    e('div',{'data-tour':'guide-glossary',style:S},
      e('div',{style:H},'Glossary — click any term'),
      gloss('7th','7th chord','A chord built from 4 notes instead of 3 — adds a 7th interval.',null,
        'A triad has 3 notes: root–3rd–5th. A 7th chord adds one more third on top: the 7th. This extra note creates the richer, more complex sound characteristic of jazz. The 7th can be major (a half-step below the octave, giving maj7), minor/flat (a whole-step below, giving dominant 7 or minor 7), or diminished.',
        'In practice: a plain "G" triad is G–B–D. "Gmaj7" adds F#. "G7" adds F♮ (flat 7). "Gm7" adds both ♭3 and ♭7: G–B♭–D–F.'
      ),
      gloss('maj7','Major 7 (maj7)','The stable, lush chord — the 7th is a half-step below the octave.','maj7',
        'Spelled root–3–5–7: Cmaj7 = C–E–G–B. The major 7th (B in C major) creates a warm, slightly floating sound — it sits one half-step below the octave C, like a gentle lean toward resolution that never quite arrives. This is the I chord in a major key and the IV chord.',
        'Maj7 is the defining color of jazz ballads, bossa nova, and sophisticated pop. It is the "home" chord — stable enough to feel resolved, colorful enough to linger on. In the app it appears as the I and IV chord in the Keys tab.'
      ),
      gloss('dom7','Dominant 7 (7)','The tension chord — creates strong pull toward resolution.','dom7',
        'Spelled root–3–5–♭7: G7 = G–B–D–F. The ♭7 (F) and the 3rd (B) are 6 half-steps apart — a tritone, the maximally tense interval in Western music. Both notes want to resolve by half-step (B up to C, F down to E), pulling strongly toward the Imaj7 a fifth below.',
        'In jazz the V7 is this chord, and it is the engine of the ii–V–I. Adding altered tensions (♭9, ♯9, ♭13) increases the instability and the pull. The resolution V7 → I is the fundamental motion of all tonal harmony.'
      ),
      gloss('m7','Minor 7 (m7)','A smooth, mid-tension chord — neither fully resolved nor urgently tense.','m7',
        'Spelled root–♭3–5–♭7: Dm7 = D–F–A–C. The flat 3rd gives it a minor quality; the flat 7th (shared with dominant 7) prevents it from feeling fully settled. It is floating — not tense enough to demand resolution, not stable enough to feel like home.',
        'In jazz the iim7 chord is the starting point of the ii–V–I. Dorian mode (natural minor with a raised 6th) is the standard improvisation scale over iim7. The raised 6th is what separates Dorian from natural minor and gives it a warmer sound.'
      ),
      gloss('halfdim','Half-diminished (m7♭5, ø7)','A tense chord with a flattened 5th — rarer in rock, common in jazz.','m7b5',
        'Spelled root–♭3–♭5–♭7: Bm7♭5 in C major = B–D–F–A. The flattened 5th adds instability beyond a regular minor 7. This chord naturally occurs on the vii degree of a major scale and on the ii degree of a minor scale (where it\'s labeled iiø or iim7♭5).',
        'In the app, switch to Minor mode in the ii–V–i view to hear this chord as the iiø chord. It resolves through the V7 (usually with a ♭9) to the im7.'
      ),
      gloss('inv','Inversion','Which note of the chord is at the lowest pitch.',null,
        'All four inversions of Cmaj7 contain the same four notes: C, E, G, B. The difference is which note sits at the bottom. Root position: C in bass. 1st inversion: E in bass. 2nd inversion: G in bass. 3rd inversion: B in bass.',
        'Why it matters: different inversions place the chord at different positions on the neck, creating different bass motion and voice leading possibilities. The 3rd inversion (7th in bass) creates the most forward momentum into the next chord. Mixing inversions is how you voice-lead a progression smoothly.'
      ),
      gloss('drop2','Drop 2','A specific way to arrange 4 chord notes across 4 adjacent guitar strings.',null,
        'Start with a "closed" position chord — all four notes stacked as tightly as possible within one octave. Take the second-highest note and move it down one octave. This spreads the chord across the strings in a natural, playable span.',
        'Example: Cmaj7 closed = E–G–B–C (low to high, all within one octave). Drop 2: take the B (2nd from top) and drop it an octave → B–E–G–C. This maps neatly to strings 4-3-2-1. Drop 2 is the most common jazz guitar voicing because the physical span fits the human hand and the chord sounds full without being muddy.'
      ),
      gloss('vl','Voice leading','Moving each note of a chord to the nearest note in the next chord.',null,
        'Instead of jumping shapes around the neck, find the inversion of the next chord where each individual note moves the smallest possible distance — ideally a half-step or whole-step. Each "voice" (string) leads smoothly to its counterpart.',
        'In practice: if you play Dm7 3rd inversion then G7 2nd inversion, each string only moves 1–2 frets. Compare that to jumping from open Dm7 to a 3rd-fret barre G7 — same chords, much bigger movement. Voice-led changes sound connected and intentional rather than choppy.',
        'The ii–V–I view\'s play-along auto-selects the best V and I inversions based on whichever ii inversion you pick.'
      ),
      gloss('guide','Guide tones','The 3rd and 7th of a chord — the notes that define its quality and move most dramatically.',null,
        'The root and 5th of a chord are "neutral" — they identify the chord but don\'t tell you much about its quality. The 3rd tells you major vs. minor. The 7th tells you major 7 vs. dominant 7 vs. minor 7. These two notes are called guide tones.',
        'In a G7 → Cmaj7 resolution: the 3rd of G7 (B) resolves up a half-step to C (the root of Cmaj7), and the 7th of G7 (F) resolves down a half-step to E (the 3rd of Cmaj7). These two half-step movements are the engine of jazz harmony. Practice hearing them in the play-along bass line.'
      ),
      gloss('approach_note','Chromatic approach note','A half-step leading note into a chord tone — bebop\'s signature melodic device.',null,
        'Play a note one half-step above or below a chord tone on the beat just before the chord arrives, then land squarely on the chord tone when the new bar begins. The half-step creates momentary tension that resolves immediately — this "lean and land" motion is what gives bebop melody its sense of inevitability.',
        'Target guide tones (3rd or 7th) for maximum effect. Approach from below (most natural — pulls upward like a leading tone), from above (creates falling tension), or double chromatic (one step above then one below, two beats of approach). Even one approach note per chord change starts to sound like bebop.'
      ),
      gloss('tritone','Tritone','6 semitones — the most tense interval, equidistant between root and octave.',null,
        'The tritone divides the octave exactly in half. In C, the tritone is F♯/G♭. In the dominant 7 chord G7, the tritone exists between B (3rd) and F (♭7) — both notes want to resolve by half-step in opposite directions (B up to C, F down to E). This internal tension is the engine of tonal harmony.',
        'The name comes from "three whole tones": C → D → E → F♯ spans three whole steps. Medieval music called it "diabolus in musica" (the devil in music) and avoided it. Jazz exploits it constantly: the tritone substitution works because two chords that share a tritone are interchangeable as dominants.'
      ),
      gloss('tritone_sub','Tritone substitution','Replacing V7 with ♭II7 — a dominant chord a tritone away with the same tritone inside.',null,
        'G7 and D♭7 both contain the notes B and F (or C♭) — the same tritone. Both resolve to Cmaj7 identically in terms of harmonic function. But where G7 resolves with a falling fifth in the bass (G→C), D♭7 resolves with a smooth half-step (D♭→C). That chromatic bass slide is the trademark of the tritone sub.',
        'Find it everywhere in standards: any ♭II7 moving to I, or any chord that slides down a half-step into a target chord. The substitution also works on secondary dominants — a V7/ii can be tritone-subbed, creating a ♭VI7 → iim7 motion. Because D♭7 is a tritone from G7, and both resolve to C, players can freely swap them without the ear complaining.'
      ),
      gloss('sec_dom','Secondary dominant','A V7 chord pointing to a chord other than I — creates a temporary key shift.',null,
        'Any diatonic chord can be temporarily treated as a local I, and the chord a fifth above it becomes its secondary dominant (V7/x). In C major: A7 is not in the key, but it pulls to Dm7 (ii) just as G7 pulls to Cmaj7. Writing it V7/ii names the relationship. Common secondary dominants in C: V7/ii (A7), V7/iii (B7), V7/IV (C7), V7/V (D7), V7/vi (E7) — each built a fifth above its target chord.',
        'The secondary dominant creates a brief detour into the tonal orbit of the target chord — the ear hears a tritone resolving, then snaps back to the main key center. Jazz blues makes heavy use of them: the VI7 in bar 8 (D7 in F) acts as V7/ii before the ii–V turnaround. In standards, they appear as chromatic chords that briefly intensify motion toward the next chord in the progression.'
      ),
      gloss('diat','Diatonic','Using only the 7 notes of the key — playing "inside."',null,
        'The C major scale has 7 notes: C D E F G A B. Any note, chord, or phrase using only these 7 notes is "diatonic to C major." The 7 diatonic chords of C major are: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5.',
        '"Chromatic" or "outside" means using notes not in the key. Jazz soloists move in and out deliberately — inside for stability, outside for tension. The Chords in Key view shows all 7 diatonic chords; the Scale panel shows exactly which scale notes are available over each one.'
      ),
      gloss('shell','Shell voicing','A 3-note chord using just root, 3rd, and 7th — the 5th is omitted.',null,
        'The 5th adds little harmonic information that the other notes don\'t already provide, so shells strip it out, leaving a minimal but complete harmonic statement. The result is open-sounding and leaves room for other instruments.',
        'Shell Form A uses skip-string layouts (e.g., strings 6-4-3). Form B uses adjacent strings (e.g., strings 6-5-4). Shells are often the first step toward playing with a bassist, since they leave the low end uncluttered. Find them under the "Shell" tab in the Keys or Chords views.'
      ),
      gloss('rootless','Rootless voicing','A 4-note chord where the 9th replaces the root.',null,
        'When a bassist plays the root, your guitar chord can drop the root entirely and substitute the 9th (an octave above the 2nd scale degree). The chord becomes richer and more complex, and doesn\'t double the bass player\'s note.',
        'Type A voicings (3-5-7-9) have the 3rd at the bottom. Type B (7-9-3-5) have the 7th at the bottom. These are the voicings you\'ll hear Bill Evans and other jazz pianists use. On guitar they live on the middle strings (4-3-2-1 or 5-4-3-2). Find them in the Chords in Key view under "Rootless" (Pro).'
      ),
      gloss('arp','Arpeggio','Playing chord notes one at a time instead of simultaneously.',null,
        'An arpeggio is the melodic version of a chord — the notes played in sequence like a harp (the word comes from the Italian "arpa"). Every chord position on the neck can become a melodic pattern by playing the notes one at a time.',
        'In jazz improv, arpeggios outline the chord changes with precision: instead of running a pentatonic lick through everything, you follow the exact chord tones. This is fundamental to bebop — Charlie Parker and Dizzy Gillespie improvised by rapidly arpeggiating through the chord changes. The Arpeggio view shows all chord-tone positions across the neck.'
      ),
      gloss('comp','Comping','Playing chords in rhythm to back a soloist — short for "accompany."',null,
        'To comp is to play a tune\'s chords in rhythm, supplying the harmony and groove while someone else plays the melody or solos. It is the guitarist\'s primary role in a jazz group, and what the Play tab\'s backing track is doing for you.',
        'Good comping is mostly about placement and space — you don\'t strum every beat. Classic spots are beats 2 and 4, or the "Charleston" (beat 1 plus the "and" of beat 2). Leave gaps so the soloist has room. Shells and Drop 2 are the standard comping voicings.'
      ),
      gloss('modes','Modes (Dorian, Lydian, Mixolydian, Altered...)','Scales built from the same notes as a major scale but starting on a different degree.',null,
        'The C major scale is C D E F G A B. If you start on D and play through all 7 notes back to D, you get D Dorian: D E F G A B C. Same notes as C major, different starting pitch — and a completely different flavor. Each of the 7 starting positions creates a different mode.',
        'Dorian (start on 2nd degree): minor feel with a natural 6th — the standard scale for iim7. Lydian (4th degree): major feel with a raised 4th (#11) — bright, floating, for Imaj7 or IVmaj7. Mixolydian (5th degree): major feel with a ♭7 — the sound of dominant 7. Altered (7th mode of melodic minor): all tensions altered (♭9 ♯9 ♭13) — maximum outside tension over V7.',
        'Start diatonic. As your ear develops, let the modes label what you\'re already hearing.'
      ),
      gloss('roman','Roman numerals (I, ii, V...)','Labels for chord positions in a key — work the same in any key.',null,
        'In C major: I=Cmaj7, ii=Dm7, iii=Em7, IV=Fmaj7, V=G7, vi=Am7, vii°=Bm7♭5. In G major: I=Gmaj7, ii=Am7, V=D7. The Roman numeral names the scale degree; the chord quality (maj7, m7, 7) is stated separately. This lets musicians say "ii–V–I in B♭" and every player knows exactly which chords are meant.',
        'Upper-case numerals (I, IV, V) indicate major or dominant chords. Lower-case (ii, iii, vi, vii°) indicate minor or half-diminished chords. The case tells you the color at a glance — the suffix (m7, maj7, 7) confirms the exact quality.'
      )
    ),
    e('div',{style:S},
      e('div',{style:{cursor:'pointer',userSelect:'none',display:'flex',alignItems:'center',gap:8,
        fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,color:'var(--scale-name)',marginBottom:expanded.intervals?8:0},
        onClick:()=>tog('intervals')},
        e('span',{style:{color:GOLD,marginRight:2}},expanded.intervals?'▾':'▸'),
        'Reference — Intervals'
      ),
      !expanded.intervals?e('p',{style:{...P,marginBottom:0,marginTop:4}},'The distance between two notes, measured in semitones. One guitar fret = one semitone. Tap to expand the full reference table.'):null,
      expanded.intervals?e('div',null,
        p('Every chord and scale in music is built from intervals — the distance between two notes, measured in half-steps (semitones). On the guitar, one fret = one semitone. Knowing intervals by ear and by name is the hidden fluency that makes theory click.'),
        e('div',{style:{overflowX:'auto',marginTop:10,marginBottom:4}},
          e('table',{style:{borderCollapse:'collapse',fontSize:'0.82rem',width:'100%',minWidth:340}},
            e('thead',null,
              e('tr',null,
                ['Semitones','Name','Abbr.','Example (from C)','Sound / feel'].map((h,i)=>
                  e('th',{key:i,style:{padding:'5px 10px',textAlign:'left',color:LBL,
                    borderBottom:'1px solid '+BORDER,fontWeight:600,whiteSpace:'nowrap'}},h)
                )
              )
            ),
            e('tbody',null,
              [
                [0,'Unison','1','C → C','Same note — root'],
                [1,'Minor 2nd','b2','C → Db','Half-step, sharp tension'],
                [2,'Major 2nd','2','C → D','Whole-step, mild step'],
                [3,'Minor 3rd','b3','C → Eb','Minor quality — dark'],
                [4,'Major 3rd','3','C → E','Major quality — bright'],
                [5,'Perfect 4th','4','C → F','Stable, open-sounding'],
                [6,'Tritone','b5 / #4','C → F#/Gb','Maximum tension'],
                [7,'Perfect 5th','5','C → G','Strong, stable'],
                [8,'Minor 6th','b6','C → Ab','Dark color'],
                [9,'Major 6th','6','C → A','Warm, bossa-friendly'],
                [10,'Minor 7th','b7','C → Bb','Blues / dominant sound'],
                [11,'Major 7th','Δ7','C → B','Jazz stable — pulls to root'],
                [12,'Octave','8','C → C (high)','Same note, one octave up'],
              ].map(([sem,name,abbr,ex,feel],ri)=>
                e('tr',{key:ri,style:{background:ri%2===0?'transparent':'var(--bg2)'}},
                  e('td',{style:{padding:'4px 10px',color:'#FFD43B',fontWeight:700,textAlign:'center'}},sem),
                  e('td',{style:{padding:'4px 10px',color:'var(--txt)',fontWeight:600}},name),
                  e('td',{style:{padding:'4px 10px',color:HINT,fontFamily:'Georgia,serif',fontStyle:'italic'}},abbr),
                  e('td',{style:{padding:'4px 10px',color:'#74C0FC'}},[ex]),
                  e('td',{style:{padding:'4px 10px',color:HINT,fontSize:'0.77rem'}},[feel])
                )
              )
            )
          )
        ),
        p('In the app, the colored dots on the neck each represent one chord-tone interval: ',
          e('span',{style:{color:'#FF6B6B',fontWeight:700}},'Root (R)'),', ',
          e('span',{style:{color:HINT,fontWeight:700}},'3rd'),', ',
          e('span',{style:{color:'#74C0FC',fontWeight:700}},'5th'),', and ',
          e('span',{style:{color:'#FFD43B',fontWeight:700}},'7th'),
          '. The dimmer dots show every occurrence of those intervals across the whole neck; the bright ones are the voicing you\'ve selected.'
        )
      ):null
    ),
    e('div',{style:S},
      e('div',{style:{cursor:'pointer',userSelect:'none',display:'flex',alignItems:'center',gap:8,
        fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,color:'var(--scale-name)',marginBottom:expanded.modes?8:0},
        onClick:()=>tog('modes')},
        e('span',{style:{color:GOLD,marginRight:2}},expanded.modes?'▾':'▸'),
        'Reference — Modes'
      ),
      !expanded.modes?e('p',{style:{...P,marginBottom:0,marginTop:4}},'The 7 scales built from a major key — Dorian, Mixolydian, Lydian, etc. Each sets the color over a specific chord type. Tap to expand.'):null,
      expanded.modes?e('div',null,
        p('Every major scale contains 7 modes — one starting on each degree. They share the same notes but each has a different root, which changes the intervals and gives each mode its characteristic color. In jazz, modes are used to describe which scale to play over a given chord.'),
        e('div',{style:{overflowX:'auto',marginTop:10,marginBottom:4}},
          e('table',{style:{borderCollapse:'collapse',fontSize:'0.82rem',width:'100%',minWidth:420}},
            e('thead',null,
              e('tr',null,
                ['Mode','Degree','Character','Jazz use','In C major'].map((h,i)=>
                  e('th',{key:i,style:{padding:'5px 10px',textAlign:'left',color:LBL,
                    borderBottom:'1px solid '+BORDER,fontWeight:600,whiteSpace:'nowrap'}},h)
                )
              )
            ),
            e('tbody',null,
              [
                ['Ionian',   'I',   'Bright, major — home',         'Imaj7 (avoid the 4th)',   'C–D–E–F–G–A–B'],
                ['Dorian',   'ii',  'Minor with a natural 6th',     'iim7, standard minor',    'D–E–F–G–A–B–C'],
                ['Phrygian', 'iii', 'Dark — ♭2 creates Spanish feel','iiim7, rare in jazz',    'E–F–G–A–B–C–D'],
                ['Lydian',   'IV',  'Major with ♯4 — floating',     'IVmaj7, bright color',    'F–G–A–B–C–D–E'],
                ['Mixolydian','V',  'Major with ♭7 — dominant sound','V7, standard dominant',  'G–A–B–C–D–E–F'],
                ['Aeolian',  'vi',  'Natural minor',                 'vim7, dark minor color',  'A–B–C–D–E–F–G'],
                ['Locrian',  'vii', 'Diminished — ♭2 and ♭5',       'viiø7, dissonant',       'B–C–D–E–F–G–A'],
              ].map(([mode,deg,char,use,notes],ri)=>
                e('tr',{key:ri,style:{background:ri%2===0?'transparent':'var(--bg2)'}},
                  e('td',{style:{padding:'4px 10px',color:GOLD,fontWeight:700}},mode),
                  e('td',{style:{padding:'4px 10px',color:'#C084FC',fontWeight:600,textAlign:'center'}},deg),
                  e('td',{style:{padding:'4px 10px',color:'var(--txt)',fontSize:'0.78rem'}},char),
                  e('td',{style:{padding:'4px 10px',color:'#74C0FC',fontSize:'0.78rem'}},use),
                  e('td',{style:{padding:'4px 10px',color:HINT,fontSize:'0.76rem',fontFamily:'Georgia,serif'}},notes)
                )
              )
            )
          )
        ),
        p('Two modes go beyond the major scale: ',
          e('b',{style:{color:GOLD}},'Melodic Minor'),' (root–2–♭3–4–5–6–7) is the most important in jazz — its modes include Lydian Dominant (V7#11), Altered (V7alt, all tensions altered), and Lydian Augmented. The Scale panel in the Keys tab shows which mode applies to each chord in the key.')
      ):null
    ),
    popTerm&&GLOSS_DEFS[popTerm]?e(React.Fragment,null,
      e('div',{onClick:()=>setPopTerm(null),style:{position:'fixed',inset:0,zIndex:199,background:'rgba(0,0,0,0.35)'}}),
      e('div',{style:{position:'fixed',bottom:0,left:0,right:0,zIndex:200,background:BG2,
        borderRadius:'14px 14px 0 0',border:'1px solid '+GOLD+'44',
        padding:'18px 20px 32px',boxShadow:'0 -8px 32px rgba(0,0,0,0.55)',
        maxHeight:'60vh',overflowY:'auto',
      }},
        e('div',{style:{display:'flex',alignItems:'center',marginBottom:10}},
          e('span',{style:{fontWeight:700,color:GOLD,fontSize:'0.92rem',fontFamily:UI_FONT}},GLOSS_DEFS[popTerm].term),
          e('button',{onClick:()=>setPopTerm(null),style:{marginLeft:'auto',background:'transparent',
            border:'none',cursor:'pointer',color:BTN_OFF,fontSize:'1.1rem',minHeight:0,padding:'2px 6px'}
          },'✕')
        ),
        e('p',{style:{fontSize:'0.84rem',lineHeight:1.65,color:'var(--txt)',fontFamily:UI_FONT,
          marginBottom:GLOSS_DEFS[popTerm].detail?10:0,borderBottom:GLOSS_DEFS[popTerm].detail?'1px solid '+BORDER:'none',
          paddingBottom:GLOSS_DEFS[popTerm].detail?10:0}},
          GLOSS_DEFS[popTerm].short),
        GLOSS_DEFS[popTerm].detail?e('p',{style:{fontSize:'0.82rem',lineHeight:1.7,color:'var(--txt)',
          fontFamily:UI_FONT,marginBottom:0,opacity:0.85}},GLOSS_DEFS[popTerm].detail):null
      )
    ):null,
    sec('Next Steps & Listening',
      p('Finished the Path? Pro adds Drop 3, Rootless voicings, altered scales, and extended chord types — tap any 🔒 badge to unlock. The Chords tab lets you build any chord with any extension. The Sec. Dom. and Tritone Sub forms in Play let you hear ',term('sec_dom','secondary dominants'),' and ',term('tritone_sub','tritone substitution'),' in action. Melodically, practice ',term('approach_note','chromatic approach notes'),' into guide tones — one half-step before each chord change is enough to start sounding like bebop. Further concepts: ',term('modal_int','modal interchange'),', reharmonization, chord melody, and rhythm changes.'),
      p(e('b',{style:HL},'Players to study:')),
      ul(
        e('span',null,e('b',null,'Wes Montgomery'),' — warmth, clarity, octave technique; a natural first listen for any guitarist'),
        e('span',null,e('b',null,'Joe Pass'),' — solo jazz guitar; walking bass and chords simultaneously; a masterclass in voice leading'),
        e('span',null,e('b',null,'Jim Hall'),' — space, restraint, perfect voice leading in every phrase; study his duo recordings with Bill Evans'),
        e('span',null,e('b',null,'Pat Metheny'),' — lyrical modern jazz, strong melodic sense, bridges many styles'),
        e('span',null,e('b',null,'Kurt Rosenwinkel'),' — modern harmony, complex extensions, guitar-forward compositional thinking')
      ),
      p('Start with a standard: ',e('b',{style:HL},'Autumn Leaves'),' (minor and major ii–V–is back to back — most-studied for a reason), ',e('b',{style:HL},'Blue Bossa'),' (16-bar bossa, modulates to D♭ — accessible and satisfying), ',e('b',{style:HL},'Stella by Starlight'),' (three ii–V–I chains through E♭, G, and B♭ — the key-hopping tune every player studies), or ',e('b',{style:HL},'All The Things You Are'),' (moves through many keys, teaches transposition). Learn the melody first, then comp through the chords, then listen to recordings and try to identify what you\'re hearing.')
    )
  );
}

// ── Nav tab icons ─────────────────────────────────────────────────────
function ChordDiagramIcon(){
  return e('svg',{width:20,height:21,viewBox:'0 0 20 21',style:{display:'block',overflow:'visible'}},
    e('rect',{x:1,y:1,width:18,height:2.5,fill:'currentColor',opacity:0.9}),
    [3.2,7.7,12.3,16.8].map(x=>e('line',{key:x,x1:x,y1:3.5,x2:x,y2:20,stroke:'currentColor',strokeWidth:1,opacity:0.45})),
    e('line',{x1:1,y1:9.5,x2:19,y2:9.5,stroke:'currentColor',strokeWidth:0.8,opacity:0.35}),
    e('line',{x1:1,y1:15.5,x2:19,y2:15.5,stroke:'currentColor',strokeWidth:0.8,opacity:0.35}),
    e('circle',{cx:7.7,cy:6.5,r:2.2,fill:'currentColor'}),
    e('circle',{cx:12.3,cy:12.5,r:2.2,fill:'currentColor'}),
    e('circle',{cx:3.2,cy:12.5,r:2.2,fill:'currentColor'})
  );
}
function CircleOfFifthsIcon(){
  const pts=[0,1,2,3,4,5,6,7,8,9,10,11].map(i=>{
    const a=(i*30-90)*Math.PI/180;
    const filled=i===0||i===5||i===7;
    return e('circle',{key:i,
      cx:(10+7.5*Math.cos(a)).toFixed(2),cy:(10+7.5*Math.sin(a)).toFixed(2),
      r:filled?2.1:1.1,fill:filled?'currentColor':'none',
      stroke:'currentColor',strokeWidth:0.8,opacity:filled?1:0.5
    });
  });
  return e('svg',{width:20,height:20,viewBox:'0 0 20 20',style:{display:'block'}},
    e('circle',{cx:10,cy:10,r:8.5,fill:'none',stroke:'currentColor',strokeWidth:1.1,opacity:0.6}),
    ...pts,
    e('circle',{cx:10,cy:10,r:1.5,fill:'currentColor',opacity:0.8})
  );
}

// ── App ───────────────────────────────────────────────────────────────
function App(){
  const [theme,setTheme]=useState(()=>safeLS('jg-theme','dark'));
  const [winW,setWinW]=useState(window.innerWidth);
  useEffect(()=>{
    const onResize=()=>setWinW(window.innerWidth);
    window.addEventListener('resize',onResize);
    return ()=>window.removeEventListener('resize',onResize);
  },[]);
  function toggleTheme(){
    const next=theme==='dark'?'light':'dark';
    setTheme(next);
    document.documentElement.dataset.theme=next;
    const m=document.getElementById('theme-meta');
    if(m) m.content=next==='dark'?'#07070f':'#f5f5fa';
  }
  useEffect(()=>{
    document.documentElement.dataset.theme=theme;
    const m=document.getElementById('theme-meta');
    if(m) m.content=theme==='dark'?'#07070f':'#f5f5fa';
    safeLSSet('jg-theme',theme);
  },[theme]);
  // Global state
  const [key,setKey]=useState(()=>parseInt(safeLS('jg-key','0'),10));
  const [viewMode,setViewMode]=useState(()=>{const sv=safeLS('jg-viewMode',null);if(sv)return sv;return safeLS('jg-path',null)?'iivi':'guide';}); // 'diatonic'|'iivi'|'custom'|'guide'|'quiz'
  const [keyOpen,setKeyOpen]=useState(false);
  const [dotMode,setDotMode]=useState(()=>{const m=safeLS('jg-dotMode','interval');return (m==='both'||m==='finger')?'interval':m;});
  useEffect(()=>{safeLSSet('jg-dotMode',dotMode);},[dotMode]);
  const [overviewStep,setOverviewStep]=useState(()=>safeLS('jg-toured')?null:0);
  const [pageTourStep,setPageTourStep]=useState(null);
  const [pageTourId,setPageTourId]=useState(null);

  function overviewNext(){
    if(overviewStep>=tourStepsFor(OVERVIEW_STEPS,level==='pro').length-1){
      setOverviewStep(null);safeLSSet('jg-toured','1');
      setViewMode('guide');window.scrollTo(0,0);
    } else setOverviewStep(s=>s+1);
  }
  function overviewSkip(){setOverviewStep(null);safeLSSet('jg-toured','1');}

  function pageTourNext(){
    const steps=tourStepsFor(PAGE_TOURS[pageTourId]||[],level==='pro');
    setPageTourStep(s=>{
      if(s===null||s>=steps.length-1){
        safeLSSet('jg-toured-'+pageTourId,'1');
        setPageTourId(null);
        return null;
      }
      return s+1;
    });
  }
  function pageTourSkip(){
    if(pageTourId) safeLSSet('jg-toured-'+pageTourId,'1');
    setPageTourStep(null);setPageTourId(null);
  }

  useEffect(()=>{
    if(overviewStep===null) return;
    const v=OVERVIEW_STEPS[overviewStep]&&OVERVIEW_STEPS[overviewStep].view;
    if(v) setViewMode(v);
  },[overviewStep]);
  // Level: Essentials hides the advanced half of the app. New users start
  // in Essentials; anyone who used the app before the level existed keeps Full.
  const [level,setLevel]=useState(()=>safeLS('jg-level','essentials'));
  const [trialActive,setTrialActive]=useState(()=>{
    const ts=safeLS('jg-trial-start','');
    return!!ts&&Math.floor((Date.now()-new Date(ts).getTime())/86400000)<7;
  });
  const trialUsed=!!safeLS('jg-trial-start','');
  const effectiveLevel=(level==='essentials'&&trialActive)?'pro':level;
  const [upgradeSheet,setUpgradeSheet]=useState(null); // feature name string, or null
  const [popTerm,setPopTerm]=useState(null); // glossary term key, or null
  const [aboutOpen,setAboutOpen]=useState(false);
  function showUpgrade(feature){setUpgradeSheet(feature);track('paywall.shown',{feature});}
  function doUpgrade(){
    track('upgrade.completed',{feature:upgradeSheet});
    // TODO: replace the two lines below with RevenueCat/StoreKit purchase call when IAP is ready
    setLevel('pro');safeLSSet('jg-level','pro');
    setUpgradeSheet(null);
  }
  function doRestore(){
    // TODO: replace with RevenueCat restorePurchases() when IAP is ready
    setLevel('pro');safeLSSet('jg-level','pro');
  }
  function startTrial(){
    safeLSSet('jg-trial-start',localDateStr());
    setTrialActive(true);
    setUpgradeSheet(null);
    track('trial.started',{});
  }
  const isEss=effectiveLevel==='essentials';
  useEffect(()=>{track('app.loaded',{level});},[]);
  const [iiviPlaying,setIiviPlaying]=useState(false);
  // Clear playing state when navigating away from the play tab
  useEffect(()=>{ if(viewMode!=='iivi') setIiviPlaying(false); },[viewMode]);

  // Streak & practice tracking
  const safeInt=(v,def=0)=>{const n=parseInt(v,10);return Number.isFinite(n)?n:def;};
  const [streak,setStreak]=useState(()=>safeInt(safeLS('jg-streak','0')));
  const [bestStreak,setBestStreak]=useState(()=>safeInt(safeLS('jg-best-streak','0')));
  const [lastPracticeDay,setLastPracticeDay]=useState(()=>safeLS('jg-last-practice',''));
  const [playSessions,setPlaySessions]=useState(()=>safeInt(safeLS('jg-play-sessions','0')));
  const [streakAnim,setStreakAnim]=useState(false);
  const [streakAnimPending,setStreakAnimPending]=useState(false);
  const [streakMilestone,setStreakMilestone]=useState(null); // day count at which milestone fires
  const practicedToday=lastPracticeDay===localDateStr();
  const appDaysSince=lastPracticeDay?Math.round((Date.now()-new Date(lastPracticeDay+'T00:00:00'))/86400000):0;
  const nextMil=[3,7,14,30,60,100,180,365].find(m=>m>streak)||(Math.floor(streak/30)+1)*30;
  const daysToNextMil=nextMil-streak;

  // Fire deferred streak animation when play stops
  useEffect(()=>{
    if(!iiviPlaying&&streakAnimPending){
      setStreakAnimPending(false);
      setStreakAnim(true);
      setTimeout(()=>setStreakAnim(false),900);
    }
  },[iiviPlaying,streakAnimPending]);

  function markPracticed(){
    const today=localDateStr();
    if(lastPracticeDay===today) return;
    const yesterday=localDateStr(Date.now()-86400000);
    const twoDaysAgo=localDateStr(Date.now()-2*86400000);
    // Grace day: one missed day doesn't break the streak when streak >= 3
    const graceDay=lastPracticeDay===twoDaysAgo&&streak>=3;
    const newStreak=(lastPracticeDay===yesterday||graceDay)?streak+1:1;
    setStreak(newStreak);
    setLastPracticeDay(today);
    safeLSSet('jg-streak',newStreak);
    safeLSSet('jg-last-practice',today);
    if(newStreak>bestStreak){setBestStreak(newStreak);safeLSSet('jg-best-streak',newStreak);}
    if(isStreakMilestone(newStreak)){
      setStreakMilestone(newStreak);
      setTimeout(()=>setStreakMilestone(null),5400);
      track('streak.milestone',{days:newStreak,level});
    }
    if(iiviPlaying){
      setStreakAnimPending(true);
    } else {
      setStreakAnim(true);
      setTimeout(()=>setStreakAnim(false),900);
    }
    // Schedule tomorrow's reminder (request permission at day 3 when user is invested)
    if(newStreak===3){Notif.requestPermission().then(()=>Notif.schedule(newStreak));}
    else{Notif.schedule(newStreak);}
  }

  // On mount: ensure reminder is queued if streak is at risk, or cancel if already practiced
  useEffect(()=>{
    const today=localDateStr();
    const practiced=safeLS('jg-last-practice','')=== today;
    const s=parseInt(safeLS('jg-streak','0'),10);
    if(practiced){Notif.cancel();}
    else if(s>0){Notif.schedule(s);}
  },[]);

  // Bluetooth page-turner pedal support
  // Pedals appear as keyboard events (AirTurn: Space/Backspace or Arrow keys;
  // PageFlip: PageDown/PageUp). The ref lets IIVIView register its own handlers
  // without lifting activeChordIdx out of that component.
  const iiviPedalRef=useRef({forward:null,back:null});
  const earPedalRef=useRef({forward:null,back:null});
  useEffect(()=>{
    function onPedal(ev){
      if(ev.target.tagName==='INPUT'||ev.target.tagName==='TEXTAREA'||ev.target.isContentEditable) return;
      const fwd=ev.key==='ArrowRight'||ev.key==='ArrowDown'||ev.key==='PageDown'||ev.key===' ';
      const bwd=ev.key==='ArrowLeft'||ev.key==='ArrowUp'||ev.key==='PageUp'||ev.key==='Backspace';
      if(!fwd&&!bwd) return;
      ev.preventDefault();
      if(viewMode==='diatonic'){
        setDeg(d=>fwd?(d+1)%7:(d+6)%7);
      } else if(viewMode==='custom'){
        const len=isEss?4:EXT_TYPES.length;
        setCustomTypeIdx(i=>fwd?(i+1)%len:(i-1+len)%len);
      } else if(viewMode==='guide'){
        window.scrollBy({top:fwd?350:-350,behavior:'smooth'});
      } else if(viewMode==='iivi'){
        if(fwd) iiviPedalRef.current.forward?.();
        if(bwd) iiviPedalRef.current.back?.();
      } else if(viewMode==='quiz'){
        if(fwd) earPedalRef.current.forward?.();
        if(bwd) earPedalRef.current.back?.();
      }
    }
    window.addEventListener('keydown',onPedal);
    return ()=>window.removeEventListener('keydown',onPedal);
  },[viewMode]); // eslint-disable-line react-hooks/exhaustive-deps
  // Diatonic state
  const [deg,setDeg]=useState(0);
  const [vType,setVType]=useState('shell');
  const [ssIdx,setSsIdx]=useState(2);
  const [invIdx,setInvIdx]=useState(0);
  const [shellIdx,setShellIdx]=useState(0);
  const [rlIdx,setRlIdx]=useState(0);
  const [scaleIdx,setScaleIdx]=useState(0);
  // Custom chord state (lifted so it persists when switching modes)
  const [customRoot,setCustomRoot]=useState(0);
  const [customTypeIdx,setCustomTypeIdx]=useState(2);
  const [customVType,setCustomVType]=useState('shell');

  useEffect(()=>{setScaleIdx(0);},[deg]);
  useEffect(()=>{safeLSSet('jg-key',key);},[key]);
  useEffect(()=>{safeLSSet('jg-viewMode',viewMode);},[viewMode]);
  useEffect(()=>{safeLSSet('jg-level',level);},[level]);
  // Dropping to Essentials while on an advanced tab/chord type
  useEffect(()=>{
    if(isEss){
      if(vType==='drop2'||vType==='drop3'||vType==='drop24'||vType==='drop23'||vType==='rootless') setVType('shell');
      if(customTypeIdx>3) setCustomTypeIdx(2);
    }
  },[effectiveLevel]);// eslint-disable-line react-hooks/exhaustive-deps

  // Jump from a Path stage into a live view with everything preset.
  // bpm/minor belong to IIVIView, which is unmounted while the Path is
  // open, so writing localStorage here is picked up when it mounts.
  function openPreset(p){
    if(p.level) setLevel(p.level);
    if(p.key!==undefined) setKey(p.key);
    if(p.deg!==undefined) setDeg(p.deg);
    if(p.vType) setVType(p.vType);
    if(p.ssIdx!==undefined) setSsIdx(p.ssIdx);
    if(p.form) safeLSSet('jg-form',p.form);
    if(p.bpm!==undefined) safeLSSet('jg-bpm',String(p.bpm));
    if(p.vType&&p.view==='iivi') safeLSSet('jg-vtype',p.vType);
    setViewMode(p.view||'diatonic');
    window.scrollTo(0,0);
  }
  function findInKey(root,typeIdx){
    const quality=['maj7','m7','dom7','m7b5'][typeIdx];
    if(!quality) return;
    // Carry the voicing style across so Chords ↔ Keys stay consistent.
    // m7b5 has no Rootless tab in Keys, but Chords can't be Rootless anyway.
    // String set / inversion / shell index are shared App state, so they
    // carry over automatically — no need to copy them here.
    setVType(customVType);
    // Prefer current key — search its degrees first
    for(let d=0;d<7;d++){
      if(QTYPES[d]===quality&&(KEYS[key].root+MAJOR_SCALE[d])%12===root){
        setDeg(d);setViewMode('diatonic');window.scrollTo(0,0);return;
      }
    }
    // Fallback: search all keys, lowest key index first
    for(let k=0;k<12;k++){
      for(let d=0;d<7;d++){
        if(QTYPES[d]===quality&&(KEYS[k].root+MAJOR_SCALE[d])%12===root){
          setKey(k);setDeg(d);setViewMode('diatonic');window.scrollTo(0,0);return;
        }
      }
    }
  }

  const quality=QTYPES[deg];
  // m7b5 has no rootless voicing — leave that tab if it's active
  useEffect(()=>{if(quality==='m7b5'&&vType==='rootless')setVType('shell');},[quality]);
  const rootPC=(KEYS[key].root+MAJOR_SCALE[deg])%12;
  const tones=useMemo(()=>getChordTones(rootPC,quality),[rootPC,quality]);
  const rlTones=useMemo(()=>getRootlessTones(rootPC,quality),[rootPC,quality]);
  const degNames=DNAMES[quality];
  const rlDegNames=RL_DNAMES[quality];
  const arpPos=useMemo(()=>getArpPos(tones),[tones]);
  const chordName=nn(rootPC,key)+QSYMS[deg];

  const scaleOptions=isEss?CHORD_SCALES[deg].slice(0,1):CHORD_SCALES[deg];
  const safeScaleIdx=Math.min(scaleIdx,scaleOptions.length-1);
  const currentScale=scaleOptions[safeScaleIdx];
  const scalePos=useMemo(()=>getScalePos(rootPC,currentScale.iv,tones),[rootPC,currentScale,tones]);

  const dropD=DROP_DATA[vType]||DROP_DATA.drop2;
  const invData=dropD.inv, setsData=dropD.sets;
  const safeSSIdx=Math.min(ssIdx,setsData.length-1);

  const allVoicings=useMemo(()=>{
    if(vType==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,1));
    if(!DROP_TYPES.has(vType)) return [];
    const ss=setsData[safeSSIdx].s;
    return invData.map(inv=>calcVoicing(ss,inv.a,tones));
  },[vType,safeSSIdx,tones,ssIdx]);

  const firstValidShell=useMemo(()=>{
    const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,1));
    const f=vs.findIndex(v=>v!==null); return f>=0?f:0;
  },[tones]);
  useEffect(()=>{if(vType==='shell') setShellIdx(firstValidShell);},[firstValidShell]);
  const safeShellIdx=allVoicings[shellIdx]?shellIdx:firstValidShell;

  // Which string sets yield at least one playable inversion for this chord.
  const playableSets=useMemo(()=>DROP_TYPES.has(vType)
    ?setsData.map(ss=>invData.some(inv=>calcVoicing(ss.s,inv.a,tones)!==null)):[]
  ,[vType,setsData,invData,tones]);
  const firstPlayableSet=useMemo(()=>{const f=playableSets.findIndex(Boolean);return f>=0?f:0;},[playableSets]);
  // Snap away from a dead string set so the empty state is never reached normally.
  useEffect(()=>{
    if(DROP_TYPES.has(vType)&&playableSets.length&&!playableSets[safeSSIdx]&&playableSets[firstPlayableSet]){
      setSsIdx(firstPlayableSet);setInvIdx(0);
    }
  },[vType,playableSets,safeSSIdx,firstPlayableSet]);
  // True only when no string set works at all — then the neck is hidden.
  const noDropShape=DROP_TYPES.has(vType)&&playableSets.length>0&&!playableSets.some(Boolean);

  const allRootless=useMemo(()=>
    ROOTLESS.map(cfg=>calcVoicing(cfg.s,cfg.a,rlTones,1)),[rlTones]);
  const firstValidRl=useMemo(()=>{const f=allRootless.findIndex(v=>v!==null);return f>=0?f:0;},[allRootless]);
  useEffect(()=>{if(vType==='rootless') setRlIdx(firstValidRl);},[firstValidRl,vType]);
  const safeRlIdx=allRootless[rlIdx]?rlIdx:firstValidRl;

  const selIdx=vType==='shell'?safeShellIdx:invIdx;
  const isRl=vType==='rootless';
  const hlTc=isRl?TC_RL:TC;

  const highlight=useMemo(()=>{
    if(vType==='arpeggio') return null;
    if(vType==='rootless'){
      const v=allRootless[safeRlIdx]; if(!v) return null;
      const ss=ROOTLESS[safeRlIdx].s;
      return v.frets.map((f,i)=>{
        const si=ss[i],ti=rlTones.indexOf((OPEN_PC[si]+f)%12);
        return{s:si,f,ti,dl:ti>=0?rlDegNames[ti]:''};
      });
    }
    const v=allVoicings[selIdx]; if(!v) return null;
    const ss=vType==='shell'?SHELLS[safeShellIdx].s:setsData[safeSSIdx].s;
    return v.frets.map((f,i)=>{
      const si=ss[i],ti=tones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?degNames[ti]:''};
    });
  },[allVoicings,allRootless,selIdx,vType,safeShellIdx,safeRlIdx,safeSSIdx,tones,rlTones,degNames,rlDegNames]);

  // Style helpers
  const tabStyle=id=>{const act=vType===id;return{
    padding:'7px 14px',borderRadius:'6px 6px 0 0',cursor:'pointer',
    border:'1px solid '+(act?'#74C0FC30':BORDER),
    borderBottom:act?'1px solid '+BG2:'1px solid '+BORDER,
    background:act?BG2:BG,fontFamily:UI_FONT,fontSize:'0.76rem',
    color:act?'#74C0FC':BTN_OFF,fontWeight:act?700:400,minHeight:44};};
  const keyBtnStyle=i=>{const act=key===i;return{
    padding:'4px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
    border:'1px solid '+(act?GOLD:BTN_BRD),background:act?ACT_GOLD:BG2,
    color:act?GOLD:BTN_OFF,fontWeight:act?700:400,minHeight:44};};
  const chordBtnStyle=i=>{const act=deg===i;return{
    padding:'6px 10px',borderRadius:8,cursor:'pointer',fontFamily:UI_FONT,
    border:'1px solid '+(act?'#FF6B6B':BTN_BRD),background:act?ACT_RED:BG2,
    color:act?'#FF6B6B':BTN_OFF,minWidth:58,textAlign:'center',minHeight:48};};
  const voiceOrder=DROP_TYPES.has(vType)&&invData[invIdx]
    ?invData[invIdx].a.map(idx=>degNames[idx]).join(' - '):'';

  const shellsA=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='A');
  const shellsB=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='B');

  return e('div',{style:{background:BG,minHeight:'100vh',color:'var(--txt)',fontFamily:UI_FONT}},
  e('div',{style:{maxWidth:Math.min(960,winW-28),margin:'0 auto',padding:'14px 14px 84px'}},

    // Header — hidden while the play tab is active to maximise neck real-estate
    !iiviPlaying&&e('div',{style:{display:'flex',alignItems:'center',gap:8,marginBottom:8}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.4rem',fontWeight:700,color:'var(--scale-name)'}},'Jazz Guitar Lab'),
      e('button',{onClick:toggleTheme,'aria-label':'Toggle theme',style:{
        padding:'4px 8px',borderRadius:12,cursor:'pointer',fontFamily:UI_FONT,
        fontSize:'0.9rem',border:'1px solid var(--btn-brd)',background:'var(--bg2)',
        color:'var(--lbl)',minHeight:0,flexShrink:0}},
        theme==='dark'?'☀':'☾'),
      e('div',{style:{flex:1}}),
      (level==='pro'||trialActive)?e('div',{'data-tour':'level-switch',
        onClick:()=>{
          if(trialActive){setTrialActive(false);}
          else{setLevel('essentials');safeLSSet('jg-level','essentials');}
        },
        title:trialActive?'7-day trial active — tap to preview Essentials':'Tap to switch back to Essentials',
        style:{fontSize:'0.72rem',fontWeight:700,fontFamily:UI_FONT,color:GOLD,
          border:'1px solid '+GOLD+'66',borderRadius:10,padding:'3px 10px',cursor:'pointer',
          background:ACT_GOLD,flexShrink:0}},
        trialActive?'Trial ✦':'Pro ✦'):null,
      streak>0?e('div',{
        title:'Practice streak — '+streak+' day'+(streak!==1?'s':'')+'. Next badge at day '+nextMil+' ('+daysToNextMil+' day'+(daysToNextMil===1?'':'s')+' away). Practice daily to keep it going.',
        style:{display:'flex',alignItems:'center',gap:3,padding:'3px 8px',borderRadius:10,
        border:'1px solid var(--btn-brd)',background:'var(--bg2)',flexShrink:0,cursor:'default',
        animation:streakAnim?'streakPop 0.9s ease-out':'none',transformOrigin:'center'}},
        e('span',{style:{fontSize:'0.72rem'}},'🔥'),
        e('span',{style:{fontSize:'0.72rem',color:'var(--lbl)',fontFamily:UI_FONT}},streak+'d')
      ):null,
      e('div',{style:{display:'flex',gap:4,flexShrink:0}},
        e('button',{onClick:()=>setOverviewStep(0),
          style:{padding:'3px 8px',borderRadius:12,cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.72rem',border:'1px solid var(--btn-brd)',background:'var(--bg2)',
            color:'var(--lbl)',minHeight:36}},
          'Overview'),
        PAGE_TOURS[viewMode]
          ?e('button',{'data-tour':'page-tour-btn',onClick:()=>{setPageTourStep(0);setPageTourId(viewMode);},
              style:{padding:'3px 8px',borderRadius:12,cursor:'pointer',fontFamily:UI_FONT,
                fontSize:'0.72rem',border:'1px solid '+GOLD+'88',background:'var(--bg2)',
                color:GOLD,minHeight:36}},
              '? Tour')
          :null,
        e('button',{'aria-label':'About & support',onClick:()=>setAboutOpen(true),
          style:{padding:'3px 8px',borderRadius:12,cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.8rem',border:'1px solid var(--btn-brd)',background:'var(--bg2)',
            color:'var(--lbl)',minHeight:36,letterSpacing:'1px'}},
          '···')
      ),
    ),

    // Loss-aversion / welcome-back banner — shows when streak is at risk or user returning after absence
    !iiviPlaying&&!practicedToday&&streak>0?e('div',{style:{
      margin:'-2px 0 10px',padding:'8px 12px',
      background:'rgba(251,191,36,0.07)',border:'1px solid rgba(251,191,36,0.22)',
      borderRadius:8,display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',justifyContent:'space-between'
    }},
      e('span',{style:{fontSize:'0.73rem',fontWeight:700,color:GOLD,fontFamily:UI_FONT}},
        appDaysSince>=2
          ?'⚠️ '+streak+'-day streak — '+appDaysSince+' days since last practice'
          :'🔥 '+streak+'-day streak — practice today to keep it'
      ),
      daysToNextMil<=7?e('span',{style:{fontSize:'0.68rem',color:'var(--hint)',fontFamily:UI_FONT}},
        daysToNextMil===1?'1 day to '+nextMil+'d badge':daysToNextMil+'d to '+nextMil+'d badge'
      ):null
    ):null,

    // Key chip (hidden in custom/guide/quiz/playing modes)
    viewMode!=='custom'&&viewMode!=='guide'&&viewMode!=='quiz'&&!iiviPlaying?e('div',{'data-tour':'key-chip',style:{marginBottom:10}},
      e('button',{onClick:()=>setKeyOpen(o=>!o),style:{
        display:'inline-flex',alignItems:'center',gap:7,padding:'5px 14px',borderRadius:18,
        cursor:'pointer',fontFamily:UI_FONT,border:'1px solid '+(keyOpen?GOLD:BTN_BRD),
        background:keyOpen?ACT_GOLD:BG2,minHeight:44}},
        e('span',{style:{fontSize:'0.7rem',color:LBL,letterSpacing:'1px'}},'KEY'),
        e('span',{style:{fontSize:'1rem',color:GOLD,fontWeight:700}},KEYS[key].name),
        e('span',{style:{fontSize:'0.7rem',color:LBL}},keyOpen?'▲':'▼')
      ),
      keyOpen?e('div',{style:{display:'flex',flexWrap:'wrap',gap:3,marginTop:8}},
        KEYS.map((k,i)=>e('button',{key:i,onClick:()=>{setKey(i);setKeyOpen(false);},style:keyBtnStyle(i)},k.name))
      ):null
    ):null,

    // ── IIVI VIEW ────────────────────────────────────────────────────
    viewMode==='iivi'?e(IIVIView,{keyIdx:key,dotMode,setDotMode,level:effectiveLevel,onPlayStateChange:setIiviPlaying,pedalRef:iiviPedalRef,onUpgrade:showUpgrade,
      onPracticed:()=>{
        setPlaySessions(s=>{const ns=s+1;safeLSSet('jg-play-sessions',ns);return ns;});
        markPracticed();
      }}):null,

    // ── CUSTOM CHORD VIEW ────────────────────────────────────────────
    viewMode==='custom'?e(CustomChordView,{customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level:effectiveLevel,dotMode,setDotMode,onFindInKey:findInKey,vType:customVType,setVType:setCustomVType,onUpgrade:showUpgrade,ssIdx,setSsIdx,invIdx,setInvIdx,shellIdx,setShellIdx}):null,

    // ── GUIDE / PATH VIEW ────────────────────────────────────────────
    viewMode==='guide'?e(GuideView,{openPreset,level:effectiveLevel,streak,lastPracticeDay,bestStreak,onUpgrade:showUpgrade,onPracticed:markPracticed}):null,

    // ── TRAIN HUB (Ear + Fretboard) ──────────────────────────────────
    viewMode==='quiz'?e(TrainView,{level:effectiveLevel,onPracticed:markPracticed,onUpgrade:showUpgrade,pedalRef:earPedalRef}):null,

    // ── DIATONIC VIEW ────────────────────────────────────────────────
    viewMode==='diatonic'?e('div',null,
      // Diatonic chord map — all 7 chords as visual cards
      e('div',{'data-tour':'chord-row',style:{display:'flex',flexWrap:'nowrap',gap:3,marginBottom:10,
        overflowX:'auto',scrollbarWidth:'none',msOverflowStyle:'none',WebkitOverflowScrolling:'touch'}},
        ROMAN.map((r,i)=>{
          const rPC=(KEYS[key].root+MAJOR_SCALE[i])%12;
          const qt=QTYPES[i];
          const qcol=qt==='maj7'?GOLD:qt==='dom7'?'#FF6B6B':qt==='m7b5'?'#C084FC':'#74C0FC';
          const qbg=qt==='maj7'?ACT_GOLD:qt==='dom7'?ACT_RED:qt==='m7b5'?'#1a0a2a':'#0a1520';
          const act=deg===i;
          return e('button',{key:i,onClick:()=>{
            setDeg(i);
            try{
              const ti=getChordTones(rPC,qt);
              const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,ti,1));
              const vi=vs.findIndex(v=>v!==null);
              if(vi>=0)playChordPreview(vs[vi],SHELLS[vi].s);
            }catch(ex){}
          },style:{
            flex:'1 0 48px',padding:'6px 4px 5px',borderRadius:6,cursor:'pointer',
            border:'1px solid '+(act?qcol:BTN_BRD),
            background:act?qbg:'transparent',
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            minHeight:44,transition:'border-color 0.1s,background 0.1s',
          }},
            e('div',{style:{fontSize:'0.65rem',fontWeight:700,fontFamily:UI_FONT,
              color:act?qcol:LBL,letterSpacing:'0.3px',lineHeight:1}},r),
            e('div',{style:{fontSize:act?'0.9rem':'0.82rem',fontWeight:act?700:500,fontFamily:SERIF,
              color:act?qcol:BTN_OFF,lineHeight:1.1,textAlign:'center',transition:'font-size 0.1s'}},nn(rPC,key)),
            e('div',{onClick:(ev)=>{ev.stopPropagation();const gk={'maj7':'maj7','m7':'m7','dom7':'dom7','m7b5':'halfdim'}[qt];if(gk)setPopTerm(t=>t===gk?null:gk);},
              style:{fontSize:'0.58rem',fontFamily:UI_FONT,color:act?qcol+'cc':HINT,lineHeight:1,letterSpacing:'0.2px',
                cursor:'pointer',borderBottom:'1px dotted '+(act?qcol+'88':'var(--gold)44')}},QSYMS[i])
          );
        })
      ),
      // Chord info bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:7,
        padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}},
        e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:GOLD,fontStyle:'italic'}},chordName),
        e('span',{style:{fontSize:'0.79rem',color:LBL,letterSpacing:'0.3px'}},KEYS[key].name+' major — '+ROMAN[deg]),
        e('div',{style:{display:'flex',gap:12,flexWrap:'wrap',marginLeft:'auto'}},
          tones.map((t,i)=>
            e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5,fontSize:'0.76rem',color:TC[i]}},
              e('span',{style:{width:8,height:8,borderRadius:'50%',background:TC[i],display:'inline-block',flexShrink:0,boxShadow:'0 0 6px '+TC[i]+'88'}}),
              degNames[i]+'='+nn(t,key)
            )
          ),
          isRl?e('span',{style:{display:'flex',alignItems:'center',gap:5,fontSize:'0.76rem',color:'#C084FC'}},
            e('span',{style:{width:8,height:8,borderRadius:'50%',background:'#C084FC',display:'inline-block',flexShrink:0,boxShadow:'0 0 6px #C084FC88'}}),
            '9='+nn(rlTones[0],key)):null
        ),
        e('button',{'data-tour':'diatonic-explore',
          onClick:()=>{
            const qi=['maj7','m7','dom7','m7b5'].indexOf(quality);
            if(qi>=0){setCustomTypeIdx(qi);setCustomRoot(rootPC);}
            // Chords view has no Rootless tab; map it to the nearest available voicing
            let cv=vType==='rootless'?'drop3':vType;
            if(isEss&&(cv==='drop3'||cv==='drop24'||cv==='drop23'||cv==='drop2'))cv='shell';
            setCustomVType(cv);
            setViewMode('custom');window.scrollTo(0,0);
          },
          title:'Open this chord in the Chord Explorer — keeps your voicing (string set & inversion); add extensions, change voicing type, or look up another key.',
          style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.7rem',border:'1px solid '+BTN_BRD,background:'transparent',
            color:BTN_OFF,minHeight:0,flexShrink:0,whiteSpace:'nowrap'}
        },'Explore ↗')
      ),
      // Voicing tabs — Essentials shows the starting trio, Full shows everything
      e('div',{'data-tour':'voicing-tabs',style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
        ['shell','drop2','drop3','drop24','drop23',...(quality!=='m7b5'?['rootless']:[]),'arpeggio'].map(id=>{
          const lbls={drop2:'Drop 2',drop3:'Drop 3',drop24:'Drop 2+4',drop23:'Drop 2+3',shell:'Shell',rootless:'Rootless',arpeggio:'Arpeggio'};
          const locked=isEss&&(id==='drop2'||id==='drop3'||id==='drop24'||id==='drop23'||id==='rootless');
          return e('button',{key:id,
            onClick:locked?()=>showUpgrade(lbls[id]+' voicings'):()=>setVType(id),
            style:{...tabStyle(locked?'':id),opacity:locked?0.65:1}},
            lbls[id],(locked?e('span',{style:{fontSize:'0.65rem',marginLeft:3}},'🔒'):null));
        })
      ),
      // Controls bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
        borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
        display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
        DROP_TYPES.has(vType)?[
          e('span',{key:'lbl',style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'String set'),
          setsData.map((ss,i)=>{const ok=playableSets[i]!==false;return e('button',{key:i,disabled:!ok,
            onClick:ok?()=>{setSsIdx(i);setInvIdx(0);}:undefined,
            title:ok?undefined:'No playable shape for this chord on these strings',
            style:{...mkSsBtn(safeSSIdx===i),opacity:ok?1:0.4,cursor:ok?'pointer':'not-allowed'}},ss.lbl);}),
          voiceOrder?e('span',{key:'vo',style:{marginLeft:'auto',fontSize:'0.7rem',color:LBL}},'voices: '+voiceOrder):null
        ]:null,
        vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:quality==='m7b5'?'#FFD43B':HINT,fontFamily:UI_FONT}},
          quality==='m7b5'
            ?'⚠ Shell (R-3-7) omits the ♭5 — the note that defines this chord. Dimmed neck dots show all ♭5 positions.'
            :'Guide tones: R + 3rd + 7th  ·  Form A = skip-string  ·  Form B = adjacent strings'
        ):null,
        vType==='rootless'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'No root — plays cleanly over a bass player  ·  Type A = 3-5-7-9  ·  Type B = 7-9-3-5'):null,
        vType==='drop24'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Drop 2+4: wider open sound — voices 2 and 4 from top both dropped  ·  skips one string'):null,
        vType==='drop23'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Drop 2+3: spread voicing — voices 2 and 3 from top both dropped  ·  guide tones on top'):null,
        vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions · scale tones shown faintly'):null
      ),
      // Neck (with dot-mode toggle inside) — hidden when no shape exists so the
      // notice isn't sitting under an empty fretboard that looks broken.
      noDropShape?null:e('div',{style:{border:'1px solid '+BORDER,borderRadius:6,overflow:'hidden',marginBottom:10}},
        e(ScrollNeck,{arpPos,highlight,scalePos,degNames,hlTc,dotMode,dotKeyIdx:key,dataTour:'neck-area'}),
        e('div',{style:{borderTop:'1px solid '+BORDER,padding:'4px 10px',background:BG2}},
          e(DotModeToggle,{dotMode,setDotMode})
        )
      ),
      // Scale panel (diatonic only)
      e(ScalePanel,{degree:deg,chordRoot:rootPC,tones,degNames,
        keyIdx:key,scaleIdx:safeScaleIdx,onScaleChange:setScaleIdx,level}),
      // Drop 2 / Drop 3
      DROP_TYPES.has(vType)?e(DiagSection,{title:DROP_LBL[vType]+' inversions — tap to select'},
        allVoicings.every(v=>!v)?e(NoShapes,null):
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:i===0?'Root pos.':degNames[inv.bassIdx]+' bass',bassLabel:i===0?'bass: '+degNames[inv.bassIdx]:null,
            selected:invIdx===i,onClick:()=>setInvIdx(i),dotMode,dotKeyIdx:key})
        )
      ):null,
      // Shell voicings
      vType==='shell'?e('div',null,
        e(DiagSection,{title:'Form A — skip-string (R-7-3)'},
          shellsA.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:key}))
        ),
        e(DiagSection,{title:'Form B — adjacent strings (R-3-7)'},
          shellsB.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:key}))
        )
      ):null,
      // Rootless voicings
      vType==='rootless'?e('div',null,
        e(DiagSection,{title:'Type A: 3-5-7-9 (3rd on bottom) — tap to select'},
          ROOTLESS.every((c,i)=>c.type!=='A'||!allRootless[i])?e(NoShapes,null):
          ROOTLESS.filter(c=>c.type==='A').map(cfg=>{
            const i=ROOTLESS.indexOf(cfg);
            return e(ChordBox,{key:i,voicing:allRootless[i],strings:cfg.s,tones:rlTones,
              degNames:rlDegNames,invLabel:cfg.lbl+' / '+cfg.strs,
              bassLabel:'bass: '+rlDegNames[cfg.bassIdx],
              selected:safeRlIdx===i,onClick:()=>setRlIdx(i),tcArr:TC_RL,dotMode,dotKeyIdx:key});
          })
        ),
        e(DiagSection,{title:'Type B: 7-9-3-5 (7th on bottom) — tap to select'},
          ROOTLESS.every((c,i)=>c.type!=='B'||!allRootless[i])?e(NoShapes,null):
          ROOTLESS.filter(c=>c.type==='B').map(cfg=>{
            const i=ROOTLESS.indexOf(cfg);
            return e(ChordBox,{key:i,voicing:allRootless[i],strings:cfg.s,tones:rlTones,
              degNames:rlDegNames,invLabel:cfg.lbl+' / '+cfg.strs,
              bassLabel:'bass: '+rlDegNames[cfg.bassIdx],
              selected:safeRlIdx===i,onClick:()=>setRlIdx(i),tcArr:TC_RL,dotMode,dotKeyIdx:key});
          })
        )
      ):null,
      // Legend
      e('div',{style:{marginTop:14,padding:'8px 14px',background:BG2,border:'1px solid '+BORDER,
        borderRadius:6,display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}},
        (isRl?['9th','3rd','5th','7th']:['Root','3rd','5th','7th']).map((l,i)=>
          e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5}},
            e('span',{style:{width:10,height:10,borderRadius:'50%',background:hlTc[i],display:'inline-block',flexShrink:0,boxShadow:'0 0 5px '+hlTc[i]+'88'}}),
            e('span',{style:{color:hlTc[i],fontSize:'0.74rem'}},l)
          )
        ),
        e('span',{style:{display:'flex',alignItems:'center',gap:5,marginLeft:4}},
          e('span',{style:{width:11,height:11,borderRadius:'50%',border:'1px solid var(--leg-circ)',display:'inline-block',flexShrink:0}}),
          e('span',{style:{color:'var(--leg-txt)',fontSize:'0.74rem'}},'Scale tone')
        ),
        e('span',{style:{fontSize:'0.79rem',color:HINT}},'bright=voicing · dim=arpeggio · faint=scale non-chord-tone')
      ),
      // Footnote
      e('div',{style:{marginTop:8,padding:'6px 14px',fontSize:'0.79rem',color:LBL,lineHeight:1.7}},
        e('span',{style:{color:GOLD,fontWeight:700}},'△'),
        ' = major 7th (Δ7 interval).  Shell Form A: skip-string.  Shell Form B: adjacent-string R-3-7.  Drop 2: 2nd-highest note dropped an octave.  Drop 3: 3rd-highest dropped.  Rootless: 9th replaces root.')
    ):null,

    upgradeSheet?e(UpgradeSheet,{feature:upgradeSheet,onClose:()=>setUpgradeSheet(null),onUnlock:doUpgrade,trialUsed,trialActive,onTrial:startTrial}):null,
    aboutOpen?e(AboutSheet,{onClose:()=>setAboutOpen(false),level,onRestore:doRestore}):null,
    popTerm&&GLOSS_DEFS[popTerm]?e(React.Fragment,null,
      e('div',{onClick:()=>setPopTerm(null),style:{position:'fixed',inset:0,zIndex:199,background:'rgba(0,0,0,0.35)'}}),
      e('div',{style:{position:'fixed',bottom:0,left:0,right:0,zIndex:200,background:'var(--bg2)',
        borderRadius:'14px 14px 0 0',border:'1px solid var(--gold)44',
        padding:'18px 20px 32px',boxShadow:'0 -8px 32px rgba(0,0,0,0.55)',
        maxHeight:'60vh',overflowY:'auto'}},
        e('div',{style:{display:'flex',alignItems:'center',marginBottom:10}},
          e('span',{style:{fontWeight:700,color:'var(--gold)',fontSize:'0.92rem',fontFamily:UI_FONT}},GLOSS_DEFS[popTerm].term),
          e('button',{onClick:()=>setPopTerm(null),style:{marginLeft:'auto',background:'transparent',
            border:'none',cursor:'pointer',color:'var(--btn-off)',fontSize:'1.1rem',minHeight:0,padding:'2px 6px'}},'✕')
        ),
        e('p',{style:{fontSize:'0.84rem',lineHeight:1.65,color:'var(--txt)',fontFamily:UI_FONT,
          marginBottom:GLOSS_DEFS[popTerm].detail?10:0,borderBottom:GLOSS_DEFS[popTerm].detail?'1px solid var(--brd)':'none',
          paddingBottom:GLOSS_DEFS[popTerm].detail?10:0}},
          GLOSS_DEFS[popTerm].short),
        GLOSS_DEFS[popTerm].detail?e('p',{style:{fontSize:'0.82rem',lineHeight:1.7,color:'var(--txt)',
          fontFamily:UI_FONT,marginBottom:0,opacity:0.85}},GLOSS_DEFS[popTerm].detail):null
      )
    ):null,

    // ── Streak milestone card ─────────────────────────────────────────
    streakMilestone?e('div',{onClick:()=>setStreakMilestone(null),
      style:{position:'fixed',inset:0,zIndex:210,display:'flex',alignItems:'flex-end',
        justifyContent:'center',paddingBottom:'calc(72px + env(safe-area-inset-bottom))'}},
      e('div',{onClick:ev=>ev.stopPropagation(),
        style:{width:'min(400px,calc(100vw - 32px))',borderRadius:16,overflow:'hidden',
          boxShadow:'0 -8px 40px rgba(0,0,0,0.7)',
          animation:'milestoneUp 5.4s cubic-bezier(.22,.68,0,1.2) both'}},
        e('div',{style:{
          background:`linear-gradient(135deg,#1a1000 0%,#0d0d1e 100%)`,
          border:'1px solid '+GOLD+'80',borderRadius:16,padding:'22px 24px 18px'}},
          e('div',{style:{fontSize:'2.4rem',textAlign:'center',marginBottom:8}},
            streakMilestone===3?'🔥':streakMilestone===7?'⭐':streakMilestone===14?'🌟':streakMilestone===365?'💎':'🏆'),
          e('div',{style:{fontFamily:SERIF,fontSize:'1.6rem',fontWeight:700,color:GOLD,
            textAlign:'center',marginBottom:6}},
            streakMilestone+'-day streak'),
          e('div',{style:{fontSize:'0.84rem',lineHeight:1.65,color:'var(--txt)',fontFamily:UI_FONT,
            textAlign:'center',maxWidth:280,margin:'0 auto'}},
            streakMilestone===3?'Three days in a row — the habit is forming. Most people quit before this.':
            streakMilestone===7?'One full week. That\'s more consistent practice than most guitarists manage. Keep it going.':
            streakMilestone===14?'Two weeks straight. You\'re past the "getting started" phase — this is real progress.':
            streakMilestone===30?'Thirty days. That\'s commitment. Jazz takes time to absorb; you\'re giving it that time.':
            streakMilestone===60?'Sixty days. Two months of daily practice — your ear is catching things it couldn\'t before.':
            streakMilestone===100?'One hundred days. This is exceptional. Most players plateau; you\'re still showing up.':
            streakMilestone===180?'Six months of daily practice. Your hands know things your brain hasn\'t named yet.':
            streakMilestone===365?'Three hundred sixty-five days. One full year. This is rare. You\'re a jazz guitarist.':
            streakMilestone%30===0?streakMilestone+' days and counting. Consistency is the rarest skill there is.':''),
          (streakMilestone===7||streakMilestone===30)&&isEss?e('div',{style:{marginTop:14,paddingTop:12,borderTop:'1px solid '+GOLD+'40'}},
            e('div',{style:{fontSize:'0.77rem',lineHeight:1.55,color:'var(--txt)',fontFamily:UI_FONT,textAlign:'center',marginBottom:8}},
              streakMilestone===7
                ?'A 7-day streak shows real commitment. Pro unlocks jazz standards, advanced voicings, and all ear training modes.'
                :'30 days. You\'ve earned it — Pro unlocks Blue Bossa, Autumn Leaves, Stella, and more. One price, forever.'),
            e('button',{onClick:()=>{setStreakMilestone(null);onUpgrade('Pro');},style:{
              display:'block',margin:'0 auto',padding:'9px 24px',borderRadius:6,cursor:'pointer',
              fontFamily:UI_FONT,fontSize:'0.82rem',fontWeight:700,
              border:'1px solid '+GOLD,background:GOLD,color:'#07070f',minHeight:40}},
              'Unlock Pro — $9.99 once')
          ):null,
          e('div',{style:{fontSize:'0.68rem',color:HINT,fontFamily:UI_FONT,
            textAlign:'center',marginTop:12}},'Tap to dismiss')
        )
      )
    ):null,

    // ── Tour overlay ─────────────────────────────────────────────────
    overviewStep!==null
      ?e(TourOverlay,{steps:tourStepsFor(OVERVIEW_STEPS,level==='pro'),step:overviewStep,onNext:overviewNext,onSkip:overviewSkip})
      :pageTourStep!==null&&pageTourId&&PAGE_TOURS[pageTourId]
        ?e(TourOverlay,{steps:tourStepsFor(PAGE_TOURS[pageTourId],level==='pro'),step:pageTourStep,onNext:pageTourNext,onSkip:pageTourSkip})
        :null,

    // ── Bottom tab bar ───────────────────────────────────────────────
    e('nav',{'data-tour':'bottom-nav',style:{position:'fixed',bottom:0,left:0,right:0,zIndex:50,
      display:'flex',background:BG2,borderTop:'1px solid '+BORDER,
      paddingBottom:'env(safe-area-inset-bottom)',
      boxShadow:'0 -4px 16px rgba(0,0,0,0.35)'}},
      [['guide','⚑','Guide'],['diatonic','◎','Keys'],['custom','♪','Chords'],['iivi','▶','Play'],['quiz','♫','Train']].map(([id,icon,lbl])=>{
        const act=viewMode===id;
        let tabLbl=lbl;
        if(id==='guide'){try{const d=JSON.parse(safeLS('jg-path','{}'));const n=Object.values(d).filter(Boolean).length;if(n>0) tabLbl='Guide·'+n+'✓';}catch(ex){}}
        return e('button',{key:id,'data-tour':'nav-'+id,onClick:()=>{setViewMode(id);if(id!=='guide')window.scrollTo(0,0);},style:{
          flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,
          padding:'7px 0 5px',background:'transparent',border:'none',
          borderTop:'2px solid '+(act?'var(--txt)':'transparent'),
          color:act?'var(--txt)':BTN_OFF,fontFamily:UI_FONT,cursor:'pointer',minHeight:52}},
          id==='diatonic'?e(CircleOfFifthsIcon,null):
          id==='custom'?e(ChordDiagramIcon,null):
          e('span',{style:{fontSize:'1.1rem',lineHeight:1.2}},icon),
          e('span',{style:{fontSize:'0.64rem',letterSpacing:'0.5px',fontWeight:act?700:400}},tabLbl)
        );
      })
    ),
  ));
}

// ── Mount ─────────────────────────────────────────────────────────────
try {
  ReactDOM.createRoot(document.getElementById('root')).render(e(App,null));
} catch(err) {
  const r=document.getElementById('root');
  r.style.cssText='color:#ff6b6b;padding:20px;font-family:monospace;white-space:pre';
  r.textContent='Error: '+err.message+'\n\n'+err.stack;
}

