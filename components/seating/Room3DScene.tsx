"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Instances,
  Instance,
  Environment,
  Lightformer,
  ContactShadows,
  MeshReflectorMaterial,
  RoundedBox,
} from "@react-three/drei";
import * as THREE from "three";
import type { Guest, SeatingTable } from "@/lib/types";

/**
 * R44/R45/R46 · Feature 3 — ROOM, high-quality photoreal pass.
 *
 * Pulled ONLY through Room3D's dynamic ssr:false import (three.js stays
 * out of the main bundle; only fetched on the 3D opt-in).
 *
 * R46 quality lift + bug fixes:
 *  • Real chairs: instanced SEAT + instanced BACKREST (proper
 *    silhouette, still 2 draw calls), each rotated to face the table.
 *  • Cinematic Lightformer rig (warm key / cool rim / soft top / glint).
 *  • Cleaner polished floor — tuned MeshReflectorMaterial on a sane
 *    40×40 plane (was a muddy 70×70 over-blurred mirror).
 *  • ACES-filmic tone mapping + exposure, high-performance GL.
 *  • Fixed: dead `receiveShadow` removed (shadows are baked via
 *    ContactShadows, realtime shadow maps are off); ContactShadows
 *    baked once after the scene is live so instanced furniture is
 *    captured; camera-focus lerp now eases and releases cleanly.
 */

interface TablePlot {
  table: SeatingTable;
  x: number;
  z: number;
  seats: { gx: number; gz: number; ang: number; occupied: boolean }[];
}

const TABLE_R = 0.95;
const SEAT_R = 1.55;
const EYE = 1.7;

function StudioEnv() {
  return (
    <Environment resolution={256}>
      <group>
        {/* warm key */}
        <Lightformer
          intensity={3}
          color="#FFE7BE"
          position={[0, 6, -5]}
          scale={[14, 7, 1]}
        />
        {/* cool rim */}
        <Lightformer
          intensity={1.3}
          color="#9FB8DA"
          position={[8, 4, 6]}
          scale={[7, 7, 1]}
        />
        {/* gold side fill */}
        <Lightformer
          intensity={1.1}
          color="#F4DEA9"
          position={[-8, 4, 5]}
          scale={[7, 7, 1]}
        />
        {/* soft top box */}
        <Lightformer
          form="rect"
          intensity={1.8}
          color="#ffffff"
          position={[0, 10, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 16, 1]}
        />
        {/* tight glint ring for specular sparkle */}
        <Lightformer
          form="ring"
          intensity={2.2}
          color="#FFF3D6"
          position={[0, 7, 8]}
          scale={[3, 3, 1]}
        />
      </group>
    </Environment>
  );
}

