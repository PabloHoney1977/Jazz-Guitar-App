"use strict";
const e = React.createElement;
const {useState, useMemo, useEffect, useRef} = React;

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
const QSYMS =['maj7','m7','m7','maj7','7','m7','m7b5'];
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
  {id:'maj7', sym:'maj7', label:'Major 7',  iv:[0,4,7,11], dn:['R','3','5','Δ7'],  ctx:'I and IV in major keys — lush, stable home sound'},
  {id:'m7',   sym:'m7',   label:'Minor 7',  iv:[0,3,7,10], dn:['R','b3','5','b7'], ctx:'II, III, VI in major keys — smooth, floating quality'},
  {id:'dom7', sym:'7',    label:'Dom 7',    iv:[0,4,7,10], dn:['R','3','5','b7'],  ctx:'V in any key — tritone tension that pulls to I'},
  {id:'m7b5', sym:'ø7',   label:'Half-Dim', iv:[0,3,6,10], dn:['R','b3','b5','b7'],ctx:'II in minor keys, VII in major — searching and tense'},
  {id:'maj9', sym:'maj9', label:'Major 9',  iv:[0,4,11,2], dn:['R','3','Δ7','9'],  ctx:'Richer I or IV — 9th adds open, luminous color above the Δ7'},
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

// ── Chord-scale data ─────────────────────────────────────────────────
const PARENT_SC={major:[0,2,4,5,7,9,11],melmin:[0,2,3,5,7,9,11]};
const PTYPE_NAME={major:'Major',melmin:'Mel. Minor',dim:'Diminished',wt:'Whole Tone'};
// FIX: index 11 = 11 semitones = major 7th; was 'd7' (diminished 7), now 'Δ7'
const INT_NAMES=['R','b2','2','b3','3','4','#4','5','b6','6','b7','Δ7'];

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
    for(let f=1;f<=15;f++){
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
  return e('div',{style:{display:'flex',alignItems:'center',gap:6,marginBottom:6}},
    e('span',{style:{fontSize:'0.68rem',color:'var(--lbl)',letterSpacing:'0.5px',flexShrink:0}},'● Dots'),
    e('div',{style:{display:'flex',border:'1px solid var(--btn-brd)',borderRadius:14,overflow:'hidden'}},
      opts.map(({id,lbl})=>e('button',{key:id,onClick:()=>setDotMode(id),style:{
        padding:'3px 10px',fontFamily:UI_FONT,fontSize:'0.69rem',border:'none',cursor:'pointer',
        background:dotMode===id?'var(--bg)':'transparent',
        color:dotMode===id?'var(--txt)':'var(--btn-off)',fontWeight:dotMode===id?700:400,minHeight:44
      }},lbl))
    )
  );
}

