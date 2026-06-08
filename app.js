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
// Chord types that support rootless voicings (root replaced by 9th)
const ROOTLESS_OK=new Set(['maj7','m7','dom7','m7b5']);

// ── Chord-scale data ─────────────────────────────────────────────────
const PARENT_SC={major:[0,2,4,5,7,9,11],melmin:[0,2,3,5,7,9,11]};
const PTYPE_NAME={major:'Major',melmin:'Mel. Minor',dim:'Diminished',wt:'Whole Tone'};
// FIX: index 11 = 11 semitones = major 7th; was 'd7' (diminished 7), now 'Δ7'
const INT_NAMES=['R','b2','2','b3','3','4','#4','5','b6','6','b7','Δ7'];

const CHORD_SCALES=[
  [{name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,desc:'Home — fully inside the key'},
   {name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,desc:'#11 — floating, bright colour'}],
  [{name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,desc:'Standard — nat. 6, fully inside'}],
  [{name:'Phrygian', abbr:'Phr',   iv:[0,1,3,5,7,8,10],pType:'major', mPos:2,desc:'Diatonic — dark b2 tension'},
   {name:'Dorian',   abbr:'Dor',   iv:[0,2,3,5,7,9,10],pType:'major', mPos:1,desc:'Brighter — avoids b2'}],
  [{name:'Lydian',   abbr:'Lyd',   iv:[0,2,4,6,7,9,11],pType:'major', mPos:3,desc:'Natural — #11 defines the sound'},
   {name:'Ionian',   abbr:'Ion',   iv:[0,2,4,5,7,9,11],pType:'major', mPos:0,desc:'Inside — IV as local tonic'},
   {name:'Lyd.Aug.', abbr:'LydAug',iv:[0,2,4,6,8,9,11],pType:'melmin',mPos:2,desc:'#5+#11 — dreamy quality'}],
  [{name:'Mixolydian',abbr:'Mix',  iv:[0,2,4,5,7,9,10],  pType:'major', mPos:4,desc:'Standard — natural tensions'},
   {name:'Altered',  abbr:'Alt',   iv:[0,1,3,4,6,8,10],  pType:'melmin',mPos:6,desc:'All tensions altered — max pull'},
   {name:'Lyd.Dom.', abbr:'LydDom',iv:[0,2,4,6,7,9,10],  pType:'melmin',mPos:3,desc:'#11 — bright dominant colour'},
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

// ── Colours ──────────────────────────────────────────────────────────
const TC    =['#FF6B6B','#4ECDC4','#74C0FC','#FFD43B'];
const TC_DIM=['#FF6B6B55','#4ECDC455','#74C0FC55','#FFD43B55'];
const TC_RIM=['#FF6B6B99','#4ECDC499','#74C0FC99','#FFD43B99'];
const TC_RL =['#C084FC','#4ECDC4','#74C0FC','#FFD43B'];
const BG    ='#07070f';
const BG2   ='#0d0d1e';
const BORDER='#22223a';
const LBL   ='#a8a8cc';
const HINT  ='#9898bc';
const BTN_OFF='#8888b8';
const BTN_BRD='#28284a';
const MONO  ="'Courier New',monospace";
const SERIF ="Georgia,serif";

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
const SHELLS=[
  {lbl:'R-7-3',form:'A',root:'6th',s:[0,2,3],a:[0,3,1],bassIdx:0},
  {lbl:'R-7-3',form:'A',root:'5th',s:[1,3,4],a:[0,3,1],bassIdx:0},
  {lbl:'3-R-7',form:'A',root:'6th',s:[0,2,3],a:[1,0,3],bassIdx:1},
  {lbl:'3-R-7',form:'A',root:'5th',s:[1,3,4],a:[1,0,3],bassIdx:1},
  {lbl:'7-R-3',form:'A',root:'6th',s:[0,2,3],a:[3,0,1],bassIdx:3},
  {lbl:'7-R-3',form:'A',root:'5th',s:[1,3,4],a:[3,0,1],bassIdx:3},
  {lbl:'R-3-7',form:'B',root:'6th',s:[0,1,2],a:[0,1,3],bassIdx:0},
  {lbl:'R-3-7',form:'B',root:'5th',s:[1,2,3],a:[0,1,3],bassIdx:0},
];
const ROOTLESS=[
  {lbl:'3-5-7-9',type:'A',strs:'5-4-3-2',s:[1,2,3,4],a:[1,2,3,0],bassIdx:1},
  {lbl:'3-5-7-9',type:'A',strs:'4-3-2-1',s:[2,3,4,5],a:[1,2,3,0],bassIdx:1},
  {lbl:'7-9-3-5',type:'B',strs:'5-4-3-2',s:[1,2,3,4],a:[3,0,1,2],bassIdx:3},
  {lbl:'7-9-3-5',type:'B',strs:'4-3-2-1',s:[2,3,4,5],a:[3,0,1,2],bassIdx:3},
];

// ── Engine ───────────────────────────────────────────────────────────
const getChordTones=(root,q)=>INTERVALS[q].map(i=>(root+i)%12);
const getExtTones=(root,extType)=>extType.iv.map(i=>(root+i)%12);
const getRootlessTones=(root,q)=>{const t=getChordTones(root,q);return[(root+2)%12,t[1],t[2],t[3]];};

function calcVoicing(strings,assignment,tones,maxSpan,minFret){
  maxSpan=maxSpan===undefined?5:maxSpan;
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
    const mn=Math.min(...frets),mx=Math.max(...frets);
    if(mx-mn<=maxSpan) return{frets,midis,mn,mx};
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

// ── NeckSVG ───────────────────────────────────────────────────────────
function NeckSVG({arpPos,highlight,scalePos,degNames,hlTc}){
  hlTc=hlTc||TC;
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
        e('stop',{offset:'0%',stopColor:'#1c1508'}),
        e('stop',{offset:'60%',stopColor:'#130e05'}),
        e('stop',{offset:'100%',stopColor:'#0c0902'})
      ),
      e('linearGradient',{id:'nutG',x1:'0',y1:'0',x2:'0',y2:'1'},
        e('stop',{offset:'0%',stopColor:'#e8c870'}),
        e('stop',{offset:'100%',stopColor:'#b8922a'})
      )
    ),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'url(#neckBg)'}),
    e('rect',{x:PL-22,y:PT-13,width:NF*FW+28,height:5*SH+26,rx:7,fill:'none',stroke:'#2a1f08',strokeWidth:1}),
    e('rect',{x:PL-9,y:PT-11,width:8,height:5*SH+22,fill:'url(#nutG)',rx:2}),
    Array.from({length:NF},(_,k)=>k+1).map(k=>
      e('line',{key:'fl'+k,x1:PL+k*FW,y1:PT-10,x2:PL+k*FW,y2:PT+5*SH+10,
        stroke:k===12?'#4a3520':'#2e2010',strokeWidth:k===12?2.5:1.5})
    ),
    SINGLE_INLAYS.map(f=>
      e('ellipse',{key:'il'+f,cx:nx(f),cy:PT+2.5*SH,rx:5.5,ry:4.5,fill:'#2e2010'})
    ),
    e('ellipse',{key:'12a',cx:nx(12),cy:PT+1.5*SH,rx:5.5,ry:4.5,fill:'#2e2010'}),
    e('ellipse',{key:'12b',cx:nx(12),cy:PT+3.5*SH,rx:5.5,ry:4.5,fill:'#2e2010'}),
    Array.from({length:6},(_,si)=>
      e('line',{key:'st'+si,x1:PL-22,y1:sy(si),x2:PL+NF*FW+8,y2:sy(si),
        stroke:`rgba(220,195,130,${0.30+si*0.09})`,strokeWidth:0.4+si*0.26})
    ),
    [1,3,5,7,9,12,15].map(f=>
      e('text',{key:'fn'+f,x:nx(f),y:H-8,textAnchor:'middle',fill:'#9a8850',fontSize:9,fontFamily:MONO},f)
    ),
    STR_NAMES.map((n,si)=>
      e('text',{key:'sl'+si,x:PL-26,y:sy(si),textAnchor:'end',dominantBaseline:'middle',
        fill:'#9a8850',fontSize:9.5,fontFamily:MONO},n)
    ),
    (scalePos||[]).map((p,i)=>
      e('g',{key:'sp'+i},
        e('circle',{cx:nx(p.f),cy:sy(p.s),r:5.5,fill:'rgba(255,255,255,0.04)',stroke:'rgba(255,255,255,0.20)',strokeWidth:1}),
        e('text',{x:nx(p.f),y:sy(p.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'rgba(255,255,255,0.26)',fontSize:6,fontFamily:MONO,pointerEvents:'none'},INT_NAMES[p.interval])
      )
    ),
    arpPos.map((p,i)=>{
      if(hiMap[p.s+'-'+p.f]) return null;
      const cx=p.f===0?OPEN_X:nx(p.f);
      return e('g',{key:'ap'+i},
        e('circle',{cx,cy:sy(p.s),r:8,fill:TC_DIM[p.ti],stroke:TC_RIM[p.ti],strokeWidth:1.3}),
        e('text',{x:cx,y:sy(p.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:TC_RIM[p.ti],fontSize:7,fontFamily:MONO,pointerEvents:'none'},degNames[p.ti])
      );
    }),
    (highlight||[]).map((h,i)=>{
      const cx=h.f===0?OPEN_X:nx(h.f);
      return e('g',{key:'hi'+i,filter:'url(#ng)'},
        e('circle',{cx,cy:sy(h.s),r:h.f===0?9:11,fill:hlTc[h.ti],stroke:'rgba(255,255,255,0.85)',strokeWidth:1.8}),
        e('text',{x:cx,y:sy(h.s),textAnchor:'middle',dominantBaseline:'middle',
          fill:'white',fontSize:9,fontWeight:'bold',fontFamily:MONO},h.dl)
      );
    })
  );
}

