export const growthParams = {
  fungal: {
    branchingChance: 0.29,
    directionRandomness: 2.0,
    branchAngle: Math.PI / 1.4,
    downwardBias: 0.01,
  },
  chaos: {
    branchingChance: 2.0,
    directionRandomness: 7.0,
    branchAngle: Math.PI / 1.4,
    downwardBias: 0.01,
  },
  covid: {
    branchingChance: 10.0,
    directionRandomness: 200.0,
    branchAngle: Math.PI / 1.4,
    downwardBias: 0.01,
  },
  tendrils: {
    branchingChance: 0.18,
    directionRandomness: 1.2,
    branchAngle: Math.PI / 2.0,
    downwardBias: 0.005,
  },
  river: {
    branchingChance: 0.06,
    directionRandomness: 0.6,
    branchAngle: Math.PI / 2.6,
    downwardBias: 0.0,
  },
  spiral: {
    branchingChance: 0.22,
    directionRandomness: 1.6,
    branchAngle: Math.PI / 1.2,
    downwardBias: 0.008,
  },
};

export const growthModes = Object.keys(growthParams);
