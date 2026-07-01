const { Sequelize, Op } = require('sequelize');
const { sequelize } = require('../src/config/database');
const InternacionalizacionMovilidad = require('../src/models/InternacionalizacionMovilidad');

async function fixCountries() {
  try {
    await sequelize.authenticate();
    
    const updates = [
      {
        target: 'Colombia',
        sources: ['COLOMBIA- PERU', 'Infortec Soluciones S.A.S.', 'Universidad del Valle', 'Universidad Católica']
      },
      {
        target: 'México',
        sources: ['MEXICO - ECUADOR - BRASIL']
      },
      {
        target: 'Ecuador',
        sources: ['ECUADOR - PERU- MEXICO']
      },
      {
        target: 'Panamá',
        sources: ['PAMAMA']
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
    console.error('Error:', error);
  } finally {
    await sequelize.close();
  }
}

fixCountries();