// ── ChordBox ──────────────────────────────────────────────────────────
function ChordBox({voicing,strings,tones,degNames,invLabel,bassLabel,selected,onClick,tcArr}){
  const tc=tcArr||TC;
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
  return e('div',{onClick,style:{cursor:'pointer',flexShrink:0}},
    e('svg',{width:W,height:H,viewBox:`0 0 ${W} ${H}`},
      e('rect',{width:W,height:H,rx:9,fill:selected?'#09182a':'#09091a',stroke:selected?'#4ECDC4':BORDER,strokeWidth:selected?2:1.5}),
      e('text',{x:W/2,y:20,textAnchor:'middle',fill:selected?'#4ECDC4':BTN_OFF,fontSize:13,fontWeight:selected?'bold':'normal',fontFamily:MONO},invLabel),
      bassLabel?e('text',{x:W/2,y:38,textAnchor:'middle',fill:selected?'#4ECDC488':HINT,fontSize:11,fontFamily:MONO},bassLabel):null,
      !showNut?e('text',{x:3,y:PT+FS/2,dominantBaseline:'middle',fill:HINT,fontSize:10,fontFamily:MONO},SF+'fr'):null,
      showNut?e('rect',{x:sx(0)-2,y:PT-5,width:5*SS+4,height:5,fill:'#c8a855',rx:1.5}):null,
      Array.from({length:NF+1},(_,k)=>
        e('line',{key:'frl'+k,x1:sx(0),y1:PT+k*FS,x2:sx(5),y2:PT+k*FS,stroke:(k===0&&showNut)?'#c8a855':'#22223a',strokeWidth:1})
      ),
      Array.from({length:6},(_,i)=>
        e('line',{key:'stl'+i,x1:sx(i),y1:PT,x2:sx(i),y2:PT+NF*FS,stroke:'#1e1e38',strokeWidth:1})
      ),
      allF.map((f,i)=>{
        if(f===null) return e('text',{key:'mx'+i,x:sx(i),y:PT-10,textAnchor:'middle',fill:HINT,fontSize:13,fontFamily:MONO},'x');
        if(f===0){const ti2=tones.indexOf(OPEN_PC[i]);return e('circle',{key:'op'+i,cx:sx(i),cy:PT-12,r:6,fill:'none',stroke:ti2>=0?tc[ti2]:'#6668a0',strokeWidth:2});}
        return null;
      }),
      allF.map((f,i)=>{
        if(f===null||f===0) return null;
        if(f<SF||f>SF+NF-1) return null;
        const pc=(OPEN_PC[i]+f)%12,ti2=tones.indexOf(pc);
        return e('g',{key:'dt'+i},
          e('circle',{cx:sx(i),cy:fy(f),r:9,fill:ti2>=0?tc[ti2]:'#556',stroke:'rgba(255,255,255,0.2)',strokeWidth:1}),
          e('text',{x:sx(i),y:fy(f),textAnchor:'middle',dominantBaseline:'middle',fill:'white',fontSize:8,fontWeight:'bold',fontFamily:MONO},ti2>=0?degNames[ti2]:'')
        );
      })
    )
  );
}

