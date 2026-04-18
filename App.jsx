// ============================================================
// App.jsx — root v3
// ============================================================
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA, useMemo: useMemoA } = React;

function HoverCard({hover}){
  if(!hover) return null;
  const {item, x, y} = hover;
  const isE = item.kind === 'elecam';
  return (
    <div className="hover-card" style={{left:x, top:y}}>
      <div className={`hover-card-stripe ${isE?'elecam':'bv'}`}/>
      <div className="hover-card-body">
        <span className={`hover-kind ${isE?'elecam':'bv'}`}>
          {isE ? '● ELECAM · Inscription' : '● Bureau de vote'}
        </span>
        <h4>{item.nom}</h4>
        <div className="hover-meta">{item.quartier} · {item.arrondissement}</div>
        {isE ? (
          <>
            <div className="hover-fact"><Icon.clock/> {item.horaires||'—'}</div>
            <div className="hover-fact" style={{marginTop:2,paddingTop:0,borderTop:'none'}}>
              <span className={`status-dot ${(item.statut||'').toLowerCase().includes('opération')?'ok':'closed'}`}/>
              {item.statut}
            </div>
          </>
        ) : (
          <>
            <div className="hover-fact"><Icon.urn/> {item.type_batiment} · {item.nb_urnes} urne{item.nb_urnes>1?'s':''}</div>
            {item._d!=null && <div className="hover-fact" style={{marginTop:2,paddingTop:0,borderTop:'none'}}>
              <Icon.locate/> {item._d<1?(item._d*1000).toFixed(0)+' m':item._d.toFixed(1)+' km'} de vous
            </div>}
          </>
        )}
        <div className="hover-click">Cliquez pour voir les détails →</div>
      </div>
    </div>
  );
}

const CHAT_PRESETS = [
  "Trouver mon bureau le plus proche",
  "Trouver un centre ELECAM",
  "Voir les bureaux accessibles PMR",
  "Quel est le taux de participation ?",
];

