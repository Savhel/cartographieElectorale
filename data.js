// ============================================================
// data.js — Chargement et parsing CSV/JSON GÉNÉRIQUE v2
// Détecte automatiquement les colonnes, les villes, les années
// ============================================================

async function fetchText(path){
  const r = await fetch(path);
  if(!r.ok) throw new Error("Échec chargement "+path);
  return await r.text();
}

function splitCSVLine(line){
  const out = []; let cur=''; let inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){ if(inQ && line[i+1]==='"'){cur+='"';i++;} else inQ=!inQ; }
    else if(c===',' && !inQ){ out.push(cur); cur=''; }
    else cur+=c;
  }
  out.push(cur); return out;
}
function parseCSV(text){
  const lines = text.split(/\r?\n/).filter(l=>l.length);
  if(!lines.length) return [];
  const headers = splitCSVLine(lines[0]).map(h=>h.trim());
  const rows = [];
  for(let i=1;i<lines.length;i++){
    const vals = splitCSVLine(lines[i]);
    const o = {};
    for(let j=0;j<headers.length;j++) o[headers[j]] = (vals[j]||'').trim();
    rows.push(o);
  }
  return rows;
}
function numberize(v){
  if(v===undefined||v===null||v==='') return 0;
  const n = Number(String(v).replace(',','.'));
  return Number.isFinite(n) ? n : 0;
}

function deriveBureauNumero(id, nom){
  const idText = String(id || '').trim();
  const nomText = String(nom || '').trim();
  const idMatch = idText.match(/(\d+)(?!.*\d)/);
  if(idMatch) return idMatch[1];
  const nameMatch = nomText.match(/\bbureau\s*(\d+)\b/i);
  if(nameMatch) return nameMatch[1];
  return idText || '';
}

// Parse a file (string) -> array of objects
function parseAny(text, filename){
  const ext = (filename||'').toLowerCase().split('.').pop();
  const trimmed = text.trimStart();
  if(ext === 'json' || trimmed.startsWith('[') || trimmed.startsWith('{')){
    const j = JSON.parse(text);
    if(Array.isArray(j)) return j;
    // support {data: [...]} or {rows: [...]}
    if(j.data && Array.isArray(j.data)) return j.data;
    if(j.rows && Array.isArray(j.rows)) return j.rows;
    if(j.features && Array.isArray(j.features)){
      // GeoJSON
      return j.features.map(f => ({
        ...(f.properties||{}),
        latitude:  f.geometry?.coordinates?.[1],
        longitude: f.geometry?.coordinates?.[0],
      }));
    }
    return [j];
  }
  return parseCSV(text);
}

// ---------- SMART COLUMN DETECTION ----------
const ALIAS = {
  id:           ['id','code','reference','ref'],
  nom:          ['nom','name','libelle','designation','title'],
  ville:        ['ville','city','commune'],
  arrondissement:['arrondissement','arr','district','commune','departement'],
  quartier:     ['quartier','neighborhood','zone','secteur'],
  latitude:     ['latitude','lat','y'],
  longitude:    ['longitude','lng','lon','long','x'],
  telephone:    ['telephone','tel','phone','contact','numero'],
  email:        ['email','mail','courriel'],
  capacite:     ['capacite','capacity','capacite_inscriptions','max_inscriptions'],
  horaires:     ['horaires','horaires_ouverture','hours','ouverture','schedule'],
  statut:       ['statut','status','etat'],
  type_batiment:['type_batiment','type','building','batiment'],
  nb_urnes:     ['nb_urnes','urnes','ballot_boxes'],
  accessibilite_pmr:['accessibilite_pmr','pmr','accessibility','handicap','accessible'],
};

function normalizeKey(k){
  return String(k).trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]/g,'_').replace(/^_+|_+$/g,'');
}

function buildColumnMap(headers){
  const norm = headers.map(h => [h, normalizeKey(h)]);
  const map = {};
  for(const [canon, aliases] of Object.entries(ALIAS)){
    const aliasNorm = aliases.map(normalizeKey);
    for(const [h, n] of norm){
      if(aliasNorm.includes(n)){ map[canon]=h; break; }
    }
    if(!map[canon]){
      // relaxed: contains
      for(const [h,n] of norm){
        if(aliasNorm.some(a => n.includes(a))){ map[canon]=h; break; }
      }
    }
  }
  return map;
}

// Detect years and party names from columns like "inscrits_2019", "RDPC_votes_2017"
function detectElections(headers){
  const yearsSet = new Set();
  const partiesSet = new Set();
  const normH = headers.map(h => ({raw:h, norm:normalizeKey(h)}));
  for(const {norm} of normH){
    const ym = norm.match(/(19|20)\d{2}/);
    if(ym) yearsSet.add(Number(ym[0]));
    // party_votes_YYYY pattern
    const pm = norm.match(/^([a-z]+)_votes_(19|20)\d{2}$/);
    if(pm) partiesSet.add(pm[1].toUpperCase());
  }
  return {
    years: [...yearsSet].sort(),
    parties: [...partiesSet],
  };
}

