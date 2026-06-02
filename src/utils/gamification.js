export const PET_LEVELS = [
  { level: 1, minXp: 0, image: '/pets/pet_level_1.png', name: 'Mystic Egg' },
  { level: 2, minXp: 100, image: '/pets/pet_level_2.png', name: 'Baby Dragon' },
  { level: 3, minXp: 500, image: '/pets/pet_level_3.png', name: 'Mystic Kitsune' },
  { level: 4, minXp: 2000, image: '/pets/pet_level_4.png', name: 'Starborn Pegasus' },
  { level: 5, minXp: 5000, image: '/pets/pet_level_5.png', name: 'Cosmic Phoenix' }
];

export function getPetStatus(xp = 0) {
  let currentLevel = PET_LEVELS[0];
  let nextLevel = PET_LEVELS[1];

  for (let i = 0; i < PET_LEVELS.length; i++) {
    if (xp >= PET_LEVELS[i].minXp) {
      currentLevel = PET_LEVELS[i];
      nextLevel = PET_LEVELS[i + 1] || null;
    } else {
      break;
    }
  }

  const xpIntoCurrentLevel = xp - currentLevel.minXp;
  const xpNeededForNext = nextLevel ? nextLevel.minXp - currentLevel.minXp : 0;
  const progressPercent = nextLevel ? Math.min(100, Math.max(0, (xpIntoCurrentLevel / xpNeededForNext) * 100)) : 100;

  return {
    ...currentLevel,
    nextLevel,
    xpIntoCurrentLevel,
    xpNeededForNext,
    progressPercent,
    isMaxLevel: !nextLevel
  };
}
