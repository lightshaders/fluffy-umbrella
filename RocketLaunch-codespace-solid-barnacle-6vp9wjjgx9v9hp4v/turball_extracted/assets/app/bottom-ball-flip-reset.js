import { c as Physics } from "./chunk-ZFRU76SJ.js";
import { a as stateLayout, b as carLayout, c as carStride } from "./chunk-YST2QCUU.js";
import { i as getAudioContext, j as getAudioOutput } from "./chunk-HYESY4DZ.js";

function playBottomFlipResetCue() {
  try {
    const context = getAudioContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    gain.connect(getAudioOutput());
    let activeVoices = 2;
    for (const [frequency, delay] of [[660, 0], [990, 0.065]]) {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, now + delay);
      oscillator.connect(gain);
      oscillator.addEventListener("ended", () => {
        oscillator.disconnect();
        activeVoices -= 1;
        if (activeVoices === 0) gain.disconnect();
      }, { once: true });
      oscillator.start(now + delay);
      oscillator.stop(now + 0.28);
    }
  } catch {}
}

function matchesBottomFlipState(physics, carIndex, pointer, expected) {
  const heap = physics.native.HEAPF32;
  const bytes = physics.native.HEAPU8;
  if (!Number.isInteger(pointer) || pointer <= 0 || (pointer & 3) !== 0 || pointer + 152 > bytes.length) return false;
  const offset = pointer >>> 2;
  const carOffset = stateLayout.CARS + carIndex * carStride;
  if (offset + 38 >= heap.length) return false;
  for (let index = 0; index < 24; index += 1) {
    if (!Number.isFinite(heap[offset + index]) || Math.abs(heap[offset + index] - expected[index]) > 0.015) return false;
  }
  if (Math.abs(heap[offset + 37] - physics.state[carOffset + carLayout.BOOST]) > 0.05 || bytes[pointer + 104] !== (physics.state[carOffset + carLayout.ON_GROUND] ? 1 : 0)) return false;
  for (const index of [105, 106, 107, 108, 109, 110, 111, 136, 137]) {
    if (bytes[pointer + index] > 1) return false;
  }
  return true;
}

function findBottomFlipState(physics, carIndex) {
  const carOffset = stateLayout.CARS + carIndex * carStride;
  const state = physics.state;
  const heap = physics.native.HEAPF32;
  const bytes = physics.native.HEAPU8;
  const expected = [];
  for (const field of [0, 3, 6, 9, 12, 15]) {
    expected.push(state[carOffset + field], state[carOffset + field + 1], state[carOffset + field + 2], 0);
  }
  const cache = physics._bottomFlipStatePointers ?? (physics._bottomFlipStatePointers = []);
  if (matchesBottomFlipState(physics, carIndex, cache[carIndex], expected)) return cache[carIndex];
  let found = -1;
  const limit = Math.min(heap.length - 38, Math.ceil(physics.native._tb_heap_end() / 4));
  for (let offset = 0; offset < limit; offset += 1) {
    if (Math.abs(heap[offset] - expected[0]) > 0.015 || Math.abs(heap[offset + 1] - expected[1]) > 0.015 || Math.abs(heap[offset + 2] - expected[2]) > 0.015) continue;
    const pointer = offset * 4;
    if (matchesBottomFlipState(physics, carIndex, pointer, expected)) found = pointer;
  }
  if (found >= 0) cache[carIndex] = found;
  return found;
}

function restoreBottomBallFlip(physics, carIndex) {
  const carOffset = stateLayout.CARS + carIndex * carStride;
  const pointer = findBottomFlipState(physics, carIndex);
  if (pointer < 0) return false;
  const bytes = physics.native.HEAPU8;
  const heap = physics.native.HEAPF32;
  bytes[pointer + 109] = 0;
  bytes[pointer + 110] = 0;
  bytes[pointer + 111] = 0;
  bytes[pointer + 136] = 0;
  bytes[pointer + 137] = 0;
  for (const offset of [112, 128, 132, 144]) heap[(pointer + offset) >>> 2] = 0;
  physics.publish();
  if (!physics.state[carOffset + carLayout.HAS_FLIP_OR_JUMP]) {
    physics._bottomFlipStatePointers[carIndex] = -1;
    return false;
  }
  const serials = physics._bottomFlipVisualSerials ?? (physics._bottomFlipVisualSerials = []);
  const nativeSerial = physics.state[carOffset + carLayout.FLIP_RESET_SERIAL];
  const previous = Number.isFinite(serials[carIndex]) ? serials[carIndex] : nativeSerial;
  serials[carIndex] = Math.max(previous, nativeSerial) + 1;
  physics.state[carOffset + carLayout.FLIP_RESET_SERIAL] = serials[carIndex];
  playBottomFlipResetCue();
  return true;
}

