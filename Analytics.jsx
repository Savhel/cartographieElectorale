// ============================================================
// Analytics.jsx v3 — Tableau de bord professionnel complet
// Diagrammes: BV par ville, type bâtiment, urnes, participation,
//             votes par parti, ELECAM inactivité, capacité
// Filtres: ville × arrondissement × année
// ============================================================
const { useState:useSt, useEffect:useEf, useRef:useRf, useMemo:useMm } = React;

// ─── Couleurs officielles ────────────────────────────────────
const CM = { green:'#009A44', red:'#CE1126', yellow:'#FCD116', dark:'#050c08' };
const PALETTE = ['#009A44','#CE1126','#1a55a0','#e8a800','#6d28d9',
                 '#0891b2','#dc2626','#059669','#d97706','#7c3aed','#0284c7','#ea580c'];
const PARTY_COLORS = {
  RDPC:'#009A44', CDP:'#1a55a0', EPG:'#CE1126', SAJ:'#e8a800',
  ESA:'#6d28d9', AUTRES:'#6b7280', autres:'#6b7280',
};
const PC = n => PARTY_COLORS[n] || PARTY_COLORS[(n||'').toUpperCase()] || '#6b7280';

// ─── Utilitaires ─────────────────────────────────────────────
const fmt  = n => (n==null||isNaN(n)) ? '—' : Number(n).toLocaleString('fr-FR');
const pct  = (a,b) => b ? Math.round(a/b*1000)/10 : 0;
const norm = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');

function groupBy(arr, key) {
  return arr.reduce((acc,i) => { const k = i[key]||'—'; acc[k]=(acc[k]||0)+1; return acc; }, {});
}

function configChart() {
  if (!window.Chart) return;
  Chart.defaults.font.family = "'Inter', ui-sans-serif, sans-serif";
  Chart.defaults.font.size = 11;
  Chart.defaults.color = '#4e5a52';
  Chart.defaults.plugins.tooltip.backgroundColor = '#050c08';
  Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
  Chart.defaults.plugins.tooltip.bodyColor  = '#d0d3c8';
  Chart.defaults.plugins.tooltip.padding    = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 8;
  Chart.defaults.plugins.legend.labels.boxWidth = 12;
  Chart.defaults.plugins.legend.labels.padding  = 10;
  Chart.defaults.animation.duration = 500;
  Chart.defaults.animation.easing   = 'easeInOutQuart';
}

// ─── Canvas chart (mount/unmount propre) ─────────────────────
function CChart({ id, build, deps, height=220 }) {
  const ref = useRf(null);
  useEf(() => {
    if (!ref.current || !window.Chart) return;
    configChart();
    const chart = build(ref.current.getContext('2d'));
    return () => chart?.destroy();
  }, deps||[]);
  return (
    <div style={{position:'relative',height}}>
      <canvas ref={ref} id={id} style={{position:'absolute',inset:0}}/>
    </div>
  );
}

