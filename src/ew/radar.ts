import { Application, rscale } from "../application.js";
import { Vector3 } from "../math/vector3.js";
import { Color, ColorValue } from "../renderer/color.js";
import { Renderer, deg, rad } from "../renderer/renderer.js";
import { clamp, lerp, meterToNm, nmToMeter } from "../utils.js";
import { Contact } from "./contact.js";
import { ContactJVis } from "./contactJammingVisulizer.js";
import { Jammer } from "./jammer.js";
import { RCSQueryDirection } from "./rcs.js";

enum Band {
	Low,
	Mid,
	High
}

const scanSpeed = 50;
const initialSpeedGate = 50;
const initialRangeGate = 100;
const RADAR_RECEIVER_DOT_POWER = 20;
const RADAR_LOCK_FOV = 2;

enum LockReturnType {
	Actual,
	RGPO,
	Chaff,
	Broken
}

interface LockReturn {
	pos: Vector3;
	vel: Vector3;
	weight: number;
	type: LockReturnType;
}

interface LockParams {
	radarPos: Vector3;
	radarLookDir: Vector3;
	dotLim: number;
	xRange: number;
	rangeGate: number;
	xClosingSpeed: number;
	speedGate: number;
}

const lockColor = new Color([173, 55, 26]);

class RadarLock {
	private rangeGate: number = initialRangeGate;
	private speedGate: number = initialSpeedGate;

	public position: Vector3 = new Vector3();
	public velocity: Vector3 = new Vector3();

	public rgpoOffsets: { pos: Vector3; vel: Vector3; jammer: Jammer }[] = [];

	public lastLockType: LockReturnType = LockReturnType.Actual;

	constructor(public contact: Contact, private radar: Radar, private renderer: Renderer) {
		this.position.copy(contact.position);
		this.velocity.copy(contact.velocity);
	}

	public update() {
		const relPos = this.contact.position.clone().sub(this.radar.position);
		const dist = relPos.length();
		const lookDir = relPos.normalize();
		const xClosingSpeed = this.velocity.dot(lookDir);

		const signalStrength = this.radar.getRadarSignalStrength(this.contact);
		const returnSignalStrength = (this.radar.transmissionStrength * signalStrength) / dist ** 2;
		Application.debug(`RSigStren`, returnSignalStrength.toFixed(4));
		const lock = this.getECMEffectedPos(returnSignalStrength, lookDir, RADAR_LOCK_FOV, dist, this.rangeGate, xClosingSpeed, this.speedGate);

		if (lock != null) {
			this.position.copy(lock.pos);
			this.velocity.copy(lock.vel);

			this.lastLockType = lock.type;

			const displayPos = this.scaledPos(this.position);
			// this.renderer.ellipse(displayPos.x, displayPos.z, 2, 2, 255);

			this.renderer.strokeRect(displayPos.x - 10, displayPos.z - 10, 20, 20, lockColor);
		} else {
			this.lastLockType = LockReturnType.Broken;
		}

		this.rgpoOffsets = [];
	}

	private getECMEffectedPos(
		actualReturnSignal: number,
		radarLookDir: Vector3,
		radarLookFOV: number,
		xRange: number,
		rangeGate: number,
		xClosingSpeed: number,
		speedGate: number
	) {
		const returns: LockReturn[] = [];
		let totalWeight = 0;

		const dotLim = Math.cos(rad(radarLookFOV));
		radarLookDir.normalize();
		const position = this.radar.position;

		const params: LockParams = {
			radarPos: position,
			radarLookDir: radarLookDir,
			dotLim: dotLim,
			xRange: xRange,
			rangeGate: rangeGate,
			xClosingSpeed: xClosingSpeed,
			speedGate: speedGate
		};

		const realLockReturn: LockReturn = {
			pos: this.contact.position,
			vel: this.contact.velocity,
			weight: actualReturnSignal,
			type: LockReturnType.Actual
		};

		if (this.isWithinGate(realLockReturn, params)) {
			returns.push(realLockReturn);
			totalWeight += actualReturnSignal;
		}

		// < chaff go here >

		if (this.rgpoOffsets.length > 0) {
			const rgpoLockRet = this.getRgpoLR(radarLookDir, realLockReturn);
			if (rgpoLockRet.weight > 0 && this.isWithinGate(rgpoLockRet, params)) {
				returns.push(rgpoLockRet);
				totalWeight += rgpoLockRet.weight;
			}
		}

		if (returns.length == 0) {
			Application.debug(`Radar`, `No LRs`);
			return null;
		}

		let realLockReturnWeight = 0;
		let nonRealLockReturnWeight = 0;
		returns.forEach(ret => {
			if (ret.type == LockReturnType.Actual) realLockReturnWeight += ret.weight;
			else nonRealLockReturnWeight += ret.weight;

			const displayPos = this.scaledPos(ret.pos);
			this.renderer.ellipse(displayPos.x, displayPos.z, 2, 2, lockColor);
		});
		Application.debug(`Real LR weight`, realLockReturnWeight.toFixed(4));
		Application.debug(`Fake LR weight`, nonRealLockReturnWeight.toFixed(4));
		const ratio = (realLockReturnWeight / (realLockReturnWeight + nonRealLockReturnWeight)) * 100;
		Application.debug(`Real LR %`, ratio.toFixed(1) + "%");

		const weightThreshold = Math.random() * totalWeight;
		let currentWeight = 0;
		let selectedReturn = returns[returns.length - 1];

		for (let i = 0; i < returns.length; i++) {
			currentWeight += returns[i].weight;
			if (currentWeight >= weightThreshold) {
				selectedReturn = returns[i];
				break;
			}
		}

		Application.debug(`Selected LR`, LockReturnType[selectedReturn.type]);
		return selectedReturn;
	}

