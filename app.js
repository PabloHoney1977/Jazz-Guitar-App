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
const ROMAN =['I','II','III','IV','V','VI','VII'];
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
  {id:'maj7', sym:'maj7', label:'Major 7',  iv:[0,4,7,11], dn:['R','3','5','Δ7']},
  {id:'m7',   sym:'m7',   label:'Minor 7',  iv:[0,3,7,10], dn:['R','b3','5','b7']},
  {id:'dom7', sym:'7',    label:'Dom 7',    iv:[0,4,7,10], dn:['R','3','5','b7']},
  {id:'m7b5', sym:'ø7',   label:'Half-Dim', iv:[0,3,6,10], dn:['R','b3','b5','b7']},
  {id:'maj9', sym:'maj9', label:'Major 9',  iv:[0,4,11,2], dn:['R','3','Δ7','9']},
  {id:'m9',   sym:'m9',   label:'Minor 9',  iv:[0,3,10,2], dn:['R','b3','b7','9']},
  {id:'dom9', sym:'9',    label:'Dom 9',    iv:[0,4,10,2], dn:['R','3','b7','9']},
  {id:'7alt', sym:'7alt', label:'Altered',  iv:[0,4,10,3], dn:['R','3','b7','#9']},
  {id:'7b9',  sym:'7♭9',  label:'7♭9',     iv:[0,4,10,1], dn:['R','3','b7','b9']},
  {id:'9sus', sym:'9sus4',label:'9sus4',    iv:[0,5,10,2], dn:['R','4','b7','9']},
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
  {id:'7alt', sym:'7alt', label:'Altered',  iv:[0,4,10,3], dn:['R','3','b7','#9']},
  {id:'7b9',  sym:'7♭9',  label:'7♭9',     iv:[0,4,10,1], dn:['R','3','b7','b9']},
  {id:'9sus', sym:'9sus4',label:'9sus4',    iv:[0,5,10,2], dn:['R','4','b7','9']},
];
// Chord types that support rootless voicings (root replaced by 9th)
const ROOTLESS_OK=new Set(['maj7','m7','dom7','m7b5']);

// ── Chord-scale data ─────────────────────────────────────────────────
const PARENT_SC={major:[0,2,4,5,7,9,11],melmin:[0,2,3,5,7,9,11]};
const PTYPE_NAME={major:'Major',melmin:'Mel. Minor',dim:'Diminished',wt:'Whole Tone'};
// FIX: index 11 = 11 semitones = major 7th; was 'd7' (diminished 7), now 'Δ7'
const INT_NAMES=['R','b2','2','b3','3','4','#4','5','b6','6','b7','Δ7'];

const CHORD_SCALES=[
  [{name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,desc:'Home — fully inside the key'},
   {name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,desc:'#11 — floating, bright color'}],
  [{name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,desc:'Standard — nat. 6, fully inside'}],
  [{name:'Phrygian', abbr:'Phr',   iv:[0,1,3,5,7,8,10],pType:'major', mPos:2,desc:'Diatonic — dark b2 tension'},
   {name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,desc:'Brighter — avoids b2'}],
  [{name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,desc:'Natural — #11 defines the sound'},
   {name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,desc:'Inside — IV as local tonic'},
   {name:'Lyd.Aug.', abbr:'LydAug',iv:[0,2,4,6,8,9,11],pType:'melmin',mPos:2,desc:'#5+#11 — dreamy quality'}],
  [{name:'Mixolydian',abbr:'Mix',  iv:[0,2,4,5,7,9,10],  pType:'major', mPos:4,desc:'Standard — natural tensions'},
   {name:'Altered',  abbr:'Alt',   iv:[0,1,3,4,6,8,10],  pType:'melmin',mPos:6,desc:'All tensions altered — max pull'},
   {name:'Lyd.Dom.', abbr:'LydDom',iv:[0,2,4,6,7,9,10],  pType:'melmin',mPos:3,desc:'#11 — bright dominant color'},
   {name:'HW Dim.',  abbr:'HWDim', iv:[0,1,3,4,6,7,9,10],pType:'dim',   mPos:0,desc:'8-note: b9 #9 #11 nat.13'},
   {name:'Whole Tone',abbr:'W.T.', iv:[0,2,4,6,8,10],    pType:'wt',    mPos:0,desc:'6-note: #5 and #11'}],
  [{name:'Aeolian',  abbr:'Aeo',   iv:[0,2,3,5,7,8,10],pType:'major', mPos:5,desc:'Natural minor — fully diatonic'},
   {name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,desc:'nat.6 brightens — outside key'}],
  [{name:'Locrian',  abbr:'Loc',   iv:[0,1,3,5,6,8,10],pType:'major', mPos:6,desc:'Diatonic — b2 b5 b6'},
   {name:'Loc.nat.2',abbr:'Loc2',  iv:[0,2,3,5,6,8,10],pType:'melmin',mPos:5,desc:'nat.2 softens harshest interval'}],
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
const DROP_TYPES=new Set(['drop2','drop3','drop24','drop23']);
const DROP_LBL={drop2:'DROP 2',drop3:'DROP 3',drop24:'DROP 2+4',drop23:'DROP 2+3'};

// ── Engine ───────────────────────────────────────────────────────────
const getChordTones=(root,q)=>INTERVALS[q].map(i=>(root+i)%12);
const getExtTones=(root,extType)=>extType.iv.map(i=>(root+i)%12);
const getRootlessTones=(root,q)=>{const t=getChordTones(root,q);return[(root+2)%12,t[1],t[2],t[3]];};

const noteForDot=(mode,degName,pc,keyIdx)=>{
  const note=nn(pc,keyIdx);
  if(mode==='note') return note;
  if(mode==='interval') return degName;
  return note+(degName?'/'+degName:'');
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
    const score=v.frets.reduce((sum,f,j)=>sum+Math.abs(f-prevVoicing.frets[j]),0);
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

function precomputeKS(ctx){
  const sr=ctx.sampleRate,bufs={};
  for(let pc=0;pc<12;pc++){
    const freq=440*Math.pow(2,(48+pc-69)/12);
    const N=Math.round(sr/freq);
    const len=Math.round(sr*2.5);
    const buf=ctx.createBuffer(1,len,sr);
    const d=buf.getChannelData(0);
    const ring=new Float32Array(N);
    for(let i=0;i<N;i++) ring[i]=Math.random()*2-1;
    let pos=0;
    for(let i=0;i<len;i++){
      const next=(pos+1)%N;
      d[i]=ring[pos];
      ring[pos]=0.996*0.5*(ring[pos]+ring[next]);
      pos=(pos+1)%N;
    }
    bufs[pc]=buf;
  }
  return bufs;
}

// ── Chord preview audio (module-level, shared across all ChordBoxes) ──
let _previewCtx=null;
let _previewBufs=null;
function getPreviewAudio(){
  try{
    if(!_previewCtx||_previewCtx.state==='closed'){
      _previewCtx=new (window.AudioContext||window.webkitAudioContext)();
      _previewBufs=precomputeKS(_previewCtx);
    }
    if(_previewCtx.state==='suspended') _previewCtx.resume();
    return[_previewCtx,_previewBufs];
  }catch(ex){return[null,null];}
}
function playChordPreview(voicing,strings){
  if(!voicing) return;
  try{
    const [ctx,bufs]=getPreviewAudio();
    if(!ctx||!bufs) return;
    strings.forEach((si,i)=>{
      const fret=voicing.frets[i];
      const midi=OPEN_MIDI[si]+fret;
      const pc=((midi%12)+12)%12;
      const startTime=ctx.currentTime+i*0.030;
      const src=ctx.createBufferSource();
      src.buffer=bufs[pc];
      src.playbackRate.value=Math.pow(2,(midi-(48+pc))/12);
      const gain=ctx.createGain();
      gain.gain.setValueAtTime(0.55,startTime);
      gain.gain.exponentialRampToValueAtTime(0.001,startTime+2.0);
      src.connect(gain);gain.connect(ctx.destination);
      src.start(startTime);src.stop(startTime+2.2);
    });
  }catch(ex){}
}

// ── DotModeToggle ─────────────────────────────────────────────────────
function DotModeToggle({dotMode,setDotMode}){
  const opts=[{id:'interval',lbl:'Interval'},{id:'note',lbl:'Note'},{id:'both',lbl:'Both'}];
  return e('div',{style:{display:'flex',alignItems:'center',gap:6,marginBottom:6}},
    e('span',{style:{fontSize:'0.69rem',color:'var(--hint)',letterSpacing:'1px',flexShrink:0}},'DOTS'),
    e('div',{style:{display:'flex',border:'1px solid var(--btn-brd)',borderRadius:14,overflow:'hidden'}},
      opts.map(({id,lbl})=>e('button',{key:id,onClick:()=>setDotMode(id),style:{
        padding:'3px 10px',fontFamily:UI_FONT,fontSize:'0.69rem',border:'none',cursor:'pointer',
        background:dotMode===id?'var(--act-teal)':'transparent',
        color:dotMode===id?'#4ECDC4':'var(--btn-off)',fontWeight:dotMode===id?700:400,minHeight:28
      }},lbl))
    )
  );
}

// ── GuitarToggle ──────────────────────────────────────────────────────
function GuitarToggle({level,setLevel}){
  const isEss=level==='essentials';
  const ang=isEss?-30:30;
  return e('div',{style:{display:'flex',alignItems:'center',gap:7,flexShrink:0}},
    e('span',{style:{fontSize:'0.67rem',fontFamily:UI_FONT,letterSpacing:'0.5px',
      color:isEss?'#C084FC':'var(--btn-off)',fontWeight:isEss?700:400}},'Ess'),
    e('button',{onClick:()=>setLevel(isEss?'full':'essentials'),
      'aria-label':'Currently '+level+' — tap to switch',
      style:{background:'none',border:'none',cursor:'pointer',padding:0,lineHeight:0,flexShrink:0}},
      e('svg',{width:30,height:46,viewBox:'0 0 30 46',style:{display:'block'}},
        e('defs',null,
          e('linearGradient',{id:'gt-shaft',x1:'0',y1:'0',x2:'1',y2:'0'},
            e('stop',{offset:'0%',stopColor:'#777'}),
            e('stop',{offset:'45%',stopColor:'#ddd'}),
            e('stop',{offset:'100%',stopColor:'#777'})
          ),
          e('radialGradient',{id:'gt-pivot',cx:'38%',cy:'32%'},
            e('stop',{offset:'0%',stopColor:'#aaa'}),
            e('stop',{offset:'100%',stopColor:'#2a2040'})
          ),
          e('linearGradient',{id:'gt-tip',x1:'0',y1:'0',x2:'1',y2:'1'},
            e('stop',{offset:'0%',stopColor:'#f0e8d0'}),
            e('stop',{offset:'100%',stopColor:'#c8a060'})
          )
        ),
        // Housing plate
        e('rect',{x:2,y:2,width:26,height:42,rx:5,
          fill:'#1a1428',stroke:'#3a3060',strokeWidth:1.5}),
        // Top highlight
        e('rect',{x:5,y:4,width:20,height:8,rx:3,fill:'white',opacity:0.06}),
        // Slot groove
        e('rect',{x:13,y:9,width:4,height:24,rx:2,
          fill:'#08060e',stroke:'#25203a',strokeWidth:0.5}),
        // Lever — CSS transition rotates around pivot
        e('g',{style:{
          transform:'rotate('+ang+'deg)',
          transformOrigin:'15px 32px',
          transition:'transform 0.14s cubic-bezier(0.4,0,0.2,1)'}},
          // Shaft
          e('rect',{x:13,y:18,width:4,height:14,rx:2,fill:'url(#gt-shaft)'}),
          // Tip knob
          e('ellipse',{cx:15,cy:16,rx:5.5,ry:6,
            fill:'url(#gt-tip)',stroke:'#a08050',strokeWidth:0.5}),
          // Tip highlight
          e('ellipse',{cx:13.5,cy:14,rx:2,ry:2.5,fill:'white',opacity:0.22})
        ),
        // Pivot
        e('circle',{cx:15,cy:32,r:3.5,fill:'url(#gt-pivot)'}),
        e('circle',{cx:15,cy:32,r:1.2,fill:'#555'})
      )
    ),
    e('span',{style:{fontSize:'0.67rem',fontFamily:UI_FONT,letterSpacing:'0.5px',
      color:!isEss?'#C084FC':'var(--btn-off)',fontWeight:!isEss?700:400}},'Full')
  );
}

// ── Tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS=[
  {target:'key-chip',    title:'Set your key',            text:'Tap to open the key picker. Every chord and scale in the app updates to match the key you choose.'},
  {target:'level-switch',title:'Essentials or Full',      text:'This toggle controls how much of the app you see. Essentials keeps things simple — the right starting point. Flip to Full later when you\'re ready for more advanced chord types and techniques.'},
  {target:'chord-row',   title:'The chords in a key',     text:'Each button is one of the seven chords that naturally occur in the key. The number (I through VII) is its position in the key — you\'ll learn what that means in the Guide.'},
  {target:'voicing-tabs',title:'How to play each chord',  text:'These tabs show different ways to arrange the same chord on the guitar — different string sets, different note on the bottom. Start with Shell, which uses just three strings.'},
  {target:'neck-area',   title:'The fretboard',           text:'The colored dots show where to put your fingers for the selected chord shape. Dimmer dots show every other place those same notes appear on the neck.'},
  {target:'bottom-nav',  title:'Where to start',          text:'We recommend starting with the ⚑ Guide — it walks you through jazz harmony from the ground up and opens the right tool at each step. Tap it now to begin.'},
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
      border:'2px solid #4ECDC4',borderRadius:8,
      boxShadow:'0 0 12px #4ECDC466',pointerEvents:'none'}}),
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
      width:'min(360px,90vw)',background:'#0d1a2a',border:'1px solid #1a4a6a',
      borderRadius:12,padding:'16px 18px',pointerEvents:'auto',
      boxShadow:'0 8px 32px rgba(0,0,0,0.8)',zIndex:201
    }},
      e('div',{style:{fontSize:'0.67rem',color:'#4ECDC4',letterSpacing:'2px',marginBottom:5}},
        (step+1)+' / '+TOUR_STEPS.length),
      e('div',{style:{fontFamily:SERIF,fontSize:'1.0rem',fontWeight:700,color:'#e8d8a0',marginBottom:7}},s.title),
      e('div',{style:{fontSize:'0.81rem',color:'#9ab8d8',lineHeight:1.65,marginBottom:14}},s.text),
      e('div',{style:{display:'flex',gap:8,justifyContent:'flex-end'}},
        e('button',{onClick:onSkip,style:{padding:'6px 14px',borderRadius:8,border:'1px solid #1a4a6a',
          background:'transparent',color:'#4a7a9a',fontFamily:UI_FONT,fontSize:'0.79rem',cursor:'pointer',minHeight:36}},
          'Skip tour'),
        e('button',{onClick:onNext,style:{padding:'6px 20px',borderRadius:8,border:'none',
          background:'#4ECDC4',color:'#07070f',fontFamily:UI_FONT,fontSize:'0.82rem',
          fontWeight:700,cursor:'pointer',minHeight:36}},
          isLast?'Done':'Next →')
      )
    )
  );
}

