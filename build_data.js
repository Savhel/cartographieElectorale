#!/usr/bin/env node
// ============================================================
// build_data.js — Pré-compile les CSV en JSON compact
// Lance: node build_data.js
// Génère: data/bundle.json (chargement 3x plus rapide)
// ============================================================
const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const OUT_FILE = path.join(DATA_DIR, 'bundle.json');

function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim());
  return lines.slice(1).map(line => {
    const vals = []; let cur='', inq=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){ inq=!inq; continue; }
      if(c===','&&!inq){ vals.push(cur.trim()); cur=''; continue; }
      cur+=c;
    }
    vals.push(cur.trim());
    const obj={};
    headers.forEach((h,i)=>{ obj[h]=vals[i]||''; });
    return obj;
  }).filter(r => r[headers[0]]);
}

const files = fs.readdirSync(DATA_DIR).filter(f=>f.endsWith('.csv'));
console.log(`Trouvé ${files.length} fichiers CSV:`);
files.forEach(f=>console.log(' ·', f));

const bundle = { elecam:[], bv:[], generated: new Date().toISOString() };

files.forEach(file => {
  const text = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  const rows = parseCSV(text);
  const isElecam = file.toLowerCase().includes('elecam') ||
    Object.keys(rows[0]||{}).some(k => k.includes('capacite') || k.includes('horaires'));
  console.log(`  ${file}: ${rows.length} lignes → ${isElecam?'ELECAM':'BV'}`);
  if(isElecam) bundle.elecam.push(...rows);
  else bundle.bv.push(...rows);
});

const json = JSON.stringify(bundle);
fs.writeFileSync(OUT_FILE, json);

const sizeMB = (json.length/1024/1024).toFixed(2);
console.log(`\n✅ bundle.json généré: ${sizeMB} MB`);
console.log(`   ${bundle.elecam.length} points ELECAM + ${bundle.bv.length} bureaux de vote`);
console.log('\nPour l\'utiliser: ajoutez ?bundle=1 à l\'URL ou modifiez data.js');
