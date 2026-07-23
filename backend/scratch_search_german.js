const User = require('./src/models/User');

async function run() {
  try {
    const users = await User.findAll({
      where: {},
      attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia', 'vicerrectoria', 'jefe_inmediato', 'estado'],
      raw: true
    });
    
    const matching = users.filter(u => 
      (u.nombre && u.nombre.toLowerCase().includes('pilar')) || 
      (u.nombre && u.nombre.toLowerCase().includes('agreda'))
    );
    
    console.log('Matching Users:', JSON.stringify(matching, null, 2));
    
  } catch (err) {
    console.error('Error running script:', err);
  } finally {
    process.exit(0);
  }
}

run();
