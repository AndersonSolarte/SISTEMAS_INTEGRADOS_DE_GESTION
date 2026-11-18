(function () {
  function init() {
    var open = document.querySelector('[data-open-attachments]');
    var dialog = document.querySelector('.attachment-dialog');
    if (!open || !dialog || open.dataset.viewerReady) return;
    open.dataset.viewerReady = 'true';
    var list = dialog.querySelector('.attachment-list');
    var status = dialog.querySelector('.attachment-status');
    var content = dialog.querySelector('.attachment-content');
    var controller, objectUrl, sequence = 0;
    function clearPreview() {
      content.replaceChildren();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
    async function loadDocument(file) {
      var current = ++sequence;
      clearPreview();
      status.textContent = 'Cargando documento: ' + file.name;
      list.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.fileId === file.id)); });
      try {
        var response = await fetch(file.url, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) throw new Error('El adjunto ya no está disponible o el enlace de la etapa dejó de estar activo.');
        var blob = await response.blob();
        if (current !== sequence || !dialog.open) return;
        if (blob.type !== 'application/pdf' && !/^image\/(png|jpeg|webp)$/.test(blob.type)) throw new Error('El tipo de archivo no admite previsualización.');
        objectUrl = URL.createObjectURL(blob);
        var preview = document.createElement(blob.type === 'application/pdf' ? 'iframe' : 'img');
        preview.src = objectUrl;
        if (preview.tagName === 'IFRAME') preview.title = file.name;
        else preview.alt = file.name;
        content.appendChild(preview);
        status.textContent = file.name;
      } catch (error) {
        if (error.name !== 'AbortError' && current === sequence && dialog.open) status.textContent = error.message;
      }
    }
    open.addEventListener('click', async function () {
      if (dialog.open) return;
      var opening = ++sequence;
      controller = new AbortController();
      dialog.showModal(); list.replaceChildren(); clearPreview();
      status.textContent = 'Consultando documentos adjuntos…';
      try {
        var response = await fetch(open.dataset.attachmentsUrl, { signal: controller.signal, credentials: 'omit', redirect: 'error' });
        if (!response.ok) throw new Error('No es posible consultar los adjuntos. El enlace puede haber vencido o la solicitud ya avanzó.');
        var result = await response.json();
        if (!dialog.open || opening !== sequence) return;
        if (!result.files.length) { status.textContent = 'Esta solicitud no tiene documentos adjuntos disponibles.'; return; }
        result.files.forEach(function (file) {
          var button = document.createElement('button');
          button.type = 'button'; button.textContent = file.name; button.dataset.fileId = file.id;
          button.addEventListener('click', function () { loadDocument(file); }); list.appendChild(button);
        });
        await loadDocument(result.files[0]);
      } catch (error) {
        if (error.name !== 'AbortError' && dialog.open) status.textContent = error.message;
      }
    });
    dialog.querySelector('[data-close-attachments]').addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('close', function () { sequence++; controller?.abort(); clearPreview(); open.focus(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
