/**
 * Check, and optionally build, the indexes declared in the Mongoose schemas.
 *
 * Production runs with autoIndex off, so indexes must be built once by hand.
 *
 *   node scripts/sync-indexes.js           # dry run: report only, changes nothing
 *   node scripts/sync-indexes.js --apply   # build missing indexes
 *
 * Uses MONGODB_URI from the environment, falling back to server/.env. To target
 * another database, set MONGODB_URI in the shell for this one command.
 *
 * --apply uses createIndexes(), not syncIndexes(): it only builds missing
 * indexes and never drops one. Indexes the schemas don't declare are listed
 * so you can decide about them yourself.
 *
 * The unique users.email index can't be built while duplicate emails exist,
 * so the script checks for them first and stops if it finds any.
 */
import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import User from '../src/models/User.js';
import Trip from '../src/models/Trip.js';

const APPLY = process.argv.includes('--apply');
const MODELS = [User, Trip];

// Same workaround as src/config/db.js: Windows router DNS fails SRV lookups.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const targetHost = (uri) => {
  try {
    return new URL(uri).host; // host only, never credentials
  } catch {
    return '(unparseable URI)';
  }
};

const main = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  console.log(`Target: ${targetHost(uri)}`);
  console.log(APPLY ? 'Mode: APPLY (missing indexes will be built)\n' : 'Mode: dry run\n');

  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
  console.log(`Database: ${mongoose.connection.name}\n`);

  const duplicates = await User.aggregate([
    { $group: { _id: '$email', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  if (duplicates.length) {
    console.error(`Found ${duplicates.length} duplicated email(s); fix these before building:`);
    for (const d of duplicates) console.error(`  ${d._id} (${d.n} users)`);
    process.exitCode = 1;
    return;
  }
  console.log('No duplicate emails.\n');

  let missingTotal = 0;
  for (const Model of MODELS) {
    const { toCreate, toDrop } = await Model.diffIndexes();
    missingTotal += toCreate.length;
    console.log(`${Model.collection.collectionName}:`);
    console.log(`  missing: ${toCreate.length ? toCreate.map((s) => JSON.stringify(s)).join(', ') : 'none'}`);
    if (toDrop.length) {
      console.log(`  not in schema (left alone): ${toDrop.join(', ')}`);
    }
  }

  if (!missingTotal) {
    console.log('\nAll declared indexes exist.');
  } else if (!APPLY) {
    console.log('\nDry run: nothing changed. Re-run with --apply to build the missing indexes.');
  } else {
    for (const Model of MODELS) await Model.createIndexes();
    console.log('\nMissing indexes built.');
  }
};

main()
  .catch((err) => {
    console.error(`Failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
