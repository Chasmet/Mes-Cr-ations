document.addEventListener('click', async event => {
  const goButton = event.target.closest('[data-go]');
  if(goButton){ go(goButton.dataset.go); return; }

  if(event.target.closest('[data-new-project]')){
    resetProjectForm();
    go('projectForm');
    return;
  }

  const openProject = event.target.closest('[data-open-project]');
  if(openProject){
    currentProjectId = openProject.dataset.openProject;
    currentSeasonId = currentProject()?.seasons?.[0]?.id || null;
    go('detail');
    return;
  }

  const selectSeason = event.target.closest('[data-select-season]');
  if(selectSeason){
    currentSeasonId = selectSeason.dataset.selectSeason;
    renderDetail();
    return;
  }

  if(event.target.closest('[data-edit-project]')){
    resetProjectForm(currentProject());
    go('projectForm');
    return;
  }

  if(event.target.closest('[data-project-cancel]')){
    go(editingProjectId ? 'detail' : 'home');
    return;
  }

  if(event.target.closest('[data-new-episode]')){
    resetEpisodeForm();
    go('episodeForm');
    return;
  }

  const editEpisode = event.target.closest('[data-edit-episode]');
  if(editEpisode){
    const found = findEpisode(editEpisode.dataset.editEpisode);
    if(found){
      resetEpisodeForm(found.episode);
      go('episodeForm');
    }
    return;
  }

  if(event.target.closest('[data-episode-cancel]')){
    go('detail');
    return;
  }

  const play = event.target.closest('[data-play-episode]');
  if(play){ await playEpisode(play.dataset.playEpisode); return; }

  const deleteEpisode = event.target.closest('[data-delete-episode]');
  if(deleteEpisode){ await deleteEpisodeById(deleteEpisode.dataset.deleteEpisode); return; }

  if(event.target.closest('[data-delete-project]')){ await deleteCurrentProject(); return; }
  if(event.target.closest('[data-manage-seasons]')){ openSeasonManager(); return; }

  const removeDraft = event.target.closest('[data-remove-draft-season]');
  if(removeDraft && !removeDraft.disabled){
    projectDraftSeasons.splice(Number(removeDraft.dataset.removeDraftSeason),1);
    renderDraftSeasons();
    return;
  }

  const removeManaged = event.target.closest('[data-remove-managed-season]');
  if(removeManaged && !removeManaged.disabled){
    managedDraftSeasons.splice(Number(removeManaged.dataset.removeManagedSeason),1);
    renderManagedSeasons();
    return;
  }

  if(event.target.closest('[data-close-player]')){ closePlayer(true); }
});

document.addEventListener('input', event => {
  if(event.target.matches('[data-draft-season-title]')){
    const index = Number(event.target.dataset.draftSeasonTitle);
    projectDraftSeasons[index].title = event.target.value;
    renderFirstEpisodeSeasonOptions();
  }
  if(event.target.matches('[data-managed-season-title]')){
    managedDraftSeasons[Number(event.target.dataset.managedSeasonTitle)].title = event.target.value;
  }
});

function renderFirstEpisodeSeasonOptions(){
  const selected = $('#firstEpisodeSeason').value;
  $('#firstEpisodeSeason').innerHTML = projectDraftSeasons.map((season,index) => `<option value="${season.id}">${esc(season.title.trim() || `Saison ${index+1}`)}</option>`).join('');
  if(projectDraftSeasons.some(season => season.id === selected)) $('#firstEpisodeSeason').value = selected;
}

$('#addDraftSeason').addEventListener('click', () => {
  projectDraftSeasons.push({id:uid(),n:projectDraftSeasons.length+1,title:`Saison ${projectDraftSeasons.length+1}`,episodes:[]});
  renderDraftSeasons();
  requestAnimationFrame(() => {
    const inputs = $$('[data-draft-season-title]');
    inputs[inputs.length-1]?.focus();
  });
});

$('#addManagedSeason').addEventListener('click', () => {
  managedDraftSeasons.push({id:uid(),n:managedDraftSeasons.length+1,title:`Saison ${managedDraftSeasons.length+1}`,episodes:[]});
  renderManagedSeasons();
  requestAnimationFrame(() => {
    const inputs = $$('[data-managed-season-title]');
    inputs[inputs.length-1]?.focus();
  });
});

$('#saveManagedSeasons').addEventListener('click',saveManagedSeasons);
$('#saveProject').addEventListener('click',saveProjectFromForm);
$('#saveEpisode').addEventListener('click',saveEpisodeFromForm);

$('#coverButton').addEventListener('click',() => $('#coverInput').click());
$('#coverInput').addEventListener('change', async () => {
  const file = $('#coverInput').files?.[0];
  if(!file) return;
  try{
    pendingCover = await compressImage(file);
    renderCoverPreview();
    toast('Miniature ajoutée.');
  }catch(error){
    toast('Cette image ne peut pas être utilisée.');
  }
});

$('#firstVideoButton').addEventListener('click',() => $('#firstVideoInput').click());
$('#firstVideoInput').addEventListener('change',() => {
  pendingFirstVideo = $('#firstVideoInput').files?.[0] || null;
  if(pendingFirstVideo){
    $('#firstVideoPreview').className = 'upload-preview text';
    $('#firstVideoPreview').innerHTML = `✅ ${esc(pendingFirstVideo.name)}<br><small>${formatBytes(pendingFirstVideo.size)}</small>`;
  }
});

$('#episodeVideoButton').addEventListener('click',() => $('#episodeVideoInput').click());
$('#episodeVideoInput').addEventListener('change',() => {
  pendingEpisodeVideo = $('#episodeVideoInput').files?.[0] || null;
  if(pendingEpisodeVideo){
    $('#episodeVideoPreview').className = 'upload-preview text';
    $('#episodeVideoPreview').innerHTML = `✅ ${esc(pendingEpisodeVideo.name)}<br><small>${formatBytes(pendingEpisodeVideo.size)}</small>`;
  }
});

$('#projectDescription').addEventListener('input',() => {
  $('#projectDescCount').textContent = `${$('#projectDescription').value.length} / 500`;
});

$('#episodeSeason').addEventListener('change',() => {
  if(editingEpisodeId) return;
  const project = currentProject();
  const season = project?.seasons.find(item => item.id === $('#episodeSeason').value);
  $('#episodeNumber').value = season ? Math.max(0,...season.episodes.map(item => item.n))+1 : 1;
});

$('#homeSearch').addEventListener('input',renderHome);
$('#librarySearch').addEventListener('input',renderLibrary);
$('#librarySort').addEventListener('change',renderLibrary);
$('#shareVideo').addEventListener('click',shareCurrentVideo);
$('#downloadVideo').addEventListener('click',downloadCurrentVideo);
$('#exportData').addEventListener('click',exportData);
$('#importData').addEventListener('click',() => $('#importInput').click());
$('#importInput').addEventListener('change',() => {
  const file = $('#importInput').files?.[0];
  if(file) importDataFile(file);
});

window.addEventListener('beforeinstallprompt',event => {
  event.preventDefault();
  installPrompt = event;
  $('#installBtn').classList.remove('hide');
});

$('#installBtn').addEventListener('click',async () => {
  if(!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#installBtn').classList.add('hide');
});

window.addEventListener('appinstalled',() => $('#installBtn').classList.add('hide'));

if('serviceWorker' in navigator){
  window.addEventListener('load',() => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

const initialParams = new URLSearchParams(location.search);
if(initialParams.get('action') === 'new'){
  resetProjectForm();
  go('projectForm');
}else if(initialParams.get('screen') === 'library'){
  go('library');
}else{
  renderHome();
}