	private scaledPos(pos: Vector3) {
		const offset = pos.clone().sub(this.contact.position).multiplyScalar(10);
		return offset.add(this.contact.position).multiplyScalar(rscale);
	}

	private getRgpoLR(radarLookDir: Vector3, actualLr: LockReturn) {
		const sensitivityThreshold = 1 / this.radar.recieverSensitivity;
		const ret: LockReturn = {
			pos: new Vector3(),
			vel: new Vector3(),
			weight: 0,
			type: LockReturnType.RGPO
		};

		this.rgpoOffsets.forEach(offset => {
			let signalStrength = offset.jammer.getSignalStrength(this.radar.position);
			if (signalStrength < sensitivityThreshold) {
				Application.debug(`RGPO Fail`, `Sensitivity`);
				return;
			}

			const dir = offset.jammer.position.clone().sub(this.radar.position).normalize();
			const dot = radarLookDir.dot(dir);
			const coverage = Math.pow(dot, RADAR_RECEIVER_DOT_POWER);
			signalStrength *= coverage;

			if (signalStrength < sensitivityThreshold) {
				Application.debug(`RGPO Fail`, `Coverage`);
				return;
			}

			if (ret.weight == 0) {
				ret.pos.copy(offset.pos).add(actualLr.pos);
				ret.vel.copy(offset.vel).add(actualLr.vel);
			}
			ret.weight += signalStrength;
		});

		return ret;
	}

	private isWithinGate(ret: LockReturn, params: LockParams) {
		const deltaPos = ret.pos.clone().sub(params.radarPos);
		const dist = deltaPos.length();

		if (Math.abs(dist - params.xRange) > params.rangeGate) {
			// console.log(`Range gate failed on ${LockReturnType[ret.type]} lock return`);
			return false;
		}

		const dot = deltaPos.normalize().dot(params.radarLookDir);
		if (Math.abs(dot) < params.dotLim) {
			// console.log(`Dot gate failed on ${LockReturnType[ret.type]} lock return`);
			return false;
		}

		const closure = params.radarLookDir.dot(ret.vel);
		if (Math.abs(closure - params.xClosingSpeed) > params.speedGate) {
			// console.log(`Speed gate failed on ${LockReturnType[ret.type]} lock return`);
			return false;
		}

		return true;
	}
}

class Radar {
	public position: Vector3 = new Vector3(0, 0, 0);

	public transmissionStrength: number = 125000;
	public recieverSensitivity: number = 500;
	public u_signalCeiling = 0.0055;
	public band: Band = Band.Mid;

	public scanAngle: number = 0;
	private scanDir = 1;

	public detectedContacts: Contact[] = [];
	private jammers: Jammer[] = [];
	public locks: RadarLock[] = [];

	public rotation: number = 300;
	public scanFov: number = 120;

	public minDrawSize = 150;

	private visulizer: ContactJVis;

	constructor(private renderer: Renderer, private name: string = "Radar") {
		this.visulizer = new ContactJVis(renderer, this);
	}

