async function playEpisode(episodeId){
  const found = findEpisode(episodeId);
  if(!found) return;
  if(!found.episode.videoId){
    toast('Aucune vidéo n’est attachée à cet épisode.');
    return;
  }
  let blob;
  try{
    blob = await getVideo(found.episode.videoId);
  }catch(error){
    toast('Impossible de lire la vidéo.');
    return;
  }
  if(!blob){
    toast('La vidéo est absente de ce téléphone.');
    return;
  }
  closePlayer(false);
  playerBlob = blob;
  playerName = `${safeFileName(found.project.title)}-${safeFileName(found.season.title)}-episode-${found.episode.n}.mp4`;
  playerUrl = URL.createObjectURL(blob);
  $('#videoPlayer').src = playerUrl;
  $('#playerTitle').textContent = found.episode.title;
  $('#playerSeason').textContent = `${found.project.title} · ${found.season.title} · Épisode ${found.episode.n}`;
  $('#playerSummary').textContent = found.episode.summary || '';
  found.project.lastPlayed = now();
  found.project.updated = now();
  saveData();
  go('player');
  $('#videoPlayer').play().catch(() => {});
}

function closePlayer(returnToDetail=true){
  const video = $('#videoPlayer');
  video.pause();
  video.removeAttribute('src');
  video.load();
  if(playerUrl) URL.revokeObjectURL(playerUrl);
  playerUrl = null;
  playerBlob = null;
  if(returnToDetail) go('detail');
}

async function shareCurrentVideo(){
  if(!playerBlob) return;
  const file = new File([playerBlob],playerName,{type:playerBlob.type || 'video/mp4'});
  try{
    if(navigator.canShare?.({files:[file]}) && navigator.share){
      await navigator.share({files:[file],title:$('#playerTitle').textContent});
    }else if(navigator.share){
      await navigator.share({title:$('#playerTitle').textContent,text:$('#playerSeason').textContent});
      toast('Le téléphone ne permet pas le partage direct du fichier ici.');
    }else{
      downloadCurrentVideo();
    }
  }catch(error){
    if(error?.name !== 'AbortError') toast('Partage impossible sur cet appareil.');
  }
}

function downloadCurrentVideo(){
  if(!playerBlob) return;
  const url = URL.createObjectURL(playerBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = playerName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

async function deleteEpisodeById(episodeId){
  const found = findEpisode(episodeId);
  if(!found) return;
  if(!confirm(`Supprimer l’épisode « ${found.episode.title} » ?`)) return;
  found.season.episodes = found.season.episodes.filter(item => item.id !== episodeId);
  await deleteVideo(found.episode.videoId);
  found.project.updated = now();
  saveData();
  renderDetail();
  toast('Épisode supprimé.');
}

async function deleteCurrentProject(){
  const project = currentProject();
  if(!project) return;
  if(!confirm(`Supprimer définitivement « ${project.title} » et toutes ses vidéos ?`)) return;
  for(const season of project.seasons){
    for(const episode of season.episodes){
      await deleteVideo(episode.videoId);
    }
  }
  data = data.filter(item => item.id !== project.id);
  currentProjectId = data[0]?.id || null;
  currentSeasonId = data[0]?.seasons?.[0]?.id || null;
  saveData();
  toast('Projet supprimé.');
  go('home');
}

function renderLibrary(){
  const creations = data.length;
  const seasons = data.reduce((total,project) => total + project.seasons.length,0);
  const episodes = data.reduce((total,project) => total + episodeCount(project),0);
  $('#stats').innerHTML = `
    <div class="stat">🧊<b>${creations}</b><span class="small">projets</span></div>
    <div class="stat">📚<b>${seasons}</b><span class="small">saisons</span></div>
    <div class="stat">▶️<b>${episodes}</b><span class="small">épisodes</span></div>
  `;
  const query = ($('#librarySearch').value || '').trim().toLowerCase();
  const sort = $('#librarySort').value;
  let projects = data.filter(project => projectMatches(project,query));
  if(sort === 'alpha') projects.sort((a,b) => a.title.localeCompare(b.title,'fr'));
  if(sort === 'episodes') projects.sort((a,b) => episodeCount(b)-episodeCount(a));
  if(sort === 'recent') projects.sort((a,b) => b.updated-a.updated);
  $('#libraryList').innerHTML = projects.length ? projects.map(project => `
    <article class="panel" data-open-project="${project.id}">
      <div class="row" style="align-items:flex-start">
        ${projectImage(project,'thumb mini')}
        <div style="flex:1;min-width:0">
          <div class="title" style="font-size:19px">${esc(project.title)}</div>
          <div class="small">${esc(project.category || 'Sans catégorie')} · ${episodeCount(project)} épisode${episodeCount(project)>1?'s':''}</div>
        </div>
        <span class="small">${modifiedText(project.updated)}</span>
      </div>
      <div class="season-tabs">
        ${project.seasons.map(season => `<span class="season-tab"><b>${esc(season.title)}</b><br><span class="small">${season.episodes.length} épisode${season.episodes.length>1?'s':''}</span></span>`).join('')}
      </div>
    </article>
  `).join('') : '<div class="empty">Aucun résultat.</div>';
  renderStorageEstimate();
}

async function renderStorageEstimate(){
  if(!navigator.storage?.estimate){
    $('#storageText').textContent = 'Information indisponible';
    return;
  }
  try{
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percent = quota ? Math.min(100,usage/quota*100) : 0;
    $('#storageBar').style.width = `${percent}%`;
    $('#storageText').textContent = `${formatBytes(usage)} / ${formatBytes(quota)}`;
  }catch(error){
    $('#storageText').textContent = 'Information indisponible';
  }
}

function formatBytes(bytes){
  if(!bytes) return '0 Mo';
  const units = ['o','Ko','Mo','Go'];
  const index = Math.min(units.length-1,Math.floor(Math.log(bytes)/Math.log(1024)));
  return `${(bytes/Math.pow(1024,index)).toFixed(index>1?1:0)} ${units[index]}`;
}

function exportData(){
  const exportable = data.map(project => ({
    ...project,
    seasons:project.seasons.map(season => ({
      ...season,
      episodes:season.episodes.map(episode => ({
        ...episode,
        videoId:null,
        videoWasPresent:Boolean(episode.videoId)
      }))
    }))
  }));
  const blob = new Blob([JSON.stringify({
    app:'Mes Créations',
    version:6,
    exportedAt:new Date().toISOString(),
    videosIncluded:false,
    projects:exportable
  },null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `mes-creations-sauvegarde-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url),1000);
  toast('Sauvegarde exportée sans les vidéos.');
}

async function importDataFile(file){
  try{
    const parsed = JSON.parse(await file.text());
    const projects = Array.isArray(parsed) ? parsed : parsed.projects;
    if(!Array.isArray(projects)) throw new Error('Format invalide');
    if(!confirm('Remplacer les projets actuels par ceux de la sauvegarde ? Les vidéos actuelles ne seront pas supprimées automatiquement.')) return;
    data = projects.map(normalizeProject);
    currentProjectId = data[0]?.id || null;
    currentSeasonId = data[0]?.seasons?.[0]?.id || null;
    saveData();
    toast('Sauvegarde importée.');
    go('library');
  }catch(error){
    toast('Le fichier de sauvegarde est invalide.');
  }finally{
    $('#importInput').value = '';
  }
}
