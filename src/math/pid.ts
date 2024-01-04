class PID {
	private previousError: number = 0;
	private integral: number = 0;

	constructor(private kP: number, private kI: number, private kD: number, private maxIntegral: number = 10) {
		this.kP = kP;
		this.kI = kI;
		this.kD = kD;
	}

	public update(setpoint: number, input: number, dt: number): number {
		const error = setpoint - input;
		this.integral += error * dt;
		const derivative = (error - this.previousError) / <number>dt;
		this.previousError = error;

		this.integral = Math.max(-this.maxIntegral, Math.min(this.maxIntegral, this.integral));

		return this.kP * error + this.kI * this.integral + this.kD * derivative;
	}
}

export { PID };