function bottomBallContact(physics, carIndex, threshold = -0.25) {
  if (!physics.ballContact(carIndex)) return false;
  const carOffset = stateLayout.CARS + carIndex * carStride;
  const state = physics.state;
  const dx = state[stateLayout.BALL] - state[carOffset];
  const dy = state[stateLayout.BALL + 1] - state[carOffset + 1];
  const dz = state[stateLayout.BALL + 2] - state[carOffset + 2];
  const distance = Math.hypot(dx, dy, dz);
  if (distance < 1) return false;
  const bottomDot = -(dx * state[carOffset + 9] + dy * state[carOffset + 10] + dz * state[carOffset + 11]) / distance;
  return bottomDot > threshold;
}

function launchBallFromBottom(physics, carIndex) {
  if (!bottomBallContact(physics, carIndex, -0.1)) return false;
  const carOffset = stateLayout.CARS + carIndex * carStride;
  const state = physics.state;
  const direction = [
    state[carOffset + 3] * 0.72,
    state[carOffset + 4] * 0.72,
    Math.max(0.55, state[carOffset + 5] * 0.72),
  ];
  const magnitude = Math.hypot(...direction);
  const ball = physics.ball;
  const carVelocity = state.subarray(carOffset + 12, carOffset + 15);
  const velocity = ball.velocity.map((component, axis) => component + direction[axis] / magnitude * 2400 + carVelocity[axis] * 0.25);
  physics.setBall({ velocity, angularVelocity: ball.angularVelocity }, false);
  return true;
}

function applyBottomBallFlipResets(physics) {
  const state = physics.state;
  for (let carIndex = 0; carIndex < physics.carProfiles.length; carIndex += 1) {
    if (!bottomBallContact(physics, carIndex)) continue;
    const carOffset = stateLayout.CARS + carIndex * carStride;
    if (state[carOffset + carLayout.ON_GROUND] || state[carOffset + carLayout.HAS_FLIP_OR_JUMP]) continue;
    restoreBottomBallFlip(physics, carIndex);
  }
}

const originalPublish = Physics.prototype.publish;
Physics.prototype.publish = function () {
  originalPublish.call(this);
  const serials = this._bottomFlipVisualSerials;
  if (!serials) return;
  for (let carIndex = 0; carIndex < this.carProfiles.length; carIndex += 1) {
    const serialOffset = stateLayout.CARS + carIndex * carStride + carLayout.FLIP_RESET_SERIAL;
    const nativeSerial = this.state[serialOffset];
    const visualSerial = serials[carIndex];
    if (!Number.isFinite(visualSerial) || nativeSerial > visualSerial) serials[carIndex] = nativeSerial;
    else this.state[serialOffset] = visualSerial;
  }
};

const originalStep = Physics.prototype.step;
const originalSetControls = Physics.prototype.setControls;
Physics.prototype.setControls = function (carIndex, controls) {
  if (controls?.jump && !this.controls[carIndex]?.jump) launchBallFromBottom(this, carIndex);
  return originalSetControls.call(this, carIndex, controls);
};

Physics.prototype.step = function (ticks) {
  if (!Number.isInteger(ticks) || ticks <= 0 || !this.carProfiles.length) return originalStep.call(this, ticks);
  if (this._bottomFlipHandle !== this.handle) {
    this._bottomFlipHandle = this.handle;
    this._bottomFlipStatePointers = [];
    this._bottomFlipVisualSerials = [];
  }
  for (let index = 0; index < ticks; index += 1) {
    originalStep.call(this, 1);
    applyBottomBallFlipResets(this);
  }
};