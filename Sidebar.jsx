// ============================================================
// Sidebar.jsx — panel flottant: Liste / Filtres / Import
// ============================================================
const { useMemo: useMemoS, useState: useStateS, useRef: useRefS } = React;

function normalize(s){
  return (s||'').toString().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

window.sidebarFilter = function(data, state){
  const q = normalize(state.query);
  const { city, kind, quartier, year } = state;
  const want = (item, k) => {
    if(kind !== 'all' && kind !== k) return false;
    if(city !== 'all' && item.ville !== city) return false;
    if(quartier && item.arrondissement !== quartier) return false;
    if(k === 'bv' && !window.hasElectionData(item, year)) return false;
    if(q){
      const hay = normalize(item.nom+' '+item.quartier+' '+item.arrondissement+' '+(item.type_batiment||''));
      if(!hay.includes(q)) return false;
    }
    return true;
  };
  return {
    elecam: data.elecam.filter(i=>want(i,'elecam')),
    bv:     data.bv.filter(i=>want(i,'bv')),
  };
};

function ListTab({data, state, setState, onPick, selectedId}){
  const filtered = useMemoS(()=>{
    const res = window.sidebarFilter(data, state);
    const items = [...res.elecam, ...res.bv];
    if(state.userLoc){
      items.forEach(i=>{ i._d = window.distanceKm(state.userLoc.lat,state.userLoc.lng,i.lat,i.lng); });
      items.sort((a,b)=>a._d-b._d);
    }
    return items;
  }, [data, state.city, state.kind, state.quartier, state.query, state.userLoc, state.year]);

  const nE = filtered.filter(i=>i.kind==='elecam').length;
  const nB = filtered.filter(i=>i.kind==='bv').length;

  return (
    <div>
      <div className="panel-section">
        <div className="search-wrap">
          <Icon.search className="search-icon" style={{width:14,height:14}}/>
          <input className="search" placeholder="Nom, quartier, arrondissement…"
            value={state.query}
            onChange={e=>setState({...state, query:e.target.value})}
          />
        </div>
      </div>

      <div className="panel-section">
        <div className="stats-grid">
          <div className="stat green">
            <div className="stat-val">{nE.toLocaleString('fr-FR')}</div>
            <div className="stat-lbl">Points ELECAM</div>
          </div>
          <div className="stat red">
            <div className="stat-val">{nB.toLocaleString('fr-FR')}</div>
            <div className="stat-lbl">Bureaux de vote</div>
          </div>
        </div>
      </div>

      <div>
        <div className="panel-section-head" style={{padding:'12px 18px 6px'}}>
          <span className="panel-section-title">
            Résultats · {filtered.length.toLocaleString('fr-FR')}
            {state.userLoc && <span style={{color:'var(--cm-green)',marginLeft:6}}>· par distance</span>}
          </span>
        </div>
        <div className="result-list">
          {filtered.length===0 && (() => {
            const loc = window.findCameroonLocation(state.query);
            const suggestions = loc
              ? window.findNearestPoints(loc.lat, loc.lng, window.sidebarFilter(data, {...state, query:''}), 10)
              : null;
            return (
              <div>
                {suggestions && suggestions.length > 0 ? (
                  <div className="location-suggest">
                    <div className="location-suggest-head">
                      <Icon.mapPin style={{width:14,height:14}}/>
                      Lieu reconnu : <strong style={{marginLeft:4}}>{loc.name}</strong> · {loc.region}
                    </div>
                    <div className="location-suggest-desc">
                      Ce quartier n'est pas directement dans nos données. Voici les 10 points de vote et d'inscription ELECAM les plus proches :
                    </div>
                    {suggestions.map((item,i) => (
                      <div key={item.id||i} className="suggest-item" onClick={()=>onPick(item)}>
                        <div className={`sug-icon ${item.kind==='elecam'?'elecam':'bv'}`}>
                          {item.kind==='elecam'?'E':'BV'}
                        </div>
                        <span className="sug-name">{item.nom}</span>
                        <span className="sug-dist">
                          {item._dist < 1
                            ? (item._dist*1000).toFixed(0)+' m'
                            : item._dist.toFixed(1)+' km'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="result-empty">
                    <div style={{marginBottom:6}}>Aucun résultat pour « {state.query||'—'} ».</div>
                    <div style={{fontSize:10,color:'var(--ink-4)'}}>Essayez un autre quartier, arrondissement ou le nom du lieu.</div>
                  </div>
                )}
              </div>
            );
          })()}
          {filtered.slice(0,200).map(item => (
            <div key={item.id}
              className={`result-item ${selectedId===item.id?'selected':''}`}
              onClick={()=>onPick(item)}>
              <div className={`result-icon ${item.kind==='elecam'?'elecam':'bv'}`}>
                {item.kind==='elecam' ? <Icon.users style={{width:14,height:14}}/> : <Icon.urn style={{width:14,height:14}}/>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div className="result-name">{item.nom}</div>
                <div className="result-meta">
                  <span>{item.quartier}</span>
                  <span className="sep">·</span>
                  <span>{item.arrondissement}</span>
                  {state.userLoc && item._d!=null && <>
                    <span className="sep">·</span>
                    <span className="result-distance">{item._d<1? (item._d*1000).toFixed(0)+' m' : item._d.toFixed(1)+' km'}</span>
                  </>}
                </div>
              </div>
            </div>
          ))}
          {filtered.length>200 && <div className="result-empty" style={{fontSize:11}}>
            {(filtered.length-200).toLocaleString('fr-FR')} autres sur la carte.
          </div>}
        </div>
      </div>
    </div>
  );
}

function FilterTab({data, state, setState}){
  const arrondissements = useMemoS(()=>{
    const set = new Set();
    const add = i => { if(state.city==='all'||i.ville===state.city) set.add(i.arrondissement); };
    data.elecam.forEach(add); data.bv.forEach(add);
    return [...set].filter(a=>a && a!=='—').sort();
  }, [data, state.city]);

  const exportCity = (yr) => {
    const rows = data.bv.filter(b => state.city==='all' || b.ville===state.city).map(b => b._raw);
    if(!rows.length) return;
    const allCols = Object.keys(rows[0]);
    const keep = allCols.filter(c => !/_\d{4}$/.test(c) || c.endsWith('_'+yr));
    window.downloadCSV(`BureauxDeVote_${state.city==='all'?'toutes':state.city}_${yr}.csv`, rows, keep);
  };

  return (
    <div>
      <div className="panel-section">
        <div className="panel-section-head">
          <span className="panel-section-title">Type</span>
        </div>
        <div className="chip-row">
          <button className={`chip ${state.kind==='all'?'active':''}`} onClick={()=>setState({...state, kind:'all'})}>Tous</button>
          <button className={`chip ${state.kind==='elecam'?'active':''}`} onClick={()=>setState({...state, kind:'elecam'})}>ELECAM</button>
          <button className={`chip ${state.kind==='bv'?'active':''}`} onClick={()=>setState({...state, kind:'bv'})}>Bureaux</button>
        </div>
      </div>

      <div className="panel-section">
        <div className="panel-section-head">
          <span className="panel-section-title">Arrondissement · {arrondissements.length}</span>
          {state.quartier && <button className="chip active" onClick={()=>setState({...state, quartier:''})}>Tout · ×</button>}
        </div>
        <div className="chip-row">
          {arrondissements.map(a => (
            <button key={a} className={`chip ${state.quartier===a?'active':''}`}
              onClick={()=>setState({...state, quartier: state.quartier===a?'':a})}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {data.years && data.years.length>0 && (
        <div className="panel-section">
          <div className="panel-section-head">
            <span className="panel-section-title">Élection</span>
          </div>
          <div className="chip-row">
            {data.years.map(y => (
              <button key={y} className={`chip ${state.year===y?'active':''}`}
                onClick={()=>setState({...state, year:y})}>
                {y}
              </button>
            ))}
          </div>
        </div>
      )}

      {data.years && data.years.length>0 && (
        <div className="panel-section">
          <div className="panel-section-head">
            <span className="panel-section-title">Exporter CSV par élection</span>
          </div>
          <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:8,lineHeight:1.5}}>
            Résultats des bureaux de vote ({state.city==='all'?'toutes villes':state.city}).
          </div>
          <div style={{display:'grid',gridTemplateColumns:`repeat(${data.years.length},1fr)`,gap:6}}>
            {data.years.map(y => (
              <button key={y} className="btn" onClick={()=>exportCity(y)} style={{justifyContent:'center',padding:'9px 4px',fontSize:11}}>
                <Icon.download/> {y}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportTab({onImport, data}){
  const [forcedKind, setForcedKind] = useStateS('auto');
  const [files, setFiles] = useStateS([]);
  const [dragging, setDragging] = useStateS(false);
  const [hasCustom, setHasCustom] = useStateS(false);
  const inputRef = useRefS(null);

  React.useEffect(()=>{
    window.loadImportedData().then(d => setHasCustom(!!(d && (d.elecam?.length || d.bv?.length))));
  }, []);

  const handleFiles = async (list) => {
    const out = [];
    for(const f of list){
      try{
        const text = await f.text();
        const rows = window.parseAny(text, f.name);
        const kind = forcedKind==='auto' ? undefined : forcedKind;
        const processed = window.processRows(rows, kind);
        out.push({name:f.name, size:f.size, rows:rows.length, processed, ok:true});
      }catch(e){
        out.push({name:f.name, size:f.size, error:e.message, ok:false});
      }
    }
    setFiles(f => [...f, ...out]);
  };

  const runImport = (replace) => {
    const okFiles = files.filter(f=>f.ok);
    if(!okFiles.length) return;
    const merged = window.mergeResults(okFiles.map(f=>f.processed));
    onImport(merged, replace);
    setFiles([]);
  };

  return (
    <div>
      <div className="panel-section">
        <div className="panel-section-head">
          <span className="panel-section-title">Type à importer</span>
        </div>
        <div className="import-role">
          <button className={`g ${forcedKind==='auto'?'active g':''}`} onClick={()=>setForcedKind('auto')}>
            <span className="icon" style={{background:'var(--ink)'}}><Icon.filter style={{width:14,height:14}}/></span>
            <div><div className="t">Auto-détection</div><div className="s">Lit les en-têtes</div></div>
          </button>
          <button className={`g ${forcedKind==='elecam'?'active g':''}`} onClick={()=>setForcedKind('elecam')}>
            <span className="icon"><Icon.users style={{width:14,height:14}}/></span>
            <div><div className="t">Points ELECAM</div><div className="s">Inscriptions</div></div>
          </button>
        </div>
        <div style={{marginBottom:6}}>
          <button className={`btn ${forcedKind==='bv'?'red':''}`} style={{width:'100%',justifyContent:'center'}} onClick={()=>setForcedKind('bv')}>
            <Icon.urn style={{width:13,height:13}}/> Bureaux de vote
          </button>
        </div>
      </div>

      <div className="panel-section">
        <div
          className={`dropzone ${dragging?'dragging':''}`}
          onClick={()=>inputRef.current.click()}
          onDragOver={(e)=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={(e)=>{e.preventDefault();setDragging(false);handleFiles(e.dataTransfer.files);}}>
          <Icon.upload/>
          <div className="t">Déposez vos fichiers ici</div>
          <div className="s">CSV · JSON · GeoJSON — toute ville, tout format compatible</div>
          <input ref={inputRef} type="file" accept=".csv,.json,.geojson" multiple hidden
            onChange={e=>handleFiles(e.target.files)}/>
        </div>

        {files.map((f,i)=>(
          <div key={i} className={`import-file-line ${f.ok?'ok':'err'}`}>
            <Icon.file/>
            <div className="n">{f.name}</div>
            {f.ok ? (
              <div className="m">{f.processed.elecam.length+f.processed.bv.length} points · {f.processed.meta.kind}</div>
            ):(
              <div className="m">❌ {f.error}</div>
            )}
            <button className="x" onClick={()=>setFiles(files.filter((_,j)=>j!==i))}><Icon.close style={{width:10,height:10}}/></button>
          </div>
        ))}

        {files.some(f=>f.ok) && (
          <div className="import-actions">
            <button className="btn primary" onClick={()=>runImport(false)}>
              <Icon.upload/> Ajouter aux données
            </button>
            <button className="btn" onClick={()=>runImport(true)}>
              Remplacer tout
            </button>
          </div>
        )}

        <div style={{marginTop:16,padding:'10px 12px',background:'var(--paper)',borderRadius:'var(--r-sm)',fontSize:11,color:'var(--ink-3)',lineHeight:1.55}}>
          <strong style={{color:'var(--ink-2)'}}>Colonnes attendues</strong><br/>
          <span style={{fontFamily:'var(--font-mono)',fontSize:10}}>id · nom · ville · arrondissement · quartier · latitude · longitude · telephone</span>
          <br/><br/>
          ELECAM ajoute : <span style={{fontFamily:'var(--font-mono)',fontSize:10}}>email · capacite_inscriptions · horaires_ouverture · statut</span>
          <br/>
          Bureaux : <span style={{fontFamily:'var(--font-mono)',fontSize:10}}>type_batiment · nb_urnes · pmr</span> + colonnes par année <span style={{fontFamily:'var(--font-mono)',fontSize:10}}>inscrits_YYYY, PARTI_votes_YYYY</span>…
        </div>
      </div>

      <div className="panel-section">
        <div style={{fontSize:11,color:'var(--ink-3)',marginBottom:10}}>
          <strong style={{color:'var(--ink-2)'}}>Données actives</strong><br/>
          {data.elecam.length.toLocaleString('fr-FR')} points ELECAM · {data.bv.length.toLocaleString('fr-FR')} bureaux<br/>
          {data.cities?.length||0} villes · {data.years?.length||0} élections · {data.parties?.length||0} partis
        </div>
        {hasCustom && (
          <div style={{background:'rgba(0,154,68,0.08)',border:'1px solid rgba(0,154,68,0.25)',borderRadius:'var(--r-sm)',padding:'8px 10px',fontSize:11,color:'var(--cm-green)',marginBottom:8,display:'flex',alignItems:'center',gap:6}}>
            <span>✓</span> Données importées · sauvegardées dans ce navigateur
          </div>
        )}
        {hasCustom && (
          <button className="btn" style={{width:'100%',justifyContent:'center',fontSize:11,color:'var(--cm-red)',borderColor:'var(--cm-red)'}}
            onClick={async()=>{ await window.clearImportedData(); location.reload(); }}>
            ↺ Réinitialiser avec les données officielles
          </button>
        )}
      </div>
    </div>
  );
}

function Sidebar({data, state, setState, onPick, selectedId, onImport}){
  const [tab, setTab] = useStateS('list');
  return (
    <div className="panel-card">
      <div className="panel-tabs">
        <button className={`panel-tab ${tab==='list'?'active':''}`} onClick={()=>setTab('list')}>
          <Icon.list/> Liste
        </button>
        <button className={`panel-tab ${tab==='analytics'?'active':''}`} onClick={()=>setTab('analytics')}>
          <Icon.chart/> Analyse
        </button>
        <button className={`panel-tab ${tab==='filter'?'active':''}`} onClick={()=>setTab('filter')}>
          <Icon.filter/> Filtres
        </button>
        <button className={`panel-tab ${tab==='import'?'active':''}`} onClick={()=>setTab('import')}>
          <Icon.upload/> Import
        </button>
      </div>
      <div className="panel-body">
        {tab==='list' && <ListTab data={data} state={state} setState={setState} onPick={onPick} selectedId={selectedId}/>}
        {tab==='analytics' && <Analytics data={data} state={state} setState={setState}/>}
        {tab==='filter' && <FilterTab data={data} state={state} setState={setState}/>}
        {tab==='import' && <ImportTab onImport={onImport} data={data}/>}
      </div>
    </div>
  );
}

window.Sidebar = Sidebar;
