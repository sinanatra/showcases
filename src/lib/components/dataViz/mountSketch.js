/** Runs a p5 sketch inside an element and removes it with the element, stopping its draw loop. */
export function mountSketch(node, sketch) {
  let instance;
  let destroyed = false;
  import("p5").then(({ default: p5 }) => {
    if (!destroyed) instance = new p5(sketch, node);
  });
  return {
    destroy() {
      destroyed = true;
      instance?.remove();
    },
  };
}
