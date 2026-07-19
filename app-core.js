'use strict';

const DATA_KEY = 'mes-creations-v6';
const OLD_KEYS = ['mes-creations-v5','mes-creations-v4','mes-creations-data'];
const DEMO_TITLES = ['Aventure Ninja','Robot Galaxy','Mon Monde Magique','Les Héros du Parc','Les Pirates Rigolos','Dino Aventure','Explorateurs des Océans'];
const $ = selector => document.querySelector(selector);
const $$ = selector => Array.from(document.querySelectorAll(selector));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,10);
const now = () => Date.now();

let data = loadData();
let currentProjectId = data[0]?.id || null;
let currentSeasonId = data[0]?.seasons?.[0]?.id || null;
let editingProjectId = null;
let editingEpisodeId = null;
let projectDraftSeasons = [];
let managedDraftSeasons = [];
let pendingCover = null;
let pendingFirstVideo = null;
let pendingEpisodeVideo = null;
let playerUrl = null;
let playerBlob = null;
let playerName = 'episode-video.mp4';
let installPrompt = null;
let toastTimer = null;

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[char]);
}

function safeFileName(value){
  return String(value || 'video')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'').toLowerCase() || 'video';
}

function toast(message){
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

function normalizeEpisode(episode, index){
  return {
    id: episode?.id || uid(),
    n: Math.max(1, Number(episode?.n) || index + 1),
    title: String(episode?.title || `Épisode ${index + 1}`),
    summary: String(episode?.summary || ''),
    videoId: episode?.videoId || null,
    createdAt: Number(episode?.createdAt) || now()
  };
}

function normalizeSeason(season, index){
  const n = index + 1;
  return {
    id: season?.id || uid(),
    n,
    title: String(season?.title || `Saison ${n}`),
    episodes: Array.isArray(season?.episodes)
      ? season.episodes.map(normalizeEpisode).sort((a,b) => a.n - b.n)
      : []
  };
}

function normalizeProject(project){
  const seasons = Array.isArray(project?.seasons) && project.seasons.length
    ? project.seasons.map(normalizeSeason)
    : [normalizeSeason(null,0)];
  return {
    id: project?.id || uid(),
    title: String(project?.title || 'Nouvelle création'),
    category: String(project?.category || ''),
    desc: String(project?.desc || ''),
    cover: /^data:image\/(?:png|jpeg|jpg|webp);base64,/i.test(String(project?.cover || '')) ? project.cover : null,
    seasons,
    updated: Number(project?.updated) || now(),
    lastPlayed: Number(project?.lastPlayed) || 0
  };
}

function loadData(){
  let raw = null;
  for(const key of [DATA_KEY, ...OLD_KEYS]){
    try{
      const parsed = JSON.parse(localStorage.getItem(key) || 'null');
      if(Array.isArray(parsed)){ raw = parsed; break; }
    }catch(error){}
  }
  const normalized = (raw || [])
    .filter(project => project && project.title && !DEMO_TITLES.includes(project.title))
    .map(normalizeProject);
  localStorage.setItem(DATA_KEY, JSON.stringify(normalized));
  return normalized;
}

function saveData(){
  localStorage.setItem(DATA_KEY, JSON.stringify(data));
}

function currentProject(){
  return data.find(project => project.id === currentProjectId) || null;
}

function currentSeason(){
  const project = currentProject();
  return project?.seasons.find(season => season.id === currentSeasonId) || project?.seasons[0] || null;
}

function episodeCount(project){
  return project.seasons.reduce((total, season) => total + season.episodes.length, 0);
}

function projectMatches(project, query){
  if(!query) return true;
  const searchable = [
    project.title, project.category, project.desc,
    ...project.seasons.flatMap(season => [
      season.title,
      ...season.episodes.flatMap(episode => [episode.title, episode.summary])
    ])
  ].join(' ').toLowerCase();
  return searchable.includes(query);
}

function modifiedText(timestamp){
  const delay = now() - timestamp;
  if(delay < 60000) return 'À l’instant';
  if(delay < 3600000) return `Il y a ${Math.max(1,Math.round(delay/60000))} min`;
  if(delay < 86400000) return `Il y a ${Math.max(1,Math.round(delay/3600000))} h`;
  if(delay < 172800000) return 'Hier';
  return `Il y a ${Math.round(delay/86400000)} j`;
}

function projectImage(project, className='thumb'){
  return `<div class="${className}">${project.cover ? `<img src="${project.cover}" alt="">` : '🧱'}</div>`;
}

function getDb(){
  return new Promise((resolve,reject) => {
    const request = indexedDB.open('mes-creations-videos', 1);
    request.onupgradeneeded = () => {
      if(!request.result.objectStoreNames.contains('videos')){
        request.result.createObjectStore('videos');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putVideo(id, file){
  const db = await getDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('videos','readwrite');
    tx.objectStore('videos').put(file,id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getVideo(id){
  if(!id) return null;
  const db = await getDb();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('videos','readonly');
    const request = tx.objectStore('videos').get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteVideo(id){
  if(!id) return;
  const db = await getDb();
  return new Promise(resolve => {
    const tx = db.transaction('videos','readwrite');
    tx.objectStore('videos').delete(id);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}