// ─── KPI card ────────────────────────────────────────────────
function KPI({ value, label, sub, color='var(--ink)', icon }) {
  return (
    <div className="an2-kpi">
      {icon && <div className="an2-kpi-icon" style={{background:color+'18',color}}>{icon}</div>}
      <div className="an2-kpi-body">
        <div className="an2-kpi-val" style={{color}}>{value}</div>
        <div className="an2-kpi-lbl">{label}</div>
        {sub && <div className="an2-kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

function STitle({ children, right }) {
  return (
    <div className="an2-stitle">
      <span>{children}</span>
      {right && <span className="an2-stitle-right">{right}</span>}
    </div>
  );
}

// ─── Barre de parti ──────────────────────────────────────────
function PartyRow({ name, votes, total, rank }) {
  const p = pct(votes, total);
  return (
    <div className="an2-party-row">
      {rank===0 && <span className="an2-party-crown">★</span>}
      <span className="an2-party-dot" style={{background:PC(name)}}/>
      <span className="an2-party-name">{name}</span>
      <div className="an2-party-track">
        <div className="an2-party-fill" style={{width:p+'%', background:PC(name)}}/>
      </div>
      <span className="an2-party-pct">{p}%</span>
      <span className="an2-party-votes">{fmt(votes)}</span>
    </div>
  );
}

// ============================================================
// BV DASHBOARD
// ============================================================
function BVDashboard({ bvs, years, year }) {

  // ── Agrégats de base ───────────────────────────────────────
  const total      = bvs.length;
  const avec1Urne  = bvs.filter(b => +b.nb_urnes === 1).length;
  const pct1u      = pct(avec1Urne, total);

  const totIns = bvs.reduce((s,b)=>s+(b.elections?.[year]?.inscrits||0),0);
  const totVot = bvs.reduce((s,b)=>s+(b.elections?.[year]?.votants||0),0);
  const txPart = pct(totVot, totIns);

  // ── Par ville ─────────────────────────────────────────────
  const byVille = useMm(()=>Object.entries(groupBy(bvs,'ville')).sort((a,b)=>b[1]-a[1]),[bvs]);

  // ── Type de bâtiment ──────────────────────────────────────
  const byType = useMm(()=>Object.entries(groupBy(bvs,'type_batiment')).sort((a,b)=>b[1]-a[1]).slice(0,10),[bvs]);

  // ── Inscrits+Votants par arrond ────────────────────────────
  const byArr = useMm(()=>{
    const m={};
    bvs.forEach(b=>{
      const k=b.arrondissement||'—';
      if(!m[k]) m[k]={ins:0,vot:0};
      m[k].ins+=(b.elections?.[year]?.inscrits||0);
      m[k].vot+=(b.elections?.[year]?.votants||0);
    });
    return Object.entries(m)
      .map(([n,d])=>({name:n,...d,tx:pct(d.vot,d.ins)}))
      .filter(a=>a.ins>0).sort((a,b)=>b.ins-a.ins).slice(0,12);
  },[bvs,year]);

  // ── Participation par arrond (carte) ──────────────────────
  const txArr = useMm(()=>[...byArr].sort((a,b)=>b.tx-a.tx),[byArr]);

  // ── Votes par parti ───────────────────────────────────────
  const partyD = useMm(()=>{
    const t={};
    bvs.forEach(b=>{ const v=b.elections?.[year]?.votes||{}; Object.entries(v).forEach(([p,n])=>{ t[p]=(t[p]||0)+n; }); });
    return Object.entries(t).sort((a,b)=>b[1]-a[1]);
  },[bvs,year]);
  const totVoix = partyD.reduce((s,[,v])=>s+v,0);

  return (
    <div>
      {/* ── KPI ROW ── */}
      <div className="panel-section">
        <div className="an2-kpi-row">
          <KPI value={fmt(total)}   label="Bureaux de vote" color={CM.red}   icon="🗳"/>
          <KPI value={fmt(totIns)}  label="Inscrits"        color={CM.green} icon="📋" sub={`Scrutin ${year}`}/>
          <KPI value={fmt(totVot)}  label="Votants"         color={CM.dark}  icon="✅"/>
          <KPI value={txPart+'%'}   label="Participation"   color={txPart>50?CM.green:CM.red} icon="📊" sub={`${year}`}/>
        </div>
      </div>

      {/* ── 1. BV PAR VILLE ── */}
      {byVille.length>1 && (
        <div className="panel-section">
          <STitle right={fmt(total)+' bureaux'}>Bureaux de vote par ville</STitle>
          <CChart id="c-bv-ville" height={180} deps={[byVille]} build={ctx=>new Chart(ctx,{
            type:'bar',
            data:{
              labels: byVille.map(([v])=>v),
              datasets:[{
                label:'Bureaux',
                data: byVille.map(([,c])=>c),
                backgroundColor: PALETTE.slice(0,byVille.length).map(c=>c+'cc'),
                borderColor:     PALETTE.slice(0,byVille.length),
                borderWidth:2, borderRadius:6,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,
              plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${fmt(c.parsed.y)} bureaux`}}},
              scales:{
                y:{beginAtZero:true,grid:{color:'#e0e3d815'},ticks:{callback:v=>fmt(v)}},
                x:{grid:{display:false}},
              },
            },
          })}/>
        </div>
      )}

      {/* ── 2. TYPE DE BÂTIMENT ── */}
      <div className="panel-section">
        <STitle right={byType.length+' types'}>Type de bâtiment le plus utilisé</STitle>
        <CChart id="c-bv-type" height={230} deps={[byType]} build={ctx=>new Chart(ctx,{
          type:'doughnut',
          data:{
            labels: byType.map(([t])=>t.length>24?t.slice(0,22)+'…':t),
            datasets:[{
              data:       byType.map(([,c])=>c),
              backgroundColor: PALETTE.slice(0,byType.length).map(c=>c+'dd'),
              borderColor:     PALETTE.slice(0,byType.length),
              borderWidth:2, hoverOffset:10,
            }],
          },
          options:{
            responsive:true,maintainAspectRatio:false,cutout:'55%',
            plugins:{
              legend:{position:'right',labels:{font:{size:9},boxWidth:9,padding:5}},
              tooltip:{callbacks:{label:c=>{const tot=c.dataset.data.reduce((s,v)=>s+v,0);return `${c.label}: ${fmt(c.parsed)} (${pct(c.parsed,tot)}%)`}}},
            },
          },
        })}/>
        {byType[0]&&(
          <div className="an2-winner-badge" style={{borderColor:PALETTE[0],color:PALETTE[0]}}>
            🏆 <strong>{byType[0][0]}</strong> — type dominant ({pct(byType[0][1],total)}% des bureaux)
          </div>
        )}
      </div>

      {/* ── 3. % AVEC 1 URNE ── */}
      <div className="panel-section">
        <STitle right={fmt(avec1Urne)+' / '+fmt(total)}>Bureaux avec une seule urne</STitle>
        <div className="an2-gauge-wrap">
          <div className="an2-big-gauge">
            <div className="an2-big-num" style={{color:pct1u>60?CM.red:CM.green}}>{pct1u}%</div>
            <div className="an2-big-lbl">des bureaux<br/>ont 1 seule urne</div>
          </div>
          <CChart id="c-bv-urne" height={170} deps={[avec1Urne,total]} build={ctx=>new Chart(ctx,{
            type:'doughnut',
            data:{
              labels:['1 urne','2+ urnes'],
              datasets:[{
                data:[avec1Urne, total-avec1Urne],
                backgroundColor:[CM.red+'cc',CM.green+'cc'],
                borderColor:[CM.red,CM.green],
                borderWidth:2,hoverOffset:8,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,cutout:'65%',
              plugins:{
                legend:{position:'bottom',labels:{font:{size:10}}},
                tooltip:{callbacks:{label:c=>`${fmt(c.parsed)} bureaux (${pct(c.parsed,total)}%)`}},
              },
            },
          })}/>
        </div>
      </div>

      {/* ── 4. INSCRITS VS VOTANTS PAR ARROND ── */}
      {byArr.length>0&&(
        <div className="panel-section">
          <STitle right={`Élection ${year}`}>Inscrits & Votants par arrondissement</STitle>
          <CChart id="c-bv-arrond" height={300} deps={[byArr,year]} build={ctx=>new Chart(ctx,{
            type:'bar',
            data:{
              labels: byArr.map(a=>a.name.length>14?a.name.slice(0,13)+'…':a.name),
              datasets:[
                {label:'Inscrits', data:byArr.map(a=>a.ins), backgroundColor:CM.green+'88',borderColor:CM.green, borderWidth:1.5,borderRadius:3},
                {label:'Votants',  data:byArr.map(a=>a.vot), backgroundColor:CM.red+'88',  borderColor:CM.red,   borderWidth:1.5,borderRadius:3},
              ],
            },
            options:{
              responsive:true,maintainAspectRatio:false,
              plugins:{
                legend:{position:'top'},
                tooltip:{callbacks:{afterBody:items=>[`Taux: ${byArr[items[0].dataIndex].tx}%`]}},
              },
              scales:{
                y:{beginAtZero:true,grid:{color:'#e0e3d815'},ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v}},
                x:{grid:{display:false},ticks:{font:{size:8}}},
              },
            },
          })}/>
        </div>
      )}

      {/* ── 5. RÉPARTITION CARTOGRAPHIQUE — TAUX PARTICIPATION ── */}
      {txArr.length>0&&(
        <div className="panel-section">
          <STitle right={`${year} · couleur par seuil`}>Taux de participation — répartition par arrondissement</STitle>
          <CChart id="c-bv-tx" height={Math.max(220,txArr.length*22)} deps={[txArr,year]} build={ctx=>new Chart(ctx,{
            type:'bar',
            indexAxis:'y',
            data:{
              labels: txArr.map(a=>a.name.length>20?a.name.slice(0,18)+'…':a.name),
              datasets:[{
                label:'Participation (%)',
                data:   txArr.map(a=>a.tx),
                backgroundColor: txArr.map(a=>a.tx>=60?CM.green+'bb':a.tx>=40?'#e8a800bb':CM.red+'bb'),
                borderColor:     txArr.map(a=>a.tx>=60?CM.green:a.tx>=40?'#e8a800':CM.red),
                borderWidth:1.5, borderRadius:3,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,
              plugins:{
                legend:{display:false},
                tooltip:{callbacks:{label:c=>`${c.parsed.x}% de participation`,afterLabel:c=>[`Inscrits: ${fmt(txArr[c.dataIndex].ins)}`,`Votants: ${fmt(txArr[c.dataIndex].vot)}`]}},
              },
              scales:{
                x:{beginAtZero:true,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#e0e3d815'}},
                y:{grid:{display:false},ticks:{font:{size:9}}},
              },
            },
          })}/>
          <div className="an2-legend-chips">
            <span className="an2-chip-green">≥ 60% Fort</span>
            <span className="an2-chip-yellow">40-59% Moyen</span>
            <span className="an2-chip-red">&lt;40% Faible</span>
          </div>
        </div>
      )}

      {/* ── 6. VOTES PAR PARTI ── */}
      {partyD.length>0&&(
        <div className="panel-section">
          <STitle right={`${year} · suffrages exprimés`}>Résultats par parti politique</STitle>
          <CChart id="c-bv-partis" height={220} deps={[partyD,year]} build={ctx=>new Chart(ctx,{
            type:'doughnut',
            data:{
              labels: partyD.map(([p])=>p),
              datasets:[{
                data:            partyD.map(([,v])=>v),
                backgroundColor: partyD.map(([p])=>PC(p)+'dd'),
                borderColor:     partyD.map(([p])=>PC(p)),
                borderWidth:2, hoverOffset:10,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,cutout:'52%',
              plugins:{
                legend:{position:'right',labels:{font:{size:10},boxWidth:11,padding:8}},
                tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.parsed)} voix (${pct(c.parsed,totVoix)}%)`}},
              },
            },
          })}/>
          <div style={{marginTop:10}}>
            {partyD.map(([p,v],i)=>(
              <PartyRow key={p} name={p} votes={v} total={totVoix} rank={i}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ELECAM DASHBOARD
// ============================================================
function ELECAMDashboard({ elecams }) {
  const total    = elecams.length;
  const actifs   = elecams.filter(e=>(e.statut||'').toLowerCase().includes('opération')).length;
  const inactifs = total - actifs;
  const totCap   = elecams.reduce((s,e)=>s+(+e.capacite||0),0);
  const moyC     = total>0 ? Math.round(totCap/total) : 0;

  const statuts = useMm(()=>Object.entries(groupBy(elecams,'statut')).sort((a,b)=>b[1]-a[1]),[elecams]);

  const capArr  = useMm(()=>{
    const m={};
    elecams.forEach(e=>{
      const k=e.arrondissement||'—';
      if(!m[k]) m[k]={tot:0,n:0};
      m[k].tot+=(+e.capacite||0); m[k].n++;
    });
    return Object.entries(m).map(([name,d])=>({name,tot:d.tot,moy:Math.round(d.tot/d.n),n:d.n}))
      .filter(a=>a.tot>0).sort((a,b)=>b.tot-a.tot).slice(0,12);
  },[elecams]);

  return (
    <div>
      {/* ── KPI ROW ── */}
      <div className="panel-section">
        <div className="an2-kpi-row">
          <KPI value={fmt(total)}   label="Points ELECAM"       color={CM.green} icon="📍"/>
          <KPI value={fmt(actifs)}  label="Actifs"              color={CM.green} icon="✅" sub={pct(actifs,total)+'%'}/>
          <KPI value={fmt(inactifs)}label="Inactifs"            color={inactifs/total>.1?CM.red:'#e8a800'} icon="⚠" sub={pct(inactifs,total)+'%'}/>
          <KPI value={fmt(moyC)}    label="Capacité moy./centre" color={CM.dark} icon="👥"/>
        </div>
      </div>

      {/* ── TAUX INACTIVITÉ ── */}
      <div className="panel-section">
        <STitle right={fmt(total)+' points'}>État opérationnel des centres</STitle>
        <div className="an2-gauge-wrap">
          <div className="an2-big-gauge">
            <div className="an2-big-num" style={{color:pct(inactifs,total)>10?CM.red:CM.green}}>
              {pct(inactifs,total)}%
            </div>
            <div className="an2-big-lbl">inactivité</div>
            <div className="an2-big-sub">{fmt(inactifs)} / {fmt(total)} inactifs</div>
          </div>
          <CChart id="c-elec-statut" height={190} deps={[statuts]} build={ctx=>new Chart(ctx,{
            type:'doughnut',
            data:{
              labels: statuts.map(([s])=>s||'Non renseigné'),
              datasets:[{
                data:            statuts.map(([,c])=>c),
                backgroundColor: statuts.map(([s])=>(s||'').toLowerCase().includes('opération')?CM.green+'cc':CM.red+'cc'),
                borderColor:     statuts.map(([s])=>(s||'').toLowerCase().includes('opération')?CM.green:CM.red),
                borderWidth:2, hoverOffset:8,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,cutout:'60%',
              plugins:{
                legend:{position:'bottom'},
                tooltip:{callbacks:{label:c=>`${c.label}: ${fmt(c.parsed)} (${pct(c.parsed,total)}%)`}},
              },
            },
          })}/>
        </div>
      </div>

      {/* ── CAPACITÉ PAR ARROND ── */}
      {capArr.length>0&&(
        <div className="panel-section">
          <STitle right="répartition cartographique">Capacité d'inscription par arrondissement</STitle>
          <CChart id="c-elec-cap" height={Math.max(240,capArr.length*22)} deps={[capArr]} build={ctx=>new Chart(ctx,{
            type:'bar',
            indexAxis:'y',
            data:{
              labels: capArr.map(a=>a.name.length>20?a.name.slice(0,18)+'…':a.name),
              datasets:[{
                label:'Capacité totale',
                data:   capArr.map(a=>a.tot),
                backgroundColor: capArr.map((_,i)=>`hsl(${148-i*8},${62-i*2}%,${38+i*2}%)`+'cc'),
                borderColor:     capArr.map((_,i)=>`hsl(${148-i*8},${62-i*2}%,${38+i*2}%)`),
                borderWidth:1.5, borderRadius:3,
              }],
            },
            options:{
              responsive:true,maintainAspectRatio:false,
              plugins:{
                legend:{display:false},
                tooltip:{callbacks:{
                  label:c=>`Capacité: ${fmt(c.parsed.x)} inscriptions`,
                  afterLabel:c=>[`${capArr[c.dataIndex].n} centres · moy. ${fmt(capArr[c.dataIndex].moy)}/centre`],
                }},
              },
              scales:{
                x:{beginAtZero:true,grid:{color:'#e0e3d815'},ticks:{callback:v=>v>=1000?(v/1000).toFixed(0)+'k':v}},
                y:{grid:{display:false},ticks:{font:{size:9}}},
              },
            },
          })}/>
          <div className="an2-cap-summary">
            <span>Capacité totale nationale : <strong style={{color:CM.green}}>{fmt(totCap)}</strong> inscriptions</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// COMPOSANT RACINE
// ============================================================
function Analytics({ data, state, setState }) {
  const [section, setSec] = useSt('bv');

  const cities  = useMm(()=>[...new Set([...data.elecam,...data.bv].map(p=>p.ville))].sort(),[data]);
  const arronds = useMm(()=>{
    const s=new Set();
    const add=p=>{ if(state.city==='all'||p.ville===state.city) s.add(p.arrondissement); };
    data.elecam.forEach(add); data.bv.forEach(add);
    return [...s].filter(a=>a&&a!=='—').sort();
  },[data,state.city]);

  const arrond = state.quartier || 'all';
  const yr = state.year || (data.years?.[data.years.length-1]);

  const bvs = useMm(() => data.bv.filter(b => (
    (state.city === 'all' || b.ville === state.city) &&
    (arrond === 'all' || b.arrondissement === arrond) &&
    window.hasElectionData(b, yr)
  )), [data, state.city, arrond, yr]);

  const elecam = useMm(() => data.elecam.filter(e => (
    (state.city === 'all' || e.ville === state.city) &&
    (arrond === 'all' || e.arrondissement === arrond)
  )), [data, state.city, arrond]);

  if (!window.Chart) return (
    <div className="panel-section" style={{color:'var(--ink-3)',fontSize:13,textAlign:'center',padding:24}}>
      <div style={{fontSize:20,marginBottom:8}}>📊</div>
      Initialisation de Chart.js…
    </div>
  );

  return (
    <div>
      {/* ── FILTRES GLOBAUX ── */}
      <div className="an2-filters">
        <div className="an2-filter-grp">
          <label className="an2-filter-lbl">Ville</label>
          <select className="an2-sel" value={state.city} onChange={e=>setState({...state, city:e.target.value, quartier:''})}>
            <option value="all">Toutes</option>
            {cities.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="an2-filter-grp">
          <label className="an2-filter-lbl">Arrondissement</label>
          <select className="an2-sel" value={arrond} onChange={e=>setState({...state, quartier:e.target.value==='all'?'':e.target.value})}>
            <option value="all">Tous</option>
            {arronds.map(a=><option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        {section==='bv' && data.years?.length>0 && (
          <div className="an2-filter-grp">
            <label className="an2-filter-lbl">Élection</label>
            <select className="an2-sel" value={yr} onChange={e=>setState({...state, year:+e.target.value})}>
              {data.years.map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── SECTION TABS ── */}
      <div className="an2-sec-tabs">
        <button className={`an2-sec-tab ${section==='bv'?'active':''}`} onClick={()=>setSec('bv')}>
          <span className="an2-sec-dot" style={{background:CM.red}}/>
          Bureaux de vote
        </button>
        <button className={`an2-sec-tab ${section==='elecam'?'active':''}`} onClick={()=>setSec('elecam')}>
          <span className="an2-sec-dot" style={{background:CM.green}}/>
          Points ELECAM
        </button>
      </div>

      {section==='bv'    && <BVDashboard    bvs={bvs}       years={data.years} year={yr}/>}
      {section==='elecam'&& <ELECAMDashboard elecams={elecam}/>}
    </div>
  );
}

window.Analytics = Analytics;