// ── GuitarToggle ──────────────────────────────────────────────────────
// Styled as a Les Paul pickup-selector: circular cream plate, knurled
// chrome bushing, chrome dome, ivory teardrop tip pivots up (Basic) / down (Full).
function GuitarToggle({level,setLevel}){
  const isBasic=level==='essentials';
  // -28° = tip points upper-left (Essentials); 152° = tip points lower-right (Full).
  // 180° sweep = clearly top vs bottom without going fully horizontal.
  const tipAng=isBasic?-28:152;
  return e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:1,flexShrink:0}},
    e('span',{style:{fontSize:'0.55rem',color:'var(--lbl)',letterSpacing:'2px',fontFamily:UI_FONT,marginBottom:1}},'MODE'),
    e('span',{style:{
      fontSize:'0.6rem',fontFamily:'Georgia,"Times New Roman",serif',
      letterSpacing:'0.4px',userSelect:'none',lineHeight:1.2,
      color:isBasic?'#C084FC':'var(--btn-off)',fontWeight:isBasic?700:400,
    }},'Essentials'),
    e('button',{
      onClick:()=>setLevel(isBasic?'full':'essentials'),
      'aria-label':'Currently '+(isBasic?'Essentials':'Full')+' — tap to switch',
      title:isBasic?'Switch to Full: adds Drop 3, Rootless voicings, Altered scale, extended chord types (9th, sus, altered)':'Switch to Essentials: simplified view for learning the basics',
      style:{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:0},
    },
      e('svg',{width:52,height:52,viewBox:'0 0 52 52',style:{display:'block'}},
        e('defs',null,
          // Cream/ivory plate
          e('radialGradient',{id:'lpPl',cx:'42%',cy:'33%',r:'66%'},
            e('stop',{offset:'0%',stopColor:'#FCF9F0'}),
            e('stop',{offset:'72%',stopColor:'#ECE3C6'}),
            e('stop',{offset:'100%',stopColor:'#D4CA9E'}),
          ),
          // Chrome knurled ring (dark to simulate side lighting)
          e('radialGradient',{id:'lpRg',cx:'38%',cy:'27%',r:'70%'},
            e('stop',{offset:'0%',stopColor:'#DCDCDC'}),
            e('stop',{offset:'38%',stopColor:'#ACACAC'}),
            e('stop',{offset:'68%',stopColor:'#6C6C6C'}),
            e('stop',{offset:'100%',stopColor:'#404040'}),
          ),
          // Chrome dome (bright specular ball)
          e('radialGradient',{id:'lpDm',cx:'32%',cy:'26%',r:'66%'},
            e('stop',{offset:'0%',stopColor:'#F2F2F2'}),
            e('stop',{offset:'20%',stopColor:'#D4D4D4'}),
            e('stop',{offset:'58%',stopColor:'#989898'}),
            e('stop',{offset:'100%',stopColor:'#585858'}),
          ),
          // Ivory teardrop tip
          e('radialGradient',{id:'lpTp',cx:'36%',cy:'22%',r:'70%'},
            e('stop',{offset:'0%',stopColor:'#FFFEFB'}),
            e('stop',{offset:'52%',stopColor:'#EEE6D0'}),
            e('stop',{offset:'100%',stopColor:'#CEC29A'}),
          ),
        ),
        // Soft drop shadow
        e('circle',{cx:26,cy:27.5,r:23,fill:'rgba(0,0,0,0.18)'}),
        // Cream circular plate
        e('circle',{cx:26,cy:26,r:23,fill:'url(#lpPl)',stroke:'#C0B48A',strokeWidth:0.8}),
        // Chrome knurled bushing ring
        e('circle',{cx:26,cy:26,r:13.5,fill:'url(#lpRg)'}),
        // Knurled serration — dashed ring simulates the gear-cut edge
        e('circle',{cx:26,cy:26,r:14,fill:'none',
          stroke:'rgba(12,12,12,0.45)',strokeWidth:2.6,strokeDasharray:'1.65 1.1'}),
        // Inner ring highlight (edge of smooth bore)
        e('circle',{cx:26,cy:26,r:12,fill:'none',
          stroke:'rgba(255,255,255,0.18)',strokeWidth:0.7}),
        // ── Ivory teardrop tip (rotates around dome centre 26,26) ──
        // Base orientation: tip pointing straight up. Tip apex at (26,7),
        // base at y≈19 (merges seamlessly under dome).
        e('g',{style:{
          transform:`rotate(${tipAng}deg)`,
          transformOrigin:'26px 26px',
          transition:'transform 0.18s cubic-bezier(0.4,0,0.2,1)',
        }},
          e('path',{
            d:'M 23,19 C 21.5,13 22.5,8 26,7 C 29.5,8 30.5,13 29,19 Z',
            fill:'url(#lpTp)',
            stroke:'rgba(168,152,112,0.55)',
            strokeWidth:0.5,
          }),
          // Specular highlight — offset to simulate dome-lit cream surface
          e('ellipse',{cx:24.5,cy:11.5,rx:1.4,ry:2.6,
            fill:'rgba(255,255,255,0.46)',
            transform:'rotate(-12,24.5,11.5)'}),
        ),
        // Chrome dome (sits on top, covering base of tip)
        e('circle',{cx:26,cy:26,r:9,fill:'url(#lpDm)'}),
        e('circle',{cx:26,cy:26,r:9,fill:'none',stroke:'rgba(0,0,0,0.2)',strokeWidth:0.5}),
        // Dome specular highlight
        e('circle',{cx:23.5,cy:23.5,r:2.8,fill:'rgba(255,255,255,0.38)'}),
      )
    ),
    e('span',{style:{
      fontSize:'0.6rem',fontFamily:'Georgia,"Times New Roman",serif',
      letterSpacing:'0.4px',userSelect:'none',lineHeight:1.2,
      color:!isBasic?'#C084FC':'var(--btn-off)',fontWeight:!isBasic?700:400,
    }},'Full'),
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
  const min=35,max=150;
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
  return e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:1,cursor:'pointer',flexShrink:0},
    onWheel:handleWheel,onKeyDown:handleKey,tabIndex:0,'aria-label':'BPM '+bpm},
    e('svg',{width:60,height:60,viewBox:'0 0 60 60',style:{display:'block',userSelect:'none',touchAction:'none'},
      onPointerDown:handlePointerDown,onPointerMove:handlePointerMove,onPointerUp:handlePointerUp},
      e('path',{d:arcPath(-135,135,20),fill:'none',stroke:'var(--brd)',strokeWidth:3,strokeLinecap:'round'}),
      e('path',{d:arcPath(-135,angle,20),fill:'none',stroke:GOLD,strokeWidth:3,strokeLinecap:'round'}),
      e('circle',{cx,cy,r:16,fill:'var(--bg2)',stroke:'var(--brd)',strokeWidth:1.5}),
      e('line',{x1:mx,y1:my,x2:mx2,y2:my2,stroke:GOLD,strokeWidth:2.5,strokeLinecap:'round'})
    ),
    e('div',{style:{display:'flex',alignItems:'center',gap:6}},
      e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center'}},
        e('div',{style:{fontSize:'1.0rem',fontWeight:700,color:GOLD,fontFamily:UI_FONT,lineHeight:1}},bpm),
        e('div',{style:{fontSize:'0.6rem',color:'var(--lbl)',letterSpacing:'1px',lineHeight:1}},'BPM')
      ),
      e('button',{onClick:onTap,style:{fontSize:'0.68rem',color:'var(--btn-off)',background:'transparent',
        border:'1px solid var(--btn-brd)',borderRadius:4,padding:'3px 8px',cursor:'pointer',
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

// ── EarTrainingView ───────────────────────────────────────────────────
function EarTrainingView({level}){
  const isEss=level==='essentials';

  // Modes: intervals always visible; triads + 7th chords are Full only
  const [mode,setMode]=useState('intervals');
  // Per-mode scores
  const [scores,setScores]=useState({intervals:{r:0,w:0},triads:{r:0,w:0},chords:{r:0,w:0}});
  // Per-item breakdown: {intervals:{1:{r,w},...}, triads:{major:{r,w},...}, chords:{...}}
  const [detail,setDetail]=useState({intervals:{},triads:{},chords:{}});
  // Round state
  const [current,setCurrent]=useState(null);
  const [revealed,setRevealed]=useState(false);
  const [lastResult,setLastResult]=useState(null);
  const [wrongGuess,setWrongGuess]=useState(null);
  const [choices,setChoices]=useState([]); // random 4-of-12 for intervals mode

  // ── Data ──
  const IVALS=[
    {s:1, name:'Minor 2nd', feel:'Half-step — sharp dissonance'},
    {s:2, name:'Major 2nd', feel:'Whole-step — mild tension'},
    {s:3, name:'Minor 3rd', feel:'Minor quality — dark, introspective'},
    {s:4, name:'Major 3rd', feel:'Major quality — bright, open'},
    {s:5, name:'Perfect 4th',feel:'"Here Comes the Bride" opening'},
    {s:6, name:'Tritone',   feel:'Maximum tension — splits the octave evenly'},
    {s:7, name:'Perfect 5th',feel:'Strong, hollow — "Star Wars" theme opening'},
    {s:8, name:'Minor 6th', feel:'Dark and searching'},
    {s:9, name:'Major 6th', feel:'Warm, bossa-friendly — "My Bonnie Lies Over the Ocean"'},
    {s:10,name:'Minor 7th', feel:'Bluesy pull — dominant chord color'},
    {s:11,name:'Major 7th', feel:'Yearning — pulls toward the octave'},
    {s:12,name:'Octave',    feel:'Same note, one octave up — complete resolution'},
  ];
  const TRIAD_IV={major:[0,4,7],minor:[0,3,7],dim:[0,3,6],aug:[0,4,8]};
  const TRIAD_LBL={major:'Major',minor:'Minor',dim:'Diminished',aug:'Augmented'};
  const TRIAD_DESC={
    major:'bright, stable — I, IV, V of a major key',
    minor:'dark, smooth — II, III, VI of a major key',
    dim:'tense, unstable — VII degree; two minor thirds stacked',
    aug:'eerie, whole-tone color — major third + major third'
  };
  const TRIAD_LIST=['major','minor','dim','aug'];
  const QUALITIES=['maj7','m7','dom7','m7b5'];
  const QLABELS={'maj7':'Major 7','m7':'Minor 7','dom7':'Dom 7','m7b5':'Half-Dim'};
  const QDESCS={
    maj7:'lush, stable — the I and IV chord',
    m7:'smooth, floating — the II and VI chord',
    dom7:'tense, pulling — the V chord',
    m7b5:'searching, unstable — the VII and minor II chord'
  };

  // ── Play functions ──
  function playInterval(root,sem){
    try{
      const ctx=_getPreviewCtx();if(!ctx)return;
      const m1=52+root,m2=m1+sem;
      if(_guitarBufs){_playSampledNote(ctx,m1,ctx.currentTime+0.05,0.65,2.5);_playSampledNote(ctx,m2,ctx.currentTime+0.62,0.65,2.5);}
      else{_playKSNote(ctx,m1,ctx.currentTime+0.05,0.55);_playKSNote(ctx,m2,ctx.currentTime+0.62,0.55);}
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
  function replayCurrent(){
    if(!current) return;
    if(mode==='intervals') playInterval(current.root,current.semitones);
    else if(mode==='triads') playTriad(current.root,current.quality);
    else playChord(current.root,current.quality);
  }

  // ── Round logic ──
  function newRound(){
    const root=Math.floor(Math.random()*12);
    setRevealed(false);setLastResult(null);setWrongGuess(null);
    if(mode==='intervals'){
      const correct=IVALS[Math.floor(Math.random()*IVALS.length)];
      const others=IVALS.filter(x=>x.s!==correct.s).sort(()=>Math.random()-0.5).slice(0,3);
      setChoices([correct,...others].sort(()=>Math.random()-0.5));
      setCurrent({root,semitones:correct.s});
      setTimeout(()=>playInterval(root,correct.s),150);
    } else if(mode==='triads'){
      const quality=TRIAD_LIST[Math.floor(Math.random()*4)];
      setCurrent({root,quality});
      setTimeout(()=>playTriad(root,quality),150);
    } else {
      const quality=QUALITIES[Math.floor(Math.random()*4)];
      setCurrent({root,quality});
      setTimeout(()=>playChord(root,quality),150);
    }
  }
  function guess(answer){
    if(revealed||!current) return;
    const correct=mode==='intervals'?(answer===current.semitones):(answer===current.quality);
    const key=mode==='intervals'?current.semitones:current.quality;
    setRevealed(true);setLastResult(correct?'right':'wrong');
    if(!correct) setWrongGuess(answer);
    setScores(s=>({...s,[mode]:{r:s[mode].r+(correct?1:0),w:s[mode].w+(correct?0:1)}}));
    setDetail(d=>{const m={...d[mode]},e={...m[key]||{r:0,w:0}};
      e[correct?'r':'w']++;m[key]=e;return{...d,[mode]:m};});
  }
  useEffect(()=>{newRound();},[mode]);
  if(!current) return null;

  const sc=scores[mode];
  const total=sc.r+sc.w;
  const pct=total>0?Math.round(100*sc.r/total):0;
  // Find the weakest item (min r/(r+w) with at least 2 attempts)
  const weakest=(()=>{
    const dm=detail[mode];
    let worst=null,worstRate=1;
    Object.entries(dm).forEach(([k,v])=>{
      const t=v.r+v.w;if(t<2) return;
      const rate=v.r/t;if(rate<worstRate){worstRate=rate;worst={k,r:v.r,w:v.w};}
    });
    if(!worst) return null;
    const label=mode==='intervals'
      ?(IVALS.find(x=>x.s===+worst.k)||{name:worst.k}).name
      :mode==='triads'?(TRIAD_LBL[worst.k]||worst.k):(QLABELS[worst.k]||worst.k);
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
    } else {
      answerName=QLABELS[current.quality];answerDesc=QDESCS[current.quality];
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

  const modeHint={
    intervals:'Two notes played ascending — name the interval',
    triads:'Three-note chord — major, minor, diminished, or augmented?',
    chords:'Four-note chord — identify the 7th chord quality'
  };
  const TABS=isEss
    ?[{id:'intervals',lbl:'Intervals'}]
    :[{id:'intervals',lbl:'Intervals'},{id:'triads',lbl:'Triads'},{id:'chords',lbl:'7th Chords'}];

  return e('div',{style:{padding:'0 0 20px'}},
    e('div',{style:{textAlign:'center',marginBottom:12}},
      e('div',{style:{fontFamily:SERIF,fontSize:'1.2rem',fontWeight:700,color:'var(--scale-name)',marginBottom:4}},'Ear Training'),
      total>0?e('div',null,
        e('div',{style:{fontSize:'0.95rem',fontWeight:700,color:pct>=70?GOLD:'#FF6B6B'}},pct+'% — '+sc.r+'/'+total),
        weakest?e('div',{style:{fontSize:'0.7rem',color:HINT,marginTop:3}},
          '⚠ Weakest: '+weakest.label+' ('+weakest.missed+'/'+weakest.total+' missed)'):null
      ):null
    ),
    TABS.length>1?e('div',{style:{display:'flex',gap:2,marginBottom:0}},
      TABS.map(({id,lbl})=>e('button',{key:id,onClick:()=>setMode(id),style:{
        padding:'7px 16px',borderRadius:'6px 6px 0 0',cursor:'pointer',
        fontFamily:UI_FONT,fontSize:'0.79rem',fontWeight:mode===id?700:400,
        border:'1px solid '+BTN_BRD,borderBottom:mode===id?'1px solid '+BG2:'1px solid '+BTN_BRD,
        background:mode===id?BG2:'transparent',color:mode===id?'var(--txt)':BTN_OFF,
        marginBottom:mode===id?'-1px':0,position:'relative',zIndex:mode===id?1:0,minHeight:44
      }},lbl))
    ):null,
    e('div',{style:{background:BG2,border:'1px solid '+BTN_BRD,
      borderRadius:TABS.length>1?'0 6px 6px 6px':8,padding:'16px',marginBottom:12}},
      e('div',{style:{fontSize:'0.74rem',color:HINT,textAlign:'center',marginBottom:14,letterSpacing:'0.3px'}},
        modeHint[mode]),
      e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:8,marginBottom:16}},
        e('button',{onClick:replayCurrent,style:{
          width:72,height:72,borderRadius:'50%',border:'2px solid '+GOLD,
          background:ACT_YEL,color:GOLD,fontSize:'2rem',cursor:'pointer',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 0 16px '+GOLD+'44',transition:'box-shadow 0.15s'
        }},'♪'),
        e('div',{style:{fontSize:'0.72rem',color:HINT}},'Tap to replay')
      ),
      renderReveal(),
      e('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:revealed?12:0}},
        renderChoices()
      ),
      revealed?e('button',{onClick:newRound,style:{
        width:'100%',padding:'12px',background:GOLD,border:'none',borderRadius:8,
        color:'#07070f',fontFamily:UI_FONT,fontSize:'0.95rem',fontWeight:'bold',
        cursor:'pointer',minHeight:48
      }},'Next →'):null
    ),
    e('button',{onClick:()=>{setScores(s=>({...s,[mode]:{r:0,w:0}}));setDetail(d=>({...d,[mode]:{}}));},style:{
      width:'100%',padding:'6px',background:'transparent',
      border:'1px solid '+BTN_BRD,borderRadius:6,color:BTN_OFF,
      fontFamily:UI_FONT,fontSize:'0.78rem',cursor:'pointer',minHeight:44
    }},'Reset score')
  );
}

// ── Tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS=[
  {target:'key-chip',    view:'diatonic', title:'Set your key',            text:'Tap to open the key picker. Every chord and scale in the app updates to match the key you choose.'},
  {target:'level-switch',view:'diatonic', title:'Essentials or Full',      text:'This toggle controls how much of the app you see. Essentials keeps things simple — the right starting point. Flip to Full later when you\'re ready for more advanced chord types and techniques.'},
  {target:'chord-row',   view:'diatonic', title:'The chords in a key',     text:'Each button is one of the seven chords that naturally occur in the key. The number (I through VII) is its position in the key — you\'ll learn what that means in the Guide.'},
  {target:'voicing-tabs',view:'diatonic', title:'How to play each chord',  text:'These tabs show different ways to arrange the same chord on the guitar — different string sets, different note on the bottom. Start with Shell, which uses just three strings.'},
  {target:'neck-area',   view:'diatonic', title:'The fretboard',           text:'The colored dots show where to put your fingers for the selected chord shape. Dimmer dots show every other place those same notes appear on the neck.'},
  {target:'bottom-nav',  view:null,       title:'Where to start',          text:'We recommend starting with the ⚑ Guide — it walks you through jazz harmony from the ground up and opens the right tool at each step. Tap it now to begin.'},
];
function TourOverlay({step,onNext,onSkip}){
  const [rect,setRect]=useState(null);
  const s=TOUR_STEPS[step];
  useEffect(()=>{
    if(!s){setRect(null);return;}
    function measure(){
      const el=document.querySelector('[data-tour="'+s.target+'"]');
      if(el){const r=el.getBoundingClientRect();setRect({top:r.top,left:r.left,w:r.width,h:r.height});}
      else setRect(null);
    }
    measure();
    // Re-measure after a frame in case the layout shifted
    const id=requestAnimationFrame(measure);
    return ()=>cancelAnimationFrame(id);
  },[step,s&&s.target]);

  if(!s) return null;
  const isLast=step>=TOUR_STEPS.length-1;
  const PAD=8;
  const DIM='rgba(0,0,0,0.75)';

  // Spotlight: 4 dark panels leaving target exposed
  const overlay=rect?[
    e('div',{key:'ot',style:{position:'absolute',top:0,left:0,right:0,
      height:Math.max(0,rect.top-PAD),background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ob',style:{position:'absolute',left:0,right:0,bottom:0,
      top:rect.top+rect.h+PAD,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ol',style:{position:'absolute',top:rect.top-PAD,
      left:0,width:Math.max(0,rect.left-PAD),
      height:rect.h+PAD*2,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'or',style:{position:'absolute',top:rect.top-PAD,
      left:rect.left+rect.w+PAD,right:0,
      height:rect.h+PAD*2,background:DIM,pointerEvents:'auto'}}),
    e('div',{key:'ring',style:{position:'absolute',
      top:rect.top-PAD,left:rect.left-PAD,
      width:rect.w+PAD*2,height:rect.h+PAD*2,
      border:'2px solid #d4a855',borderRadius:8,
      boxShadow:'0 0 12px #d4a85566',pointerEvents:'none'}}),
  ]:e('div',{style:{position:'absolute',inset:0,background:DIM,pointerEvents:'auto'}});

  // Tooltip: place below target if it fits, else above; clamp horizontally
  let tipTop=null,tipBottom=null;
  if(rect){
    const vp=window.innerHeight||600;
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
        (step+1)+' / '+TOUR_STEPS.length),
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
  const FW=44,SH=30,PL=38,PT=28,PB=28,NF=15;
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

  return e('svg',{width:'100%',viewBox:`0 0 ${W} ${H}`,style:{display:'block'}},
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
      return e('g',{key:'ap'+i},
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
      return e('g',{key:'hi'+i,filter:'url(#ng)'},
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
  groups.forEach((g,gi)=>{if(gi<4) g.strings.forEach(s=>{map[s]=gi+1;});});
  return map;
}
const ChordBox=React.memo(function ChordBox({voicing,strings,tones,degNames,invLabel,bassLabel,selected,onClick,tcArr,dotMode,dotKeyIdx}){
  const tc=tcArr||TC;
  dotMode=dotMode||'interval';
  dotKeyIdx=dotKeyIdx===undefined?0:dotKeyIdx;
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
  return e('div',{onClick:()=>{playChordPreview(voicing,strings);if(onClick)onClick();},style:{cursor:'pointer',flexShrink:0}},
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

// Shown when every shape in a section failed the playability check
function NoShapes(){
  return e('span',{style:{fontSize:'0.75rem',color:HINT,fontFamily:UI_FONT,padding:'8px 0'}},
    'No playable shape here — this voicing needs a stretch wider than a hand allows. Try another string set.');
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
  major:{lbl:'II–V–I',col:'var(--gold)',bg:'var(--act-gold)',
    chords:[[2,'m7','m7','II'],[7,'dom7','7','V'],[0,'maj7','maj7','I']],
    bars:[0,1,2,2],
    tip:'Major II–V–I: keep common tones, move others by step. Classic: IIm7 (7 bass) → V7 (5 bass) → Imaj7 root pos, all on the same string set.'},
  minor:{lbl:'MINOR II–V–I',col:'#C084FC',bg:ACT_PUR,
    chords:[[2,'m7b5','ø7','II'],[7,'dom7','7','V'],[0,'m7','m7','I']],
    bars:[0,1,2,2],
    tip:'Minor II–V–I: the ♭5 of IIø resolves up a half-step to the 5th of Im7. Classic path: IIø (7 bass) → V7 (5 bass) → Im7 root pos.'},
  turn:{lbl:'I–VI–II–V',col:'#FFD43B',bg:ACT_YEL,
    chords:[[0,'maj7','maj7','I'],[9,'dom7','7','VI'],[2,'m7','m7','II'],[7,'dom7','7','V']],
    bars:[0,1,2,3],
    tip:'The turnaround: one chord per bar, loop it forever — it ends countless standards and is the engine of rhythm changes. The VI is played dominant (VI7) so it pulls harder into the IIm7.'},
  blues:{lbl:'JAZZ BLUES',col:'#74C0FC',bg:ACT_BLUE,
    chords:[[0,'dom7','7','I'],[5,'dom7','7','IV'],[9,'dom7','7','VI'],[2,'m7','m7','II'],[7,'dom7','7','V']],
    bars:[0,1,0,0, 1,1,0,2, 3,4,0,4],
    tip:'Jazz blues = the 12-bar you know plus three moves: bar 8 picks up a VI7, bars 9–10 swap the old V–IV for a IIm7–V7, and bar 12 turns around on V7. Spot the II–V–I hiding in bars 9–11.'},
  autumn:{lbl:'AUTUMN LEAVES',col:'#F4A261',bg:ACT_GOLD,
    chords:[[2,'m7','m7','IIm7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],[5,'maj7','maj7','IVmaj7'],
            [11,'m7b5','ø7','VIIø7'],[4,'dom7','7','III7'],[9,'m7','m7','VIm7']],
    bars:[0,1,2,3,4,5,6,6,0,1,2,3,4,5,6,6,4,5,6,6,0,1,2,2,0,1,2,3,4,5,6,6],
    tip:'Autumn Leaves — AABA, 32 bars (key of G major / E minor). A: IIm7→V7→Imaj7→IVmaj7→VIIø7→III7→VIm7. B: minor II–V–I then major II–V–I. Root motion descends in 4ths. Set key to G.'},
  minblues:{lbl:'MINOR BLUES',col:'#FF6B6B',bg:ACT_RED,
    chords:[[0,'m7','m7','Im7'],[5,'m7','m7','IVm7'],[2,'m7b5','ø7','IIø7'],[7,'dom7','7','V7']],
    bars:[0,0,0,0, 1,1,0,0, 2,3,0,3],
    tip:'Minor blues: Im7 replaces I7 throughout; bars 9–10 become IIø7–V7 — the minor II–V you already know. The V7 creates stronger pull back to Im7 than in major blues.'},
  attya:{lbl:'ALL THINGS',col:'#7BC8A4',bg:'#081a10',
    chords:[[9,'m7','m7','VIm7'],[2,'m7','m7','IIm7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],
            [5,'maj7','maj7','IVmaj7'],[11,'dom7','7','VII7'],[4,'maj7','maj7','IIImaj7']],
    bars:[0,1,2,3,4,5,6,6],
    tip:'"All The Things You Are" A section: two II–V–I cycles descending by 4ths — Bbm7–Eb7–Abmaj7 (in Ab), then Dbmaj7–G7–Cmaj7 (in C). This root motion descending in 4ths is the fundamental bass motion of jazz harmony. Set key to Ab.'},
  twnbay:{lbl:'ANOTHER YOU',col:'#F472B6',bg:'#1a0812',
    chords:[[0,'maj7','maj7','Imaj7'],[7,'m7','m7','Vm7'],[0,'dom7','7','I7'],[5,'maj7','maj7','IVmaj7'],
            [5,'m7','m7','IVm7'],[10,'dom7','7','bVII7'],[9,'m7','m7','VIm7'],[2,'dom7','7','II7'],
            [2,'m7','m7','IIm7'],[7,'dom7','7','V7']],
    bars:[0,1,2,3,4,5,0,6,7,8,9,0],
    tip:'"There Will Never Be Another You" A section (Eb): cadence to IVmaj7 via Vm7–I7 (Bbm7–Eb7–Abmaj7), then backdoor II–V home (IVm7–bVII7–I). Closes with I–VIm7–II7–IIm7–V7. Set key to Eb.'},
  tritone:{lbl:'TRITONE SUB',col:'#FF6B6B',bg:ACT_RED,
    chords:[[2,'m7','m7','IIm7'],[7,'dom7','7','V7'],[0,'maj7','maj7','Imaj7'],[1,'dom7','7','♭II7']],
    bars:[0,1,2,2,0,3,2,2],
    tip:'Bars 1–4: standard IIm7–V7–Imaj7. Bars 5–8: the V7 is replaced by ♭II7 — a dominant 7 a tritone away. G7 and D♭7 share the same tritone (B/C♭ and F), so both resolve identically to Cmaj7. Listen for the chromatic bass motion D♭→C vs. the 4th-down G→C. Set key to C.'},
  secdom:{lbl:'SEC. DOM.',col:'#F4A261',bg:ACT_GOLD,
    chords:[[0,'maj7','maj7','Imaj7'],[4,'dom7','7','V/vi'],[9,'m7','m7','VIm7'],[2,'dom7','7','V/ii'],[2,'m7','m7','IIm7'],[7,'dom7','7','V7']],
    bars:[0,1,2,2,3,4,5,0],
    tip:'Secondary dominants: E7 (V7/vi) temporarily acts as V of Am7; D7 (V7/ii) acts as V of Dm7 — each creates a mini II–V pull before the main II–V–I. Any chord in the key can be preceded by its own V7. Set key to C.'},
  custom:{lbl:'CUSTOM',col:'#9CA3AF',bg:'transparent',chords:[],bars:[],tip:''},
};

// Scale suggestions per chord quality (shown on neck when user picks a scale)
const SCALE_HINTS={
  maj7:[{name:'Ionian',   iv:[0,2,4,5,7,9,11],note:'Home — R 3 5 Δ7 all inside key'},
        {name:'Lydian',   iv:[0,2,4,6,7,9,11],note:'#11 replaces 4 — bright, lifted feel'}],
  m7:  [{name:'Dorian',   iv:[0,2,3,5,7,9,10],note:'Standard — b3 b7 match chord; nat.6 adds color'},
        {name:'Aeolian',  iv:[0,2,3,5,7,8,10],note:'Natural minor — b6 darkens vs Dorian'}],
  dom7:[{name:'Mixolydian',iv:[0,2,4,5,7,9,10],note:'Standard — R 3 5 b7 all inside; nat. tensions'},
        {name:'Altered',   iv:[0,1,3,4,6,8,10],note:'b9 #9 b5 #5 all altered — max tension into I'},
        {name:'Lyd. Dom.', iv:[0,2,4,6,7,9,10],note:'#11 with b7 — bright; no avoid notes'}],
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
function LedToggle({label,enabled,onToggle,color}){
  return e('button',{onClick:onToggle,style:{
    display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
    gap:5,padding:'6px 12px',borderRadius:8,cursor:'pointer',minWidth:54,minHeight:52,
    border:'1px solid '+(enabled?color+'66':BTN_BRD),
    background:enabled?color+'18':BG2,
    transition:'border-color 0.15s,background 0.15s',fontFamily:UI_FONT
  }},
    e('div',{style:{
      width:9,height:9,borderRadius:'50%',flexShrink:0,
      background:enabled?color:'rgba(255,255,255,0.07)',
      boxShadow:enabled?`0 0 8px ${color},0 0 3px ${color}`:'inset 0 1px 2px rgba(0,0,0,0.5)',
      border:`1px solid ${enabled?color+'aa':'rgba(255,255,255,0.1)'}`,
      transition:'background 0.15s,box-shadow 0.15s'
    }}),
    e('span',{style:{
      fontSize:'0.62rem',letterSpacing:'0.8px',fontWeight:enabled?700:400,
      color:enabled?color:BTN_OFF,transition:'color 0.15s'
    }},label)
  );
}

function IIVIView({keyIdx,dotMode,setDotMode,level,onPlayStateChange}){
  dotMode=dotMode||'interval';
  const [strSetIdx,setStrSetIdx]=useState(()=>parseInt(localStorage.getItem('jg-strSet')||'2',10));
  const [invIdxs,setInvIdxs]=useState([]);
  const [activeChordIdx,setActiveChordIdx]=useState(0);
  const [isPlaying,setIsPlaying]=useState(false);
  const [bpm,setBpm]=useState(()=>Math.max(35,Math.min(150,parseInt(localStorage.getItem('jg-bpm')||'80',10))));
  const [bassEnabled,setBassEnabled]=useState(()=>localStorage.getItem('jg-bass')!=='false');
  const [metronomeEnabled,setMetronomeEnabled]=useState(()=>localStorage.getItem('jg-met')==='true');
  const [form,setForm]=useState(()=>{
    const f=localStorage.getItem('jg-form');
    if(f&&FORM_DEFS[f]) return f;
    return localStorage.getItem('jg-minor')==='true'?'minor':'major';
  });
  const [playingChordIdx,setPlayingChordIdx]=useState(null);
  const [playingBar,setPlayingBar]=useState(null);
  const [scaleHint,setScaleHint]=useState(null); // name of active scale suggestion
  const [countIn,setCountIn]=useState(0); // 0=off, 1-4=counting
  const [loopCount,setLoopCount]=useState(0);
  const [rideEnabled,setRideEnabled]=useState(()=>localStorage.getItem('jg-ride')!=='false');
  const [showGTLine,setShowGTLine]=useState(false);
  const [showTip,setShowTip]=useState(false);
  const [eqGains,setEqGains]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('jg-eq')||'null')||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showEq,setShowEq]=useState(false);
  const [guitarEnabled,setGuitarEnabled]=useState(()=>localStorage.getItem('jg-guitar')!=='false');
  const [guitarEqGains,setGuitarEqGains]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('jg-geq')||'null')||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showGuitarEq,setShowGuitarEq]=useState(false);
  const [rideEqGains,setRideEqGains]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('jg-req')||'null')||[0,0,0,0,0];}
    catch{return [0,0,0,0,0];}
  });
  const [showRideEq,setShowRideEq]=useState(false);
  const [bassVolume,setBassVolume]=useState(()=>parseInt(localStorage.getItem('jg-bvol')||'80',10));
  const [guitarVolume,setGuitarVolume]=useState(()=>parseInt(localStorage.getItem('jg-cvol')||'80',10));
  const [rideVolume,setRideVolume]=useState(()=>parseInt(localStorage.getItem('jg-rvol')||'80',10));
  const [pinnedChords,setPinnedChords]=useState(()=>new Set());
  const [barVTypes,setBarVTypes]=useState(()=>[]);
  const [vType,setVType]=useState(()=>localStorage.getItem('jg-vtype')||'drop2');
  const [customProg,setCustomProg]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('jg-cprog')||'null')||DFLT_CPROG;}
    catch(ex){return DFLT_CPROG;}
  });
  const [editingBar,setEditingBar]=useState(-1);
  const [savedFaves,setSavedFaves]=useState(()=>{
    try{return JSON.parse(localStorage.getItem('jg-faves')||'null')||[];}
    catch{return [];}
  });

  // If user switches back to Basic while a non-major form is active, reset to major
  useEffect(()=>{if(level==='essentials'&&form!=='major'&&form!=='minor'){setForm('major');setIsPlaying(false);}},[level]);

  const audioCtxRef=useRef(null);
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
  bpmRef.current=bpm;
  bassRef.current=bassEnabled;
  metronomeRef.current=metronomeEnabled;

  useEffect(()=>{localStorage.setItem('jg-strSet',strSetIdx);},[strSetIdx]);
  useEffect(()=>{localStorage.setItem('jg-bpm',bpm);},[bpm]);
  useEffect(()=>{localStorage.setItem('jg-bass',bassEnabled);},[bassEnabled]);
  useEffect(()=>{localStorage.setItem('jg-met',metronomeEnabled);},[metronomeEnabled]);
  useEffect(()=>{localStorage.setItem('jg-ride',rideEnabled);},[rideEnabled]);
  useEffect(()=>{localStorage.setItem('jg-eq',JSON.stringify(eqGains));},[eqGains]);
  useEffect(()=>{onPlayStateChange?.(isPlaying);},[isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{localStorage.setItem('jg-guitar',guitarEnabled);},[guitarEnabled]);
  useEffect(()=>{localStorage.setItem('jg-geq',JSON.stringify(guitarEqGains));},[guitarEqGains]);
  useEffect(()=>{localStorage.setItem('jg-req',JSON.stringify(rideEqGains));},[rideEqGains]);
  useEffect(()=>{localStorage.setItem('jg-bvol',bassVolume);},[bassVolume]);
  useEffect(()=>{localStorage.setItem('jg-cvol',guitarVolume);},[guitarVolume]);
  useEffect(()=>{localStorage.setItem('jg-rvol',rideVolume);},[rideVolume]);
  useEffect(()=>{localStorage.setItem('jg-form',form);},[form]);
  useEffect(()=>{localStorage.setItem('jg-cprog',JSON.stringify(customProg));},[customProg]);
  useEffect(()=>{localStorage.setItem('jg-vtype',vType);},[vType]);
  useEffect(()=>{localStorage.setItem('jg-faves',JSON.stringify(savedFaves));},[savedFaves]);
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
    makeRideBufAsync(44100,1,true).then(b=>{preRideRef.current.accent=b;}).catch(()=>{});
    makeRideBufAsync(44100,1,false).then(b=>{preRideRef.current.norm=b;}).catch(()=>{});
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
        return{rootPC:root,quality:q,tones,dnames:DNAMES[q],name:nn(root,0)+qt.sym,roman:qt.sym};
      });
  const bars=def?def.bars:customProg.map((_,i)=>i);
  chordsRef.current=chords;
  barsRef.current=bars;

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
    const vx=bt==='shell'
      ?SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1))
      :bD.inv.map(inv=>calcVoicing(bD.sets[bsIdx].s,inv.a,chord.tones));
    const maxI=vx.length-1;
    const v=vx[Math.min(invIdxs[barIdx]||0,maxI)];
    return v?[...v.midis].sort((a,b)=>a-b):[];
  });

  const arpPos=useMemo(()=>getArpPos(ac.tones),[activeChordIdx,keyIdx,form,customProg]);
  // Effective voicing type/strSet for the currently selected bar
  const barVT=barVTypes[safeBarIdx]||null;
  const activeVT=barVT?barVT.vType:vType;
  const activeVTSI=barVT?Math.min(barVT.strSetIdx,(DROP_DATA[barVT.vType]||DROP_DATA.drop2).sets.length-1):ssIdx;
  const activeDropD=DROP_DATA[activeVT]||DROP_DATA.drop2;
  const activeSS=activeVT==='shell'?null:activeDropD.sets[activeVTSI].s;
  const activeVoicings=useMemo(()=>{
    if(activeVT==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,ac.tones,1));
    return activeDropD.inv.map(inv=>calcVoicing(activeSS,inv.a,ac.tones));
  },[activeChordIdx,strSetIdx,keyIdx,form,customProg,vType,barVTypes]);
  // Auto-select the most common (first) scale when chord quality changes, unless user has overridden
  useEffect(()=>{
    const opts=SCALE_HINTS[ac.quality]||[];
    if(!opts.length){setScaleHint(null);return;}
    if(!scaleHint||!opts.find(s=>s.name===scaleHint)) setScaleHint(opts[0].name);
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
    const strSet=activeVT==='shell'?SHELLS[selIdx].s:activeSS;
    return v.frets.map((f,i)=>{
      const si=strSet[i],ti=ac.tones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?ac.dnames[ti]:''};
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
    const gain=ctx.createGain();
    const v=vol*(guitarVolRef.current/100);
    gain.gain.setValueAtTime(0.001,startTime);
    gain.gain.linearRampToValueAtTime(v,startTime+0.01);
    gain.gain.exponentialRampToValueAtTime(v*0.45,startTime+0.35);
    gain.gain.exponentialRampToValueAtTime(0.001,startTime+sustainSecs);
    src.connect(eq[0]);eq.reduce((a,b)=>{a.connect(b);return b;});eq[4].connect(gain);gain.connect(ctx.destination);
    src.start(startTime);src.stop(startTime+sustainSecs+0.05);
  }

  function playGuitarChord(ctx,midiNotes,startTime,sustainSecs,vol){
    if(!midiNotes||midiNotes.length===0) return;
    midiNotes.forEach(midi=>{
      playGuitarNote(ctx,midi,startTime,sustainSecs,vol);
    });
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
      const lowShelf=ctx.createBiquadFilter();
      lowShelf.type='lowshelf';lowShelf.frequency.value=80;lowShelf.gain.value=11;
      const midCut=ctx.createBiquadFilter();
      midCut.type='peaking';midCut.frequency.value=650;midCut.Q.value=0.9;midCut.gain.value=-11;
      const hiShelf=ctx.createBiquadFilter();
      hiShelf.type='highshelf';hiShelf.frequency.value=3000;hiShelf.gain.value=-9;
      const eqG=eqRef.current;
      const eq=EQ_FREQS.map((fr,i)=>{const f=ctx.createBiquadFilter();f.type=EQ_TYPES[i];f.frequency.value=fr;f.Q.value=1.2;f.gain.value=eqG[i]||0;return f;});
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(0.001,startTime);
      gain.gain.exponentialRampToValueAtTime(vol,startTime+0.004);
      gain.gain.exponentialRampToValueAtTime(vol*0.85,startTime+0.055);
      gain.gain.exponentialRampToValueAtTime(0.001,startTime+beatDur*1.65);
      src.connect(lowShelf);lowShelf.connect(midCut);midCut.connect(hiShelf);
      hiShelf.connect(eq[0]);eq.reduce((a,b)=>{a.connect(b);return b;});eq[4].connect(gain);
      gain.connect(ctx.destination);
      src.start(startTime);src.stop(startTime+beatDur+0.1);
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
    src.connect(gain);gain.connect(ctx.destination);
    src.start(startTime);src.stop(startTime+beatDur);
  }

  function tick(gen,ctx){
    if(!audioCtxRef.current) return;
    const beatDur=60/bpmRef.current;
    while(nextTimeRef.current < audioCtxRef.current.currentTime+0.12){
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
      }
      const delay=Math.max(0,(nextTimeRef.current-audioCtxRef.current.currentTime)*1000);
      setTimeout(()=>{if(genRef.current===gen){setPlayingChordIdx(ci);setPlayingBar(bar);setActiveChordIdx(bar);}},delay);
      // Assign rhythm pattern per bar (chosen once, persists per loop iteration)
      if(beat%4===0&&!barPatternRef.current[bar]){
        barPatternRef.current[bar]={comp:Math.floor(Math.random()*4),ride:Math.floor(Math.random()*3),bass:Math.floor(Math.random()*5)};
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
          const sustLong=Math.min(beatDur*1.7,1.5);
          const sustStab=Math.min(beatDur*0.65,0.6);
          const top3=midi.slice(-Math.min(3,midi.length));
          if(barPat.comp===0){
            // Standard bop: 1, 2-stab, 3, 4-and anticipation
            if(b===0) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.30);
            else if(b===1) playGuitarChord(ctx,top3,nextTimeRef.current,sustStab,0.17);
            else if(b===2) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.24);
            else playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.21);
          } else if(barPat.comp===1){
            // Freddie Green 4-to-bar: all 4 beats, short punchy
            playGuitarChord(ctx,top3,nextTimeRef.current,sustStab,b===0?0.28:0.20);
          } else if(barPat.comp===2){
            // Sparse: beat 2 stab + 4-and anticipation only
            if(b===1) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.26);
            else if(b===3) playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.22);
          } else {
            // Two-beat: beats 1 and 3 full, beat 2-and stab
            if(b===0) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.28);
            else if(b===1) playGuitarChord(ctx,top3,nextTimeRef.current+beatDur*(2/3),sustStab,0.16);
            else if(b===2) playGuitarChord(ctx,midi,nextTimeRef.current,sustLong,0.22);
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
    if(countIn>0) return; // prevent double-start
    setEditingBar(-1);
    const beatDur=60/bpmRef.current;
    setCountIn(4);
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ctx;
    ksBufsRef.current=precomputeKS(ctx);
    clickBufsRef.current={accent:makeClickBuf(ctx,1400,1.0),normal:makeClickBuf(ctx,900,0.65)};
    clickBufsRef.current.rideAccent=preRideRef.current.accent||makeRideBuf(ctx,1,true);
    clickBufsRef.current.rideNorm=preRideRef.current.norm||makeRideBuf(ctx,1,false);
    if(bassRef.current) decodeBassRaw(ctx);
    if(guitarEnabledRef.current) decodeGuitarRaw(ctx);
    // Schedule 4 count-in clicks, then begin real playback
    for(let i=0;i<4;i++){
      const t=ctx.currentTime+0.05+i*beatDur;
      playClick(ctx,i===0?clickBufsRef.current.accent:clickBufsRef.current.normal,t);
      const delay=Math.max(0,(t-ctx.currentTime)*1000);
      setTimeout(()=>{setCountIn(3-i);},delay);
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
      barPatternRef.current={};
      setLoopCount(0);
      const gen=++genRef.current;
      setIsPlaying(true);
      tick(gen,ctx);
    },startDelay);
  }

  function stopPlayback(){
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}
    setIsPlaying(false);setPlayingChordIdx(null);setPlayingBar(null);
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
      setBpm(Math.max(35,Math.min(150,Math.round(60000/avg))));
    }
  }

  // cleanup on unmount
  useEffect(()=>()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current)audioCtxRef.current.close();
  },[]);

  // stop when key or mode changes
  useEffect(()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}
    setIsPlaying(false);setPlayingChordIdx(null);setPlayingBar(null);
    setActiveChordIdx(0);
  },[keyIdx,form]);

  function computeAllVoicings(cs,brs,bvts){
    return brs.map((ci,barIdx)=>{
      const chord=cs[ci];
      const bvt=(bvts&&bvts[barIdx])||null;
      const bt=bvt?bvt.vType:vType;
      const bsi=bvt?bvt.strSetIdx:strSetIdx;
      if(bt==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,chord.tones,1));
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
    const cs=chordsRef.current,brs=barsRef.current;
    if(!cs||!brs||brs.length<2) return;
    setBarVTypes([]);
    const av=computeAllVoicings(cs,brs,[]);
    setInvIdxs(runVL(av,av.map(()=>0),null));
    setPinnedChords(new Set());
    setActiveChordIdx(0);
  },[form,keyIdx,customProg]);
  useEffect(()=>{
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
    width:64,height:52,borderRadius:10,
    cursor:'pointer',border:'none',flexShrink:0,
    background:isPlaying?'#c41a1a':'#1a9944',
    color:'#ffffff',fontFamily:UI_FONT,
    fontWeight:700,
    boxShadow:isPlaying
      ?'0 4px 0 #801010,0 0 20px #ff333344'
      :'0 4px 0 #0e6628,0 0 20px #22dd5544',
    transition:'background 0.12s,box-shadow 0.12s',
    display:'flex',alignItems:'center',justifyContent:'center',
  };

  return e('div',null,
    // Form selector — own row so buttons can wrap freely; standards visually separated
    !isPlaying?(
    level==='essentials'
      ?e('div',{style:{display:'flex',gap:6,alignItems:'center',marginBottom:10}},
          e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'Form'),
          e('button',{onClick:()=>setForm('major'),style:modeBtn(form==='major',FORM_DEFS.major.col,FORM_DEFS.major.bg)},FORM_DEFS.major.lbl),
          e('button',{onClick:()=>setForm('minor'),style:modeBtn(form==='minor',FORM_DEFS.minor.col,FORM_DEFS.minor.bg)},FORM_DEFS.minor.lbl)
        )
      :e('div',{style:{marginBottom:10}},
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',marginBottom:5}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Progressions'),
            ['major','minor','turn','blues','minblues','custom'].map(f=>
              e('button',{key:f,onClick:()=>setForm(f),style:modeBtn(form===f,FORM_DEFS[f].col,FORM_DEFS[f].bg)},FORM_DEFS[f].lbl)
            )
          ),
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}},
            e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',flexShrink:0}},'Standards'),
            ['autumn','attya','twnbay','tritone','secdom'].map(f=>
              e('button',{key:f,onClick:()=>setForm(f),style:modeBtn(form===f,FORM_DEFS[f].col,FORM_DEFS[f].bg)},FORM_DEFS[f].lbl)
            ),
            e('button',{
              title:'Save current progression as a favorite',
              onClick:()=>{
                const lbl=(FORM_DEFS[form]?.lbl||form)+' · '+bpm+'bpm · '+vType;
                if(savedFaves.some(f=>f.form===form&&f.bpm===bpm&&f.vType===vType)) return;
                setSavedFaves(fs=>[...fs,{form,bpm,vType,lbl}]);
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
                  onClick:()=>{setForm(fav.form);setBpm(fav.bpm);setVType(fav.vType);},
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
    e('div',{style:{display:'flex',alignItems:'center',flexWrap:'wrap',gap:10,marginBottom:10,
      padding:'10px 14px',background:BG2,border:'1px solid '+BORDER,borderRadius:8}},
      // Left: play button + BPM grouped so they stay together
      e('div',{style:{display:'flex',alignItems:'center',gap:8,flexShrink:0}},
        countIn>0
          ?e('div',{style:{minWidth:80,textAlign:'center',fontSize:'1.6rem',fontWeight:700,
              color:'#ffffff',fontFamily:SERIF,letterSpacing:4}},countIn)
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
          e(LedToggle,{label:'BASS',enabled:bassEnabled,onToggle:()=>setBassEnabled(v=>!v),color:'#74C0FC'}),
          e('button',{onClick:()=>{setShowEq(v=>!v);setShowGuitarEq(false);setShowRideEq(false);},'aria-label':'Bass Mix',title:'Bass EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showEq?'#74C0FC22':'transparent',color:showEq?'#74C0FC':eqGains.some(v=>v!==0)||bassVolume!==80?'#74C0FC99':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},showEq?'MIX ▴':'MIX ▾')
        ),
        // COMP + Mix
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e(LedToggle,{label:'COMP',enabled:guitarEnabled,onToggle:()=>setGuitarEnabled(v=>!v),color:'#86EFAC'}),
          e('button',{onClick:()=>{setShowGuitarEq(v=>!v);setShowEq(false);setShowRideEq(false);},'aria-label':'Comp Mix',title:'Comp EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showGuitarEq?'#86EFAC22':'transparent',color:showGuitarEq?'#86EFAC':guitarEqGains.some(v=>v!==0)||guitarVolume!==80?'#86EFAC99':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},showGuitarEq?'MIX ▴':'MIX ▾')
        ),
        // RIDE + Mix
        e('div',{style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2,
          padding:'4px 5px 3px',borderRadius:6,border:'1px solid '+BORDER,background:BG2}},
          e(LedToggle,{label:'RIDE',enabled:rideEnabled,onToggle:()=>setRideEnabled(v=>!v),color:GOLD}),
          e('button',{onClick:()=>{setShowRideEq(v=>!v);setShowEq(false);setShowGuitarEq(false);},'aria-label':'Ride Mix',title:'Ride EQ & Volume',style:{
            width:'100%',padding:'2px 0',borderRadius:4,cursor:'pointer',border:'none',minHeight:0,
            background:showRideEq?GOLD+'22':'transparent',color:showRideEq?GOLD:rideEqGains.some(v=>v!==0)||rideVolume!==80?GOLD+'99':BTN_OFF,
            fontSize:'0.55rem',letterSpacing:'1px',fontFamily:UI_FONT,fontWeight:700,
          }},showRideEq?'MIX ▴':'MIX ▾')
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
    e('div',{style:{border:'1px solid '+BORDER,borderRadius:8,overflow:'hidden',marginBottom:10}},
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
                flex:1,position:'relative',padding:'5px 7px 10px',cursor:'pointer',
                borderRight:col<rowBars.length-1?'1px solid '+BORDER:'none',
                background:lit?ACT_YEL:isSel?ACT_GOLD+'44':isEditing?ACT_GOLD:'transparent',
                transition:'background 0.1s',
                display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:54,
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
    // Neck label + dot mode
    e('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:4}},
      e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'0.3px',flexGrow:1}},
        ac.roman+' — '+ac.name),
      setDotMode?e(DotModeToggle,{dotMode,setDotMode}):null
    ),
    // Neck
    e(ScrollNeck,{arpPos,highlight,scalePos,extraDots:gtDots,degNames:ac.dnames,dotMode,dotKeyIdx:keyIdx,marginBottom:level==='essentials'?12:0}),
    // Scale + guide-tone controls (full mode only)
    level==='full'&&e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center',
      padding:'6px 10px',background:BG2,border:'1px solid '+BORDER,borderTop:'none',
      borderRadius:'0 0 9px 9px',marginBottom:12,minHeight:52}},
      e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.5px',flexShrink:0}},'Scale'),
      (SCALE_HINTS[ac.quality]||[]).map(sc=>
        e('button',{key:sc.name,onClick:()=>setScaleHint(h=>h===sc.name?null:sc.name),style:{
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
    // Voicing + String Set row
    e('div',{style:{marginBottom:8}},
      e('div',{style:{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}},
        e('div',{style:{display:'flex',gap:6,alignItems:'center',flexShrink:0}},
          e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'Voicing'),
          (level==='essentials'
            ?[{id:'drop2',lbl:'Drop 2'},{id:'shell',lbl:'Shell'}]
            :[{id:'drop2',lbl:'Drop 2'},{id:'drop3',lbl:'Drop 3'},{id:'shell',lbl:'Shell'}]
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
    // Persistent voicing picker — always visible below the neck
    e('div',null,
      e('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:6,
        padding:'7px 10px',background:BG2,border:'1px solid '+GOLD+'55',borderRadius:6}},
        e('div',{style:{display:'flex',flexDirection:'column'}},
          e('div',{style:{fontSize:'0.68rem',color:GOLD,fontWeight:600}},
            'Bar '+(safeBarIdx+1)+' — '+ac.roman),
          e('div',{style:{fontFamily:SERIF,fontSize:'1rem',fontWeight:700,color:GOLD,lineHeight:1.1}},
            ac.name),
          (()=>{
            const bp=barPatternRef.current[isPlaying?playingBar:safeBarIdx];
            if(!bp) return null;
            return e('div',{style:{fontSize:'0.58rem',color:HINT,fontFamily:UI_FONT,marginTop:2,letterSpacing:'0.2px'}},
              BASS_NAMES[bp.bass]+' · '+COMP_NAMES[bp.comp]+' · '+RIDE_NAMES[bp.ride]);
          })()
        ),
        e('div',{style:{display:'flex',gap:5,flexWrap:'wrap',marginLeft:8}},
          ac.tones.map((t,ti)=>
            e('span',{key:ti,style:{fontSize:'0.7rem',color:TC[ti],fontFamily:UI_FONT}},
              ac.dnames[ti]+'='+nn(t,form==='custom'?0:keyIdx))
          )
        ),
        (pinnedChords.has(safeBarIdx)||barVT)?e('div',{style:{
          flexShrink:0,marginLeft:'auto',display:'flex',gap:4,
        }},
          barVT?e('div',{style:{padding:'2px 7px',borderRadius:10,
            background:'#74C0FC22',border:'1px solid #74C0FC44',
            fontSize:'0.65rem',color:'#74C0FC',fontFamily:UI_FONT
          }},barVT.vType):null,
          pinnedChords.has(safeBarIdx)?e('div',{style:{padding:'2px 7px',borderRadius:10,
            background:GOLD+'22',border:'1px solid '+GOLD+'55',
            fontSize:'0.65rem',color:GOLD,fontFamily:UI_FONT
          }},'pinned'):null
        ):null,
        def?e('button',{onClick:()=>setShowTip(v=>!v),style:{
          marginLeft:(pinnedChords.has(safeBarIdx)||barVT)?4:'auto',flexShrink:0,
          padding:'2px 7px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,
          fontSize:'0.7rem',border:'1px solid '+(showTip?GOLD:BTN_BRD),
          background:'transparent',color:showTip?GOLD:BTN_OFF,minHeight:28
        }},'?'):null
      ),
      showTip&&def?e('div',{style:{marginBottom:8,padding:'7px 10px',background:BG2,
        border:'1px solid '+BORDER,borderRadius:6,fontSize:'0.76rem',color:HINT,lineHeight:1.55}},
        e('span',{style:{color:GOLD,fontWeight:700}},'Voice leading: '),def.tip
      ):null,
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
          const typeBtn=(t,label)=>e('button',{key:t,onClick:()=>pickType(t),style:{
            padding:'2px 9px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.7rem',
            border:'1px solid '+(activeVT===t?GOLD:BTN_BRD),
            background:activeVT===t?ACT_GOLD:'transparent',
            color:activeVT===t?GOLD:BTN_OFF,minHeight:0,
          }},label);
          const vtHint=activeVT==='shell'?'light — band-friendly; root+3rd+7th only':
            activeVT==='drop2'?'most common — 4-note; works in any setting':
            'solo guitar — richer low voicing; 4-note spread';
          return e(React.Fragment,null,
            e('div',{style:{width:'100%',display:'flex',alignItems:'center',gap:5,marginBottom:2}},
              e('span',{style:{fontSize:'0.65rem',color:HINT,fontFamily:UI_FONT,letterSpacing:'0.3px'}},'Type'),
              typeBtn('shell','Shell'),
              typeBtn('drop2','Drop 2'),
              typeBtn('drop3','Drop 3'),
              barVT?e('button',{onClick:clearBarType,style:{
                marginLeft:4,padding:'2px 7px',borderRadius:4,cursor:'pointer',
                fontFamily:UI_FONT,fontSize:'0.65rem',
                border:'1px solid '+BTN_BRD,background:'transparent',color:HINT,minHeight:0,
              }},'↺ default'):null
            ),
            e('div',{style:{fontSize:'0.6rem',color:HINT,fontFamily:UI_FONT,marginBottom:6,paddingLeft:32,opacity:0.8}},vtHint),
            activeVT==='shell'
              ?SHELLS.map((sh,ii)=>
                  e(ChordBox,{key:ii,voicing:activeVoicings[ii],strings:sh.s,tones:ac.tones,
                    degNames:ac.dnames,invLabel:sh.lbl+' ('+sh.root+')',bassLabel:'bass: R',
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
function CustomChordView({customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level,dotMode,setDotMode,onFindInKey}){
  dotMode=dotMode||'interval';
  const isEss=level==='essentials';
  const [vType,setVType]=useState('shell');
  const [ssIdx,setSsIdx]=useState(2);
  const [invIdx,setInvIdx]=useState(0);
  const [shellIdx,setShellIdx]=useState(0);
  const [extOpt,setExtOpt]=useState(null); // active extension id or null
  useEffect(()=>{
    if(isEss&&(vType==='drop3'||vType==='drop24'||vType==='drop23'))setVType('drop2');
    if(isEss)setExtOpt(null);
  },[level]);
  useEffect(()=>{setExtOpt(null);setInvIdx(0);},[customTypeIdx,customRoot]);

  const baseType=EXT_TYPES[customTypeIdx];
  const availExts=CHORD_EXTS[customTypeIdx]||[];
  const extDef=extOpt?availExts.find(e=>e.id===extOpt):null;
  // Extension replaces the 5th (interval slot 2) with a colour tone
  const effectiveIv=extDef?baseType.iv.map((x,i)=>i===2?extDef.tone:x):baseType.iv;
  const degNames=extDef?baseType.dn.map((x,i)=>i===2?extDef.dn:x):baseType.dn;
  const tones=useMemo(()=>effectiveIv.map(i=>(customRoot+i)%12),[customRoot,customTypeIdx,extOpt]);
  const arpPos=useMemo(()=>getArpPos(tones),[tones]);
  // Build chord name: base sym + extension (e.g. "Cmaj7#11", "C7b9")
  const chordName=nn(customRoot,0)+baseType.sym+(extDef?extDef.sym:'');

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
  useEffect(()=>{if(vType==='shell') setShellIdx(firstValidShell);},[firstValidShell,vType]);
  const safeShellIdx=allVoicings[shellIdx]?shellIdx:firstValidShell;
  const selIdx=vType==='shell'?safeShellIdx:invIdx;

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

  const TABS=isEss?[
    {id:'shell',lbl:'Shell'},{id:'drop2',lbl:'Drop 2'},{id:'arpeggio',lbl:'Arpeggio'}
  ]:[
    {id:'shell',lbl:'Shell'},{id:'drop2',lbl:'Drop 2'},{id:'drop3',lbl:'Drop 3'},
    {id:'drop24',lbl:'Drop 2+4'},{id:'drop23',lbl:'Drop 2+3'},{id:'arpeggio',lbl:'Arpeggio'}
  ];

  const shellsA=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='A');
  const shellsB=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='B');

  return e('div',null,
    // Root + type selectors
    e('div',{style:{display:'flex',gap:10,flexWrap:'wrap',marginBottom:12,alignItems:'flex-start'}},
      e('div',null,
        e('div',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px',marginBottom:6,fontWeight:600}},'Root'),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
          KEYS.map((k,i)=>
            e('button',{key:i,onClick:()=>{setCustomRoot(k.root);setInvIdx(0);},style:{
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
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3,marginBottom:4}},
          (isEss?EXT_TYPES.slice(0,4):EXT_TYPES).map((t,i)=>
            e('button',{key:i,onClick:()=>{setCustomTypeIdx(i);setInvIdx(0);},style:{
              padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
              border:'1px solid '+(customTypeIdx===i?'#C084FC':BTN_BRD),
              background:customTypeIdx===i?ACT_PUR:BG2,
              color:customTypeIdx===i?'#C084FC':BTN_OFF,fontWeight:customTypeIdx===i?700:400,
              minHeight:44}},t.sym)
          )
        ),
        e('div',{style:{fontSize:'0.62rem',color:HINT,fontFamily:UI_FONT,lineHeight:1.4}},baseType.ctx)
      )
    ),
    // Extension row — Full mode only
    availExts.length>0&&!isEss?e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,alignItems:'center'}},
      e('span',{style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'Extension'),
      // "none" option
      e('button',{onClick:()=>setExtOpt(null),style:{
        padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
        border:'1px solid '+(extOpt===null?'#F4A261':BTN_BRD),
        background:extOpt===null?ACT_GOLD:BG2,
        color:extOpt===null?'#F4A261':BTN_OFF,fontWeight:extOpt===null?700:400,minHeight:44}},
        '—'),
      availExts.map(ex=>
        e('button',{key:ex.id,onClick:()=>setExtOpt(extOpt===ex.id?null:ex.id),style:{
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
      e('span',{style:{fontSize:'0.79rem',color:LBL}},'standalone — '+baseType.label+(extDef?' + '+extDef.dn:'')+'  (5th '+(extDef?'→ '+extDef.dn:'included')+')'),
      e('div',{style:{display:'flex',gap:12,flexWrap:'wrap',marginLeft:'auto'}},
        tones.map((t,i)=>
          e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5,fontSize:'0.76rem',color:TC[i]}},
            e('span',{style:{width:8,height:8,borderRadius:'50%',background:TC[i],display:'inline-block',flexShrink:0}}),
            degNames[i]+'='+nn(t,0)
          )
        )
      ),
      onFindInKey&&customTypeIdx<4?e('button',{
        onClick:()=>onFindInKey(customRoot,customTypeIdx),
        title:'Find this chord in the diatonic key map',
        style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,
          fontSize:'0.7rem',border:'1px solid '+BTN_BRD,background:'transparent',
          color:BTN_OFF,minHeight:0,flexShrink:0,whiteSpace:'nowrap'}
      },'In a key ↗'):null
    ),
    // Voicing tabs
    e('div',{style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
      TABS.map(({id,lbl})=>e('button',{key:id,onClick:()=>setVType(id),style:tabStyle(id)},lbl))
    ),
    // Controls bar
    e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
      borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
      display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
      DROP_TYPES.has(vType)?[
        e('span',{key:'lbl',style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'String set'),
        setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl))
      ]:null,
      vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Guide tones: R + 3rd + 7th'):null,
      vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions on neck'):null
    ),
    // Neck (with dot-mode toggle)
    e('div',{style:{marginBottom:6}},setDotMode?e(DotModeToggle,{dotMode,setDotMode}):null),
    e(ScrollNeck,{arpPos,highlight,scalePos:[],degNames,dotMode,dotKeyIdx:customRoot}),
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

// ── GuideView — the Path + glossary ──────────────────────────────────
function GuideView({openPreset,level}){
  const [expanded,setExpanded]=useState({});
  function tog(id){setExpanded(s=>({...s,[id]:!s[id]?true:undefined}));}
  const [popTerm,setPopTerm]=useState(null);
  // Path progress, persisted
  const [done,setDone]=useState(()=>{try{return JSON.parse(localStorage.getItem('jg-path')||'{}');}catch(ex){return{};}});
  useEffect(()=>{localStorage.setItem('jg-path',JSON.stringify(done));},[done]);
  function togDone(id){setDone(s=>({...s,[id]:!s[id]?true:undefined}));}
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
  function callout(...k){
    return e('div',{style:{background:'var(--act-blue)',border:'1px solid var(--brd)',borderRadius:6,
      padding:'8px 12px',marginBottom:8,fontSize:'0.79rem',lineHeight:1.7,color:'var(--txt)',fontFamily:UI_FONT}},...k);
  }
  const GLOSS_DEFS={
    '7th':{term:'7th chord',short:'A 4-note chord (root–3–5–7) — the extra note gives jazz its richness.'},
    'maj7':{term:'Major 7 (maj7)',short:'Stable and lush — the "home" chord. 7th sits a half-step below the octave.'},
    'dom7':{term:'Dominant 7 (7)',short:'The tension chord — its tritone (3rd + ♭7) pulls strongly toward resolution.'},
    'm7':{term:'Minor 7 (m7)',short:'Smooth and floating — neither fully resolved nor urgently tense.'},
    'halfdim':{term:'Half-diminished (ø7)',short:'m7 with a flattened 5th — more tense and searching than a regular minor 7.'},
    'inv':{term:'Inversion',short:'Which chord tone sits lowest — root, 3rd, 5th, or 7th in the bass.'},
    'drop2':{term:'Drop 2',short:'Second-highest note dropped an octave — spreads the chord across 4 adjacent strings.'},
    'vl':{term:'Voice leading',short:'Moving each string to the nearest available note in the next chord.'},
    'guide':{term:'Guide tones',short:'The 3rd and 7th — they define chord quality and move most dramatically chord to chord.'},
    'diat':{term:'Diatonic',short:'Notes or chords belonging entirely to one key, with no outside alterations.'},
    'shell':{term:'Shell voicing',short:'3-note voicing: root + 3rd + 7th — the 5th is omitted.'},
    'rootless':{term:'Rootless voicing',short:'Root replaced by 9th — designed to play over a bassist without doubling their note.'},
    'arp':{term:'Arpeggio',short:'Chord notes played one at a time rather than simultaneously.'},
    'modes':{term:'Modes',short:'Scales starting on different degrees of a parent scale (Dorian, Mixolydian, etc.).'},
    'roman':{term:'Roman numerals',short:'I, II, V etc. — chord position relative to the key, independent of key signature.'},
    'tritone':{term:'Tritone',short:'6 semitones apart — the most tense interval, wants to resolve by half-step in both directions.'},
    'tritone_sub':{term:'Tritone substitution',short:'Replacing the V7 chord with a dominant 7 a tritone away (♭II7). Both chords share the same tritone interval and resolve identically, but ♭II7 moves to I by a smooth half-step in the bass.'},
    'sec_dom':{term:'Secondary dominant',short:'A V7 chord that temporarily points to a chord other than I — e.g., V7/ii is the dominant of the ii chord. Creates chromatic motion and temporary key shifts.'},
    'modal_int':{term:'Modal interchange (borrowing)',short:'Using chords from the parallel minor or major key — e.g., in C major, using IVm7 (Fm7) or ♭VII7 (B♭7) "borrowed" from C minor. Creates unexpected color without fully leaving the key.'},
    'approach_note':{term:'Chromatic approach note',short:'A note a half-step above or below a chord tone, played on the beat just before the chord arrives. Creates gravity and forward motion — a defining element of bebop melody.'},
  };
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
  // The Path: ordered stages, each opening a live view preset via openPreset
  const stages=[
    {id:'qualities',title:'Meet the four chord qualities',
     preset:{view:'diatonic',key:0,deg:0,vType:'shell'},
     body:['Jazz harmony runs on four chord types. You probably know the sound of major (bright) and minor (dark) from everyday music. Jazz adds a fourth note — the 7th — to each chord, and the exact flavor of that note is what creates four distinct sounds: Major 7, Minor 7, Dominant 7, and Half-diminished.',
           'Major 7 (Cmaj7): warm, lush, settled — the "home" sound. Minor 7 (Dm7): smooth, slightly floating — darker than major but not tense. Dominant 7 (G7): the tension chord — it pulls strongly toward resolution. Half-diminished (Bm7♭5): unstable and searching — the most urgent of the four. The colored dots in the app label each note: red = root, teal = 3rd, blue = 5th, gold = 7th.'],
     items:['In the Explore tab, tap through a few chords and listen — can you hear which ones feel settled vs. tense?','Set the dot mode to "Interval" to see the chord tones labeled (R, 3, 5, 7) — these colors appear everywhere in the app','Don\'t worry about memorizing names yet. You\'re training your ear to hear the difference first']},
    {id:'shells',title:'Shell voicings — your first jazz grips',
     preset:{view:'diatonic',key:0,deg:0,vType:'shell'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:56,vType:'shell'},
     body:[[term('shell','A shell voicing'),' is a 3-note chord: root, 3rd, and 7th. The middle note (the 5th) is left out. This sounds like a sacrifice but it isn\'t — the 3rd and 7th already tell a listener everything about the chord quality. Leaving the 5th out makes the voicing lighter and easier to move around the neck.'],
           ['The 3rd is the note that defines major vs. minor — it\'s the brightest or darkest note in the chord. The 7th is what makes it jazz — it determines the exact flavor (major 7, dominant 7, minor 7). These two notes are called ',term('guide','"guide tones"'),' because they guide the ear through a chord progression. Form A and Form B are just two different fingering shapes — same notes, different string groupings.']],
     items:['In the Explore tab with Shell selected, play through the chords in C major one by one','Notice that each chord uses the same 3-string shape — only the fret position and one or two notes change','Listen for the 3rd: it\'s the note that makes it sound major (bright) or minor (darker). Try to pick it out by ear']},
    {id:'iivi',title:'The II–V–I — jazz\'s engine',
     preset:{view:'iivi',key:0,form:'major',bpm:60},
     body:['Three chords that appear in virtually every jazz standard: a ',term('m7','minor 7'),' chord (II), a ',term('dom7','dominant 7'),' chord (V), and a ',term('maj7','major 7'),' chord (I). In C major that\'s Dm7 → G7 → Cmaj7. The ',term('roman','Roman numerals'),' just indicate position in the key — the same pattern works in every key by moving everything up or down. Learn it once, use it everywhere.',
           ['Why does it work? The V7 chord contains a ',term('tritone','tritone'),' — the interval between its 3rd and 7th (B and F in G7). A tritone is maximally unstable, and both notes want to resolve by half-step: B moves up to C, F moves down to E. Those are exactly the root and 3rd of Cmaj7. The resolution is built into the physics of the interval.'],
           ['The ',term('guide','guide tones'),' swap roles on each chord: the 7th of G7 (F) becomes the 3rd of Cmaj7 (E after resolution), and the 3rd of G7 (B) becomes the root of Cmaj7. This chain of guide tone movement is the engine of jazz ',term('vl','voice leading'),'.']],
     items:['In the Play tab, click each chord and watch which notes move and which stay',['Pick a different II ',term('inv','inversion'),' — the app voice-leads the V and I to follow'],'Slow it down to 60 BPM and listen to how the V7 "wants" to go somewhere']},
    {id:'drop2',title:'Drop 2 — the comping workhorse',
     preset:{view:'diatonic',key:0,deg:0,vType:'drop2',ssIdx:2},
     playPreset:{view:'iivi',key:0,form:'major',bpm:66,vType:'drop2'},
     body:[[term('drop2','Drop 2'),' takes a "closed" chord (all four notes within one octave) and drops the second-highest note down an octave. This spreads the chord across four adjacent strings in a span that fits the human hand naturally.'],
           ['Every chord has four ',term('drop2','Drop 2'),' ',term('inv','inversions'),' — same four notes, a different note on the bottom each time. Root position, 1st inversion, 2nd inversion, 3rd inversion. They sit at different positions on the neck, which is what makes smooth ',term('vl','voice leading'),' possible: instead of jumping shapes, you find the inversion of the next chord closest to where you already are.']],
     items:['On the 4-3-2-1 string set: play one Drop 2 shape for each of the 7 chords in C','Then play all four inversions of Cmaj7 in order, low to high, slow and even','Notice how each inversion is a rotation of the same four notes']},
    {id:'play',title:'Play along — rhythm first',
     preset:{view:'iivi',key:0,bpm:72},
     body:['A correct voicing played slightly out of time sounds worse than a simpler voicing played confidently in the groove. Rhythm is not separate from harmony — it is the delivery mechanism. Without it, the harmony doesn\'t land.',
           'The Play tab loops a chord progression with a walking bass and metronome click. Your job is to place each chord at the right moment, every time, without rushing or dragging. Start slow. 60 BPM is not embarrassingly slow — it\'s where control develops.'],
     items:['Strum each chord on beats 1 and 3 first — the strongest beats','Then try beats 1 and the "and" of 2 (the Charleston rhythm) — a core jazz comping pattern','Only increase the tempo when you can play each change without hesitation']},
    {id:'blues',title:'The jazz blues form',
     preset:{view:'iivi',key:5,form:'blues',bpm:66},
     body:['The 12-bar blues is one of music\'s most-used forms, and jazz transformed it by substituting richer chords and adding a II–V–I in bars 9–10. The result — jazz blues — sounds unmistakably jazz while keeping the familiar 12-bar architecture.',
           'The jazz blues in F: bars 1–4 on F7 (I), bars 5–6 on B♭7 (IV), bar 7 back to F7, bar 8 adds D7 (VI7, a secondary dominant), bars 9–10 are a II–V (Gm7–C7), and bar 11 returns to F7 before a V7 turnaround in bar 12. F is the traditional jazz-blues key — "Now\'s the Time," "Billie\'s Bounce," "Blues for Alice" are all in F.'],
     items:['Loop the Jazz Blues form with shells only — one grip per bar, any inversion','Identify the II–V–I in bars 9–11 — it\'s the same progression you already practiced','Then try the I–VI–II–V turnaround form: the same ideas compressed into 4 bars']},
    {id:'minor',title:'The minor II–V–I',
     preset:{view:'iivi',key:0,form:'minor',bpm:60},
     body:['The minor II–V–I uses the same structural logic as the major version but with a different harmonic color: IIm7♭5 (half-diminished) – V7 – Im7. The half-diminished chord has a flattened 5th, which adds instability beyond a regular minor 7 — it urgently wants to move.',
           'The V7 in a minor II–V–I often uses an altered dominant (♭9 or ♯9) because the raised 7th of the melodic minor scale clashes interestingly with the chord. This creates a more intense pull toward the Im7. "Autumn Leaves" alternates major and minor II–V–Is back to back — it\'s the most-studied standard for learning this.'],
     items:['Loop major then minor II–V–I in the same key back to back — hear the contrast','Listen for how the ♭5 of the IIø pulls downward into the V7','Try switching to minor in the Play tab and notice which voicings change']},
    {id:'tritone_sub',title:'Tritone substitution — same destination, different road',
     preset:{view:'iivi',key:0,form:'tritone',bpm:60},
     body:[['The ',term('tritone_sub','tritone substitution'),' replaces the V7 chord with another ',term('dom7','dominant 7'),' a ',term('tritone','tritone'),' (6 semitones) away. In C major: G7 can be replaced by D♭7 (♭II7). Both chords share the same tritone interval — B and F appear in both — so both resolve identically to Cmaj7.'],
           ['The difference is in the bass motion: G7 resolves by a descending 5th (G→C), while D♭7 resolves by a smooth half-step (D♭→C). That chromatic bass slide is the signature sound of the tritone sub — it implies a descending bass line without breaking the harmonic logic. The ',term('guide','guide tones'),' (B and F) do the same job either way; only the bass note and the outer color change. Tap the Tritone Sub form above to hear both back to back.']],
     items:['Bars 1–4: standard bass drops a 4th (G→C). Bars 5–8: bass slides down a half-step (D♭→C) — hear the difference',
            'On the ♭II7 bar, try a drop 2 D♭7 — root on string 5, fret 9 (same shape as G7 but 6 frets higher)',
            ['In standards: wherever you see a V7 resolving to I, try the tritone sub. "Autumn Leaves," "All The Things You Are," and nearly every bebop head use them']]},
    {id:'secdom',title:'Secondary dominants — borrowing V7 for any chord',
     preset:{view:'iivi',key:0,form:'secdom',bpm:60},
     body:[['A ',term('sec_dom','secondary dominant'),' is any dominant 7 chord that temporarily acts as a V7 to a chord other than I. In C major, D7 is not diatonic — but it pulls strongly to Gm7 (ii), because D7 is V7 of Gm. Calling it "V7/ii" (five-of-two) names that relationship. You can build a secondary dominant to any chord in the key: V7/ii, V7/iii, V7/IV, V7/V, V7/vi.'],
           ['The secondary dominant creates a momentary key shift — a tiny detour into the orbit of the target chord. The ear hears the tension of a tritone resolving, then snaps back to the main key. In the Sec. Dom. form above, a chain of secondary dominants descends chromatically: each chord is V7 of the next, pulling the ear through a cascade of half-step bass resolutions before landing on Imaj7.']],
     items:['In C: D7 → Gm7 is V7/ii. The note C♯ (♭7 of D7) pulls down to the 3rd of Gm7 (B♭). Hear the pull on the Play tab using the Sec. Dom. form',
            'Look for secondary dominants in standards: the D7 in bar 8 of the blues, the A7 in "Autumn Leaves" before the Am7, the B7 before E♭maj7 in "All The Things You Are"',
            ['Secondary dominants are often tritone-substituted: if you see A♭7 moving to Gm7, that\'s just D7 (V7/ii) with a ',term('tritone_sub','tritone sub'),' applied — the same function, chromatically recolored']]},
    {id:'keys',title:'Take it around the keys',
     preset:{view:'diatonic',key:7,deg:0,vType:'shell'},
     playPreset:{view:'iivi',key:7,form:'major',bpm:66},
     body:['Every concept so far works identically in all 12 keys — the interval relationships never change, only the pitch names do. This is what Roman numeral analysis is for: II–V–I in G♭ means exactly the same thing structurally as II–V–I in C.',
           'Jazz musicians practice in all 12 keys, traditionally moving around the cycle of fourths (C → F → B♭ → E♭ → A♭ → D♭ → G♭ → B → E → A → D → G → back to C). Each move is a 5th down (or 4th up). Most standards modulate or borrow from multiple keys — knowing the patterns in each key is not optional, it\'s infrastructure.'],
     items:['Change the key in the app and play the same shell shapes — notice they shift position but the hand shapes stay similar','In each new key: shells first, then Drop 2, then the Play-along','One new key per week = all 12 in three months']},
    {id:'scales',title:'Scales over chords — the melodic layer',
     preset:{view:'diatonic',key:0,deg:4,vType:'arpeggio'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:72},
     body:['Every chord implies a scale — a set of notes that "belong" over it and define its color. In C major, each diatonic chord has a corresponding mode: the IIm7 gets Dorian (D E F G A B C), the V7 gets Mixolydian (G A B C D E F), the Imaj7 gets Ionian (the major scale itself).',
           'Modes are not separate scales learned in isolation — they are the same major scale heard from a different starting point. D Dorian and C major contain identical notes; what changes is which note feels like "home." Over IIm7, D feels like home, so D Dorian is the right frame.',
           'For the V7, Mixolydian is the neutral choice. Altered (7th mode of melodic minor) uses every altered tension — ♭9, ♯9, ♭13 — for maximum pull. The Scale panel in the Explore tab shows exactly which mode applies to each chord.'],
     items:['On the V7 chord, try playing only the four chord tones (use Arpeggio view to find them)', 'Then connect them with scale steps — that\'s the foundation of bebop melody','Switch to Altered scale in the Scale panel and hear how it intensifies the tension']},
    {id:'approach',title:'Chromatic approaches — bebop\'s half-step glue',
     preset:{view:'diatonic',key:0,deg:4,vType:'arpeggio'},
     playPreset:{view:'iivi',key:0,form:'major',bpm:60,vType:'drop2'},
     body:['A ',term('approach_note','chromatic approach note'),' is played a half-step above or below a chord tone on the last beat before the chord changes. You land squarely on the target when the new chord arrives. This half-step tension-and-release is the signature sound of bebop melody — it gives phrases a sense of gravity and inevitability.',
           ['The best targets are ',term('guide','"guide tones"'),' — the 3rd and 7th — because those are the notes that change most between chords and carry the most harmonic meaning. Approach from below (most natural, pulls up), from above (tenser, falls down), or double chromatic: one half-step above then one below, landing on beat 1. Even a single approach note per chord change transforms a scale run into a bebop phrase.']],
     items:['Over the II–V–I, pick the 3rd of each chord as your target. On beat 4 of the previous bar, play a half-step below — land on the 3rd on beat 1','Switch to Arpeggio view to see chord tones clearly — those are your landing points','Try a double chromatic into the 3rd of G7 (B): play B♭ then C on beats 3–4, land on B on beat 1 — that surrounding motion is a bebop staple']},
    {id:'full',title:'Go Full — Drop 3, Rootless, altered colors',
     preset:{view:'diatonic',key:0,deg:4,vType:'rootless',level:'full'},
     body:['Full level adds four more tools: Drop 3 (3rd-highest note dropped, 6th-string bass — good for solo guitar), Rootless voicings (root replaced by 9th, designed to play over a walking bassist without doubling their note), Drop 2+4 and Drop 2+3 (wider spread voicings with more open sound), and extended chord types in the Any Chord view (9ths, altered, sus4).'],
     items:['Explore Rootless voicings — the 9th replacing the root creates a richer, more ambiguous sound','In Any Chord, try a 7alt voicing over the V chord and hear the tension','From here: the Glossary below and Next Steps are your map forward']},
  ];
  const doneCount=stages.filter(s=>done[s.id]).length;
  function stage(n,st,nextSt){
    const isDone=!!done[st.id];
    const theoryOpen=!!expanded['st_'+st.id];
    return e('div',{key:st.id,style:{display:'flex',gap:12,padding:'12px 14px',marginBottom:10,
      background:BG,border:'1px solid '+(isDone?GOLD+'40':BORDER),borderRadius:8,opacity:isDone?0.72:1}},
      e('div',{style:{flexShrink:0,width:26,height:26,borderRadius:'50%',
        border:'2px solid '+GOLD,color:isDone?GOLD:LBL,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:'0.8rem',fontWeight:700,fontFamily:UI_FONT,background:isDone?ACT_GOLD:'transparent'}},isDone?'✓':String(n)),
      e('div',{style:{flex:1}},
        e('div',{style:{fontFamily:SERIF,fontSize:'0.98rem',fontWeight:700,color:'var(--scale-name)',marginBottom:6}},st.title),
        st.body.length>0?e('p',{style:{...P,marginBottom:8}},...[].concat(st.body[0])):null,
        e('div',{style:{display:'flex',gap:8,marginBottom:8,flexWrap:'wrap'}},
          e('button',{onClick:()=>openPreset(st.preset),style:{
            padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.75rem',
            border:'1px solid '+GOLD,background:ACT_GOLD,color:GOLD,fontWeight:700,minHeight:44}},'▶ Open in app'),
          st.playPreset?e('button',{onClick:()=>openPreset(st.playPreset),style:{
            padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.75rem',
            border:'1px solid #74C0FC',background:'#0a1520',color:'#74C0FC',fontWeight:700,minHeight:44,
          }},'⌾ Try in Play →'):null,
          e('button',{onClick:()=>togDone(st.id),style:{
            padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.75rem',
            border:'1px solid '+(isDone?GOLD:BTN_BRD),background:isDone?ACT_GOLD:'transparent',
            color:isDone?GOLD:BTN_OFF,minHeight:44}},isDone?'✓ Done':'Mark done')
        ),
        st.items&&st.items.length?ul(...st.items):null,
        st.body.length>1?e('div',{style:{marginTop:6}},
          e('button',{onClick:ev=>{ev.stopPropagation();tog('st_'+st.id);},style:{
            background:'transparent',border:'none',cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.74rem',color:HINT,padding:'4px 0',display:'flex',alignItems:'center',gap:5,minHeight:0}},
            e('span',{style:{color:GOLD,fontSize:'0.8rem'}},theoryOpen?'▾':'▸'),' Why it works'),
          theoryOpen?e('div',{style:{marginTop:4,paddingLeft:10,borderLeft:'2px solid '+BORDER}},
            ...st.body.slice(1).map((t,i)=>e('p',{key:'bt'+i,style:{...P,marginBottom:5}},...[].concat(t)))
          ):null
        ):null,
        nextSt?e('div',{style:{marginTop:8,display:'flex',justifyContent:'flex-end'}},
          e('button',{onClick:()=>{togDone(st.id);openPreset(nextSt.preset);window.scrollTo(0,0);},
            style:{padding:'4px 12px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.72rem',
              border:'1px solid '+BTN_BRD,background:'transparent',color:BTN_OFF,minHeight:0,
              display:'flex',alignItems:'center',gap:5}},
            'Next: '+nextSt.title.split(' — ')[0],' →')
        ):null
      )
    );
  }
  return e('div',null,
    sec('Start Here',
      p('The only thing this guide assumes is that you can play guitar chords — open chords, barre chords, however you\'ve learned them. If you know that some chords sound bright and happy while others sound dark or tense, you already have the ear for this. No other music theory background is required.'),
      p('What you\'ll learn here: jazz uses ',e('b',{style:HL},'four-note chords'),' where most styles use three-note chords. The extra note is what gives jazz its characteristic richness. You\'ll learn to recognize these chord types by ear, play them in multiple positions, and connect them smoothly — the skills that make jazz harmony feel natural rather than academic.'),
      p('Every term that might be unfamiliar — ',term('inv','inversion'),', ',term('modes','mode'),', ',term('guide','guide tone'),', ',term('vl','voice leading'),' — is defined in plain English in the Glossary at the bottom of this page. You do not need to know them before you start. Meet them as they come up.'),
      callout(e('b',null,'How to use this page: '),'The Path below is a step-by-step route. Each stage explains one concept and opens the right tool already configured. Mark stages done as you go. The Glossary at the bottom is your reference whenever a term is unfamiliar. Tap any chord diagram in the app to hear it.')
    ),
    e('div',{style:S},
      e('div',{style:{...H,display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}},
        e('span',null,'The Learning Path — from first chords to jazz'),
        e('span',{style:{fontSize:'0.72rem',fontFamily:UI_FONT,fontWeight:400,color:doneCount===stages.length?GOLD:HINT}},doneCount+' / '+stages.length+' done')
      ),
      p('Work top to bottom — each stage is about a week of practice, and slower is fine. Nothing is locked; the Path just says what matters now. Each button opens the right view, already set up.'),
      stages.map((st,i)=>stage(i+1,st,stages[i+1]))
    ),
    e('div',{style:S},
      e('div',{style:H},'Glossary — click any term'),
      gloss('7th','7th chord','A chord built from 4 notes instead of 3 — adds a 7th interval.',null,
        'A triad has 3 notes: root–3rd–5th. A 7th chord adds one more third on top: the 7th. This extra note creates the richer, more complex sound characteristic of jazz. The 7th can be major (a half-step below the octave, giving maj7), minor/flat (a whole-step below, giving dominant 7 or minor 7), or diminished.',
        'In practice: a plain "G" triad is G–B–D. "Gmaj7" adds F#. "G7" adds F♮ (flat 7). "Gm7" adds both ♭3 and ♭7: G–B♭–D–F.'
      ),
      gloss('maj7','Major 7 (maj7)','The stable, lush chord — the 7th is a half-step below the octave.','maj7',
        'Spelled root–3–5–7: Cmaj7 = C–E–G–B. The major 7th (B in C major) creates a warm, slightly floating sound — it sits one half-step below the octave C, like a gentle lean toward resolution that never quite arrives. This is the I chord in a major key and the IV chord.',
        'Maj7 is the defining color of jazz ballads, bossa nova, and sophisticated pop. It is the "home" chord — stable enough to feel resolved, colorful enough to linger on. In the app it appears as the I and IV chord in the Explore tab.'
      ),
      gloss('dom7','Dominant 7 (7)','The tension chord — creates strong pull toward resolution.','dom7',
        'Spelled root–3–5–♭7: G7 = G–B–D–F. The ♭7 (F) and the 3rd (B) are 6 half-steps apart — a tritone, the maximally tense interval in Western music. Both notes want to resolve by half-step (B up to C, F down to E), pulling strongly toward the Imaj7 a fifth below.',
        'In jazz the V7 is this chord, and it is the engine of the II–V–I. Adding altered tensions (♭9, ♯9, ♭13) increases the instability and the pull. The resolution V7 → I is the fundamental motion of all tonal harmony.'
      ),
      gloss('m7','Minor 7 (m7)','A smooth, mid-tension chord — neither fully resolved nor urgently tense.','m7',
        'Spelled root–♭3–5–♭7: Dm7 = D–F–A–C. The flat 3rd gives it a minor quality; the flat 7th (shared with dominant 7) prevents it from feeling fully settled. It is floating — not tense enough to demand resolution, not stable enough to feel like home.',
        'In jazz the IIm7 chord is the starting point of the II–V–I. Dorian mode (natural minor with a raised 6th) is the standard improvisation scale over IIm7. The raised 6th is what separates Dorian from natural minor and gives it a warmer sound.'
      ),
      gloss('halfdim','Half-diminished (m7♭5, ø7)','A tense chord with a flattened 5th — rarer in rock, common in jazz.','m7b5',
        'Spelled root–♭3–♭5–♭7: Bm7♭5 in C major = B–D–F–A. The flattened 5th adds instability beyond a regular minor 7. This chord naturally occurs on the VII degree of a major scale and on the II degree of a minor scale (where it\'s labelled IIø or IIm7♭5).',
        'In the app, switch to Minor mode in the II–V–I view to hear this chord as the IIø chord. It resolves through the V7 (usually with a ♭9) to the Im7.'
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
        'The II–V–I view\'s play-along auto-selects the best V and I inversions based on whichever II inversion you pick.'
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
        'Find it everywhere in standards: any ♭II7 moving to I, or any chord that slides down a half-step into a target chord. The substitution also works on secondary dominants — a V7/ii can be tritone-subbed, creating a ♭VI7 → IIm7 motion. Because D♭7 is a tritone from G7, and both resolve to C, players can freely swap them without the ear complaining.'
      ),
      gloss('sec_dom','Secondary dominant','A V7 chord pointing to a chord other than I — creates a temporary key shift.',null,
        'Any diatonic chord can be temporarily treated as a local I, and the chord that is a fifth above it becomes its secondary dominant (V7/x). In C major: D7 is not in the key, but it pulls to Gm7 (ii) just as G7 pulls to Cmaj7. Writing it V7/ii names the relationship. Common secondary dominants: V7/ii (D7), V7/iii (E7), V7/IV (F#7 or Gb7), V7/V (A7), V7/vi (B7).',
        'The secondary dominant creates a brief detour into the tonal orbit of the target chord — the ear hears a tritone resolving, then snaps back to the main key center. Jazz blues makes heavy use of them: the VI7 in bar 8 (D7 in F) acts as V7/ii before the II–V turnaround. In standards, they appear as chromatic chords that briefly intensify motion toward the next chord in the progression.'
      ),
      gloss('diat','Diatonic','Using only the 7 notes of the key — playing "inside."',null,
        'The C major scale has 7 notes: C D E F G A B. Any note, chord, or phrase using only these 7 notes is "diatonic to C major." The 7 diatonic chords of C major are: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5.',
        '"Chromatic" or "outside" means using notes not in the key. Jazz soloists move in and out deliberately — inside for stability, outside for tension. The Chords in Key view shows all 7 diatonic chords; the Scale panel shows exactly which scale notes are available over each one.'
      ),
      gloss('shell','Shell voicing','A 3-note chord using just root, 3rd, and 7th — the 5th is omitted.',null,
        'The 5th adds little harmonic information that the other notes don\'t already provide, so shells strip it out, leaving a minimal but complete harmonic statement. The result is open-sounding and leaves room for other instruments.',
        'Shell Form A uses skip-string layouts (e.g., strings 6-4-3). Form B uses adjacent strings (e.g., strings 6-5-4). Shells are often the first step toward playing with a bassist, since they leave the low end uncluttered. Find them under the "Shell" tab in Chords in Key or Any Chord.'
      ),
      gloss('rootless','Rootless voicing','A 4-note chord where the 9th replaces the root.',null,
        'When a bassist plays the root, your guitar chord can drop the root entirely and substitute the 9th (an octave above the 2nd scale degree). The chord becomes richer and more complex, and doesn\'t double the bass player\'s note.',
        'Type A voicings (3-5-7-9) have the 3rd at the bottom. Type B (7-9-3-5) have the 7th at the bottom. These are the voicings you\'ll hear Bill Evans and other jazz pianists use. On guitar they live on the middle strings (4-3-2-1 or 5-4-3-2). Find them in the Chords in Key view under "Rootless" (Full level).'
      ),
      gloss('arp','Arpeggio','Playing chord notes one at a time instead of simultaneously.',null,
        'An arpeggio is the melodic version of a chord — the notes played in sequence like a harp (the word comes from the Italian "arpa"). Every chord position on the neck can become a melodic pattern by playing the notes one at a time.',
        'In jazz improv, arpeggios outline the chord changes with precision: instead of running a pentatonic lick through everything, you follow the exact chord tones. This is fundamental to bebop — Charlie Parker and Dizzy Gillespie improvised by rapidly arpeggiating through the chord changes. The Arpeggio view shows all chord-tone positions across the neck.'
      ),
      gloss('modes','Modes (Dorian, Lydian, Mixolydian, Altered...)','Scales built from the same notes as a major scale but starting on a different degree.',null,
        'The C major scale is C D E F G A B. If you start on D and play through all 7 notes back to D, you get D Dorian: D E F G A B C. Same notes as C major, different starting pitch — and a completely different flavor. Each of the 7 starting positions creates a different mode.',
        'Dorian (start on 2nd degree): minor feel with a natural 6th — the standard scale for IIm7. Lydian (4th degree): major feel with a raised 4th (#11) — bright, floating, for Imaj7 or IVmaj7. Mixolydian (5th degree): major feel with a ♭7 — the sound of dominant 7. Altered (7th mode of melodic minor): all tensions altered (♭9 ♯9 ♭13) — maximum outside tension over V7.',
        'Start diatonic. As your ear develops, let the modes label what you\'re already hearing.'
      ),
      gloss('roman','Roman numerals (I, II, V...)','Labels for chord positions in a key — work the same in any key.',null,
        'In C major: I=Cmaj7, II=Dm7, III=Em7, IV=Fmaj7, V=G7, VI=Am7, VII=Bm7♭5. In G major: I=Gmaj7, II=Am7, V=D7. The Roman numeral names the scale degree; the chord quality (maj7, m7, 7) is stated separately. This lets musicians say "II–V–I in B♭" and every player knows exactly which chords are meant.',
        'Upper-case numerals (I, II, V) are used for all chords in jazz shorthand — the quality is indicated by the suffix. Lower-case (i, ii) sometimes indicates minor in classical notation, but in jazz the written suffix (m7, maj7) does that job instead.'
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
    popTerm&&GLOSS_DEFS[popTerm]?e(React.Fragment,null,
      e('div',{onClick:()=>setPopTerm(null),style:{position:'fixed',inset:0,zIndex:199,background:'rgba(0,0,0,0.35)'}}),
      e('div',{style:{position:'fixed',bottom:0,left:0,right:0,zIndex:200,background:BG2,
        borderRadius:'14px 14px 0 0',border:'1px solid '+GOLD+'44',
        padding:'18px 20px 32px',boxShadow:'0 -8px 32px rgba(0,0,0,0.55)',
      }},
        e('div',{style:{display:'flex',alignItems:'center',marginBottom:10}},
          e('span',{style:{fontWeight:700,color:GOLD,fontSize:'0.92rem',fontFamily:UI_FONT}},GLOSS_DEFS[popTerm].term),
          e('button',{onClick:()=>setPopTerm(null),style:{marginLeft:'auto',background:'transparent',
            border:'none',cursor:'pointer',color:BTN_OFF,fontSize:'1.1rem',minHeight:0,padding:'2px 6px'}
          },'✕')
        ),
        e('p',{style:{fontSize:'0.84rem',lineHeight:1.65,color:'var(--txt)',fontFamily:UI_FONT,marginBottom:0}},
          GLOSS_DEFS[popTerm].short)
      )
    ):null,
    sec('Next Steps & Listening',
      p('Finished the Path? The Full level adds Drop 3, Rootless voicings, altered scales, and extended chord types — unlock it with the toggle at the top right. The Explore tab lets you build any chord with any extension. The Sec. Dom. and Tritone Sub forms in Play let you hear ',term('sec_dom','secondary dominants'),' and ',term('tritone_sub','tritone substitution'),' in action. Melodically, practice ',term('approach_note','chromatic approach notes'),' into guide tones — one half-step before each chord change is enough to start sounding like bebop. Further concepts: ',term('modal_int','modal interchange'),', reharmonization, chord melody, and rhythm changes.'),
      p(e('b',{style:HL},'Players to study:')),
      ul(
        e('span',null,e('b',null,'Wes Montgomery'),' — warmth, clarity, octave technique; a natural first listen for any guitarist'),
        e('span',null,e('b',null,'Joe Pass'),' — solo jazz guitar; walking bass and chords simultaneously; a masterclass in voice leading'),
        e('span',null,e('b',null,'Jim Hall'),' — space, restraint, perfect voice leading in every phrase; study his duo recordings with Bill Evans'),
        e('span',null,e('b',null,'Pat Metheny'),' — lyrical modern jazz, strong melodic sense, bridges many styles'),
        e('span',null,e('b',null,'Kurt Rosenwinkel'),' — modern harmony, complex extensions, guitar-forward compositional thinking')
      ),
      p('Start with a standard: ',e('b',{style:HL},'Autumn Leaves'),' (minor and major II–V–I back to back — the most-studied standard for a reason), ',e('b',{style:HL},'All The Things You Are'),' (moves through many keys, teaches transposition), or ',e('b',{style:HL},'There Will Never Be Another You'),' (clear changes, medium tempo, beautiful melody). Learn the melody first, then comp through the chords, then listen to recordings and try to identify what you\'re hearing.')
    )
  );
}

// ── App ───────────────────────────────────────────────────────────────
function App(){
  const [theme,setTheme]=useState(()=>localStorage.getItem('jg-theme')||'dark');
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
    localStorage.setItem('jg-theme',theme);
  },[theme]);
  // Global state
  const [key,setKey]=useState(()=>parseInt(localStorage.getItem('jg-key')||'0',10));
  const [viewMode,setViewMode]=useState(()=>localStorage.getItem('jg-viewMode')||'guide'); // 'diatonic'|'iivi'|'custom'|'guide'|'quiz'
  const [keyOpen,setKeyOpen]=useState(false);
  const [dotMode,setDotMode]=useState(()=>{const m=localStorage.getItem('jg-dotMode')||'interval';return (m==='both'||m==='finger')?'interval':m;});
  const [tourStep,setTourStep]=useState(null);
  useEffect(()=>{localStorage.setItem('jg-dotMode',dotMode);},[dotMode]);
  function tourNext(){
    if(tourStep>=TOUR_STEPS.length-1){setTourStep(null);localStorage.setItem('jg-toured','1');setViewMode('guide');window.scrollTo(0,0);}
    else setTourStep(s=>s+1);
  }
  function tourSkip(){setTourStep(null);localStorage.setItem('jg-toured','1');}
  useEffect(()=>{
    if(tourStep===null) return;
    const v=TOUR_STEPS[tourStep]&&TOUR_STEPS[tourStep].view;
    if(v) setViewMode(v);
  },[tourStep]);
  // Level: Essentials hides the advanced half of the app. New users start
  // in Essentials; anyone who used the app before the level existed keeps Full.
  const [level,setLevel]=useState(()=>localStorage.getItem('jg-level')||'essentials');
  const isEss=level==='essentials';
  const [iiviPlaying,setIiviPlaying]=useState(false);
  // Clear playing state when navigating away from the play tab
  useEffect(()=>{ if(viewMode!=='iivi') setIiviPlaying(false); },[viewMode]);
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

  useEffect(()=>{setScaleIdx(0);},[deg]);
  useEffect(()=>{localStorage.setItem('jg-key',key);},[key]);
  useEffect(()=>{localStorage.setItem('jg-viewMode',viewMode);},[viewMode]);
  useEffect(()=>{localStorage.setItem('jg-level',level);},[level]);
  // Dropping to Essentials while on an advanced tab/chord type
  useEffect(()=>{
    if(isEss){
      if(vType==='drop3'||vType==='drop24'||vType==='drop23'||vType==='rootless') setVType('shell');
      if(customTypeIdx>3) setCustomTypeIdx(2);
    }
  },[level]);

  // Jump from a Path stage into a live view with everything preset.
  // bpm/minor belong to IIVIView, which is unmounted while the Path is
  // open, so writing localStorage here is picked up when it mounts.
  function openPreset(p){
    if(p.level) setLevel(p.level);
    if(p.key!==undefined) setKey(p.key);
    if(p.deg!==undefined) setDeg(p.deg);
    if(p.vType) setVType(p.vType);
    if(p.ssIdx!==undefined) setSsIdx(p.ssIdx);
    if(p.form) localStorage.setItem('jg-form',p.form);
    if(p.bpm!==undefined) localStorage.setItem('jg-bpm',String(p.bpm));
    if(p.vType&&p.view==='iivi') localStorage.setItem('jg-vtype',p.vType);
    setViewMode(p.view||'diatonic');
    window.scrollTo(0,0);
  }
  function findInKey(root,typeIdx){
    const quality=['maj7','m7','dom7','m7b5'][typeIdx];
    if(!quality) return;
    // Prefer current key — search its degrees first
    for(let d=0;d<7;d++){
      if(QTYPES[d]===quality&&(KEYS[key].root+MAJOR_SCALE[d])%12===root){
        setDeg(d);setViewMode('diatonic');window.scrollTo(0,0);return;
      }
    }
    // Fallback: search all keys
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
        padding:'2px 6px',borderRadius:12,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.9rem',
        border:'none',background:'transparent',color:'var(--hint)',minHeight:0,opacity:0.7,flexShrink:0}},
        theme==='dark'?'☀':'☾'),
      e('div',{style:{flex:1}}),
      e('div',{'data-tour':'level-switch'},e(GuitarToggle,{level,setLevel})),
      e('button',{onClick:()=>setTourStep(0),'aria-label':'Start tour',style:{padding:'4px 10px',
        borderRadius:18,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.8rem',
        border:'1px solid '+BTN_BRD,background:'transparent',
        color:BTN_OFF,minHeight:44,flexShrink:0}},'? Tour'),
    ),

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
    viewMode==='iivi'?e(IIVIView,{keyIdx:key,dotMode,setDotMode,level,onPlayStateChange:setIiviPlaying}):null,

    // ── CUSTOM CHORD VIEW ────────────────────────────────────────────
    viewMode==='custom'?e(CustomChordView,{customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level,dotMode,setDotMode,onFindInKey:findInKey}):null,

    // ── GUIDE / PATH VIEW ────────────────────────────────────────────
    viewMode==='guide'?e(GuideView,{openPreset,level}):null,

    // ── EAR TRAINING VIEW ────────────────────────────────────────────
    viewMode==='quiz'?e(EarTrainingView,{level}):null,

    // ── DIATONIC VIEW ────────────────────────────────────────────────
    viewMode==='diatonic'?e('div',null,
      // Diatonic chord map — all 7 chords as visual cards
      e('div',{'data-tour':'chord-row',style:{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:3,marginBottom:10}},
        ROMAN.map((r,i)=>{
          const rPC=(KEYS[key].root+MAJOR_SCALE[i])%12;
          const qt=QTYPES[i];
          const qcol=qt==='maj7'?GOLD:qt==='dom7'?'#FF6B6B':qt==='m7b5'?'#C084FC':'#74C0FC';
          const qbg=qt==='maj7'?ACT_GOLD:qt==='dom7'?ACT_RED:qt==='m7b5'?'#1a0a2a':'#0a1520';
          const act=deg===i;
          return e('button',{key:i,onClick:()=>setDeg(i),style:{
            padding:'6px 4px 5px',borderRadius:6,cursor:'pointer',
            border:'1px solid '+(act?qcol:BTN_BRD),
            background:act?qbg:'transparent',
            display:'flex',flexDirection:'column',alignItems:'center',gap:2,
            minHeight:0,transition:'border-color 0.1s,background 0.1s',
          }},
            e('div',{style:{fontSize:'0.65rem',fontWeight:700,fontFamily:UI_FONT,
              color:act?qcol:LBL,letterSpacing:'0.3px',lineHeight:1}},r),
            e('div',{style:{fontSize:act?'0.9rem':'0.82rem',fontWeight:act?700:500,fontFamily:SERIF,
              color:act?qcol:BTN_OFF,lineHeight:1.1,textAlign:'center',transition:'font-size 0.1s'}},nn(rPC,key)),
            e('div',{style:{fontSize:'0.58rem',fontFamily:UI_FONT,
              color:act?qcol+'cc':HINT,lineHeight:1,letterSpacing:'0.2px'}},QSYMS[i])
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
        e('button',{
          onClick:()=>{
            const qi=['maj7','m7','dom7','m7b5'].indexOf(quality);
            if(qi>=0){setCustomTypeIdx(qi);setCustomRoot(rootPC);}
            setViewMode('custom');window.scrollTo(0,0);
          },
          title:'Open this chord in the Chord Explorer',
          style:{padding:'3px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,
            fontSize:'0.7rem',border:'1px solid '+BTN_BRD,background:'transparent',
            color:BTN_OFF,minHeight:0,flexShrink:0,whiteSpace:'nowrap'}
        },'Explore ↗')
      ),
      // Voicing tabs — Essentials shows the starting trio, Full shows everything
      e('div',{'data-tour':'voicing-tabs',style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
        (isEss?['shell','drop2','arpeggio']:['shell','drop2','drop3','drop24','drop23',...(quality!=='m7b5'?['rootless']:[]),'arpeggio']).map(id=>{
          const lbls={drop2:'Drop 2',drop3:'Drop 3',drop24:'Drop 2+4',drop23:'Drop 2+3',shell:'Shell',rootless:'Rootless',arpeggio:'Arpeggio'};
          return e('button',{key:id,onClick:()=>setVType(id),style:tabStyle(id)},lbls[id]);
        })
      ),
      // Controls bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
        borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
        display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
        DROP_TYPES.has(vType)?[
          e('span',{key:'lbl',style:{fontSize:'0.72rem',color:LBL,letterSpacing:'0.3px'}},'String set'),
          setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl)),
          voiceOrder?e('span',{key:'vo',style:{marginLeft:'auto',fontSize:'0.7rem',color:HINT}},'voices: '+voiceOrder):null
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
      // Neck (with dot-mode toggle)
      e(DotModeToggle,{dotMode,setDotMode}),
      e(ScrollNeck,{arpPos,highlight,scalePos,degNames,hlTc,dotMode,dotKeyIdx:key,dataTour:'neck-area'}),
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
      e('div',{style:{marginTop:8,padding:'6px 14px',fontSize:'0.79rem',color:HINT,lineHeight:1.7}},
        'Shell Form A: skip-string shapes. Shell Form B: adjacent-string R-3-7. Drop 2: 2nd-highest note dropped an octave. Drop 3: 3rd-highest dropped, one string gap. Rootless: 9th replaces root — designed to play over a walking bass.')
    ):null,

    // ── Tour overlay ─────────────────────────────────────────────────
    tourStep!==null?e(TourOverlay,{step:tourStep,onNext:tourNext,onSkip:tourSkip}):null,

    // ── Bottom tab bar ───────────────────────────────────────────────
    e('nav',{'data-tour':'bottom-nav',style:{position:'fixed',bottom:0,left:0,right:0,zIndex:50,
      display:'flex',background:BG2,borderTop:'1px solid '+BORDER,
      paddingBottom:'env(safe-area-inset-bottom)',
      boxShadow:'0 -4px 16px rgba(0,0,0,0.35)'}},
      [['guide','⚑','Guide'],['diatonic','♬','Key'],['custom','♪','Explore'],['iivi','▶','Play'],['quiz','♫','Ear']].map(([id,icon,lbl])=>{
        const act=viewMode===id;
        return e('button',{key:id,onClick:()=>{setViewMode(id);window.scrollTo(0,0);},style:{
          flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,
          padding:'7px 0 5px',background:'transparent',border:'none',
          borderTop:'2px solid '+(act?'var(--txt)':'transparent'),
          color:act?'var(--txt)':BTN_OFF,fontFamily:UI_FONT,cursor:'pointer',minHeight:52}},
          e('span',{style:{fontSize:'1.1rem',lineHeight:1.2}},icon),
          e('span',{style:{fontSize:'0.64rem',letterSpacing:'0.5px',fontWeight:act?700:400}},lbl)
        );
      })
    )
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

