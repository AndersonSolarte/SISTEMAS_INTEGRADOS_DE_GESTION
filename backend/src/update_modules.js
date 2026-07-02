const path = require('path');
const dotenv = require('dotenv');

// Load env
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const UserActivityLog = require(path.join(__dirname, 'models', 'UserActivityLog'));

const detectModule = (url = '') => {
  const u = url.toLowerCase();
  if (u.includes('/saber-pro/consulta/masiva'))    return 'Validación Masiva';
  if (u.includes('/saber-pro/consulta/individual')) return 'Consulta Individual';
  if (u.includes('/saber-pro/consulta'))            return 'Consulta y Validación';
  if (u.includes('/saber-pro'))                     return 'Saber Pro Analytics';
  if (u.includes('/matriculados'))                  return 'Matriculados';
  if (u.includes('/gestion-informacion'))           return 'Gestión de Información';
  if (u.includes('/documentos') || u.includes('/favoritos')) return 'Documentos';
  if (u.includes('/users'))                         return 'Administración Usuarios';
  if (u.includes('/import'))                        return 'Importación de Datos';
  if (u.includes('/catalogo') || u.includes('/macroprocesos')) return 'Catálogo de Procesos';
  if (u.includes('/activity'))                      return 'Monitor de Actividad';
  if (u.includes('/security') || u.includes('/logs')) return 'Seguridad y Auditoría';
  if (u.includes('/instrumentos') || u.includes('/public/instrumentos')) return 'Autoevaluación';
  if (u.includes('/evidencia') || u.includes('/plan-accion') || u.includes('/reporte-salida')) return 'Planeación Estratégica';
  if (u.includes('/auth/profile'))                  return 'Sistema';
  return 'General';
};

async function updateModules() {
  try {
    const logs = await UserActivityLog.findAll({
      attributes: ['id', 'endpoint', 'module'],
      where: { module: 'General' }
    });
    
    console.log(`Found ${logs.length} 'General' logs to analyze...`);
    let updated = 0;
    
    for (const log of logs) {
      const newModule = detectModule(log.endpoint);
      if (newModule !== 'General') {
        await log.update({ module: newModule });
        updated++;
      }
    }
    console.log(`Updated ${updated} logs with new modules.`);
    process.exit(0);
  } catch (error) {
    console.error('Error updating modules:', error);
    process.exit(1);
  }
}

updateModules();