function chatNorm(text){
  return (text||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

function chatDistance(distanceKm){
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(1)} km`;
}

function chatScopeLabel(state){
  if(state.quartier) return `${state.quartier}, ${state.city === 'all' ? 'zone actuelle' : state.city}`;
  if(state.city === 'all') return 'l’ensemble des villes affichées';
  return state.city;
}

function chatFiltered(data, state, kind='all'){
  const filtered = window.sidebarFilter(data, {...state, kind, query:''});
  if(kind === 'elecam') return filtered.elecam;
  if(kind === 'bv') return filtered.bv;
  return [...filtered.elecam, ...filtered.bv];
}

function chatNearest(items, userLoc){
  if(!userLoc || !items.length) return null;
  let best = null;
  for(const item of items){
    const distance = window.distanceKm(userLoc.lat, userLoc.lng, item.lat, item.lng);
    if(!best || distance < best.distance) best = { item, distance };
  }
  return best;
}

function chatbotReply(question, data, state){
  const q = chatNorm(question);
  const scope = chatScopeLabel(state);
  const year = state.year || data.years?.[data.years.length-1];
  const bureaux = chatFiltered(data, state, 'bv');
  const centres = chatFiltered(data, state, 'elecam');
  const all = [...centres, ...bureaux];

  if(!q.trim()){
    return { text:"Posez une question courte, par exemple sur votre bureau, l’inscription, la participation ou l’accessibilité PMR." };
  }

  if(q.includes('bonjour') || q.includes('salut') || q.includes('bonsoir')){
    return { text:`Je peux vous aider pour ${scope} : bureau le plus proche, centre ELECAM, accessibilité PMR, participation ou nombre de lieux.` };
  }

  if(q.includes('pmr') || q.includes('mobilite reduite') || q.includes('handicap') || q.includes('accessible')){
    const accessibles = bureaux.filter(b => b.pmr);
    const nearest = chatNearest(accessibles, state.userLoc);
    if(!accessibles.length){
      return { text:`Je ne vois aucun bureau signalé comme accessible PMR dans ${scope} pour l’élection ${year}.` };
    }
    if(nearest){
      return {
        text:`Il y a ${accessibles.length.toLocaleString('fr-FR')} bureau(x) accessible(s) PMR dans ${scope}. Le plus proche est ${nearest.item.nom}, à ${chatDistance(nearest.distance)}.`,
        actionLabel:'Ouvrir la fiche',
        actionType:'pick',
        item:nearest.item,
      };
    }
    return {
      text:`Il y a ${accessibles.length.toLocaleString('fr-FR')} bureau(x) accessible(s) PMR dans ${scope}. Activez votre position pour trouver le plus proche.`,
      actionLabel:'Me localiser',
      actionType:'locate',
    };
  }

  if(q.includes('inscri') || q.includes('elecam') || q.includes('centre')){
    const nearest = chatNearest(centres, state.userLoc);
    if(!centres.length){
      return { text:`Je ne trouve aucun centre d’inscription dans ${scope}.` };
    }
    if(nearest){
      return {
        text:`Le centre d’inscription le plus proche est ${nearest.item.nom}, à ${chatDistance(nearest.distance)}. Il se trouve à ${nearest.item.quartier}, ${nearest.item.arrondissement}.`,
        actionLabel:'Ouvrir la fiche',
        actionType:'pick',
        item:nearest.item,
      };
    }
    return {
      text:`Je vois ${centres.length.toLocaleString('fr-FR')} centre(s) d’inscription dans ${scope}. Activez votre position pour trouver le plus proche.`,
      actionLabel:'Me localiser',
      actionType:'locate',
    };
  }

  if(q.includes('bureau') || q.includes('voter') || q.includes('vote')){
    const nearest = chatNearest(bureaux, state.userLoc);
    if(!bureaux.length){
      return { text:`Je ne trouve aucun bureau de vote dans ${scope} pour l’élection ${year}.` };
    }
    if(nearest){
      return {
        text:`Le bureau de vote le plus proche est ${nearest.item.nom}, à ${chatDistance(nearest.distance)}. Il se trouve à ${nearest.item.quartier}, ${nearest.item.arrondissement}.`,
        actionLabel:'Ouvrir la fiche',
        actionType:'pick',
        item:nearest.item,
      };
    }
    return {
      text:`Je vois ${bureaux.length.toLocaleString('fr-FR')} bureau(x) de vote dans ${scope}. Activez votre position pour trouver le plus proche.`,
      actionLabel:'Me localiser',
      actionType:'locate',
    };
  }

  if(q.includes('participation') || q.includes('votants') || q.includes('resultat')){
    const inscrits = bureaux.reduce((sum, b) => sum + (b.elections?.[year]?.inscrits || 0), 0);
    const votants = bureaux.reduce((sum, b) => sum + (b.elections?.[year]?.votants || 0), 0);
    const taux = inscrits ? ((votants / inscrits) * 100).toFixed(1) : null;
    if(!inscrits){
      return { text:`Je n’ai pas assez d’informations de participation pour ${scope} en ${year}.` };
    }
    return { text:`Dans ${scope}, le taux de participation estimé est de ${taux}% pour ${year}, avec ${votants.toLocaleString('fr-FR')} votants sur ${inscrits.toLocaleString('fr-FR')} inscrits.` };
  }

  if(q.includes('combien') || q.includes('nombre') || q.includes('total')){
    return { text:`Dans ${scope}, il y a ${centres.length.toLocaleString('fr-FR')} centre(s) d’inscription et ${bureaux.length.toLocaleString('fr-FR')} bureau(x) de vote visibles avec les filtres actuels.` };
  }

  if(q.includes('ou suis') || q.includes('quelle ville') || q.includes('ma zone') || q.includes('arrondissement')){
    return { text:`Vous consultez actuellement ${scope}. ${all.length.toLocaleString('fr-FR')} lieu(x) sont visibles avec les filtres en cours.` };
  }

  return { text:"Je peux répondre aux questions simples sur votre bureau de vote, l’inscription ELECAM, l’accessibilité PMR, la participation ou le nombre de lieux affichés." };
}

function Chatbot({data, state, onLocate, onPick}){
  const [open, setOpen] = useStateA(false);
  const [input, setInput] = useStateA('');
  const [messages, setMessages] = useStateA([
    {
      id:1,
      role:'bot',
      text:"Bonjour. Je peux vous aider à trouver un bureau, un centre d’inscription ou une information simple sur la zone affichée.",
    }
  ]);

  const visibleCount = useMemoA(() => chatFiltered(data, state).length, [data, state.city, state.kind, state.quartier, state.query, state.year]);

  const ask = (question) => {
    const clean = (question||'').trim();
    if(!clean) return;
    const reply = chatbotReply(clean, data, state);
    setMessages(current => [
      ...current,
      {id: Date.now(), role:'user', text: clean},
      {id: Date.now()+1, role:'bot', ...reply},
    ]);
    setInput('');
    setOpen(true);
  };

  return (
    <>
      {open && (
        <div className="chatbot-panel">
          <div className="chatbot-head">
            <div>
              <div className="chatbot-title">Assistant électoral</div>
              <div className="chatbot-sub">{visibleCount.toLocaleString('fr-FR')} lieu(x) visibles</div>
            </div>
            <button className="chatbot-close" onClick={()=>setOpen(false)} aria-label="Fermer">
              <Icon.close/>
            </button>
          </div>

          <div className="chatbot-presets">
            {CHAT_PRESETS.map(preset => (
              <button key={preset} className="chatbot-chip" onClick={()=>ask(preset)}>{preset}</button>
            ))}
          </div>

          <div className="chatbot-messages">
            {messages.map(message => (
              <div key={message.id} className={`chatbot-message ${message.role}`}>
                <div className="chatbot-bubble">{message.text}</div>
                {message.actionType === 'locate' && (
                  <button className="chatbot-action" onClick={onLocate}>{message.actionLabel}</button>
                )}
                {message.actionType === 'pick' && message.item && (
                  <button className="chatbot-action" onClick={()=>onPick(message.item)}>{message.actionLabel}</button>
                )}
              </div>
            ))}
          </div>

          <form className="chatbot-form" onSubmit={e=>{e.preventDefault(); ask(input);}}>
            <input
              className="chatbot-input"
              value={input}
              onChange={e=>setInput(e.target.value)}
              placeholder="Posez une question simple…"
            />
            <button className="chatbot-send" type="submit">
              <Icon.arrow/>
            </button>
          </form>
        </div>
      )}

      <button className="chatbot-launcher" onClick={()=>setOpen(v=>!v)} title="Assistant électoral">
        <Icon.message/>
      </button>
    </>
  );
}

function App(){
  const [data, setData] = useStateA(null);
  const [loadError, setLoadError] = useStateA(null);
  const [showWelcome, setShowWelcome] = useStateA(() => !localStorage.getItem('vp_welcomed2'));
  const [state, setState] = useStateA(()=>{
    try{
      const saved = JSON.parse(localStorage.getItem('vp_state2')||'null');
      if(saved) return { userLoc:null, ...saved };
    }catch(e){}
    return { city:'Yaoundé', kind:'all', quartier:'', query:'', year:null, userLoc:null };
  });
  const [selected, setSelected] = useStateA(null);
  const [panelOpen, setPanelOpen] = useStateA(true);
  const [hover, setHover] = useStateA(null);
  const [route, setRoute] = useStateA(null);
  const [toast, setToast] = useStateA(null);
  const autoLocateTried = useRefA(false);

  useEffectA(()=>{
    const { userLoc, ...p } = state;
    localStorage.setItem('vp_state2', JSON.stringify(p));
  }, [state]);

  useEffectA(()=>{
    window.loadBundled().then(setData).catch(e=>{console.error(e);setLoadError(e.message)});
  }, []);

  useEffectA(()=>{
    if(!data?.years?.length) return;
    const latestYear = data.years[data.years.length-1];
    setState(s => {
      if(s.year && data.years.includes(s.year)) return s;
      return { ...s, year: latestYear };
    });
  }, [data]);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 2500); };

  const locateMe = ({ initial=false } = {}) => {
    if(!navigator.geolocation){
      if(!initial) showToast("Géolocalisation non disponible");
      return;
    }
    if(!initial) showToast("Recherche de votre position…");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat:pos.coords.latitude, lng:pos.coords.longitude };
        // auto city: nearest of data cities
        let nearestCity = state.city;
        if(data && data.cities?.length){
          let best = Infinity;
          for(const c of data.cities){
            const pts = [...data.elecam, ...data.bv].filter(p=>p.ville===c);
            if(!pts.length) continue;
            const cb = window.computeBounds(pts);
            const cc = {lat:(cb.minLat+cb.maxLat)/2, lng:(cb.minLng+cb.maxLng)/2};
            const d = window.distanceKm(loc.lat,loc.lng,cc.lat,cc.lng);
            if(d < best){ best = d; nearestCity = c; }
          }
        }
        setState(s => ({ ...s, userLoc:loc, city: nearestCity }));
        showToast(initial ? `Carte centrée sur votre position · ${nearestCity}` : `Position trouvée · ${nearestCity}`);
      },
      (error) => {
        if(error?.code === error.PERMISSION_DENIED){
          showToast("Autorisation de localisation refusée");
          return;
        }
        showToast("Position introuvable pour le moment");
      },
      { enableHighAccuracy:true, timeout:5000 }
    );
  };

  useEffectA(()=>{
    if(!data || autoLocateTried.current) return;
    autoLocateTried.current = true;
    locateMe({ initial:true });
  }, [data]);

  const handleImport = (merged, replace) => {
    if(!data) return;
    let newData;
    if(replace){
      newData = merged;
      const newCity = merged.cities?.[0] || 'all';
      setState(s => ({...s, city:newCity, quartier:'', query:''}));
      showToast(`Données remplacées · ${merged.elecam.length+merged.bv.length} points`);
    }else{
      newData = window.mergeResults([
        {elecam:data.elecam, bv:data.bv, meta:{years:data.years, parties:data.parties}},
        merged,
      ]);
      showToast(`Ajouté · ${merged.elecam.length+merged.bv.length} nouveaux points`);
    }
    setData(newData);
    window.saveImportedData(newData).then(()=>showToast('💾 Données enregistrées sur cet appareil'));
  };

  if(loadError) return <div style={{padding:40}}><h2>Erreur</h2><p>{loadError}</p></div>;
  if(!data) return (
    <div className="loading-screen">
        <div className="loading-inner">
        <div className="loading-mark">
          <img src="favicon.svg?v=2" alt="Carte du Cameroun" />
        </div>
        <div className="loading-title">Votons Proche</div>
        <div className="loading-tag">Chargement de la plateforme électorale…</div>
        <div className="loading-bar"><div className="loading-bar-fill"/></div>
      </div>
    </div>
  );

  const cities = data.cities || [];
  const totalElec = data.elecam.length;
  const totalBV = data.bv.length;

  return (
    <>
      <div className="app">
        <div className="map-wrap">
          <MapView
            data={data}
            state={state}
            selected={selected}
            onPick={setSelected}
            onHover={setHover}
            routeLine={route}
          />

          {/* Top bar */}
          <div className="topbar">
            <div className="brand-card">
              <div className="brand-mark">
                <img src="favicon.svg?v=2" alt="Carte du Cameroun" />
              </div>
              <div>
                <div className="brand-name">Votons Proche</div>
                <div className="brand-tag">Plateforme Électorale · République du Cameroun</div>
              </div>
            </div>

            <div className="topbar-center">
              <div className="city-toggle">
                {cities.map(c => (
                  <button key={c} className={state.city===c?'active':''} onClick={()=>setState({...state,city:c,quartier:''})}>{c}</button>
                ))}
                {cities.length>1 && <button className={state.city==='all'?'active':''} onClick={()=>setState({...state,city:'all',quartier:''})}>Toutes</button>}
              </div>
              <div style={{width:1,height:22,background:'var(--line)'}}/>
              <div className="kind-toggle">
                <button className={state.kind==='all'?'active':''} onClick={()=>setState({...state,kind:'all'})}>
                  <span className="dot" style={{background:'var(--ink)'}}/> Tout
                </button>
                <button className={state.kind==='elecam'?'active':''} onClick={()=>setState({...state,kind:'elecam'})}>
                  <span className="dot" style={{background:'var(--cm-green)'}}/> ELECAM
                </button>
                <button className={state.kind==='bv'?'active':''} onClick={()=>setState({...state,kind:'bv'})}>
                  <span className="dot" style={{background:'var(--cm-red)'}}/> Bureaux
                </button>
              </div>
            </div>

            <div className="topbar-spacer"/>

            <button className="topbar-action primary" onClick={locateMe}>
              <Icon.locate/> <span>Près de moi</span>
            </button>
            <button className="topbar-action" onClick={()=>setShowWelcome(true)} title="À propos">
              <Icon.info/>
            </button>
          </div>

          {/* Left panel */}
          <div className={`panel-wrap ${panelOpen?'':'collapsed'}`}>
            <div className="panel-card" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <Sidebar
                data={data}
                state={state}
                setState={setState}
                onPick={setSelected}
                selectedId={selected?.id}
                onImport={handleImport}
              />
            </div>
            <button className="panel-toggle" onClick={()=>setPanelOpen(o=>!o)} title="Réduire / agrandir">
              <Icon.chevron/>
            </button>
          </div>

          {/* Map controls */}
          <div className="map-controls-br">
            <button className="map-btn primary" onClick={locateMe} title="Me localiser">
              <Icon.locate/>
            </button>
          </div>

          <Chatbot
            data={data}
            state={state}
            onLocate={()=>locateMe()}
            onPick={setSelected}
          />

          {/* Legend */}
          <div className={`map-legend ${panelOpen?'shifted':''}`}>
            <div className="map-legend-title">Légende</div>
            <div className="legend-row">
              <svg className="legend-mark" viewBox="0 0 30 40"><path d="M15 0C6.71 0 0 6.71 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.71 23.29 0 15 0z" fill="#1b5e3c"/><circle cx="15" cy="15" r="9.5" fill="white"/></svg>
              ELECAM · Inscription
            </div>
            <div className="legend-row">
              <svg className="legend-mark" viewBox="0 0 30 40"><path d="M15 0C6.71 0 0 6.71 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.71 23.29 0 15 0z" fill="#a02a2a"/><circle cx="15" cy="15" r="9.5" fill="white"/></svg>
              Bureau de vote
            </div>
            <div className="legend-row" style={{marginTop:4,fontSize:10,color:'var(--ink-4)'}}>
              Survolez un point pour un aperçu · Zoom pour défaire les grappes
            </div>
          </div>
        </div>
      </div>

      <HoverCard hover={hover}/>

      {selected && <Detail
        item={selected}
        userLoc={state.userLoc}
        onClose={()=>{setSelected(null);setRoute(null);}}
        onRouteUpdate={setRoute}
        onLocate={locateMe}
      />}

      {showWelcome && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget){localStorage.setItem('vp_welcomed2','1');setShowWelcome(false);}}}>
          <div className="modal-card">
            <div className="modal-cm-stripe"/>
            <button className="modal-close" onClick={()=>{localStorage.setItem('vp_welcomed2','1');setShowWelcome(false);}}><Icon.close/></button>
            <div className="modal-body">
              <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                <div className="modal-mark-anim">
                  <img src="favicon.svg?v=2" alt="Carte du Cameroun" />
                </div>
                <div>
                  <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase',color:'var(--cm-green)',marginBottom:2}}>République du Cameroun · ELECAM</div>
                  <div style={{fontSize:9,color:'var(--ink-4)',letterSpacing:'0.08em'}}>Paix · Travail · Patrie</div>
                </div>
              </div>
              <h2>Trouvez votre bureau. Inscrivez-vous. Votez informé.</h2>
              <p className="lead">
                Votons Proche cartographie <strong>{totalElec.toLocaleString('fr-FR')} centres ELECAM</strong> et <strong>{totalBV.toLocaleString('fr-FR')} bureaux de vote</strong>
                {cities.length>0 && <> à <strong>{cities.join(', ')}</strong></>}
                {data.years?.length>0 && <>, avec les résultats électoraux <strong>{data.years.join(', ')}</strong></>}.
                Analyse de participation, itinéraires et données comparatives par arrondissement.
              </p>
              <div className="welcome-features">
                <div className="welcome-feat a"><Icon.users/><strong>Inscription ELECAM</strong><span>Centre le plus proche, horaires, capacité, contacts.</span></div>
                <div className="welcome-feat b"><Icon.urn/><strong>Bureau de vote</strong><span>Localisez votre bureau, planifiez votre itinéraire.</span></div>
                <div className="welcome-feat c"><Icon.chart/><strong>Analyse électorale</strong><span>Taux de participation, résultats par parti et par bureau.</span></div>
                <div className="welcome-feat d"><Icon.upload/><strong>Données nationales</strong><span>Ajoutez vos propres listes pour toute ville du Cameroun.</span></div>
              </div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:14}}>
                {[
                  {icon:'📍', label:`${(totalElec+totalBV).toLocaleString('fr-FR')} points`, color:'var(--cm-green)'},
                  {icon:'🗳️', label:`${data.years?.length||0} élections`, color:'var(--cm-red)'},
                  {icon:'🌍', label:`${cities.length} ville(s)`, color:'var(--cm-yellow-3)'},
                ].map(b => (
                  <div key={b.label} style={{display:'inline-flex',alignItems:'center',gap:5,padding:'5px 10px',background:'var(--paper)',border:'1px solid var(--line)',borderRadius:'var(--r-sm)',fontSize:11,fontWeight:600}}>
                    <span>{b.icon}</span>
                    <span style={{color:b.color}}>{b.label}</span>
                  </div>
                ))}
              </div>
              <div className="import-actions">
                <button className="btn primary" onClick={()=>{localStorage.setItem('vp_welcomed2','1');setShowWelcome(false);}}>
                  <Icon.arrow/> Explorer la carte
                </button>
                <button className="btn" onClick={()=>{localStorage.setItem('vp_welcomed2','1');setShowWelcome(false);setTimeout(locateMe,200);}}>
                  <Icon.locate/> Près de moi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App/>);
