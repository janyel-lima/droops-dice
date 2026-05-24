import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, doc, setDoc } from 'firebase/firestore';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp({
  ...firebaseConfig,
  projectId: 'demo-no-project'
});

const db = getFirestore(app);
connectFirestoreEmulator(db, 'localhost', 8080);

const auth = getAuth(app);
connectAuthEmulator(auth, 'http://localhost:9099');

const BASE_RACES = [
  { id: 'dwarf_hill', parentId: 'dwarf', name: 'Anão da Colina', bonuses: { CON: 2, WIS: 1 }, source: 'PHB' },
  { id: 'dwarf_mountain', parentId: 'dwarf', name: 'Anão da Montanha', bonuses: { CON: 2, STR: 2 }, source: 'PHB' },
  { id: 'elf_high', parentId: 'elf', name: 'Alto Elfo', bonuses: { DEX: 2, INT: 1 }, source: 'PHB' },
  { id: 'elf_wood', parentId: 'elf', name: 'Elfo da Floresta', bonuses: { DEX: 2, WIS: 1 }, source: 'PHB' },
  { id: 'elf_drow', parentId: 'elf', name: 'Drow (Elfo Negro)', bonuses: { DEX: 2, CHA: 1 }, source: 'PHB' },
  { id: 'elf_eladrin', parentId: 'elf', name: 'Eladrin', bonuses: { DEX: 2, CHA: 1 }, source: 'MTF/TCoE' },
  { id: 'elf_shadarkai', parentId: 'elf', name: 'Shadar-kai', bonuses: { DEX: 2, CON: 1 }, source: 'MTF/TCoE' },
  { id: 'halfling_lightfoot', parentId: 'halfling', name: 'Pequenino Pés-Leves', bonuses: { DEX: 2, CHA: 1 }, source: 'PHB' },
  { id: 'halfling_stout', parentId: 'halfling', name: 'Pequenino Robusto', bonuses: { DEX: 2, CON: 1 }, source: 'PHB' },
  { id: 'gnome_forest', parentId: 'gnome', name: 'Gnomo da Floresta', bonuses: { INT: 2, DEX: 1 }, source: 'PHB' },
  { id: 'gnome_rock', parentId: 'gnome', name: 'Gnomo das Rochas', bonuses: { INT: 2, CON: 1 }, source: 'PHB' },
  { id: 'gnome_deep', parentId: 'gnome', name: 'Svirfneblin (Gnomo Profundo)', bonuses: { INT: 2, DEX: 1 }, source: 'XGtE/TCoE' },
  { id: 'human', name: 'Humano', bonuses: { STR: 1, DEX: 1, CON: 1, INT: 1, WIS: 1, CHA: 1 }, source: 'PHB' },
  { id: 'human_variant', name: 'Humano Variante', bonuses: {}, choiceCount: 2, choiceBonus: 1, source: 'PHB' },
  { id: 'dragonborn', name: 'Draconato', bonuses: { STR: 2, CHA: 1 }, source: 'PHB' },
  { id: 'half_elf', name: 'Meio-Elfo', bonuses: { CHA: 2 }, choiceCount: 2, choiceBonus: 1, choiceExclude: ['CHA'], source: 'PHB' },
  { id: 'half_orc', name: 'Meio-Orc', bonuses: { STR: 2, CON: 1 }, source: 'PHB' },
  { id: 'tiefling_phb', parentId: 'tiefling', name: 'Tiefling (Legado)', bonuses: { CHA: 2, INT: 1 }, source: 'PHB' },
  { id: 'tiefling_bloodline', parentId: 'tiefling', name: 'Tiefling (Linhagem)', bonuses: { CHA: 2 }, choiceCount: 1, choiceBonus: 1, choiceExclude: ['CHA'], source: 'MTF' },
  { id: 'tiefling_zariel', parentId: 'tiefling', name: 'Tiefling (Zariel)', bonuses: { CHA: 2, STR: 1 }, source: 'MTF' },
  { id: 'tiefling_dispater', parentId: 'tiefling', name: 'Tiefling (Dispater)', bonuses: { CHA: 2, DEX: 1 }, source: 'MTF' },
  { id: 'aarakocra', name: 'Aarakocra', bonuses: { DEX: 2, WIS: 1 }, source: 'EEPC' },
  { id: 'genasi_air', parentId: 'genasi', name: 'Genasi do Ar', bonuses: { CON: 2, DEX: 1 }, source: 'EEPC' },
  { id: 'genasi_earth', parentId: 'genasi', name: 'Genasi da Terra', bonuses: { CON: 2, STR: 1 }, source: 'EEPC' },
  { id: 'genasi_fire', parentId: 'genasi', name: 'Genasi do Fogo', bonuses: { CON: 2, INT: 1 }, source: 'EEPC' },
  { id: 'genasi_water', parentId: 'genasi', name: 'Genasi da Água', bonuses: { CON: 2, WIS: 1 }, source: 'EEPC' },
  { id: 'aasimar_protector', parentId: 'aasimar', name: 'Aasimar Protetor', bonuses: { CHA: 2, WIS: 1 }, source: 'VGtM' },
  { id: 'aasimar_scourge', parentId: 'aasimar', name: 'Aasimar Flagelo', bonuses: { CHA: 2, CON: 1 }, source: 'VGtM' },
  { id: 'aasimar_fallen', parentId: 'aasimar', name: 'Aasimar Caído', bonuses: { CHA: 2, STR: 1 }, source: 'VGtM' },
  { id: 'gith_yanki', parentId: 'gith', name: 'Githyanki', bonuses: { STR: 2, INT: 1 }, source: 'MTF' },
  { id: 'gith_zerai', parentId: 'gith', name: 'Githzerai', bonuses: { WIS: 2, INT: 1 }, source: 'MTF' },
];