// Find a field in a row given canon + optional year suffix
function getField(row, colMap, canon, year){
  const base = colMap[canon];
  if(year){
    // look for canon_YYYY
    const norm = normalizeKey(canon);
    for(const k of Object.keys(row)){
      const kn = normalizeKey(k);
      if(kn === `${norm}_${year}`) return row[k];
    }
    return undefined;
  }
  return base ? row[base] : undefined;
}

// Build an ELECAM point from a row
function rowToElecam(row, colMap){
  const get = (c) => {
    const k = colMap[c]; return k ? row[k] : undefined;
  };
  const lat = Number(get('latitude'));
  const lng = Number(get('longitude'));
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;
  return {
    kind:'elecam',
    id: get('id') || `ELECAM-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    nom: get('nom') || 'Point ELECAM',
    ville: get('ville') || '—',
    arrondissement: get('arrondissement') || '—',
    quartier: get('quartier') || '—',
    lat, lng,
    telephone: get('telephone') || '',
    email: get('email') || '',
    capacite: numberize(get('capacite')),
    horaires: get('horaires') || '',
    statut: get('statut') || 'Opérationnel',
    _raw: row,
  };
}

// Build a BV from a row, dynamic years & parties
function rowToBV(row, colMap, years, parties){
  const get = (c) => { const k = colMap[c]; return k ? row[k] : undefined; };
  const lat = Number(get('latitude'));
  const lng = Number(get('longitude'));
  if(!Number.isFinite(lat)||!Number.isFinite(lng)) return null;

  const elections = {};
  const findByNorm = (nk) => {
    for(const k of Object.keys(row)) if(normalizeKey(k)===nk) return row[k];
    return undefined;
  };
  for(const y of years){
    const votes = {};
    let totalVotes = 0;
    for(const p of parties){
      const v = numberize(findByNorm(`${normalizeKey(p)}_votes_${y}`));
      votes[p] = v; totalVotes += v;
    }
    const inscrits = numberize(findByNorm(`inscrits_${y}`));
    const votants  = numberize(findByNorm(`votants_${y}`));
    const nuls     = numberize(findByNorm(`bulletins_nuls_${y}`));
    const SVE      = numberize(findByNorm(`sve_${y}`));
    let taux       = numberize(findByNorm(`taux_participation_${y}`));
    if(taux > 1) taux = taux / 100;
    if(!taux && inscrits) taux = votants/inscrits;
    elections[y] = { inscrits, votants, nuls, SVE, taux, votes, total_valid: totalVotes };
  }

  const pmrRaw = get('accessibilite_pmr');
  const pmr = typeof pmrRaw === 'boolean' ? pmrRaw :
              /^(oui|yes|true|1)$/i.test(String(pmrRaw||''));

  return {
    kind:'bv',
    id: get('id') || `BV-${lat.toFixed(4)}-${lng.toFixed(4)}`,
    nom: get('nom') || 'Bureau de vote',
    numero_bureau: deriveBureauNumero(get('id'), get('nom')),
    ville: get('ville') || '—',
    arrondissement: get('arrondissement') || '—',
    quartier: get('quartier') || '—',
    type_batiment: get('type_batiment') || '—',
    lat, lng,
    telephone: get('telephone') || '',
    nb_urnes: numberize(get('nb_urnes')),
    pmr,
    elections,
    _raw: row,
  };
}

// Heuristic kind detection from rows
function guessKind(rows){
  if(!rows.length) return 'unknown';
  const headers = Object.keys(rows[0]).map(normalizeKey);
  const hasVotes = headers.some(h => /^[a-z]+_votes_\d{4}$/.test(h));
  const hasInscrits = headers.some(h => /^inscrits_\d{4}$/.test(h));
  if(hasVotes || hasInscrits) return 'bv';
  const hasCap = headers.some(h => h.includes('capacite') || h.includes('inscription'));
  const hasHoraire = headers.some(h => h.includes('horaire') || h.includes('statut'));
  if(hasCap || hasHoraire) return 'elecam';
  return 'unknown';
}

function processRows(rows, forcedKind){
  if(!rows.length) return {elecam:[], bv:[], meta:{}};
  const headers = Object.keys(rows[0]);
  const colMap = buildColumnMap(headers);
  const kind = forcedKind || guessKind(rows);
  if(kind === 'elecam'){
    const pts = rows.map(r => rowToElecam(r, colMap)).filter(Boolean);
    return {elecam: pts, bv: [], meta:{kind, rows:pts.length}};
  }
  if(kind === 'bv'){
    const {years, parties} = detectElections(headers);
    const pts = rows.map(r => rowToBV(r, colMap, years, parties)).filter(Boolean);
    return {elecam: [], bv: pts, meta:{kind, rows:pts.length, years, parties}};
  }
  return {elecam:[], bv:[], meta:{kind}};
}

// Auto-bootstrap: vérifie IDB → bundle.json → CSV
async function loadBundled(){
  // 1. Données importées persistées (IndexedDB)
  const saved = await loadImportedData();
  if(saved && (saved.elecam?.length || saved.bv?.length)) return saved;

  // 2. Essai bundle JSON pré-compilé (1 seule requête, gzip auto)
  try {
    const r = await fetch('data/bundle.json');
    if(r.ok){
      const bundle = await r.json();
      if(bundle.elecam?.length || bundle.bv?.length){
        // Traiter comme des rows bruts
        const eRows = processRows(bundle.elecam||[], 'elecam');
        const bRows = processRows(bundle.bv||[], 'bv');
        return mergeResults([eRows, bRows]);
      }
    }
  } catch(e){ /* fallback vers CSV */ }

  // Fallback: 4 fichiers CSV en parallèle
  const files = [
    {path:'data/PointsELECAM_Yaounde.csv',  kind:'elecam'},
    {path:'data/PointsELECAM_Douala.csv',   kind:'elecam'},
    {path:'data/BureauxDeVote_Yaounde.csv', kind:'bv'},
    {path:'data/BureauxDeVote_Douala.csv',  kind:'bv'},
  ];
  const results = await Promise.all(files.map(async f => {
    const txt = await fetchText(f.path);
    return processRows(parseAny(txt, f.path), f.kind);
  }));
  return mergeResults(results);
}

function mergeResults(results){
  const elecam = [], bv = [];
  const yearsSet = new Set(), partiesSet = new Set();
  for(const r of results){
    elecam.push(...r.elecam); bv.push(...r.bv);
    (r.meta?.years||[]).forEach(y=>yearsSet.add(y));
    (r.meta?.parties||[]).forEach(p=>partiesSet.add(p));
  }
  // If no dynamic years, keep BV-derived years
  if(!yearsSet.size){
    bv.forEach(b => Object.keys(b.elections||{}).forEach(y=>yearsSet.add(Number(y))));
  }
  if(!partiesSet.size){
    bv.forEach(b => Object.values(b.elections||{}).forEach(e => Object.keys(e.votes||{}).forEach(p=>partiesSet.add(p))));
  }
  const years = [...yearsSet].sort();
  const parties = [...partiesSet];
  // Derive cities dynamically
  const citiesSet = new Set();
  elecam.concat(bv).forEach(p => citiesSet.add(p.ville));
  const cities = [...citiesSet].filter(c => c && c!=='—').sort();
  return { elecam, bv, years, parties, cities };
}

// Haversine
function distanceKm(lat1,lng1,lat2,lng2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180;
  const dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

// Compute bounds for a list of points
function computeBounds(points){
  if(!points.length) return null;
  let minLat=Infinity, maxLat=-Infinity, minLng=Infinity, maxLng=-Infinity;
  for(const p of points){
    if(p.lat<minLat) minLat=p.lat;
    if(p.lat>maxLat) maxLat=p.lat;
    if(p.lng<minLng) minLng=p.lng;
    if(p.lng>maxLng) maxLng=p.lng;
  }
  return {minLat,maxLat,minLng,maxLng};
}

function hasElectionData(item, year){
  if(item?.kind !== 'bv' || !year) return true;
  const election = item.elections?.[year];
  if(!election) return false;
  const totalVotes = Object.values(election.votes || {}).reduce((sum, value) => sum + numberize(value), 0);
  return (
    numberize(election.inscrits) > 0 ||
    numberize(election.votants) > 0 ||
    numberize(election.nuls) > 0 ||
    numberize(election.SVE) > 0 ||
    totalVotes > 0
  );
}

// ---- IndexedDB persistence for imported data ----
const _IDB_NAME = 'VotonsProche';
const _IDB_STORE = 'importedData';
const _IDB_KEY = 'userData';

function _openDB(){
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(_IDB_NAME, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(_IDB_STORE);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = e => reject(e.target.error);
  });
}

async function saveImportedData(data){
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).put(data, _IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = e => reject(e.target.error);
    });
  } catch(e){ console.warn('IDB save:', e); }
}

async function loadImportedData(){
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readonly');
      const req = tx.objectStore(_IDB_STORE).get(_IDB_KEY);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror = e => reject(e.target.error);
    });
  } catch(e){ return null; }
}

async function clearImportedData(){
  try {
    const db = await _openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(_IDB_STORE, 'readwrite');
      tx.objectStore(_IDB_STORE).delete(_IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror = e => reject(e.target.error);
    });
  } catch(e){}
}

// CSV download
function downloadCSV(filename, rows, headers){
  if(!rows || !rows.length) return;
  const cols = headers || Object.keys(rows[0]);
  const esc = v => {
    if(v===null||v===undefined) return '';
    const s = String(v);
    if(/[",\n]/.test(s)) return '"'+s.replace(/"/g,'""')+'"';
    return s;
  };
  const body = [cols.join(','), ...rows.map(r => cols.map(c=>esc(r[c])).join(','))].join('\n');
  const blob = new Blob([body], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

Object.assign(window, {
  loadBundled,
  parseAny,
  processRows,
  mergeResults,
  distanceKm,
  computeBounds,
  hasElectionData,
  downloadCSV,
  saveImportedData,
  loadImportedData,
  clearImportedData,
});
