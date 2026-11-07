const driveMoveParameters = (parents, destination) => {
  if (!Array.isArray(parents)) throw new Error('No fue posible verificar la carpeta actual de la evidencia.');
  if (parents.includes(destination)) return {};
  return { addParents: destination, ...(parents.length ? { removeParents: parents.join(',') } : {}) };
};
module.exports = { driveMoveParameters };
