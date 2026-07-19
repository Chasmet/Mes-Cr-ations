function go(screen){
  if(screen !== 'player') closePlayer(false);
  ['home','detail','projectForm','seasonManager','episodeForm','player','library'].forEach(id => {
    $('#'+id).classList.toggle('hide', id !== screen);
  });
  $$('.nav').forEach(nav => {
    nav.classList.toggle('active', nav.dataset.go === screen || (screen === 'detail' && nav.dataset.go === 'home'));
  });
  if(screen === 'home') renderHome();
  if(screen === 'detail') renderDetail();
  if(screen === 'library') renderLibrary();
  window.scrollTo({top:0,behavior:'smooth'});
}

function renderHome(){
  const query = ($('#homeSearch').value || '').trim().toLowerCase();
  const matches = data.filter(project => projectMatches(project,query));
  $('#projectCards').innerHTML = matches.map(project => `
    <article class="project-card" data-open-project="${project.id}">
      ${projectImage(project)}
      <div class="card-body">
        <div class="title">${esc(project.title)}</div>
        <div class="small">${project.seasons.length} saison${project.seasons.length>1?'s':''} · ${episodeCount(project)} épisode${episodeCount(project)>1?'s':''}</div>
      </div>
    </article>
  `).join('');
  $('#homeEmpty').classList.toggle('hide', data.length > 0);
  $('#recentTitle').classList.toggle('hide', data.length === 0);
  const recent = [...matches].sort((a,b) => b.updated - a.updated).slice(0,5);
  $('#recentList').innerHTML = recent.length ? recent.map(project => `
    <div class="list-item" data-open-project="${project.id}">
      ${projectImage(project,'thumb mini')}
      <div style="flex:1;min-width:0">
        <div class="title">${esc(project.title)}</div>
        <div class="small">${project.seasons.length} saison${project.seasons.length>1?'s':''} · ${episodeCount(project)} épisode${episodeCount(project)>1?'s':''}</div>
      </div>
      <div class="small">${modifiedText(project.updated)}</div>
    </div>
  `).join('') : '<div class="empty">Aucun résultat.</div>';
}

function renderDetail(){
  const project = currentProject();
  if(!project){ go('home'); return; }
  if(!project.seasons.some(season => season.id === currentSeasonId)){
    currentSeasonId = project.seasons[0]?.id || null;
  }
  const season = currentSeason();
  $('#detailTitle').textContent = project.title;
  $('#detailMeta').textContent = `${project.category || 'Sans catégorie'} · ${project.seasons.length} saison${project.seasons.length>1?'s':''} · ${episodeCount(project)} épisode${episodeCount(project)>1?'s':''}`;
  $('#detailCover').innerHTML = project.cover ? `<img src="${project.cover}" alt="">` : '🧱';
  $('#seasonTabs').innerHTML = project.seasons.map(item => `
    <button class="season-tab ${item.id === season?.id ? 'active' : ''}" data-select-season="${item.id}">
      ${esc(item.title)}<br><span class="small">${item.episodes.length} épisode${item.episodes.length>1?'s':''}</span>
    </button>
  `).join('');
  $('#selectedSeasonTitle').textContent = season?.title || 'Aucune saison';
  $('#selectedSeasonMeta').textContent = season ? `${season.episodes.length} épisode${season.episodes.length>1?'s':''}` : '';
  $('#episodeList').innerHTML = !season || !season.episodes.length
    ? `<div class="empty"><h3>Aucun épisode</h3><p class="muted">Ajoute le premier épisode de cette saison.</p><button class="btn primary" data-new-episode>Ajouter un épisode</button></div>`
    : season.episodes.map(episode => `
      <article class="episode">
        <button class="episode-num" data-play-episode="${episode.id}" aria-label="Lire l’épisode ${episode.n}">${episode.videoId ? '▶' : episode.n}</button>
        <div data-play-episode="${episode.id}">
          <div class="title">${episode.n}. ${esc(episode.title)}</div>
          <div class="small">${esc(episode.summary || (episode.videoId ? 'Vidéo prête' : 'Vidéo manquante'))}</div>
        </div>
        <div class="episode-actions">
          <button class="action-dot" data-edit-episode="${episode.id}" title="Modifier">✏️</button>
          <button class="action-dot" data-delete-episode="${episode.id}" title="Supprimer">🗑️</button>
        </div>
      </article>
    `).join('');
}

function resetProjectForm(project=null){
  editingProjectId = project?.id || null;
  pendingCover = project?.cover || null;
  pendingFirstVideo = null;
  projectDraftSeasons = (project?.seasons || [{id:uid(),n:1,title:'Saison 1',episodes:[]}]).map((season,index) => ({
    id: season.id || uid(),
    n:index+1,
    title:season.title || `Saison ${index+1}`,
    episodes:Array.isArray(season.episodes) ? season.episodes : []
  }));
  $('#projectFormKicker').textContent = project ? 'Modification' : 'Nouveau projet';
  $('#projectFormTitle').textContent = project ? 'Modifier la création' : 'Nouvelle création';
  $('#projectName').value = project?.title || '';
  $('#projectCategory').value = project?.category || '';
  $('#projectDescription').value = project?.desc || '';
  $('#projectDescCount').textContent = `${$('#projectDescription').value.length} / 500`;
  $('#firstEpisodeBlock').classList.toggle('hide', Boolean(project));
  $('#saveProject').textContent = project ? 'Enregistrer les modifications' : 'Enregistrer le projet';
  renderCoverPreview();
  renderDraftSeasons();
  $('#firstEpisodeTitle').value = '';
  $('#firstEpisodeSummary').value = '';
  $('#firstVideoInput').value = '';
  $('#firstVideoPreview').className = 'upload-preview text';
  $('#firstVideoPreview').innerHTML = '🎥<br>Ajouter la vidéo du premier épisode<br><small>Facultatif</small>';
}

function renderCoverPreview(){
  const preview = $('#coverPreview');
  if(pendingCover){
    preview.className = 'upload-preview';
    preview.innerHTML = `<img src="${pendingCover}" alt="Aperçu de la miniature">`;
  }else{
    preview.className = 'upload-preview text';
    preview.innerHTML = '🖼️<br>Ajouter une miniature<br><small>Elle sera compressée automatiquement</small>';
  }
}

function renderDraftSeasons(){
  $('#draftSeasons').innerHTML = projectDraftSeasons.map((season,index) => `
    <div class="season-editor">
      <div class="season-index">${index+1}</div>
      <input class="field" value="${esc(season.title)}" data-draft-season-title="${index}" maxlength="80" aria-label="Titre de la saison ${index+1}">
      <button class="btn icon danger" data-remove-draft-season="${index}" type="button" ${projectDraftSeasons.length===1 || season.episodes.length ? 'disabled' : ''} title="${season.episodes.length ? 'Cette saison contient des épisodes' : 'Supprimer'}">×</button>
    </div>
  `).join('');
  $('#firstEpisodeSeason').innerHTML = projectDraftSeasons.map((season,index) => `<option value="${season.id}">${esc(season.title || `Saison ${index+1}`)}</option>`).join('');
}

async function compressImage(file){
  const objectUrl = URL.createObjectURL(file);
  try{
    const image = await new Promise((resolve,reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = objectUrl;
    });
    const maxWidth = 1100;
    const ratio = Math.min(1,maxWidth/image.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1,Math.round(image.width*ratio));
    canvas.height = Math.max(1,Math.round(image.height*ratio));
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.78);
  }finally{
    URL.revokeObjectURL(objectUrl);
  }
}
