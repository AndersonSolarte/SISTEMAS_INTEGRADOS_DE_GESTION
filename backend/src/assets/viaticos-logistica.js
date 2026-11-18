/* Edición de transporte sin eventos incrustados, compatible con CSP. */
(function () {
  function init() {
    document.querySelectorAll('[data-viaticos-transport]').forEach(function (container) {
      if (container.dataset.transportReady === 'true') return;
      container.dataset.transportReady = 'true';
      function update() {
        var checked = [];
        container.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
          if (checkbox.checked) checked.push(checkbox.value);
          var label = checkbox.closest('label');
          label.style.background = checkbox.checked ? '#eff6ff' : '#f8fafc';
          label.style.color = checkbox.checked ? '#1d4ed8' : '#64748b';
          label.style.borderColor = checkbox.checked ? '#3b82f6' : '#cbd5e1';
        });
        var hidden = container.querySelector('input[name="transporte"]');
        if (hidden) hidden.value = checked.join(', ');
      }
      container.addEventListener('change', update);
      update();
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