	public update(dt: number, contacts: Contact[], jammers: Jammer[]) {
		this.jammers = jammers;

		this.detectedContacts = [];
		this.scanAngle += dt * scanSpeed * this.scanDir;
		contacts.forEach(c => this.updateContact(c));
		this.draw();
		this.locks.forEach(l => l.update());

		if (this.scanAngle > this.scanFov) {
			this.scanAngle = this.scanFov;
			this.scanDir *= -1;
		} else if (this.scanAngle < 0) {
			this.scanAngle = 0;
			this.scanDir *= -1;
		}

		this.visulizer.update();

		this.rotation %= 360;
	}

	public getContactDetectability(contact: Contact) {
		const viewDir = contact.position.clone().sub(this.position).normalize();
		const distSqr = this.position.distanceToSquared(contact.position);

		const jammerAdjustedGain = this.getJammerAdjustedGain(viewDir);
		const radarSignalStrength = this.getRadarSignalStrength(contact);
		const resultReturnSignal = (this.transmissionStrength * radarSignalStrength) / distSqr;

		return resultReturnSignal / (1 / (this.recieverSensitivity * jammerAdjustedGain));
	}

	public isContactDetected(contact: Contact) {
		return this.getContactDetectability(contact) >= 1;
	}

	private updateContact(contact: Contact) {
		const viewDir = contact.position.clone().sub(this.position).normalize();
		const distSqr = this.position.distanceToSquared(contact.position);

		const jammerAdjustedGain = this.getJammerAdjustedGain(viewDir);
		const radarSignalStrength = this.getRadarSignalStrength(contact);
		const resultReturnSignal = (this.transmissionStrength * radarSignalStrength) / distSqr;

		// const lm = `${resultReturnSignal.toFixed(4)} / ${(1 / (this.recieverSensitivity * jammerAdjustedGain)).toFixed(10)}`;
		// this.renderer.text(lm, this.position.x * rscale - this.renderer.textWidth(lm) / 2, this.position.z * rscale + 30, 255, 10);

		const detectionThreshold = 1 / (this.recieverSensitivity * jammerAdjustedGain);
		if (resultReturnSignal >= 1 / (this.recieverSensitivity * jammerAdjustedGain)) {
			// Detected!
			this.detectedContacts.push(contact);

			// const ratio = resultReturnSignal / (1 / (this.recieverSensitivity * jammerAdjustedGain));
			const distStr = meterToNm(Math.sqrt(distSqr)).toFixed(1);
			this.textLine(this.position.x * rscale, this.position.z * rscale, contact.position.x * rscale, contact.position.z * rscale, `${distStr}nm`, true);
		} else {
			const distStr = meterToNm(Math.sqrt(distSqr)).toFixed(1);
			this.textLine(this.position.x * rscale, this.position.z * rscale, contact.position.x * rscale, contact.position.z * rscale, `${distStr}nm`, false);
		}
	}

	public getRadarSignalStrength(contact: Contact): number {
		const viewDir = this.position.clone().sub(contact.position).normalize();
		const rcs = contact.rcs.getRcs(RCSQueryDirection.Average);
		let ret = 1;

		const dotUp = viewDir.dot(new Vector3(0, 1, 0));
		ret = lerp(ret, 1.5, dotUp);
		ret *= rcs;

		return ret;
	}

	public getJammerEnergyInDirection(dir: Vector3) {
		let jammingPower = 0;
		this.jammers.forEach(jammer => {
			if (this.isBurtThrough(jammer)) return;

			const jammerDir = jammer.position.clone().sub(this.position).normalize();
			const dot = dir.dot(jammerDir);
			const coverage = Math.pow(dot, RADAR_RECEIVER_DOT_POWER);
			Application.debug(`Coverage`, coverage.toFixed(8));
			Application.debug(`Dot`, dot.toFixed(8));
			if (coverage > 0 && dot > 0) {
				jammingPower += jammer.getSignalStrength(this.position) * coverage;
			}
			Application.debug(`JRec power`, jammingPower.toFixed(4));
		});

		return jammingPower;
	}

	private getJammerAdjustedGain(dir: Vector3) {
		let jammingPower = 0;
		this.jammers.forEach(jammer => {
			if (this.isBurtThrough(jammer)) return;

			const jammerDir = jammer.position.clone().sub(this.position).normalize();
			const dot = dir.dot(jammerDir);
			const coverage = Math.pow(dot, RADAR_RECEIVER_DOT_POWER);
			Application.debug(`Coverage`, coverage.toFixed(4));
			if (coverage > 0 && dot > 0) {
				jammingPower += jammer.getSignalStrength(this.position) * coverage;
			}
			Application.debug(`JRec power`, jammingPower.toFixed(4));
		});

		if (jammingPower > 1 / this.recieverSensitivity) {
			// Yippy jamming!
			// console.log(`Jammed`);
		}

		// console.log(jammingPower);

		// console.log(jammingPower - this.u_signalCeiling);

		return Math.max(1 - clamp((jammingPower - this.u_signalCeiling) / (1 / this.recieverSensitivity), 0, 1), 0.01);
	}

