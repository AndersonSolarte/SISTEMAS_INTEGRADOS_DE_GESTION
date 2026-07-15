require('dotenv').config();
const { sequelize } = require('../src/config/database');
const User = require('../src/models/User');

const normalizeForMatch = (val) =>
  String(val || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const tokenizeName = (value) =>
  normalizeForMatch(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const findBestUserMatch = (users, target) => {
  if (!target) return null;
  const targetNorm = normalizeForMatch(target);
  if (!targetNorm) return null;

  // 1. Exact match by name
  let match = users.find((u) => normalizeForMatch(u.nombre) === targetNorm);
  if (match) return match;

  // 2. Exact match by cargo
  match = users.find((u) => normalizeForMatch(u.cargo) === targetNorm);
  if (match) return match;

  // 3. Token-based ranking match
  const targetTokens = tokenizeName(targetNorm);
  if (!targetTokens.length) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const user of users) {
    const nameTokens = tokenizeName(user.nombre);
    if (nameTokens.length) {
      const commonNameTokens = nameTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonNameTokens >= minRequired && commonNameTokens > bestScore) {
        bestScore = commonNameTokens;
        bestMatch = user;
      }
    }

    const cargoTokens = tokenizeName(user.cargo);
    if (cargoTokens.length) {
      const commonCargoTokens = cargoTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonCargoTokens >= minRequired && commonCargoTokens > bestScore) {
        bestScore = commonCargoTokens;
        bestMatch = user;
      }
    }
  }

  return bestMatch;
};

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    const users = await User.findAll({
      where: { estado: 'activo' },
      attributes: ['id', 'nombre', 'email', 'username', 'dependencia', 'cargo', 'jefe_inmediato'],
      raw: true
    });

    console.log(`Total active users in local database: ${users.length}`);

    const unmatched = {};
    const matchedCount = { count: 0 };

    users.forEach(user => {
      const jefe = user.jefe_inmediato;
      if (!jefe || !jefe.trim()) return;

      const match = findBestUserMatch(users, jefe);
      if (!match) {
        if (!unmatched[jefe]) {
          unmatched[jefe] = [];
        }
        unmatched[jefe].push({
          nombre: user.nombre,
          email: user.email,
          cargo: user.cargo,
          dependencia: user.dependencia
        });
      } else {
        matchedCount.count++;
      }
    });

    console.log('\n--- DIAGNOSIS OF UNMATCHED IMMEDIATE BOSSES ---');
    const unmatchedKeys = Object.keys(unmatched);
    console.log(`Total unique unmatched boss names: ${unmatchedKeys.length}`);
    console.log(`Total users with matched bosses: ${matchedCount.count}`);

    if (unmatchedKeys.length > 0) {
      unmatchedKeys.forEach(bossName => {
        console.log(`\n🔴 UNMATCHED BOSS: "${bossName}"`);
        console.log(`   Referenced by ${unmatched[bossName].length} user(s):`);
        unmatched[bossName].forEach(u => {
          console.log(`     - ${u.nombre} (${u.email}) - Cargo: ${u.cargo} - Dep: ${u.dependencia}`);
        });
      });
    } else {
      console.log('\n🟢 PERFECT MATCH! All immediate bosses exist as active users.');
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
