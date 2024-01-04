import { Application, rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { Color } from "../renderer/color.js";
import { Renderer } from "../renderer/renderer.js";
import { Contact } from "./contact.js";
import { Radar } from "./radar.js";

const color = new Color([170, 0, 200]);

interface RGPOData {
	posOffset: Vector3;
	velOffset: Vector3;
}

class Jammer {
	public position: Vector3 = new Vector3(0, 0, 0);
	public target: Vector3 = new Vector3(0, 0, 0);

	private maxPowerOutput: number = 800;
	private directionalPower = 8000;
	private signalLeakFactor = 0.03;

	public rgpos: RGPOData[] = [];

	private pullOffTime = 0;
	private pullOffAttemptDuration = 0;
	private pullOffSpeed = 0;
	private pullOffAccel = 0;
	private pullOffDir: Vector3 = new Vector3();

	public pullOffPos: Vector3 = new Vector3();
	public pullOffVel: Vector3 = new Vector3();

	constructor(private renderer: Renderer, private name: string = "Jammer") {}

	public runRGPOAgainst(radar: Radar, contact: Contact, dt: number) {
		this.target.copy(radar.position);
		this.position.copy(contact.position);

		if (this.pullOffTime < 0) {
			// const tdir = this.target.clone().sub(this.position).normalize();
			const tdir = this.position.clone().sub(this.target).normalize();

			this.pullOffTime = 0;
			this.pullOffAttemptDuration = Math.random() * 3 + 5;
			this.pullOffSpeed = 0;
			this.pullOffAccel = Math.random() * 10 + 10;
			this.pullOffPos = new Vector3();
			this.pullOffVel = new Vector3();
			this.pullOffDir = tdir;
		}

		this.pullOffPos.add(this.pullOffDir.clone().multiplyScalar(this.pullOffSpeed * dt));
		this.pullOffVel.add(this.pullOffDir.clone().multiplyScalar(this.pullOffAccel * dt));
		this.pullOffSpeed += this.pullOffAccel * dt;
		this.pullOffTime += dt;
		if (this.pullOffTime > this.pullOffAttemptDuration) {
			this.pullOffTime = -1;
		}

		const lock = radar.locks.find(l => l.contact === contact);
		if (!lock) {
			console.log(`RGPO failed, no lock on ${contact.name}`);
			return;
		}
		lock.rgpoOffsets.push({
			pos: this.pullOffPos,
			vel: this.pullOffVel,
			jammer: this
		});

		const displayPos = this.pullOffPos.clone().multiplyScalar(10).add(this.position).multiplyScalar(rscale);
		this.renderer.strokeEllipse(displayPos.x, displayPos.z, 3, 3, [215, 240, 29]);
	}

	public update() {
		this.draw();
		// this.position.set(Application.mouseX / rscale, 0, Application.mouseY / rscale);
		// this.target.set(Application.mouseX / rscale, 0, Application.mouseY / rscale);
	}

	public getSignalStrength(pos: Vector3) {
		const relPos = pos.clone().sub(this.position);
		const xmitDir = this.target.clone().sub(this.position).normalize();
		// this.renderer.line(
		// 	this.position.x * rscale,
		// 	this.position.z * rscale,
		// 	(this.position.x + xmitDir.x * 10000000) * rscale,
		// 	(this.position.z + xmitDir.z * 10000000) * rscale,
		// 	[255, 0, 0]
		// );

		let dot = relPos.dot(xmitDir);
		if (dot <= 0) return 0;

		let power = 0;
		dot /= relPos.length();
		dot = Math.pow(dot, this.directionalPower);
		power = (dot * this.maxPowerOutput) / relPos.length();

		const leak = (this.maxPowerOutput * this.signalLeakFactor) / relPos.length();
		power += leak;

		Application.debug(`Dist`, relPos.length().toFixed(0));
		Application.debug(`Jammer power`, power.toFixed(4));

		return power;
	}

	private draw() {
		const x = this.position.x * rscale;
		const y = this.position.z * rscale;

		this.renderer.strokeEllipse(x, y, 7, 7, color);
		const textWid = this.renderer.textWidth(this.name, 10);
		this.renderer.text(this.name, x - textWid / 2, y + 20, 150, 10);

		const tx = this.target.x * rscale;
		const ty = this.target.z * rscale;
		this.renderer.dashedLine(x, y, tx, ty, [15, 15], color);
		this.renderer.dashedEllipse(tx, ty, 20, 20, [5, 10], color);
	}
}

export { Jammer };