	private textLine(x1: number, y1: number, x2: number, y2: number, text: string, det: boolean) {
		const textSize = 10;
		const textHeight = text.split("\n").length * textSize;
		const textWid = this.renderer.textWidth(text, textSize);
		const textX = x1 + (x2 - x1) / 2 - textWid / 2;
		const textY = y1 + (y2 - y1) / 2 + textHeight / 2;

		const color: ColorValue = det ? [0, 255, 0] : [200, 200, 200];
		this.renderer.dashedLine(x1, y1, x2, y2, [15, 15], color);
		this.renderer.text(text, textX, textY, color, 10);
	}

	private isBurtThrough(jammer: Jammer) {
		return false;
	}

	public getPointingForAngle(angle: number) {
		return new Vector3(Math.cos(rad(angle + this.rotation)), 0, Math.sin(rad(angle + this.rotation))).normalize();
	}

	private draw() {
		const x = this.position.x * rscale;
		const y = this.position.z * rscale;
		const size = 10;

		// this.renderer.triangle(x - size, y - size, x + size, y - size, x, y + size, 255);
		this.renderer.line(x - size, y + size, x + size, y + size, 255);
		this.renderer.line(x + size, y + size, x, y - size, 255);
		this.renderer.line(x, y - size, x - size, y + size, 255);
		const tWid = this.renderer.textWidth(this.name, 10);
		this.renderer.text(this.name, x - tWid / 2, y - size - 10, 255, 10);

		// Find a good size to render at
		let drawSizeMeters = nmToMeter(4);
		while (drawSizeMeters * rscale < this.minDrawSize) drawSizeMeters *= 2;
		const drawSize = drawSizeMeters * rscale;

		const ex = x + Math.cos(rad(this.scanAngle + this.rotation)) * drawSize;
		const ey = y + Math.sin(rad(this.scanAngle + this.rotation)) * drawSize;
		this.renderer.line(x, y, ex, ey, 155);

		const exLim = x + Math.cos(rad(this.rotation)) * drawSize;
		const eyLim = y + Math.sin(rad(this.rotation)) * drawSize;
		this.renderer.line(x, y, exLim, eyLim, 155);

		const exLim2 = x + Math.cos(rad(this.scanFov + this.rotation)) * drawSize;
		const eyLim2 = y + Math.sin(rad(this.scanFov + this.rotation)) * drawSize;
		this.renderer.line(x, y, exLim2, eyLim2, 155);

		const halfExLim = x + (Math.cos(rad(this.rotation)) * drawSize) / 2;
		const halfEyLim = y + (Math.sin(rad(this.rotation)) * drawSize) / 2;

		const fullLimText = Math.round(meterToNm(drawSizeMeters)) + "nm";
		const halfLimText = Math.round(meterToNm(drawSizeMeters / 2)) + "nm";
		const fullLimWid = this.renderer.textWidth(fullLimText, 10);
		const halfLimWid = this.renderer.textWidth(halfLimText, 10);
		this.renderer.text(fullLimText, exLim - fullLimWid / 2, eyLim - 5, 155, 10);
		this.renderer.text(halfLimText, halfExLim - halfLimWid / 2, halfEyLim - 5, 155, 10);

		// this.renderer.strokeEllipse(x, y, drawRad, drawRad, 155);
		this.renderer.arc(x, y, drawSize, this.rotation, this.scanFov + this.rotation, 155);
		this.renderer.arc(x, y, drawSize / 2, this.rotation, this.scanFov + this.rotation, 155);
	}

	public aquireLock(contact: Contact, force: boolean): RadarLock {
		const detected = this.detectedContacts.includes(contact);
		if (!force && !detected) return;
		const existingLock = this.locks.find(l => l.contact == contact);
		if (existingLock) return existingLock;

		const lock = new RadarLock(contact, this, this.renderer);
		this.locks.push(lock);

		return lock;
	}

	public getLockForContact(contact: Contact) {
		return this.locks.find(l => l.contact == contact);
	}
}

export { Radar, lockColor, LockReturnType };
