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
  calm: {
    branchingChance: 0.06,
    directionRandomness: 0.35,
    branchAngle: Math.PI / 3.2,
    downwardBias: 0.0,
  },
};

export const growthModes = Object.keys(growthParams);

/**
 * Applies the growth direction algorithm shared by both sketch visualizations.
 *
 * @param {object} p - p5 instance
 * @param {object} dir - p5.Vector (already copied from br.dir0)
 * @param {object} br - branch/particle object
 * @param {object} tip - current tip position vector
 * @param {object} gp - growth params for the current mode
 * @param {string} growthMode - active growth mode name
 * @param {number} simFrame - current simulation frame
 * @param {number} scale - scene scale factor
 * @param {{ x: number, y: number }} vortexCenter - center point used by "vortex" mode
 * @returns {object} normalized direction vector
 */
export function applyGrowthDirection(
  p,
  dir,
  br,
  tip,
  gp,
  growthMode,
  simFrame,
  scale,
  vortexCenter
) {
  if (br.__rand == null) br.__rand = Math.random();
  const localChaos = (br.__rand - 0.5) * 2;
  dir.y += (gp.downwardBias || 0) + localChaos * 0.08;
  dir.normalize();
  const nv = p.noise(
    tip.x * 0.01 * scale,
    tip.y * 0.01 * scale,
    simFrame * 0.03
  );
  const rotAmt = p.map(nv, 0, 1, -gp.directionRandomness, gp.directionRandomness);
  dir.rotate(rotAmt * (0.5 + Math.abs(localChaos)));

  if (growthMode === "staccato") {
    if (Math.random() < 0.25) {
      dir.rotate((Math.random() - 0.5) * gp.directionRandomness * 3);
    }
    dir.add(
      p.createVector(
        (Math.random() - 0.5) * 0.6 * gp.directionRandomness,
        (Math.random() - 0.5) * 0.6 * gp.directionRandomness
      )
    );
  }
  if (growthMode === "psychedelic") {
    const phase = (br.phase || 0) + simFrame * (0.08 + br.__rand * 0.3);
    const swirl = p
      .createVector(Math.cos(phase), Math.sin(phase))
      .mult(0.9 + br.__rand);
    dir.add(swirl).normalize();
  }
  if (growthMode === "vortex") {
    const cx = vortexCenter?.x ?? 0;
    const cy = vortexCenter?.y ?? 0;
    const toCenter = p.createVector(tip.x - cx, tip.y - cy);
    if (toCenter.mag() > 0.001) {
      const tang = p.createVector(-toCenter.y, toCenter.x).normalize();
      dir.add(tang.mult(1.2 + br.__rand * 2));
      dir.add(toCenter.normalize().mult(-0.6 * (1 + br.__rand)));
    }
  }
  if (growthMode === "river") {
    const s = 0.0025;
    const t = simFrame * 0.015;
    const a = p.noise(tip.x * s, tip.y * s, t) * Math.PI * 2;
    const flow = p.createVector(Math.cos(a), Math.sin(a));
    dir.add(flow.mult(0.6 + Math.random() * 1.4)).normalize();
  }
  if (growthMode === "tendrils") {
    const osc = 0.25 * Math.sin((br.phase || 0) + simFrame * 0.08);
    dir.rotate(osc * (1 + Math.random() * 1.5));
  }
  if (growthMode === "plasma") {
    if (Math.random() < 0.08) {
      dir.add(
        p.createVector((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3)
      );
    }
  }
  if (growthMode === "calm") {
    const side = br.__rand < 0.5 ? -1 : 1;
    const target = p.createVector(side, 0.03).normalize();
    dir.mult(0.88).add(target.mult(0.12)).normalize();
  }
  return dir.normalize();
}