function DanceFloor() {
  const ref = useRef<THREE.MeshStandardMaterial>(null);
  useFrame((s) => {
    if (ref.current)
      ref.current.emissiveIntensity =
        0.55 + 0.4 * (0.5 + 0.5 * Math.sin(s.clock.elapsedTime * 1.5));
  });
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[5.4, 5.4]} />
        <meshStandardMaterial
          ref={ref}
          color="#7E6232"
          emissive="#F4DEA9"
          emissiveIntensity={0.6}
          roughness={0.18}
          metalness={0.6}
        />
      </mesh>
      {/* glowing gold rim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[2.7, 2.95, 64]} />
        <meshStandardMaterial
          color="#F4DEA9"
          emissive="#F4DEA9"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CameraRig({
  focus,
}: {
  focus: { x: number; y: number; z: number } | null;
}) {
  const tgt = useRef(new THREE.Vector3());
  useFrame((s) => {
    if (!focus) return;
    tgt.current.set(focus.x, focus.y, focus.z);
    // ease in, then effectively settle (small residual is imperceptible)
    s.camera.position.lerp(tgt.current, 0.05);
    s.camera.lookAt(0, 1.05, 0);
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
  focusGuestId: string | null;
}) {
  const plots = useMemo<TablePlot[]>(() => {
    const n = tables.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(n)));
    const gap = 3.7;
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
        const ang = (k / seatN) * Math.PI * 2;
        return {
          gx: x + Math.cos(ang) * SEAT_R,
          gz: z + Math.sin(ang) * SEAT_R,
          ang,
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
    return { x: seat.gx * 1.18, y: EYE, z: seat.gz * 1.18 };
  }, [focusGuestId, seatAssignments, plots]);

  const seatsAll = plots.flatMap((p) =>
    p.seats.map((sx) => ({
      x: sx.gx,
      z: sx.gz,
      // backrest sits a touch further out, facing the table center
      bx: sx.gx + Math.cos(sx.ang) * 0.22,
      bz: sx.gz + Math.sin(sx.ang) * 0.22,
      rot: -sx.ang + Math.PI / 2,
    })),
  );
  const plates = plots.flatMap((p) =>
    p.seats.map((sx) => ({
      x: p.x + Math.cos(sx.ang) * (TABLE_R - 0.22),
      z: p.z + Math.sin(sx.ang) * (TABLE_R - 0.22),
    })),
  );
  const occupied = plots.flatMap((p) =>
    p.seats
      .filter((sx) => sx.occupied)
      .map((sx) => ({ x: sx.gx, z: sx.gz })),
  );

  return (
    <Canvas
      shadows={false}
      dpr={[1, 2]}
      camera={{ position: [0, 8.5, 12], fov: 46 }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.18,
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#0B0A0C"]} />
      <fog attach="fog" args={["#0B0A0C", 24, 50]} />

      <ambientLight intensity={0.16} />
      <directionalLight position={[6, 11, 5]} intensity={0.45} color="#FFE9C2" />
      <StudioEnv />

      {/* Polished hall floor — subtle clean reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <MeshReflectorMaterial
          resolution={512}
          mixBlur={0.7}
          mixStrength={1.1}
          blur={[140, 50]}
          mirror={0.32}
          color="#121017"
          metalness={0.75}
          roughness={0.6}
          depthScale={0.6}
        />
      </mesh>

      <DanceFloor />

      <ContactShadows
        position={[0, 0.014, 0]}
        scale={42}
        blur={2.4}
        opacity={0.55}
        far={9}
        frames={1}
      />

      {/* Bar */}
      <group position={[-7.5, 0, -7.5]}>
        <RoundedBox
          args={[3.2, 1.15, 0.8]}
          radius={0.06}
          position={[0, 0.575, 0]}
        >
          <meshPhysicalMaterial
            color="#2A2016"
            roughness={0.35}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
          />
        </RoundedBox>
        <mesh position={[0, 1.17, 0]}>
          <boxGeometry args={[3.3, 0.06, 0.9]} />
          <meshPhysicalMaterial
            color="#0E0D10"
            roughness={0.12}
            metalness={0.5}
            clearcoat={1}
          />
        </mesh>
        {[-1.1, -0.5, 0.1, 0.7, 1.2].map((bx, i) => (
          <mesh key={i} position={[bx, 1.42, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.34, 14]} />
            <meshPhysicalMaterial
              color="#D9B36A"
              roughness={0.04}
              metalness={0.15}
              transmission={0.7}
              thickness={0.4}
              ior={1.45}
              emissive="#A8884A"
              emissiveIntensity={0.25}
            />
          </mesh>
        ))}
      </group>

      {/* Tables: pedestal + draped cloth + glowing centerpiece */}
      {plots.map((p) => (
        <group key={p.table.id} position={[p.x, 0, p.z]}>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry args={[0.16, 0.22, 0.74, 16]} />
            <meshStandardMaterial
              color="#1A1620"
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[0, 0.37, 0]}>
            <cylinderGeometry
              args={[TABLE_R * 0.86, TABLE_R, 0.74, 44, 1, true]}
            />
            <meshPhysicalMaterial
              color="#F3EFE6"
              roughness={0.85}
              sheen={1}
              sheenColor="#FFF7E8"
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <cylinderGeometry args={[TABLE_R, TABLE_R, 0.06, 44]} />
            <meshPhysicalMaterial
              color="#FBF7EE"
              roughness={0.8}
              sheen={1}
              sheenColor="#FFF7E8"
            />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <sphereGeometry args={[0.12, 20, 20]} />
            <meshStandardMaterial
              color="#F4DEA9"
              emissive="#F4DEA9"
              emissiveIntensity={1.5}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, 1.05, 0]}
            intensity={0.24}
            distance={3.2}
            color="#F4DEA9"
          />
        </group>
      ))}

      {/* Plates */}
      {plates.length > 0 && (
        <Instances limit={plates.length} range={plates.length}>
          <cylinderGeometry args={[0.16, 0.16, 0.018, 24]} />
          <meshPhysicalMaterial
            color="#F2EFEA"
            roughness={0.22}
            clearcoat={0.85}
          />
          {plates.map((pl, i) => (
            <Instance key={i} position={[pl.x, 0.79, pl.z]} />
          ))}
        </Instances>
      )}

      {/* Chairs — instanced SEAT */}
      {seatsAll.length > 0 && (
        <Instances limit={seatsAll.length} range={seatsAll.length}>
          <boxGeometry args={[0.46, 0.12, 0.46]} />
          <meshPhysicalMaterial
            color="#3A2E22"
            roughness={0.5}
            clearcoat={0.35}
            clearcoatRoughness={0.5}
          />
          {seatsAll.map((c, i) => (
            <Instance
              key={i}
              position={[c.x, 0.46, c.z]}
              rotation={[0, c.rot, 0]}
            />
          ))}
        </Instances>
      )}
      {/* Chairs — instanced BACKREST */}
      {seatsAll.length > 0 && (
        <Instances limit={seatsAll.length} range={seatsAll.length}>
          <boxGeometry args={[0.46, 0.52, 0.08]} />
          <meshPhysicalMaterial
            color="#33281D"
            roughness={0.55}
            clearcoat={0.3}
          />
          {seatsAll.map((c, i) => (
            <Instance
              key={i}
              position={[c.bx, 0.74, c.bz]}
              rotation={[0, c.rot, 0]}
            />
          ))}
        </Instances>
      )}

      {/* Seated-guest glow orbs */}
      {occupied.length > 0 && (
        <Instances limit={occupied.length} range={occupied.length}>
          <sphereGeometry args={[0.17, 20, 20]} />
          <meshStandardMaterial
            color="#F4DEA9"
            emissive="#D4B068"
            emissiveIntensity={0.75}
            roughness={0.2}
            metalness={0.3}
          />
          {occupied.map((o, i) => (
            <Instance key={i} position={[o.x, 1.05, o.z]} />
          ))}
        </Instances>
      )}

      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={3}
        maxDistance={34}
        maxPolarAngle={Math.PI / 2 - 0.04}
        target={[0, 0.7, 0]}
        enabled={!focus}
      />
      <CameraRig focus={focus} />
    </Canvas>
  );
}
