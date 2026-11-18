/* Calculadora de Tesorería, sin scripts ni eventos incrustados. */
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
          var totalEl = document.getElementById('total-anticipo-val');
          if (totalEl) {
            totalEl.textContent = formatMoney(grandTotal);
          }
        }
        window.calcLiquidation = recalculate;

        function init() {
          var body = document.getElementById('liquidacion-detalles');
          var addBtn = document.getElementById('agregar-concepto');
          var countInput = document.getElementById('extra-count');
          if (!body || body.dataset.calculatorReady === 'true') return;
          body.dataset.calculatorReady = 'true';

          if (body) {
            body.addEventListener('input', recalculate);
            body.addEventListener('change', recalculate);
            body.addEventListener('keyup', recalculate);
            body.addEventListener('click', function(e) {
              var btn = e.target.closest('.remove-row');
              if (btn) {
                var tr = btn.closest('tr');
                if (tr) {
                  var baseInc = tr.querySelector('input[name^="baseIncluded"]');
                  if (baseInc) {
                    baseInc.value = '0';
                    var v = tr.querySelector('.valor-diario');
                    var d = tr.querySelector('.dias');
                    if (v) v.value = '0';
                    if (d) d.value = '0';
                    tr.style.opacity = '0.4';
                  } else {
                    tr.remove();
                  }
                  recalculate();
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
              tr.style.borderBottom = '1px solid #e2e8f0';
              tr.innerHTML = '<td style="padding: 6px 12px; vertical-align: middle;"><input class="detalle-extra" form="action-form" name="extraDetalle' + i + '" maxlength="120" placeholder="Nombre del concepto" style="width: 100%; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px; font-weight: 700; color: #1e293b;" required></td>' +
                '<td style="padding: 6px 12px; vertical-align: middle;"><div class="currency-input" style="margin: 0; display: flex; align-items: center; border: 1.5px solid #cbd5e1; border-radius: 6px; background: #fff;"><span style="padding-left: 8px; font-weight: 700; color: #64748b;">$</span><input class="valor-diario" form="action-form" inputmode="numeric" type="number" min="0" step="1" name="extraValorDiario' + i + '" value="0" style="width: 100%; border: 0; outline: none; padding: 6px; font-weight: 700; color: #0b3a6f;" required></div></td>' +
                '<td style="padding: 6px 12px; vertical-align: middle;"><input class="dias" form="action-form" inputmode="numeric" type="number" min="0" step="1" name="extraDias' + i + '" value="0" style="width: 70px; text-align: center; border: 1.5px solid #cbd5e1; border-radius: 6px; padding: 6px; font-weight: 700; color: #1e293b;" required></td>' +
                '<td class="row-total" style="padding: 8px 12px; text-align: right; font-weight: 800; color: #0b3a6f; font-size: 12.5px; vertical-align: middle;">$0</td>' +
                '<td style="padding: 6px 12px; text-align: center; vertical-align: middle;"><button class="remove-row" type="button" style="min-width: auto; background: #ef4444; color: #fff; border: none; padding: 6px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;">Eliminar</button></td>';
              body.appendChild(tr);
              countInput.value = String(i + 1);
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
