import { luma, Buffer, type Device } from "@luma.gl/core";
import { Model } from "@luma.gl/engine";
import { webgl2Adapter } from "@luma.gl/webgl";
import { webgpuAdapter } from "@luma.gl/webgpu";
import type { SpatialEntry, InspectionResult } from "@sage/contracts/explorer";

const vs = `#version 300 es
in vec2 corner;
in vec4 positionSize;
in vec4 instanceColor;
layout(std140) uniform cameraUniforms {vec4 transform;};
out vec2 uv;
out vec4 color;
void main(){vec2 p=positionSize.xy+corner*positionSize.zw;gl_Position=vec4(p*transform.xy+transform.zw,0.,1.);uv=corner;color=instanceColor;}`;
const fs = (round: boolean) => `#version 300 es
precision highp float;
in vec2 uv;
in vec4 color;
out vec4 fragColor;
void main(){${round ? "if(dot(uv,uv)>0.25)discard;" : ""}fragColor=color;}`;
const wgsl = (round: boolean) => `
struct Camera {transform:vec4<f32>};
@group(0) @binding(0) var<uniform> cameraUniforms:Camera;
struct Out {@builtin(position) position:vec4<f32>,@location(0) uv:vec2<f32>,@location(1) color:vec4<f32>};
@vertex fn vertexMain(@location(0) corner:vec2<f32>,@location(1) positionSize:vec4<f32>,@location(2) instanceColor:vec4<f32>)->Out{
 var out:Out;let p=positionSize.xy+corner*positionSize.zw;
 out.position=vec4<f32>(p*cameraUniforms.transform.xy+cameraUniforms.transform.zw,0.,1.);out.uv=corner;out.color=instanceColor;return out;
}
@fragment fn fragmentMain(in:Out)->@location(0) vec4<f32>{${round ? "if(dot(in.uv,in.uv)>0.25){discard;}" : ""}return in.color;}`;
export const playerColors = [
  "#438bff",
  "#f65b65",
  "#64c768",
  "#f0d456",
  "#51d3d9",
  "#d679d8",
  "#c5c9cf",
  "#ef9b50",
  "#969f8a",
];
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
type Batch = { model: Model; buffer: Buffer; capacity: number; count: number };
/** Instanced quads: one draw per terrain, entity and highlight layer. */
export class MatchMapRenderer {
  private batches: Batch[] = [];
  private camera: Buffer;
  private geometry: Buffer;
  private zoom = 1;
  private center: [number, number];
  private entries: SpatialEntry[] = [];
  private grid = new Map<string, SpatialEntry[]>();
  private frame = 0;
  private destroyed = false;
  private resize: ResizeObserver;
  private lost = () =>
    this.onError("GPU context lost. Reopen the explorer to restore the map.");
  private constructor(
    private device: Device,
    private canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
    private onError: (message: string) => void,
  ) {
    this.center = [width / 2, height / 2];
    this.camera = device.createBuffer({
      byteLength: 16,
      usage: Buffer.UNIFORM | Buffer.COPY_DST,
    });
    this.geometry = device.createBuffer({
      data: new Float32Array([
        -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
      ]),
      usage: Buffer.VERTEX,
    });
    for (let i = 0; i < 3; i++) {
      const buffer = device.createBuffer({
        byteLength: 32,
        usage: Buffer.VERTEX | Buffer.COPY_DST,
      });
      const model = new Model(device, {
        id: `match-layer-${i}`,
        vs,
        fs: fs(i !== 0),
        source: wgsl(i !== 0),
        topology: "triangle-list",
        vertexCount: 6,
        instanceCount: 0,
        bufferLayout: [
          { name: "corner", format: "float32x2" },
          {
            name: "instances",
            stepMode: "instance",
            byteStride: 32,
            attributes: [
              { attribute: "positionSize", format: "float32x4", byteOffset: 0 },
              {
                attribute: "instanceColor",
                format: "float32x4",
                byteOffset: 16,
              },
            ],
          },
        ],
        shaderLayout: {
          attributes: [
            { name: "corner", location: 0, type: "vec2<f32>" },
            {
              name: "positionSize",
              location: 1,
              type: "vec4<f32>",
              stepMode: "instance",
            },
            {
              name: "instanceColor",
              location: 2,
              type: "vec4<f32>",
              stepMode: "instance",
            },
          ],
          bindings: [
            { name: "cameraUniforms", type: "uniform", group: 0, location: 0 },
          ],
        },
        attributes: { corner: this.geometry, instances: buffer },
        bindings: { cameraUniforms: this.camera },
        parameters: { depthWriteEnabled: false, depthCompare: "always" },
      });
      this.batches.push({ model, buffer, capacity: 32, count: 0 });
    }
    this.resize = new ResizeObserver(() => this.redraw());
    this.resize.observe(canvas);
    canvas.addEventListener("webglcontextlost", this.lost);
    void device.lost.then(() => {
      if (!this.destroyed) this.lost();
    });
    this.redraw();
  }
  static async create(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    onError: (m: string) => void,
  ) {
    let device: Device;
    try {
      device = await luma.createDevice({
        type: "webgpu",
        adapters: [webgpuAdapter],
        createCanvasContext: {
          canvas,
          autoResize: true,
          useDevicePixels: Math.min(devicePixelRatio, 2),
        },
      });
    } catch {
      device = await luma.createDevice({
        type: "webgl",
        adapters: [webgl2Adapter],
        createCanvasContext: {
          canvas,
          autoResize: true,
          useDevicePixels: Math.min(devicePixelRatio, 2),
        },
      });
    }
    try {
      return new MatchMapRenderer(device, canvas, width, height, onError);
    } catch (error) {
      device.destroy();
      throw error;
    }
  }
  get backend() {
    return this.device.type;
  }
  private update(layer: number, data: Float32Array) {
    const b = this.batches[layer];
    if (data.byteLength > b.capacity) {
      b.buffer.destroy();
      b.capacity = 2 ** Math.ceil(Math.log2(Math.max(32, data.byteLength)));
      b.buffer = this.device.createBuffer({
        byteLength: b.capacity,
        usage: Buffer.VERTEX | Buffer.COPY_DST,
      });
      b.model.setAttributes({ instances: b.buffer });
    }
    if (data.byteLength) b.buffer.write(data);
    b.count = data.length / 8;
    b.model.setInstanceCount(b.count);
    this.redraw();
  }
  setTerrain(cells: NonNullable<InspectionResult["terrain"]>) {
    const data = new Float32Array(cells.length * 8);
    cells.forEach((c, i) => {
      const shade = Math.max(
        0.15,
        Math.min(0.6, 0.27 + c.elevation * 0.018 + (c.type % 7) * 0.018),
      );
      data.set(
        [c.x + 0.5, c.y + 0.5, 1, 1, shade * 0.8, shade, shade * 0.65, 1],
        i * 8,
      );
    });
    this.update(0, data);
  }
  setEntries(entries: SpatialEntry[], colors: Map<number, number>) {
    this.entries = entries;
    this.grid.clear();
    const data = new Float32Array(entries.length * 8);
    entries.forEach((e, i) => {
      const key = `${Math.floor(e.x / 4)},${Math.floor(e.y / 4)}`;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key)!.push(e);
      const color = rgb(
        playerColors[colors.get(e.owner) ?? e.owner % 9] ?? playerColors[8],
      );
      data.set(
        [
          e.x,
          e.y,
          e.owner === 0 ? 0.65 : 1.15,
          e.owner === 0 ? 0.65 : 1.15,
          ...color,
          1,
        ],
        i * 8,
      );
    });
    this.update(1, data);
  }
  select(ids: Set<number>, point?: { x: number; y: number }) {
    const chosen = this.entries.filter((e) => ids.has(e.id));
    const data = new Float32Array((chosen.length + (point ? 1 : 0)) * 8);
    chosen.forEach((e, i) => data.set([e.x, e.y, 2.2, 2.2, 1, 1, 1, 1], i * 8));
    if (point)
      data.set([point.x, point.y, 3, 3, 1, 0.85, 0.1, 1], chosen.length * 8);
    this.update(2, data);
  }
  private transform() {
    const rect = this.canvas.getBoundingClientRect();
    const scale =
      Math.min(rect.width / this.width, rect.height / this.height) * this.zoom;
    return {
      scale,
      sx: (2 * scale) / rect.width,
      sy: (-2 * scale) / rect.height,
    };
  }
  world(x: number, y: number): [number, number] {
    const { scale } = this.transform();
    const rect = this.canvas.getBoundingClientRect();
    return [
      (x - rect.width / 2) / scale + this.center[0],
      (y - rect.height / 2) / scale + this.center[1],
    ];
  }
  pick(x: number, y: number) {
    const [wx, wy] = this.world(x, y),
      radius = Math.max(0.8, 6 / this.transform().scale);
    let best: SpatialEntry | undefined;
    let distance = radius;
    for (
      let gx = Math.floor((wx - radius) / 4);
      gx <= Math.floor((wx + radius) / 4);
      gx++
    )
      for (
        let gy = Math.floor((wy - radius) / 4);
        gy <= Math.floor((wy + radius) / 4);
        gy++
      )
        for (const e of this.grid.get(`${gx},${gy}`) ?? []) {
          const d = Math.hypot(e.x - wx, e.y - wy);
          if (d < distance) {
            distance = d;
            best = e;
          }
        }
    return best;
  }
  box(a: [number, number], b: [number, number]) {
    const p = this.world(...a),
      q = this.world(...b);
    return this.entries
      .filter(
        (e) =>
          e.x >= Math.min(p[0], q[0]) &&
          e.x <= Math.max(p[0], q[0]) &&
          e.y >= Math.min(p[1], q[1]) &&
          e.y <= Math.max(p[1], q[1]),
      )
      .map((e) => e.id);
  }
  pan(dx: number, dy: number) {
    const { scale } = this.transform();
    this.center = [this.center[0] - dx / scale, this.center[1] - dy / scale];
    this.redraw();
  }
  magnify(factor: number) {
    this.zoom = Math.max(0.5, Math.min(40, this.zoom * factor));
    this.redraw();
  }
  reset() {
    this.center = [this.width / 2, this.height / 2];
    this.zoom = 1;
    this.redraw();
  }
  private redraw() {
    if (!this.frame && !this.destroyed)
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        try {
          this.draw();
        } catch (e) {
          this.onError(e instanceof Error ? e.message : "GPU rendering failed");
        }
      });
  }
  private draw() {
    const { sx, sy } = this.transform();
    this.camera.write(
      new Float32Array([sx, sy, -this.center[0] * sx, -this.center[1] * sy]),
    );
    const pass = this.device.beginRenderPass({
      clearColor: [0.09, 0.12, 0.1, 1],
      clearDepth: 1,
    });
    for (const batch of this.batches) if (batch.count) batch.model.draw(pass);
    pass.end();
    this.device.submit();
  }
  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.frame);
    this.resize.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.lost);
    for (const b of this.batches) {
      b.model.destroy();
      b.buffer.destroy();
    }
    this.geometry.destroy();
    this.camera.destroy();
    this.device.destroy();
  }
}
