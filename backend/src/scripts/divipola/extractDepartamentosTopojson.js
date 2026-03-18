const fs = require('fs');
const path = require('path');

const DEFAULT_OBJECT_KEY = 'MGN_ANM_DPTOS';

const usage = () => {
  console.log('Uso: node src/scripts/divipola/extractDepartamentosTopojson.js <input> <output> [objectKey]');
  console.log('Ejemplo: node src/scripts/divipola/extractDepartamentosTopojson.js "C:/data/Colombia_departamentos_municipios_poblacion-topov2.json" "C:/data/departamentos.json"');
  console.log(`objectKey por defecto: ${DEFAULT_OBJECT_KEY}`);
};

const run = () => {
  const inputArg = process.argv[2];
  const outputArg = process.argv[3];
  const objectKey = (process.argv[4] || DEFAULT_OBJECT_KEY).trim();

  if (!inputArg || !outputArg) {
    usage();
    process.exit(1);
  }

  const inputPath = path.resolve(inputArg);
  const outputPath = path.resolve(outputArg);

  if (!fs.existsSync(inputPath)) {
    throw new Error(`No existe el archivo de entrada: ${inputPath}`);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const data = JSON.parse(raw);

  if (!data || typeof data !== 'object') {
    throw new Error('El archivo de entrada no contiene un JSON valido.');
  }
  if (!data.objects || typeof data.objects !== 'object') {
    throw new Error('El TopoJSON no contiene la llave "objects".');
  }
  if (!data.objects[objectKey]) {
    const disponibles = Object.keys(data.objects);
    throw new Error(`No se encontro "${objectKey}" en objects. Disponibles: ${disponibles.join(', ')}`);
  }

  const output = {
    ...data,
    objects: {
      [objectKey]: data.objects[objectKey]
    }
  };

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(`[topojson] Entrada: ${inputPath}`);
  console.log(`[topojson] Salida: ${outputPath}`);
  console.log(`[topojson] Object conservado: ${objectKey}`);
  console.log(`[topojson] Object eliminados: ${Object.keys(data.objects).filter((k) => k !== objectKey).join(', ') || 'ninguno'}`);
};

try {
  run();
} catch (error) {
  console.error('[topojson] Error:', error.message);
  process.exit(1);
}

