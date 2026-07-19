async function saveProjectFromForm(){
  const title = $('#projectName').value.trim();
  if(!title){ toast('Ajoute un nom au projet.'); $('#projectName').focus(); return; }
  projectDraftSeasons.forEach((season,index) => {
    season.n = index+1;
    season.title = season.title.trim() || `Saison ${index+1}`;
  });
  if(editingProjectId){
    const project = data.find(item => item.id === editingProjectId);
    if(!project) return;
    project.title = title;
    project.category = $('#projectCategory').value.trim();
    project.desc = $('#projectDescription').value.trim();
    project.cover = pendingCover;
    project.seasons = projectDraftSeasons.map((season,index) => ({
      id:season.id,n:index+1,title:season.title,episodes:season.episodes
    }));
    project.updated = now();
    currentProjectId = project.id;
    currentSeasonId = project.seasons[0]?.id || null;
    saveData();
    toast('Projet mis à jour.');
    go('detail');
    return;
  }

  const project = {
    id:uid(),
    title,
    category:$('#projectCategory').value.trim(),
    desc:$('#projectDescription').value.trim(),
    cover:pendingCover,
    seasons:projectDraftSeasons.map((season,index) => ({
      id:season.id,n:index+1,title:season.title,episodes:[]
    })),
    updated:now(),
    lastPlayed:0
  };
  const firstTitle = $('#firstEpisodeTitle').value.trim();
  const firstSummary = $('#firstEpisodeSummary').value.trim();
  if(pendingFirstVideo || firstTitle || firstSummary){
    const selectedSeason = project.seasons.find(season => season.id === $('#firstEpisodeSeason').value) || project.seasons[0];
    const episode = {
      id:uid(),n:1,title:firstTitle || 'Premier épisode',summary:firstSummary,
      videoId:null,createdAt:now()
    };
    if(pendingFirstVideo){
      episode.videoId = uid();
      try{
        await putVideo(episode.videoId,pendingFirstVideo);
      }catch(error){
        toast('La vidéo n’a pas pu être enregistrée.');
        return;
      }
    }
    selectedSeason.episodes.push(episode);
  }
  data.unshift(project);
  currentProjectId = project.id;
  currentSeasonId = project.seasons[0]?.id || null;
  saveData();
  toast('Projet créé.');
  go('detail');
}

function openSeasonManager(){
  const project = currentProject();
  if(!project) return;
  managedDraftSeasons = project.seasons.map((season,index) => ({
    id:season.id,n:index+1,title:season.title,episodes:season.episodes
  }));
  renderManagedSeasons();
  go('seasonManager');
}

function renderManagedSeasons(){
  $('#managedSeasons').innerHTML = managedDraftSeasons.map((season,index) => `
    <div class="form-card">
      <div class="row">
        <span class="badge">Saison ${index+1}</span>
        <button class="btn small-btn danger" data-remove-managed-season="${index}" ${managedDraftSeasons.length===1 || season.episodes.length ? 'disabled' : ''}>
          ${season.episodes.length ? `${season.episodes.length} épisode${season.episodes.length>1?'s':''}` : 'Supprimer'}
        </button>
      </div>
      <label class="label" style="margin-top:10px">Titre de la saison</label>
      <input class="field" value="${esc(season.title)}" data-managed-season-title="${index}" maxlength="80">
    </div>
  `).join('');
}

function saveManagedSeasons(){
  const project = currentProject();
  if(!project) return;
  managedDraftSeasons.forEach((season,index) => {
    season.n = index+1;
    season.title = season.title.trim() || `Saison ${index+1}`;
  });
  project.seasons = managedDraftSeasons.map((season,index) => ({
    id:season.id,n:index+1,title:season.title,episodes:season.episodes
  }));
  if(!project.seasons.some(season => season.id === currentSeasonId)){
    currentSeasonId = project.seasons[0]?.id || null;
  }
  project.updated = now();
  saveData();
  toast('Saisons enregistrées.');
  go('detail');
}

