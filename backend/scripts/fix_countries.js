const { Sequelize, Op } = require('sequelize');
const { sequelize } = require('../src/config/database');
const InternacionalizacionMovilidad = require('../src/models/InternacionalizacionMovilidad');

async function fixCountries() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');

    const updates = [
      {
        target: 'Colombia',
        sources: ['Nariño', 'No', '170col', 'Universidad Del Valle', 'Colombia Peru', 'Infortec Soluciones S A S', 'Universidad Catolica', 'Nario'] // Added Nario just in case of encoding issues
      },
      {
        target: 'México',
        sources: ['484 Mex', 'Mexico Ecuador Brasil']
      },
      {
        target: 'El Salvador',
        sources: ['Salvador']
      },
      {
        target: 'Argentina',
        sources: ['32 Argentina']
      },
      {
        target: 'Venezuela',
        sources: ['862 Ven']
      },
      {
        target: 'Estados Unidos',
        sources: ['840 Estados Unidos', 'E E U U']
      },
      {
        target: 'Ecuador',
        sources: ['Escuador', 'Ecuador Peru Mexico']
      },
      {
        target: 'Chile',
        sources: ['Chile 152']
      }
    ];

    let totalUpdated = 0;

    for (const update of updates) {
      console.log(`Updating to ${update.target}...`);
      const [affectedRows] = await InternacionalizacionMovilidad.update(
        { pais_extranjero: update.target },
        {
          where: {
            pais_extranjero: {
              [Op.in]: update.sources
            }
          }
        }
      );
      console.log(`  Updated ${affectedRows} rows.`);
      totalUpdated += affectedRows;
    }

    console.log(`Finished fixing countries. Total rows updated: ${totalUpdated}`);

  } catch (error) {
    console.error('Unable to connect to the database:', error);
  } finally {
    await sequelize.close();
  }
}

fixCountries();
