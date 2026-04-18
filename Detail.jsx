// ============================================================
// Detail.jsx — drawer with info, elections, routing
// ============================================================
const { useState: useStateD, useEffect: useEffectD } = React;

const PARTY_META = {
  RDPC:   { name:'RDPC',   color:'var(--party-RDPC)'   },
  CDP:    { name:'CDP',    color:'var(--party-CDP)'    },
  EPG:    { name:'EPG',    color:'var(--party-EPG)'    },
  SAJ:    { name:'SAJ',    color:'var(--party-SAJ)'    },
  ESA:    { name:'ESA',    color:'var(--party-ESA)'    },
  AUTRES: { name:'Autres', color:'var(--party-autres)' },
  autres: { name:'Autres', color:'var(--party-autres)' },
};
function partyMeta(name){
  return PARTY_META[name] || PARTY_META[name.toUpperCase()] || { name, color:'var(--party-autres)' };
}
const ELECTION_LABEL = {
  2017:'Municipales', 2018:'Législatives', 2019:'Présidentielles',
};

function StatusDot({statut}){
  const s = (statut||'').toLowerCase();
  const cls = s.includes('opération')||s.includes('ouvert') ? 'ok' :
              (s.includes('fermé')||s.includes('closed')?'closed':'other');
  return <span className={`status-dot ${cls}`}/>;
}

function TurnoutDial({pct}){
  const p = Math.max(0, Math.min(1, pct));
  const C = 2*Math.PI*28;
  return (
    <div className="turnout-dial">
      <svg width="68" height="68" viewBox="0 0 68 68">
        <circle cx="34" cy="34" r="28" fill="none" stroke="var(--paper-3)" strokeWidth="8"/>
        <circle cx="34" cy="34" r="28" fill="none"
          stroke={p >= 0.5 ? 'var(--cm-green)' : 'var(--cm-red)'}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${C*p} ${C}`}/>
      </svg>
      <div className="pct">{(p*100).toFixed(0)}%</div>
    </div>
  );
}

function PartyBar({name, votes, total, isWinner}){
  const pct = total ? votes/total : 0;
  const meta = partyMeta(name);
  return (
    <div className={`part-row-item ${isWinner?'winner':''}`}>
      <div className="part-bar-label">
        <span className="name">{meta.name}</span>
        <span className="votes">{votes.toLocaleString('fr-FR')} voix</span>
        <span className="pct" style={{marginLeft:8}}>{(pct*100).toFixed(1)}%</span>
      </div>
      <div className="part-bar">
        <div className="part-bar-fill" style={{width:(pct*100)+'%', background:meta.color}}/>
      </div>
    </div>
  );
}

function ElectionPanel({election, year}){
  const e = election;
  if(!e || !e.inscrits) return <div className="no-results">Pas de données pour cette élection.</div>;
  const parties = Object.keys(e.votes||{});
  const total = parties.reduce((s,p)=>s+e.votes[p],0);
  const ranked = [...parties].sort((a,b)=>e.votes[b]-e.votes[a]);
  const winner = ranked[0];
  return (
    <div>
      <div className="turnout-meter">
        <TurnoutDial pct={e.taux}/>
        <div className="turnout-meta">
          <div className="lbl">Participation · {year}</div>
          <div className="val"><strong>{e.votants.toLocaleString('fr-FR')}</strong> votants / <strong>{e.inscrits.toLocaleString('fr-FR')}</strong> inscrits</div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginTop:4}}>
            {e.nuls.toLocaleString('fr-FR')} bulletins nuls · {e.SVE.toLocaleString('fr-FR')} suffrages exprimés
          </div>
        </div>
      </div>

      <div className="part-row" style={{marginTop:16}}>
        <div className="part-cell highlight">
          <div className="big">{partyMeta(winner).name}</div>
          <div className="sub">En tête</div>
        </div>
        <div className="part-cell">
          <div className="big">{e.votes[winner].toLocaleString('fr-FR')}</div>
          <div className="sub">Voix gagnantes</div>
        </div>
        <div className="part-cell">
          <div className="big">{total? ((e.votes[winner]/total)*100).toFixed(0)+'%':'—'}</div>
          <div className="sub">Part suffrages</div>
        </div>
      </div>

      <div style={{marginTop:10}}>
        {ranked.map(p => <PartyBar key={p} name={p} votes={e.votes[p]} total={total} isWinner={p===winner}/>)}
      </div>
    </div>
  );
}

const ROUTE_MODES = [
  { id:'foot',    label:'Marche', icon:'walk', speed:5   }, // km/h
  { id:'bike',    label:'Vélo',   icon:'bike', speed:15  },
  { id:'driving', label:'Voiture',icon:'car',  speed:35  },
];

async function fetchRoute(from, to, mode){
  const profile = mode==='foot'?'foot':(mode==='bike'?'bike':'driving');
  const url = `https://router.project-osrm.org/route/v1/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  try{
    const r = await fetch(url);
    if(!r.ok) throw new Error('Service indisponible');
    const j = await r.json();
    if(!j.routes?.length) throw new Error('Aucun itinéraire');
    const r0 = j.routes[0];
    return {
      coords: r0.geometry.coordinates.map(([lng,lat])=>[lat,lng]),
      distanceKm: r0.distance/1000,
      durationMin: r0.duration/60,
      source:'route',
    };
  }catch(e){
    // Fallback: straight line + estimated duration
    const d = window.distanceKm(from.lat,from.lng,to.lat,to.lng);
    const speed = ROUTE_MODES.find(m=>m.id===mode)?.speed || 5;
    return {
      coords: [[from.lat,from.lng],[to.lat,to.lng]],
      distanceKm: d,
      durationMin: (d/speed)*60,
      source:'direct',
    };
  }
}