// ── ScalePanel ────────────────────────────────────────────────────────
function ScalePanel({degree,chordRoot,tones,degNames,keyIdx,scaleIdx,onScaleChange}){
  const options=CHORD_SCALES[degree];
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
              padding:'2px 8px',borderRadius:3,cursor:'pointer',fontFamily:MONO,fontSize:'0.79rem',
              border:'1px solid '+(scaleIdx===i?'#FFD43B60':BTN_BRD),
              background:scaleIdx===i?'#1a1505':BG,
              color:scaleIdx===i?'#FFD43B':BTN_OFF,fontWeight:scaleIdx===i?700:400}},opt.abbr)
          )
        ):null,
        e('span',{style:{fontFamily:SERIF,fontSize:'1rem',fontWeight:700,color:'#e8d8a0'}},nn(chordRoot,keyIdx)+' '+sc.name),
        e('span',{style:{fontSize:'0.7rem',color:HINT,fontFamily:MONO}},sc.desc)
      ),
      e('div',{style:{display:'flex',alignItems:'center',gap:6,flexShrink:0}},
        e('span',{style:{fontSize:'0.79rem',color:LBL,fontFamily:MONO}},'parent'),
        e('span',{style:{fontSize:'0.79rem',fontFamily:MONO,
          color:sameAsKey?'#4ECDC4':'#9090c0',
          border:'1px solid '+(sameAsKey?'#4ECDC440':BTN_BRD),
          borderRadius:4,padding:'2px 8px',background:sameAsKey?'#0a1f1f':BG}},
          parentLabel+(sameAsKey?' (this key)':''))
      )
    ),
    e('div',{style:{display:'flex',gap:5,flexWrap:'wrap',alignItems:'flex-end'}},
      noteRow.map((n,i)=>
        e('div',{key:i,style:{display:'flex',flexDirection:'column',alignItems:'center',gap:2}},
          e('div',{style:{width:30,height:30,borderRadius:'50%',
            background:n.isTone?TC[n.ti]:'rgba(255,255,255,0.04)',
            border:'1.5px solid '+(n.isTone?TC[n.ti]:BTN_BRD),
            display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:n.isTone?'0 0 8px '+TC[n.ti]+'44':'none'}},
            e('span',{style:{fontSize:'0.71rem',fontWeight:700,fontFamily:MONO,color:n.isTone?'white':'#6060a0'}},n.noteName)
          ),
          e('span',{style:{fontSize:'0.64rem',fontFamily:MONO,color:n.isTone?TC[n.ti]+'cc':'#484870'}},INT_NAMES[n.interval])
        )
      ),
      e('div',{style:{marginLeft:'auto',alignSelf:'flex-start',paddingTop:2}},
        e('span',{style:{fontSize:'0.77rem',fontFamily:MONO,color:HINT,border:'1px solid '+BTN_BRD,borderRadius:3,padding:'2px 7px',background:BG}},sc.iv.length+'-note')
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

// ── Shared button style helpers ───────────────────────────────────────
const mkSsBtn=(active)=>({
  padding:'6px 12px',borderRadius:4,cursor:'pointer',fontFamily:MONO,fontSize:'0.72rem',
  border:'1px solid '+(active?'#74C0FC':BTN_BRD),background:active?'#081520':BG2,
  color:active?'#74C0FC':BTN_OFF,fontWeight:active?700:400,minHeight:44,
});

// beat index → [chordIdx (0=II,1=V,2=I), toneIdx]
const BEAT_MAP=[
  [0,0],[0,1],[0,2],[0,3],  // bar 1: IIm7  R  b3  5  b7
  [1,0],[1,1],[1,2],[1,3],  // bar 2: V7    R   3  5  b7
  [2,0],[2,1],[2,2],[2,3],  // bar 3: Imaj7 R   3  5  Δ7
  [2,0],[2,2],[2,1],[2,0],  // bar 4: Imaj7 R   5  3  R
];

// ── IIVIView ──────────────────────────────────────────────────────────
function IIVIView({keyIdx}){
  const [strSetIdx,setStrSetIdx]=useState(2);
  const [invIdxs,setInvIdxs]=useState([0,0,0]);
  const [activeChordIdx,setActiveChordIdx]=useState(0);
  const [isPlaying,setIsPlaying]=useState(false);
  const [bpm,setBpm]=useState(120);
  const [bassEnabled,setBassEnabled]=useState(false);
  const [playingChordIdx,setPlayingChordIdx]=useState(null);
  const [playingBar,setPlayingBar]=useState(null);

  const audioCtxRef=useRef(null);
  const timerRef=useRef(null);
  const nextTimeRef=useRef(0);
  const beatRef=useRef(0);
  const genRef=useRef(0);
  const bpmRef=useRef(bpm);
  const bassRef=useRef(bassEnabled);
  const chordsRef=useRef(null);
  bpmRef.current=bpm;
  bassRef.current=bassEnabled;

  // II=deg1, V=deg4, I=deg0
  const chords=[1,4,0].map(deg=>{
    const rootPC=(KEYS[keyIdx].root+MAJOR_SCALE[deg])%12;
    const quality=QTYPES[deg];
    const tones=getChordTones(rootPC,quality);
    return{rootPC,quality,tones,dnames:DNAMES[quality],
      name:nn(rootPC,keyIdx)+QSYMS[deg],roman:ROMAN[deg]};
  });
  chordsRef.current=chords;

  const ssIdx=Math.min(strSetIdx,D2_SETS.length-1);
  const ss=D2_SETS[ssIdx].s;
  const ac=chords[activeChordIdx];

  const arpPos=useMemo(()=>getArpPos(ac.tones),[activeChordIdx,keyIdx]);
  const activeVoicings=useMemo(()=>D2_INV.map(inv=>calcVoicing(ss,inv.a,ac.tones)),[activeChordIdx,strSetIdx,keyIdx]);
  const highlight=useMemo(()=>{
    const v=activeVoicings[invIdxs[activeChordIdx]];
    if(!v) return null;
    return v.frets.map((f,i)=>{
      const si=ss[i],ti=ac.tones.indexOf((OPEN_PC[si]+f)%12);
      return{s:si,f,ti,dl:ti>=0?ac.dnames[ti]:''};
    });
  },[activeVoicings,invIdxs,activeChordIdx,strSetIdx]);

  function playBassNote(ctx,pc,startTime,beatDur,accent){
    const midi=48+((pc%12+12)%12);
    const freq=440*Math.pow(2,(midi-69)/12);
    const osc=ctx.createOscillator();
    const filt=ctx.createBiquadFilter();
    const gain=ctx.createGain();
    osc.type='triangle';
    osc.frequency.value=freq;
    filt.type='lowpass';
    filt.frequency.value=900;
    filt.Q.value=0.7;
    const pk=accent?0.48:0.30;
    gain.gain.setValueAtTime(0,startTime);
    gain.gain.linearRampToValueAtTime(pk,startTime+0.018);
    gain.gain.exponentialRampToValueAtTime(0.001,startTime+beatDur*0.88);
    osc.connect(filt);filt.connect(gain);gain.connect(ctx.destination);
    osc.start(startTime);osc.stop(startTime+beatDur);
  }

  function startPlayback(){
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    audioCtxRef.current=ctx;
    nextTimeRef.current=ctx.currentTime+0.05;
    beatRef.current=0;
    const gen=++genRef.current;
    setIsPlaying(true);
    function tick(){
      if(!audioCtxRef.current) return;
      const beatDur=60/bpmRef.current;
      while(nextTimeRef.current < audioCtxRef.current.currentTime+0.12){
        const beat=beatRef.current%16;
        const bar=Math.floor(beat/4);
        const [ci,ti]=BEAT_MAP[beat];
        const delay=Math.max(0,(nextTimeRef.current-audioCtxRef.current.currentTime)*1000);
        setTimeout(()=>{if(genRef.current===gen){setPlayingChordIdx(ci);setPlayingBar(bar);}},delay);
        if(bassRef.current && chordsRef.current){
          playBassNote(ctx,chordsRef.current[ci].tones[ti],nextTimeRef.current,beatDur,beat%4===0);
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

  // cleanup on unmount
  useEffect(()=>()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current)audioCtxRef.current.close();
  },[]);

  // stop when key changes
  useEffect(()=>{
    genRef.current++;
    clearTimeout(timerRef.current);
    if(audioCtxRef.current){audioCtxRef.current.close();audioCtxRef.current=null;}
    setIsPlaying(false);setPlayingChordIdx(null);setPlayingBar(null);
  },[keyIdx]);

  const BAR_ROMAN=['II','V','I','I'];
  const playBtn={padding:'6px 18px',background:isPlaying?'#1a0808':'#081a0e',
    border:'1px solid '+(isPlaying?'#FF6B6B':'#4ECDC4'),borderRadius:6,
    color:isPlaying?'#FF6B6B':'#4ECDC4',cursor:'pointer',fontFamily:MONO,
    fontSize:'0.85rem',fontWeight:'bold',letterSpacing:'1px',minHeight:44};
  const bpmStepBtn={padding:'4px 11px',background:'transparent',
    border:'1px solid '+BTN_BRD,borderRadius:4,color:BTN_OFF,cursor:'pointer',
    fontFamily:MONO,fontSize:'0.9rem',minHeight:44};
  const bassBtn={padding:'6px 14px',background:bassEnabled?'#080f1a':'transparent',
    border:'1px solid '+(bassEnabled?'#74C0FC':BTN_BRD),borderRadius:6,
    color:bassEnabled?'#74C0FC':BTN_OFF,cursor:'pointer',fontFamily:MONO,
    fontSize:'0.82rem',minHeight:44};

  return e('div',null,
    // String set selector
    e('div',{style:{display:'flex',gap:6,marginBottom:10,flexWrap:'wrap',alignItems:'center'}},
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
      D2_SETS.map((set,i)=>
        e('button',{key:i,onClick:()=>setStrSetIdx(i),style:mkSsBtn(strSetIdx===i)},set.lbl)
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
        e('span',{style:{minWidth:38,textAlign:'center',color:'#d0d0e8',fontFamily:MONO,fontSize:'0.92rem',
          padding:'0 4px'}},bpm),
        e('button',{onClick:()=>setBpm(b=>Math.min(300,b+5)),style:bpmStepBtn},'+'),
        e('span',{style:{fontSize:'0.75rem',color:HINT,marginLeft:2}})
      ),
      e('button',{onClick:()=>setBassEnabled(v=>!v),style:bassBtn},'♩ BASS LINE'),
      isPlaying&&playingBar!==null
        ?e('span',{style:{fontSize:'0.8rem',color:'#FFD43B',fontFamily:MONO,
            padding:'4px 10px',border:'1px solid #4a3a00',borderRadius:4,background:'#1a1400'}},
            'Bar '+(playingBar+1)+' · '+BAR_ROMAN[playingBar])
        :null
    ),
    // Neck label
    e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:4}},
      'NECK — '+ac.roman+' · '+ac.name
    ),
    // Neck
    e('div',{style:{background:'#05050e',border:'1px solid '+BORDER,borderRadius:9,
      padding:'8px 4px 4px',marginBottom:12,overflowX:'auto'}},
      e('div',{style:{minWidth:680}},
        e(NeckSVG,{arpPos,highlight,scalePos:[],degNames:ac.dnames})
      )
    ),
    // Three chord columns
    e('div',{style:{display:'flex',gap:14,flexWrap:'wrap'}},
      chords.map((chord,ci)=>{
        const voicings=D2_INV.map(inv=>calcVoicing(ss,inv.a,chord.tones));
        const isActive=activeChordIdx===ci;
        const isNowPlaying=playingChordIdx===ci;
        const borderColor=isNowPlaying?'#FFD43B':isActive?'#4ECDC4':BORDER;
        const bgColor=isNowPlaying?'#181200':isActive?'#0a1a1a':BG2;
        const romanColor=isNowPlaying?'#FFD43B':isActive?'#4ECDC4':LBL;
        return e('div',{key:ci,style:{flex:'1 1 200px',minWidth:190}},
          e('div',{style:{marginBottom:8,padding:'8px 12px',background:bgColor,
            border:'1px solid '+borderColor,borderRadius:6,cursor:'pointer',
            transition:'border-color 0.12s,background 0.12s'},
            onClick:()=>setActiveChordIdx(ci)},
            e('div',{style:{fontSize:'0.73rem',color:romanColor,letterSpacing:'2px',marginBottom:2}},chord.roman),
            e('div',{style:{fontFamily:SERIF,fontSize:'1.1rem',fontWeight:700,color:'#d4a855',marginBottom:4}},chord.name),
            e('div',{style:{display:'flex',gap:8,flexWrap:'wrap'}},
              chord.tones.map((t,ti)=>
                e('span',{key:ti,style:{fontSize:'0.77rem',color:TC[ti],fontFamily:MONO}},
                  chord.dnames[ti]+'='+nn(t,keyIdx))
              )
            )
          ),
          // Inversion diagrams
          e('div',{style:{display:'flex',gap:6,flexWrap:'wrap'}},
            D2_INV.map((inv,ii)=>
              e(ChordBox,{key:ii,voicing:voicings[ii],strings:ss,tones:chord.tones,
                degNames:chord.dnames,invLabel:inv.label+' Inv',
                bassLabel:'bass: '+chord.dnames[inv.bassIdx],
                selected:isActive&&invIdxs[ci]===ii,
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
      e('span',{style:{color:'#d4a855',fontWeight:700}},'Voice leading tip: '),
      'Keep common tones, move others by step. Classic: IIm7 3rd inv → V7 2nd inv → Imaj7 root pos, all on the same string set.'
    )
  );
}

// ── CustomChordView ───────────────────────────────────────────────────
// Reuses the same voicing UI as the diatonic view. Receives the active
// chord data as props and renders controls + neck + chord boxes.
function CustomChordView({customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx}){
  const [vType,setVType]=useState('drop2');
  const [ssIdx,setSsIdx]=useState(2);
  const [invIdx,setInvIdx]=useState(0);
  const [shellIdx,setShellIdx]=useState(0);

  const extType=EXT_TYPES[customTypeIdx];
  const tones=useMemo(()=>getExtTones(customRoot,extType),[customRoot,extType]);
  const arpPos=useMemo(()=>getArpPos(tones),[tones]);
  const degNames=extType.dn;
  const chordName=nn(customRoot,0)+extType.sym; // use sharps for custom

  const invData=vType==='drop2'?D2_INV:D3_INV;
  const setsData=vType==='drop2'?D2_SETS:D3_SETS;
  const safeSSIdx=Math.min(ssIdx,setsData.length-1);

  const allVoicings=useMemo(()=>{
    if(vType==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,4,1));
    const ss=setsData[safeSSIdx].s;
    return invData.map(inv=>calcVoicing(ss,inv.a,tones));
  },[vType,safeSSIdx,tones,ssIdx]);

  const firstValidShell=useMemo(()=>{
    const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,4,1));
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
    background:act?BG2:BG,fontFamily:MONO,fontSize:'0.76rem',
    color:act?'#74C0FC':BTN_OFF,fontWeight:act?700:400,minHeight:44};};

  const TABS=[
    {id:'drop2',lbl:'Drop 2'},{id:'drop3',lbl:'Drop 3'},
    {id:'shell',lbl:'Shell'},{id:'arpeggio',lbl:'Arpeggio'}
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
              padding:'4px 9px',borderRadius:4,cursor:'pointer',fontFamily:MONO,fontSize:'0.74rem',
              border:'1px solid '+(customRoot===k.root?'#d4a855':BTN_BRD),
              background:customRoot===k.root?'#1a1402':BG2,
              color:customRoot===k.root?'#d4a855':BTN_OFF,fontWeight:customRoot===k.root?700:400,
              minHeight:44}},k.name)
          )
        )
      ),
      e('div',null,
        e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:6}},'CHORD TYPE'),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
          EXT_TYPES.map((t,i)=>
            e('button',{key:i,onClick:()=>{setCustomTypeIdx(i);setInvIdx(0);},style:{
              padding:'4px 10px',borderRadius:4,cursor:'pointer',fontFamily:MONO,fontSize:'0.74rem',
              border:'1px solid '+(customTypeIdx===i?'#C084FC':BTN_BRD),
              background:customTypeIdx===i?'#1a0a28':BG2,
              color:customTypeIdx===i?'#C084FC':BTN_OFF,fontWeight:customTypeIdx===i?700:400,
              minHeight:44}},t.sym)
          )
        )
      )
    ),
    // Chord info bar
    e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:7,
      padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:'#d4a855',fontStyle:'italic'}},chordName),
      e('span',{style:{fontSize:'0.79rem',color:LBL}},'standalone — '+extType.label),
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
      (vType==='drop2'||vType==='drop3')?[
        e('span',{key:'lbl',style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
        setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl))
      ]:null,
      vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Guide tones: R + 3rd + 7th'):null,
      vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions on neck'):null
    ),
    // Neck
    e('div',{style:{background:'#05050e',border:'1px solid '+BORDER,borderRadius:9,
      padding:'8px 4px 4px',marginBottom:10,overflowX:'auto'}},
      e('div',{style:{minWidth:680}},
        e(NeckSVG,{arpPos,highlight,scalePos:[],degNames})
      )
    ),
    // Chord diagrams
    vType==='drop2'||vType==='drop3'?
      e(DiagSection,{title:(vType==='drop2'?'DROP 2':'DROP 3')+' INVERSIONS'},
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:inv.label+' Inv',
            bassLabel:'bass: '+degNames[inv.bassIdx],
            selected:invIdx===i,onClick:()=>setInvIdx(i)})
        )
      ):null,
    vType==='shell'?e('div',null,
      e(DiagSection,{title:'FORM A — SKIP-STRING'},
        shellsA.map(x=>
          e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i)})
        )
      ),
      e(DiagSection,{title:'FORM B — ADJACENT STRINGS'},
        shellsB.map(x=>
          e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i)})
        )
      )
    ):null
  );
}

