/** Set exit status without terminating pending stdout writes (notably pipes). */
export function writeCliOutput(text: string, exitCode: number): void {
  process.stdout.write(`${text}\n`);
  process.exitCode = exitCode;
}