async function seed() {
  console.log('🌱 Starting database seed in Firebase emulator...');

  // Authenticate as kibedasppk@gmail.com to pass the firestore rules check
  console.log('🔑 Authenticating as master admin in emulator...');
  try {
    await createUserWithEmailAndPassword(auth, 'kibedasppk@gmail.com', 'password123');
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      await signInWithEmailAndPassword(auth, 'kibedasppk@gmail.com', 'password123');
    } else {
      throw err;
    }
  }
  console.log('✅ Authenticated successfully.');

  // Seed Races
  console.log('Seeding races...');
  for (const race of BASE_RACES) {
    await setDoc(doc(db, 'races', race.id), {
      ...race,
      isActive: true,
      updatedAt: Date.now()
    });
  }
  console.log('✅ Races seeded.');

  // Seed Demo Master as Admin
  console.log('Seeding Master Admin account...');
  const masterId = auth.currentUser?.uid || 'demo-master-uid';
  await setDoc(doc(db, 'admins', masterId), {
    role: 'master',
    email: 'kibedasppk@gmail.com',
    assignedAt: Date.now()
  });
  console.log('✅ Master Admin seeded with UID:', masterId);

  // Seed Invite Codes
  console.log('Seeding character invite codes...');
  const codes = [
    { code: 'DND-1000-DEMO', raceId: 'human', name: 'Pendente', status: 'criado' },
    { code: 'DND-2000-DEMO', raceId: 'elf_high', name: 'Pendente', status: 'criado' },
    { code: 'DND-3000-DEMO', raceId: 'halfling_lightfoot', name: 'Pendente', status: 'criado' },
    { code: 'DND-4000-DEMO', raceId: 'dwarf_mountain', name: 'Pendente', status: 'criado' },
    { code: 'DND-5000-DEMO', raceId: 'half_elf', name: 'Kaelen Swiftwind', status: 'aguardando_validacao', userId: 'demo-player-uid', playerDisplayName: 'Demo Player', playerEmail: 'player@example.com' }
  ];

  for (const item of codes) {
    const data: any = {
      id: item.code,
      code: item.code,
      name: item.name,
      raceId: item.raceId,
      status: item.status,
      userId: item.userId || null,
      masterId: masterId,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (item.status === 'aguardando_validacao') {
      data.rolls = {
        raw: [16, 15, 14, 12, 10, 8],
        rerollUsed: false,
        timestamp: Date.now(),
        details: [
          { dice: [6, 5, 5, 2], dropped: 2, total: 16 },
          { dice: [6, 5, 4, 1], dropped: 1, total: 15 },
          { dice: [5, 5, 4, 3], dropped: 3, total: 14 },
          { dice: [4, 4, 4, 2], dropped: 2, total: 12 },
          { dice: [4, 3, 3, 1], dropped: 1, total: 10 },
          { dice: [3, 3, 2, 1], dropped: 1, total: 8 }
        ]
      };
      data.playerDisplayName = item.playerDisplayName;
      data.playerEmail = item.playerEmail;
      data.playerPhoto = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=100';
    }

    await setDoc(doc(db, 'characters', item.code), data);
  }
  console.log('✅ Character codes seeded.');
  console.log('🎉 Seeding successfully completed! You can now test the app with the demo codes.');
}

seed().catch(err => {
  console.error('❌ Error seeding database:', err);
  process.exit(1);
});