// ── NeckSVG ───────────────────────────────────────────────────────────
function NeckSVG({arpPos,highlight,scalePos,degNames,hlTc,dotMode,dotKeyIdx}){
  hlTc=hlTc||TC;
  dotMode=dotMode||'interval';
  dotKeyIdx=dotKeyIdx===undefined?0:dotKeyIdx;
  const FW=44,SH=30,PL=38,PT=28,PB=28,NF=15;
  const W=PL+NF*FW+24,H=PT+5*SH+PB;
  const nx=f=>PL+(f-0.5)*FW;
  const sy=si=>PT+(5-si)*SH;
  const hiMap={};
  (highlight||[]).forEach(h=>{hiMap[h.s+'-'+h.f]=h;});
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
      e('text',{key:'fn'+f,x:nx(f),y:H-8,textAnchor:'middle',style:{fill:'var(--neck-lbl)'},fontSize:9,fontFamily:UI_FONT},f)
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
        e('circle',{cx,cy:sy(p.s),r:10,fill:TC_DIM[p.ti],stroke:TC[p.ti],strokeWidth:1.3}),
        e('text',{x:cx,y:sy(p.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:TC[p.ti],fontSize:7.5,fontFamily:UI_FONT,pointerEvents:'none'},
          noteForDot(dotMode,degNames[p.ti],(OPEN_PC[p.s]+p.f)%12,dotKeyIdx))
      );
    }),
    (highlight||[]).map((h,i)=>{
      const cx=h.f===0?OPEN_X:nx(h.f);
      return e('g',{key:'hi'+i,filter:'url(#ng)'},
        e('circle',{cx,cy:sy(h.s),r:h.f===0?11:13,fill:hlTc[h.ti],stroke:'var(--hi-dot-str)',strokeWidth:1.8}),
        e('text',{x:cx,y:sy(h.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'var(--dot-lbl)',fontSize:10,fontWeight:'bold',fontFamily:UI_FONT},
          noteForDot(dotMode,h.dl,(OPEN_PC[h.s]+h.f)%12,dotKeyIdx))
      );
    })
  );
}

// ── ChordBox ──────────────────────────────────────────────────────────
function ChordBox({voicing,strings,tones,degNames,invLabel,bassLabel,selected,onClick,tcArr,dotMode,dotKeyIdx}){
  const tc=tcArr||TC;
  dotMode=dotMode||'interval';
  dotKeyIdx=dotKeyIdx===undefined?0:dotKeyIdx;
  if(!voicing) return null;
  const frets=voicing.frets;
  const allF=[null,null,null,null,null,null];
  frets.forEach((f,i)=>{allF[strings[i]]=f;});
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
      e('rect',{width:W,height:H,rx:9,fill:selected?'var(--cb-sel)':'var(--cb-bg)',stroke:selected?'#4ECDC4':BORDER,strokeWidth:selected?2:1.5}),
      e('text',{x:W/2,y:20,textAnchor:'middle',fill:selected?'#4ECDC4':BTN_OFF,fontSize:13,fontWeight:selected?'bold':'normal',fontFamily:UI_FONT},invLabel),
      bassLabel?e('text',{x:W/2,y:38,textAnchor:'middle',fill:selected?'#4ECDC488':HINT,fontSize:11,fontFamily:UI_FONT},bassLabel):null,
      !showNut?e('text',{x:3,y:PT+FS/2,dominantBaseline:'middle',fill:HINT,fontSize:10,fontFamily:UI_FONT},SF+'fr'):null,
      showNut?e('rect',{x:sx(0)-2,y:PT-5,width:5*SS+4,height:5,fill:'#c8a855',rx:1.5}):null,
      Array.from({length:NF+1},(_,k)=>
        e('line',{key:'frl'+k,x1:sx(0),y1:PT+k*FS,x2:sx(5),y2:PT+k*FS,stroke:(k===0&&showNut)?'#c8a855':'#22223a',strokeWidth:1})
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
        return e('g',{key:'dt'+i},
          e('circle',{cx:sx(i),cy:fy(f),r:9,fill:ti2>=0?tc[ti2]:'#556',stroke:'var(--hi-dot-str)',strokeWidth:1}),
          e('text',{x:sx(i),y:fy(f),textAnchor:'middle',dominantBaseline:'middle',fill:'var(--dot-lbl)',fontSize:7,fontWeight:'bold',fontFamily:UI_FONT},
            ti2>=0?noteForDot(dotMode,degNames[ti2],(OPEN_PC[i]+f)%12,dotKeyIdx):'')
        );
      })
    )
  );
}