function resetEpisodeForm(episode=null){
  const project = currentProject();
  if(!project) return;
  editingEpisodeId = episode?.id || null;
  pendingEpisodeVideo = null;
  $('#episodeFormKicker').textContent = episode ? 'Modification' : 'Nouvel épisode';
  $('#episodeFormTitle').textContent = episode ? 'Modifier l’épisode' : 'Ajouter un épisode';
  $('#saveEpisode').textContent = episode ? 'Enregistrer les modifications' : 'Ajouter l’épisode';
  $('#episodeSeason').innerHTML = project.seasons.map(season => `<option value="${season.id}">${esc(season.title)}</option>`).join('');
  const originSeason = episode ? project.seasons.find(season => season.episodes.some(item => item.id === episode.id)) : currentSeason();
  $('#episodeSeason').value = originSeason?.id || project.seasons[0]?.id;
  const nextNumber = originSeason ? Math.max(0,...originSeason.episodes.map(item => item.n)) + 1 : 1;
  $('#episodeNumber').value = episode?.n || nextNumber;
  $('#episodeTitle').value = episode?.title || '';
  $('#episodeSummary').value = episode?.summary || '';
  $('#episodeVideoInput').value = '';
  $('#episodeVideoPreview').className = 'upload-preview text';
  $('#episodeVideoPreview').innerHTML = episode?.videoId
    ? '✅ Vidéo actuelle conservée<br><small>Choisis un fichier seulement pour la remplacer</small>'
    : '🎥<br>Choisir la vidéo<br><small>Obligatoire pour un nouvel épisode</small>';
}

function findEpisode(episodeId){
  const project = currentProject();
  if(!project) return null;
  for(const season of project.seasons){
    const episode = season.episodes.find(item => item.id === episodeId);
    if(episode) return {project,season,episode};
  }
  return null;
}

async function saveEpisodeFromForm(){
  const project = currentProject();
  if(!project) return;
  const season = project.seasons.find(item => item.id === $('#episodeSeason').value);
  if(!season){ toast('Choisis une saison.'); return; }
  const number = Math.max(1,Number($('#episodeNumber').value) || 1);
  const title = $('#episodeTitle').value.trim() || `Épisode ${number}`;
  const summary = $('#episodeSummary').value.trim();

  if(editingEpisodeId){
    const found = findEpisode(editingEpisodeId);
    if(!found) return;
    const oldSeason = found.season;
    const episode = found.episode;
    if(oldSeason.id !== season.id){
      oldSeason.episodes = oldSeason.episodes.filter(item => item.id !== episode.id);
      season.episodes.push(episode);
    }
    episode.n = number;
    episode.title = title;
    episode.summary = summary;
    if(pendingEpisodeVideo){
      const oldVideoId = episode.videoId;
      const newVideoId = uid();
      try{
        await putVideo(newVideoId,pendingEpisodeVideo);
        episode.videoId = newVideoId;
        await deleteVideo(oldVideoId);
      }catch(error){
        toast('La nouvelle vidéo n’a pas pu être enregistrée.');
        return;
      }
    }
    season.episodes.sort((a,b) => a.n - b.n);
    project.updated = now();
    currentSeasonId = season.id;
    saveData();
    toast('Épisode modifié.');
    go('detail');
    return;
  }

  if(!pendingEpisodeVideo){
    toast('Choisis une vidéo pour le nouvel épisode.');
    return;
  }
  const videoId = uid();
  try{
    await putVideo(videoId,pendingEpisodeVideo);
  }catch(error){
    toast('La vidéo n’a pas pu être enregistrée. Vérifie l’espace disponible.');
    return;
  }
  season.episodes.push({
    id:uid(),n:number,title,summary,videoId,createdAt:now()
  });
  season.episodes.sort((a,b) => a.n - b.n);
  project.updated = now();
  currentSeasonId = season.id;
  saveData();
  toast('Épisode ajouté.');
  go('detail');
}
