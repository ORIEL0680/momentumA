"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import type { Guest, SeatingTable } from "@/lib/types";

/**
 * R44 · Feature 3 — ROOM (3D seating).
 *
 * The actual react-three-fiber scene. This module is ONLY ever pulled
 * in through Room3D's dynamic import (ssr:false) so three.js never
 * touches the main bundle. Lean by design — instanced chairs, simple
 * geometry, clamped dpr — to hold 60fps on mid-range mobile.
 *
 * Scope note: the spec mentioned a stage "if cfg.hasStage", but no such
 * flag exists in eventConfig — omitted rather than inventing config.
 * Full device-orientation WALK is a documented follow-up; the headline
 * "stand where X sits" magic (camera flight to a seat) is implemented.
 */

interface TablePlot {
  table: SeatingTable;
  x: number;
  z: number;
  seats: { gx: number; gz: number; occupied: boolean }[];
}

const TABLE_R = 0.9;
const SEAT_R = 1.5;
const EYE = 1.7;

function GoldFloorPulse() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (ref.current)
      ref.current.emissiveIntensity =
        0.35 + 0.25 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.6));
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.011, 0]}>
      <planeGeometry args={[5, 5]} />
      <meshStandardMaterial
        ref={ref}
        color="#A8884A"
        emissive="#F4DEA9"
        emissiveIntensity={0.4}
        roughness={0.4}
      />
    </mesh>
  );
}

function CameraRig({
  focus,
}: {
  focus: { x: number; y: number; z: number } | null;
}) {
  const target = useRef(new THREE.Vector3());
  useFrame((s) => {
    if (!focus) return;
    target.current.set(focus.x, focus.y, focus.z);
    s.camera.position.lerp(target.current, 0.06);
    s.camera.lookAt(0, 1, 0);
  });
  return null;
}

export default function Room3DScene({
  tables,
  guests,
  seatAssignments,
  focusGuestId,
}: {
  tables: SeatingTable[];
  guests: Guest[];
  seatAssignments: Record<string, string>;
  /** When set, the camera flies to this guest's seat (1.7m, looking in). */
  focusGuestId: string | null;
}) {
  const plots = useMemo<TablePlot[]>(() => {
    const n = tables.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gap = 3.4;
    return tables.map((table, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col - (cols - 1) / 2) * gap;
      const z = (row - (Math.ceil(n / cols) - 1) / 2) * gap;
      const seatN = Math.min(12, Math.max(1, table.capacity));
      const assigned = guests.filter(
        (g) => seatAssignments[g.id] === table.id,
      ).length;
      const seats = Array.from({ length: seatN }, (_, k) => {
        const a = (k / seatN) * Math.PI * 2;
        return {
          gx: x + Math.cos(a) * SEAT_R,
          gz: z + Math.sin(a) * SEAT_R,
          occupied: k < assigned,
        };
      });
      return { table, x, z, seats };
    });
  }, [tables, guests, seatAssignments]);

  const focus = useMemo(() => {
    if (!focusGuestId) return null;
    const tid = seatAssignments[focusGuestId];
    if (!tid) return null;
    const p = plots.find((pl) => pl.table.id === tid);
    const seat = p?.seats.find((sx) => sx.occupied) ?? p?.seats[0];
    if (!p || !seat) return null;
    return { x: seat.gx * 1.15, y: EYE, z: seat.gz * 1.15 };
  }, [focusGuestId, seatAssignments, plots]);

  const chairs = plots.flatMap((p) =>
    p.seats.map((sx) => ({ x: sx.gx, z: sx.gz })),
  );
  const occupied = plots.flatMap((p) =>
    p.seats.filter((sx) => sx.occupied).map((sx) => ({ x: sx.gx, z: sx.gz })),
  );

  return (
    <Canvas
      dpr={[1, 1.75]}
      camera={{ position: [0, 9, 11], fov: 50 }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0A0A0B"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[6, 12, 6]} intensity={0.8} color="#FFE9C2" />
      <pointLight position={[0, 6, 0]} intensity={0.5} color="#F4DEA9" />

      {/* Hall floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#1E1E28" roughness={0.9} />
      </mesh>

      <GoldFloorPulse />

      {/* Bar */}
      <group position={[-7, 0, -7]}>
        <mesh position={[0, 0.55, 0]}>
          <boxGeometry args={[3, 1.1, 0.7]} />
          <meshStandardMaterial color="#3A2E1E" roughness={0.6} />
        </mesh>
        {[-1, -0.4, 0.2, 0.8, 1.2].map((bx, i) => (
          <mesh key={i} position={[bx, 1.28, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.32, 8]} />
            <meshStandardMaterial
              color="#D4B068"
              emissive="#A8884A"
              emissiveIntensity={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Tabletops */}
      {plots.map((p) => (
        <mesh key={p.table.id} position={[p.x, 0.74, p.z]}>
          <cylinderGeometry args={[TABLE_R, TABLE_R, 0.05, 28]} />
          <meshStandardMaterial color="#6B4F2A" roughness={0.5} />
        </mesh>
      ))}

      {/* Chairs — one InstancedMesh for all of them */}
      {chairs.length > 0 && (
        <Instances limit={chairs.length} range={chairs.length}>
          <boxGeometry args={[0.42, 0.5, 0.42]} />
          <meshStandardMaterial color="#2C2C36" roughness={0.8} />
          {chairs.map((c, i) => (
            <Instance key={i} position={[c.x, 0.25, c.z]} />
          ))}
        </Instances>
      )}

      {/* Seated-guest markers */}
      {occupied.length > 0 && (
        <Instances limit={occupied.length} range={occupied.length}>
          <sphereGeometry args={[0.16, 16, 16]} />
          <meshStandardMaterial
            color="#F4DEA9"
            emissive="#D4B068"
            emissiveIntensity={0.5}
          />
          {occupied.map((o, i) => (
            <Instance key={i} position={[o.x, 0.95, o.z]} />
          ))}
        </Instances>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={30}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0.6, 0]}
        enabled={!focus}
      />
      <CameraRig focus={focus} />
    </Canvas>
  );
}
