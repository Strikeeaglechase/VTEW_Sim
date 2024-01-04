import { Jammer } from "./jammer.js";
import { Radar } from "./radar.js";
import { Contact } from "./contact.js";
import { Renderer } from "../renderer/renderer.js";
import { Application, Camera, rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { rad } from "../utils.js";

const step = 5;
const radialUpdates = 3;

interface Radial {
	range: number;
	det: number;
	step: number;
	prevDir: number;
	rCount: number;
	nrCount: number;
}

class ContactJVis {
	private radials: Radial[] = [];

	constructor(private renderer: Renderer, private radar: Radar) {}

	public update() {
		this.runRadials();
	}

	private runRadials() {
		const contact = Application.instance.contactOfInterest;
		if (!contact) return;

		let prevRadPos: Vector3;
		for (let ang = 0; ang <= this.radar.scanFov; ang += 1) {
			let radial: Radial = this.radials[ang];
			if (!radial) {
				radial = {
					range: 0,
					det: 0,
					step: 10,
					prevDir: 1,
					rCount: 0,
					nrCount: 0
				};
				this.radials[ang] = radial;
			}

			const orgCpos = contact.position.clone();
			for (let i = 0; i < radialUpdates - 1; i++) this.updateRadial(radial, ang);
			const pos = this.updateRadial(radial, ang);
			contact.position.copy(orgCpos);
			const visualPos = pos.multiplyScalar(rscale).sub(Camera.pos);
			// this.renderer.strokeEllipse(visualPos.x, visualPos.z, 5, 5, [255, 0, 0]);
			if (prevRadPos) {
				this.renderer.line(prevRadPos.x, prevRadPos.z, visualPos.x, visualPos.z, [255, 0, 0]);
			}
			prevRadPos = visualPos;
		}
	}

	private updateRadial(radial: Radial, ang: number) {
		const contact = Application.instance.contactOfInterest;

		const angle = this.radar.rotation + ang + 180;
		const pos = new Vector3(Math.cos(rad(angle)), 0, Math.sin(rad(angle))).multiplyScalar(radial.range).divideScalar(rscale).add(this.radar.position);
		contact.position.copy(pos);

		const detectability = this.radar.getContactDetectability(contact);
		if (detectability > 1) {
			radial.range -= radial.step;
			radial.det = detectability;

			if (radial.prevDir == 1) radial.rCount++;
			else radial.nrCount++;
			radial.prevDir = -1;
		} else {
			radial.range += radial.step;
			radial.det = detectability;

			if (radial.prevDir == -1) radial.rCount++;
			else radial.nrCount++;
			radial.prevDir = 1;
		}

		if (radial.rCount > 3) {
			radial.step /= 2;
			radial.rCount = 0;
			radial.nrCount = 0;
		}

		if (radial.nrCount > 3) {
			radial.step *= 2;
			radial.rCount = 0;
			radial.nrCount = 0;
		}

		if (radial.step < 0.1) radial.step = 0.1;
		if (radial.step > 100) radial.step = 100;

		return pos;
	}
}

export { ContactJVis };
