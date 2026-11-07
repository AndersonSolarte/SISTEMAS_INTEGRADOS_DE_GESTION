// Retry only temporary transport/server failures; validation and permissions must surface.
export async function loadImprovementCatalogs(request) {
  try {
    return await request();
  } catch (error) {
    const status = error.response?.status;
    const temporary = (!status && ['ERR_NETWORK', 'ECONNABORTED', 'ETIMEDOUT'].includes(error.code))
      || [502, 503, 504].includes(status);
    if (!temporary) throw error;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return request();
  }
}

export function catalogFailureMessage(error) {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === 'ERR_NETWORK') return 'No hay conexión con el servidor de catálogos. Se reintentará automáticamente.';
  if (['ECONNABORTED', 'ETIMEDOUT'].includes(error.code)) return 'El servidor de catálogos tardó demasiado en responder. Se reintentará automáticamente.';
  return `No fue posible cargar las listas automáticas de la plantilla${error.response?.status ? ` (HTTP ${error.response.status})` : ''}.`;
}
