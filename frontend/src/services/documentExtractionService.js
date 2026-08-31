import api from './api';

const DOCUMENT_EXTRACTION_URL = '/planeacion/gestion-informacion/saber-pro/consulta/extraccion';

export const extractDocumentInformation = async ({ files, instructions = '' }) => {
  const formData = new FormData();
  files.forEach((file) => formData.append('archivos', file));
  formData.append('instrucciones', instructions);
  const response = await api.post(DOCUMENT_EXTRACTION_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 600000
  });
  return response.data;
};
