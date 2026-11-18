/* Calculadora del Técnico Contable, compatible con CSP del mismo origen. */
(function() {
  function formatMoney(num) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num || 0);
  }
  function parseVal(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    var cleanStr = String(val || '').replace(/[^0-9.-]/g, '');
    var n = parseFloat(cleanStr);
    return isNaN(n) ? 0 : n;
  }
  function recalculate() {
    var body = document.getElementById('liquidacion-detalles');
    if (!body) return;
    var rows = body.querySelectorAll('tr[data-liquidation-row]');
    var grandTotal = 0;
    rows.forEach(function(row) {
      var vInput = row.querySelector('.valor-diario');
      var dInput = row.querySelector('.dias');
      var tCell = row.querySelector('.row-total');
      var v = vInput ? parseVal(vInput.value) : 0;
      var d = dInput ? Math.max(0, Math.floor(parseVal(dInput.value))) : 0;
      var rowTotal = v * d;
      grandTotal += rowTotal;
      if (tCell) {
        tCell.textContent = formatMoney(rowTotal);
      }
    });
    var totalEl = document.getElementById('total-anticipo');
    if (totalEl) {
      totalEl.textContent = formatMoney(grandTotal);
    }
  }
  window.calcLiquidation = recalculate;

  function validateRows() {
    var body = document.getElementById('liquidacion-detalles');
    var firstInvalid = null;
    var usedRows = 0;
    function validateField(input, message) {
      if (!input) return;
      input.setCustomValidity(message);
      var invalid = !input.validity.valid;
      input.setAttribute('aria-invalid', String(invalid));
      var container = input.closest('td') || input.parentNode;
      var error = container.querySelector('[data-field-error="' + input.name + '"]');
      if (!error) {
        error = document.createElement('div');
        error.id = 'error-' + input.name;
        error.setAttribute('data-field-error', input.name);
        error.style.cssText = 'color:#b91c1c;font-size:13px;margin-top:5px';
        container.appendChild(error);
        input.setAttribute('aria-describedby', error.id);
      }
      error.textContent = invalid ? input.validationMessage : '';
      input.style.borderColor = invalid ? '#dc2626' : '';
      var currency = input.closest('.currency-input');
      if (currency) currency.style.borderColor = invalid ? '#dc2626' : '';
      if (invalid && !firstInvalid) firstInvalid = input;
    }
    body.querySelectorAll('tr[data-liquidation-row]').forEach(function(row) {
      var value = row.querySelector('.valor-diario');
      var days = row.querySelector('.dias');
      var name = row.querySelector('.detalle-extra');
      var used = parseVal(value.value) !== 0 || parseVal(days.value) !== 0 || Boolean(name);
      if (used) usedRows += 1;
      validateField(name, name && !name.value.trim() ? 'Escriba el nombre del concepto.' : '');
      validateField(value, used && !(Number(value.value) > 0) ? 'Ingrese un valor diario en pesos mayor que 0.' : '');
      validateField(days, used && !(Number.isInteger(Number(days.value)) && Number(days.value) > 0) ? 'Ingrese una cantidad de días entera mayor que 0.' : '');
    });
    if (!usedRows && !firstInvalid) {
      var firstValue = body.querySelector('.valor-diario');
      validateField(firstValue, 'Ingrese al menos un concepto con valor y días mayores que 0.');
      if (!firstValue) firstInvalid = document.getElementById('agregar-concepto');
    }
    return firstInvalid;
  }

  function init() {
    var body = document.getElementById('liquidacion-detalles');
    var addBtn = document.getElementById('agregar-concepto');
    var countInput = document.getElementById('extra-count');
    var form = document.getElementById('liquidacion-form');
    if (!body || !form || form.dataset.calculatorReady === 'true') return;
    form.dataset.calculatorReady = 'true';
    var attempted = false;
    var summary = document.createElement('div');
    summary.setAttribute('role', 'alert');
    summary.style.cssText = 'color:#b91c1c;margin:12px 0;font-weight:700';
    form.querySelector('.liquidation-panel').prepend(summary);
    form.noValidate = true;
    form.addEventListener('submit', function(event) {
      if (event.submitter && event.submitter.value === 'rechazar') return;
      attempted = true;
      var invalid = validateRows() || form.querySelector(':invalid');
      summary.textContent = invalid ? 'No se envió la liquidación. Corrija los campos señalados: cada concepto utilizado requiere nombre, valor y días mayores que 0.' : '';
      if (invalid) {
        event.preventDefault();
        invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        invalid.focus({ preventScroll: true });
        invalid.reportValidity();
      }
    });

    if (body) {
      body.addEventListener('input', function() {
        recalculate();
        if (attempted && !validateRows()) summary.textContent = '';
      });
      body.addEventListener('change', recalculate);
      body.addEventListener('keyup', recalculate);
      body.addEventListener('paste', function() { setTimeout(recalculate, 50); });
      body.addEventListener('click', function(e) {
        var btn = e.target.closest('.remove-row');
        if (btn) {
          var tr = btn.closest('tr');
          if (tr) {
            tr.remove();
            recalculate();
            if (attempted && !validateRows()) summary.textContent = '';
          }
        }
      });
    }

    if (addBtn && countInput && body) {
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var i = parseInt(countInput.value, 10) || 0;
        if (i >= 30) return;
        var tr = document.createElement('tr');
        tr.setAttribute('data-liquidation-row', '');
        tr.innerHTML = '<td><input class="detalle-extra" name="extraDetalle' + i + '" maxlength="120" placeholder="Nombre del concepto" required></td>' +
          '<td><div class="currency-input"><span aria-hidden="true">$</span><input class="valor-diario" inputmode="numeric" type="number" min="0" step="1" name="extraValorDiario' + i + '" value="0" aria-label="Valor diario en pesos" required></div></td>' +
          '<td><input class="dias" inputmode="numeric" type="number" min="0" step="1" name="extraDias' + i + '" value="0" required></td>' +
          '<td class="row-total">$0</td>' +
          '<td><button class="remove-row" type="button" aria-label="Eliminar concepto">Eliminar</button></td>';
        body.appendChild(tr);
        countInput.value = String(i + 1);
        var inputFirst = tr.querySelector('.detalle-extra');
        if (inputFirst) inputFirst.focus();
        recalculate();
      });
    }

    recalculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', recalculate);
  setTimeout(recalculate, 200);
})();