// ── App ───────────────────────────────────────────────────────────────
function App(){
  // Global state
  const [key,setKey]=useState(0);
  const [viewMode,setViewMode]=useState('diatonic'); // 'diatonic'|'iivi'|'custom'
  // Diatonic state
  const [deg,setDeg]=useState(0);
  const [vType,setVType]=useState('drop2');
  const [ssIdx,setSsIdx]=useState(2);
  const [invIdx,setInvIdx]=useState(0);
  const [shellIdx,setShellIdx]=useState(0);
  const [rlIdx,setRlIdx]=useState(0);
  const [scaleIdx,setScaleIdx]=useState(0);
  // Custom chord state (lifted so it persists when switching modes)
  const [customRoot,setCustomRoot]=useState(0);
  const [customTypeIdx,setCustomTypeIdx]=useState(2);

  useEffect(()=>{setScaleIdx(0);},[deg]);

  const quality=QTYPES[deg];
  const rootPC=(KEYS[key].root+MAJOR_SCALE[deg])%12;
  const tones=useMemo(()=>getChordTones(rootPC,quality),[rootPC,quality]);
  const rlTones=useMemo(()=>getRootlessTones(rootPC,quality),[rootPC,quality]);
  const degNames=DNAMES[quality];
  const rlDegNames=RL_DNAMES[quality];
  const arpPos=useMemo(()=>getArpPos(tones),[tones]);
  const chordName=nn(rootPC,key)+QSYMS[deg];

  const scaleOptions=CHORD_SCALES[deg];
  const safeScaleIdx=Math.min(scaleIdx,scaleOptions.length-1);
  const currentScale=scaleOptions[safeScaleIdx];
  const scalePos=useMemo(()=>getScalePos(rootPC,currentScale.iv,tones),[rootPC,currentScale,tones]);

  const invData=vType==='drop2'?D2_INV:D3_INV;
  const setsData=vType==='drop2'?D2_SETS:D3_SETS;
  const safeSSIdx=Math.min(ssIdx,setsData.length-1);

  const allVoicings=useMemo(()=>{
    if(vType==='shell') return SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,4,1));
    const ss=setsData[safeSSIdx].s;
    return invData.map(inv=>calcVoicing(ss,inv.a,tones));
  },[vType,safeSSIdx,tones,ssIdx]);

  const firstValidShell=useMemo(()=>{
    const vs=SHELLS.map(sh=>calcVoicing(sh.s,sh.a,tones,4,1));
    const f=vs.findIndex(v=>v!==null); return f>=0?f:0;
  },[tones]);
  useEffect(()=>{if(vType==='shell') setShellIdx(firstValidShell);},[firstValidShell]);
  const safeShellIdx=allVoicings[shellIdx]?shellIdx:firstValidShell;

  const allRootless=useMemo(()=>
    ROOTLESS.map(cfg=>calcVoicing(cfg.s,cfg.a,rlTones,5,1)),[rlTones]);
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
    background:act?BG2:BG,fontFamily:MONO,fontSize:'0.76rem',
    color:act?'#74C0FC':BTN_OFF,fontWeight:act?700:400,minHeight:44};};
  const keyBtnStyle=i=>{const act=key===i;return{
    padding:'4px 9px',borderRadius:4,cursor:'pointer',fontFamily:MONO,fontSize:'0.74rem',
    border:'1px solid '+(act?'#d4a855':BTN_BRD),background:act?'#1a1402':BG2,
    color:act?'#d4a855':BTN_OFF,fontWeight:act?700:400,minHeight:44};};
  const chordBtnStyle=i=>{const act=deg===i;return{
    padding:'4px 8px',borderRadius:4,cursor:'pointer',fontFamily:MONO,
    border:'1px solid '+(act?'#FF6B6B':BTN_BRD),background:act?'#1a0808':BG2,
    color:act?'#FF6B6B':BTN_OFF,minWidth:56,textAlign:'center',minHeight:44};};
  const viewBtnStyle=id=>{const act=viewMode===id;return{
    padding:'6px 16px',borderRadius:5,cursor:'pointer',fontFamily:MONO,fontSize:'0.75rem',
    border:'1px solid '+(act?'#4ECDC4':BTN_BRD),background:act?'#081a1a':BG2,
    color:act?'#4ECDC4':BTN_OFF,fontWeight:act?700:400,minHeight:44};};
  const voiceOrder=(vType==='drop2'||vType==='drop3')&&invData[invIdx]
    ?invData[invIdx].a.map(idx=>degNames[idx]).join(' - '):'';

  const shellsA=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='A');
  const shellsB=SHELLS.map((sh,i)=>({sh,i,v:allVoicings[i]})).filter(x=>x.sh.form==='B');

  return e('div',{style:{background:BG,minHeight:'100vh',color:'#d0d0e8',fontFamily:MONO,padding:'14px'}},

    // Header
    e('div',{style:{display:'flex',alignItems:'baseline',gap:12,marginBottom:14,
      paddingBottom:12,borderBottom:'1px solid '+BORDER,flexWrap:'wrap'}},
      e('span',{style:{fontFamily:SERIF,fontSize:'1.45rem',fontWeight:700,color:'#e8d8a0'}},'Jazz Guitar Voicings'),
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',textTransform:'uppercase'}},
        'Drop 2 · Drop 3 · Shell · Rootless · Arpeggio · Parent Scales')
    ),

    // Key selector (hidden in custom mode — key not relevant there)
    viewMode!=='custom'?e('div',{style:{marginBottom:10}},
      e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:6}},'KEY'),
      e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
        KEYS.map((k,i)=>e('button',{key:i,onClick:()=>setKey(i),style:keyBtnStyle(i)},k.name))
      )
    ):null,

    // View mode switcher
    e('div',{style:{display:'flex',gap:4,marginBottom:12,flexWrap:'wrap',alignItems:'center'}},
      e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginRight:4}},'VIEW'),
      ['diatonic','iivi','custom'].map(id=>{
        const lbls={diatonic:'Diatonic',iivi:'II – V – I',custom:'Custom Chord'};
        return e('button',{key:id,onClick:()=>setViewMode(id),style:viewBtnStyle(id)},lbls[id]);
      })
    ),

    // ── IIVI VIEW ────────────────────────────────────────────────────
    viewMode==='iivi'?e(IIVIView,{keyIdx:key}):null,

    // ── CUSTOM CHORD VIEW ────────────────────────────────────────────
    viewMode==='custom'?e(CustomChordView,{customRoot,setCustomRoot,customTypeIdx,setCustomTypeIdx}):null,

    // ── DIATONIC VIEW ────────────────────────────────────────────────
    viewMode==='diatonic'?e('div',null,
      // Diatonic chord degree selector
      e('div',{style:{marginBottom:10}},
        e('div',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px',marginBottom:6}},'DIATONIC CHORD'),
        e('div',{style:{display:'flex',flexWrap:'wrap',gap:3}},
          ROMAN.map((r,i)=>{
            const rPC=(KEYS[key].root+MAJOR_SCALE[i])%12;
            return e('button',{key:i,onClick:()=>setDeg(i),style:chordBtnStyle(i)},
              e('div',{style:{fontSize:'0.73rem',color:deg===i?'#FF6B6B77':LBL,marginBottom:1}},r),
              e('div',{style:{fontSize:'0.74rem',fontWeight:deg===i?700:400}},nn(rPC,key)+QSYMS[i])
            );
          })
        )
      ),
      // Chord info bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderRadius:7,
        padding:'8px 14px',marginBottom:10,display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}},
        e('span',{style:{fontFamily:SERIF,fontSize:'1.35rem',fontWeight:700,color:'#d4a855',fontStyle:'italic'}},chordName),
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
      // Voicing tabs
      e('div',{style:{display:'flex',gap:2,marginBottom:0,flexWrap:'wrap'}},
        ['drop2','drop3','shell','rootless','arpeggio'].map(id=>{
          const lbls={drop2:'Drop 2',drop3:'Drop 3',shell:'Shell',rootless:'Rootless',arpeggio:'Arpeggio'};
          return e('button',{key:id,onClick:()=>setVType(id),style:tabStyle(id)},lbls[id]);
        })
      ),
      // Controls bar
      e('div',{style:{background:BG2,border:'1px solid '+BORDER,borderTop:'none',
        borderRadius:'0 6px 6px 6px',padding:'7px 12px',marginBottom:10,
        display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',minHeight:36}},
        (vType==='drop2'||vType==='drop3')?[
          e('span',{key:'lbl',style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'STRING SET'),
          setsData.map((ss,i)=>e('button',{key:i,onClick:()=>{setSsIdx(i);setInvIdx(0);},style:mkSsBtn(safeSSIdx===i)},ss.lbl)),
          voiceOrder?e('span',{key:'vo',style:{marginLeft:'auto',fontSize:'0.7rem',color:HINT}},'voices: '+voiceOrder):null
        ]:null,
        vType==='shell'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'Guide tones: R + 3rd + 7th  ·  Form A = skip-string  ·  Form B = adjacent strings'):null,
        vType==='rootless'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'No root — plays cleanly over a bass player  ·  Type A = 3-5-7-9  ·  Type B = 7-9-3-5'):null,
        vType==='arpeggio'?e('span',{style:{fontSize:'0.72rem',color:HINT}},'All chord-tone positions · scale tones shown faintly'):null
      ),
      // Neck
      e('div',{style:{background:'#05050e',border:'1px solid '+BORDER,borderRadius:9,
        padding:'8px 4px 4px',marginBottom:10,overflowX:'auto'}},
        e('div',{style:{minWidth:680}},
          e(NeckSVG,{arpPos,highlight,scalePos,degNames,hlTc})
        )
      ),
      // Scale panel (diatonic only)
      e(ScalePanel,{degree:deg,chordRoot:rootPC,tones,degNames,
        keyIdx:key,scaleIdx:safeScaleIdx,onScaleChange:setScaleIdx}),
      // Drop 2 / Drop 3
      (vType==='drop2'||vType==='drop3')?e(DiagSection,{title:(vType==='drop2'?'DROP 2':'DROP 3')+' INVERSIONS — CLICK TO SELECT'},
        invData.map((inv,i)=>
          e(ChordBox,{key:i,voicing:allVoicings[i],strings:setsData[safeSSIdx].s,
            tones,degNames,invLabel:inv.label+' Inv',bassLabel:'bass: '+degNames[inv.bassIdx],
            selected:invIdx===i,onClick:()=>setInvIdx(i)})
        )
      ):null,
      // Shell voicings
      vType==='shell'?e('div',null,
        e(DiagSection,{title:'FORM A — SKIP-STRING (R-7-3, 3-R-7, 7-R-3)'},
          shellsA.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i)}))
        ),
        e(DiagSection,{title:'FORM B — ADJACENT STRINGS (R-3-7)'},
          shellsB.map(x=>e(ChordBox,{key:x.i,voicing:x.v,strings:x.sh.s,tones,degNames,
            invLabel:x.sh.lbl,bassLabel:'bass: '+degNames[x.sh.bassIdx]+' ('+x.sh.root+')',
            selected:safeShellIdx===x.i,onClick:()=>setShellIdx(x.i)}))
        )
      ):null,
      // Rootless voicings
      vType==='rootless'?e('div',null,
        e(DiagSection,{title:'TYPE A: 3-5-7-9 (3RD ON BOTTOM) — CLICK TO SELECT'},
          ROOTLESS.filter(c=>c.type==='A').map(cfg=>{
            const i=ROOTLESS.indexOf(cfg);
            return e(ChordBox,{key:i,voicing:allRootless[i],strings:cfg.s,tones:rlTones,
              degNames:rlDegNames,invLabel:cfg.lbl+' / '+cfg.strs,
              bassLabel:'bass: '+rlDegNames[cfg.bassIdx],
              selected:safeRlIdx===i,onClick:()=>setRlIdx(i),tcArr:TC_RL});
          })
        ),
        e(DiagSection,{title:'TYPE B: 7-9-3-5 (7TH ON BOTTOM) — CLICK TO SELECT'},
          ROOTLESS.filter(c=>c.type==='B').map(cfg=>{
            const i=ROOTLESS.indexOf(cfg);
            return e(ChordBox,{key:i,voicing:allRootless[i],strings:cfg.s,tones:rlTones,
              degNames:rlDegNames,invLabel:cfg.lbl+' / '+cfg.strs,
              bassLabel:'bass: '+rlDegNames[cfg.bassIdx],
              selected:safeRlIdx===i,onClick:()=>setRlIdx(i),tcArr:TC_RL});
          })
        )
      ):null,
      // Legend
      e('div',{style:{marginTop:14,padding:'8px 14px',background:BG2,border:'1px solid '+BORDER,
        borderRadius:6,display:'flex',gap:14,alignItems:'center',flexWrap:'wrap'}},
        e('span',{style:{fontSize:'0.77rem',color:LBL,letterSpacing:'2px'}},'LEGEND'),
        (isRl?['9th','3rd','5th','7th']:['Root','3rd','5th','7th']).map((l,i)=>
          e('span',{key:i,style:{display:'flex',alignItems:'center',gap:5}},
            e('span',{style:{width:10,height:10,borderRadius:'50%',background:hlTc[i],display:'inline-block',flexShrink:0,boxShadow:'0 0 5px '+hlTc[i]+'88'}}),
            e('span',{style:{color:hlTc[i],fontSize:'0.74rem'}},l)
          )
        ),
        e('span',{style:{display:'flex',alignItems:'center',gap:5,marginLeft:4}},
          e('span',{style:{width:11,height:11,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.28)',display:'inline-block',flexShrink:0}}),
          e('span',{style:{color:'rgba(255,255,255,0.45)',fontSize:'0.74rem'}},'Scale tone')
        ),
        e('span',{style:{fontSize:'0.79rem',color:HINT}},'bright=voicing · dim=arpeggio · faint=scale non-chord-tone')
      ),
      // Footnote
      e('div',{style:{marginTop:8,padding:'6px 14px',fontSize:'0.79rem',color:HINT,lineHeight:1.7}},
        'Shell Form A: skip-string shapes. Shell Form B: adjacent-string R-3-7. Drop 2: 2nd-highest note dropped an octave. Drop 3: 3rd-highest dropped, one string gap. Rootless: 9th replaces root — designed to play over a walking bass.')
    ):null
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

