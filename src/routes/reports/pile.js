export const W = 500; // px
export const H = W * Math.SQRT2;
export const GAP = 8; // px
export const STRIPS = 12; // a sheet is cut into strips so it can curve
export const TILT_X = 44; // deg
export const TILT_Z = -25; // deg
export const STEP = 0.6; // screens of scroll per report
export const FLIGHT = 1.5; // steps per flight

const FILL = 0.95; // share of the screen
const EXIT = 0.9; // the curl leaves the screen sooner

const radians = (deg) => (deg * Math.PI) / 180;
const tiltX = radians(TILT_X);
const tiltZ = radians(TILT_Z);

const turn = ([x, y], angle) => [
  x * Math.cos(angle) - y * Math.sin(angle),
  x * Math.sin(angle) + y * Math.cos(angle),
];
const flatten = ([x, y], scale) => [x * scale, y * Math.cos(tiltX) * scale];

const flat = [
  [-W / 2, -H / 2],
  [W / 2, -H / 2],
  [W / 2, H / 2],
  [-W / 2, H / 2],
].map((corner) => flatten(turn(corner, tiltZ), 1));
const box = {
  w: Math.max(...flat.map(([x]) => x)) * 2,
  h: Math.max(...flat.map(([, y]) => y)) * 2,
};

export const fit = (width, height) =>
  FILL * Math.min(width / box.w, height / box.h);

export const boxHeight = (scale) => box.h * scale;

export const dropOf = (scale) => GAP * Math.sin(tiltX) * scale;

export const outline = (scale) =>
  flat.map(([x, y]) => `${x * scale},${y * scale}`).join(" ");

const random = (n) => Math.abs((Math.sin(n * 12.9898) * 43758.5453) % 1);

function clearDistance(corners, direction, width, height) {
  const edges = corners.map(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % 4];
    return [ny - y, x - nx];
  });
  const normals = [[1, 0], [0, 1], ...edges].flatMap(([x, y]) => {
    const length = Math.hypot(x, y);
    return [
      [x / length, y / length],
      [-x / length, -y / length],
    ];
  });
  const distances = normals.map(([x, y]) => {
    const towards = direction[0] * x + direction[1] * y;
    if (towards <= 0.001) return Infinity;
    const screen = (width / 2) * Math.abs(x) + (height / 2) * Math.abs(y);
    return (
      (screen + Math.max(...corners.map(([a, b]) => -a * x - b * y))) / towards
    );
  });
  return Math.min(...distances);
}

export function flightOf(i, scale, width, height) {
  const angle = radians(random(i + 1) * 170 - 85);
  const spin = random(i + 1.5) * 240 - 120;
  const hinge = turn([0, -H / 2], tiltZ);
  const corners = [
    [-W / 2, 0],
    [W / 2, 0],
    [W / 2, H],
    [-W / 2, H],
  ].map((corner) => {
    const [x, y] = turn(corner, radians(spin) + tiltZ);
    return flatten([x + hinge[0], y + hinge[1]], scale);
  });
  const direction = [Math.sin(angle), -Math.cos(angle)];
  const distance = EXIT * clearDistance(corners, direction, width, height);
  return { x: direction[0] * distance, y: direction[1] * distance, spin };
}
