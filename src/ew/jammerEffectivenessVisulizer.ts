import { rscale } from "../application.js";
import { Color } from "../renderer/color.js";
import { Renderer } from "../renderer/renderer.js";
import { Jammer } from "./jammer.js";
import { Radar } from "./radar.js";

const scanWidth = 1000;
let stepFactor = 8;

const upperRangeCutoff = 0.05;
class JEffectVisulizer {
	private lastUpdate = 0;
	private values: number[][] = [];

	private upperRangeHighest = 0;
	private upperRangeLowest = 10;

	private lowest = 10;
	private highest = 0;

	private renderingCtx: CanvasRenderingContext2D;

	private dx = 0;
	private dy = 0;

	constructor(private renderer: Renderer, private radar: Radar, private jammer: Jammer) {
		const canvas = document.createElement("canvas");
		canvas.width = scanWidth;
		canvas.height = scanWidth;

		this.renderingCtx = canvas.getContext("2d")!;

		document.body.appendChild(canvas);
	}

	public update() {
		this.draw();

		for (let i = 0; i < 500; i++) this.updatePixel2();
		// console.log(this.highest, this.lowest);
	}

	private updatePixel() {
		const orgJtarget = this.jammer.target.clone();

		const dir = this.radar.position.clone().sub(this.jammer.position).normalize();
		const relX = this.dx / rscale;
		const relZ = this.dy / rscale;
		const relScanSize = scanWidth / rscale;
		const x = this.radar.position.x - relScanSize / 2 + relX;
		const z = this.radar.position.z - relScanSize / 2 + relZ;
		this.jammer.target.set(x, 0, z);
		const jEnergy = this.radar.getJammerEnergyInDirection(dir);

		if (jEnergy < this.lowest) this.lowest = jEnergy;
		if (jEnergy > this.highest) this.highest = jEnergy;

		const c = (jEnergy - this.lowest) / (this.highest - this.lowest);
		this.renderingCtx.fillStyle = `rgb(${c * 255}, ${c * 255}, ${c * 255})`;
		this.renderingCtx.fillRect(this.dx, this.dy, stepFactor, stepFactor);

		this.dx += stepFactor;
		if (this.dx >= scanWidth) {
			this.dx = 0;
			this.dy += stepFactor;
		}

		if (this.dy >= scanWidth) {
			this.dy = 0;
			stepFactor--;
			if (stepFactor < 1) stepFactor = 1;
		}

		this.jammer.target.copy(orgJtarget);
	}

	private updatePixel2() {
		const orgPos = this.radar.position.clone();

		const relX = this.dx / rscale;
		const relZ = this.dy / rscale;
		const relScanSize = scanWidth / rscale;
		const x = this.radar.position.x - relScanSize / 2 + relX;
		const z = this.radar.position.z - relScanSize / 2 + relZ;

		// this.jammer.target.set(x, 0, z);
		this.radar.position.set(x, 0, z);

		const dir = this.radar.position.clone().sub(this.jammer.position).normalize();
		const jEnergy = this.radar.getJammerEnergyInDirection(dir);

		if (jEnergy > upperRangeCutoff) {
			if (jEnergy < this.upperRangeLowest) this.upperRangeLowest = jEnergy;
			if (jEnergy > this.upperRangeHighest) this.upperRangeHighest = jEnergy;

			const c = (jEnergy - this.upperRangeLowest) / (this.upperRangeHighest - this.upperRangeLowest);
			this.renderingCtx.fillStyle = `rgb(${0}, ${c * 255}, ${255})`;
		} else {
			if (jEnergy < this.lowest) this.lowest = jEnergy;
			if (jEnergy > this.highest) this.highest = jEnergy;

			const c = (jEnergy - this.lowest) / (this.highest - this.lowest);
			this.renderingCtx.fillStyle = `rgb(${c * 255}, ${c * 255}, ${c * 255})`;
		}

		this.renderingCtx.fillRect(this.dx, this.dy, stepFactor, stepFactor);

		this.dx += stepFactor;
		if (this.dx >= scanWidth) {
			this.dx = 0;
			this.dy += stepFactor;
		}

		if (this.dy >= scanWidth) {
			this.dy = 0;
			stepFactor--;
			if (stepFactor < 1) stepFactor = 1;
		}

		this.radar.position.copy(orgPos);
	}

	private draw() {
		const rx = this.radar.position.x;
		const rz = this.radar.position.z;

		this.renderer.ctx.drawImage(
			this.renderingCtx.canvas,
			0,
			0,
			scanWidth,
			scanWidth,
			rx * rscale - scanWidth / 2,
			rz * rscale - scanWidth / 2,
			scanWidth,
			scanWidth
		);
	}
}

export { JEffectVisulizer };
