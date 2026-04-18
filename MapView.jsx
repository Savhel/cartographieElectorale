// ============================================================
// MapView.jsx — Leaflet map with clustering, hover, routing
// ============================================================
const { useEffect: useEffectM, useRef: useRefM, useState: useStateM } = React;

function pinSVG(fill, inner){
  return `
    <svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 0C6.71 0 0 6.71 0 15c0 11.25 15 25 15 25s15-13.75 15-25C30 6.71 23.29 0 15 0z" fill="${fill}"/>
      <circle cx="15" cy="15" r="9.5" fill="white"/>
      <g transform="translate(8.5,8.5)" stroke="${fill}" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round">${inner}</g>
    </svg>`;
}
const ELECAM_INNER = '<path d="M11 11.5v-1a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v1"/><circle cx="6.5" cy="3.5" r="2"/>';
const BV_INNER = '<rect x="1.5" y="3" width="10" height="8" rx="1"/><path d="M4.5 3V2a2 2 0 0 1 4 0v1"/><path d="M4 7h5"/>';

function makeIcon(kind, selected){
  const color = kind === 'elecam' ? '#1b5e3c' : '#a02a2a';
  return L.divIcon({
    className:'marker-pin'+(selected?' selected':''),
    html: pinSVG(color, kind==='elecam'?ELECAM_INNER:BV_INNER),
    iconSize:[30,40],
    iconAnchor:[15,40],
  });
}

function clusterIcon(cluster){
  const children = cluster.getAllChildMarkers();
  let nE=0, nB=0;
  for(const m of children){ if(m.options._kind==='elecam') nE++; else nB++; }
  const total = nE+nB;
  let cls='cluster-marker';
  if(nE && nB) cls+=' mixed'; else if(nE) cls+=' elecam-only'; else cls+=' bv-only';
  if(total>100) cls+=' huge'; else if(total>25) cls+=' large';
  const label = total>=1000 ? (total/1000).toFixed(1)+'k' : String(total);
  return L.divIcon({html:`<div class="${cls}">${label}</div>`, className:'', iconSize:[42,42]});
}

function MapView({data, state, selected, onPick, onHover, routeLine}){
  const mapRef = useRefM(null);
  const mapInst = useRefM(null);
  const clusterGroupRef = useRefM(null);
  const userMarkerRef = useRefM(null);
  const routeLayerRef = useRefM(null);

  // Determine initial center from data
  const initialView = useRefM(null);
  if(!initialView.current){
    const pts = [...data.elecam, ...data.bv];
    const b = window.computeBounds(pts);
    if(b){
      initialView.current = {
        center: [(b.minLat+b.maxLat)/2, (b.minLng+b.maxLng)/2],
        bounds: [[b.minLat,b.minLng],[b.maxLat,b.maxLng]],
      };
    }else{
      initialView.current = { center:[3.86,11.51], bounds:null };
    }
  }

  useEffectM(()=>{
    if(mapInst.current) return;
    const map = L.map(mapRef.current, {
      center: initialView.current.center,
      zoom: 12,
      zoomControl:false,
      preferCanvas:true,
    });
    L.control.zoom({position:'bottomright'}).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution:'© OpenStreetMap · © CARTO',
      maxZoom:19, subdomains:'abcd',
    }).addTo(map);
    if(initialView.current.bounds) map.fitBounds(initialView.current.bounds, {padding:[40,40]});
    mapInst.current = map;

    const group = L.markerClusterGroup({
      chunkedLoading:true, showCoverageOnHover:false, spiderfyOnMaxZoom:true,
      maxClusterRadius:50, iconCreateFunction: clusterIcon,
    });
    map.addLayer(group);
    clusterGroupRef.current = group;

    return () => { map.remove(); mapInst.current=null; };
  }, []);

  // Fly to selected city
  useEffectM(()=>{
    if(!mapInst.current) return;
    const filtered = window.sidebarFilter(data, state);
    const all = [...filtered.elecam, ...filtered.bv];
    const b = window.computeBounds(all);
    if(b){
      mapInst.current.flyToBounds([[b.minLat,b.minLng],[b.maxLat,b.maxLng]], {padding:[60,60], duration:0.7});
    }
  }, [state.city, state.kind, state.quartier, state.year]);

  // Markers
  useEffectM(()=>{
    if(!clusterGroupRef.current) return;
    const group = clusterGroupRef.current;
    group.clearLayers();
    const filtered = window.sidebarFilter(data, state);
    const all = [...filtered.elecam, ...filtered.bv];
    const markers = all.map(item => {
      const m = L.marker([item.lat,item.lng], {
        icon: makeIcon(item.kind, false),
        _kind: item.kind, _id: item.id,
      });
      m.on('click', () => onPick(item));
      m.on('mouseover', (e) => {
        const pt = mapInst.current.latLngToContainerPoint(e.latlng);
        const mapRect = mapRef.current.getBoundingClientRect();
        onHover && onHover({item, x: mapRect.left+pt.x, y: mapRect.top+pt.y});
      });
      m.on('mouseout', () => { onHover && onHover(null); });
      return m;
    });
    group.addLayers(markers);
  }, [data, state.city, state.kind, state.quartier, state.query, state.year]);

  // Highlight selection
  useEffectM(()=>{
    if(!selected || !mapInst.current) return;
    mapInst.current.flyTo([selected.lat, selected.lng], Math.max(mapInst.current.getZoom(), 15), {duration:0.4});
  }, [selected?.id]);

  // User marker
  useEffectM(()=>{
    if(!mapInst.current) return;
    if(userMarkerRef.current){ mapInst.current.removeLayer(userMarkerRef.current); userMarkerRef.current=null; }
    if(state.userLoc){
      const icon = L.divIcon({
        className:'',
        html:`<div style="width:18px;height:18px;border-radius:50%;background:#1f4a8f;border:3px solid white;box-shadow:0 0 0 6px rgba(31,74,143,0.2),0 2px 6px rgba(0,0,0,0.25)"></div>`,
        iconSize:[18,18], iconAnchor:[9,9],
      });
      userMarkerRef.current = L.marker([state.userLoc.lat,state.userLoc.lng], {icon, zIndexOffset:1500}).addTo(mapInst.current);
      mapInst.current.flyTo([state.userLoc.lat, state.userLoc.lng], Math.max(mapInst.current.getZoom(), 14), {duration:0.6});
    }
  }, [state.userLoc]);

  // Route line
  useEffectM(()=>{
    if(!mapInst.current) return;
    if(routeLayerRef.current){ mapInst.current.removeLayer(routeLayerRef.current); routeLayerRef.current=null; }
    if(routeLine && routeLine.coords && routeLine.coords.length){
      const layer = L.layerGroup();
      L.polyline(routeLine.coords, {color:'#1b5e3c', weight:6, opacity:0.4, lineCap:'round'}).addTo(layer);
      L.polyline(routeLine.coords, {color:'#1b5e3c', weight:3, opacity:1, lineCap:'round'}).addTo(layer);
      layer.addTo(mapInst.current);
      routeLayerRef.current = layer;
      mapInst.current.flyToBounds(L.latLngBounds(routeLine.coords), {padding:[80,80], duration:0.6});
    }
  }, [routeLine]);

  return <div id="map" ref={mapRef}/>;
}

window.MapView = MapView;