// ── ScalePanel ────────────────────────────────────────────────────────
function ScalePanel({degree,chordRoot,tones,degNames,keyIdx,scaleIdx,onScaleChange,level}){
  // Essentials keeps one scale per chord — the diatonic default
  const options=level==='essentials'?CHORD_SCALES[degree].slice(0,1):CHORD_SCALES[degree];
  const sc=options[Math.min(scaleIdx,options.length-1)];
  const parentRoot=getParentRoot(chordRoot,sc.pType,sc.mPos);
  const parentLabel=nn(parentRoot,keyIdx)+' '+PTYPE_NAME[sc.pType];
  const sameAsKey=sc.pType==='major'&&parentRoot===KEYS[keyIdx].root;
  const noteRow=sc.iv.map(interval=>{
    const pc=(chordRoot+interval)%12;
    const ti=tones.indexOf(pc);
    return{noteName:nn(pc,keyIdx),interval,isTone:ti>=0,ti};
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
            border:'1.5px solid '+(n.isTone?TC[n.ti]:BTN_BRD),
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:n.isTone?'0 0 8px '+TC[n.ti]+'44':'none'}},
            e('span',{style:{fontSize:'0.71rem',fontWeight:700,fontFamily:UI_FONT,color:n.isTone?'white':'var(--note-non-chord-txt)'}},n.noteName)
          ),
          e('span',{style:{fontSize:'0.64rem',fontFamily:UI_FONT,color:n.isTone?TC[n.ti]+'cc':'var(--note-iv-txt)'}},INT_NAMES[n.interval])
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
    e('div',{style:{fontSize:'0.6rem',color:LBL,letterSpacing:'2px',marginBottom:6}},title),
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
  major:{lbl:'II–V–I',col:'#4ECDC4',bg:ACT_TEAL,
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
            [11,'m7b5','ø7','VIIø7'],[4,'dom7','7','III7'],[9,'m7','m7','VIm7'],[9,'m7','m7','VIm7']],
    bars:[0,1,2,3,4,5,6,7],
    tip:'Autumn Leaves contains two II–V–I cycles: IIm7→V7→Imaj7 in the major key, then VIIø7→III7→VIm7 in the relative minor. Root motion descends in 4ths throughout.'},
};

