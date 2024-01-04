import { Vector3 } from "../math/vector3.js";

enum RCSQueryDirection {
	PureFront,
	RoughFront,
	OnPlane,
	Average,
	Worst
}

interface RCSReturn {
	normal: Vector3;
	size: number;
}

interface RCSProvider {
	getRcs(dir: RCSQueryDirection): number;
}

class RCS implements RCSProvider {
	private queries: Record<RCSQueryDirection, number>;

	constructor(private size: number, private overrideMult: number, private returns: RCSReturn[]) {
		this.queries = {
			[RCSQueryDirection.PureFront]: this.getAveragedQuery(RCSQueryDirection.PureFront),
			[RCSQueryDirection.RoughFront]: this.getAveragedQuery(RCSQueryDirection.RoughFront),
			[RCSQueryDirection.OnPlane]: this.getAveragedQuery(RCSQueryDirection.OnPlane),
			[RCSQueryDirection.Average]: this.getAverageRcs(),
			[RCSQueryDirection.Worst]: this.getWorstRcs()
		};
	}

	private getWorstRcs() {
		let worst: RCSReturn = { normal: new Vector3(0, 0, 0), size: 0 };
		this.returns.forEach(r => {
			if (r.size > worst.size) {
				worst = r;
			}
		});

		return this.getCrossSection(worst.normal);
	}

	private getAverageRcs() {
		let total = 0;
		this.returns.forEach(r => (total += r.size));
		total /= this.returns.length;

		return 100 * this.overrideMult * this.size * total;
	}

	private getAveragedQuery(dir: RCSQueryDirection) {
		const vecs = this.getReturnVectors(dir);
		let total = 0;
		vecs.forEach(v => {
			total += this.getCrossSection(v);
		});
		return total / vecs.length;
	}

	private getReturnVectors(dir: RCSQueryDirection): Vector3[] {
		switch (dir) {
			case RCSQueryDirection.PureFront:
				return [new Vector3(0, 0, 1)];

			case RCSQueryDirection.RoughFront: {
				const ret: Vector3[] = [];
				const radius = 0.36; // tan(20deg) * 1
				const points = 32;
				for (let i = 0; i < points; i++) {
					const angle = (i / points) * Math.PI * 2;
					ret.push(new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 1));
				}
				return ret;
			}

			case RCSQueryDirection.OnPlane: {
				const ret: Vector3[] = [];
				const radius = 0.36; // tan(20deg) * 1
				const points = 32;
				for (let i = 0; i < points; i++) {
					const angle = (i / points) * Math.PI * 2;
					ret.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
				}
				return ret;
			}

			default:
				return [];
		}
	}

	private getCrossSection(vec: Vector3) {
		let size = 0;
		let numHits = 0;

		this.returns.forEach(r => {
			const dot = r.normal.dot(vec);
			if (dot > 0) {
				const strength = Math.pow(dot, 15);
				size += r.size * strength;
				numHits += strength;
			}
		});

		return (100 * this.overrideMult * this.size * size) / numHits;
	}

	public getRcs(dir: RCSQueryDirection) {
		return this.queries[dir];
	}
}

class DummyRCS implements RCSProvider {
	getRcs(dir: RCSQueryDirection): number {
		return 100;
	}
}

class FA26bRCS extends RCS {
	constructor() {
		const returns: RCSReturn[] = [
			{ normal: new Vector3(0, 0, -1), size: 0.004816384 },
			{ normal: new Vector3(-0.7071068, 0, -0.7071067), size: 0.008081271 },
			{ normal: new Vector3(-0.99999994, 0, -5.9604645e-8), size: 0.030624727 },
			{ normal: new Vector3(-0.70710677, 0, 0.7071067), size: 0.012479759 },
			{ normal: new Vector3(8.742278e-8, 0, 1), size: 0.0060571595 },
			{ normal: new Vector3(0.7071069, 0, 0.7071067), size: 0.012563871 },
			{ normal: new Vector3(0.99999994, 0, -5.9604645e-8), size: 0.030958744 },
			{ normal: new Vector3(0.7071066, 0, -0.707107), size: 0.008105151 },
			{ normal: new Vector3(0, 0.7071069, -0.70710677), size: 0.027235402 },
			{ normal: new Vector3(0, 1.0000001, 1.4751397e-7), size: 0.1913489 },
			{ normal: new Vector3(0, 0.70710677, 0.7071068), size: 0.04619971 },
			{ normal: new Vector3(0, -0.7071069, 0.7071067), size: 0.04070734 },
			{ normal: new Vector3(0, -1, -1.8966082e-7), size: 0.19589594 },
			{ normal: new Vector3(0, -0.7071067, -0.7071068), size: 0.019116392 },
			{ normal: new Vector3(-0.70710677, -0.7071069, -0), size: 0.04918731 },
			{ normal: new Vector3(0.70710677, -0.7071068, -0), size: 0.04894509 },
			{ normal: new Vector3(0.7071067, 0.7071069, -0), size: 0.063780926 },
			{ normal: new Vector3(-0.707107, 0.7071066, -0), size: 0.06392447 }
		];

		super(10.386499, 1, returns);

		// console.log(this.getRcs(RCSQueryDirection.RoughFront));
		Object.keys(RCSQueryDirection).forEach(k => {
			if (!isNaN(Number(k))) return;
			console.log(`${k}: ${this.getRcs(RCSQueryDirection[k as keyof typeof RCSQueryDirection])}`);
		});
	}
}

export { RCS, RCSQueryDirection, RCSReturn, RCSProvider, DummyRCS, FA26bRCS };
