import { Application, rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { Color } from "../renderer/color.js";
import { Renderer } from "../renderer/renderer.js";
import { meterToNm } from "../utils.js";
import { Contact } from "./contact.js";
import { LockReturnType, Radar, lockColor } from "./radar.js";

const color = new Color([0, 200, 0]);
class RadarDisplay {
	private bricks: { x: number; y: number; lt: number }[] = [];
	constructor(private renderer: Renderer, private radar: Radar, private x: number, private y: number, private width: number, private height: number) {}

	public update(contacts: Contact[]) {
		const sections = 4;

		for (let i = 0; i < sections + 1; i++) {
			const x = this.x + this.width * (i / sections);
			this.renderer.line(x, this.y, x, this.y + this.height, color);

			const y = this.y + this.height * (i / sections);
			this.renderer.line(this.x, y, this.x + this.width, y, color);
		}

		const carrotX = this.x + (this.radar.scanAngle / this.radar.scanFov) * this.width;
		const carrotY = this.y + this.height;

		this.renderer.line(carrotX, carrotY, carrotX - 5, carrotY - 10, color);
		this.renderer.line(carrotX, carrotY, carrotX + 5, carrotY - 10, color);

		this.radar.detectedContacts.forEach(c => this.drawContact(c, true));
		contacts.forEach(c => {
			if (this.radar.detectedContacts.includes(c)) return;
			this.drawContact(c, false);
		});

		const pointing = this.radar.getPointingForAngle(this.radar.scanAngle);
		const jEnergy = this.radar.getJammerEnergyInDirection(pointing);
		const noiseRatio = jEnergy / (1 / this.radar.recieverSensitivity) / 15;
		Application.debug(`JRatio`, (noiseRatio * 100).toFixed(0));
		const brickTryCount = 15;
		for (let i = 0; i < brickTryCount; i++) {
			const r = Math.random();
			if (r > noiseRatio) continue;

			const x = this.x + (this.radar.scanAngle / this.radar.scanFov) * this.width;
			const y = this.y + this.height - Math.random() * this.height;
			const lt = Math.random() * 100 + 50;
			this.bricks.push({ x, y, lt });
		}

		this.bricks.forEach(brick => {
			this.renderer.rect(brick.x - 5, brick.y, 10, 4, new Color([color.r, color.g, color.b, 50]));
			brick.lt -= 1;
		});

		this.bricks = this.bricks.filter(b => b.lt > 0);

		this.drawSpectrum();
	}

	private drawSpectrum() {
		let px = this.x;
		let py = this.y + this.height;
		for (let ang = 0; ang < this.radar.scanFov; ang++) {
			const pointing = this.radar.getPointingForAngle(ang);
			const jEnergy = this.radar.getJammerEnergyInDirection(pointing);
			const ratio = jEnergy / (1 / this.radar.recieverSensitivity) / 5;

			const x = this.x + (ang / this.radar.scanFov) * this.width;
			const y = this.y + this.height + ratio * 150;
			// this.renderer.point(x, y, color);
			this.renderer.line(px, py, x, y, color);
			px = x;
			py = y;
		}
		this.renderer.line(px, py, this.x + this.width, this.y + this.height, color);
	}

	private drawContact(contact: Contact, detected: boolean) {
		const relative = contact.position.clone().sub(this.radar.position);
		const distance = relative.length();
		let { bearing } = relative.angles();

		let angle = bearing - this.radar.rotation;
		if (angle < 0) angle += 360;
		if (angle > 360) angle -= 360;

		const x = this.x + (angle / this.radar.scanFov) * this.width;
		const y = this.y + this.height - distance * rscale;

		if (x < this.x || x > this.x + this.width) return;

		if (detected) this.renderer.ellipse(x, y, 5, 5, color);
		else this.renderer.strokeEllipse(x, y, 5, 5, color);

		const textWid = this.renderer.textWidth(contact.name, 10);
		this.renderer.text(contact.name, x - textWid / 2, y - 10, 150, 10);

		const dist = meterToNm(distance).toFixed(1) + "nm";
		const distWid = this.renderer.textWidth(dist, 10);
		this.renderer.text(dist, x - distWid / 2, y + 20, 150, 10);

		const lock = this.radar.getLockForContact(contact);
		if (lock && lock.lastLockType == LockReturnType.Actual) {
			this.renderer.strokeRect(x - 10, y - 10, 20, 20, lockColor);
		}
	}
}

export { RadarDisplay };