// ── IIVIView ──────────────────────────────────────────────────────────
function IIVIView({keyIdx,dotMode,setDotMode}){
  dotMode=dotMode||'interval';
  const [strSetIdx,setStrSetIdx]=useState(()=>parseInt(localStorage.getItem('jg-strSet')||'2',10));
  const [invIdxs,setInvIdxs]=useState([0,0,0,0,0,0,0,0]);
  const [activeChordIdx,setActiveChordIdx]=useState(0);
  const [isPlaying,setIsPlaying]=useState(false);
  const [bpm,setBpm]=useState(()=>parseInt(localStorage.getItem('jg-bpm')||'120',10));
  const [bassEnabled,setBassEnabled]=useState(()=>localStorage.getItem('jg-bass')!=='false');
  const [metronomeEnabled,setMetronomeEnabled]=useState(()=>localStorage.getItem('jg-met')!=='false');
  const [form,setForm]=useState(()=>{
    const f=localStorage.getItem('jg-form');
    if(f&&FORM_DEFS[f]) return f;
    return localStorage.getItem('jg-minor')==='true'?'minor':'major';
  });
  const [playingChordIdx,setPlayingChordIdx]=useState(null);
  const [playingBar,setPlayingBar]=useState(null);

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
  const wafPlayerRef=useRef(null);
  const wafReadyRef=useRef(false);
  const wafFontLoadedRef=useRef(false);
  const tapTimesRef=useRef([]);
  bpmRef.current=bpm;
  bassRef.current=bassEnabled;
  metronomeRef.current=metronomeEnabled;

  useEffect(()=>{localStorage.setItem('jg-strSet',strSetIdx);},[strSetIdx]);
  useEffect(()=>{localStorage.setItem('jg-bpm',bpm);},[bpm]);
  useEffect(()=>{localStorage.setItem('jg-bass',bassEnabled);},[bassEnabled]);
  useEffect(()=>{localStorage.setItem('jg-met',metronomeEnabled);},[metronomeEnabled]);
  useEffect(()=>{localStorage.setItem('jg-form',form);},[form]);

  const def=FORM_DEFS[form];
  const chords=def.chords.map(([off,quality,sym,roman])=>{
    const rootPC=(KEYS[keyIdx].root+off)%12;
    const tones=getChordTones(rootPC,quality);
    return{rootPC,quality,tones,dnames:DNAMES[quality],
      name:nn(rootPC,keyIdx)+sym,roman};
  });
  chordsRef.current=chords;
  barsRef.current=def.bars;

  const ssIdx=Math.min(strSetIdx,D2_SETS.length-1);
  const ss=D2_SETS[ssIdx].s;
  const ac=chords[activeChordIdx];

  const arpPos=useMemo(()=>getArpPos(ac.tones),[activeChordIdx,keyIdx,form]);
  const activeVoicings=useMemo(()=>D2_INV.map(inv=>calcVoicing(ss,inv.a,ac.tones)),[activeChordIdx,strSetIdx,keyIdx,form]);
  const highlight=useMemo(()=>{
    const v=activeVoicings[invIdxs[activeChordIdx]];
    if(!v) return null;
    return v.frets.map((f,i)=>{
      const si=ss[i],ti=ac.tones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?ac.dnames[ti]:''};
    });
  },[activeVoicings,invIdxs,activeChordIdx,strSetIdx,form]);

  function loadBassFont(ctx){
    if(!window.WebAudioFontPlayer) return;
    wafReadyRef.current=false;
    const player=new window.WebAudioFontPlayer();
    wafPlayerRef.current=player;
    const fontVar='_tone_0320_Acoustic_Bass_sf2_file';
    function decodeFont(){
      player.loader.decodeAfterLoading(ctx,fontVar);
      player.loader.waitLoad(()=>{wafReadyRef.current=true;});
    }
    if(wafFontLoadedRef.current||window[fontVar]){
      wafFontLoadedRef.current=true;
      decodeFont();
    } else {
      const s=document.createElement('script');
      s.src='https://surikov.github.io/webaudiofont/npm/dist/sf2js/0320_Acoustic_Bass_sf2_file.js';
      s.crossOrigin='anonymous';
      s.onload=()=>{wafFontLoadedRef.current=true;decodeFont();};
      s.onerror=()=>{};
      document.head.appendChild(s);
    }
  }

  function playBassNote(ctx,pc,startTime,beatDur,accent){
    const midiNote=36+((pc%12+12)%12); // C2–B2 register
    const vol=accent?1.0:0.65;
    // Real samples via WebAudioFont
    const player=wafPlayerRef.current;
    const fontVar='_tone_0320_Acoustic_Bass_sf2_file';
    if(player&&wafReadyRef.current&&window[fontVar]){
      try{
        player.queueWaveTable(ctx,ctx.destination,window[fontVar],startTime,midiNote,beatDur*0.88,vol);
        return;
      }catch(e){}
    }
    // Fallback: KS one octave down
    const bufs=ksBufsRef.current;
    if(!bufs) return;
    const normalPc=(pc%12+12)%12;
    const src=ctx.createBufferSource();
    src.buffer=bufs[normalPc];
    src.playbackRate.value=0.5;
    const gain=ctx.createGain();
    const pk=accent?0.70:0.44;
    gain.gain.setValueAtTime(pk,startTime);
    gain.gain.exponentialRampToValueAtTime(0.001,startTime+beatDur*0.92);
    src.connect(gain);gain.connect(ctx.destination);
    src.start(startTime);src.stop(startTime+beatDur);
  }

  function startPlayback(){
    const allVoicings=chords.map(chord=>D2_INV.map(inv=>calcVoicing(ss,inv.a,chord.tones)));
    const idxs=[...invIdxs];
    for(let i=1;i<chords.length;i++)
      idxs[i]=findBestInvIdx(allVoicings[i-1][idxs[i-1]],allVoicings[i]);
    setInvIdxs(idxs);
    setActiveChordIdx(0);
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ctx;
    ksBufsRef.current=precomputeKS(ctx);
    clickBufsRef.current={accent:makeClickBuf(ctx,1200,0.90),normal:makeClickBuf(ctx,800,0.55)};
    if(bassRef.current) loadBassFont(ctx);
    nextTimeRef.current=ctx.currentTime+0.05;
    beatRef.current=0;
    const gen=++genRef.current;
    setIsPlaying(true);
    function tick(){
      if(!audioCtxRef.current) return;
      const beatDur=60/bpmRef.current;
      while(nextTimeRef.current < audioCtxRef.current.currentTime+0.12){
        const bars=barsRef.current;
        const beat=beatRef.current%(bars.length*4);
        const bar=Math.floor(beat/4);
        const ci=bars[bar];
        // walk R-3-5-7 each bar; resolve R-5-3-R on a final repeated-chord bar
        const lastSame=bar===bars.length-1&&bars[bar-1]===ci;
        const ti=(lastSame?[0,2,1,0]:[0,1,2,3])[beat%4];
        const delay=Math.max(0,(nextTimeRef.current-audioCtxRef.current.currentTime)*1000);
        setTimeout(()=>{if(genRef.current===gen){setPlayingChordIdx(ci);setPlayingBar(bar);setActiveChordIdx(ci);}},delay);
        if(bassRef.current && chordsRef.current){
          playBassNote(ctx,chordsRef.current[ci].tones[ti],nextTimeRef.current,beatDur,beat%4===0);
        }
        if(metronomeRef.current && clickBufsRef.current){
          const buf=beat%4===0?clickBufsRef.current.accent:clickBufsRef.current.normal;
          playClick(ctx,buf,nextTimeRef.current);
        }
        nextTimeRef.current+=beatDur;
        beatRef.current++;
      }
      timerRef.current=setTimeout(tick,25);
    }
    tick();
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
      setBpm(Math.max(40,Math.min(300,Math.round(60000/avg))));
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
    setInvIdxs([0,0,0,0,0,0,0,0]);setActiveChordIdx(0);
  },[keyIdx,form]);

  const modeBtn=(act,col,actBg)=>({padding:'6px 13px',borderRadius:5,cursor:'pointer',
    fontFamily:UI_FONT,fontSize:'0.78rem',border:'1px solid '+(act?col:BTN_BRD),
    background:act?actBg:'transparent',color:act?col:BTN_OFF,fontWeight:act?700:400,minHeight:44});
  const playBtn={padding:'6px 18px',background:isPlaying?ACT_RED:ACT_TEAL,
    border:'1px solid '+(isPlaying?'#FF6B6B':'#4ECDC4'),borderRadius:6,
    color:isPlaying?'#FF6B6B':'#4ECDC4',cursor:'pointer',fontFamily:UI_FONT,
    fontSize:'0.85rem',fontWeight:'bold',letterSpacing:'1px',minHeight:44};
  const bpmStepBtn={padding:'4px 11px',background:'transparent',
    border:'1px solid '+BTN_BRD,borderRadius:4,color:BTN_OFF,cursor:'pointer',
    fontFamily:UI_FONT,fontSize:'0.9rem',minHeight:44};
  const tapBtn={padding:'6px 10px',background:'transparent',
    border:'1px solid '+BTN_BRD,borderRadius:4,color:BTN_OFF,cursor:'pointer',
    fontFamily:UI_FONT,fontSize:'0.78rem',minHeight:44};
  const bassBtn={padding:'6px 14px',background:bassEnabled?ACT_BLUE:'transparent',
    border:'1px solid '+(bassEnabled?'#74C0FC':BTN_BRD),borderRadius:6,
    color:bassEnabled?'#74C0FC':BTN_OFF,cursor:'pointer',fontFamily:UI_FONT,
    fontSize:'0.82rem',minHeight:44};
  const metBtn={padding:'6px 14px',background:metronomeEnabled?ACT_YEL:'transparent',
    border:'1px solid '+(metronomeEnabled?'#FFD43B':BTN_BRD),borderRadius:6,
    color:metronomeEnabled?'#FFD43B':BTN_OFF,cursor:'pointer',fontFamily:UI_FONT,
    fontSize:'0.82rem',minHeight:44};

  return e('div',null,
    // String set selector
    e('div',{style:{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}},
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
      D2_SETS.map((set,i)=>
        e('button',{key:i,onClick:()=>setStrSetIdx(i),style:mkSsBtn(strSetIdx===i)},set.lbl)
      ),
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginLeft:8}},'FORM'),
      Object.keys(FORM_DEFS).map(f=>
        e('button',{key:f,onClick:()=>setForm(f),style:modeBtn(form===f,FORM_DEFS[f].col,FORM_DEFS[f].bg)},FORM_DEFS[f].lbl)
      )
    ),
    // Play-along controls
    e('div',{style:{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',marginBottom:10,
      padding:'8px 12px',background:BG2,border:'1px solid '+BORDER,borderRadius:6}},
      e('span',{style:{fontSize:'0.75rem',color:LBL,letterSpacing:'2px',marginRight:2}},'PLAY-ALONG'),
      e('button',{onClick:isPlaying?stopPlayback:startPlayback,style:playBtn},
        isPlaying?'■ STOP':'▶ PLAY'),
      e('div',{style:{display:'flex',gap:4,alignItems:'center'}},
        e('button',{onClick:()=>setBpm(b=>Math.max(40,b-5)),style:bpmStepBtn},'−'),
        e('span',{style:{minWidth:38,textAlign:'center',color:'var(--txt)',fontFamily:UI_FONT,fontSize:'0.92rem',
          padding:'0 4px'}},bpm),
        e('button',{onClick:()=>setBpm(b=>Math.min(300,b+5)),style:bpmStepBtn},'+'),
        e('button',{onClick:handleTap,style:tapBtn},'TAP')
      ),
      e('button',{onClick:()=>setBassEnabled(v=>!v),style:bassBtn},'♩ BASS'),
      e('button',{onClick:()=>setMetronomeEnabled(v=>!v),style:metBtn},'◉ CLICK')
    ),
    // Form tracker — one cell per bar (wraps 4 per row), highlights current bar during playback
    e('div',{style:{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}},
      def.bars.map((ci,i)=>{
        const lit=isPlaying&&playingBar===i;
        return e('div',{key:i,style:{
          flex:'1 1 calc(25% - 5px)',minWidth:0,textAlign:'center',padding:'5px 4px',borderRadius:5,fontFamily:UI_FONT,
          border:'1px solid '+(lit?'#FFD43B':BORDER),
          background:lit?ACT_YEL:BG2,
          color:lit?'#FFD43B':BTN_OFF,
          transition:'background 0.08s,border-color 0.08s,color 0.08s'
        }},
          e('div',{style:{fontSize:'0.62rem',opacity:0.7,letterSpacing:'1px',marginBottom:2}},chords[ci].roman),
          e('div',{style:{fontSize:'0.82rem',fontWeight:lit?700:400}},chords[ci].name)
        );
      })
    ),
    // Neck label + dot mode
    e('div',{style:{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap',marginBottom:4}},
      e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',flexGrow:1}},
        'NECK — '+ac.roman+' · '+ac.name),
      setDotMode?e(DotModeToggle,{dotMode,setDotMode}):null
    ),
    // Neck
    e('div',{style:{background:'var(--neck-wrap)',border:'1px solid '+BORDER,borderRadius:9,
      padding:'8px 4px 4px',marginBottom:12,overflowX:'auto'}},
      e('div',{style:{minWidth:680}},
        e(NeckSVG,{arpPos,highlight,scalePos:[],degNames:ac.dnames,dotMode,dotKeyIdx:keyIdx})
      )
    ),
    // Three chord columns
    e('div',{style:{display:'flex',gap:14,flexWrap:'wrap'}},
      chords.map((chord,ci)=>{
        const voicings=D2_INV.map(inv=>calcVoicing(ss,inv.a,chord.tones));
        const isActive=activeChordIdx===ci;
        const isNowPlaying=playingChordIdx===ci;
        const borderColor=isNowPlaying?'#FFD43B':isActive?'#4ECDC4':BORDER;
        const bgColor=isNowPlaying?ACT_YEL:isActive?ACT_TEAL:BG2;
        const romanColor=isNowPlaying?'#FFD43B':isActive?'#4ECDC4':LBL;
        return e('div',{key:ci,style:{flex:'1 1 200px',minWidth:190}},
          e('div',{style:{marginBottom:8,padding:'8px 12px',background:bgColor,
            border:'1px solid '+borderColor,borderRadius:6,cursor:'pointer',
            transition:'border-color 0.12s,background 0.12s'},
            onClick:()=>setActiveChordIdx(ci)},
            e('div',{style:{fontSize:'0.73rem',color:romanColor,letterSpacing:'2px',marginBottom:2}},chord.roman),
            e('div',{style:{fontFamily:SERIF,fontSize:'1.1rem',fontWeight:700,color:GOLD,marginBottom:4}},chord.name),
            e('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
              chord.tones.map((t,ti)=>
                e('span',{key:ti,style:{fontSize:'0.77rem',color:TC[ti],fontFamily:UI_FONT}},
                  chord.dnames[ti]+'='+nn(t,keyIdx))
              )
            )
          ),
          // Inversion diagrams
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
            D2_INV.map((inv,ii)=>
              e(ChordBox,{key:ii,voicing:voicings[ii],strings:ss,tones:chord.tones,
                degNames:chord.dnames,invLabel:ii===0?'Root pos.':chord.dnames[inv.bassIdx]+' bass',
                bassLabel:ii===0?'bass: '+chord.dnames[inv.bassIdx]:null,
                selected:isActive&&invIdxs[ci]===ii,
                dotMode,dotKeyIdx:keyIdx,
                onClick:()=>{
                  const n=[...invIdxs];n[ci]=ii;setInvIdxs(n);
                  setActiveChordIdx(ci);
                }
              })
            )
          )
        );
      })
    ),
    // Voice-leading tip
    e('div',{style:{marginTop:12,padding:'8px 12px',background:BG2,border:'1px solid '+BORDER,
      borderRadius:6,fontSize:'0.79rem',color:HINT,lineHeight:1.6}},
      e('span',{style:{color:GOLD,fontWeight:700}},'Voice leading tip: '),
      def.tip
    )
  );
}

