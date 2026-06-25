const { RecursoHumanoAdministrativo, User } = require('../models');

async function main() {
  const usersCount = await User.count();
  const rhCount = await RecursoHumanoAdministrativo.count();
  console.log(`Users count: ${usersCount}`);
  console.log(`RecursoHumanoAdministrativo count: ${rhCount}`);
}

main().catch(console.error);