function RoutePanel({item, userLoc, onRouteUpdate, onLocate}){
  const [mode, setMode] = useStateD('foot');
  const [route, setRoute] = useStateD(null);
  const [loading, setLoading] = useStateD(false);

  useEffectD(()=>{
    if(!userLoc){ setRoute(null); onRouteUpdate(null); return; }
    setLoading(true);
    fetchRoute(userLoc, {lat:item.lat,lng:item.lng}, mode).then(r => {
      setRoute(r); setLoading(false); onRouteUpdate(r);
    });
  }, [userLoc, mode, item.id]);

  if(!userLoc){
    return (
      <div style={{padding:'12px 14px',background:'var(--paper)',border:'1px dashed var(--line-2)',borderRadius:'var(--r-sm)'}}>
        <div style={{fontSize:12,color:'var(--ink-3)',marginBottom:8}}>Activez votre position pour tracer l'itinéraire vers ce lieu.</div>
        <button className="btn green" onClick={onLocate}>
          <Icon.locate/> Me localiser
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="route-modes">
        {ROUTE_MODES.map(m => (
          <button key={m.id} className={`route-mode ${mode===m.id?'active':''}`} onClick={()=>setMode(m.id)}>
            {m.icon==='walk'&&<Icon.walk/>}
            {m.icon==='bike'&&<Icon.bike/>}
            {m.icon==='car'&&<Icon.car/>}
            {m.label}
          </button>
        ))}
      </div>
      <div className="route-info">
        <div>
          <div style={{fontSize:11,color:'var(--ink-3)',fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase'}}>Itinéraire</div>
          <div>
            <strong>{loading?'…':route? (route.durationMin<1?'< 1':Math.round(route.durationMin))+' min':'—'}</strong>
            <span style={{color:'var(--ink-3)',marginLeft:6,fontSize:12}}>
              · {route?route.distanceKm.toFixed(route.distanceKm<10?1:0)+' km':'—'}
            </span>
          </div>
          {route && <div style={{fontSize:10,color:'var(--ink-4)',marginTop:2}}>
            {route.source==='route'?'Trajet estimé sur route':'Estimation à vol d\'oiseau'}
          </div>}
        </div>
        <Icon.route style={{width:22,height:22,color:'var(--cm-green)'}}/>
      </div>
    </div>
  );
}

function Detail({item, userLoc, onClose, onRouteUpdate, onLocate}){
  const [year, setYear] = useStateD(null);
  const isElecam = item.kind==='elecam';
  const availYears = isElecam ? [] : Object.keys(item.elections||{}).map(Number).sort();
  const currentYear = year ?? availYears[availYears.length-1];

  useEffectD(()=>{ return () => onRouteUpdate(null); }, []);

  const exportThis = () => window.downloadCSV(`${item.id}.csv`, [item._raw]);

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer" role="dialog">
        <header className={`drawer-head ${isElecam?'elecam':'bv'}`}>
          <button className="drawer-close" onClick={onClose} aria-label="Fermer"><Icon.close/></button>
          <span className={`kind-badge ${isElecam?'elecam':'bv'}`}>
            {isElecam ? 'Point ELECAM · Inscription' : 'Bureau de vote'}
          </span>
          <h2>{item.nom}</h2>
          <div className="address">
            <Icon.mapPin style={{width:12,height:12,display:'inline',verticalAlign:-1,marginRight:4}}/>
            {item.quartier} · {item.arrondissement} · {item.ville}
          </div>
          <div className="drawer-actions">
            {item.telephone && (
              <a className="btn primary" href={`tel:${item.telephone.replace(/\s/g,'')}`}>
                <Icon.phone/> Appeler
              </a>
            )}
            <button className="btn" onClick={exportThis}>
              <Icon.download/> Télécharger
            </button>
          </div>
        </header>

        <div className="drawer-body">
          <div className="section-head">Itinéraire vers ce lieu</div>
          <RoutePanel item={item} userLoc={userLoc} onRouteUpdate={onRouteUpdate} onLocate={onLocate}/>

          <div className="section-head">Informations</div>
          <div className="info-grid">
            {isElecam ? (
              <>
                <div className="info-cell">
                  <div className="info-lbl">Statut</div>
                  <div className="info-val"><StatusDot statut={item.statut}/>{item.statut}</div>
                </div>
                <div className="info-cell">
                  <div className="info-lbl">Capacité</div>
                  <div className="info-val">{item.capacite.toLocaleString('fr-FR')} inscriptions</div>
                </div>
                <div className="info-cell" style={{gridColumn:'1 / -1'}}>
                  <div className="info-lbl">Horaires d'ouverture</div>
                  <div className="info-val">{item.horaires||'—'}</div>
                </div>
                {item.telephone && <div className="info-cell">
                  <div className="info-lbl">Téléphone</div>
                  <div className="info-val mono">{item.telephone}</div>
                </div>}
                {item.email && <div className="info-cell">
                  <div className="info-lbl">Email</div>
                  <div className="info-val mono" style={{fontSize:11,wordBreak:'break-all'}}>{item.email}</div>
                </div>}
              </>
            ) : (
              <>
                <div className="info-cell">
                  <div className="info-lbl">Type</div>
                  <div className="info-val">{item.type_batiment}</div>
                </div>
                <div className="info-cell">
                  <div className="info-lbl">Urnes</div>
                  <div className="info-val">{item.nb_urnes}</div>
                </div>
                <div className="info-cell">
                  <div className="info-lbl">Accessibilité PMR</div>
                  <div className="info-val">
                    <StatusDot statut={item.pmr?'Opérationnel':'Fermé'}/>
                    {item.pmr ? 'Accessible' : 'Non accessible'}
                  </div>
                </div>
                {item.telephone && <div className="info-cell">
                  <div className="info-lbl">Téléphone</div>
                  <div className="info-val mono">{item.telephone}</div>
                </div>}
              </>
            )}
          </div>
          <div className="info-cell" style={{marginTop:0}}>
            <div className="info-lbl">Localisation</div>
            <div className="info-val mono">{item.lat.toFixed(6)}, {item.lng.toFixed(6)}</div>
          </div>

          {!isElecam && availYears.length>0 && (
            <>
              <div className="section-head">Résultats des élections passées</div>
              <div className="elec-tabs">
                {availYears.map(y => (
                  <button key={y} className={`elec-tab ${currentYear===y?'active':''}`} onClick={()=>setYear(y)}>
                    <span className="year">{y}</span>
                    <span className="lbl">{ELECTION_LABEL[y]||'Scrutin'}</span>
                  </button>
                ))}
              </div>
              <ElectionPanel election={item.elections[currentYear]} year={currentYear}/>
            </>
          )}

          <div className="section-head">Bon à savoir</div>
          <div style={{padding:'14px 16px',background:'var(--paper)',border:'1px solid var(--line)',borderRadius:'var(--r-md)',fontSize:13,lineHeight:1.55,color:'var(--ink-2)'}}>
            {isElecam ?
              <>Pour vous inscrire, présentez-vous avec une <strong>pièce d'identité valide</strong> et un <strong>justificatif de domicile</strong>. L'inscription est <strong>gratuite</strong>.</>
            :
              <>Le jour du scrutin, venez avec votre <strong>carte d'électeur</strong> et une pièce d'identité. Partagez ce lien à vos proches pour qu'ils trouvent aussi leur bureau.</>
            }
          </div>
        </div>
      </aside>
    </>
  );
}

window.Detail = Detail;