// ── CustomChordView ───────────────────────────────────────────────────
// Reuses the same voicing UI as the diatonic view. Receives the active
// chord data as props and renders controls + neck + chord boxes.
function CustomChordView({customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level,dotMode,setDotMode}){
  dotMode=dotMode||'interval';
  const isEss=level==='essentials';
  const [vType,setVType]=useState('shell');
  const [ssIdx,setSsIdx]=useState(2);
  const [invIdx,setInvIdx]=useState(0);
  const [shellIdx,setShellIdx]=useState(0);
  const [extOpt,setExtOpt]=useState(null); // active extension id or null
  useEffect(()=>{if(isEss&&(vType==='drop3'||vType==='drop24'||vType==='drop23'))setVType('drop2');},[level]);
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
        e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:6}},'ROOT'),
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
        e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:6}},'CHORD TYPE'),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
          (isEss?EXT_TYPES.slice(0,4):EXT_TYPES).map((t,i)=>
            e('button',{key:i,onClick:()=>{setCustomTypeIdx(i);setInvIdx(0);},style:{
              padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.74rem',
              border:'1px solid '+(customTypeIdx===i?'#C084FC':BTN_BRD),
              background:customTypeIdx===i?ACT_PUR:BG2,
              color:customTypeIdx===i?'#C084FC':BTN_OFF,fontWeight:customTypeIdx===i?700:400,
              minHeight:44}},t.sym)
          )
        )
      )
    ),
    // Extension row (only for base 7th chord types that have available extensions)
    availExts.length>0?e('div',{style:{display:'flex',gap:6,flexWrap:'wrap',marginBottom:12,alignItems:'center'}},
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'EXTENSION'),
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
      padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:GOLD,fontStyle:'italic'}},chordName),
      e('span',{style:{fontSize:'0.79rem',color:LBL}},'standalone — '+baseType.label+(extDef?' + '+extDef.dn:'')+'  (5th '+(extDef?'→ '+extDef.dn:'included')+')'),
      e('div',{style:{display:'flex',gap:12,flexWrap:'wrap',marginLeft:'auto'}},
        tones.map((t,i)=>
          e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5,fontSize:'0.76rem',color:TC[i]}},
            e('span',{style:{width:8,height:8,borderRadius:'50%',background:TC[i],display:'inline-block',flexShrink:0}}),
            degNames[i]+'='+nn(t,0)
          )
        )
      )
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
        e('span',{key:'lbl',style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
        setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl))
      ]:null,
      vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Guide tones: R + 3rd + 7th'):null,
      vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions on neck'):null
    ),
    // Neck (with dot-mode toggle)
    e('div',{style:{marginBottom:6}},setDotMode?e(DotModeToggle,{dotMode,setDotMode}):null),
    e('div',{style:{background:'var(--neck-wrap)',border:'1px solid '+BORDER,borderRadius:9,
      padding:'8px 4px 4px',marginBottom:10,overflowX:'auto'}},
      e('div',{style:{minWidth:680}},
        e(NeckSVG,{arpPos,highlight,scalePos:[],degNames,dotMode,dotKeyIdx:customRoot})
      )
    ),
    // Chord diagrams
    DROP_TYPES.has(vType)?
      e(DiagSection,{title:DROP_LBL[vType]+' INVERSIONS'},
        allVoicings.every(v=>!v)?e(NoShapes,null):
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:i===0?'Root pos.':degNames[inv.bassIdx]+' bass',
            bassLabel:i===0?'bass: '+degNames[inv.bassIdx]:null,
            selected:invIdx===i,onClick:()=>setInvIdx(i),dotMode,dotKeyIdx:customRoot})
        )
      ):null,
    vType==='shell'?e('div',null,
      e(DiagSection,{title:'FORM A — SKIP-STRING'},
        shellsA.map(x=>
          e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:customRoot})
        )
      ),
      e(DiagSection,{title:'FORM B — ADJACENT STRINGS'},
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
  // Path progress, persisted
  const [done,setDone]=useState(()=>{try{return JSON.parse(localStorage.getItem('jg-path')||'{}');}catch(ex){return{};}});
  useEffect(()=>{localStorage.setItem('jg-path',JSON.stringify(done));},[done]);
  function togDone(id){setDone(s=>({...s,[id]:!s[id]?true:undefined}));}
  const S={marginBottom:14,padding:'14px 16px',background:BG2,border:'1px solid '+BORDER,borderRadius:8};
  const H={fontFamily:SERIF,fontSize:'1.05rem',fontWeight:700,color:'var(--scale-name)',marginBottom:8};
  const P={fontSize:'0.80rem',lineHeight:1.75,color:'var(--txt)',fontFamily:UI_FONT,marginBottom:8};
  const LI={fontSize:'0.80rem',lineHeight:1.7,color:'var(--txt)',fontFamily:UI_FONT,paddingLeft:16};
  const HL={color:'var(--scale-name)',fontWeight:700};
  const TC4={color:'#4ECDC4'};const TRD={color:'#FF6B6B'};
  const TBL={color:'#74C0FC'};const TYL={color:'#FFD43B'};
  function sec(title,...ch){return e('div',{style:S},e('div',{style:H},title),...ch);}
  function p(...k){return e('p',{style:P},...k);}
  function ul(...items){return e('ul',{style:{listStyle:'none',margin:'0 0 8px'}},
    ...items.map((it,i)=>e('li',{key:i,style:LI},'• ',it)));}
  function callout(...k){
    return e('div',{style:{background:'#091a2a',border:'1px solid #1a3a5a',borderRadius:6,
      padding:'8px 12px',marginBottom:8,fontSize:'0.79rem',lineHeight:1.7,color:'#9ab8d8',fontFamily:UI_FONT}},...k);
  }
  function gloss(id,term,short,...detail){
    const open=expanded['g_'+id];
    return e('div',{key:id,style:{borderBottom:'1px solid '+BORDER,paddingBottom:8,marginBottom:8,cursor:'pointer'},
      onClick:()=>tog('g_'+id)},
      e('div',{style:{display:'flex',gap:6,alignItems:'baseline'}},
        e('span',{style:{color:GOLD,fontSize:'0.85rem',flexShrink:0,fontFamily:UI_FONT}},open?'▾':'▸'),
        e('span',{style:{fontFamily:UI_FONT,fontSize:'0.84rem',fontWeight:700,color:'var(--txt)'}},term),
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
     body:['Jazz harmony is built on four types of 7th chord. A 7th chord has four notes — a root, a 3rd, a 5th, and a 7th — stacked in thirds. What makes each type sound the way it does is the specific combination of intervals between those notes.',
           'Major 7 (Cmaj7): stable, lush — the I chord, the "home" sound. Minor 7 (Dm7): smooth, slightly unresolved — the II and VI chords. Dominant 7 (G7): tense, pulling toward resolution — the V chord. Half-diminished (Bm7♭5): unstable, searching — the VII chord and the II of a minor key.'],
     items:['In the app, open Chords and click through I, II, V and VII — one chord of each quality','Set the dot mode to "Interval" to see exactly which intervals make up each chord','Listen: can you name the quality before reading the label?']},
    {id:'shells',title:'Shell voicings — your first jazz grips',
     preset:{view:'diatonic',key:0,deg:0,vType:'shell'},
     body:['A shell voicing uses just three notes: root, 3rd, and 7th. The 5th is left out because it adds no harmonic information the other two notes don\'t already provide — it just says "this is a chord," which the 3rd and 7th already say more precisely.',
           'The 3rd defines major vs. minor. The 7th defines major 7 vs. dominant 7 vs. minor 7. Those two notes are called "guide tones" — they are the essential DNA of the chord. Form A (R-7-3) uses a skip-string layout; Form B (R-3-7) sits on three adjacent strings.'],
     items:['Play all 7 chords of C major as shells, 6th-string roots first','Say each chord name aloud as you land it — the ear-to-name connection is the real goal','Notice which notes change from one chord to the next and which stay the same']},
    {id:'iivi',title:'The II–V–I — jazz\'s engine',
     preset:{view:'iivi',key:0,form:'major',bpm:60},
     body:['Three chords, three scale degrees, one of the most powerful harmonic patterns in Western music. In C major: Dm7 (II) → G7 (V) → Cmaj7 (I). It appears in virtually every jazz standard, in every key.',
           'Why does it work? The V7 chord contains a tritone — the interval between its 3rd and 7th (B and F in G7). A tritone is maximally unstable, and both notes want to resolve by half-step: B moves up to C, F moves down to E. Those are exactly the root and 3rd of Cmaj7. The resolution is built into the physics of the interval.',
           'The guide tones swap roles on each chord: the 7th of G7 (F) becomes the 3rd of Cmaj7 (E after resolution), and the 3rd of G7 (B) becomes the root of Cmaj7. This chain of guide tone movement is the engine of jazz voice leading.'],
     items:['In the Play tab, click each chord and watch which notes move and which stay','Pick a different II inversion — the app voice-leads the V and I to follow','Slow it down to 60 BPM and listen to how the V7 "wants" to go somewhere']},
    {id:'drop2',title:'Drop 2 — the comping workhorse',
     preset:{view:'diatonic',key:0,deg:0,vType:'drop2',ssIdx:2},
     body:['Drop 2 takes a "closed" chord (all four notes within one octave) and drops the second-highest note down an octave. This spreads the chord across four adjacent strings in a span that fits the human hand naturally.',
           'Every chord has four Drop 2 inversions — same four notes, a different note on the bottom each time. Root position, 1st inversion, 2nd inversion, 3rd inversion. They sit at different positions on the neck, which is what makes smooth voice leading possible: instead of jumping shapes, you find the inversion of the next chord closest to where you already are.'],
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
    {id:'keys',title:'Take it around the keys',
     preset:{view:'diatonic',key:7,deg:0,vType:'shell'},
     body:['Every concept so far works identically in all 12 keys — the interval relationships never change, only the pitch names do. This is what Roman numeral analysis is for: II–V–I in G♭ means exactly the same thing structurally as II–V–I in C.',
           'Jazz musicians practice in all 12 keys, traditionally moving around the cycle of fourths (C → F → B♭ → E♭ → A♭ → D♭ → G♭ → B → E → A → D → G → back to C). Each move is a 5th down (or 4th up). Most standards modulate or borrow from multiple keys — knowing the patterns in each key is not optional, it\'s infrastructure.'],
     items:['Change the key in the app and play the same shell shapes — notice they shift position but the hand shapes stay similar','In each new key: shells first, then Drop 2, then the Play-along','One new key per week = all 12 in three months']},
    {id:'scales',title:'Scales over chords — the melodic layer',
     preset:{view:'diatonic',key:0,deg:4,vType:'arpeggio'},
     body:['Every chord implies a scale — a set of notes that "belong" over it and define its color. In C major, each diatonic chord has a corresponding mode: the IIm7 gets Dorian (D E F G A B C), the V7 gets Mixolydian (G A B C D E F), the Imaj7 gets Ionian (the major scale itself).',
           'Modes are not separate scales learned in isolation — they are the same major scale heard from a different starting point. D Dorian and C major contain identical notes; what changes is which note feels like "home." Over IIm7, D feels like home, so D Dorian is the right frame.',
           'For the V7, Mixolydian is the neutral choice. Altered (7th mode of melodic minor) uses every altered tension — ♭9, ♯9, ♭13 — for maximum pull. The Scale panel in the Chords tab shows exactly which mode applies to each chord.'],
     items:['On the V7 chord, try playing only the four chord tones (use Arpeggio view to find them)', 'Then connect them with scale steps — that\'s the foundation of bebop melody','Switch to Altered scale in the Scale panel and hear how it intensifies the tension']},
    {id:'full',title:'Go Full — Drop 3, Rootless, altered colors',
     preset:{view:'diatonic',key:0,deg:4,vType:'rootless',level:'full'},
     body:['Full level adds four more tools: Drop 3 (3rd-highest note dropped, 6th-string bass — good for solo guitar), Rootless voicings (root replaced by 9th, designed to play over a walking bassist without doubling their note), Drop 2+4 and Drop 2+3 (wider spread voicings with more open sound), and extended chord types in the Any Chord view (9ths, altered, sus4).'],
     items:['Explore Rootless voicings — the 9th replacing the root creates a richer, more ambiguous sound','In Any Chord, try a 7alt voicing over the V chord and hear the tension','From here: the Glossary below and Next Steps are your map forward']},
  ];
  const doneCount=stages.filter(s=>done[s.id]).length;
  function stage(n,st){
    const isDone=!!done[st.id];
    return e('div',{key:st.id,style:{display:'flex',gap:12,padding:'12px 14px',marginBottom:10,
      background:BG,border:'1px solid '+(isDone?'#4ECDC440':BORDER),borderRadius:8,opacity:isDone?0.72:1}},
      e('div',{style:{flexShrink:0,width:26,height:26,borderRadius:'50%',
        border:'2px solid '+(isDone?'#4ECDC4':GOLD),color:isDone?'#4ECDC4':GOLD,
        display:'flex',alignItems:'center',justifyContent:'center',
        fontSize:'0.8rem',fontWeight:700,fontFamily:UI_FONT}},isDone?'✓':String(n)),
      e('div',{style:{flex:1}},
        e('div',{style:{fontFamily:SERIF,fontSize:'0.98rem',fontWeight:700,color:'var(--scale-name)',marginBottom:6}},st.title),
        st.body.map((t,i)=>e('p',{key:'b'+i,style:{...P,marginBottom:5}},t)),
        st.items&&st.items.length?ul(...st.items):null,
        e('div',{style:{display:'flex',gap:8,marginTop:8,flexWrap:'wrap'}},
          e('button',{onClick:()=>openPreset(st.preset),style:{
            padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.75rem',
            border:'1px solid #4ECDC4',background:ACT_TEAL,color:'#4ECDC4',fontWeight:700,minHeight:40}},'▶ Open in app'),
          e('button',{onClick:()=>togDone(st.id),style:{
            padding:'5px 14px',borderRadius:5,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.75rem',
            border:'1px solid '+(isDone?'#4ECDC4':BTN_BRD),background:isDone?ACT_TEAL:'transparent',
            color:isDone?'#4ECDC4':BTN_OFF,minHeight:40}},isDone?'✓ Done':'Mark done')
        )
      )
    );
  }
  return e('div',{style:{maxWidth:780}},
    sec('Intervals — the building blocks',
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
            ].map(([st,name,abbr,ex,feel],ri)=>
              e('tr',{key:ri,style:{background:ri%2===0?'transparent':'var(--bg2)'}},
                e('td',{style:{padding:'4px 10px',color:'#FFD43B',fontWeight:700,textAlign:'center'}},st),
                e('td',{style:{padding:'4px 10px',color:'var(--txt)',fontWeight:600}},name),
                e('td',{style:{padding:'4px 10px',color:'#4ECDC4',fontFamily:'Georgia,serif',fontStyle:'italic'}},abbr),
                e('td',{style:{padding:'4px 10px',color:'#74C0FC'}},[ex]),
                e('td',{style:{padding:'4px 10px',color:HINT,fontSize:'0.77rem'}},[feel])
              )
            )
          )
        )
      ),
      p('In the app, the colored dots on the neck each represent one chord-tone interval: ',
        e('span',{style:{color:'#FF6B6B',fontWeight:700}},'Root (R)'),', ',
        e('span',{style:{color:'#4ECDC4',fontWeight:700}},'3rd'),', ',
        e('span',{style:{color:'#74C0FC',fontWeight:700}},'5th'),', and ',
        e('span',{style:{color:'#FFD43B',fontWeight:700}},'7th'),
        '. The dimmer dots show every occurrence of those intervals across the whole neck; the bright ones are the voicing you\'ve selected.'
      )
    ),
    sec('Start Here',
      p('This guide assumes you can finger and strum chords from a chart, and that\'s all. No music theory background is needed — every concept is introduced from scratch, with an explanation of why it works, not just what it is. The goal is to understand jazz harmony well enough to use it, not just play through it.'),
      p('Jazz uses ',e('b',{style:HL},'four-note chords (7th chords)'),' as its basic unit. A standard triad (three notes) tells you major or minor. The 7th chord adds one more note — the 7th interval — and that extra note is what gives jazz its characteristic richness, tension, and color. Learning to hear, name, and voice these four chord types is the foundation of everything that follows.'),
      callout(e('b',null,'How to use this page: '),'The Path below is a step-by-step route. Each stage explains one concept and opens the right tool already configured. Mark stages done as you go. The Glossary at the bottom is your reference whenever a term is unfamiliar. Tap any chord diagram in the app to hear it.')
    ),
    e('div',{style:S},
      e('div',{style:{...H,display:'flex',justifyContent:'space-between',alignItems:'baseline',flexWrap:'wrap',gap:8}},
        e('span',null,'The Learning Path — from first chords to jazz'),
        e('span',{style:{fontSize:'0.72rem',fontFamily:UI_FONT,fontWeight:400,color:doneCount===stages.length?'#4ECDC4':HINT}},doneCount+' / '+stages.length+' done')
      ),
      p('Work top to bottom — each stage is about a week of practice, and slower is fine. Nothing is locked; the Path just says what matters now. Each button opens the right view, already set up.'),
      stages.map((st,i)=>stage(i+1,st))
    ),
    e('div',{style:S},
      e('div',{style:H},'Glossary — click any term'),
      gloss('7th','7th chord','A chord built from 4 notes instead of 3 — adds a 7th interval.',
        'A triad has 3 notes: root–3rd–5th. A 7th chord adds one more third on top: the 7th. This extra note creates the richer, more complex sound characteristic of jazz. The 7th can be major (a half-step below the octave, giving maj7), minor/flat (a whole-step below, giving dominant 7 or minor 7), or diminished.',
        'In practice: a plain "G" triad is G–B–D. "Gmaj7" adds F#. "G7" adds F♮ (flat 7). "Gm7" adds both ♭3 and ♭7: G–B♭–D–F.'
      ),
      gloss('maj7','Major 7 (maj7)','The stable, lush chord — the 7th is a half-step below the octave.',
        'Spelled root–3–5–7: Cmaj7 = C–E–G–B. The major 7th (B in C major) creates a warm, slightly floating sound — it sits one half-step below the octave C, like a gentle lean toward resolution that never quite arrives. This is the I chord in a major key and the IV chord.',
        'Maj7 is the defining color of jazz ballads, bossa nova, and sophisticated pop. It is the "home" chord — stable enough to feel resolved, colorful enough to linger on. In the app it appears as the I and IV chord in the Chords tab.'
      ),
      gloss('dom7','Dominant 7 (7)','The tension chord — creates strong pull toward resolution.',
        'Spelled root–3–5–♭7: G7 = G–B–D–F. The ♭7 (F) and the 3rd (B) are 6 half-steps apart — a tritone, the maximally tense interval in Western music. Both notes want to resolve by half-step (B up to C, F down to E), pulling strongly toward the Imaj7 a fifth below.',
        'In jazz the V7 is this chord, and it is the engine of the II–V–I. Adding altered tensions (♭9, ♯9, ♭13) increases the instability and the pull. The resolution V7 → I is the fundamental motion of all tonal harmony.'
      ),
      gloss('m7','Minor 7 (m7)','A smooth, mid-tension chord — neither fully resolved nor urgently tense.',
        'Spelled root–♭3–5–♭7: Dm7 = D–F–A–C. The flat 3rd gives it a minor quality; the flat 7th (shared with dominant 7) prevents it from feeling fully settled. It is floating — not tense enough to demand resolution, not stable enough to feel like home.',
        'In jazz the IIm7 chord is the starting point of the II–V–I. Dorian mode (natural minor with a raised 6th) is the standard improvisation scale over IIm7. The raised 6th is what separates Dorian from natural minor and gives it a warmer sound.'
      ),
      gloss('halfdim','Half-diminished (m7♭5, ø7)','A tense chord with a flattened 5th — rarer in rock, common in jazz.',
        'Spelled root–♭3–♭5–♭7: Bm7♭5 in C major = B–D–F–A. The flattened 5th adds instability beyond a regular minor 7. This chord naturally occurs on the VII degree of a major scale and on the II degree of a minor scale (where it\'s labelled IIø or IIm7♭5).',
        'In the app, switch to Minor mode in the II–V–I view to hear this chord as the IIø chord. It resolves through the V7 (usually with a ♭9) to the Im7.'
      ),
      gloss('inv','Inversion','Which note of the chord is at the lowest pitch.',
        'All four inversions of Cmaj7 contain the same four notes: C, E, G, B. The difference is which note sits at the bottom. Root position: C in bass. 1st inversion: E in bass. 2nd inversion: G in bass. 3rd inversion: B in bass.',
        'Why it matters: different inversions place the chord at different positions on the neck, creating different bass motion and voice leading possibilities. The 3rd inversion (7th in bass) creates the most forward momentum into the next chord. Mixing inversions is how you voice-lead a progression smoothly.'
      ),
      gloss('drop2','Drop 2','A specific way to arrange 4 chord notes across 4 adjacent guitar strings.',
        'Start with a "closed" position chord — all four notes stacked as tightly as possible within one octave. Take the second-highest note and move it down one octave. This spreads the chord across the strings in a natural, playable span.',
        'Example: Cmaj7 closed = E–G–B–C (low to high, all within one octave). Drop 2: take the B (2nd from top) and drop it an octave → B–E–G–C. This maps neatly to strings 4-3-2-1. Drop 2 is the most common jazz guitar voicing because the physical span fits the human hand and the chord sounds full without being muddy.'
      ),
      gloss('vl','Voice leading','Moving each note of a chord to the nearest note in the next chord.',
        'Instead of jumping shapes around the neck, find the inversion of the next chord where each individual note moves the smallest possible distance — ideally a half-step or whole-step. Each "voice" (string) leads smoothly to its counterpart.',
        'In practice: if you play Dm7 3rd inversion then G7 2nd inversion, each string only moves 1–2 frets. Compare that to jumping from open Dm7 to a 3rd-fret barre G7 — same chords, much bigger movement. Voice-led changes sound connected and intentional rather than choppy.',
        'The II–V–I view\'s play-along auto-selects the best V and I inversions based on whichever II inversion you pick.'
      ),
      gloss('guide','Guide tones','The 3rd and 7th of a chord — the notes that define its quality and move most dramatically.',
        'The root and 5th of a chord are "neutral" — they identify the chord but don\'t tell you much about its quality. The 3rd tells you major vs. minor. The 7th tells you major 7 vs. dominant 7 vs. minor 7. These two notes are called guide tones.',
        'In a G7 → Cmaj7 resolution: the 3rd of G7 (B) resolves up a half-step to C (the root of Cmaj7), and the 7th of G7 (F) resolves down a half-step to E (the 3rd of Cmaj7). These two half-step movements are the engine of jazz harmony. Practice hearing them in the play-along bass line.'
      ),
      gloss('diat','Diatonic','Using only the 7 notes of the key — playing "inside."',
        'The C major scale has 7 notes: C D E F G A B. Any note, chord, or phrase using only these 7 notes is "diatonic to C major." The 7 diatonic chords of C major are: Cmaj7, Dm7, Em7, Fmaj7, G7, Am7, Bm7♭5.',
        '"Chromatic" or "outside" means using notes not in the key. Jazz soloists move in and out deliberately — inside for stability, outside for tension. The Chords in Key view shows all 7 diatonic chords; the Scale panel shows exactly which scale notes are available over each one.'
      ),
      gloss('shell','Shell voicing','A 3-note chord using just root, 3rd, and 7th — the 5th is omitted.',
        'The 5th adds little harmonic information that the other notes don\'t already provide, so shells strip it out, leaving a minimal but complete harmonic statement. The result is open-sounding and leaves room for other instruments.',
        'Shell Form A uses skip-string layouts (e.g., strings 6-4-3). Form B uses adjacent strings (e.g., strings 6-5-4). Shells are often the first step toward playing with a bassist, since they leave the low end uncluttered. Find them under the "Shell" tab in Chords in Key or Any Chord.'
      ),
      gloss('rootless','Rootless voicing','A 4-note chord where the 9th replaces the root.',
        'When a bassist plays the root, your guitar chord can drop the root entirely and substitute the 9th (an octave above the 2nd scale degree). The chord becomes richer and more complex, and doesn\'t double the bass player\'s note.',
        'Type A voicings (3-5-7-9) have the 3rd at the bottom. Type B (7-9-3-5) have the 7th at the bottom. These are the voicings you\'ll hear Bill Evans and other jazz pianists use. On guitar they live on the middle strings (4-3-2-1 or 5-4-3-2). Find them in the Chords in Key view under "Rootless" (Full level).'
      ),
      gloss('arp','Arpeggio','Playing chord notes one at a time instead of simultaneously.',
        'An arpeggio is the melodic version of a chord — the notes played in sequence like a harp (the word comes from the Italian "arpa"). Every chord position on the neck can become a melodic pattern by playing the notes one at a time.',
        'In jazz improv, arpeggios outline the chord changes with precision: instead of running a pentatonic lick through everything, you follow the exact chord tones. This is fundamental to bebop — Charlie Parker and Dizzy Gillespie improvised by rapidly arpeggiating through the chord changes. The Arpeggio view shows all chord-tone positions across the neck.'
      ),
      gloss('modes','Modes (Dorian, Lydian, Mixolydian, Altered...)','Scales built from the same notes as a major scale but starting on a different degree.',
        'The C major scale is C D E F G A B. If you start on D and play through all 7 notes back to D, you get D Dorian: D E F G A B C. Same notes as C major, different starting pitch — and a completely different flavor. Each of the 7 starting positions creates a different mode.',
        'Dorian (start on 2nd degree): minor feel with a natural 6th — the standard scale for IIm7. Lydian (4th degree): major feel with a raised 4th (#11) — bright, floating, for Imaj7 or IVmaj7. Mixolydian (5th degree): major feel with a ♭7 — the sound of dominant 7. Altered (7th mode of melodic minor): all tensions altered (♭9 ♯9 ♭13) — maximum outside tension over V7.',
        'Start diatonic. As your ear develops, let the modes label what you\'re already hearing.'
      ),
      gloss('roman','Roman numerals (I, II, V...)','Labels for chord positions in a key — work the same in any key.',
        'In C major: I=Cmaj7, II=Dm7, III=Em7, IV=Fmaj7, V=G7, VI=Am7, VII=Bm7♭5. In G major: I=Gmaj7, II=Am7, V=D7. The Roman numeral names the scale degree; the chord quality (maj7, m7, 7) is stated separately. This lets musicians say "II–V–I in B♭" and every player knows exactly which chords are meant.',
        'Upper-case numerals (I, II, V) are used for all chords in jazz shorthand — the quality is indicated by the suffix. Lower-case (i, ii) sometimes indicates minor in classical notation, but in jazz the written suffix (m7, maj7) does that job instead.'
      )
    ),
    sec('Next Steps & Listening',
      p('Finished the Path? The Full level adds Drop 3, Rootless voicings, altered scales, and extended chord types. Concepts to explore beyond this app: tritone substitution, reharmonization, comping rhythms, chord melody, and playing over rhythm changes.'),
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
  const [showOnboarding,setShowOnboarding]=useState(()=>!localStorage.getItem('jg-visited'));
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
  const [viewMode,setViewMode]=useState(()=>localStorage.getItem('jg-viewMode')||'diatonic'); // 'diatonic'|'iivi'|'custom'|'guide'
  const [keyOpen,setKeyOpen]=useState(false);
  const [dotMode,setDotMode]=useState(()=>localStorage.getItem('jg-dotMode')||'interval');
  const [tourStep,setTourStep]=useState(null);
  useEffect(()=>{localStorage.setItem('jg-dotMode',dotMode);},[dotMode]);
  useEffect(()=>{
    if(!localStorage.getItem('jg-toured')&&!localStorage.getItem('jg-visited')){
      const t=setTimeout(()=>setTourStep(0),900);
      return ()=>clearTimeout(t);
    }
  },[]);
  function tourNext(){
    if(tourStep>=TOUR_STEPS.length-1){setTourStep(null);localStorage.setItem('jg-toured','1');localStorage.setItem('jg-visited','1');setShowOnboarding(false);setViewMode('guide');window.scrollTo(0,0);}
    else setTourStep(s=>s+1);
  }
  function tourSkip(){setTourStep(null);localStorage.setItem('jg-toured','1');localStorage.setItem('jg-visited','1');setShowOnboarding(false);}
  // Level: Essentials hides the advanced half of the app. New users start
  // in Essentials; anyone who used the app before the level existed keeps Full.
  const [level,setLevel]=useState(()=>localStorage.getItem('jg-level')||(localStorage.getItem('jg-visited')?'full':'essentials'));
  const isEss=level==='essentials';
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
    setViewMode(p.view||'diatonic');
    window.scrollTo(0,0);
  }

  const quality=QTYPES[deg];
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

  return e('div',{style:{background:BG,minHeight:'100vh',color:'var(--txt)',fontFamily:UI_FONT,
    padding:'14px 14px 84px'}},

    // Onboarding banner (first visit only)
    showOnboarding?e('div',{style:{
      display:'flex',alignItems:'flex-start',gap:12,padding:'10px 14px',
      background:'#091a2a',border:'1px solid #1a3a5a',borderRadius:7,marginBottom:12,
      fontSize:'0.82rem',color:'#9ab8d8',lineHeight:1.6}},
      e('div',{style:{flex:1}},
        e('span',{style:{color:'#4ECDC4',fontWeight:700}},'New here? '),
        'New to jazz guitar? Start with the ',
        e('button',{onClick:()=>{setViewMode('guide');setShowOnboarding(false);localStorage.setItem('jg-visited','1');},
          style:{background:'transparent',border:'none',color:'#4ECDC4',cursor:'pointer',
            fontFamily:UI_FONT,fontSize:'0.82rem',textDecoration:'underline',padding:0}},
          'Guide'),
        ' — it explains every concept from scratch and opens the right tool at each step.'
      ),
      e('button',{onClick:()=>{setShowOnboarding(false);localStorage.setItem('jg-visited','1');},
        style:{background:'transparent',border:'none',color:'#4a6a8a',cursor:'pointer',
          fontFamily:UI_FONT,fontSize:'1rem',padding:'0 4px',lineHeight:1,minHeight:0}},
        '✕')
    ):null,

    // Header — title left, level + theme right
    e('div',{style:{display:'flex',alignItems:'center',gap:10,marginBottom:12,flexWrap:'wrap'}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.4rem',fontWeight:700,color:'var(--scale-name)',flexGrow:1}},'Jazz Guitar Lab'),
      e('div',{'data-tour':'level-switch'},e(GuitarToggle,{level,setLevel})),
      e('button',{onClick:()=>setTourStep(0),'aria-label':'Start tour',style:{padding:'4px 10px',
        borderRadius:18,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.8rem',
        border:'1px solid '+BTN_BRD,background:'transparent',
        color:BTN_OFF,minHeight:34,flexShrink:0}},'? Tour'),
      e('button',{onClick:toggleTheme,'aria-label':'Toggle theme',style:{padding:'4px 10px',
        borderRadius:18,cursor:'pointer',fontFamily:UI_FONT,fontSize:'0.8rem',
        border:'1px solid '+BTN_BRD,background:'transparent',
        color:BTN_OFF,minHeight:34,flexShrink:0}},
        theme==='dark'?'☀':'☾')
    ),

    // Key chip (hidden in custom/guide mode) — tap to expand the 12-key picker
    viewMode!=='custom'&&viewMode!=='guide'?e('div',{'data-tour':'key-chip',style:{marginBottom:10}},
      e('button',{onClick:()=>setKeyOpen(o=>!o),style:{
        display:'inline-flex',alignItems:'center',gap:7,padding:'5px 14px',borderRadius:18,
        cursor:'pointer',fontFamily:UI_FONT,border:'1px solid '+(keyOpen?GOLD:BTN_BRD),
        background:keyOpen?ACT_GOLD:BG2,minHeight:38}},
        e('span',{style:{fontSize:'0.7rem',color:LBL,letterSpacing:'1px'}},'KEY'),
        e('span',{style:{fontSize:'1rem',color:GOLD,fontWeight:700}},KEYS[key].name),
        e('span',{style:{fontSize:'0.7rem',color:LBL}},keyOpen?'▲':'▼')
      ),
      keyOpen?e('div',{style:{display:'flex',flexWrap:'wrap',gap:3,marginTop:8}},
        KEYS.map((k,i)=>e('button',{key:i,onClick:()=>{setKey(i);setKeyOpen(false);},style:keyBtnStyle(i)},k.name))
      ):null
    ):null,

    // ── IIVI VIEW ────────────────────────────────────────────────────
    viewMode==='iivi'?e(IIVIView,{keyIdx:key,dotMode,setDotMode}):null,

    // ── CUSTOM CHORD VIEW ────────────────────────────────────────────
    viewMode==='custom'?e(CustomChordView,{customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx,level,dotMode,setDotMode}):null,

    // ── GUIDE / PATH VIEW ────────────────────────────────────────────
    viewMode==='guide'?e(GuideView,{openPreset,level}):null,

    // ── DIATONIC VIEW ────────────────────────────────────────────────
    viewMode==='diatonic'?e('div',null,
      // Diatonic chord degree selector — the main control, no label needed
      e('div',{'data-tour':'chord-row',style:{display:'flex',flexWrap:'wrap',gap:4,marginBottom:10}},
        ROMAN.map((r,i)=>{
          const rPC=(KEYS[key].root+MAJOR_SCALE[i])%12;
          return e('button',{key:i,onClick:()=>setDeg(i),style:chordBtnStyle(i)},
            e('div',{style:{fontSize:'0.82rem',color:deg===i?'#FF6B6B':LBL,marginBottom:1,fontWeight:700}},r),
            e('div',{style:{fontSize:'0.76rem',fontWeight:deg===i?700:400}},nn(rPC,key)+QSYMS[i])
          );
        })
      ),
      // Chord info bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:7,
        padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}},
        e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:GOLD,fontStyle:'italic'}},chordName),
        e('span',{style:{fontSize:'0.79rem',color:LBL,letterSpacing:'1px'}},KEYS[key].name+' MAJOR — '+ROMAN[deg]),
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
        )
      ),
      // Voicing tabs — Essentials shows the starting trio, Full shows everything
      e('div',{'data-tour':'voicing-tabs',style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
        (isEss?['shell','drop2','arpeggio']:['shell','drop2','drop3','drop24','drop23','rootless','arpeggio']).map(id=>{
          const lbls={drop2:'Drop 2',drop3:'Drop 3',drop24:'Drop 2+4',drop23:'Drop 2+3',shell:'Shell',rootless:'Rootless',arpeggio:'Arpeggio'};
          return e('button',{key:id,onClick:()=>setVType(id),style:tabStyle(id)},lbls[id]);
        })
      ),
      // Controls bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
        borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
        display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
        DROP_TYPES.has(vType)?[
          e('span',{key:'lbl',style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
          setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl)),
          voiceOrder?e('span',{key:'vo',style:{marginLeft:'auto',fontSize:'0.7rem',color:HINT}},'voices: '+voiceOrder):null
        ]:null,
        vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Guide tones: R + 3rd + 7th  ·  Form A = skip-string  ·  Form B = adjacent strings'):null,
        vType==='rootless'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'No root — plays cleanly over a bass player  ·  Type A = 3-5-7-9  ·  Type B = 7-9-3-5'):null,
        vType==='drop24'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Drop 2+4: wider open sound — voices 2 and 4 from top both dropped  ·  skips one string'):null,
        vType==='drop23'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Drop 2+3: spread voicing — voices 2 and 3 from top both dropped  ·  guide tones on top'):null,
        vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions · scale tones shown faintly'):null
      ),
      // Neck (with dot-mode toggle)
      e(DotModeToggle,{dotMode,setDotMode}),
      e('div',{'data-tour':'neck-area',style:{background:'var(--neck-wrap)',border:'1px solid '+BORDER,borderRadius:9,
        padding:'8px 4px 4px',marginBottom:10,overflowX:'auto'}},
        e('div',{style:{minWidth:680}},
          e(NeckSVG,{arpPos,highlight,scalePos,degNames,hlTc,dotMode,dotKeyIdx:key})
        )
      ),
      // Scale panel (diatonic only)
      e(ScalePanel,{degree:deg,chordRoot:rootPC,tones,degNames,
        keyIdx:key,scaleIdx:safeScaleIdx,onScaleChange:setScaleIdx,level}),
      // Drop 2 / Drop 3
      DROP_TYPES.has(vType)?e(DiagSection,{title:DROP_LBL[vType]+' INVERSIONS — CLICK TO SELECT'},
        allVoicings.every(v=>!v)?e(NoShapes,null):
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:i===0?'Root pos.':degNames[inv.bassIdx]+' bass',bassLabel:i===0?'bass: '+degNames[inv.bassIdx]:null,
            selected:invIdx===i,onClick:()=>setInvIdx(i),dotMode,dotKeyIdx:key})
        )
      ):null,
      // Shell voicings
      vType==='shell'?e('div',null,
        e(DiagSection,{title:'FORM A — SKIP-STRING (R-7-3)'},
          shellsA.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:key}))
        ),
        e(DiagSection,{title:'FORM B — ADJACENT STRINGS (R-3-7)'},
          shellsB.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i),dotMode,dotKeyIdx:key}))
        )
      ):null,
      // Rootless voicings
      vType==='rootless'?e('div',null,
        e(DiagSection,{title:'TYPE A: 3-5-7-9 (3RD ON BOTTOM) — CLICK TO SELECT'},
          ROOTLESS.every((c,i)=>c.type!=='A'||!allRootless[i])?e(NoShapes,null):
          ROOTLESS.filter(c=>c.type==='A').map(cfg=>{
            const i=ROOTLESS.indexOf(cfg);
            return e(ChordBox,{key:i,voicing:allRootless[i],strings:cfg.s,tones:rlTones,
              degNames:rlDegNames,invLabel:cfg.lbl+' / '+cfg.strs,
              bassLabel:'bass: '+rlDegNames[cfg.bassIdx],
              selected:safeRlIdx===i,onClick:()=>setRlIdx(i),tcArr:TC_RL,dotMode,dotKeyIdx:key});
          })
        ),
        e(DiagSection,{title:'TYPE B: 7-9-3-5 (7TH ON BOTTOM) — CLICK TO SELECT'},
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
      [['diatonic','♬','Chords'],['custom','♪','Any Chord'],['iivi','▶','Play'],['guide','⚑','Guide']].map(([id,icon,lbl])=>{
        const act=viewMode===id;
        return e('button',{key:id,onClick:()=>{setViewMode(id);window.scrollTo(0,0);},style:{
          flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:1,
          padding:'7px 0 5px',background:'transparent',border:'none',
          borderTop:'2px solid '+(act?'#4ECDC4':'transparent'),
          color:act?'#4ECDC4':BTN_OFF,fontFamily:UI_FONT,cursor:'pointer',minHeight:52}},
          e('span',{style:{fontSize:'1.1rem',lineHeight:1.2}},icon),
          e('span',{style:{fontSize:'0.64rem',letterSpacing:'0.5px',fontWeight:act?700:400}},lbl)
        );
      })
    )
  );
}

// ── Mount ─────────────────────────────────────────────────────────────
try {
  ReactDOM.createRoot(document.getElementById('root')).render(e(App,null));
} catch(err) {
  const r=document.getElementById('root');
  r.style.cssText='color:#ff6b6b;padding:20px;font-family:monospace;white-space:pre';
  r.textContent='Error: '+err.message+'\n\n'+err.stack;
}

