'use strict';

// Aplica el tema antes del paint para evitar flash de tema incorrecto
(function () {
  try {
    document.documentElement.dataset.theme = localStorage.getItem('r07_theme') || 'light';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
