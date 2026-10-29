// Six-axis-style robot arm driven by analytic 2-bone IK.
import * as THREE from 'three';
import { child, shadows } from './assets.js';

const L1 = 1.5;               // upper arm
const L2 = 1.1 + 0.42;        // forearm + tool
const SHOULDER_Y = 1.1;       // base 0.6 + turret 0.5
const tmp = new THREE.Vector3();

export class RobotArm {
  constructor(assets, tool, x, z, scene) {
    this.root = assets.clone('robot');
    this.root.position.set(x, 0, z);
    this.turret = child(this.root, 'robot_turret');
    this.upper = child(this.root, 'robot_upper');
    this.fore = child(this.root, 'robot_fore');
    this.tool = assets.clone(tool);
    this.tool.position.set(0, 1.1, 0);
    this.fore.add(this.tool);
    shadows(this.root, true, false);
    scene.add(this.root);
    this.cur = { yaw: 0, a: 0.4, b: 1.2 };
    this.goal = { yaw: 0, a: 0.4, b: 1.2 };
    this.rest = null;
    this.speed = 0;
    this.tip = new THREE.Vector3();
  }

  /** Aim the tool tip at a world point. */
  reach(p) {
    const dx = p.x - this.root.position.x, dz = p.z - this.root.position.z;
    const yaw = Math.atan2(dx, dz);
    const d = Math.hypot(dx, dz);
    const v = p.y - SHOULDER_Y;
    let dist = Math.hypot(d, v);
    dist = Math.min(Math.max(dist, 0.35), L1 + L2 - 0.02);
    const phi = Math.atan2(d, v);
    const g = Math.acos(THREE.MathUtils.clamp((L1 * L1 + dist * dist - L2 * L2) / (2 * L1 * dist), -1, 1));
    const bend = Math.PI - Math.acos(THREE.MathUtils.clamp((L1 * L1 + L2 * L2 - dist * dist) / (2 * L1 * L2), -1, 1));
    this.goal.yaw = yaw;
    this.goal.a = phi - g;
    this.goal.b = bend;
  }

  /** Neutral pose pointing towards a world direction. */
  park(towards) {
    const dx = towards.x - this.root.position.x, dz = towards.z - this.root.position.z;
    this.goal.yaw = Math.atan2(dx, dz);
    this.goal.a = 0.25;
    this.goal.b = 1.35;
  }

  update(dt, rate = 6) {
    const k = 1 - Math.exp(-rate * dt);
    let dy = this.goal.yaw - this.cur.yaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const da = this.goal.a - this.cur.a, db = this.goal.b - this.cur.b;
    this.cur.yaw += dy * k; this.cur.a += da * k; this.cur.b += db * k;
    this.speed = dt > 0 ? (Math.abs(dy * k) + Math.abs(da * k) + Math.abs(db * k)) / dt : 0;
    this.turret.rotation.y = this.cur.yaw;
    this.upper.rotation.x = this.cur.a;
    this.fore.rotation.x = this.cur.b;
    this.tool.updateWorldMatrix(true, false);
    this.tip.set(0, 0.42, 0).applyMatrix4(this.tool.matrixWorld);
  }
}
